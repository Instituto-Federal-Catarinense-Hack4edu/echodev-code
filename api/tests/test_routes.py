import json

import httpx
import pytest
import respx

from app.deps import get_llm
from app.llm.mock_provider import MOCK_MATERIALS, MockProvider
from tests.fake_supabase import FakeSupabase

TEACHER = {"Authorization": "Bearer teacher-token"}
OTHER = {"Authorization": "Bearer other-token"}


class CountingProvider(MockProvider):
    def __init__(self) -> None:
        self.calls = 0

    async def complete_json(self, **kwargs) -> str:
        self.calls += 1
        return await super().complete_json(**kwargs)


class BrokenProvider:
    name = "broken"

    async def complete_json(self, **kwargs) -> str:
        return "isto não é json"


@pytest.fixture
def fake():
    with respx.mock(assert_all_called=False) as mock:
        yield FakeSupabase(mock)


@pytest.fixture
def llm(app):
    provider = CountingProvider()
    app.dependency_overrides[get_llm] = lambda: provider
    return provider


def _setup(fake: FakeSupabase, n: int = 12) -> str:
    teacher = fake.add_user("teacher-token")
    fake.add_user("other-token")
    lesson = fake.add_lesson(teacher)
    fake.add_utterances(lesson, n)
    return lesson


def test_end_generates_drafts_and_report(client, fake, llm):
    lesson = _setup(fake)
    res = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["materials_status"] == "gerado"
    assert {m["kind"] for m in body["materials"]} == {"resumo", "quiz"}
    assert all(m["status"] == "rascunho" for m in body["materials"])
    assert fake.tables["lessons"][0]["status"] == "encerrada"
    assert fake.tables["lessons"][0]["ended_at"]
    assert body["report"]["total_utterances"] == 12
    stored = json.dumps(fake.tables["lesson_reports"][0]["data"])
    assert "frase" not in stored  # snapshot has no transcript text
    assert fake.service_calls == []  # teacher routes never use the service key


def test_end_is_idempotent(client, fake, llm):
    lesson = _setup(fake)
    first = client.post(f"/lessons/{lesson}/end", headers=TEACHER).json()
    second = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert second.status_code == 200
    assert second.json()["materials_status"] == "existente"
    assert {m["id"] for m in second.json()["materials"]} == {m["id"] for m in first["materials"]}
    assert len(fake.tables["lesson_materials"]) == 2
    assert llm.calls == 1


def test_end_reads_all_pages(client, fake, llm):
    lesson = _setup(fake, n=2500)
    res = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert res.status_code == 200
    assert res.json()["report"]["total_utterances"] == 2500
    assert fake.utterance_pages[:3] == ["0-999", "1000-1999", "2000-2999"]


def test_end_forbidden_for_non_owner(client, fake, llm):
    lesson = _setup(fake)
    res = client.post(f"/lessons/{lesson}/end", headers=OTHER)
    assert res.status_code == 403
    assert fake.tables["lessons"][0]["status"] == "ao_vivo"
    assert llm.calls == 0


def test_end_unknown_lesson_404(client, fake, llm):
    _setup(fake)
    res = client.post("/lessons/00000000-0000-0000-0000-000000000000/end", headers=TEACHER)
    assert res.status_code == 404


def test_end_requires_token(client, fake):
    lesson = _setup(fake)
    assert client.post(f"/lessons/{lesson}/end").status_code == 401


def test_end_llm_failure_keeps_lesson_ended(app, client, fake):
    app.dependency_overrides[get_llm] = lambda: BrokenProvider()
    lesson = _setup(fake)
    res = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert res.status_code == 502
    assert "Tentar de novo" in res.json()["detail"]
    assert fake.tables["lessons"][0]["status"] == "encerrada"
    assert fake.tables["lesson_reports"]  # report saved anyway
    assert fake.tables["lesson_materials"] == []


def test_end_without_transcript(client, fake, llm):
    teacher = fake.add_user("teacher-token")
    lesson = fake.add_lesson(teacher)
    res = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert res.json()["materials_status"] == "sem_transcricao"
    assert llm.calls == 0


def test_regenerate_overwrites_draft(client, fake, llm):
    lesson = _setup(fake)
    client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    fake.tables["lesson_materials"][0]["content"] = {"editado": True}
    res = client.post(f"/lessons/{lesson}/materials/regenerate", headers=TEACHER)
    assert res.status_code == 200
    assert len(fake.tables["lesson_materials"]) == 2
    resumo = next(m for m in fake.tables["lesson_materials"] if m["kind"] == "resumo")
    assert resumo["content"] == MOCK_MATERIALS["resumo"]


def test_regenerate_ignores_spanish_versions(client, fake, llm):
    lesson = _setup(fake)
    client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    fake.tables["lesson_materials"].append(
        {"id": "es1", "lesson_id": lesson, "kind": "resumo_es", "status": "aprovado", "content": {}}
    )
    res = client.post(f"/lessons/{lesson}/materials/regenerate", headers=TEACHER)
    assert res.status_code == 200
    assert {m["kind"] for m in res.json()["materials"]} == {"resumo", "quiz"}


def test_regenerate_refuses_approved(client, fake, llm):
    lesson = _setup(fake)
    client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    fake.tables["lesson_materials"][0]["status"] = "aprovado"
    res = client.post(f"/lessons/{lesson}/materials/regenerate", headers=TEACHER)
    assert res.status_code == 409
    assert llm.calls == 1


def test_regenerate_requires_ended_lesson(client, fake, llm):
    lesson = _setup(fake)
    res = client.post(f"/lessons/{lesson}/materials/regenerate", headers=TEACHER)
    assert res.status_code == 409


def test_regenerate_forbidden_for_non_owner(client, fake, llm):
    lesson = _setup(fake)
    client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert client.post(f"/lessons/{lesson}/materials/regenerate", headers=OTHER).status_code == 403


def test_malformed_lesson_id_is_rejected_before_the_db(client, fake, llm):
    fake.add_user("teacher-token")
    res = client.post("/lessons/not-a-uuid/end", headers=TEACHER)
    assert res.status_code == 422


def test_db_failure_returns_readable_502_with_cors(client, fake, llm):
    lesson = _setup(fake)
    fake.fail_methods = {"PATCH"}  # ending the lesson fails on the DB side
    res = client.post(
        f"/lessons/{lesson}/end", headers={**TEACHER, "Origin": "http://localhost:3000"}
    )
    assert res.status_code == 502
    assert res.json()["detail"] == "Falha ao acessar o banco de dados."
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


async def test_concurrent_insert_falls_back_to_update(fake, settings):
    from app.routes.lessons import _save_drafts
    from app.schemas import Materials
    from app.supabase_rest import UserRest

    lesson = _setup(fake)
    # Another request already stored drafts after we read "no materials".
    fake.tables["lesson_materials"].append(
        {"id": "m1", "lesson_id": lesson, "kind": "resumo", "status": "rascunho", "content": {}}
    )
    fake.tables["lesson_materials"].append(
        {"id": "m2", "lesson_id": lesson, "kind": "quiz", "status": "aprovado", "content": []}
    )
    async with httpx.AsyncClient() as http:
        rest = UserRest(http, settings, "teacher-token")
        saved = await _save_drafts(rest, lesson, Materials.model_validate(MOCK_MATERIALS), [])
    assert len(fake.tables["lesson_materials"]) == 2
    resumo = next(m for m in fake.tables["lesson_materials"] if m["kind"] == "resumo")
    quiz = next(m for m in fake.tables["lesson_materials"] if m["kind"] == "quiz")
    assert resumo["content"] == MOCK_MATERIALS["resumo"]
    assert quiz["status"] == "aprovado" and quiz["content"] == []  # approved stays untouched
    assert {m["kind"] for m in saved} == {"resumo", "quiz"}


def test_cron_non_ascii_secret_is_401_not_500(client, fake):
    res = client.post("/cron/purge", headers={"X-Cron-Secret": "sénha".encode("latin-1")})
    assert res.status_code == 401


def test_cron_purge(client, fake):
    assert client.post("/cron/purge").status_code == 401
    assert client.post("/cron/purge", headers={"X-Cron-Secret": "wrong"}).status_code == 401
    res = client.post("/cron/purge", headers={"X-Cron-Secret": "cron-test-secret"})
    assert res.status_code == 200
    assert res.json() == {"deleted": 7}


def test_delete_me_only_deletes_caller(client, fake):
    uid = fake.add_user("student-token")
    res = client.delete("/me", headers={"Authorization": "Bearer student-token"})
    assert res.status_code == 200
    assert fake.service_calls == [f"DELETE user {uid}"]
    assert client.delete("/me").status_code == 401
