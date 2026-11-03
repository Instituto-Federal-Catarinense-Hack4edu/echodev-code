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
