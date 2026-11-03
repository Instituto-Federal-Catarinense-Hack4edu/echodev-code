import httpx
import respx
from fastapi import Depends

from app.auth import CurrentUser, get_current_user
from tests.conftest import SUPABASE

USER_URL = f"{SUPABASE}/auth/v1/user"


def _add_probe(app):
    @app.get("/probe")
    async def probe(user: CurrentUser = Depends(get_current_user)) -> dict[str, str]:
        return {"id": user.id}


@respx.mock
def test_valid_token(app, client):
    _add_probe(app)
    route = respx.get(USER_URL).mock(return_value=httpx.Response(200, json={"id": "user-1"}))
    res = client.get("/probe", headers={"Authorization": "Bearer good"})
    assert res.status_code == 200
    assert res.json() == {"id": "user-1"}
    sent = route.calls.last.request
    assert sent.headers["apikey"] == "sb_publishable_test"
    assert sent.headers["authorization"] == "Bearer good"
    # cached: a second call does not hit Supabase again
    client.get("/probe", headers={"Authorization": "Bearer good"})
    assert route.call_count == 1


@respx.mock
def test_invalid_token(app, client):
    _add_probe(app)
    respx.get(USER_URL).mock(return_value=httpx.Response(401, json={"msg": "bad jwt"}))
    res = client.get("/probe", headers={"Authorization": "Bearer bad"})
    assert res.status_code == 401


def test_missing_token(app, client):
    _add_probe(app)
    assert client.get("/probe").status_code == 401
    assert client.get("/probe", headers={"Authorization": "Basic x"}).status_code == 401


@respx.mock
def test_auth_server_down(app, client):
    _add_probe(app)
    respx.get(USER_URL).mock(side_effect=httpx.ConnectError("down"))
    assert client.get("/probe", headers={"Authorization": "Bearer t"}).status_code == 503


def test_cors_preflight_allows_web_origin(client):
    res = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_rejects_other_origin(client):
    res = client.options(
        "/health",
        headers={"Origin": "https://evil.test", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in res.headers
