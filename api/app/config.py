from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-validated settings. Values come from api/.env or the host."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    firebase_project_id: str = ""
    # Service account JSON (Firebase console > Project settings > Service accounts).
    # Empty: Application Default Credentials, or nothing at all when using the emulators.
    firebase_credentials_file: str = ""
    # Local emulators (firebase emulators:start), e.g. "127.0.0.1:8080" and "127.0.0.1:9099".
    firestore_emulator_host: str = ""
    firebase_auth_emulator_host: str = ""
    web_origin: str = "http://localhost:3000"
    cron_secret: str = ""
    llm_provider: Literal["mock", "anthropic", "gemini"] = "mock"
    llm_model: str = ""
    anthropic_api_key: str = ""
    llm_timeout_seconds: float = 90.0
    # Anthropic only: effort level and server-side fallback on a false-positive refusal.
    llm_effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    llm_fallbacks: bool = True
    # Gemini (free tier, key from Google AI Studio). Free quotas are small and per model, so
    # when LLM_MODEL runs out (HTTP 429) or is overloaded, the call moves to this model.
    gemini_api_key: str = ""
    gemini_fallback_model: str = ""
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
