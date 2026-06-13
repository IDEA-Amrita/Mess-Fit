"""007 ocr_jobs

Async OCR jobs for onboarding a mess menu from a photo (Phase 4).
Admin-only resource: RLS mirrors dishes/mess_menus — public has no access,
admins do everything. Reuses set_updated_at() (migration 002) and is_admin().

Revision ID: c1d5f3a82e94
Revises: b8c4e2a91f73
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c1d5f3a82e94"
down_revision: Union[str, Sequence[str], None] = "b8c4e2a91f73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ocr_jobs (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mess_id         UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
          uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
          photo_url       TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'ready_for_review',
                                            'approved', 'rejected', 'failed')),
          parsed_result   JSONB,
          error_message   TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TRIGGER trg_ocr_jobs_updated_at BEFORE UPDATE ON ocr_jobs
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE INDEX idx_ocr_jobs_mess ON ocr_jobs (mess_id);
        CREATE INDEX idx_ocr_jobs_status ON ocr_jobs (status);
        """
    )

    # RLS: OCR is an admin-only tool. No public access; admins do everything.
    op.execute(
        """
        ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY ocr_jobs_admin_read ON ocr_jobs FOR SELECT USING (is_admin());
        CREATE POLICY ocr_jobs_admin_write ON ocr_jobs FOR INSERT WITH CHECK (is_admin());
        CREATE POLICY ocr_jobs_admin_update ON ocr_jobs FOR UPDATE USING (is_admin());
        CREATE POLICY ocr_jobs_admin_delete ON ocr_jobs FOR DELETE USING (is_admin());
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_ocr_jobs_updated_at ON ocr_jobs")
    op.drop_table("ocr_jobs")
