"""Leaderboard rankings based on adherence scores.

Computes a weekly adherence leaderboard for users in the same college/mess.
The ranking uses the same adherence metric as the progress page, ensuring
consistency across the product.

Privacy: only display names and scores are exposed — never a raw user_id, a
real primary key that would let one student look up another's account. The
viewer's own row is flagged with ``is_you`` instead, computed server-side.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_college_leaderboard(
    db: AsyncSession,
    college: str,
    viewer_id: uuid.UUID,
    days: int = 7,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Return top users by adherence in the same college over the last N days.

    The query:
    1. Joins profiles to filter by college.
    2. Counts meal logs with status='as_planned' per user.
    3. Counts workout logs with status='done' per user.
    4. Computes a simplified adherence score: (meals_followed / (days*4) + workouts_done / (days*3/7)) / 2.
    5. Ranks by score descending.
    6. Joins public.users for a display name, and flags the viewer's own row.

    This is a simplified version that avoids reading each user's workout_days_per_week
    setting (which would require a complex subquery). Using 3/week as default is
    a reasonable approximation for ranking purposes.
    """
    end = dt.date.today()
    start = end - dt.timedelta(days=days)

    # Raw SQL for performance — this is a read-only ranking query.
    query = text("""
        WITH meal_counts AS (
            SELECT user_id, COUNT(*) as followed
            FROM meal_logs
            WHERE date >= :start AND date <= :end AND status = 'as_planned'
            GROUP BY user_id
        ),
        workout_counts AS (
            SELECT user_id, COUNT(*) as done
            FROM workout_logs
            WHERE date >= :start AND date <= :end AND status = 'done'
            GROUP BY user_id
        ),
        scores AS (
            SELECT
                p.user_id,
                COALESCE(mc.followed, 0) as meals_followed,
                COALESCE(wc.done, 0) as workouts_done,
                (
                    LEAST(1.0, COALESCE(mc.followed, 0)::float / NULLIF(:meal_slots, 0)) +
                    LEAST(1.0, COALESCE(wc.done, 0)::float / NULLIF(:workout_slots, 0))
                ) / 2.0 as score
            FROM profiles p
            LEFT JOIN meal_counts mc ON mc.user_id = p.user_id
            LEFT JOIN workout_counts wc ON wc.user_id = p.user_id
            WHERE EXISTS (
                SELECT 1 FROM hostel_contexts hc
                WHERE hc.user_id = p.user_id
                AND EXISTS (
                    SELECT 1 FROM messes m WHERE m.id = hc.mess_id AND m.college = :college
                )
            )
        )
        SELECT
            s.user_id = :viewer_id AS is_you,
            COALESCE(u.display_name, 'A student') AS display_name,
            s.meals_followed,
            s.workouts_done,
            s.score
        FROM scores s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.score > 0
        ORDER BY s.score DESC
        LIMIT :lim
    """)

    meal_slots = days * 4
    workout_slots = max(1, int(days * 3 / 7))

    result = await db.execute(
        query,
        {
            "start": start,
            "end": end,
            "meal_slots": meal_slots,
            "workout_slots": workout_slots,
            "college": college,
            "viewer_id": viewer_id,
            "lim": limit,
        },
    )

    rows = result.mappings().all()
    return [
        {
            "rank": i + 1,
            "is_you": bool(r["is_you"]),
            "display_name": r["display_name"],
            "meals_followed": r["meals_followed"],
            "workouts_done": r["workouts_done"],
            "score": round(float(r["score"]) * 100, 1),
        }
        for i, r in enumerate(rows)
    ]
