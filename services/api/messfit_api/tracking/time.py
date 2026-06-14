"""Timezone helpers for logging.

All log dates and streak/day-boundary logic use India Standard Time. Storing or
comparing against the server's local "today" causes the classic "yesterday's log
shows up today" bug (see PHASE-06 pitfalls). V1 assumes every user is in IST.
"""

from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> dt.datetime:
    """Current wall-clock time in IST."""
    return dt.datetime.now(IST)


def today_ist() -> dt.date:
    """Today's calendar date in IST."""
    return now_ist().date()
