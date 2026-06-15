from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
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


settings = Settings()
