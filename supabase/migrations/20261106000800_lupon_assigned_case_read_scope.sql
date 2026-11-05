-- Lupon members retain read access to every case assigned to them, including
-- completed cases needed by their assigned-case summaries. Mutation remains
-- constrained to active investigation by the existing update policies/RPC.
drop policy if exists bb_pre_blotter_read on public.pre_blotters;
create policy bb_pre_blotter_read on public.pre_blotters for select to authenticated using (
  user_id=auth.uid()
  or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('sinuri','under review','pending')))
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and public.bb_case_assigned_to_me('pre_blotters',reference_no))
);

drop policy if exists bb_reports_read on public.reports;
create policy bb_reports_read on public.reports for select to authenticated using (
  user_id=auth.uid()
  or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('sinuri','under review','pending')))
  or (public.bb_current_role()='Lupong Tagapamayapa Member'
    and coalesce(full_details->>'type','service_complaint')='blotter'
    and public.bb_case_assigned_to_me('reports',reference_no))
);

notify pgrst,'reload schema';
