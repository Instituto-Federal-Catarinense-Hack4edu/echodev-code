"""Validates the browser's Firebase ID token with the Admin SDK.

`verify_id_token` checks the signature against Google's public keys (cached by the SDK),
the expiry and the project. With FIREBASE_AUTH_EMULATOR_HOST set it accepts emulator tokens.
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, get_settings
from app.firebase import verify_id_token

TokenVerifier = Callable[[str], dict]


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    email_verified: bool


def get_token_verifier(settings: Settings = Depends(get_settings)) -> TokenVerifier:
    return lambda token: verify_id_token(settings, token)


async def get_current_user(
    request: Request,
    verify: TokenVerifier = Depends(get_token_verifier),
) -> CurrentUser:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente.")
    try:
        # The SDK may fetch Google's public keys over the network: keep it off the event loop.
        claims = await asyncio.to_thread(verify, token.strip())
    except Exception as exc:  # invalid, expired, revoked, wrong project, keys unavailable
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido ou expirado.") from exc
    uid = claims.get("uid") or claims.get("sub")
    if not isinstance(uid, str) or not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido.")
    return CurrentUser(
        id=uid,
        email=str(claims.get("email") or "").lower(),
        email_verified=bool(claims.get("email_verified")),
    )
