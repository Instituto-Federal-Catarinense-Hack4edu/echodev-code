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
