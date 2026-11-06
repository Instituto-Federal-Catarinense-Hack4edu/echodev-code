"""Data access used by the routes. `FirestoreStore` talks to Firestore with the Admin SDK;
tests use an in-memory fake with the same methods (tests/fake_store.py).

Collections (see firestore.rules and docs/DECISIONS.md):
  profiles/{uid}                 role, pseudonym_id, depth_pref, lang_pref, created_at
  teacherAllowlist/{email}       teacher e-mails
  consents/{uid}_{purpose}       user_id, purpose, granted_at, revoked_at
  lessons/{id}                   teacher_id, title, code, status, pack_ids,
                                 started_at, ended_at, created_at
  lessons/{id}/utterances/{seq}  seq, text, text_es, terms, wpm, created_at, expires_at
  lessons/{id}/materials/{kind}  kind, content, status, approved_at, created_at, updated_at
                                 kind: resumo, quiz, glossario (+ resumo_es, quiz_es: browser)
  lessonCodes/{code}             lesson_id
  lessonMembers/{id}_{pseudonym} lesson_id, pseudonym_id, lesson_code, joined_at
  lessonReports/{id}             data, created_at
  termEvents/{auto}              lesson_id, pseudonym_id, term_id, kind, depth, created_at
"""

from datetime import datetime
from typing import Any, Protocol

from google.api_core import exceptions as gexc
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

REQUIRED_PURPOSES = ("termos_uso", "tratamento_dados")
_BATCH = 400


class MaterialExists(Exception):
    """A concurrent request created the material first."""


class Store(Protocol):
    async def get_profile(self, uid: str) -> dict[str, Any] | None: ...
    async def create_profile(self, uid: str, profile: dict[str, Any]) -> bool: ...
    async def is_teacher_email(self, email: str) -> bool: ...
    async def get_lesson(self, lesson_id: str) -> dict[str, Any] | None: ...
    async def find_lesson_by_code(self, code: str) -> dict[str, Any] | None: ...
    async def update_lesson(self, lesson_id: str, values: dict[str, Any]) -> None: ...
    async def list_utterances(self, lesson_id: str) -> list[dict[str, Any]]: ...
    async def get_report(self, lesson_id: str) -> dict[str, Any] | None: ...
    async def set_report(self, lesson_id: str, data: dict[str, Any]) -> None: ...
    async def list_materials(self, lesson_id: str) -> list[dict[str, Any]]: ...
    async def get_material(self, lesson_id: str, kind: str) -> dict[str, Any] | None: ...
    async def create_material(self, lesson_id: str, kind: str, content: Any) -> dict[str, Any]: ...
    async def update_material(
        self, lesson_id: str, kind: str, values: dict[str, Any]
    ) -> dict[str, Any]: ...
    async def active_consents(self, uid: str) -> set[str]: ...
    async def add_member(self, lesson_id: str, pseudonym_id: str, code: str) -> None: ...
    async def count_members(self, lesson_id: str) -> int: ...
    async def list_term_events(self, lesson_id: str) -> list[dict[str, Any]]: ...
    async def delete_user_data(self, uid: str, profile: dict[str, Any] | None) -> None: ...
    async def purge_expired(self, now: datetime) -> int: ...


def _iso(value: Any) -> Any:
    return value.isoformat() if isinstance(value, datetime) else value


def _material(doc: Any) -> dict[str, Any]:
    data = doc.to_dict() or {}
    return {
        "id": doc.id,
        "kind": data.get("kind", doc.id),
        "status": data.get("status", "rascunho"),
        "content": data.get("content"),
    }


class FirestoreStore:
    def __init__(self, db: firestore.AsyncClient) -> None:
        self.db = db

    # ---------- profiles ----------

    async def get_profile(self, uid: str) -> dict[str, Any] | None:
        snap = await self.db.collection("profiles").document(uid).get()
        return snap.to_dict() if snap.exists else None

    async def create_profile(self, uid: str, profile: dict[str, Any]) -> bool:
        """Creates the profile once; False if it already existed (concurrent first login)."""
        try:
            await (
                self.db.collection("profiles")
                .document(uid)
                .create({**profile, "created_at": firestore.SERVER_TIMESTAMP})
            )
            return True
        except gexc.AlreadyExists:
            return False

    async def is_teacher_email(self, email: str) -> bool:
        if not email:
            return False
        snap = await self.db.collection("teacherAllowlist").document(email.lower()).get()
        return snap.exists

    # ---------- lessons ----------

    async def get_lesson(self, lesson_id: str) -> dict[str, Any] | None:
        snap = await self.db.collection("lessons").document(lesson_id).get()
        return {"id": snap.id, **(snap.to_dict() or {})} if snap.exists else None

    async def find_lesson_by_code(self, code: str) -> dict[str, Any] | None:
        snap = await self.db.collection("lessonCodes").document(code).get()
        lesson_id = (snap.to_dict() or {}).get("lesson_id") if snap.exists else None
        return (
            await self.get_lesson(lesson_id) if isinstance(lesson_id, str) and lesson_id else None
        )

    async def update_lesson(self, lesson_id: str, values: dict[str, Any]) -> None:
        await self.db.collection("lessons").document(lesson_id).update(values)

    async def list_utterances(self, lesson_id: str) -> list[dict[str, Any]]:
        query = (
            self.db.collection("lessons")
            .document(lesson_id)
            .collection("utterances")
            .order_by("seq")
        )
        out: list[dict[str, Any]] = []
        async for doc in query.stream():
            d = doc.to_dict() or {}
            out.append(
                {
                    "seq": d.get("seq"),
                    "text": d.get("text", ""),
                    "terms": d.get("terms", []),
                    "wpm": d.get("wpm", 0),
                    "created_at": _iso(d.get("created_at")),
                }
            )
        return out

    async def get_report(self, lesson_id: str) -> dict[str, Any] | None:
        snap = await self.db.collection("lessonReports").document(lesson_id).get()
        return (snap.to_dict() or {}).get("data") if snap.exists else None

    async def set_report(self, lesson_id: str, data: dict[str, Any]) -> None:
        await (
            self.db.collection("lessonReports")
            .document(lesson_id)
            .set({"data": data, "created_at": firestore.SERVER_TIMESTAMP})
        )

    # ---------- materials ----------

    def _materials(self, lesson_id: str) -> Any:
        return self.db.collection("lessons").document(lesson_id).collection("materials")

    async def list_materials(self, lesson_id: str) -> list[dict[str, Any]]:
        out = []
        async for doc in self._materials(lesson_id).stream():
            if doc.id in ("resumo", "quiz", "glossario"):
                out.append(_material(doc))
        return sorted(out, key=lambda m: m["kind"], reverse=True)  # resumo, quiz, glossario

    async def get_material(self, lesson_id: str, kind: str) -> dict[str, Any] | None:
        snap = await self._materials(lesson_id).document(kind).get()
        return _material(snap) if snap.exists else None

    async def create_material(self, lesson_id: str, kind: str, content: Any) -> dict[str, Any]:
        ref = self._materials(lesson_id).document(kind)
        try:
            await ref.create(
                {
                    "kind": kind,
                    "content": content,
                    "status": "rascunho",
                    "approved_at": None,
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                }
            )
        except gexc.AlreadyExists as exc:
            raise MaterialExists(kind) from exc
        return {"id": kind, "kind": kind, "status": "rascunho", "content": content}

    async def update_material(
        self, lesson_id: str, kind: str, values: dict[str, Any]
    ) -> dict[str, Any]:
        ref = self._materials(lesson_id).document(kind)
        await ref.update({**values, "updated_at": firestore.SERVER_TIMESTAMP})
        return _material(await ref.get())

    # ---------- membership, consents, events ----------

    async def active_consents(self, uid: str) -> set[str]:
        query = self.db.collection("consents").where(filter=FieldFilter("user_id", "==", uid))
        active = set()
        async for doc in query.stream():
            d = doc.to_dict() or {}
            if d.get("revoked_at") is None and d.get("purpose"):
                active.add(d["purpose"])
        return active

    async def add_member(self, lesson_id: str, pseudonym_id: str, code: str) -> None:
        ref = self.db.collection("lessonMembers").document(f"{lesson_id}_{pseudonym_id}")
        try:
            await ref.create(
                {
                    "lesson_id": lesson_id,
                    "pseudonym_id": pseudonym_id,
                    "lesson_code": code,
                    "joined_at": firestore.SERVER_TIMESTAMP,
                }
            )
        except gexc.AlreadyExists:
            pass  # joining twice keeps the first date

    async def count_members(self, lesson_id: str) -> int:
        query = self.db.collection("lessonMembers").where(
            filter=FieldFilter("lesson_id", "==", lesson_id)
        )
        result = await query.count().get()
        return int(result[0][0].value) if result and result[0] else 0

    async def list_term_events(self, lesson_id: str) -> list[dict[str, Any]]:
        query = self.db.collection("termEvents").where(
            filter=FieldFilter("lesson_id", "==", lesson_id)
        )
        return [doc.to_dict() or {} async for doc in query.stream()]

    # ---------- deletion ----------

    async def _delete_query(self, query: Any) -> int:
        n = 0
        batch = self.db.batch()
        pending = 0
        async for doc in query.stream():
            batch.delete(doc.reference)
            pending += 1
            n += 1
            if pending >= _BATCH:
                await batch.commit()
                batch, pending = self.db.batch(), 0
        if pending:
            await batch.commit()
        return n

    def _where(self, collection: str, field: str, value: Any) -> Any:
        return self.db.collection(collection).where(filter=FieldFilter(field, "==", value))

    async def delete_user_data(self, uid: str, profile: dict[str, Any] | None) -> None:
        """Student traces, consents and profile; a teacher's lessons go too (with everything
        inside them), like the old ON DELETE CASCADE."""
        pseudonym = (profile or {}).get("pseudonym_id")
        if pseudonym:
            await self._delete_query(self._where("termEvents", "pseudonym_id", pseudonym))
            await self._delete_query(self._where("lessonMembers", "pseudonym_id", pseudonym))
        async for lesson in self._where("lessons", "teacher_id", uid).stream():
            data = lesson.to_dict() or {}
            await self._delete_query(self._where("lessonMembers", "lesson_id", lesson.id))
            await self._delete_query(self._where("termEvents", "lesson_id", lesson.id))
            await self.db.collection("lessonReports").document(lesson.id).delete()
            if data.get("code"):
                await self.db.collection("lessonCodes").document(data["code"]).delete()
            await self.db.recursive_delete(lesson.reference)
        await self._delete_query(self._where("consents", "user_id", uid))
        await self.db.collection("profiles").document(uid).delete()

    async def purge_expired(self, now: datetime) -> int:
        query = self.db.collection_group("utterances").where(
            filter=FieldFilter("expires_at", "<=", now)
        )
        return await self._delete_query(query)
