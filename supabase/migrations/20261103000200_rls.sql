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
