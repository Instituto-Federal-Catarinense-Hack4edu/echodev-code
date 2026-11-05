import json

import pytest

from app.deps import get_llm
from app.llm.mock_provider import MOCK_MATERIALS, MockProvider
from tests.fake_store import FakeStore

TEACHER = {"Authorization": "Bearer teacher-token"}
OTHER = {"Authorization": "Bearer other-token"}
STUDENT = {"Authorization": "Bearer student-token"}


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
def llm(app):
    provider = CountingProvider()
    app.dependency_overrides[get_llm] = lambda: provider
    return provider


def _setup(fake: FakeStore, n: int = 12) -> str:
    fake.add_user("teacher", role="professor")
    fake.add_user("other", role="professor")
    lesson = fake.add_lesson("teacher")
    fake.add_utterances(lesson, n)
    return lesson


# ---------- end / regenerate ----------


def test_end_generates_drafts_and_report(client, fake, llm):
    lesson = _setup(fake)
    res = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["materials_status"] == "gerado"
    assert {m["kind"] for m in body["materials"]} == {"resumo", "quiz"}
    assert all(m["status"] == "rascunho" for m in body["materials"])
    assert fake.lessons[lesson]["status"] == "encerrada"
    assert fake.lessons[lesson]["ended_at"]
    assert body["report"]["total_utterances"] == 12
    assert "frase" not in json.dumps(fake.reports[lesson])  # snapshot has no transcript text


def test_end_is_idempotent(client, fake, llm):
    lesson = _setup(fake)
    first = client.post(f"/lessons/{lesson}/end", headers=TEACHER).json()
    second = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert second.status_code == 200
    assert second.json()["materials_status"] == "existente"
    assert {m["id"] for m in second.json()["materials"]} == {m["id"] for m in first["materials"]}
    assert len(fake.materials[lesson]) == 2
    assert llm.calls == 1


def test_end_reads_long_lessons(client, fake, llm):
    lesson = _setup(fake, n=2500)
    res = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert res.status_code == 200
    assert res.json()["report"]["total_utterances"] == 2500


def test_end_forbidden_for_non_owner(client, fake, llm):
    lesson = _setup(fake)
    res = client.post(f"/lessons/{lesson}/end", headers=OTHER)
    assert res.status_code == 403
    assert fake.lessons[lesson]["status"] == "ao_vivo"
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
    assert fake.lessons[lesson]["status"] == "encerrada"
    assert lesson in fake.reports  # report saved anyway
    assert not fake.materials.get(lesson)


def test_end_without_transcript(client, fake, llm):
    fake.add_user("teacher", role="professor")
    lesson = fake.add_lesson("teacher")
    res = client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    assert res.json()["materials_status"] == "sem_transcricao"
    assert llm.calls == 0


def test_regenerate_overwrites_draft(client, fake, llm):
    lesson = _setup(fake)
    client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    fake.materials[lesson]["resumo"]["content"] = {"editado": True}
    res = client.post(f"/lessons/{lesson}/materials/regenerate", headers=TEACHER)
    assert res.status_code == 200
    assert len(fake.materials[lesson]) == 2
    assert fake.materials[lesson]["resumo"]["content"] == MOCK_MATERIALS["resumo"]


def test_regenerate_ignores_spanish_versions(client, fake, llm):
    lesson = _setup(fake)
    client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    fake.materials[lesson]["resumo_es"] = {
        "id": "resumo_es",
        "kind": "resumo_es",
        "status": "aprovado",
        "content": {},
    }
    res = client.post(f"/lessons/{lesson}/materials/regenerate", headers=TEACHER)
    assert res.status_code == 200
    assert {m["kind"] for m in res.json()["materials"]} == {"resumo", "quiz"}


def test_regenerate_refuses_approved(client, fake, llm):
    lesson = _setup(fake)
    client.post(f"/lessons/{lesson}/end", headers=TEACHER)
    fake.materials[lesson]["resumo"]["status"] = "aprovado"
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
    res = client.post("/lessons/not-a-uuid/end", headers=TEACHER)
    assert res.status_code == 422


def test_db_failure_returns_readable_502_with_cors(client, fake, llm):
    lesson = _setup(fake)
    fake.fail = {"update_lesson"}  # ending the lesson fails on the DB side
    res = client.post(
        f"/lessons/{lesson}/end", headers={**TEACHER, "Origin": "http://localhost:3000"}
    )
    assert res.status_code == 502
    assert res.json()["detail"] == "Falha ao acessar o banco de dados."
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


async def test_concurrent_create_falls_back_to_update(fake):
    from app.routes.lessons import _save_drafts
    from app.schemas import Materials

    lesson = _setup(fake)
    # Another request already stored drafts after we read "no materials".
    fake.materials[lesson] = {
        "resumo": {"id": "resumo", "kind": "resumo", "status": "rascunho", "content": {}},
        "quiz": {"id": "quiz", "kind": "quiz", "status": "aprovado", "content": []},
    }
    saved = await _save_drafts(fake, lesson, Materials.model_validate(MOCK_MATERIALS), [])
    assert fake.materials[lesson]["resumo"]["content"] == MOCK_MATERIALS["resumo"]
    quiz = fake.materials[lesson]["quiz"]
    assert quiz["status"] == "aprovado" and quiz["content"] == []  # approved stays untouched
    assert {m["kind"] for m in saved} == {"resumo", "quiz"}


# ---------- join ----------


def test_join_adds_member_by_pseudonym(client, fake):
    lesson = _setup(fake)
    fake.add_user("student")
    res = client.post("/lessons/join", json={"code": " abc234 "}, headers=STUDENT)
    assert res.status_code == 200, res.text
    assert res.json() == {"lesson_id": lesson, "title": "Introdução ao Git"}
    member = fake.members[f"{lesson}_p-student"]
    assert member["pseudonym_id"] == "p-student"
    assert "student" not in json.dumps(member).replace("p-student", "")  # never the user id
    # joining twice is fine
    assert client.post("/lessons/join", json={"code": "ABC234"}, headers=STUDENT).status_code == 200
    assert len(fake.members) == 1


@pytest.mark.parametrize(
    ("setup", "code", "status", "detail"),
    [
        ("no-consent", "ABC234", 403, "consent_required"),
        ("teacher", "ABC234", 403, "teacher_cannot_join"),
        ("ok", "ZZZZZZ", 404, "invalid_code"),
        ("ended", "ABC234", 409, "lesson_ended"),
        ("no-profile", "ABC234", 409, "profile_missing"),
    ],
)
def test_join_errors(client, fake, setup, code, status, detail):
    fake.add_user("teacher", role="professor")
    fake.add_lesson("teacher", status="encerrada" if setup == "ended" else "ao_vivo")
    if setup == "teacher":
        fake.add_user("student", role="professor")
    elif setup != "no-profile":
        fake.add_user("student", consents=setup != "no-consent")
    res = client.post("/lessons/join", json={"code": code}, headers=STUDENT)
    assert res.status_code == status
    assert res.json()["detail"] == detail
    assert fake.members == {}


def test_join_with_revoked_consent_is_refused(client, fake):
    _setup(fake)
    fake.add_user("student")
    fake.consents["student_tratamento_dados"]["revoked_at"] = "2026-11-05T10:00:00Z"
    res = client.post("/lessons/join", json={"code": "ABC234"}, headers=STUDENT)
    assert res.json()["detail"] == "consent_required"


# ---------- aggregates ----------


def test_member_count_owner_only(client, fake):
    lesson = _setup(fake)
    for uid in ("a", "b"):
        fake.add_user(uid)
        fake.members[f"{lesson}_p-{uid}"] = {"lesson_id": lesson, "pseudonym_id": f"p-{uid}"}
    assert client.get(f"/lessons/{lesson}/member-count", headers=TEACHER).json() == {"count": 2}
    assert client.get(f"/lessons/{lesson}/member-count", headers=OTHER).status_code == 403
    assert client.get(f"/lessons/{lesson}/member-count", headers=STUDENT).status_code == 403


def test_term_report_hides_terms_with_fewer_than_3_students(client, fake):
    lesson = _setup(fake)

    def event(pseudonym: str, term: str, kind: str = "tap") -> None:
        fake.term_events.append(
            {"lesson_id": lesson, "pseudonym_id": pseudonym, "term_id": term, "kind": kind}
        )

    for p in ("p1", "p2", "p3"):
        event(p, "commit")
    event("p1", "commit", "doubt")
    event("p2", "commit", "helped")
    event("p1", "git")
    event("p2", "git")  # only 2 students: hidden
    res = client.get(f"/lessons/{lesson}/term-report", headers=TEACHER)
    assert res.status_code == 200
    rows = res.json()
    assert rows == [
        {"term_id": "commit", "taps": 3, "students": 3, "doubts": 1, "helped": 1, "not_helped": 0}
    ]
    assert "p1" not in json.dumps(rows)  # pseudonyms are never returned
    assert client.get(f"/lessons/{lesson}/term-report", headers=OTHER).status_code == 403


# ---------- profile ----------


def test_profile_created_once_with_role_from_allowlist(client, fake):
    fake.allowlist.add("novo@escola.test")
    first = client.post("/me/profile", headers={"Authorization": "Bearer new-token"})
    assert first.status_code == 200
    assert first.json()["role"] == "professor" and first.json()["created"] is True
    pseudonym = fake.profiles["newbie"]["pseudonym_id"]
    second = client.post("/me/profile", headers={"Authorization": "Bearer new-token"}).json()
    assert second["created"] is False
    assert fake.profiles["newbie"]["pseudonym_id"] == pseudonym


def test_profile_default_role_is_student(client, fake):
    res = client.post("/me/profile", headers=STUDENT)
    assert res.json()["role"] == "estudante"


def test_profile_teacher_intent_refused_outside_allowlist(client, fake):
    res = client.post(
        "/me/profile", headers={"Authorization": "Bearer new-token"}, json={"intent": "professor"}
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "not_teacher"
    assert "newbie" not in fake.profiles  # not locked as a student
    fake.allowlist.add("novo@escola.test")
    later = client.post(
        "/me/profile", headers={"Authorization": "Bearer new-token"}, json={"intent": "professor"}
    )
    assert later.status_code == 200 and later.json()["role"] == "professor"


def test_profile_allowlist_wins_over_student_intent(client, fake):
    fake.allowlist.add("novo@escola.test")
    res = client.post(
        "/me/profile", headers={"Authorization": "Bearer new-token"}, json={"intent": "estudante"}
    )
    assert res.json()["role"] == "professor"


def test_profile_student_intent_creates_student(client, fake):
    res = client.post(
        "/me/profile", headers={"Authorization": "Bearer new-token"}, json={"intent": "estudante"}
    )
    assert res.status_code == 200 and res.json()["role"] == "estudante"


def test_profile_requires_verified_email(client, fake):
    fake.allowlist.add("x@escola.test")
    res = client.post("/me/profile", headers={"Authorization": "Bearer unverified-token"})
    assert res.status_code == 403
    assert res.json()["detail"] == "email_not_verified"
    assert "unverified" not in fake.profiles


# ---------- cron / me ----------


def test_cron_non_ascii_secret_is_401_not_500(client, fake):
    res = client.post("/cron/purge", headers={"X-Cron-Secret": "sénha".encode("latin-1")})
    assert res.status_code == 401


def test_cron_purge(client, fake):
    from datetime import UTC, datetime, timedelta

    lesson = _setup(fake, n=7)
    for u in fake.utterances[lesson]:
        u["expires_at"] = datetime.now(UTC) - timedelta(minutes=1)
    assert client.post("/cron/purge").status_code == 401
    assert client.post("/cron/purge", headers={"X-Cron-Secret": "wrong"}).status_code == 401
    res = client.post("/cron/purge", headers={"X-Cron-Secret": "cron-test-secret"})
    assert res.status_code == 200
    assert res.json() == {"deleted": 7}


def test_delete_me_only_deletes_caller(client, fake, deleted):
    lesson = _setup(fake)
    fake.add_user("student")
    fake.members[f"{lesson}_p-student"] = {"lesson_id": lesson, "pseudonym_id": "p-student"}
    fake.term_events.append(
        {"lesson_id": lesson, "pseudonym_id": "p-student", "term_id": "git", "kind": "tap"}
    )
    res = client.delete("/me", headers=STUDENT)
    assert res.status_code == 200
    assert deleted == ["student"]
    assert "student" not in fake.profiles
    assert fake.members == {} and fake.term_events == []
    assert lesson in fake.lessons and "teacher" in fake.profiles  # others untouched
    assert client.delete("/me").status_code == 401


def test_delete_teacher_removes_their_lessons(client, fake, deleted):
    lesson = _setup(fake)
    other_lesson = fake.add_lesson("other", code="XYZ234")
    res = client.delete("/me", headers=TEACHER)
    assert res.status_code == 200
    assert lesson not in fake.lessons and "ABC234" not in fake.codes
    assert other_lesson in fake.lessons
