"""Deletes transcript lines older than 24 h. An external scheduler calls POST /cron/purge
with X-Cron-Secret every hour (Firestore TTL would need a billing-enabled project)."""

import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.deps import get_store
from app.schemas import PurgeResponse
from app.store import Store

router = APIRouter(prefix="/cron", tags=["cron"])


@router.post("/purge", response_model=PurgeResponse)
async def purge(
    x_cron_secret: str = Header(default=""),
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> PurgeResponse:
    if not settings.cron_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Limpeza não configurada.")
    # Compare bytes: compare_digest raises TypeError on non-ASCII str (would be a 500).
    if not secrets.compare_digest(x_cron_secret.encode(), settings.cron_secret.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Segredo inválido.")
    return PurgeResponse(deleted=await store.purge_expired(datetime.now(UTC)))
