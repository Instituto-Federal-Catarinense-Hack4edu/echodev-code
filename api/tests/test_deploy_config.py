"""Settings used by the Vercel deployment: credentials from a variable, dependency lists in sync."""

import json
import tomllib
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from firebase_admin import credentials

from app.config import Settings
from app.firebase import _credential

API = Path(__file__).resolve().parent.parent


def fake_service_account() -> dict:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    return {
        "type": "service_account",
        "project_id": "projeto-teste",
        "private_key_id": "abc",
        "private_key": pem,
        "client_email": "sa@projeto-teste.iam.gserviceaccount.com",
        "client_id": "1",
        "token_uri": "https://oauth2.googleapis.com/token",
    }


def test_credentials_json_variable_wins_over_the_file(tmp_path):
    info = fake_service_account()
    cred = _credential(
        Settings(
            _env_file=None,
            firebase_credentials_json=json.dumps(info),
            firebase_credentials_file=str(tmp_path / "nao-existe.json"),
        )
    )
    assert isinstance(cred, credentials.Certificate)
    assert cred.project_id == "projeto-teste"


def test_no_credentials_means_default_or_emulators():
    assert _credential(Settings(_env_file=None, firebase_credentials_file="")) is None


def _name(requirement: str) -> str:
    return requirement.split("==")[0].split("[")[0].strip().lower()


def test_pyproject_and_requirements_list_the_same_pins():
    lines = (API / "requirements.txt").read_text(encoding="utf-8").splitlines()
    pinned = sorted(line.strip() for line in lines if line.strip() and not line.startswith("#"))
    project = tomllib.loads((API / "pyproject.toml").read_text(encoding="utf-8"))["project"]
    assert sorted(project["dependencies"]) == pinned
    assert [_name(r) for r in pinned]
