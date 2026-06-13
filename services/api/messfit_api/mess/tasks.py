"""Celery task: process an OCR job asynchronously.

A multimodal vision call takes ~5-15s, so OCR runs on a worker rather than
inline (unlike the optimizer's sub-100ms solve). The upload endpoint enqueues
``run_ocr_job`` and returns immediately; the review UI polls the job row.

The job walks a status machine:
    pending → processing → ready_for_review        (success)
                         → failed                  (any error, message stored)

The task NEVER raises out — a download/model/DB error becomes a ``failed`` row
with a human-readable ``error_message`` so the admin can fix and retry.

The async core ``_process_job(db, job_id)`` takes a session so it's unit-test
friendly; the Celery entrypoint opens its own session and drives it.
"""

from __future__ import annotations

import asyncio
import logging
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..celery_app import celery_app
from ..db import SessionLocal
from .matching import best_match, match_dish_name
from .models import OCRJobORM
from .ocr import ocr_menu_image
from .schemas import ParsedMenu
from .storage import download_menu_photo

logger = logging.getLogger(__name__)

_MAX_ERROR_LEN = 1000


async def _enrich_with_matches(db: AsyncSession, menu: ParsedMenu) -> dict:
    """Annotate every parsed dish with its best catalog match for the review UI.

    Each dish gets ``matched_dish_id`` (or None → draft), the matched name and
    score, and ``needs_review`` (true when there's no confident match or the
    model itself flagged the cell low-confidence).
    """
    weekly = []
    for day in menu.weekly:
        meals = []
        for meal in day.meals:
            dishes = []
            for d in meal.dishes:
                top = best_match(await match_dish_name(db, d.name))
                dishes.append(
                    {
                        "name": d.name,
                        "confidence_low": d.confidence_low,
                        "matched_dish_id": str(top.dish_id) if top else None,
                        "matched_name": top.name if top else None,
                        "match_score": top.score if top else None,
                        "needs_review": top is None or d.confidence_low,
                    }
                )
            meals.append({"type": meal.type, "dishes": dishes})
        weekly.append({"day": day.day, "meals": meals})
    return {"weekly": weekly}


async def _set(db: AsyncSession, job_id: uuid.UUID, **values) -> None:
    await db.execute(update(OCRJobORM).where(OCRJobORM.id == job_id).values(**values))
    await db.commit()


async def _process_job(db: AsyncSession, job_id: uuid.UUID) -> None:
    """Download → OCR → match → persist. Marks the job failed on any error."""
    photo_url = (
        await db.execute(
            select(OCRJobORM.photo_url).where(OCRJobORM.id == job_id)
        )
    ).scalar_one_or_none()
    if photo_url is None:
        logger.warning("OCR job %s not found — nothing to process", job_id)
        return

    await _set(db, job_id, status="processing")
    try:
        image_bytes = await download_menu_photo(photo_url)
        menu = await ocr_menu_image(image_bytes)
        enriched = await _enrich_with_matches(db, menu)
        await _set(
            db,
            job_id,
            status="ready_for_review",
            parsed_result=enriched,
            error_message=None,
        )
    except Exception as e:  # noqa: BLE001 — any failure must land as a 'failed' job
        logger.exception("OCR job %s failed", job_id)
        await _set(db, job_id, status="failed", error_message=str(e)[:_MAX_ERROR_LEN])


@celery_app.task(name="messfit.ocr.run")
def run_ocr_job(job_id: str) -> dict:
    """Celery entrypoint. Opens a session and drives the async processor."""

    async def _run() -> None:
        async with SessionLocal() as db:
            await _process_job(db, uuid.UUID(job_id))

    asyncio.run(_run())
    return {"job_id": job_id}
