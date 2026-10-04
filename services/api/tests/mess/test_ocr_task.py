"""Tests for the OCR worker (_process_job state machine).

A real ocr_jobs row is created (committed, TestMess-prefixed so the suite's
catalog purge cleans it even if teardown is skipped) and the external calls
(download + vision) are monkeypatched. Fuzzy matching runs for real against
the catalog — that's part of what produces the enriched parsed_result — so the
fixture makes sure the catalog dishes the menu names exist (a fresh test
database has none) and removes only the ones it added.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.mess import tasks
from messfit_api.mess.models import OCRJobORM
from messfit_api.mess.schemas import ParsedDay, ParsedDish, ParsedMeal, ParsedMenu

_MENU = ParsedMenu(
    weekly=[
        ParsedDay(
            day="Monday",
            meals=[
                ParsedMeal(
                    type="breakfast",
                    dishes=[ParsedDish(name="Idli"), ParsedDish(name="Sambar")],
                ),
                ParsedMeal(
                    type="lunch",
                    dishes=[ParsedDish(name="Zzqwx Nonsense", confidence_low=True)],
                ),
            ],
        )
    ]
)


@pytest.fixture
async def ocr_job(db_session: AsyncSession):
    mess_id = uuid.uuid4()
    job_id = uuid.uuid4()
    await db_session.execute(
        text(
            "INSERT INTO messes (id, name, college, city) "
            "VALUES (:id, :name, 'Amrita CB', 'Coimbatore')"
        ),
        {"id": str(mess_id), "name": f"TestMess-{mess_id.hex[:8]}"},
    )
    await db_session.execute(
        text(
            "INSERT INTO ocr_jobs (id, mess_id, photo_url, status) "
            "VALUES (:id, :mess_id, 'fake/path.jpg', 'pending')"
        ),
        {"id": str(job_id), "mess_id": str(mess_id)},
    )
    await db_session.commit()

    # The fuzzy matcher needs these in the catalog. Only rows this fixture
    # actually inserts are removed afterwards; a pre-existing catalog is kept.
    added: list[str] = []
    for name in ("Idli", "Sambar"):
        row = await db_session.execute(
            text(
                "INSERT INTO dishes (name, category, diet_type, default_serving_unit, "
                "default_serving_grams, kcal, protein_g, carbs_g, fats_g) "
                "VALUES (:name, 'other', 'veg', 'katori', 100, 100, 4, 18, 2) "
                "ON CONFLICT (name, default_serving_unit) DO NOTHING RETURNING id"
            ),
            {"name": name},
        )
        new_id = row.scalar_one_or_none()
        if new_id is not None:
            added.append(str(new_id))
    await db_session.commit()

    yield job_id

    for dish_id in added:
        await db_session.execute(text("DELETE FROM dishes WHERE id = :id"), {"id": dish_id})
    # Cascade: deleting the mess removes its ocr_jobs.
    await db_session.execute(text("DELETE FROM messes WHERE id = :id"), {"id": str(mess_id)})
    await db_session.commit()


async def test_success_transitions_to_ready_for_review(ocr_job, db_session, monkeypatch):
    async def fake_download(path):
        return b"fake-image-bytes"

    async def fake_ocr(image_bytes, mime="image/jpeg"):
        return _MENU

    monkeypatch.setattr(tasks, "download_menu_photo", fake_download)
    monkeypatch.setattr(tasks, "ocr_menu_image", fake_ocr)

    await tasks._process_job(db_session, ocr_job)

    job = (await db_session.execute(select(OCRJobORM).where(OCRJobORM.id == ocr_job))).scalar_one()
    assert job.status == "ready_for_review"
    assert job.error_message is None

    weekly = job.parsed_result["weekly"]
    assert weekly[0]["day"] == "Monday"
    bf = weekly[0]["meals"][0]["dishes"]
    # 'Sambar' should fuzzy-match the catalog; the nonsense lunch dish should not.
    assert any(d["name"] == "Sambar" and d["matched_dish_id"] for d in bf)
    nonsense = weekly[0]["meals"][1]["dishes"][0]
    assert nonsense["matched_dish_id"] is None
    assert nonsense["needs_review"] is True


async def test_download_failure_marks_job_failed(ocr_job, db_session, monkeypatch):
    async def boom_download(path):
        raise RuntimeError("storage 404: object missing")

    monkeypatch.setattr(tasks, "download_menu_photo", boom_download)

    await tasks._process_job(db_session, ocr_job)

    job = (await db_session.execute(select(OCRJobORM).where(OCRJobORM.id == ocr_job))).scalar_one()
    assert job.status == "failed"
    assert "storage 404" in job.error_message


async def test_ocr_failure_marks_job_failed(ocr_job, db_session, monkeypatch):
    from messfit_api.mess.ocr import OcrError

    async def fake_download(path):
        return b"bytes"

    async def boom_ocr(image_bytes, mime="image/jpeg"):
        raise OcrError("both vision backends failed")

    monkeypatch.setattr(tasks, "download_menu_photo", fake_download)
    monkeypatch.setattr(tasks, "ocr_menu_image", boom_ocr)

    await tasks._process_job(db_session, ocr_job)

    job = (await db_session.execute(select(OCRJobORM).where(OCRJobORM.id == ocr_job))).scalar_one()
    assert job.status == "failed"
    assert "vision backends" in job.error_message


async def test_missing_job_is_a_noop(db_session, monkeypatch):
    # A job id that doesn't exist must not raise.
    await tasks._process_job(db_session, uuid.uuid4())
