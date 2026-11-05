-- Detail-free realtime invalidation for role-scoped dashboards.
-- Report rows can become invisible after an Admin changes their status, so the
-- restricted client needs a safe signal telling it to refetch permitted data.
create table if not exists public.bb_dashboard_events (
  event_id bigint generated always as identity primary key,
  source_table text not null check (source_table in ('reports', 'pre_blotters', 'service_complaints')),
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  occurred_at timestamptz not null default clock_timestamp()
);

create index if not exists bb_dashboard_events_occurred_idx
  on public.bb_dashboard_events (occurred_at desc);

alter table public.bb_dashboard_events enable row level security;

drop policy if exists bb_dashboard_events_read on public.bb_dashboard_events;
create policy bb_dashboard_events_read
on public.bb_dashboard_events for select to authenticated
using (public.bb_current_role() in (
  'System Administrator', 'Barangay Secretary', 'Tanod / BPSO',
  'Sangguniang Barangay Kagawad', 'Punong Barangay (Barangay Captain)'
));

revoke insert, update, delete, truncate on public.bb_dashboard_events from anon, authenticated;
grant select on public.bb_dashboard_events to authenticated;

create or replace function public.bb_emit_dashboard_refresh()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.bb_dashboard_events(source_table, operation)
  values (tg_table_name, tg_op);

  -- These rows are invalidation signals, not an audit log.
  delete from public.bb_dashboard_events
  where occurred_at < clock_timestamp() - interval '14 days';

  return null;
end;
$$;

revoke all on function public.bb_emit_dashboard_refresh() from public;

drop trigger if exists bb_reports_dashboard_refresh on public.reports;
create trigger bb_reports_dashboard_refresh
after insert or update or delete on public.reports
for each statement execute function public.bb_emit_dashboard_refresh();

drop trigger if exists bb_pre_blotters_dashboard_refresh on public.pre_blotters;
create trigger bb_pre_blotters_dashboard_refresh
after insert or update or delete on public.pre_blotters
for each statement execute function public.bb_emit_dashboard_refresh();

drop trigger if exists bb_service_complaints_dashboard_refresh on public.service_complaints;
create trigger bb_service_complaints_dashboard_refresh
after insert or update or delete on public.service_complaints
for each statement execute function public.bb_emit_dashboard_refresh();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bb_dashboard_events'
  ) then
    alter publication supabase_realtime add table public.bb_dashboard_events;
  end if;
end
$$;

notify pgrst, 'reload schema';
