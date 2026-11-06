"""GeminiProvider with a fake SDK client (no network), built from the SDK's real types."""

import json
from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors, types

from app.config import Settings
from app.deps import _build
from app.llm.base import LLMError
from app.llm.gemini_provider import GeminiProvider
from app.llm.mock_provider import MOCK_MATERIALS
from app.services.materials import generate_materials

PRIMARY = "gemini-3.6-flash"
RESERVE = "gemini-3.5-flash-lite"


def settings(**overrides) -> Settings:
    values = {
        "llm_provider": "gemini",
        "llm_model": PRIMARY,
        "gemini_api_key": "test-key",
        "gemini_fallback_model": RESERVE,
    }
    return Settings(_env_file=None, **(values | overrides))


def reply(text: str, reason: types.FinishReason = types.FinishReason.STOP):
    return types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                content=types.Content(role="model", parts=[types.Part(text=text)]),
                finish_reason=reason,
            )
        ]
    )


def api_error(code: int) -> errors.APIError:
    status = "RESOURCE_EXHAUSTED" if code == 429 else "ERROR"
    body = {"error": {"code": code, "message": "fake", "status": status}}
    return errors.ClientError(code, body) if code < 500 else errors.ServerError(code, body)


class FakeModels:
    def __init__(self, outcomes: dict[str, list]):
        self.outcomes = outcomes
        self.calls: list[tuple[str, str, types.GenerateContentConfig]] = []

    async def generate_content(self, *, model, contents, config):
        self.calls.append((model, contents, config))
        outcome = self.outcomes[model].pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


def provider(outcomes: dict[str, list], **overrides) -> tuple[GeminiProvider, FakeModels]:
    models = FakeModels(outcomes)
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    return GeminiProvider(settings(**overrides), client=client), models


async def ask(p: GeminiProvider) -> str:
    return await p.complete_json(
        system="sys", user="transcrição", schema={"type": "object"}, kind="materials"
    )


def test_needs_key_and_model():
    with pytest.raises(LLMError, match="GEMINI_API_KEY"):
        GeminiProvider(settings(gemini_api_key=""))
    with pytest.raises(LLMError, match="LLM_MODEL"):
        GeminiProvider(settings(llm_model=""))


def test_build_picks_gemini_without_network():
    assert _build(settings()).name == "gemini"


async def test_sends_system_schema_and_json_mode():
    p, models = provider({PRIMARY: [reply('{"ok": true}')]})
    assert await ask(p) == '{"ok": true}'
    model, contents, config = models.calls[0]
    assert model == PRIMARY and contents == "transcrição"
    assert config.system_instruction == "sys"
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema == {"type": "object"}


async def test_quota_moves_to_reserve_and_parks_the_primary():
    p, models = provider({PRIMARY: [api_error(429)], RESERVE: [reply("{}"), reply("{}")]})
    assert await ask(p) == "{}"
    assert [m for m, _, _ in models.calls] == [PRIMARY, RESERVE]
    await ask(p)  # the exhausted primary is not asked again right away
    assert [m for m, _, _ in models.calls] == [PRIMARY, RESERVE, RESERVE]


async def test_overloaded_primary_uses_reserve_without_parking():
    p, models = provider({PRIMARY: [api_error(503), reply("{}")], RESERVE: [reply("{}")]})
    await ask(p)
    await ask(p)
    assert [m for m, _, _ in models.calls] == [PRIMARY, RESERVE, PRIMARY]


async def test_quota_without_reserve_is_a_clear_error():
    p, _ = provider({PRIMARY: [api_error(429)]}, gemini_fallback_model="")
    with pytest.raises(LLMError, match="Cota gratuita"):
        await ask(p)


@pytest.mark.parametrize(
    ("code", "message"),
    [(403, "GEMINI_API_KEY"), (404, "LLM_MODEL"), (400, "HTTP 400")],
)
async def test_other_errors_do_not_switch_models(code, message):
    p, models = provider({PRIMARY: [api_error(code)], RESERVE: [reply("{}")]})
    with pytest.raises(LLMError, match=message):
        await ask(p)
    assert len(models.calls) == 1


@pytest.mark.parametrize(
    ("outcome", "message"),
    [
        (reply('{"a":', types.FinishReason.MAX_TOKENS), "incompleta"),
        (reply("", types.FinishReason.SAFETY), "recusou"),
        (reply("   "), "não devolveu"),
        (types.GenerateContentResponse(candidates=[]), "não devolveu"),
        (
            types.GenerateContentResponse(
                prompt_feedback=types.GenerateContentResponsePromptFeedback(
                    block_reason=types.BlockedReason.SAFETY
                )
            ),
            "recusou o texto",
        ),
        (httpx.ReadTimeout("slow"), "demorou"),
        (httpx.ConnectError("down"), "Sem conexão"),
    ],
)
async def test_unusable_answers_become_llm_errors(outcome, message):
    p, _ = provider({PRIMARY: [outcome]})
    with pytest.raises(LLMError, match=message):
        await ask(p)


async def test_full_materials_flow_through_gemini():
    p, _ = provider({PRIMARY: [reply(json.dumps(MOCK_MATERIALS, ensure_ascii=False))]})
    materials = await generate_materials(p, ["Hoje vamos falar de Git e commit."])
    assert len(materials.quiz) == 5
    assert materials.resumo.titulo == MOCK_MATERIALS["resumo"]["titulo"]
