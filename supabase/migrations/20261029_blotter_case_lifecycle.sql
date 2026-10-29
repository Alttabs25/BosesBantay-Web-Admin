-- Additive case event store. Existing tables and their policies are not altered.
-- Each meeting has a stable UUID; minutes, verification, reschedules and corrections
-- are separate append-only events. All writes go through one transactional RPC.
create table public.bb_blotter_events (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('reports','pre_blotters')),
  reference_no text not null,
  sequence bigint not null,
  kind text not null check (kind in ('assessment','assignment','meeting_scheduled','meeting_rescheduled','meeting_recorded','meeting_verified','notice_issued','notice_served','pangkat','arbitration','settlement','repudiation','referral','document','correction','compliance','disposition','archive')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) < 131072),
  actor_id uuid not null,
  actor_name text not null,
  actor_role text not null,
  created_at timestamptz not null default now(),
  request_id uuid not null unique,
  unique(source_table, reference_no, sequence)
);
create index bb_blotter_events_case_idx on public.bb_blotter_events(source_table,reference_no,sequence);
create index bb_blotter_events_meeting_idx on public.bb_blotter_events((payload->>'meeting_id')) where payload ? 'meeting_id';
alter table public.bb_blotter_events enable row level security;
revoke all on public.bb_blotter_events from anon, authenticated;
grant select on public.bb_blotter_events to authenticated;

create function public.bb_case_can_read(p_source text,p_ref text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u join public.roles r on r.role_id=u.role_id
    where u.id=auth.uid() and r.role_name in ('Barangay Secretary','Barangay Captain','Punong Barangay','System Administrator','Lupon Member','Lupong Tagapamayapa Member')
  );
$$;
revoke all on function public.bb_case_can_read(text,text) from public;
grant execute on function public.bb_case_can_read(text,text) to authenticated;
create policy bb_case_staff_read on public.bb_blotter_events for select to authenticated using (public.bb_case_can_read(source_table,reference_no));

create function public.bb_record_case_event(p_source text,p_ref text,p_kind text,p_payload jsonb,p_version bigint,p_request_id uuid)
returns public.bb_blotter_events language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_name text; v_role text; v_count bigint; v_stage text := 'review';
  v_event public.bb_blotter_events; v_last jsonb; v_meeting jsonb; v_key text; v_close boolean;
  v_handler text; v_start timestamptz; v_end timestamptz; v_at timestamptz;
begin
  if v_actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select concat_ws(' ',u.first_name,u.last_name),r.role_name into v_name,v_role
    from public.users u join public.roles r on r.role_id=u.role_id where u.id=v_actor;
  if v_role is null or v_role not in ('Barangay Secretary','Barangay Captain','Punong Barangay','Lupon Member','Lupong Tagapamayapa Member','System Administrator') then
    raise exception 'Role cannot make case decisions' using errcode='42501';
  end if;
  if p_source not in ('reports','pre_blotters') or p_ref is null or length(p_ref)>120 or p_request_id is null then raise exception 'Invalid case identifier'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_ref,0));
  select * into v_event from public.bb_blotter_events where request_id=p_request_id;
  if found then
    if v_event.actor_id<>v_actor or v_event.source_table<>p_source or v_event.reference_no<>p_ref then raise exception 'Request ID mismatch'; end if;
    return v_event;
  end if;
  if p_source='reports' then
    perform 1 from public.reports where reference_no=p_ref and full_details->>'type'='blotter';
  else perform 1 from public.pre_blotters where reference_no=p_ref;
  end if;
  if not found then raise exception 'Blotter case not found'; end if;
  select count(*) into v_count from public.bb_blotter_events where source_table=p_source and reference_no=p_ref;
  if v_count<>p_version then raise exception 'Case changed. Reload before saving.' using errcode='40001'; end if;
  select payload->>'assigned_to' into v_handler from public.bb_blotter_events where source_table=p_source and reference_no=p_ref and kind='assignment' order by sequence desc limit 1;
  select case kind when 'assessment' then case payload->>'route' when 'kp' then 'mediation' when 'documentation' then 'documentation' else 'referral' end when 'pangkat' then 'conciliation' when 'arbitration' then 'arbitration' when 'settlement' then 'settlement' when 'repudiation' then 'review' when 'referral' then 'referral' when 'disposition' then 'closed' when 'archive' then 'archived' end
    into v_stage from public.bb_blotter_events where source_table=p_source and reference_no=p_ref and kind in ('assessment','pangkat','arbitration','settlement','repudiation','referral','disposition','archive') order by sequence desc limit 1;
  v_stage:=coalesce(v_stage,'review');
  if v_stage='archived' then raise exception 'Archived case is read-only'; end if;
  if v_stage='closed' and p_kind not in ('compliance','correction','document','repudiation','archive') then raise exception 'Closed case requires follow-up or documented repudiation'; end if;
  if jsonb_typeof(p_payload)<>'object' or coalesce(length(trim(p_payload->>'notes')),0)=0 then raise exception 'Notes required'; end if;
  if not exists(select 1 from public.bb_blotter_events where source_table=p_source and reference_no=p_ref and kind='assessment') and p_kind not in ('assessment','assignment','document','correction','referral') then raise exception 'Jurisdiction review required'; end if;
  if p_kind<>'meeting_scheduled' then
    v_at:=(p_payload->>'occurred_at')::timestamptz;
    if v_at is null or v_at>now() then raise exception 'Actual date must not be in future'; end if;
  end if;
  if p_kind in ('assessment','pangkat','arbitration','settlement','referral','disposition','archive') and coalesce((p_payload->>'approved')::boolean,false)=false then raise exception 'Explicit authorized approval required'; end if;
  if p_kind='assessment' then
    if coalesce(p_payload->>'route','') not in ('kp','documentation','urgent','outside') then raise exception 'Invalid jurisdiction route'; end if;
    foreach v_key in array array['jurisdiction_basis','venue_basis'] loop if coalesce(length(trim(p_payload->>v_key)),0)=0 then raise exception 'Required: %',v_key; end if; end loop;
  end if;
  if p_kind='assignment' and not exists(select 1 from public.users u join public.roles r on r.role_id=u.role_id where u.id::text=p_payload->>'assigned_to' and r.role_name in ('Barangay Secretary','Barangay Captain','Punong Barangay','Lupon Member','Lupong Tagapamayapa Member','System Administrator')) then raise exception 'Invalid case handler'; end if;
  if p_kind in ('notice_issued','pangkat','arbitration','settlement','referral','document','disposition','repudiation') and coalesce(length(trim(p_payload->>'reference')),0)=0 then raise exception 'Document reference required'; end if;
  if p_kind in ('meeting_scheduled','meeting_rescheduled','meeting_recorded','meeting_verified') then
    perform (p_payload->>'meeting_id')::uuid;
    if p_payload->>'meeting_id' is null then raise exception 'Meeting ID required'; end if;
    select payload || jsonb_build_object('event_kind',kind) into v_meeting from public.bb_blotter_events where source_table=p_source and reference_no=p_ref and payload->>'meeting_id'=p_payload->>'meeting_id' and kind in ('meeting_scheduled','meeting_rescheduled','meeting_recorded','meeting_verified') order by sequence desc limit 1;
    if p_kind='meeting_scheduled' and v_meeting is not null then raise exception 'Meeting already exists'; end if;
    if p_kind<>'meeting_scheduled' and v_meeting is null then raise exception 'Meeting not found'; end if;
  end if;
  if p_kind in ('meeting_scheduled','meeting_rescheduled') then
    if p_kind='meeting_rescheduled' and v_meeting->>'event_kind' not in ('meeting_scheduled','meeting_rescheduled') then raise exception 'Only active meeting may be rescheduled'; end if;
    if (p_payload->>'type'='mediation' and v_stage<>'mediation') or (p_payload->>'type'='conciliation' and v_stage<>'conciliation') or (p_payload->>'type'='arbitration' and v_stage<>'arbitration') or coalesce(p_payload->>'type','') not in ('mediation','conciliation','arbitration') then raise exception 'Meeting type does not match current stage'; end if;
    foreach v_key in array array['venue','presiding','agenda'] loop if coalesce(length(trim(p_payload->>v_key)),0)=0 then raise exception 'Required: %',v_key; end if; end loop;
    v_start:=(p_payload->>'scheduled_at')::timestamptz; v_end:=(p_payload->>'ends_at')::timestamptz;
    if v_start is null or v_end is null or v_start<=now() or v_end<=v_start then raise exception 'Invalid future meeting interval'; end if;
    if exists(select 1 from (select distinct on (payload->>'meeting_id') payload,kind from public.bb_blotter_events where source_table=p_source and reference_no=p_ref and kind in ('meeting_scheduled','meeting_rescheduled','meeting_recorded') order by payload->>'meeting_id',sequence desc) m where m.kind in ('meeting_scheduled','meeting_rescheduled') and m.payload->>'meeting_id'<>p_payload->>'meeting_id') then raise exception 'Case already has an active meeting'; end if;
  end if;
  if p_kind='meeting_recorded' then
    if v_meeting->>'event_kind' not in ('meeting_scheduled','meeting_rescheduled') then raise exception 'Meeting record already exists; use correction'; end if;
    foreach v_key in array array['attendance','attendees','absence_reasons','actual_venue','complainant_statement','respondent_statement','discussion','evidence','agreements','unresolved','official_actions','responsibilities','next_steps','minutes_reference','outcome','status','actual_at','actual_end'] loop if coalesce(length(trim(p_payload->>v_key)),0)=0 then raise exception 'Required: %',v_key; end if; end loop;
    if p_payload->>'status' not in ('completed','postponed','missed') or p_payload->>'outcome' not in ('pending','agreement_proposed','unsuccessful','continued') or p_payload->>'attendance' not in ('both','complainant_absent','respondent_absent','both_absent') then raise exception 'Invalid session status / outcome'; end if;
    if (p_payload->>'actual_at')::timestamptz>now() then raise exception 'Actual session cannot be in future'; end if;
    if (p_payload->>'actual_end')::timestamptz<(p_payload->>'actual_at')::timestamptz or (p_payload->>'actual_end')::timestamptz>now() then raise exception 'Invalid actual end time'; end if;
    if p_payload->>'status'='completed' and p_payload->>'attendance'<>'both' then raise exception 'Record absence as missed or postponed'; end if;
  end if;
  if p_kind='meeting_verified' and v_meeting->>'event_kind'<>'meeting_recorded' then raise exception 'Unverified minutes required'; end if;
  if p_kind='notice_served' then
    if not exists(select 1 from public.bb_blotter_events where id=(p_payload->>'notice_id')::uuid and source_table=p_source and reference_no=p_ref and kind='notice_issued') then raise exception 'Issued notice not found'; end if;
    if exists(select 1 from public.bb_blotter_events where source_table=p_source and reference_no=p_ref and kind='notice_served' and payload->>'notice_id'=p_payload->>'notice_id') then raise exception 'Notice service already recorded'; end if;
    foreach v_key in array array['recipient','method','proof'] loop if coalesce(length(trim(p_payload->>v_key)),0)=0 then raise exception 'Required: %',v_key; end if; end loop;
  end if;
  if p_kind='pangkat' and (v_stage<>'mediation' or coalesce(length(trim(p_payload->>'members')),0)=0) then raise exception 'Mediation review and Pangkat members required'; end if;
  if p_kind='arbitration' and v_stage not in ('mediation','conciliation') then raise exception 'Invalid arbitration transition'; end if;
  if p_kind='arbitration' and coalesce(length(trim(p_payload->>'terms')),0)=0 then raise exception 'Written voluntary agreement and signatories required'; end if;
  if p_kind='document' and (coalesce(length(trim(p_payload->>'title')),0)=0 or coalesce(length(trim(p_payload->>'document_type')),0)=0) then raise exception 'Document title and type required'; end if;
  if p_kind='notice_issued' and coalesce(length(trim(p_payload->>'recipient')),0)=0 then raise exception 'Notice recipient required'; end if;
  if p_kind='settlement' then
    if v_stage not in ('mediation','conciliation','arbitration') then raise exception 'Invalid settlement transition'; end if;
    if coalesce(length(trim(p_payload->>'terms')),0)=0 or coalesce(length(trim(p_payload->>'signatures')),0)=0 then raise exception 'Settlement terms and signatures / attestation required'; end if;
  end if;
  if p_kind='referral' and (coalesce(length(trim(p_payload->>'agency')),0)=0 or coalesce(length(trim(p_payload->>'follow_up')),0)=0) then raise exception 'Agency and follow-up required'; end if;
  if p_kind='correction' then
    if not exists(select 1 from public.bb_blotter_events where id=(p_payload->>'corrects_event_id')::uuid and source_table=p_source and reference_no=p_ref) or coalesce(length(trim(p_payload->>'replacement')),0)=0 then raise exception 'Original event and corrected text required'; end if;
  end if;
  if p_kind='repudiation' and not exists(select 1 from public.bb_blotter_events where source_table=p_source and reference_no=p_ref and kind in ('settlement','arbitration')) then raise exception 'No settlement / arbitration agreement recorded'; end if;
  if p_kind='archive' and v_stage<>'closed' then raise exception 'Disposition required before archive'; end if;
  if p_kind='disposition' then
    if coalesce(p_payload->>'disposition','') not in ('settled','cfa','referred','documentation','arbitration_award') then raise exception 'Disposition required'; end if;
    if (p_payload->>'disposition'='settled' and v_stage<>'settlement') or (p_payload->>'disposition'='referred' and v_stage<>'referral') or (p_payload->>'disposition'='documentation' and v_stage<>'documentation') or (p_payload->>'disposition'='arbitration_award' and v_stage<>'arbitration') then raise exception 'Disposition does not match route'; end if;
    if p_payload->>'disposition'='cfa' and coalesce(length(trim(p_payload->>'legal_basis')),0)=0 then raise exception 'CFA legal basis and officer verification required'; end if;
  end if;
  insert into public.bb_blotter_events(source_table,reference_no,sequence,kind,payload,actor_id,actor_name,actor_role,request_id)
    values(p_source,p_ref,v_count+1,p_kind,p_payload,v_actor,v_name,v_role,p_request_id) returning * into v_event;
  if p_kind in ('meeting_scheduled','meeting_rescheduled','meeting_recorded') then
    if p_source='reports' then update public.reports set
      hearing_date=case when p_kind='meeting_recorded' then hearing_date else (p_payload->>'scheduled_at')::timestamptz end,
      hearing_completed=(p_kind='meeting_recorded' and p_payload->>'status'='completed') where reference_no=p_ref;
    else update public.pre_blotters set
      hearing_date=case when p_kind='meeting_recorded' then hearing_date else (p_payload->>'scheduled_at')::timestamptz end,
      hearing_completed=(p_kind='meeting_recorded' and p_payload->>'status'='completed') where reference_no=p_ref;
    end if;
  end if;
  -- Synchronize only common resident status; detailed stages stay in the new event store.
  if p_kind in ('assessment','disposition','repudiation') then
    if p_source='reports' then update public.reports set status=case when p_kind='disposition' then 'Resolved' when p_kind='repudiation' then 'Under Review' else 'Investigating' end,
      outcome=case when p_kind='disposition' then (p_payload->>'disposition') || ': ' || (p_payload->>'reference') || E'\n' || (p_payload->>'notes') when p_kind='repudiation' then null else outcome end where reference_no=p_ref;
    else update public.pre_blotters set status=case when p_kind='disposition' then 'Nareselba' when p_kind='repudiation' then 'Sinuri' else 'Inimbestigahan' end,
      outcome=case when p_kind='disposition' then (p_payload->>'disposition') || ': ' || (p_payload->>'reference') || E'\n' || (p_payload->>'notes') when p_kind='repudiation' then null else outcome end where reference_no=p_ref;
    end if;
  end if;
  return v_event;
end;
$$;
revoke all on function public.bb_record_case_event(text,text,text,jsonb,bigint,uuid) from public;
grant execute on function public.bb_record_case_event(text,text,text,jsonb,bigint,uuid) to authenticated;

create view public.bb_blotter_registry with (security_invoker = true) as
with cases as (select source_table,reference_no,count(*) as event_count,max(created_at) as updated_at from public.bb_blotter_events group by source_table,reference_no),
stages as (select distinct on(source_table,reference_no) source_table,reference_no,
 case kind when 'assessment' then case payload->>'route' when 'kp' then 'mediation' when 'documentation' then 'documentation' else 'referral' end when 'pangkat' then 'conciliation' when 'arbitration' then 'arbitration' when 'settlement' then 'settlement' when 'repudiation' then 'review' when 'referral' then 'referral' when 'disposition' then 'closed' when 'archive' then 'archived' end as stage
 from public.bb_blotter_events where kind in ('assessment','pangkat','arbitration','settlement','repudiation','referral','disposition','archive') order by source_table,reference_no,sequence desc),
handlers as (select distinct on(source_table,reference_no) source_table,reference_no,payload->>'assigned_name' as assigned_name from public.bb_blotter_events where kind='assignment' order by source_table,reference_no,sequence desc)
select c.*,coalesce(s.stage,'review') as stage,h.assigned_name from cases c left join stages s using(source_table,reference_no) left join handlers h using(source_table,reference_no);
revoke all on public.bb_blotter_registry from anon;
grant select on public.bb_blotter_registry to authenticated;
