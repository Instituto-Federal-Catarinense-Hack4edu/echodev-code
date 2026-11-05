-- EchoDev: bundle gerado por `npm run db:bundle`. Não edite à mão.
-- Cole este arquivo inteiro no SQL Editor do Supabase.

-- ===== 20261103000100_schema.sql =====
-- EchoDev schema. RLS is enabled on every table in the same migration that creates it.

create table public.teacher_allowlist (
  email text primary key check (email = lower(email))
);
alter table public.teacher_allowlist enable row level security;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pseudonym_id uuid not null unique default gen_random_uuid(),
  role text not null default 'estudante' check (role in ('professor', 'estudante')),
  depth_pref text not null default 'curta' check (depth_pref in ('curta', 'exemplo', 'passos')),
  lang_pref text not null default 'pt' check (lang_pref in ('pt', 'en', 'es')),
  mode text not null default 'padrao' check (mode in ('padrao', 'calmo')),
  literal_mode boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null
    check (purpose in ('termos_uso', 'tratamento_dados', 'doacao_lexico', 'doacao_sinais')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index consents_one_active_per_purpose
  on public.consents (user_id, purpose) where revoked_at is null;
alter table public.consents enable row level security;

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  status text not null default 'criada' check (status in ('criada', 'ao_vivo', 'encerrada')),
  pack_ids text[] not null default array['programacao-geral'],
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index lessons_teacher_idx on public.lessons (teacher_id, created_at desc);
alter table public.lessons enable row level security;

create table public.lesson_members (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  pseudonym_id uuid not null references public.profiles (pseudonym_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (lesson_id, pseudonym_id)
);
create index lesson_members_pseudonym_idx on public.lesson_members (pseudonym_id);
alter table public.lesson_members enable row level security;

create table public.utterances (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  seq integer not null check (seq > 0),
  text text not null check (char_length(text) <= 5000),
  terms jsonb not null default '[]'::jsonb check (jsonb_typeof(terms) = 'array'),
  wpm integer not null default 0 check (wpm >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (lesson_id, seq)
);
create index utterances_expires_idx on public.utterances (expires_at);
alter table public.utterances enable row level security;

create table public.term_events (
  id bigint generated always as identity primary key,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  pseudonym_id uuid not null references public.profiles (pseudonym_id) on delete cascade,
  term_id text not null check (char_length(term_id) between 1 and 64),
  kind text not null check (kind in ('tap', 'doubt', 'helped', 'not_helped')),
  depth text check (depth is null or depth in ('curta', 'exemplo', 'passos')),
  created_at timestamptz not null default now()
);
create index term_events_lesson_idx on public.term_events (lesson_id, term_id);
create index term_events_pseudonym_idx on public.term_events (pseudonym_id);
alter table public.term_events enable row level security;

create table public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  kind text not null check (kind in ('resumo', 'quiz')),
  content jsonb not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'descartado')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, kind)
);
alter table public.lesson_materials enable row level security;

create table public.lesson_reports (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.lesson_reports enable row level security;

-- Pairs only, no personal data (no author column on purpose).
create table public.term_corrections (
  id bigint generated always as identity primary key,
  term_id text not null check (char_length(term_id) between 1 and 64),
  heard text not null check (char_length(heard) between 1 and 80),
  correct text not null check (char_length(correct) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table public.term_corrections enable row level security;

-- ===== 20261103000200_rls.sql =====
-- Helper functions used by policies. SECURITY DEFINER with an empty search_path and
-- fully qualified names, so policies never select across RLS-protected tables (no recursion).

create or replace function public.current_pseudonym()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.pseudonym_id from public.profiles p where p.user_id = auth.uid()
$$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'professor')
$$;

create or replace function public.is_lesson_owner(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lessons l where l.id = p_lesson_id and l.teacher_id = auth.uid())
$$;

create or replace function public.is_lesson_member(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lesson_members m
    where m.lesson_id = p_lesson_id
      and m.pseudonym_id = (select p.pseudonym_id from public.profiles p where p.user_id = auth.uid())
  )
$$;

revoke all on function public.current_pseudonym() from public, anon;
revoke all on function public.is_teacher() from public, anon;
revoke all on function public.is_lesson_owner(uuid) from public, anon;
revoke all on function public.is_lesson_member(uuid) from public, anon;
grant execute on function public.current_pseudonym() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.is_lesson_owner(uuid) to authenticated;
grant execute on function public.is_lesson_member(uuid) to authenticated;

-- Table privileges: nothing for anon; minimal, explicit privileges for authenticated.
revoke all on public.teacher_allowlist, public.profiles, public.consents, public.lessons,
  public.lesson_members, public.utterances, public.term_events, public.lesson_materials,
  public.lesson_reports, public.term_corrections from anon, authenticated;

-- teacher_allowlist: no access from the app (SQL Editor / service role only).

-- profiles: read and update only your own preferences. role and pseudonym_id are never
-- writable (no column grant); rows are created by the auth trigger.
grant select on public.profiles to authenticated;
grant update (depth_pref, lang_pref, mode, literal_mode) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- consents: own rows only; grant, revoke (set revoked_at) and read.
grant select, insert on public.consents to authenticated;
grant update (revoked_at) on public.consents to authenticated;
create policy consents_select_own on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()) and revoked_at is null);
create policy consents_update_own on public.consents
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- lessons: teachers create their own; owner and members read; owner updates.
grant select, insert, delete on public.lessons to authenticated;
grant update (title, status, pack_ids, started_at, ended_at) on public.lessons to authenticated;
create policy lessons_select on public.lessons
  for select to authenticated
  using (teacher_id = (select auth.uid()) or public.is_lesson_member(id));
create policy lessons_insert on public.lessons
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.is_teacher() and status = 'criada');
create policy lessons_update on public.lessons
  for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy lessons_delete on public.lessons
  for delete to authenticated using (teacher_id = (select auth.uid()));

-- lesson_members: insert only through join_lesson(); a student sees only their own row.
-- The teacher never sees pseudonyms (uses lesson_member_count()).
grant select on public.lesson_members to authenticated;
create policy lesson_members_select_own on public.lesson_members
  for select to authenticated using (pseudonym_id = public.current_pseudonym());

-- utterances: owner inserts and reads; members read. Expired rows are hidden even before purge.
grant select, insert on public.utterances to authenticated;
create policy utterances_select on public.utterances
  for select to authenticated
  using (
    expires_at > now()
    and (public.is_lesson_owner(lesson_id) or public.is_lesson_member(lesson_id))
  );
create policy utterances_insert on public.utterances
  for insert to authenticated with check (public.is_lesson_owner(lesson_id));

-- term_events: a member inserts with their own pseudonym. Nobody selects (aggregates only).
grant insert on public.term_events to authenticated;
create policy term_events_insert_own on public.term_events
  for insert to authenticated
  with check (pseudonym_id = public.current_pseudonym() and public.is_lesson_member(lesson_id));

-- lesson_materials: owner does everything; members read only approved material.
grant select, insert, delete on public.lesson_materials to authenticated;
grant update (content, status, approved_at, updated_at) on public.lesson_materials to authenticated;
create policy lesson_materials_owner_all on public.lesson_materials
  for all to authenticated
  using (public.is_lesson_owner(lesson_id)) with check (public.is_lesson_owner(lesson_id));
create policy lesson_materials_member_approved on public.lesson_materials
  for select to authenticated
  using (status = 'aprovado' and public.is_lesson_member(lesson_id));

-- lesson_reports: owner reads and writes (snapshot without transcript text).
grant select, insert, update on public.lesson_reports to authenticated;
create policy lesson_reports_owner on public.lesson_reports
  for all to authenticated
  using (public.is_lesson_owner(lesson_id)) with check (public.is_lesson_owner(lesson_id));

-- term_corrections: teachers insert and read (to extend their dictionary).
grant select, insert on public.term_corrections to authenticated;
create policy term_corrections_teacher_select on public.term_corrections
  for select to authenticated using (public.is_teacher());
create policy term_corrections_teacher_insert on public.term_corrections
  for insert to authenticated with check (public.is_teacher());

-- ===== 20261103000300_functions.sql =====
-- Auth trigger, lesson functions and aggregate reports. All SECURITY DEFINER functions
-- use set search_path = '' and fully qualified names.

-- New auth user -> profile. role = 'professor' only when the e-mail is on the allowlist.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, role)
  values (
    new.id,
    case when exists (
      select 1 from public.teacher_allowlist a where a.email = lower(coalesce(new.email, ''))
    ) then 'professor' else 'estudante' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Join a lesson by its short code. Requires a session, the two mandatory consents and a
-- lesson that is not over. Returns the lesson id.
create or replace function public.join_lesson(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_pseudonym uuid;
  v_lesson public.lessons%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select p.pseudonym_id into v_pseudonym from public.profiles p where p.user_id = auth.uid();
  if v_pseudonym is null then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if (
    select count(distinct c.purpose) from public.consents c
    where c.user_id = auth.uid() and c.revoked_at is null
      and c.purpose in ('termos_uso', 'tratamento_dados')
  ) < 2 then
    raise exception 'consent_required' using errcode = '42501';
  end if;
  select * into v_lesson from public.lessons l where l.code = upper(trim(p_code));
  if not found then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;
  if v_lesson.status = 'encerrada' then
    raise exception 'lesson_ended' using errcode = '55000';
  end if;
  insert into public.lesson_members (lesson_id, pseudonym_id)
  values (v_lesson.id, v_pseudonym)
  on conflict do nothing;
  return v_lesson.id;
end;
$$;
revoke all on function public.join_lesson(text) from public, anon;
grant execute on function public.join_lesson(text) to authenticated;

-- Number of students in the lesson (owner only).
create or replace function public.lesson_member_count(p_lesson_id uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.lessons l where l.id = p_lesson_id and l.teacher_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (select count(*)::integer from public.lesson_members m where m.lesson_id = p_lesson_id);
end;
$$;
revoke all on function public.lesson_member_count(uuid) from public, anon;
grant execute on function public.lesson_member_count(uuid) to authenticated;

-- Per-term aggregates (owner only). Terms touched by fewer than p_min_students distinct
-- students are omitted. The minimum is never below 3, whatever the caller passes.
create or replace function public.lesson_term_report(p_lesson_id uuid, p_min_students integer default 3)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_min integer := greatest(coalesce(p_min_students, 3), 3);
begin
  if not exists (select 1 from public.lessons l where l.id = p_lesson_id and l.teacher_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.taps desc, r.term_id)
    from (
      select
        e.term_id,
        count(*) filter (where e.kind = 'tap')::integer as taps,
        count(distinct e.pseudonym_id)::integer as students,
        count(*) filter (where e.kind = 'doubt')::integer as doubts,
        count(*) filter (where e.kind = 'helped')::integer as helped,
        count(*) filter (where e.kind = 'not_helped')::integer as not_helped
      from public.term_events e
      where e.lesson_id = p_lesson_id
      group by e.term_id
      having count(distinct e.pseudonym_id) >= v_min
    ) r
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.lesson_term_report(uuid, integer) from public, anon;
grant execute on function public.lesson_term_report(uuid, integer) to authenticated;

-- Deletes expired transcript lines. Called by pg_cron or POST /cron/purge (service role).
create or replace function public.purge_expired_utterances()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  delete from public.utterances u where u.expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_expired_utterances() from public, anon, authenticated;
grant execute on function public.purge_expired_utterances() to service_role;

-- "Delete my data": removes the caller's events, memberships and consents. The auth account
-- itself is deleted afterwards by the API (needs the service role); profile cascades.
create or replace function public.delete_my_data()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pseudonym uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select p.pseudonym_id into v_pseudonym from public.profiles p where p.user_id = auth.uid();
  delete from public.term_events e where e.pseudonym_id = v_pseudonym;
  delete from public.lesson_members m where m.pseudonym_id = v_pseudonym;
  delete from public.consents c where c.user_id = auth.uid();
end;
$$;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

-- ===== 20261103000400_realtime.sql =====
-- Realtime Broadcast authorization for private channels "lesson:<uuid>".
-- RLS is already enabled on realtime.messages by Supabase (do not alter the table).
-- Only the lesson owner may send; owner and members may receive.
-- Also turn OFF "Allow public access" in Realtime Settings (see docs/SETUP_MANUAL.md).

create or replace function public.lesson_id_from_topic(p_topic text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when p_topic ~ '^lesson:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substr(p_topic, 8)::uuid
    else null
  end
$$;
grant execute on function public.lesson_id_from_topic(text) to authenticated;

drop policy if exists echodev_lesson_receive on realtime.messages;
create policy echodev_lesson_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast')
    and (
      public.is_lesson_owner(public.lesson_id_from_topic((select realtime.topic())))
      or public.is_lesson_member(public.lesson_id_from_topic((select realtime.topic())))
    )
  );

drop policy if exists echodev_lesson_send on realtime.messages;
create policy echodev_lesson_send on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast')
    and public.is_lesson_owner(public.lesson_id_from_topic((select realtime.topic())))
  );

-- ===== 20261103000500_cron.sql =====
-- Hourly purge of expired utterances with pg_cron, only if the extension can be used.
-- Plan B (no pg_cron): an external scheduler calls POST /cron/purge on the Python API.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron not available (%); use POST /cron/purge instead', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'echodev-purge-utterances',
      '17 * * * *',
      'select public.purge_expired_utterances()'
    );
  end if;
end;
$$;

-- ===== 20261104000600_roles.sql =====
-- One e-mail, one role: a teacher account never takes part in a lesson as a student.

create or replace function public.join_lesson(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_pseudonym uuid;
  v_role text;
  v_lesson public.lessons%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select p.pseudonym_id, p.role into v_pseudonym, v_role from public.profiles p where p.user_id = auth.uid();
  if v_pseudonym is null then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if v_role = 'professor' then
    raise exception 'teacher_cannot_join' using errcode = '42501';
  end if;
  if (
    select count(distinct c.purpose) from public.consents c
    where c.user_id = auth.uid() and c.revoked_at is null
      and c.purpose in ('termos_uso', 'tratamento_dados')
  ) < 2 then
    raise exception 'consent_required' using errcode = '42501';
  end if;
  select * into v_lesson from public.lessons l where l.code = upper(trim(p_code));
  if not found then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;
  if v_lesson.status = 'encerrada' then
    raise exception 'lesson_ended' using errcode = '55000';
  end if;
  insert into public.lesson_members (lesson_id, pseudonym_id)
  values (v_lesson.id, v_pseudonym)
  on conflict do nothing;
  return v_lesson.id;
end;
$$;
revoke all on function public.join_lesson(text) from public, anon;
grant execute on function public.join_lesson(text) to authenticated;

-- When an account becomes a teacher, its student traces go away (keeps the two roles apart).
create or replace function public.clear_student_data_on_promotion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'professor' and old.role is distinct from 'professor' then
    delete from public.term_events e where e.pseudonym_id = new.pseudonym_id;
    delete from public.lesson_members m where m.pseudonym_id = new.pseudonym_id;
  end if;
  return new;
end;
$$;
revoke all on function public.clear_student_data_on_promotion() from public, anon, authenticated;

drop trigger if exists on_profile_promoted on public.profiles;
create trigger on_profile_promoted
  after update of role on public.profiles
  for each row execute function public.clear_student_data_on_promotion();

-- Existing teacher accounts that had joined lessons as students.
delete from public.term_events e
using public.profiles p
where p.pseudonym_id = e.pseudonym_id and p.role = 'professor';
delete from public.lesson_members m
using public.profiles p
where p.pseudonym_id = m.pseudonym_id and p.role = 'professor';
