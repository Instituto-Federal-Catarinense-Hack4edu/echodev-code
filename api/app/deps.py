from fastapi import Depends, HTTPException, status

from app.config import Settings, get_settings
from app.firebase import get_db
from app.llm.base import LLMError, LLMProvider
from app.llm.mock_provider import MockProvider
from app.store import FirestoreStore, Store

# One provider (and one SDK HTTP client) per configuration, reused across requests.
_providers: dict[tuple, LLMProvider] = {}


def _build(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "gemini":
        from app.llm.gemini_provider import GeminiProvider

        return GeminiProvider(settings)
    from app.llm.anthropic_provider import AnthropicProvider

    return AnthropicProvider(settings)


def get_llm(settings: Settings = Depends(get_settings)) -> LLMProvider:
    if settings.llm_provider == "mock":
        return MockProvider()
    key = (
        settings.llm_provider,
        settings.llm_model,
        settings.anthropic_api_key,
        settings.gemini_api_key,
        settings.gemini_fallback_model,
        settings.llm_timeout_seconds,
        settings.llm_effort,
        settings.llm_fallbacks,
    )
    provider = _providers.get(key)
    if provider is None:
        try:
            provider = _build(settings)
        except LLMError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
        _providers[key] = provider
    return provider


def get_store(settings: Settings = Depends(get_settings)) -> Store:
    return FirestoreStore(get_db(settings))
