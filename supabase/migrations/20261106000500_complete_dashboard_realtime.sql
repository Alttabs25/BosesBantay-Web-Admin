-- Ensure every table that feeds an officer dashboard can emit Postgres Changes.
-- RLS still determines which rows each authenticated role may receive.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users',
    'documents',
    'audit_logs',
    'bb_blotter_events',
    'bb_service_events',
    'emergency_contacts'
  ] loop
    if to_regclass('public.' || table_name) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
