"""Migration 013 must never try to replace Supabase's own auth.uid().

Supabase's function reads both the flat `request.jwt.claim.sub` key and the
`request.jwt.claims` blob; only our old local-dev shim reads the flat key alone.
The guard is SQL, so evaluate its condition the way Postgres would."""

from __future__ import annotations

import importlib.util
import re
from pathlib import Path
from unittest.mock import patch

_PATH = next(Path(__file__).parents[2].glob("infra/migrations/versions/f9c31e5a7b48_013*.py"))

SUPABASE_UID = (
    "select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), "
    "(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid"
)
OLD_LOCAL_SHIM = "SELECT NULLIF(current_setting('request.jwt.claim.sub', TRUE), '')::UUID"


def _guard_sql() -> str:
    spec = importlib.util.spec_from_file_location("m013", _PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    executed: list[str] = []
    with patch.object(mod.op, "execute", lambda sql: executed.append(str(sql))):
        mod.upgrade()
    return next(s for s in executed if "CREATE OR REPLACE FUNCTION auth.uid()" in s)


def _would_replace(fn_src: str | None) -> bool:
    """Python mirror of the DO block's IF, built from the migration's own text."""
    m = re.search(r"IF fn_src IS NULL OR \((.*?)\) THEN", _guard_sql(), re.S)
    assert m, "guard clause not found"
    cond = m.group(1)
    like = lambda pat: bool(re.fullmatch(pat.replace("%", ".*"), fn_src or "", re.S))  # noqa: E731
    has_flat = like(".*request.jwt.claim.sub.*") if "claim.sub%'" in cond else True
    has_blob = like(".*request.jwt.claims.*")
    assert "NOT LIKE '%request.jwt.claims%'" in cond
    return fn_src is None or (has_flat and not has_blob)


def test_supabases_real_function_is_left_alone():
    assert _would_replace(SUPABASE_UID) is False


def test_our_old_local_shim_is_still_upgraded():
    assert _would_replace(OLD_LOCAL_SHIM) is True


def test_a_missing_function_is_created():
    assert _would_replace(None) is True
