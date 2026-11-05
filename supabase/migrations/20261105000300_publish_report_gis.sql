-- Publish an existing report to GIS without granting broad report-update access.
create or replace function public.bb_publish_report_gis(
  p_report_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_location text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
declare
  v_role text := public.bb_current_role();
  v_report public.reports%rowtype;
begin
  if v_role not in ('System Administrator', 'Barangay Secretary', 'Tanod / BPSO') then
    raise exception 'Not authorized to publish GIS incidents' using errcode = '42501';
  end if;
  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'Invalid GIS coordinates' using errcode = '22023';
  end if;

  update public.reports
  set location = coalesce(nullif(btrim(p_location), ''), location),
      full_details = coalesce(full_details, '{}'::jsonb) || jsonb_build_object(
        'staffLocationPin', jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude),
        'gisMapped', true,
        'mapStatus', 'Approved',
        'gisMappedAt', now()
      )
  where id = p_report_id
  returning * into v_report;

  if not found then
    raise exception 'Report was not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_report.id,
    'reference_no', v_report.reference_no,
    'status', v_report.status,
    'location', v_report.location,
    'full_details', v_report.full_details
  );
end
$$;

revoke all on function public.bb_publish_report_gis(uuid,numeric,numeric,text) from public;
grant execute on function public.bb_publish_report_gis(uuid,numeric,numeric,text) to authenticated;
