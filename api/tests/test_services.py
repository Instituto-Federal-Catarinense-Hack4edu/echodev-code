import json
from datetime import UTC, datetime, timedelta

import pytest

from app.llm.base import LLMError
from app.llm.mock_provider import MOCK_MATERIALS
from app.services.materials import extract_json, generate_materials, split_chunks
from app.services.report import build_report, pace_by_minute, undefined_terms
from app.services.sanitize import PLACEHOLDER, sanitize

# ---------- sanitize ----------


@pytest.mark.parametrize(
    "text",
    [
        "manda para ana.souza@escola.edu.br depois",
        "o link é https://exemplo.com/aula?id=3 ok",
        "veja www.site.com.br",
        "liga no (11) 98765-4321",
        "ou +55 11 3456-7890",
        "whats 11987654321",
    ],
)
def test_sanitize_removes_identifiers(text: str) -> None:
    out = sanitize(text)
    assert PLACEHOLDER in out
    assert "@" not in out and "http" not in out and "98765" not in out and "3456" not in out


def test_sanitize_keeps_code_and_numbers() -> None:
    text = "for (let i = 0; i < 10; i++) e o ano 2026, versão 3.12"
    assert sanitize(text) == text


# ---------- JSON extraction ----------


def test_extract_json_variants() -> None:
    assert extract_json('{"a": 1}') == {"a": 1}
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('Claro! Aqui está:\n{"a": {"b": 2}}\nEspero ter ajudado.') == {
        "a": {"b": 2}
    }
    with pytest.raises(ValueError):
        extract_json("sem json aqui")


# ---------- LLM parsing and retry ----------


class ScriptedProvider:
    name = "scripted"

    def __init__(self, answers: list[str]) -> None:
        self.answers = answers
        self.prompts: list[str] = []
        self.kinds: list[str] = []

    async def complete_json(self, *, system: str, user: str, schema: dict, kind: str) -> str:
        self.prompts.append(user)
        self.kinds.append(kind)
        return self.answers.pop(0)


GOOD = json.dumps(MOCK_MATERIALS)


def _only_concept_quiz() -> str:
    bad = json.loads(GOOD)
    for q in bad["quiz"]:
        q["tipo"], q["codigo"] = "conceito", None
    return json.dumps(bad)


async def test_valid_answer_first_try() -> None:
    p = ScriptedProvider([f"```json\n{GOOD}\n```"])
    m = await generate_materials(p, ["Hoje vamos ver git.", "Um commit salva o projeto."])
    assert len(m.quiz) == 5
    assert len(p.prompts) == 1


async def test_retry_once_with_validation_error() -> None:
    p = ScriptedProvider([_only_concept_quiz(), GOOD])
    m = await generate_materials(p, ["aula"])
    assert sum(q.tipo == "codigo" for q in m.quiz) >= 2
    assert len(p.prompts) == 2
    assert "pelo menos 2 questões" in p.prompts[1]  # the error is fed back


async def test_fails_after_second_invalid_answer() -> None:
    p = ScriptedProvider(["não é json", _only_concept_quiz()])
    with pytest.raises(LLMError):
        await generate_materials(p, ["aula"])
    assert len(p.prompts) == 2


async def test_wrong_quiz_size_rejected() -> None:
    four = json.loads(GOOD)
    four["quiz"] = four["quiz"][:4]
    p = ScriptedProvider([json.dumps(four), json.dumps(four)])
    with pytest.raises(LLMError):
        await generate_materials(p, ["aula"])


async def test_transcript_is_sanitized_before_llm() -> None:
    p = ScriptedProvider([GOOD])
    await generate_materials(p, ["meu email é joao@x.com", "acesse https://a.b/c"])
    assert "joao@x.com" not in p.prompts[0]
    assert "https://" not in p.prompts[0]


async def test_long_transcript_is_chunked() -> None:
    notes = json.dumps({"topicos": ["t"], "termos": ["git"], "exemplos_de_codigo": []})
    sentences = [f"frase número {i} sobre git e commits na aula de hoje" for i in range(2000)]
    total = sum(len(s) + 1 for s in sentences)
    n_chunks = len(split_chunks("\n".join(sentences)))
    assert total > 40_000 and n_chunks >= 2
    p = ScriptedProvider([notes] * n_chunks + [GOOD])
    await generate_materials(p, sentences)
    assert p.kinds == ["chunk_notes"] * n_chunks + ["materials"]
    assert "anotações de cada bloco" in p.prompts[-1]


# ---------- report ----------


def _utts(specs: list[tuple[int, str, list, int]]) -> list[dict]:
    start = datetime(2026, 11, 3, 14, 0, tzinfo=UTC)
    return [
        {"seq": i + 1, "created_at": (start + timedelta(seconds=s)).isoformat(), "text": text,
         "terms": terms, "wpm": wpm}
        for i, (s, text, terms, wpm) in enumerate(specs)
    ]  # fmt: skip


def test_pace_by_minute() -> None:
    u = _utts([(0, "a", [], 100), (30, "b", [], 140), (70, "c", [], 200), (190, "d", [], 90)])
    pace = pace_by_minute(u)
    assert [(p.minute, p.wpm) for p in pace] == [(0, 120), (1, 200), (3, 90)]
    report = build_report(u)
    assert report.duration_minutes == 4
    assert [p.minute for p in report.fastest] == [1, 0, 3]
    assert report.total_utterances == 4


def span(tid: str, text: str, word: str) -> dict:
    return {"termId": tid, "start": text.index(word), "end": text.index(word) + len(word)}


def test_undefined_terms_heuristic() -> None:
    t1 = "Agora eu faço um commit"
    t2 = "Vamos usar uma branch nova"
    u = _utts(
        [
            (0, t1, [span("commit", t1, "commit")], 120),
            (5, "O commit é um ponto salvo no histórico", [], 120),
            (10, t2, [span("branch", t2, "branch")], 120),
            (15, "e depois a gente continua", [], 120),
            (20, "e um colega revisa", [], 120),  # "e um" without accent is not a definition
            (25, "fim", [], 120),
            (30, "Isso significa que branch é outra linha", [], 120),  # too late (4th sentence)
        ]
    )
    assert undefined_terms(u) == ["branch"]


def test_report_contains_no_text() -> None:
    u = _utts([(0, "segredo da aula", [], 100)])
    dumped = json.dumps(build_report(u).model_dump())
    assert "segredo" not in dumped
