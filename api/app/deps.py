from fastapi import Depends, HTTPException, status

from app.config import Settings, get_settings
from app.llm.base import LLMError, LLMProvider
from app.llm.mock_provider import MockProvider


def get_llm(settings: Settings = Depends(get_settings)) -> LLMProvider:
    if settings.llm_provider == "mock":
        return MockProvider()
    from app.llm.anthropic_provider import AnthropicProvider

    try:
        return AnthropicProvider(settings)
    except LLMError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
