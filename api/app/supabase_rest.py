"""Thin async PostgREST client.

`UserRest` always sends the caller's own access token, so RLS keeps applying (least
privilege). `ServiceRest` uses the secret/service key and is only for /cron/purge and
deleting the caller's own account.
"""

from typing import Any

import httpx

from app.config import Settings

PAGE_SIZE = 1000


class SupabaseError(Exception):
    def __init__(self, status: int, body: str) -> None:
        super().__init__(f"Supabase HTTP {status}: {body[:300]}")
        self.status = status
        self.body = body


class _Rest:
    def __init__(self, http: httpx.AsyncClient, settings: Settings, headers: dict[str, str]):
        self._http = http
        self._base = settings.supabase_url.rstrip("/")
        self._headers = headers

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json: Any = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        res = await self._http.request(
            method,
            f"{self._base}{path}",
            params=params,
            json=json,
            headers={**self._headers, **(headers or {})},
        )
        if res.status_code >= 400:
            raise SupabaseError(res.status_code, res.text)
        return res

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        res = await self._request("GET", f"/rest/v1/{table}", params=params)
        return res.json()

    async def select_all(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        """Reads every row, page by page (PostgREST caps each response at 1000 rows)."""
        out: list[dict[str, Any]] = []
        start = 0
        while True:
            res = await self._request(
                "GET",
                f"/rest/v1/{table}",
                params=params,
                headers={"Range-Unit": "items", "Range": f"{start}-{start + PAGE_SIZE - 1}"},
            )
            page = res.json()
            out.extend(page)
            if len(page) < PAGE_SIZE:
                return out
            start += PAGE_SIZE

    async def upsert(
        self, table: str, rows: list[dict[str, Any]] | dict[str, Any], on_conflict: str
    ) -> list[dict[str, Any]]:
        res = await self._request(
            "POST",
            f"/rest/v1/{table}",
            params={"on_conflict": on_conflict},
            json=rows,
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        return res.json()

    async def update(
        self, table: str, filters: dict[str, str], values: dict[str, Any]
    ) -> list[dict[str, Any]]:
        res = await self._request(
            "PATCH",
            f"/rest/v1/{table}",
            params=filters,
            json=values,
            headers={"Prefer": "return=representation"},
        )
        return res.json()

    async def rpc(self, fn: str, args: dict[str, Any] | None = None) -> Any:
        res = await self._request("POST", f"/rest/v1/rpc/{fn}", json=args or {})
        return res.json() if res.content else None


class UserRest(_Rest):
    def __init__(self, http: httpx.AsyncClient, settings: Settings, token: str):
        super().__init__(
            http,
            settings,
            {"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )


class ServiceRest(_Rest):
    """Secret key goes only on the `apikey` header (it is not a JWT)."""

    def __init__(self, http: httpx.AsyncClient, settings: Settings):
        super().__init__(http, settings, {"apikey": settings.supabase_service_role_key})

    async def delete_auth_user(self, user_id: str) -> None:
        await self._request("DELETE", f"/auth/v1/admin/users/{user_id}")
