"""In-memory stand-in for Supabase Auth + PostgREST, wired through respx.

Mimics what matters for the routes: token -> user, owner-only visibility of lessons
(as RLS would), eq filters, ordering by seq, Range pagination (1000-row cap)."""

import json
import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import respx

from tests.conftest import SUPABASE

ROW_CAP = 1000


class FakeSupabase:
    def __init__(self, mock: respx.MockRouter) -> None:
        self.users: dict[str, str] = {}  # token -> user id
        self.tables: dict[str, list[dict[str, Any]]] = {
            "lessons": [],
            "utterances": [],
            "lesson_reports": [],
            "lesson_materials": [],
        }
        self.utterance_pages: list[str] = []
        self.service_calls: list[str] = []
        mock.get(f"{SUPABASE}/auth/v1/user").mock(side_effect=self._auth_user)
        mock.route(url__regex=rf"{re.escape(SUPABASE)}/rest/v1/rpc/.*").mock(side_effect=self._rpc)
        mock.route(url__regex=rf"{re.escape(SUPABASE)}/rest/v1/\w+").mock(side_effect=self._rest)
        mock.delete(url__regex=rf"{re.escape(SUPABASE)}/auth/v1/admin/users/.*").mock(
            side_effect=self._admin_delete
        )

    # ----- setup helpers -----
    def add_user(self, token: str) -> str:
        uid = str(uuid.uuid4())
        self.users[token] = uid
        return uid

    def add_lesson(self, teacher_id: str, status: str = "ao_vivo") -> str:
        lid = str(uuid.uuid4())
        self.tables["lessons"].append({"id": lid, "teacher_id": teacher_id, "status": status})
        return lid

    def add_utterances(self, lesson_id: str, n: int, text: str = "frase {i}") -> None:
        start = datetime(2026, 11, 3, 14, 0, tzinfo=UTC)
        for i in range(1, n + 1):
            self.tables["utterances"].append(
                {
                    "lesson_id": lesson_id,
                    "seq": i,
                    "text": text.format(i=i),
                    "terms": [],
                    "wpm": 120 + (i % 7),
                    "created_at": (start + timedelta(seconds=4 * i)).isoformat(),
                }
            )

    # ----- handlers -----
    def _uid(self, request: httpx.Request) -> str | None:
        token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        return self.users.get(token)

    def _auth_user(self, request: httpx.Request) -> httpx.Response:
        uid = self._uid(request)
        return httpx.Response(200, json={"id": uid}) if uid else httpx.Response(401)

    def _visible(self, table: str, uid: str | None) -> list[dict[str, Any]]:
        rows = self.tables[table]
        if table == "lessons":
            # Owner sees everything; anyone else sees the row too (as a member would) so the
            # API's own teacher_id check is exercised.
            return rows
        owned = {lesson["id"] for lesson in self.tables["lessons"] if lesson["teacher_id"] == uid}
        return [r for r in rows if r.get("lesson_id") in owned]

    @staticmethod
    def _filter(rows: list[dict[str, Any]], params: httpx.QueryParams) -> list[dict[str, Any]]:
        for key, value in params.multi_items():
            if value.startswith("eq."):
                rows = [r for r in rows if str(r.get(key)) == value[3:]]
        if params.get("order") == "seq.asc":
            rows = sorted(rows, key=lambda r: r["seq"])
        return rows

    def _rest(self, request: httpx.Request) -> httpx.Response:
        table = request.url.path.rsplit("/", 1)[-1]
        if request.headers.get("apikey") == "sb_secret_test":
            self.service_calls.append(f"{request.method} {table}")
        uid = self._uid(request)
        if uid is None:
            return httpx.Response(401, json={"message": "JWT required"})
        if request.method == "GET":
            rows = self._filter(self._visible(table, uid), request.url.params)
            start, end = 0, ROW_CAP - 1
            if rng := request.headers.get("range"):
                a, b = rng.split("-")
                start, end = int(a), int(b)
                if table == "utterances":
                    self.utterance_pages.append(rng)
            end = min(end, start + ROW_CAP - 1)
            return httpx.Response(200, json=rows[start : end + 1])
        body = json.loads(request.content or b"null")
        if request.method == "PATCH":
            rows = self._filter(self._visible(table, uid), request.url.params)
            for r in rows:
                r.update(body)
            return httpx.Response(200, json=rows)
        if request.method == "POST":
            items = body if isinstance(body, list) else [body]
            out = []
            for item in items:
                lesson = next(x for x in self.tables["lessons"] if x["id"] == item["lesson_id"])
                if lesson["teacher_id"] != uid:
                    return httpx.Response(403, json={"message": "RLS"})
                conflict = request.url.params.get("on_conflict")
                existing = None
                if conflict:
                    keys = conflict.split(",")
                    existing = next(
                        (r for r in self.tables[table] if all(r.get(k) == item[k] for k in keys)),
                        None,
                    )
                elif table == "lesson_materials" and any(
                    r["lesson_id"] == item["lesson_id"] and r["kind"] == item["kind"]
                    for r in self.tables[table]
                ):
                    return httpx.Response(409, json={"code": "23505"})
                if existing:
                    existing.update(item)
                    out.append(existing)
                else:
                    row = {"id": str(uuid.uuid4()), "status": "rascunho", **item}
                    self.tables[table].append(row)
                    out.append(row)
            return httpx.Response(201, json=out)
        return httpx.Response(405)

    def _rpc(self, request: httpx.Request) -> httpx.Response:
        fn = request.url.path.rsplit("/", 1)[-1]
        if fn == "purge_expired_utterances":
            self.service_calls.append("rpc purge")
            return httpx.Response(200, json=7)
        if fn == "delete_my_data":
            return httpx.Response(204) if self._uid(request) else httpx.Response(401)
        return httpx.Response(404)

    def _admin_delete(self, request: httpx.Request) -> httpx.Response:
        self.service_calls.append(f"DELETE user {request.url.path.rsplit('/', 1)[-1]}")
        return httpx.Response(200, json={})
