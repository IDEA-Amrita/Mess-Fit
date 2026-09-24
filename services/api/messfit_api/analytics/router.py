from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import insert, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_active_user_id, require_admin
from ..db import get_session
from ..observability.ratelimit import limiter
from .models import AnalyticsEvent
from .schemas import AnalyticsSummary, DailyActive, EventBatchIn, EventCount

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
async def ingest_events(
    request: Request,
    batch: EventBatchIn,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Record a batch of the caller's own usage events. Always attributed to the
    authenticated user; the body cannot name another one."""
    uid = uuid.UUID(user_id)
    await db.execute(
        insert(AnalyticsEvent),
        [{"user_id": uid, "name": e.name, "props": e.props, "occurred_at": e.occurred_at} for e in batch.events],
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(
    days: int = Query(14, ge=1, le=90),
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> AnalyticsSummary:
    """Pilot overview for admins: daily active users and per-feature usage."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    dau_rows = (
        await db.execute(
            text(
                "SELECT to_char(date_trunc('day', occurred_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS day, "
                "count(DISTINCT user_id) AS users "
                "FROM analytics_events WHERE occurred_at >= :since GROUP BY 1 ORDER BY 1"
            ),
            {"since": since},
        )
    ).all()
    by_event = (
        await db.execute(
            text(
                "SELECT name, count(*) AS events, count(DISTINCT user_id) AS users "
                "FROM analytics_events WHERE occurred_at >= :since GROUP BY name ORDER BY events DESC"
            ),
            {"since": since},
        )
    ).all()
    totals = (
        await db.execute(
            text(
                "SELECT count(*) AS events, count(DISTINCT user_id) AS users "
                "FROM analytics_events WHERE occurred_at >= :since"
            ),
            {"since": since},
        )
    ).one()

    return AnalyticsSummary(
        window_days=days,
        total_events=totals.events,
        active_users_window=totals.users,
        dau=[DailyActive(day=r.day, users=r.users) for r in dau_rows],
        by_event=[EventCount(name=r.name, events=r.events, users=r.users) for r in by_event],
    )
