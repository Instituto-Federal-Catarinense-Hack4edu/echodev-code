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
