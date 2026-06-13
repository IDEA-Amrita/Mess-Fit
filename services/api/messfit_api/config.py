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


settings = Settings()
