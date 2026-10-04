"""Crowdsourced "is this dish actually served?" votes (migration 019).

Two students vote on the same dish; the totals must count both (read policy is
"any signed-in user"), each may only change their own vote, and the endpoints
validate input and require sign-in.
"""

from __future__ import annotations

import datetime as dt
import json
import uuid

import pytest
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.auth.deps import get_current_user_id
from messfit_api.db import get_session
from messfit_api.main import app

TODAY = dt.date.today().isoformat()


@pytest.fixture
async def dish_and_voters(db_session):
    dish_id, a, b = uuid.uuid4(), str(uuid.uuid4()), str(uuid.uuid4())
    await db_session.execute(
        text(
            "INSERT INTO dishes (id, name, category, diet_type, default_serving_unit, default_serving_grams, "
            "kcal, protein_g, carbs_g, fats_g) VALUES (:id, :name, 'dal', 'veg', 'katori', 150, 180, 9, 24, 5)"
        ),
        {"id": str(dish_id), "name": f"TestDish-{dish_id.hex[:8]}"},
    )
    for uid in (a, b):
        await db_session.execute(
            text("INSERT INTO users (id, email) VALUES (:id, :e)"),
            {"id": uid, "e": f"fb+{uid[:8]}@messfit.local"},
        )
    await db_session.commit()
    yield str(dish_id), a, b
    await db_session.execute(text("DELETE FROM users WHERE id IN (:a, :b)"), {"a": a, "b": b})
    await db_session.execute(text("DELETE FROM dishes WHERE id = :id"), {"id": str(dish_id)})
    await db_session.commit()


def _as(user_id: str) -> AsyncClient:
    async def _user(db: AsyncSession = Depends(get_session)) -> str:
        await db.execute(
            text("SELECT set_config('request.jwt.claims', :c, false)"),
            {"c": json.dumps({"sub": user_id, "role": "authenticated"})},
        )
        return user_id

    app.dependency_overrides[get_current_user_id] = _user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.pop(get_current_user_id, None)


def _vote(dish_id: str, vote: str, meal: str = "lunch") -> dict:
    return {"date": TODAY, "meal_type": meal, "dish_id": dish_id, "vote": vote}


async def test_totals_count_every_students_vote(dish_and_voters):
    dish_id, a, b = dish_and_voters
    async with _as(a) as ca:
        r = await ca.post("/mess/dishes/feedback", json=_vote(dish_id, "confirm"))
        assert r.status_code == 201, r.text
        assert r.json() == {"dish_id": dish_id, "confirms": 1, "denies": 0}
    async with _as(b) as cb:
        r = await cb.post("/mess/dishes/feedback", json=_vote(dish_id, "deny"))
        assert r.json() == {"dish_id": dish_id, "confirms": 1, "denies": 1}
        # b's read sees a's vote too (totals only, never who voted).
        r = await cb.get(
            "/mess/dishes/feedback",
            params={"date": TODAY, "meal_type": "lunch", "dish_id": dish_id},
        )
        assert r.status_code == 200
        assert r.json() == {"dish_id": dish_id, "confirms": 1, "denies": 1}


async def test_voting_again_changes_your_vote_not_adds_one(dish_and_voters):
    dish_id, a, _ = dish_and_voters
    async with _as(a) as ca:
        await ca.post("/mess/dishes/feedback", json=_vote(dish_id, "confirm"))
        r = await ca.post("/mess/dishes/feedback", json=_vote(dish_id, "deny"))
        assert r.json() == {"dish_id": dish_id, "confirms": 0, "denies": 1}


async def test_input_is_validated(dish_and_voters):
    dish_id, a, _ = dish_and_voters
    async with _as(a) as ca:
        assert (
            await ca.post("/mess/dishes/feedback", json=_vote(dish_id, "confirm", meal="brunch"))
        ).status_code == 422
        assert (
            await ca.post("/mess/dishes/feedback", json=_vote(dish_id, "maybe"))
        ).status_code == 422
        r = await ca.get(
            "/mess/dishes/feedback",
            params={"date": TODAY, "meal_type": "brunch", "dish_id": dish_id},
        )
        assert r.status_code == 422


async def test_reading_totals_requires_sign_in(dish_and_voters, unauthed_client):
    dish_id, _, _ = dish_and_voters
    r = await unauthed_client.get(
        "/mess/dishes/feedback", params={"date": TODAY, "meal_type": "lunch", "dish_id": dish_id}
    )
    assert r.status_code == 401
