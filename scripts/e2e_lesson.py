"""End-to-end check of a lesson against the real Firebase project, through the security rules
and the running API, the same way the web app does it.

The test teacher and two test students sign in with custom tokens made by the service account
(no passwords). The teacher creates a lesson, a student consents and joins, the teacher writes
sentences, ends the lesson (real AI provider) and approves the summary and quiz, and the
student reads them. A student outside the lesson must be refused. Everything is deleted at the
end (the AI glossary is not approved, so the shared dictionary is untouched).

Usage: start the API (npm run dev or npm run aula), then npm run e2e:lesson
Options: --api http://localhost:3000/py (through the site's /py proxy), --keep (do not delete).
Needs `npm run seed:dev` (test users) and web/.env.local (Firebase web API key).
"""

import argparse
import secrets
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from _common import (
    ROOT,
    STUDENT_EMAILS,
    TEACHER_EMAIL_DEFAULT,
    find_uid,
    init,
    load_env,
)
from firebase_admin import auth
from google.cloud.firestore_v1.base_query import FieldFilter

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
SENTENCES = [
    "Hoje a gente vai ver como guardar o histórico do código com o Git",
    "Primeiro eu crio um repositório com git init dentro da pasta do projeto",
    "Cada vez que eu termino uma parte eu faço um commit com uma mensagem curta",
    "Para testar uma ideia sem estragar o que funciona eu crio uma branch",
    "Terminei a funcionalidade então eu faço o merge da branch na main",
    "Para mandar tudo para o GitHub eu uso git push",
    "No GitHub a colega abre um pull request e revisa o código antes de juntar",
    "Commit pequeno e mensagem clara ajudam a equipe a entender o histórico",
]
failures = 0


def check(name: str, ok: bool, detail: str = "") -> bool:
    global failures
    print(("OK   " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures += 1
    return ok


def web_api_key(env: dict[str, str]) -> str:
    key = env.get("FIREBASE_WEB_API_KEY", "")
    path = ROOT / "web" / ".env.local"
    if not key and path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("NEXT_PUBLIC_FIREBASE_API_KEY="):
                key = line.split("=", 1)[1].strip()
    if len(key) < 20:
        sys.exit("Falta NEXT_PUBLIC_FIREBASE_API_KEY no web/.env.local.")
    return key


def value(v: Any) -> dict:
    """Python value -> Firestore REST value."""
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, datetime):
        return {"timestampValue": v.astimezone(UTC).isoformat().replace("+00:00", "Z")}
    if isinstance(v, list):
        return {"arrayValue": {"values": [value(x) for x in v]}}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: value(x) for k, x in v.items()}}}
    raise TypeError(type(v))


class Client:
    """One signed-in user talking to Firestore (REST, through the rules) and to the API."""

    def __init__(self, http: httpx.Client, project: str, key: str, uid: str, api: str):
        token = auth.create_custom_token(uid).decode()
        res = http.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={key}",
            json={"token": token, "returnSecureToken": True},
        )
        res.raise_for_status()
        self.http, self.api, self.uid = http, api, uid
        self.headers = {"Authorization": f"Bearer {res.json()['idToken']}"}
        self.base = f"projects/{project}/databases/(default)/documents"
        self.url = f"https://firestore.googleapis.com/v1/{self.base}"

    def write(
        self,
        path: str,
        fields: dict,
        *,
        now: tuple[str, ...] = (),
        create: bool = True,
        mask: tuple[str, ...] = (),
    ) -> dict:
        return {
            "update": {
                "name": f"{self.base}/{path}",
                "fields": {k: value(v) for k, v in fields.items()},
            },
            "updateTransforms": [{"fieldPath": f, "setToServerValue": "REQUEST_TIME"} for f in now],
            **({"currentDocument": {"exists": False}} if create else {}),
            **({"updateMask": {"fieldPaths": list(mask)}} if mask else {}),
        }

    def commit(self, writes: list[dict]) -> httpx.Response:
        return self.http.post(f"{self.url}:commit", headers=self.headers, json={"writes": writes})

    def get(self, path: str) -> httpx.Response:
        return self.http.get(f"{self.url}/{path}", headers=self.headers)

    def call(self, method: str, path: str, **kw) -> httpx.Response:
        return self.http.request(method, f"{self.api}{path}", headers=self.headers, **kw)


def cleanup(db, lesson_id: str, code: str) -> None:
    lesson = db.collection("lessons").document(lesson_id)
    for sub in ("utterances", "materials"):
        for doc in lesson.collection(sub).stream():
            doc.reference.delete()
    lesson.delete()
    db.collection("lessonCodes").document(code).delete()
    db.collection("lessonReports").document(lesson_id).delete()
    members = db.collection("lessonMembers").where(filter=FieldFilter("lesson_id", "==", lesson_id))
    for doc in members.stream():
        doc.reference.delete()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()
    env = load_env()
    db = init(env)
    project, key = env["FIREBASE_PROJECT_ID"], web_api_key(env)
    emails = [
        env.get("DEV_TEACHER_EMAIL", TEACHER_EMAIL_DEFAULT),
        STUDENT_EMAILS[0],
        STUDENT_EMAILS[1],
    ]
    uids = [find_uid(e) for e in emails]
    if not all(uids):
        sys.exit("Usuários de teste não encontrados: rode npm run seed:dev.")

    with httpx.Client(timeout=30) as http:
        teacher, student, outsider = (Client(http, project, key, u, args.api) for u in uids)
        check("API no ar", http.get(f"{args.api}/health").status_code == 200, args.api)

        lesson_id, code = str(uuid.uuid4()), "".join(secrets.choice(ALPHABET) for _ in range(6))
        res = teacher.commit(
            [
                teacher.write(
                    f"lessons/{lesson_id}",
                    {
                        "teacher_id": teacher.uid,
                        "title": "Teste de ponta a ponta",
                        "code": code,
                        "status": "criada",
                        "pack_ids": ["programacao-geral"],
                        "started_at": None,
                        "ended_at": None,
                    },
                    now=("created_at",),
                ),
                teacher.write(f"lessonCodes/{code}", {"lesson_id": lesson_id}),
            ]
        )
        if not check("professor cria a aula (regras)", res.status_code == 200, res.text[:200]):
            return 1
        try:
            query = {
                "structuredQuery": {
                    "from": [{"collectionId": "lessons"}],
                    "where": {
                        "fieldFilter": {
                            "field": {"fieldPath": "teacher_id"},
                            "op": "EQUAL",
                            "value": value(teacher.uid),
                        }
                    },
                    "orderBy": [{"field": {"fieldPath": "created_at"}, "direction": "DESCENDING"}],
                    "limit": 5,
                }
            }
            res = http.post(f"{teacher.url}:runQuery", headers=teacher.headers, json=query)
            check('lista "Minhas aulas" (índice publicado)', res.status_code == 200, res.text[:200])

            writes = [
                student.write(
                    f"consents/{student.uid}_{p}",
                    {"user_id": student.uid, "purpose": p, "revoked_at": None},
                    now=("granted_at",),
                )
                for p in ("termos_uso", "tratamento_dados")
            ]
            res = student.commit(writes)
            if res.status_code != 200:  # already granted in an earlier run: grant again
                writes = [
                    student.write(
                        f"consents/{student.uid}_{p}",
                        {"revoked_at": None},
                        now=("granted_at",),
                        create=False,
                        mask=("revoked_at",),
                    )
                    for p in ("termos_uso", "tratamento_dados")
                ]
                res = student.commit(writes)
            check(
                "aluno registra os consentimentos (regras)", res.status_code == 200, res.text[:200]
            )

            res = student.call("POST", "/lessons/join", json={"code": code})
            check("aluno entra pelo código (API)", res.status_code == 200, res.text[:200])
            res = teacher.call("GET", f"/lessons/{lesson_id}/member-count")
            check(
                "professor vê 1 aluno",
                res.status_code == 200 and res.json().get("count") == 1,
                res.text[:200],
            )

            res = teacher.commit(
                [
                    teacher.write(
                        f"lessons/{lesson_id}",
                        {"status": "ao_vivo"},
                        now=("started_at",),
                        create=False,
                        mask=("status",),
                    )
                ]
            )
            check("aula fica ao vivo (regras)", res.status_code == 200, res.text[:200])
            expires = datetime.now(UTC) + timedelta(hours=24)
            res = teacher.commit(
                [
                    teacher.write(
                        f"lessons/{lesson_id}/utterances/{i}",
                        {
                            "seq": i,
                            "text": s,
                            "terms": [],
                            "wpm": 120,
                            "expires_at": expires,
                        },
                        now=("created_at",),
                    )
                    for i, s in enumerate(SENTENCES, 1)
                ]
            )
            check("professor grava as frases (regras)", res.status_code == 200, res.text[:200])
            check(
                "aluno da aula lê a legenda",
                student.get(f"lessons/{lesson_id}/utterances/1").status_code == 200,
            )
            check(
                "aluno de fora é recusado",
                outsider.get(f"lessons/{lesson_id}/utterances/1").status_code == 403,
            )

            start = time.perf_counter()
            res = teacher.call("POST", f"/lessons/{lesson_id}/end", json={}, timeout=300)
            body = (
                res.json()
                if res.headers.get("content-type", "").startswith("application/json")
                else {}
            )
            check(
                f"encerrar gera resumo e quiz com a IA ({time.perf_counter() - start:.0f} s)",
                res.status_code == 200 and body.get("materials_status") == "gerado",
                res.text[:300],
            )
            check(
                "aluno não vê o rascunho",
                student.get(f"lessons/{lesson_id}/materials/resumo").status_code == 403,
            )

            res = teacher.commit(
                [
                    teacher.write(
                        f"lessons/{lesson_id}/materials/{kind}",
                        {"status": "aprovado"},
                        now=("approved_at", "updated_at"),
                        create=False,
                        mask=("status",),
                    )
                    for kind in ("resumo", "quiz")
                ]
            )
            check("professor aprova resumo e quiz (regras)", res.status_code == 200, res.text[:200])
            res = student.get(f"lessons/{lesson_id}/materials/resumo")
            titulo = (
                (
                    res.json()
                    .get("fields", {})
                    .get("content", {})
                    .get("mapValue", {})
                    .get("fields", {})
                    .get("titulo", {})
                    .get("stringValue", "")
                )
                if res.status_code == 200
                else ""
            )
            check("aluno lê o resumo aprovado", bool(titulo), res.text[:200])
            if titulo:
                print(f"     resumo: {titulo}")
            check(
                "aluno lê o quiz aprovado",
                student.get(f"lessons/{lesson_id}/materials/quiz").status_code == 200,
            )
        finally:
            if args.keep:
                print(f"Aula mantida: {lesson_id} (código {code})")
            else:
                cleanup(db, lesson_id, code)
                print("Aula de teste apagada.")
    print("RESULTADO:", "OK" if failures == 0 else f"{failures} falha(s)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
