"""The caller's own account: create the profile on first login and 'delete my data'."""

import asyncio
from collections.abc import Callable
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.deps import get_store
from app.firebase import delete_auth_user
from app.schemas import DeleteMeResponse, ProfileOut
from app.store import Store

router = APIRouter(prefix="/me", tags=["me"])

UserDeleter = Callable[[str], None]


def get_user_deleter(settings: Settings = Depends(get_settings)) -> UserDeleter:
    return lambda uid: delete_auth_user(settings, uid)


@router.post("/profile", response_model=ProfileOut)
async def ensure_profile(
    user: CurrentUser = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> ProfileOut:
    """Idempotent. The role comes from the teacher allowlist, only for a verified e-mail
    (otherwise anyone could sign up with a teacher's address)."""
    profile = await store.get_profile(user.id)
    created = False
    if not profile:
        if not user.email_verified:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "email_not_verified")
        new = {
            "role": "professor" if await store.is_teacher_email(user.email) else "estudante",
            "pseudonym_id": str(uuid4()),
            "depth_pref": "curta",
            "lang_pref": "pt",
        }
        created = await store.create_profile(user.id, new)
        profile = new if created else await store.get_profile(user.id)
    if not profile:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Perfil indisponível.")
    return ProfileOut(
        user_id=user.id,
        role=profile.get("role", "estudante"),
        depth_pref=profile.get("depth_pref", "curta"),
        lang_pref=profile.get("lang_pref", "pt"),
        created=created,
    )


@router.delete("", response_model=DeleteMeResponse)
async def delete_me(
    user: CurrentUser = Depends(get_current_user),
    store: Store = Depends(get_store),
    delete_user: UserDeleter = Depends(get_user_deleter),
) -> DeleteMeResponse:
    """Removes the caller's data (and a teacher's lessons), then the auth account. Only ever
    the caller's own id."""
    try:
        await store.delete_user_data(user.id, await store.get_profile(user.id))
        await asyncio.to_thread(delete_user, user.id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Não foi possível excluir agora.") from exc
    return DeleteMeResponse(deleted=True)
