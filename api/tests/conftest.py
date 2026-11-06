from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.auth import get_token_verifier
from app.config import Settings
from app.deps import get_store
from app.main import create_app
from app.routes.me import get_user_deleter
from tests.fake_store import FakeStore

TEST_SETTINGS = Settings(
    _env_file=None,
    firebase_project_id="echodev-test",
    web_origin="http://localhost:3000",
    cron_secret="cron-test-secret",
    llm_provider="mock",
    llm_model="",
    anthropic_api_key="",
    environment="test",
)

# Bearer token -> decoded claims, as the Admin SDK would return them.
TOKENS: dict[str, dict] = {
    "teacher-token": {"uid": "teacher", "email": "prof@escola.test", "email_verified": True},
    "other-token": {"uid": "other", "email": "outro@escola.test", "email_verified": True},
    "student-token": {"uid": "student", "email": "aluno@escola.test", "email_verified": True},
    "new-token": {"uid": "newbie", "email": "Novo@Escola.test", "email_verified": True},
    "unverified-token": {"uid": "unverified", "email": "x@escola.test", "email_verified": False},
}


def fake_verify(token: str) -> dict:
    if token not in TOKENS:
        raise ValueError("invalid token")
    return TOKENS[token]


@pytest.fixture
def settings() -> Settings:
    return TEST_SETTINGS


@pytest.fixture
def fake() -> FakeStore:
    return FakeStore()


@pytest.fixture
def deleted() -> list[str]:
    return []


@pytest.fixture
def app(fake, deleted):
    application = create_app(TEST_SETTINGS)
    application.dependency_overrides[get_store] = lambda: fake
    application.dependency_overrides[get_token_verifier] = lambda: fake_verify
    application.dependency_overrides[get_user_deleter] = lambda: deleted.append
    return application


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c
