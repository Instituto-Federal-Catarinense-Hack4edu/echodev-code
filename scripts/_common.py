"""Shared helpers for admin scripts (Firebase Admin SDK; never used by the web app).

Reads the root .env. With `--emulators` (or FIRESTORE_EMULATOR_HOST set) everything goes to
the local emulators started by `npm run emulators`, never to the real project.
"""

import os
import sys
from pathlib import Path
from uuid import uuid4

import firebase_admin
from firebase_admin import auth, credentials
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

ROOT = Path(__file__).resolve().parent.parent
TEACHER_EMAIL_DEFAULT = "professor.teste@echodev.test"
STUDENT_EMAILS = [f"estudante{i}.teste@echodev.test" for i in range(1, 9)]
EMULATOR_FIRESTORE = "127.0.0.1:8080"
EMULATOR_AUTH = "127.0.0.1:9099"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    env.update(
        {k: v for k, v in os.environ.items() if k.startswith(("FIREBASE_", "FIRESTORE_", "DEV_"))}
    )
    if "--emulators" in sys.argv:
        env["FIRESTORE_EMULATOR_HOST"] = EMULATOR_FIRESTORE
        env["FIREBASE_AUTH_EMULATOR_HOST"] = EMULATOR_AUTH
    if not env.get("FIREBASE_PROJECT_ID"):
        sys.exit("Falta FIREBASE_PROJECT_ID no .env da raiz (veja .env.example).")
    return env


def init(env: dict[str, str]):
    """Initializes the Admin SDK and returns a sync Firestore client."""
    for key in ("FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"):
        if env.get(key):
            os.environ[key] = env[key]
    emulators = bool(env.get("FIRESTORE_EMULATOR_HOST"))
    cred_file = env.get("FIREBASE_CREDENTIALS_FILE", "")
    if not emulators and not cred_file:
        sys.exit(
            "Defina FIREBASE_CREDENTIALS_FILE (JSON da conta de serviço) no .env da raiz, "
            "ou use --emulators."
        )
    cred = credentials.Certificate(str(ROOT / cred_file)) if cred_file and not emulators else None
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {"projectId": env["FIREBASE_PROJECT_ID"]})
    where = "emuladores locais" if emulators else f"projeto {env['FIREBASE_PROJECT_ID']}"
    print(f"Usando: {where}")
    # With FIRESTORE_EMULATOR_HOST the client uses anonymous credentials by itself.
    return firestore.Client(
        project=env["FIREBASE_PROJECT_ID"], credentials=cred.get_credential() if cred else None
    )


def find_uid(email: str) -> str | None:
    try:
        return auth.get_user_by_email(email).uid
    except auth.UserNotFoundError:
        return None


def ensure_profile(db, uid: str, role: str) -> dict:
    """Creates the profile (with a new pseudonym) or updates only its role."""
    ref = db.collection("profiles").document(uid)
    snap = ref.get()
    if snap.exists:
        ref.update({"role": role})
        return {**(snap.to_dict() or {}), "role": role}
    profile = {
        "role": role,
        "pseudonym_id": str(uuid4()),
        "depth_pref": "curta",
        "lang_pref": "pt",
        "created_at": firestore.SERVER_TIMESTAMP,
    }
    ref.set(profile)
    return profile


def clear_student_traces(db, pseudonym: str | None) -> None:
    """A teacher account never keeps student traces (memberships, term events)."""
    if not pseudonym:
        return
    for name in ("lessonMembers", "termEvents"):
        query = db.collection(name).where(filter=FieldFilter("pseudonym_id", "==", pseudonym))
        for doc in query.stream():
            doc.reference.delete()
