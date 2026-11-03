"""Validates the browser's Supabase access token by asking Supabase Auth (GET /auth/v1/user).

We never trust a token just because it decodes; Supabase is moving to asymmetric signing keys,
so asking the Auth server is the simplest correct check. A short per-token cache avoids
one round trip per request.
"""

import hashlib
import time
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, get_settings

CACHE_TTL_SECONDS = 10.0
_MAX_CACHE = 2048
_cache: dict[str, tuple[float, str]] = {}


@dataclass(frozen=True)
class CurrentUser:
    id: str
    token: str


def get_http(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


def _key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def clear_auth_cache() -> None:
    _cache.clear()


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    http: httpx.AsyncClient = Depends(get_http),
) -> CurrentUser:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente.")
    token = token.strip()

    now = time.monotonic()
    cached = _cache.get(_key(token))
    if cached and cached[0] > now:
        return CurrentUser(id=cached[1], token=token)

    try:
        res = await http.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Auth indisponível.") from exc

    if res.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido ou expirado.")
    user_id = res.json().get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido.")

    if len(_cache) >= _MAX_CACHE:
        _cache.clear()
    _cache[_key(token)] = (now + CACHE_TTL_SECONDS, user_id)
    return CurrentUser(id=user_id, token=token)
