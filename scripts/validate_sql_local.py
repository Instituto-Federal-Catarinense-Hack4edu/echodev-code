# ruff: noqa: E501  (long inline SQL statements)
"""Applies supabase/bundle.sql to an embedded Postgres with minimal stubs of Supabase's
auth/realtime schemas and checks the RLS rules (no Docker, no Supabase project needed).

Usage: npm run db:bundle && npm run db:validate
The real-project equivalent is scripts/check_rls.py (npm run check:rls).
"""

import sys
import tempfile
import uuid
from pathlib import Path

import pgserver
import psycopg

ROOT = Path(__file__).resolve().parent.parent
bundle = (ROOT / "supabase" / "bundle.sql").read_text(encoding="utf-8")
datadir = Path(tempfile.gettempdir()) / "echodev-pgserver"
srv = pgserver.get_server(datadir, cleanup_mode="stop")
uri = srv.get_uri()

STUBS = """
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; drop schema if exists realtime cascade;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema realtime; grant usage on schema realtime to authenticated, anon;
create table realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb);
alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to authenticated;
grant usage on sequence realtime.messages_id_seq to authenticated;
create function realtime.topic() returns text language sql stable as
  $$ select current_setting('realtime.topic', true) $$;
grant execute on function realtime.topic() to authenticated;
"""

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("OK   " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        fails += 1


with psycopg.connect(uri, autocommit=True) as c:
    c.execute(STUBS)
    c.execute(bundle)
    print("bundle applied")
    c.execute("select public.purge_expired_utterances()")
    teacher, member, outsider = (uuid.uuid4() for _ in range(3))
    c.execute("insert into public.teacher_allowlist values ('prof@x.test')")
    for uid, email in [(teacher, "Prof@x.test"), (member, "a@x.test"), (outsider, "b@x.test")]:
        c.execute("insert into auth.users values (%s, %s)", (uid, email))
    roles = dict(c.execute("select user_id, role from public.profiles").fetchall())
    check(
        "trigger creates profiles with allowlist role",
        roles[teacher] == "professor" and roles[member] == "estudante",
    )

    def as_user(uid, sql, params=(), topic=None):
        with c.transaction():
            c.execute("set local role authenticated")
            c.execute("select set_config('request.jwt.claim.sub', %s, true)", (str(uid),))
            if topic:
                c.execute("select set_config('realtime.topic', %s, true)", (topic,))
            cur = c.execute(sql, params)
            return cur.fetchall() if cur.description else None

    def fails_as(uid, sql, params=(), topic=None):
        try:
            as_user(uid, sql, params, topic)
            return False
        except psycopg.Error:
            return True

    lesson = as_user(
        teacher,
        "insert into public.lessons (teacher_id, title, code) values (%s, 'Git', 'ABC234') returning id",
        (teacher,),
    )[0][0]
    check(
        "student cannot create lesson",
        fails_as(
            member,
            "insert into public.lessons (teacher_id, title, code) values (%s, 'x', 'XYZ234')",
            (member,),
        ),
    )
    as_user(
        teacher,
        "insert into public.utterances (lesson_id, seq, text) values (%s, 1, 'oi')",
        (lesson,),
    )
    as_user(
        teacher,
        "insert into public.lesson_materials (lesson_id, kind, content) values (%s, 'resumo', '{}')",
        (lesson,),
    )

    check("join requires consent", fails_as(member, "select public.join_lesson('abc234')"))
    as_user(
        member,
        "insert into public.consents (user_id, purpose) values (%s, 'termos_uso'), (%s, 'tratamento_dados')",
        (member, member),
    )
    joined = as_user(member, "select public.join_lesson(' abc234 ')")[0][0]
    check("join_lesson returns lesson id", joined == lesson)
    check("invalid code rejected", fails_as(member, "select public.join_lesson('ZZZZZZ')"))

    check("member reads utterances", len(as_user(member, "select * from public.utterances")) == 1)
    check(
        "outsider reads no utterances",
        len(as_user(outsider, "select * from public.utterances")) == 0,
    )
    check("outsider reads no lessons", len(as_user(outsider, "select * from public.lessons")) == 0)
    check(
        "member cannot insert utterance",
        fails_as(
            member,
            "insert into public.utterances (lesson_id, seq, text) values (%s, 2, 'x')",
            (lesson,),
        ),
    )

    pseudo_m = as_user(member, "select public.current_pseudonym()")[0][0]
    as_user(
        member,
        "insert into public.term_events (lesson_id, pseudonym_id, term_id, kind) values (%s, %s, 'commit', 'tap')",
        (lesson, pseudo_m),
    )
    pseudo_t = as_user(teacher, "select public.current_pseudonym()")[0][0]
    check(
        "cannot insert event with another pseudonym",
        fails_as(
            member,
            "insert into public.term_events (lesson_id, pseudonym_id, term_id, kind) values (%s, %s, 'git', 'tap')",
            (lesson, pseudo_t),
        ),
    )
    check(
        "outsider cannot insert event",
        fails_as(
            outsider,
            "insert into public.term_events (lesson_id, pseudonym_id, term_id, kind) values (%s, public.current_pseudonym(), 'git', 'tap')",
            (lesson,),
        ),
    )
    check("student cannot select term_events", fails_as(member, "select * from public.term_events"))
    check(
        "teacher cannot select term_events", fails_as(teacher, "select * from public.term_events")
    )
    check(
        "student sees only own profile", len(as_user(member, "select * from public.profiles")) == 1
    )
    check(
        "teacher sees only own profile", len(as_user(teacher, "select * from public.profiles")) == 1
    )
    check(
        "teacher does not see member pseudonyms",
        len(as_user(teacher, "select * from public.lesson_members")) == 0,
    )
    check(
        "student cannot change role",
        fails_as(
            member, "update public.profiles set role = 'professor' where user_id = %s", (member,)
        ),
    )
    check(
        "student cannot change pseudonym",
        fails_as(
            member,
            "update public.profiles set pseudonym_id = gen_random_uuid() where user_id = %s",
            (member,),
        ),
    )
    as_user(member, "update public.profiles set lang_pref = 'es' where user_id = %s", (member,))
    check(
        "student can change prefs",
        as_user(member, "select lang_pref from public.profiles")[0][0] == "es",
    )

    check(
        "member does not see draft material",
        len(as_user(member, "select * from public.lesson_materials")) == 0,
    )
    as_user(
        teacher,
        "update public.lesson_materials set status = 'aprovado' where lesson_id = %s",
        (lesson,),
    )
    check(
        "member sees approved material",
        len(as_user(member, "select * from public.lesson_materials")) == 1,
    )
    check(
        "outsider does not see approved material",
        len(as_user(outsider, "select * from public.lesson_materials")) == 0,
    )

    check(
        "teacher member count",
        as_user(teacher, "select public.lesson_member_count(%s)", (lesson,))[0][0] == 1,
    )
    check(
        "student cannot count members",
        fails_as(member, "select public.lesson_member_count(%s)", (lesson,)),
    )
    check(
        "report omits terms below 3 students",
        as_user(teacher, "select public.lesson_term_report(%s, 1)", (lesson,))[0][0] == [],
    )
    check(
        "student cannot read report",
        fails_as(member, "select public.lesson_term_report(%s)", (lesson,)),
    )
    check("student cannot purge", fails_as(member, "select public.purge_expired_utterances()"))

    topic = f"lesson:{lesson}"
    recv = "select count(*) from realtime.messages"
    c.execute("insert into realtime.messages (topic, extension) values (%s, 'broadcast')", (topic,))
    check("teacher can receive", as_user(teacher, recv, topic=topic)[0][0] == 1)
    check("member can receive", as_user(member, recv, topic=topic)[0][0] == 1)
    check("outsider cannot receive", as_user(outsider, recv, topic=topic)[0][0] == 0)
    send = "insert into realtime.messages (topic, extension) values (%s, 'broadcast')"
    check("teacher can send", not fails_as(teacher, send, (topic,), topic=topic))
    check("member cannot send", fails_as(member, send, (topic,), topic=topic))
    check("garbage topic denied", as_user(member, recv, topic="lesson:x' or 1=1")[0][0] == 0)

    as_user(member, "select public.delete_my_data()")
    check(
        "delete_my_data clears consents", len(as_user(member, "select * from public.consents")) == 0
    )
    as_user(teacher, "update public.lessons set status = 'encerrada' where id = %s", (lesson,))
    as_user(
        outsider,
        "insert into public.consents (user_id, purpose) values (%s, 'termos_uso'), (%s, 'tratamento_dados')",
        (outsider, outsider),
    )
    check("ended lesson rejects join", fails_as(outsider, "select public.join_lesson('ABC234')"))

    lesson2 = as_user(
        teacher,
        "insert into public.lessons (teacher_id, title, code) values (%s, 'Aula 2', 'DEF234') returning id",
        (teacher,),
    )[0][0]
    try:
        as_user(teacher, "select public.join_lesson('DEF234')")
        teacher_join = "joined"
    except psycopg.Error as exc:
        teacher_join = str(exc)
    check(
        "teacher account cannot join as student",
        "teacher_cannot_join" in teacher_join,
        teacher_join,
    )

    as_user(outsider, "select public.join_lesson('DEF234')")
    p_out = as_user(outsider, "select public.current_pseudonym()")[0][0]
    as_user(
        outsider,
        "insert into public.term_events (lesson_id, pseudonym_id, term_id, kind) values (%s, %s, 'git', 'tap')",
        (lesson2, p_out),
    )
    c.execute("update public.profiles set role = 'professor' where user_id = %s", (outsider,))
    left = c.execute(
        "select (select count(*) from public.lesson_members where pseudonym_id = %s)"
        " + (select count(*) from public.term_events where pseudonym_id = %s)",
        (p_out, p_out),
    ).fetchone()[0]
    check("promotion to teacher removes student traces", left == 0, str(left))

print("FAILURES:", fails)
sys.exit(1 if fails else 0)
