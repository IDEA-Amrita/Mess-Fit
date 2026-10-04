"""010 chatbot

RAG chatbot tables (Phase 7): conversations, messages, knowledge base
(documents + chunks), and a semantic response cache.

- chatbot_conversations / chatbot_messages: per-user — owner or admin (mirrors
  workout_logs RLS).
- kb_documents / kb_chunks: public reference data — public read, admin write
  (mirrors exercises/dishes).
- chat_cache: server-managed semantic cache — admin-only, no public read.

Embeddings are Gemini text-embedding-004 (768-dim), so VECTOR(768) (SCHEMA §5.17
originally specced 384 for bge-small; updated). HNSW cosine indexes back the
vector search. Reuses set_updated_at() (migration 002) and is_admin().

Revision ID: f4a8c1d63e29
Revises: e3f7b5c92d16
Create Date: 2026-06-15 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "f4a8c1d63e29"
down_revision: Union[str, Sequence[str], None] = "e3f7b5c92d16"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── conversations ────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE chatbot_conversations (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title       TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_chatbot_conv_user ON chatbot_conversations (user_id, updated_at DESC);

        CREATE TRIGGER trg_chatbot_conv_updated_at BEFORE UPDATE ON chatbot_conversations
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    # ─── messages ─────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE chatbot_messages (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id  UUID NOT NULL
                           REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
          role             TEXT NOT NULL
                           CHECK (role IN ('user', 'assistant', 'system')),
          content          TEXT NOT NULL,
          citations        JSONB NOT NULL DEFAULT '[]'::jsonb,
          tokens_in        INT,
          tokens_out       INT,
          model            TEXT,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_chatbot_msg_conv ON chatbot_messages (conversation_id, created_at);
        """
    )

    # ─── knowledge base ───────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE kb_documents (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source      TEXT NOT NULL,
          title       TEXT NOT NULL,
          metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE kb_chunks (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id  UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
          content      TEXT NOT NULL,
          embedding    VECTOR(768) NOT NULL,
          metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_kb_chunks_embedding ON kb_chunks
          USING hnsw (embedding vector_cosine_ops);
        """
    )

    # ─── semantic cache ───────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE chat_cache (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          query_embedding  VECTOR(768) NOT NULL,
          response         TEXT NOT NULL,
          citations        JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_chat_cache_embedding ON chat_cache
          USING hnsw (query_embedding vector_cosine_ops);
        """
    )

    # ─── Row-Level Security ───────────────────────────────────────────────
    op.execute(
        """
        ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
        CREATE POLICY chatbot_conv_owner ON chatbot_conversations
          FOR ALL USING (user_id = auth.uid() OR is_admin())
          WITH CHECK (user_id = auth.uid() OR is_admin());

        ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;
        CREATE POLICY chatbot_msg_owner ON chatbot_messages
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM chatbot_conversations c
              WHERE c.id = conversation_id
                AND (c.user_id = auth.uid() OR is_admin())
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM chatbot_conversations c
              WHERE c.id = conversation_id
                AND (c.user_id = auth.uid() OR is_admin())
            )
          );

        ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
        CREATE POLICY kb_documents_public_read ON kb_documents FOR SELECT USING (true);
        CREATE POLICY kb_documents_admin_write ON kb_documents
          FOR ALL USING (is_admin()) WITH CHECK (is_admin());

        ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
        CREATE POLICY kb_chunks_public_read ON kb_chunks FOR SELECT USING (true);
        CREATE POLICY kb_chunks_admin_write ON kb_chunks
          FOR ALL USING (is_admin()) WITH CHECK (is_admin());

        ALTER TABLE chat_cache ENABLE ROW LEVEL SECURITY;
        CREATE POLICY chat_cache_admin ON chat_cache
          FOR ALL USING (is_admin()) WITH CHECK (is_admin());
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_cache")
    op.execute("DROP TABLE IF EXISTS kb_chunks")
    op.execute("DROP TABLE IF EXISTS kb_documents")
    op.execute("DROP TABLE IF EXISTS chatbot_messages")
    op.execute("DROP TRIGGER IF EXISTS trg_chatbot_conv_updated_at ON chatbot_conversations")
    op.execute("DROP TABLE IF EXISTS chatbot_conversations")
