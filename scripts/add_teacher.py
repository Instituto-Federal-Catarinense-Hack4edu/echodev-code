"""Authorizes an e-mail as teacher: adds it to teacherAllowlist and, if the account already
exists, promotes its profile to 'professor' right away (removing any student traces).

Usage: npm run teacher:add -- pessoa@escola.edu.br [--emulators]
The person then signs up (or signs in) with that e-mail on /entrar.
"""

import re
import sys

from _common import clear_student_traces, ensure_profile, find_uid, init, load_env

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--emulators"]
    if len(args) != 1 or not EMAIL_RE.match(args[0].strip()):
        sys.exit("Uso: npm run teacher:add -- pessoa@escola.edu.br")
    email = args[0].strip().lower()
    db = init(load_env())
    db.collection("teacherAllowlist").document(email).set({"email": email})

    uid = find_uid(email)
    if uid:
        profile = ensure_profile(db, uid, "professor")
        clear_student_traces(db, profile.get("pseudonym_id"))
        print(f"{email} já tinha conta e agora é professor. É só entrar em /entrar.")
    else:
        print(f"{email} autorizado como professor. Crie a conta em /entrar (aba 'Criar conta').")


if __name__ == "__main__":
    main()
