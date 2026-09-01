from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    # Connects as messfit_worker (BYPASSRLS) — Celery tasks run on a schedule
    # with no authenticated user in context and legitimately need cross-user
    # access (the deletion sweep, OCR draft-dish creation). Falls back to
    # database_url so local dev (a single throwaway Postgres, one role) needs
    # no extra config; production must set this to the worker role's URL.
    celery_database_url: str = ""
    redis_url: str
    supabase_url: str
    supabase_jwt_secret: str
    supabase_project_ref: str
    # Service-role key — backend-only, used for Storage upload/download/signing
    # (menu photos go to a private bucket). Never expose to the client.
    supabase_service_role_key: str = ""
    gemini_api_key: str
    groq_api_key: str = ""
    cors_origins: List[str] = ["http://localhost:3000"]
    environment: str = "development"
    # Observability (Phase 9) — all optional; empty values disable the integration.
    # OTLP/HTTP traces endpoint (e.g. Grafana Cloud Tempo). No endpoint => no export.
    otel_exporter_otlp_endpoint: str = ""
    # OTLP headers in W3C "key=value,key=value" form (e.g. Authorization=Basic%20...).
    otel_exporter_otlp_headers: str = ""
    # Sentry DSN — empty disables error reporting (no events shipped).
    sentry_dsn: str = ""
    # Rate limiting (Phase 9). Storage defaults to in-memory; set to the Redis
    # URL in production so limits are shared across workers.
    rate_limit_enabled: bool = True
    rate_limit_storage_uri: str = "memory://"
    
    # Push Notifications
    vapid_private_key: str = ""
    vapid_subscriber: str = "mailto:admin@example.com"


settings = Settings()
