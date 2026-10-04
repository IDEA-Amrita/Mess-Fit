"""Repository layer for profile + hostel_context.

Plain async functions that take a session, do one DB operation, return
domain data. The router doesn't know about SQLAlchemy; this module is
the boundary.

Upserts use Postgres' ``ON CONFLICT (user_id) DO UPDATE`` so the
client doesn't need to know whether a row already exists.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.auth.models import UserORM
from .models import HostelContext, Profile
from .schemas import HostelContextIn, ProfileIn


# ─── profiles ─────────────────────────────────────────────────────────


async def get_profile(session: AsyncSession, user_id: UUID) -> Profile | None:
    result = await session.execute(select(Profile).where(Profile.user_id == user_id))
    return result.scalar_one_or_none()


async def upsert_profile(session: AsyncSession, user_id: UUID, payload: ProfileIn) -> Profile:
    """Insert or update by ``user_id``."""
    values = {"user_id": user_id, **payload.model_dump()}

    # Anything except user_id is updatable on conflict.
    update_cols = {k: v for k, v in values.items() if k != "user_id"}

    stmt = (
        pg_insert(Profile)
        .values(**values)
        .on_conflict_do_update(index_elements=["user_id"], set_=update_cols)
        .returning(Profile)
    )
    row = (await session.execute(stmt)).scalar_one()
    await session.commit()
    return row


# ─── hostel_contexts ──────────────────────────────────────────────────


async def get_hostel_context(session: AsyncSession, user_id: UUID) -> HostelContext | None:
    result = await session.execute(select(HostelContext).where(HostelContext.user_id == user_id))
    return result.scalar_one_or_none()


async def upsert_hostel_context(
    session: AsyncSession, user_id: UUID, payload: HostelContextIn
) -> HostelContext:
    values = {"user_id": user_id, **payload.model_dump()}
    update_cols = {k: v for k, v in values.items() if k != "user_id"}

    stmt = (
        pg_insert(HostelContext)
        .values(**values)
        .on_conflict_do_update(index_elements=["user_id"], set_=update_cols)
        .returning(HostelContext)
    )
    row = (await session.execute(stmt)).scalar_one()

    # Stamp onboarded_at on first save only — does not overwrite if the user
    # updates their hostel context later. Both writes share one commit so they
    # are atomic; a crash between them won't leave a partial state.
    await session.execute(
        update(UserORM)
        .where(UserORM.id == user_id, UserORM.onboarded_at.is_(None))
        .values(onboarded_at=func.now())
    )

    await session.commit()
    return row
