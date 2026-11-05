-- Latest access-control decision: Kagawad notification access is read-only.
-- Committee-scoped notification rows remain visible through the existing
-- SELECT policy, but direct inserts are limited to authorized broadcasters.
drop policy if exists bb_notifications_insert on public.notifications;
create policy bb_notifications_insert
on public.notifications for insert to authenticated
with check (public.bb_current_role() in (
  'System Administrator',
  'Barangay Secretary',
  'Punong Barangay (Barangay Captain)'
));

notify pgrst, 'reload schema';
