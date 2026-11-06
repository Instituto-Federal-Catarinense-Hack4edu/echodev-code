"""Gemini via the official google-genai SDK (the free tier needs no billing account).

Free quotas are small and counted per model and per day, so a quota error (HTTP 429) or an
overloaded model moves the call to GEMINI_FALLBACK_MODEL, and the exhausted model is skipped
for a while instead of being asked again on every call. No SDK retries: retrying a daily
quota only adds waiting.
"""

import time
from typing import Any

import httpx
from google import genai
from google.genai import errors, types

from app.config import Settings
from app.llm.base import LLMError

MAX_OUTPUT_TOKENS = 16000
# Quota (429) or overloaded (5xx): try the next model. Only a quota error parks the model.
SWITCH_CODES = {429, 500, 503, 504}
COOLDOWN_SECONDS = 600.0
REFUSED = {
    types.FinishReason.SAFETY,
    types.FinishReason.PROHIBITED_CONTENT,
    types.FinishReason.BLOCKLIST,
    types.FinishReason.SPII,
    types.FinishReason.RECITATION,
}


def _api_error(exc: errors.APIError) -> LLMError:
    code = exc.code
    if code == 429:
        return LLMError(
            "Cota gratuita do Gemini esgotada (por minuto ou por dia); tente mais tarde."
        )
    if code in (401, 403):
        return LLMError("Chave do Gemini inválida ou sem permissão (confira GEMINI_API_KEY).")
    if code == 404:
        return LLMError("Modelo do Gemini não encontrado (confira LLM_MODEL).")
    return LLMError(f"Erro do provedor de IA (HTTP {code}).")


def _text_of(response: types.GenerateContentResponse) -> str:
    feedback = response.prompt_feedback
    if feedback and feedback.block_reason:
        raise LLMError("O provedor de IA recusou o texto desta aula.")
    if not response.candidates:
        raise LLMError("O modelo não devolveu texto.")
    reason = response.candidates[0].finish_reason
    if reason == types.FinishReason.MAX_TOKENS:
        raise LLMError("A resposta do modelo ficou incompleta.")
    if reason in REFUSED:
        raise LLMError("O modelo recusou gerar o material para esta aula.")
    text = response.text or ""
    if not text.strip():
        raise LLMError("O modelo não devolveu texto.")
    return text


class GeminiProvider:
    name = "gemini"

    def __init__(self, settings: Settings, client: Any = None) -> None:
        if not settings.gemini_api_key:
            raise LLMError("GEMINI_API_KEY ausente (ou use LLM_PROVIDER=mock).")
        if not settings.llm_model:
            raise LLMError("LLM_MODEL ausente no api/.env.")
        reserve = settings.gemini_fallback_model.strip()
        self._models = [settings.llm_model] + (
            [reserve] if reserve and reserve != settings.llm_model else []
        )
        self._cooldown_until: dict[str, float] = {}
        self._client = client or genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=int(settings.llm_timeout_seconds * 1000),  # milliseconds
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    def _candidates(self) -> list[str]:
        now = time.monotonic()
        ready = [m for m in self._models if self._cooldown_until.get(m, 0.0) <= now]
        # Everything cooling down: try anyway (the quota may be back) instead of failing.
        return ready or list(self._models)

    async def complete_json(
        self, *, system: str, user: str, schema: dict[str, Any], kind: str
    ) -> str:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema,
            max_output_tokens=MAX_OUTPUT_TOKENS,
        )
        models = self._candidates()
        for i, model in enumerate(models):
            try:
                response = await self._client.aio.models.generate_content(
                    model=model, contents=user, config=config
                )
            except errors.APIError as exc:
                if exc.code == 429:
                    self._cooldown_until[model] = time.monotonic() + COOLDOWN_SECONDS
                if exc.code in SWITCH_CODES and i + 1 < len(models):
                    continue
                raise _api_error(exc) from exc
            except httpx.TimeoutException as exc:
                raise LLMError("O modelo demorou demais para responder.") from exc
            except httpx.TransportError as exc:
                raise LLMError("Sem conexão com o provedor de IA.") from exc
            return _text_of(response)
        raise LLMError("Nenhum modelo do Gemini configurado.")  # unreachable: models is never empty
