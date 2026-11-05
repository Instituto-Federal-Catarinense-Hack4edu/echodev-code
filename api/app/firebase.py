"""Firebase Admin SDK setup: one app and one async Firestore client per process.

The Admin SDK bypasses the Firestore security rules, so every route that uses it checks
ownership itself (see app/routes). The emulators are picked up from the settings.
"""

import os

import firebase_admin
from firebase_admin import auth, credentials
from google.cloud import firestore

from app.config import Settings

_app: firebase_admin.App | None = None
_db: firestore.AsyncClient | None = None


def _export_emulators(settings: Settings) -> None:
    # The Google libraries read these from the process environment, not from api/.env.
    if settings.firestore_emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host
    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host


def _credential(settings: Settings) -> credentials.Base | None:
    if settings.firebase_credentials_file:
        return credentials.Certificate(settings.firebase_credentials_file)
    return None


def get_app(settings: Settings) -> firebase_admin.App:
    global _app
    if _app is None:
        _export_emulators(settings)
        options = (
            {"projectId": settings.firebase_project_id} if settings.firebase_project_id else {}
        )
        _app = firebase_admin.initialize_app(_credential(settings), options)
    return _app


def get_db(settings: Settings) -> firestore.AsyncClient:
    global _db
    if _db is None:
        _export_emulators(settings)
        cred = _credential(settings)
        # With FIRESTORE_EMULATOR_HOST set the client uses anonymous credentials by itself.
        _db = firestore.AsyncClient(
            project=settings.firebase_project_id or None,
            credentials=cred.get_credential() if cred else None,
        )
    return _db


def verify_id_token(settings: Settings, token: str) -> dict:
    """Checks signature, expiry and project of a Firebase ID token (raises on failure)."""
    return auth.verify_id_token(token, app=get_app(settings))


def delete_auth_user(settings: Settings, uid: str) -> None:
    auth.delete_user(uid, app=get_app(settings))
