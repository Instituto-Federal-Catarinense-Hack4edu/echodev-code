from fastapi import Depends

from app.auth import CurrentUser, get_current_user, get_token_verifier


def _add_probe(app):
    @app.get("/probe")
    async def probe(user: CurrentUser = Depends(get_current_user)) -> dict:
        return {"id": user.id, "email": user.email, "verified": user.email_verified}


def test_valid_token(app, client):
    _add_probe(app)
    res = client.get("/probe", headers={"Authorization": "Bearer new-token"})
    assert res.status_code == 200
    # e-mail is normalized to lower case (allowlist keys are lower case)
    assert res.json() == {"id": "newbie", "email": "novo@escola.test", "verified": True}


def test_invalid_token(app, client):
    _add_probe(app)
    assert client.get("/probe", headers={"Authorization": "Bearer bad"}).status_code == 401


def test_missing_token(app, client):
    _add_probe(app)
    assert client.get("/probe").status_code == 401
    assert client.get("/probe", headers={"Authorization": "Basic x"}).status_code == 401


def test_verifier_failure_is_401(app, client):
    _add_probe(app)

    def down(_: str) -> dict:
        raise ConnectionError("Google keys unavailable")

    app.dependency_overrides[get_token_verifier] = lambda: down
    assert client.get("/probe", headers={"Authorization": "Bearer t"}).status_code == 401


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


def test_web_origins_list_never_wildcard(settings):
    s = settings.model_copy(
        update={"web_origin": "http://localhost:3000/, http://127.0.0.1:3000,*"}
    )
    assert s.web_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]


def test_cors_rejects_other_origin(client):
    res = client.options(
        "/health",
        headers={"Origin": "https://evil.test", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in res.headers
