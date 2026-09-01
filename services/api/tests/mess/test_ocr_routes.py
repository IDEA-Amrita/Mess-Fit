"""Tests for the admin OCR endpoints.

Storage, the vision/estimate LLM calls, and the Celery enqueue are all
monkeypatched — these tests exercise HTTP behaviour, auth gating, upload
validation, state guards, and the approve→mess_menus write path, not the
external services (those have their own unit tests).
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.mess import ocr_routes
from messfit_api.mess.schemas import NutritionEstimate


@pytest.fixture
async def mess_id(db_session: AsyncSession):
    mid = uuid.uuid4()
    await db_session.execute(
        text(
            "INSERT INTO messes (id, name, college, city) "
            "VALUES (:id, :name, 'Amrita CB', 'Coimbatore')"
        ),
        {"id": str(mid), "name": f"TestMess-{mid.hex[:8]}"},
    )
    await db_session.commit()
    yield mid
    # Cascade removes ocr_jobs + mess_menus for this mess.
    await db_session.execute(text("DELETE FROM messes WHERE id = :id"), {"id": str(mid)})
    await db_session.commit()


async def _insert_job(db, mess_id, status="ready_for_review", parsed=None):
    jid = uuid.uuid4()
    await db.execute(
        text(
            "INSERT INTO ocr_jobs (id, mess_id, photo_url, status, parsed_result) "
            "VALUES (:id, :mid, 'p/x.jpg', :st, CAST(:pr AS jsonb))"
        ),
        {"id": str(jid), "mid": str(mess_id), "st": status,
         "pr": __import__("json").dumps(parsed) if parsed else None},
    )
    await db.commit()
    return jid


# ─── auth ─────────────────────────────────────────────────────────────


async def test_upload_requires_admin(client, mess_id):
    # Plain (non-admin) client → 403.
    resp = await client.post(
        "/mess/admin/ocr/jobs",
        data={"mess_id": str(mess_id)},
        files={"file": ("menu.jpg", b"bytes", "image/jpeg")},
    )
    assert resp.status_code == 403


# ─── upload ───────────────────────────────────────────────────────────


async def test_upload_creates_pending_job_and_enqueues(
    admin_client, mess_id, monkeypatch
):
    enqueued: list[str] = []

    async def fake_upload(image_bytes, content_type, mess):
        return f"{mess}/abc.jpg"

    monkeypatch.setattr(ocr_routes, "upload_menu_photo", fake_upload)
    monkeypatch.setattr(ocr_routes.run_ocr_job, "delay", lambda jid: enqueued.append(jid))

    resp = await admin_client.post(
        "/mess/admin/ocr/jobs",
        data={"mess_id": str(mess_id)},
        files={"file": ("menu.jpg", b"fake-image", "image/jpeg")},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "pending"
    assert body["mess_id"] == str(mess_id)
    # The worker was handed the new job id.
    assert enqueued == [body["id"]]


async def test_upload_rejects_non_image(admin_client, mess_id, monkeypatch):
    monkeypatch.setattr(ocr_routes, "upload_menu_photo", lambda *a, **k: "x")
    resp = await admin_client.post(
        "/mess/admin/ocr/jobs",
        data={"mess_id": str(mess_id)},
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 415


async def test_upload_unknown_mess_404(admin_client, monkeypatch):
    monkeypatch.setattr(ocr_routes, "upload_menu_photo", lambda *a, **k: "x")
    resp = await admin_client.post(
        "/mess/admin/ocr/jobs",
        data={"mess_id": str(uuid.uuid4())},
        files={"file": ("menu.jpg", b"bytes", "image/jpeg")},
    )
    assert resp.status_code == 404


# ─── list / get ───────────────────────────────────────────────────────


async def test_list_and_get_job(admin_client, db_session, mess_id, monkeypatch):
    parsed = {"weekly": [{"day": "Monday", "meals": []}]}
    jid = await _insert_job(db_session, mess_id, parsed=parsed)

    async def fake_signed(path, expires_in=600):
        return "https://signed.example/x.jpg"

    monkeypatch.setattr(ocr_routes, "signed_url", fake_signed)

    listed = (await admin_client.get(f"/mess/admin/ocr/jobs?mess_id={mess_id}")).json()
    assert any(j["id"] == str(jid) for j in listed)

    detail = (await admin_client.get(f"/mess/admin/ocr/jobs/{jid}")).json()
    assert detail["parsed_result"] == parsed
    assert detail["image_url"] == "https://signed.example/x.jpg"


async def test_get_missing_job_404(admin_client):
    resp = await admin_client.get(f"/mess/admin/ocr/jobs/{uuid.uuid4()}")
    assert resp.status_code == 404


# ─── approve / reject ─────────────────────────────────────────────────


async def test_approve_writes_menu_and_creates_draft(
    admin_client, db_session, mess_id, monkeypatch
):
    jid = await _insert_job(db_session, mess_id)

    # One matched dish (real catalog row we insert) + one unmatched (draft).
    matched_id = uuid.uuid4()
    draft_name = f"OCR Draft {uuid.uuid4().hex[:8]}"
    await db_session.execute(
        text(
            "INSERT INTO dishes (id, name, category, default_serving_unit, "
            "default_serving_grams, kcal, protein_g, carbs_g, fats_g) "
            "VALUES (:id, :name, 'dal', 'katori', 100, 100, 5, 15, 2)"
        ),
        {"id": str(matched_id), "name": f"TestDish-{matched_id.hex[:8]}"},
    )
    await db_session.commit()

    async def fake_estimate(name):
        return NutritionEstimate(kcal=120, protein_g=6, allergens=["eggs"])

    # The real call site is ocr_routes._get_or_create_draft_dish, which reads
    # the name bound in ocr_routes' own namespace — patching it on `routes`
    # (the old target here) never takes effect, since routes.py doesn't import
    # this name at all. That went unnoticed because the assertions below only
    # ever checked row counts, never the estimated values themselves.
    monkeypatch.setattr(ocr_routes, "estimate_dish_nutrition", fake_estimate)

    payload = {
        "effective_from": "2026-01-01",
        "weekly": [
            {
                "day_of_week": 0,
                "meals": [
                    {
                        "type": "breakfast",
                        "dishes": [
                            {"name": "Matched", "dish_id": str(matched_id)},
                            {"name": draft_name, "dish_id": None},
                        ],
                    }
                ],
            }
        ],
    }
    resp = await admin_client.post(f"/mess/admin/ocr/jobs/{jid}/approve", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "approved"
    assert body["dishes_created"] == 1
    assert body["menu_rows_added"] == 2

    # Menu rows landed for this mess.
    count = (
        await db_session.execute(
            text("SELECT count(*) FROM mess_menus WHERE mess_id = :m"),
            {"m": str(mess_id)},
        )
    ).scalar()
    assert count == 2

    # The draft dish must carry the estimate's allergens and nutrition —
    # proves the fake_estimate patch actually took effect (regression guard
    # for the wrong-module monkeypatch target above) and that allergens flow
    # from NutritionEstimate into the DB insert.
    draft_row = (
        await db_session.execute(
            text("SELECT kcal, allergens FROM dishes WHERE name = :n"),
            {"n": draft_name},
        )
    ).one()
    assert float(draft_row.kcal) == 120
    assert list(draft_row.allergens) == ["eggs"]

    # Cleanup: drop menu rows (RESTRICT) before the draft dish, then matched dish.
    await db_session.execute(
        text("DELETE FROM mess_menus WHERE mess_id = :m"), {"m": str(mess_id)}
    )
    await db_session.execute(
        text("DELETE FROM dishes WHERE name = :n OR id = :i"),
        {"n": draft_name, "i": str(matched_id)},
    )
    await db_session.commit()


async def test_approve_rejects_non_reviewable_job(admin_client, db_session, mess_id):
    jid = await _insert_job(db_session, mess_id, status="pending")
    resp = await admin_client.post(
        f"/mess/admin/ocr/jobs/{jid}/approve",
        json={"effective_from": "2026-01-01", "weekly": []},
    )
    assert resp.status_code == 409


async def test_reject_sets_status(admin_client, db_session, mess_id):
    jid = await _insert_job(db_session, mess_id)
    resp = await admin_client.post(f"/mess/admin/ocr/jobs/{jid}/reject")
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
