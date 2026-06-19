"""Profile + hostel-context HTTP endpoints.

All routes require a valid Supabase JWT (via ``get_current_user_id``)
and operate on the calling user's own row only — RLS in the DB also
enforces this; the auth check at the API layer is a defence-in-depth
sanity belt.
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user_id
from ..db import get_session
from . import repository as repo
from .goal_engine import Targets, compute_targets
from .schemas import HostelContextIn, HostelContextOut, ProfileIn, ProfileOut


router = APIRouter(prefix="/api/v1/profile", tags=["profile"])


# ─── profile ──────────────────────────────────────────────────────────


@router.get("/me", response_model=ProfileOut)
async def get_my_profile(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """Return the calling user's profile, or 404 if not set up yet."""
    profile = await repo.get_profile(session, UUID(user_id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not set up. Complete onboarding first.",
        )
    return profile


@router.put("/me", response_model=ProfileOut)
async def upsert_my_profile(
    payload: ProfileIn,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """Create or update the calling user's profile."""
    return await repo.upsert_profile(session, UUID(user_id), payload)


# ─── hostel context ───────────────────────────────────────────────────


@router.get("/hostel-context", response_model=HostelContextOut)
async def get_my_hostel_context(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> Any:
    ctx = await repo.get_hostel_context(session, UUID(user_id))
    if ctx is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hostel context not set up. Complete onboarding first.",
        )
    return ctx


@router.put("/hostel-context", response_model=HostelContextOut)
async def upsert_my_hostel_context(
    payload: HostelContextIn,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> Any:
    return await repo.upsert_hostel_context(session, UUID(user_id), payload)


# ─── targets ──────────────────────────────────────────────────────────


@router.get("/targets", response_model=Targets)
async def get_my_targets(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """Run the goal engine over the calling user's profile.

    Returns 409 (Conflict) if the user has not completed onboarding —
    we cannot compute targets without a profile.
    """
    profile = await repo.get_profile(session, UUID(user_id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Complete profile before requesting targets.",
        )

    return compute_targets(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=float(profile.height_cm),
        current_weight_kg=float(profile.current_weight_kg),
        target_rate_kg_per_week=float(profile.target_rate_kg_per_week),
        goal=profile.goal,
        activity_level=profile.activity_level,
        conditions=list(profile.conditions),
        today=date.today(),
    )
