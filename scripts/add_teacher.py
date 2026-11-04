"""Authorizes an e-mail as teacher: adds it to teacher_allowlist and, if the account already
exists, promotes its profile to 'professor' right away.

Usage: npm run teacher:add -- pessoa@escola.edu.br
The person then signs up (or signs in) with that e-mail on /entrar.
"""

import re
import sys

import httpx
from _common import load_env, service_headers

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def find_user_id(http: httpx.Client, env: dict[str, str], email: str) -> str | None:
    page = 1
    while True:
        res = http.get(
            f"{env['SUPABASE_URL']}/auth/v1/admin/users",
            params={"page": page, "per_page": 200},
            headers=service_headers(env),
        )
        res.raise_for_status()
        users = res.json().get("users", [])
        for u in users:
            if (u.get("email") or "").lower() == email:
                return u["id"]
        if len(users) < 200:
            return None
        page += 1


def main() -> None:
    if len(sys.argv) != 2 or not EMAIL_RE.match(sys.argv[1].strip()):
        sys.exit("Uso: npm run teacher:add -- pessoa@escola.edu.br")
    email = sys.argv[1].strip().lower()
    env = load_env()
    base = env["SUPABASE_URL"]

    with httpx.Client(timeout=30) as http:
        res = http.post(
            f"{base}/rest/v1/teacher_allowlist",
            headers={**service_headers(env), "Prefer": "resolution=ignore-duplicates"},
            json={"email": email},
        )
        if res.status_code >= 400:
            sys.exit(f"Erro ao cadastrar ({res.status_code}): {res.text[:300]}")

        uid = find_user_id(http, env, email)
        if uid:
            http.patch(
                f"{base}/rest/v1/profiles",
                params={"user_id": f"eq.{uid}"},
                headers=service_headers(env),
                json={"role": "professor"},
            ).raise_for_status()
            print(f"{email} já tinha conta e agora é professor. É só entrar em /entrar.")
        else:
            print(
                f"{email} autorizado como professor. Crie a conta em /entrar (aba 'Criar conta')."
            )


if __name__ == "__main__":
    main()
