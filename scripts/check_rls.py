"""Proves the RLS rules against the real Supabase project with 3 real users:
teacher (owner), student member, student outsider. Creates a throwaway lesson and deletes it.

Usage: npm run seed:dev  (once)  then  npm run check:rls
"""

import asyncio
import secrets
import sys

import httpx
from _common import (
    STUDENT_EMAILS,
    TEACHER_EMAIL_DEFAULT,
    load_env,
    sign_in,
    user_headers,
)
from realtime import AsyncRealtimeClient, RealtimeSubscribeStates

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("OK   " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


class As:
    """PostgREST calls with one user's own token (RLS applies)."""

    def __init__(self, http: httpx.Client, env: dict[str, str], session: dict):
        self.http = http
        self.base = f"{env['SUPABASE_URL']}/rest/v1"
        self.h = user_headers(env, session["access_token"])
        self.id = session["user"]["id"]
        self.token = session["access_token"]

    def get(self, table: str, **params: str) -> httpx.Response:
        return self.http.get(f"{self.base}/{table}", params=params, headers=self.h)

    def post(self, table: str, json, prefer: str = "return=representation") -> httpx.Response:
        return self.http.post(
            f"{self.base}/{table}", json=json, headers={**self.h, "Prefer": prefer}
        )

    def patch(self, table: str, params: dict, json) -> httpx.Response:
        return self.http.patch(
            f"{self.base}/{table}",
            params=params,
            json=json,
            headers={**self.h, "Prefer": "return=representation"},
        )

    def rpc(self, fn: str, **args) -> httpx.Response:
        return self.http.post(f"{self.base}/rpc/{fn}", json=args, headers=self.h)


def rows(res: httpx.Response) -> list:
    return res.json() if res.status_code == 200 else []


def denied_or_empty(res: httpx.Response) -> bool:
    return res.status_code >= 400 or res.json() == []


async def broadcast_check(
    env: dict[str, str], lesson_id: str, teacher: As, member: As, outsider: As
):
    url = f"{env['SUPABASE_URL']}/realtime/v1"
    topic = f"lesson:{lesson_id}"
    received: dict[str, list] = {"member": [], "outsider": []}
    states: dict[str, str] = {}
    clients = []

    async def join(name: str, user: As, listen: bool):
        client = AsyncRealtimeClient(url, token=env["SUPABASE_ANON_KEY"], auto_reconnect=False)
        await client.connect()
        await client.set_auth(user.token)
        ch = client.channel(topic, {"config": {"private": True, "broadcast": {"self": False}}})
        if listen:
            ch.on_broadcast("utterance", lambda p, n=name: received[n].append(p))
        done = asyncio.Event()

        def on_state(state: RealtimeSubscribeStates, err):
            states[name] = state.value if hasattr(state, "value") else str(state)
            done.set()

        await ch.subscribe(on_state)
        try:
            await asyncio.wait_for(done.wait(), 10)
        except TimeoutError:
            states[name] = "TIMEOUT"
        clients.append(client)
        return ch

    teacher_ch = await join("teacher", teacher, listen=False)
    await join("member", member, listen=True)
    await join("outsider", outsider, listen=True)
    await asyncio.sleep(1)
    await teacher_ch.send_broadcast("utterance", {"seq": 99, "text": "rls-check"})
    await asyncio.sleep(3)

    check(
        "realtime: teacher joins private channel",
        "SUBSCRIBED" in states.get("teacher", ""),
        states.get("teacher", ""),
    )
    check(
        "realtime: member joins private channel",
        "SUBSCRIBED" in states.get("member", ""),
        states.get("member", ""),
    )
    check(
        "realtime: member receives the broadcast",
        len(received["member"]) == 1,
        str(received["member"]),
    )
    check(
        "realtime: outsider is refused and receives nothing",
        "SUBSCRIBED" not in states.get("outsider", "") and not received["outsider"],
        f"{states.get('outsider')} {received['outsider']}",
    )
    for c in clients:
        await c.close()


def main() -> None:
    env = load_env()
    password = env.get("DEV_USERS_PASSWORD") or sys.exit("Defina DEV_USERS_PASSWORD no .env.")
    teacher_email = env.get("DEV_TEACHER_EMAIL", TEACHER_EMAIL_DEFAULT).lower()

    with httpx.Client(timeout=30) as http:
        teacher = As(http, env, sign_in(http, env, teacher_email, password))
        member = As(http, env, sign_in(http, env, STUDENT_EMAILS[0], password))
        outsider = As(http, env, sign_in(http, env, STUDENT_EMAILS[1], password))

        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
        res = teacher.post(
            "lessons", {"teacher_id": teacher.id, "title": "check_rls", "code": code}
        )
        if res.status_code != 201:
            sys.exit(f"Professor não conseguiu criar aula: {res.status_code} {res.text[:200]}")
        lesson_id = res.json()[0]["id"]

        try:
            check(
                "student cannot create a lesson",
                member.post(
                    "lessons", {"teacher_id": member.id, "title": "x", "code": "ZZZZZZ"}
                ).status_code
                >= 400,
            )
            check(
                "teacher inserts utterance",
                teacher.post(
                    "utterances", {"lesson_id": lesson_id, "seq": 1, "text": "oi turma"}
                ).status_code
                == 201,
            )
            check(
                "teacher inserts draft material",
                teacher.post(
                    "lesson_materials",
                    {"lesson_id": lesson_id, "kind": "resumo", "content": {"titulo": "x"}},
                ).status_code
                == 201,
            )

            for user in (member, outsider):
                have = {
                    r["purpose"]
                    for r in rows(user.get("consents", select="purpose", revoked_at="is.null"))
                }
                missing = [
                    {"user_id": user.id, "purpose": p}
                    for p in ("termos_uso", "tratamento_dados")
                    if p not in have
                ]
                if missing:
                    user.post("consents", missing)

            res = member.rpc("join_lesson", p_code=code.lower())
            check(
                "member joins with join_lesson",
                res.status_code == 200 and res.json() == lesson_id,
                res.text[:200],
            )

            check(
                "member reads utterances",
                len(rows(member.get("utterances", lesson_id=f"eq.{lesson_id}"))) == 1,
            )
            check(
                "outsider reads no utterances",
                rows(outsider.get("utterances", lesson_id=f"eq.{lesson_id}")) == [],
            )
            check(
                "outsider reads no lesson",
                rows(outsider.get("lessons", id=f"eq.{lesson_id}")) == [],
            )
            check(
                "member cannot insert utterance",
                member.post(
                    "utterances", {"lesson_id": lesson_id, "seq": 2, "text": "x"}
                ).status_code
                >= 400,
            )

            pseudo = member.rpc("current_pseudonym").json()
            check(
                "member inserts own term_event",
                member.post(
                    "term_events",
                    {
                        "lesson_id": lesson_id,
                        "pseudonym_id": pseudo,
                        "term_id": "commit",
                        "kind": "tap",
                    },
                    prefer="return=minimal",
                ).status_code
                == 201,
            )
            check(
                "outsider cannot insert term_event",
                outsider.post(
                    "term_events",
                    {
                        "lesson_id": lesson_id,
                        "pseudonym_id": outsider.rpc("current_pseudonym").json(),
                        "term_id": "git",
                        "kind": "tap",
                    },
                    prefer="return=minimal",
                ).status_code
                >= 400,
            )
            check("student does not read term_events", denied_or_empty(member.get("term_events")))
            check("teacher does not read term_events", denied_or_empty(teacher.get("term_events")))
            check("student reads only own profile", len(rows(member.get("profiles"))) == 1)
            check(
                "teacher reads only own profile (no student profiles)",
                [p["user_id"] for p in rows(teacher.get("profiles"))] == [teacher.id],
            )
            check(
                "teacher does not see member pseudonyms", rows(teacher.get("lesson_members")) == []
            )
            check(
                "student cannot change own role",
                member.patch(
                    "profiles", {"user_id": f"eq.{member.id}"}, {"role": "professor"}
                ).status_code
                >= 400,
            )
            check(
                "student cannot change own pseudonym",
                member.patch(
                    "profiles",
                    {"user_id": f"eq.{member.id}"},
                    {"pseudonym_id": "00000000-0000-0000-0000-000000000000"},
                ).status_code
                >= 400,
            )
            role = rows(member.get("profiles", select="role"))
            check("student is still 'estudante'", role == [{"role": "estudante"}], str(role))

            check(
                "member does not see draft material",
                rows(member.get("lesson_materials", lesson_id=f"eq.{lesson_id}")) == [],
            )
            teacher.patch(
                "lesson_materials", {"lesson_id": f"eq.{lesson_id}"}, {"status": "aprovado"}
            )
            check(
                "member sees approved material",
                len(rows(member.get("lesson_materials", lesson_id=f"eq.{lesson_id}"))) == 1,
            )
            check(
                "outsider does not see approved material",
                rows(outsider.get("lesson_materials", lesson_id=f"eq.{lesson_id}")) == [],
            )

            count = teacher.rpc("lesson_member_count", p_lesson_id=lesson_id)
            check(
                "teacher gets member count",
                count.status_code == 200 and count.json() == 1,
                count.text[:100],
            )
            check(
                "student cannot get member count",
                member.rpc("lesson_member_count", p_lesson_id=lesson_id).status_code >= 400,
            )
            rep = teacher.rpc("lesson_term_report", p_lesson_id=lesson_id, p_min_students=1)
            check(
                "report omits terms with < 3 students (even if asked for 1)",
                rep.status_code == 200 and rep.json() == [],
                rep.text[:200],
            )
            check(
                "student cannot read the report",
                member.rpc("lesson_term_report", p_lesson_id=lesson_id).status_code >= 400,
            )
            check("student cannot purge", member.rpc("purge_expired_utterances").status_code >= 400)

            asyncio.run(broadcast_check(env, lesson_id, teacher, member, outsider))
        finally:
            http.delete(
                f"{teacher.base}/lessons", params={"id": f"eq.{lesson_id}"}, headers=teacher.h
            )

    print(f"\n{len(failures)} falha(s).")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
