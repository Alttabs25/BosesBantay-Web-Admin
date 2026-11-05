-- Stable aggregate for the Tanod dashboard. The function bypasses report-row
-- RLS only to return anonymous daily totals; no report fields are exposed.
create or replace function public.bb_report_submission_counts(p_days integer default 7)
returns table(submission_day date, report_count bigint)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 7), 1), 31);
  v_start date := (timezone('Asia/Manila', now()))::date - (v_days - 1);
  v_role text := public.bb_current_role();
begin
  if v_role not in (
    'Tanod / BPSO', 'System Administrator', 'Barangay Secretary',
    'Punong Barangay (Barangay Captain)'
  ) then
    raise exception 'Report submission analytics not permitted' using errcode = '42501';
  end if;

  return query
  with raw_submissions as (
    select
      coalesce(nullif(b.reference_no, ''), 'pre:' || b.blotter_id::text) as report_key,
      coalesce(
        nullif(to_jsonb(b)->>'submitted_at', '')::timestamptz,
        nullif(to_jsonb(b)->>'created_at', '')::timestamptz
      ) as submitted_at
    from public.pre_blotters b
    union all
    select
      coalesce(nullif(r.reference_no, ''), 'report:' || r.id::text),
      coalesce(
        nullif(to_jsonb(r)->>'created_at', '')::timestamptz,
        nullif(to_jsonb(r)->>'submitted_at', '')::timestamptz
      )
    from public.reports r
    union all
    select
      coalesce(nullif(c.reference_no, ''), 'complaint:' || c.complaint_id::text),
      coalesce(
        nullif(to_jsonb(c)->>'created_at', '')::timestamptz,
        nullif(to_jsonb(c)->>'submitted_at', '')::timestamptz
      )
    from public.service_complaints c
  ), deduplicated as (
    select report_key, min(submitted_at) as submitted_at
    from raw_submissions
    where submitted_at is not null
    group by report_key
  )
  select
    (timezone('Asia/Manila', d.submitted_at))::date as submission_day,
    count(*)::bigint as report_count
  from deduplicated d
  where (timezone('Asia/Manila', d.submitted_at))::date >= v_start
    and (timezone('Asia/Manila', d.submitted_at))::date < v_start + v_days
  group by 1
  order by 1;
end;
$$;

revoke all on function public.bb_report_submission_counts(integer) from public;
grant execute on function public.bb_report_submission_counts(integer) to authenticated;
