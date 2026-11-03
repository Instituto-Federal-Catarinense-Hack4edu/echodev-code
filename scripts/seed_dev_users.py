"""Creates 1 test teacher and 8 test students with confirmed e-mails (development only).

Usage: npm run seed:dev   (needs SUPABASE_* and DEV_USERS_PASSWORD in the root .env)
Idempotent: existing users get their password reset to DEV_USERS_PASSWORD.
"""

import sys

import httpx
from _common import STUDENT_EMAILS, TEACHER_EMAIL_DEFAULT, load_env, service_headers


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
    env = load_env()
    password = env.get("DEV_USERS_PASSWORD", "")
    if len(password) < 12:
        sys.exit("Defina DEV_USERS_PASSWORD (12+ caracteres) no .env da raiz.")
    teacher = env.get("DEV_TEACHER_EMAIL", TEACHER_EMAIL_DEFAULT).lower()
    base = env["SUPABASE_URL"]

    with httpx.Client(timeout=30) as http:
        # Allowlist first, so the auth trigger creates the profile as 'professor'.
        res = http.post(
            f"{base}/rest/v1/teacher_allowlist",
            headers={**service_headers(env), "Prefer": "resolution=ignore-duplicates"},
            json={"email": teacher},
        )
        if res.status_code >= 400:
            sys.exit(
                f"Erro na allowlist ({res.status_code}): {res.text[:300]}\n"
                "Você já colou supabase/bundle.sql no SQL Editor?"
            )

        for email in [teacher, *STUDENT_EMAILS]:
            res = http.post(
                f"{base}/auth/v1/admin/users",
                headers=service_headers(env),
                json={"email": email, "password": password, "email_confirm": True},
            )
            if res.status_code in (200, 201):
                print(f"criado     {email}")
                continue
            uid = find_user_id(http, env, email)
            if not uid:
                sys.exit(f"Falha ao criar {email}: {res.status_code} {res.text[:200]}")
            http.put(
                f"{base}/auth/v1/admin/users/{uid}",
                headers=service_headers(env),
                json={"password": password, "email_confirm": True},
            ).raise_for_status()
            print(f"atualizado {email}")

        # If the teacher existed before the allowlist row, fix the role (service role only).
        uid = find_user_id(http, env, teacher)
        http.patch(
            f"{base}/rest/v1/profiles",
            params={"user_id": f"eq.{uid}"},
            headers=service_headers(env),
            json={"role": "professor"},
        ).raise_for_status()

    print(f"\nPronto. Professor: {teacher}. Estudantes: {', '.join(STUDENT_EMAILS)}.")
    print("Senha de todos: DEV_USERS_PASSWORD do .env (login de desenvolvimento).")


if __name__ == "__main__":
    main()
