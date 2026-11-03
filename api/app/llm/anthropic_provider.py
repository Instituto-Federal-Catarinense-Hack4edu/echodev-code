"""Claude via the official async SDK.

No temperature: sampling parameters are rejected by the current API. Determinism comes from
the JSON schema (output_config.format) and a moderate effort level.
"""

from typing import Any

import anthropic

from app.config import Settings
from app.llm.base import LLMError

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, settings: Settings) -> None:
        if not settings.anthropic_api_key:
            raise LLMError("ANTHROPIC_API_KEY ausente (ou use LLM_PROVIDER=mock).")
        if not settings.llm_model:
            raise LLMError("LLM_MODEL ausente no api/.env.")
        self._settings = settings
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=settings.llm_timeout_seconds,
            max_retries=1,
        )

    async def complete_json(
        self, *, system: str, user: str, schema: dict[str, Any], kind: str
    ) -> str:
        params: dict[str, Any] = {
            "model": self._settings.llm_model,
            "max_tokens": 16000,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "output_config": {
                "effort": self._settings.llm_effort,
                "format": {"type": "json_schema", "schema": schema},
            },
        }
        try:
            if self._settings.llm_fallbacks:
                # On a (false-positive) safety refusal, the API re-runs the request on a
                # fallback model inside the same call.
                response = await self._client.beta.messages.create(
                    **params, betas=[FALLBACK_BETA], fallbacks="default"
                )
            else:
                response = await self._client.messages.create(**params)
        except anthropic.APITimeoutError as exc:
            raise LLMError("O modelo demorou demais para responder.") from exc
        except anthropic.RateLimitError as exc:
            raise LLMError("Limite de uso do modelo atingido; tente em alguns minutos.") from exc
        except anthropic.APIStatusError as exc:
            raise LLMError(f"Erro do provedor de IA (HTTP {exc.status_code}).") from exc
        except anthropic.APIConnectionError as exc:
            raise LLMError("Sem conexão com o provedor de IA.") from exc

        if response.stop_reason == "refusal":
            raise LLMError("O modelo recusou gerar o material para esta aula.")
        if response.stop_reason == "max_tokens":
            raise LLMError("A resposta do modelo ficou incompleta.")
        text = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
        if not text.strip():
            raise LLMError("O modelo não devolveu texto.")
        return text
