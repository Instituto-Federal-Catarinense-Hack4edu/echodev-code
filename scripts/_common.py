"""Shared helpers for admin scripts (reads the root .env; never used by the API)."""

import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
TEACHER_EMAIL_DEFAULT = "professor.teste@echodev.test"
STUDENT_EMAILS = [f"estudante{i}.teste@echodev.test" for i in range(1, 9)]


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
    env.update({k: v for k, v in os.environ.items() if k.startswith(("SUPABASE_", "DEV_"))})
    missing = [
        k
        for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
        if not env.get(k)
    ]
    if missing:
        sys.exit(f"Faltam variáveis no .env da raiz: {', '.join(missing)} (veja .env.example).")
    env["SUPABASE_URL"] = env["SUPABASE_URL"].rstrip("/")
    return env


def service_headers(env: dict[str, str]) -> dict[str, str]:
    # Secret keys are not JWTs: send them only on the apikey header.
    return {"apikey": env["SUPABASE_SERVICE_ROLE_KEY"]}


def user_headers(env: dict[str, str], token: str) -> dict[str, str]:
    return {"apikey": env["SUPABASE_ANON_KEY"], "Authorization": f"Bearer {token}"}


def sign_in(http: httpx.Client, env: dict[str, str], email: str, password: str) -> dict:
    res = http.post(
        f"{env['SUPABASE_URL']}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": env["SUPABASE_ANON_KEY"]},
        json={"email": email, "password": password},
    )
    if res.status_code != 200:
        sys.exit(f"Login falhou para {email}: {res.status_code} {res.text[:200]}")
    return res.json()
