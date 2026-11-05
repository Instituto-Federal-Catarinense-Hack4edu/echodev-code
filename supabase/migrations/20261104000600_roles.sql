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
