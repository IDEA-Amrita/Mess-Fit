import uuid
from typing import Sequence

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.auth.deps import require_admin
from messfit_api.db import get_session
from messfit_api.mess.models import DishORM, MessMenuORM, MessORM, OCRJobORM
from messfit_api.mess.ocr import estimate_dish_nutrition
from messfit_api.mess.schemas import OcrApproveIn, OcrJobOut, OcrJobSummary
from messfit_api.mess.storage import signed_url, upload_menu_photo
from messfit_api.mess.tasks import run_ocr_job
from messfit_api.observability.ratelimit import limiter

router = APIRouter(prefix="/mess/admin/ocr", tags=["mess-ocr"])

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/jobs",
    response_model=OcrJobSummary,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("10/minute")
async def create_ocr_job(
    request: Request,
    mess_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    admin_user_id: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> OCRJobORM:
    """Upload a menu photo and enqueue async OCR. Returns immediately (pending).

    The photo goes to the private Storage bucket; the parsed result lands on
    the job row when the worker finishes. Poll GET /admin/ocr/jobs/{id}.
    """
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type {file.content_type!r}",
        )

    mess = await db.get(MessORM, mess_id)
    if mess is None:
        raise HTTPException(status_code=404, detail="Mess not found")

    image_bytes = await file.read()
    if len(image_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 10 MB",
        )

    path = await upload_menu_photo(image_bytes, file.content_type, mess_id)

    job = OCRJobORM(
        mess_id=mess_id,
        uploaded_by=uuid.UUID(admin_user_id),
        photo_url=path,
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Hand off to the worker (async). With CELERY_TASK_ALWAYS_EAGER it runs inline.
    run_ocr_job.delay(str(job.id))
    return job


@router.get("/jobs", response_model=list[OcrJobSummary])
async def list_ocr_jobs(
    mess_id: uuid.UUID | None = None,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> Sequence[OCRJobORM]:
    """List OCR jobs, newest first, optionally filtered by mess."""
    stmt = select(OCRJobORM).order_by(OCRJobORM.created_at.desc()).limit(limit).offset(offset)
    if mess_id is not None:
        stmt = stmt.where(OCRJobORM.mess_id == mess_id)
    return (await db.execute(stmt)).scalars().all()


@router.get("/jobs/{job_id}", response_model=OcrJobOut)
async def get_ocr_job(
    job_id: uuid.UUID,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> OcrJobOut:
    """Fetch one job with its parsed result and a short-lived signed image URL."""
    job = await db.get(OCRJobORM, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="OCR job not found")

    image_url: str | None = None
    try:
        image_url = await signed_url(job.photo_url)
    except Exception:  # noqa: BLE001 — a missing image shouldn't 500 the review screen
        image_url = None

    return OcrJobOut(
        id=job.id,
        mess_id=job.mess_id,
        status=job.status,
        parsed_result=job.parsed_result,
        error_message=job.error_message,
        image_url=image_url,
    )


@router.post("/jobs/{job_id}/approve", response_model=dict)
async def approve_ocr_job(
    job_id: uuid.UUID,
    payload: OcrApproveIn,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Approve a reviewed menu into mess_menus.

    Matched dishes link by id; unmatched dishes (dish_id null) are created as
    drafts with Gemini-estimated nutrition (confidence='estimated') first.
    Menu upserts are idempotent on the natural key, mirroring seed_menus.py.
    """
    job = await db.get(OCRJobORM, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="OCR job not found")
    if job.status not in ("ready_for_review", "failed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job is '{job.status}', not reviewable",
        )

    dishes_created = 0
    menu_rows = 0
    # Cache created/looked-up draft dish ids by name within this approve call.
    draft_ids: dict[str, uuid.UUID] = {}

    for day in payload.weekly:
        for meal in day.meals:
            for dish in meal.dishes:
                if dish.dish_id is not None:
                    dish_id = dish.dish_id
                elif dish.name in draft_ids:
                    dish_id = draft_ids[dish.name]
                else:
                    dish_id, created = await _get_or_create_draft_dish(db, dish.name)
                    draft_ids[dish.name] = dish_id
                    dishes_created += int(created)

                stmt = (
                    pg_insert(MessMenuORM)
                    .values(
                        mess_id=job.mess_id,
                        effective_from=payload.effective_from,
                        day_of_week=day.day_of_week,
                        meal_type=meal.type,
                        dish_id=dish_id,
                        availability="usually",
                    )
                    .on_conflict_do_nothing(
                        index_elements=[
                            "mess_id", "effective_from", "day_of_week",
                            "meal_type", "dish_id",
                        ]
                    )
                    .returning(MessMenuORM.id)
                )
                inserted = (await db.execute(stmt)).scalar_one_or_none()
                menu_rows += int(inserted is not None)

    job.status = "approved"
    await db.commit()
    return {
        "status": "approved",
        "dishes_created": dishes_created,
        "menu_rows_added": menu_rows,
    }


@router.post("/jobs/{job_id}/reject", response_model=OcrJobSummary)
async def reject_ocr_job(
    job_id: uuid.UUID,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> OCRJobORM:
    """Reject a job (e.g. unreadable photo). Leaves no menu rows."""
    job = await db.get(OCRJobORM, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="OCR job not found")
    job.status = "rejected"
    await db.commit()
    await db.refresh(job)
    return job


async def _get_or_create_draft_dish(
    db: AsyncSession, name: str
) -> tuple[uuid.UUID, bool]:
    """Return (dish_id, created). Reuses an existing dish of the same
    (name, serving_unit); otherwise creates a draft with estimated nutrition."""
    est = await estimate_dish_nutrition(name)
    stmt = (
        pg_insert(DishORM)
        .values(
            name=name,
            category=est.category,
            diet_type=est.diet_type,
            default_serving_unit=est.default_serving_unit,
            default_serving_grams=est.default_serving_grams,
            kcal=est.kcal,
            protein_g=est.protein_g,
            carbs_g=est.carbs_g,
            fats_g=est.fats_g,
            portion_icon=est.portion_icon,
            confidence="estimated",
            source="ocr",
        )
        .on_conflict_do_nothing(index_elements=["name", "default_serving_unit"])
        .returning(DishORM.id)
    )
    new_id = (await db.execute(stmt)).scalar_one_or_none()
    if new_id is not None:
        return new_id, True

    existing = (
        await db.execute(
            select(DishORM.id).where(
                DishORM.name == name,
                DishORM.default_serving_unit == est.default_serving_unit,
            )
        )
    ).scalar_one()
    return existing, False
