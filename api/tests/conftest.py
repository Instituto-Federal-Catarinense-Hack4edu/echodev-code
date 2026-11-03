from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.auth import clear_auth_cache
from app.config import Settings
from app.main import create_app

SUPABASE = "https://test.supabase.co"

TEST_SETTINGS = Settings(
    _env_file=None,
    supabase_url=SUPABASE,
    supabase_anon_key="sb_publishable_test",
    supabase_service_role_key="sb_secret_test",
    web_origin="http://localhost:3000",
    cron_secret="cron-test-secret",
    llm_provider="mock",
    llm_model="",
    anthropic_api_key="",
    environment="test",
)


@pytest.fixture(autouse=True)
def _clean_cache() -> Iterator[None]:
    clear_auth_cache()
    yield
    clear_auth_cache()


@pytest.fixture
def settings() -> Settings:
    return TEST_SETTINGS


@pytest.fixture
def app():
    return create_app(TEST_SETTINGS)


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c
