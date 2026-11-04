"""Plan B for pg_cron: an external scheduler calls POST /cron/purge with X-Cron-Secret.
The only route (with DELETE /me) that uses the service key."""

import secrets

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.auth import get_http
from app.config import Settings, get_settings
from app.schemas import PurgeResponse
from app.supabase_rest import ServiceRest

router = APIRouter(prefix="/cron", tags=["cron"])


@router.post("/purge", response_model=PurgeResponse)
async def purge(
    x_cron_secret: str = Header(default=""),
    http: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
) -> PurgeResponse:
    if not settings.cron_secret or not settings.supabase_service_role_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Limpeza não configurada.")
    # Compare bytes: compare_digest raises TypeError on non-ASCII str (would be a 500).
    if not secrets.compare_digest(x_cron_secret.encode(), settings.cron_secret.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Segredo inválido.")
    deleted = await ServiceRest(http, settings).rpc("purge_expired_utterances")
    return PurgeResponse(deleted=int(deleted or 0))
