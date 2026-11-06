"""Creates 1 test teacher and 8 test students with confirmed e-mails (development only).

Usage: npm run seed:dev            (real project: FIREBASE_* and DEV_USERS_PASSWORD in .env)
       npm run seed:dev -- --emulators   (local emulators)
Idempotent: existing users get their password reset to DEV_USERS_PASSWORD.
"""

import sys

from _common import (
    STUDENT_EMAILS,
    TEACHER_EMAIL_DEFAULT,
    clear_student_traces,
    ensure_profile,
    find_uid,
    init,
    load_env,
)
from firebase_admin import auth


def main() -> None:
    env = load_env()
    password = env.get("DEV_USERS_PASSWORD", "")
    if len(password) < 12:
        sys.exit("Defina DEV_USERS_PASSWORD (12+ caracteres) no .env da raiz.")
    teacher = env.get("DEV_TEACHER_EMAIL", TEACHER_EMAIL_DEFAULT).lower()
    db = init(env)
    db.collection("teacherAllowlist").document(teacher).set({"email": teacher})

    for email in [teacher, *STUDENT_EMAILS]:
        uid = find_uid(email)
        if uid:
            auth.update_user(uid, password=password, email_verified=True)
            print(f"atualizado {email}")
        else:
            uid = auth.create_user(email=email, password=password, email_verified=True).uid
            print(f"criado     {email}")
        role = "professor" if email == teacher else "estudante"
        profile = ensure_profile(db, uid, role)
        if role == "professor":
            clear_student_traces(db, profile.get("pseudonym_id"))

    print(f"\nPronto. Professor: {teacher}. Estudantes: {', '.join(STUDENT_EMAILS)}.")
    print("Senha de todos: DEV_USERS_PASSWORD do .env.")


if __name__ == "__main__":
    main()
