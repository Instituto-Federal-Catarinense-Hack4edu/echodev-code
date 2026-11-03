from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-validated settings. Values come from api/.env or the host."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    web_origin: str = "http://localhost:3000"
    cron_secret: str = ""
    llm_provider: Literal["mock", "anthropic"] = "mock"
    llm_model: str = ""
    anthropic_api_key: str = ""
    llm_timeout_seconds: float = 90.0
    llm_effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    llm_fallbacks: bool = True
    environment: Literal["development", "production", "test"] = "development"

    @property
    def web_origins(self) -> list[str]:
        """WEB_ORIGIN may list several exact origins separated by commas (never '*')."""
        return [
            o.strip().rstrip("/") for o in self.web_origin.split(",") if o.strip() not in ("", "*")
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
