-- Confirm GIS intake with an official severity and advance it to Investigating.
create or replace function public.bb_confirm_gis_incident(
  p_source text,
  p_record_id text,
  p_severity text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
declare
  v_role text := public.bb_current_role();
  v_extraction_id bigint;
  v_reference text;
begin
  if v_role not in ('System Administrator', 'Barangay Secretary') then
    raise exception 'Only the System Administrator or Barangay Secretary may confirm an incident' using errcode = '42501';
  end if;
  if p_severity not in ('Mataas', 'Katamtaman', 'Mababa') then
    raise exception 'A valid official severity is required' using errcode = '22023';
  end if;

  if p_source = 'reports' then
    update public.reports
    set status = 'Investigating',
        full_details = coalesce(full_details, '{}'::jsonb) || jsonb_build_object(
          'severity', p_severity,
          'severityConfirmed', true,
          'severityConfirmedAt', now(),
          'severityConfirmedBy', auth.uid()
        )
    where id::text = p_record_id or reference_no = p_record_id
    returning coalesce(reference_no, id::text) into v_reference;
  elsif p_source = 'pre_blotters' then
    update public.pre_blotters
    set status = 'Inimbestigahan'
    where reference_no = p_record_id or blotter_id::text = p_record_id
    returning extraction_id, reference_no into v_extraction_id, v_reference;

    if found and v_extraction_id is not null then
      update public.ai_extractions
      set json_output = coalesce(json_output, '{}'::jsonb) || jsonb_build_object(
        'severity', p_severity,
        'severityConfirmed', true,
        'severityConfirmedAt', now(),
        'severityConfirmedBy', auth.uid()
      )
      where extraction_id = v_extraction_id;
    end if;
  else
    raise exception 'Unsupported incident source' using errcode = '22023';
  end if;

  if not found or v_reference is null then
    raise exception 'Incident was not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('reference_no', v_reference, 'status', 'Investigating', 'severity', p_severity);
end
$$;

revoke all on function public.bb_confirm_gis_incident(text,text,text) from public;
grant execute on function public.bb_confirm_gis_incident(text,text,text) to authenticated;
