-- Private, read-only access for the staff roles that can view digital reports.
-- A photo must belong to a report visible to that staff member under report RLS.
create policy "Report staff read referenced photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'report_evidence'
  and exists (
    select 1 from public.users u join public.roles r on r.role_id=u.role_id
    where u.id=auth.uid() and r.role_name in (
      'Barangay Secretary','Barangay Captain','Punong Barangay',
      'System Administrator','Lupon Member','Lupong Tagapamayapa Member'
    )
  )
  and (
    exists (
      select 1 from public.reports r
      where r.full_details->'photoPaths' @> jsonb_build_array(storage.objects.name)
         or r.full_details->'photo_paths' @> jsonb_build_array(storage.objects.name)
    )
    or exists (
      select 1 from public.service_complaints c
      where c.image_url=storage.objects.name
         or c.image_url='report_evidence/' || storage.objects.name
    )
  )
);
