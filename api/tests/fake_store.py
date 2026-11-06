"""In-memory Store with the same methods as FirestoreStore (app/store.py)."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from google.api_core.exceptions import ServiceUnavailable

from app.store import MaterialExists


class FakeStore:
    def __init__(self) -> None:
        self.profiles: dict[str, dict[str, Any]] = {}
        self.allowlist: set[str] = set()
        self.lessons: dict[str, dict[str, Any]] = {}
        self.codes: dict[str, str] = {}
        self.utterances: dict[str, list[dict[str, Any]]] = {}
        self.materials: dict[str, dict[str, dict[str, Any]]] = {}
        self.reports: dict[str, dict[str, Any]] = {}
        self.consents: dict[str, dict[str, Any]] = {}
        self.members: dict[str, dict[str, Any]] = {}
        self.term_events: list[dict[str, Any]] = []
        self.fail: set[str] = set()  # method names that raise a Firestore error

    def _check(self, method: str) -> None:
        if method in self.fail:
            raise ServiceUnavailable("fake outage")

    # ---------- helpers for tests ----------

    def add_user(self, uid: str, role: str = "estudante", consents: bool = True) -> str:
        self.profiles[uid] = {
            "role": role,
            "pseudonym_id": f"p-{uid}",
            "depth_pref": "curta",
            "lang_pref": "pt",
        }
        if consents:
            for purpose in ("termos_uso", "tratamento_dados"):
                self.consents[f"{uid}_{purpose}"] = {
                    "user_id": uid,
                    "purpose": purpose,
                    "revoked_at": None,
                }
        return uid

    def add_lesson(self, teacher: str, status: str = "ao_vivo", code: str = "ABC234") -> str:
        lesson_id = str(uuid4())
        self.lessons[lesson_id] = {
            "id": lesson_id,
            "teacher_id": teacher,
            "title": "Introdução ao Git",
            "code": code,
            "status": status,
        }
        self.codes[code] = lesson_id
        return lesson_id

    def add_utterances(self, lesson_id: str, n: int) -> None:
        start = datetime(2026, 11, 3, 14, 0, tzinfo=UTC)
        rows = self.utterances.setdefault(lesson_id, [])
        for i in range(1, n + 1):
            rows.append(
                {
                    "seq": i,
                    "text": f"frase {i} sobre git commit",
                    "terms": [],
                    "wpm": 120,
                    "created_at": (start + timedelta(seconds=6 * i)).isoformat(),
                    "expires_at": start + timedelta(hours=24),
                }
            )

    # ---------- Store ----------

    async def get_profile(self, uid: str) -> dict[str, Any] | None:
        self._check("get_profile")
        p = self.profiles.get(uid)
        return dict(p) if p else None

    async def create_profile(self, uid: str, profile: dict[str, Any]) -> bool:
        if uid in self.profiles:
            return False
        self.profiles[uid] = dict(profile)
        return True

    async def is_teacher_email(self, email: str) -> bool:
        return email.lower() in self.allowlist

    async def get_lesson(self, lesson_id: str) -> dict[str, Any] | None:
        lesson = self.lessons.get(lesson_id)
        return dict(lesson) if lesson else None

    async def find_lesson_by_code(self, code: str) -> dict[str, Any] | None:
        lesson_id = self.codes.get(code)
        return await self.get_lesson(lesson_id) if lesson_id else None

    async def update_lesson(self, lesson_id: str, values: dict[str, Any]) -> None:
        self._check("update_lesson")
        self.lessons[lesson_id].update(values)

    async def list_utterances(self, lesson_id: str) -> list[dict[str, Any]]:
        rows = sorted(self.utterances.get(lesson_id, []), key=lambda u: u["seq"])
        return [{k: u[k] for k in ("seq", "text", "terms", "wpm", "created_at")} for u in rows]

    async def get_report(self, lesson_id: str) -> dict[str, Any] | None:
        return self.reports.get(lesson_id)

    async def set_report(self, lesson_id: str, data: dict[str, Any]) -> None:
        self.reports[lesson_id] = data

    async def list_materials(self, lesson_id: str) -> list[dict[str, Any]]:
        mats = self.materials.get(lesson_id, {})
        out = [dict(m) for kind, m in mats.items() if kind in ("resumo", "quiz", "glossario")]
        return sorted(out, key=lambda m: m["kind"], reverse=True)

    async def get_material(self, lesson_id: str, kind: str) -> dict[str, Any] | None:
        m = self.materials.get(lesson_id, {}).get(kind)
        return dict(m) if m else None

    async def create_material(self, lesson_id: str, kind: str, content: Any) -> dict[str, Any]:
        mats = self.materials.setdefault(lesson_id, {})
        if kind in mats:
            raise MaterialExists(kind)
        mats[kind] = {"id": kind, "kind": kind, "status": "rascunho", "content": content}
        return dict(mats[kind])

    async def update_material(
        self, lesson_id: str, kind: str, values: dict[str, Any]
    ) -> dict[str, Any]:
        m = self.materials[lesson_id][kind]
        m.update({k: v for k, v in values.items() if k in ("content", "status")})
        return dict(m)

    async def active_consents(self, uid: str) -> set[str]:
        return {
            c["purpose"]
            for c in self.consents.values()
            if c["user_id"] == uid and c["revoked_at"] is None
        }

    async def add_member(self, lesson_id: str, pseudonym_id: str, code: str) -> None:
        self.members.setdefault(
            f"{lesson_id}_{pseudonym_id}",
            {"lesson_id": lesson_id, "pseudonym_id": pseudonym_id, "lesson_code": code},
        )

    async def count_members(self, lesson_id: str) -> int:
        return sum(1 for m in self.members.values() if m["lesson_id"] == lesson_id)

    async def list_term_events(self, lesson_id: str) -> list[dict[str, Any]]:
        return [e for e in self.term_events if e["lesson_id"] == lesson_id]

    async def delete_user_data(self, uid: str, profile: dict[str, Any] | None) -> None:
        pseudonym = (profile or {}).get("pseudonym_id")
        self.term_events = [e for e in self.term_events if e["pseudonym_id"] != pseudonym]
        self.members = {k: m for k, m in self.members.items() if m["pseudonym_id"] != pseudonym}
        for lesson_id in [i for i, lesson in self.lessons.items() if lesson["teacher_id"] == uid]:
            self.codes.pop(self.lessons[lesson_id]["code"], None)
            self.lessons.pop(lesson_id)
            self.utterances.pop(lesson_id, None)
            self.materials.pop(lesson_id, None)
            self.reports.pop(lesson_id, None)
            self.members = {k: m for k, m in self.members.items() if m["lesson_id"] != lesson_id}
            self.term_events = [e for e in self.term_events if e["lesson_id"] != lesson_id]
        self.consents = {k: c for k, c in self.consents.items() if c["user_id"] != uid}
        self.profiles.pop(uid, None)

    async def purge_expired(self, now: datetime) -> int:
        n = 0
        for lesson_id, rows in self.utterances.items():
            keep = [u for u in rows if u["expires_at"] > now]
            n += len(rows) - len(keep)
            self.utterances[lesson_id] = keep
        return n
