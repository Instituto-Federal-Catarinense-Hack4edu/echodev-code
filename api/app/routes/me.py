"""'Delete my data': first the user's own rows (with their token, via delete_my_data()),
then the auth account itself (needs the service key; only ever the caller's own id)."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import CurrentUser, clear_auth_cache, get_current_user, get_http
from app.config import Settings, get_settings
from app.schemas import DeleteMeResponse
from app.supabase_rest import ServiceRest, SupabaseError, UserRest

router = APIRouter(prefix="/me", tags=["me"])


@router.delete("", response_model=DeleteMeResponse)
async def delete_me(
    user: CurrentUser = Depends(get_current_user),
    http: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
) -> DeleteMeResponse:
    if not settings.supabase_service_role_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Exclusão não configurada.")
    try:
        await UserRest(http, settings, user.token).rpc("delete_my_data")
        await ServiceRest(http, settings).delete_auth_user(user.id)
    except SupabaseError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Não foi possível excluir agora.") from exc
    clear_auth_cache()
    return DeleteMeResponse(deleted=True)
