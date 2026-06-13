import datetime
import uuid
from collections import defaultdict
from typing import Sequence

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from messfit_api.auth.deps import get_current_user_id, require_admin
from messfit_api.db import get_session
from messfit_api.mess.models import (
    DishExclusionORM,
    DishORM,
    MessMenuORM,
    MessORM,
    OCRJobORM,
)
from messfit_api.mess.ocr import estimate_dish_nutrition
from messfit_api.mess.schemas import (
    DailyMenuResponse,
    DishBase,
    DishExclusionIn,
    DishExclusionOut,
    DishResponse,
    MessBase,
    MessResponse,
    OcrApproveIn,
    OcrJobOut,
    OcrJobSummary,
)
from messfit_api.mess.storage import signed_url, upload_menu_photo
from messfit_api.mess.tasks import run_ocr_job

router = APIRouter(prefix="/mess", tags=["mess"])

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/messes", response_model=list[MessResponse])
async def list_messes(db: AsyncSession = Depends(get_session)) -> Sequence[MessORM]:
    """List all available messes."""
    result = await db.execute(select(MessORM).order_by(MessORM.college, MessORM.name))
    return result.scalars().all()


@router.get("/dishes", response_model=list[DishResponse])
async def list_dishes(
    query: str | None = None,
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_session),
) -> Sequence[DishORM]:
    """List dishes, optionally filtering by name prefix/trigram."""
    stmt = select(DishORM)
    if query:
        # A simple ILIKE for now. For pg_trgm, we could use `.op("%%")`
        stmt = stmt.where(DishORM.name.ilike(f"%{query}%"))
    stmt = stmt.order_by(DishORM.name).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/messes/{mess_id}/menu", response_model=DailyMenuResponse)
async def get_daily_menu(
    mess_id: uuid.UUID,
    date: datetime.date | None = None,
    db: AsyncSession = Depends(get_session),
) -> DailyMenuResponse:
    """Get the daily menu for a given mess and date (defaults to today)."""
    target_date = date or datetime.date.today()
    day_of_week = target_date.weekday()  # Monday is 0, Sunday is 6

    # Fetch all menus for this mess and day of week, including the dish data
    stmt = (
        select(MessMenuORM)
        .where(
            MessMenuORM.mess_id == mess_id,
            MessMenuORM.day_of_week == day_of_week,
            MessMenuORM.effective_from <= target_date,
            (MessMenuORM.effective_to.is_(None) | (MessMenuORM.effective_to >= target_date)),
        )
        .options(selectinload(MessMenuORM.dish))
    )
    result = await db.execute(stmt)
    menus = result.scalars().all()

    grouped = defaultdict(list)
    for m in menus:
        grouped[m.meal_type].append(m)

    return DailyMenuResponse(
        date=target_date,
        day_of_week=day_of_week,
        breakfast=grouped.get("breakfast", []),
        lunch=grouped.get("lunch", []),
        snack=grouped.get("snack", []),
        dinner=grouped.get("dinner", []),
    )


@router.post("/admin/messes", response_model=MessResponse)
async def create_mess(
    mess: MessBase,
    admin_user_id: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> MessORM:
    """Create a mess. Requires admin role."""
    db_mess = MessORM(**mess.model_dump(), seeded_by=uuid.UUID(admin_user_id))
    db.add(db_mess)
    await db.commit()
    await db.refresh(db_mess)
    return db_mess


@router.post("/admin/dishes", response_model=DishResponse)
async def create_dish(
    dish: DishBase,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> DishORM:
    """Create a dish. Requires admin role."""
    db_dish = DishORM(**dish.model_dump())
    db.add(db_dish)
    await db.commit()
    await db.refresh(db_dish)
    return db_dish


# ─── Menu exclusions (per-user, per-date) ────────────────────────────


@router.get("/menu/exclusions", response_model=list[DishExclusionOut])
async def list_exclusions(
    date: datetime.date | None = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> Sequence[DishExclusionORM]:
    """List dishes the calling user has marked unavailable for a date (default: today)."""
    target_date = date or datetime.date.today()
    result = await db.execute(
        select(DishExclusionORM).where(
            DishExclusionORM.user_id == uuid.UUID(user_id),
            DishExclusionORM.date == target_date,
        )
    )
    return result.scalars().all()


@router.post("/menu/exclusions", response_model=DishExclusionOut, status_code=status.HTTP_201_CREATED)
async def exclude_dish(
    payload: DishExclusionIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> DishExclusionORM:
    """Mark a dish as unavailable for a meal on a specific date. Idempotent."""
    stmt = (
        pg_insert(DishExclusionORM)
        .values(
            user_id=uuid.UUID(user_id),
            date=payload.date,
            meal_type=payload.meal_type,
            dish_id=payload.dish_id,
        )
        .on_conflict_do_nothing()
        .returning(DishExclusionORM)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    await db.commit()

    if row is None:
        # Row already existed — fetch and return it.
        existing = await db.execute(
            select(DishExclusionORM).where(
                DishExclusionORM.user_id == uuid.UUID(user_id),
                DishExclusionORM.date == payload.date,
                DishExclusionORM.meal_type == payload.meal_type,
                DishExclusionORM.dish_id == payload.dish_id,
            )
        )
        row = existing.scalar_one()
    return row


@router.delete("/menu/exclusions/{dish_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unexclude_dish(
    dish_id: uuid.UUID,
    date: datetime.date,
    meal_type: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Remove a dish exclusion. No-op if the exclusion does not exist."""
    await db.execute(
        delete(DishExclusionORM).where(
            DishExclusionORM.user_id == uuid.UUID(user_id),
            DishExclusionORM.date == date,
            DishExclusionORM.meal_type == meal_type,
            DishExclusionORM.dish_id == dish_id,
        )
    )
    await db.commit()


# ─── Admin OCR (Phase 4) ──────────────────────────────────────────────


@router.post(
    "/admin/ocr/jobs",
    response_model=OcrJobSummary,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_ocr_job(
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


@router.get("/admin/ocr/jobs", response_model=list[OcrJobSummary])
async def list_ocr_jobs(
    mess_id: uuid.UUID | None = None,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> Sequence[OCRJobORM]:
    """List OCR jobs, newest first, optionally filtered by mess."""
    stmt = select(OCRJobORM).order_by(OCRJobORM.created_at.desc())
    if mess_id is not None:
        stmt = stmt.where(OCRJobORM.mess_id == mess_id)
    return (await db.execute(stmt)).scalars().all()


@router.get("/admin/ocr/jobs/{job_id}", response_model=OcrJobOut)
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


@router.post("/admin/ocr/jobs/{job_id}/approve", response_model=dict)
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


@router.post("/admin/ocr/jobs/{job_id}/reject", response_model=OcrJobSummary)
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
