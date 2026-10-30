-- Additive service workflow. Existing report structures and policies stay intact.
create table public.bb_service_events (
 id uuid primary key default gen_random_uuid(),
 source_table text not null check(source_table in ('reports','service_complaints')),
 report_id text not null, user_id uuid, reference_no text not null,
 action text not null, stage text not null check(stage in ('in_progress','follow_up','resolved','closed_unresolved')),
 note text not null check(length(btrim(note)) between 1 and 4000),
 actor_id uuid not null, actor_name text not null, actor_role text not null,
 request_id uuid not null unique, transaction_id bigint not null default txid_current(),
 created_at timestamptz not null default clock_timestamp()
);
create index bb_service_events_report on public.bb_service_events(source_table,report_id,created_at desc);
alter table public.bb_service_events enable row level security;
revoke all on public.bb_service_events from anon, authenticated;
grant select on public.bb_service_events to authenticated;
create policy service_staff_read on public.bb_service_events for select to authenticated using (
 exists(select 1 from public.users u join public.roles r on r.role_id=u.role_id where u.id=auth.uid() and r.role_name in ('Barangay Secretary','Barangay Captain','Punong Barangay','System Administrator','Lupon Member','Lupong Tagapamayapa Member'))
);
create function public.save_service_complaint_action(p_source text,p_report_id text,p_action text,p_note text,p_request_id uuid,p_expected_last uuid default null)
returns public.bb_service_events language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_name text; v_role text; v_row jsonb; v_last public.bb_service_events; v_event public.bb_service_events; v_stage text; v_status text; v_title text;
begin
 select concat_ws(' ',u.first_name,u.last_name),r.role_name into v_name,v_role from public.users u join public.roles r on r.role_id=u.role_id where u.id=v_actor;
 if v_actor is null or v_role is null or v_role not in ('Barangay Secretary','Barangay Captain','Punong Barangay','System Administrator','Lupon Member','Lupong Tagapamayapa Member') then raise exception 'Not authorized'; end if;
 if p_source='reports' then
   select to_jsonb(r) into v_row from public.reports r where r.id::text=p_report_id for update;
   if coalesce(v_row->'full_details'->>'type','service_complaint')<>'service_complaint' then raise exception 'Not a service complaint'; end if;
 elsif p_source='service_complaints' then
   select to_jsonb(c) into v_row from public.service_complaints c where c.complaint_id::text=p_report_id for update;
 else raise exception 'Invalid report source'; end if;
 if v_row is null then raise exception 'Report not found'; end if;
 select * into v_event from public.bb_service_events where request_id=p_request_id;
 if found then
   if v_event.actor_id<>v_actor or v_event.source_table<>p_source or v_event.report_id<>p_report_id or v_event.action<>p_action or v_event.note<>btrim(p_note) then raise exception 'Request conflict'; end if;
   return v_event;
 end if;
 select * into v_last from public.bb_service_events where source_table=p_source and report_id=p_report_id order by created_at desc,id desc limit 1;
 if v_last.id is distinct from p_expected_last then raise exception 'This complaint was updated. Reload before saving.'; end if;
 if p_note is null or length(btrim(p_note)) not between 1 and 4000 then raise exception 'Enter a note (up to 4000 characters)'; end if;
 v_stage:=coalesce(v_last.stage,case when lower(v_row->>'status') in ('resolved','nareselba','completed') then 'resolved' when lower(v_row->>'status') in ('closed','cancelled','canceled') then 'closed_unresolved' when lower(v_row->>'status') in ('investigating','inimbestigahan','in progress','assigned','processing') then 'in_progress' else 'received' end);
 if v_stage in ('resolved','closed_unresolved') and p_action<>'reopen' then raise exception 'Reopen the complaint before recording another action'; end if;
 if p_action='reopen' and v_stage not in ('resolved','closed_unresolved') then raise exception 'Only closed complaints can be reopened'; end if;
 if p_action='start' and v_stage<>'received' then raise exception 'This complaint has already been received'; end if;
 if p_action in ('note','follow_up','resolve') and v_stage='received' then raise exception 'Confirm receipt before recording work or resolution'; end if;
 v_stage:=case p_action when 'start' then 'in_progress' when 'reopen' then 'in_progress' when 'note' then v_stage when 'follow_up' then 'follow_up' when 'resolve' then 'resolved' when 'close_unresolved' then 'closed_unresolved' else null end;
 if v_stage is null then raise exception 'Invalid action'; end if;
 v_status:=case v_stage when 'resolved' then 'Resolved' when 'closed_unresolved' then 'Closed' else 'Investigating' end;
 v_title:=case p_action when 'start' then 'Complaint received' when 'note' then 'Service complaint update' when 'follow_up' then 'Follow-up needed' when 'resolve' then 'Complaint resolved' when 'close_unresolved' then 'Closed — not resolved' when 'reopen' then 'Complaint reopened' end;
 insert into public.bb_service_events(source_table,report_id,user_id,reference_no,action,stage,note,actor_id,actor_name,actor_role,request_id)
 values(p_source,p_report_id,(v_row->>'user_id')::uuid,coalesce(v_row->>'reference_no',p_report_id),p_action,v_stage,btrim(p_note),v_actor,v_name,v_role,p_request_id) returning * into v_event;
 if p_source='reports' then update public.reports set status=v_status where id::text=p_report_id;
 else update public.service_complaints set status=v_status where complaint_id::text=p_report_id; end if;
 if v_event.user_id is not null then
   insert into public.resident_report_notifications(user_id,report_source,report_id,reference_no,event_kind,title,message,report_status,report_kind,sender_name)
   values(v_event.user_id,p_source,p_report_id,v_event.reference_no,'service_progress',v_title,v_title || E'\nTala:\n' || btrim(p_note),v_status,'service_complaint',v_name);
 end if;
 return v_event;
end $$;
revoke all on function public.save_service_complaint_action(text,text,text,text,uuid,uuid) from public;
grant execute on function public.save_service_complaint_action(text,text,text,text,uuid,uuid) to authenticated;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.bb_service_events; end if; end $$;

-- The lifecycle save publishes exactly one notification per action.
create or replace function public.notify_resident_report_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  n jsonb := to_jsonb(new); o jsonb := case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_owner uuid; v_id text; v_ref text; v_kind text; v_status text; v_event text;
  v_title text; v_message text; v_venue text; v_note text; v_previous_note text; v_sender text; v_when timestamptz; v_closed boolean;
begin
  if nullif(n->>'user_id','') is null then return new; end if;
  if tg_op='UPDATE' and (n->>'status') is not distinct from (o->>'status')
    and (n->>'hearing_date') is not distinct from (o->>'hearing_date')
    and (n->>'hearing_completed') is not distinct from (o->>'hearing_completed')
    and (n->>'hearing_note') is not distinct from (o->>'hearing_note')
    and (n->>'outcome') is not distinct from (o->>'outcome') then return new; end if;
  v_owner:=(n->>'user_id')::uuid;
  v_id:=case tg_table_name when 'pre_blotters' then n->>'blotter_id' when 'service_complaints' then n->>'complaint_id' else n->>'id' end;
  v_ref:=coalesce(n->>'reference_no',v_id);
  v_kind:=case when tg_table_name='service_complaints' or (tg_table_name='reports' and coalesce(n->'full_details'->>'type','service_complaint')<>'blotter') then 'service_complaint' else 'blotter' end;
  if v_kind='service_complaint' and exists(select 1 from public.bb_service_events e where e.source_table=tg_table_name and e.report_id=v_id and e.transaction_id=txid_current()) then return new; end if;
  v_status:=case n->>'status' when 'Sinuri' then 'Under Review' when 'Inimbestigahan' then 'Investigating' when 'Nareselba' then 'Resolved' else coalesce(n->>'status','Under Review') end;
  v_closed:=lower(v_status) in ('resolved','closed','cfa issued');
  v_when:=nullif(n->>'hearing_date','')::timestamptz;
  select concat_ws(' ',u.first_name,u.last_name) into v_sender from public.users u where u.id=auth.uid();
  if tg_op='INSERT' then v_event:='received';v_title:='Natanggap ang inyong ulat';
  elsif v_closed and ((n->>'status') is distinct from (o->>'status') or (n->>'outcome') is distinct from (o->>'outcome')) then
    v_event:='resolved';v_title:=case when coalesce(n->>'outcome','') ~* 'certificate to file action|\mcfa\M' then 'May naitalang CFA sa inyong ulat' when coalesce(n->>'outcome','') ~* 'settlement|nagkaareglo|settled' then 'Naitala ang pag-aayos ng inyong ulat' else 'May huling resulta ang inyong ulat' end;
  elsif (n->>'hearing_date') is distinct from (o->>'hearing_date') then
    v_event:='hearing_scheduled';v_title:=case when v_when is null then 'Binago ang iskedyul ng pagdinig' when o->>'hearing_date' is null then 'May iskedyul na ang inyong pagdinig' else 'Nabago ang iskedyul ng inyong pagdinig' end;
  elsif (n->>'status') is distinct from (o->>'status') then v_event:='status_changed';v_title:='Na-update ang status ng inyong ulat';
  else v_event:='hearing_update';v_title:='May update sa inyong pagdinig'; end if;
  v_message:=case
    when tg_op='INSERT' then 'Natanggap na ang inyong ' || case when v_kind='blotter' then 'blotter report' else 'service complaint' end || ' at susuriin ito ng barangay.'
    when v_event='status_changed' and v_status='Investigating' then 'Nakumpirma na ang inyong ' || case when v_kind='blotter' then 'blotter report' else 'service complaint' end || ' at kasalukuyan itong iniimbestigahan o inaaksyunan ng barangay.'
    when v_event='hearing_scheduled' and v_when is not null then case when o->>'hearing_date' is null then 'Naitakda na ang pagdinig para sa inyong blotter report.' else 'Binago ng barangay ang iskedyul ng pagdinig para sa inyong blotter report.' end
    when v_event='hearing_scheduled' then 'Inalis o binago ang dating iskedyul ng pagdinig. Kumpirmahin sa barangay ang bagong iskedyul.'
    when v_status='Under Review' then 'Nasa pagsusuri ng barangay ang inyong ulat.'
    else 'May bagong update ang barangay tungkol sa inyong ulat.' end || E'\nReference: ' || v_ref;
  if v_when is not null and not v_closed then v_message:=v_message || E'\nPagdinig: ' || to_char(v_when at time zone 'Asia/Manila','Mon DD, YYYY, HH12:MI AM') || ' (Philippine time)'; end if;
  select matches[1] into v_venue from regexp_matches(coalesce(n->>'hearing_note',''), E'(?:^|\n)Venue: ([^\r\n]+)', 'g') with ordinality as venues(matches,idx) order by idx desc limit 1;
  if v_when is not null and nullif(btrim(v_venue),'') is not null then v_message:=v_message || E'\nVenue: ' || btrim(v_venue); end if;
  if v_event='hearing_update' then v_message:=v_message || case when coalesce((n->>'hearing_completed')::boolean,false) then E'\nNaitala na naganap ang pagdinig. Buksan ang report para sa detalye.' else E'\nMay bagong tala o pagbabago sa pagdinig. Buksan ang report para sa detalye.' end;
  elsif v_event='resolved' then v_message:=v_message || E'\n' || case when coalesce(n->>'outcome','') ~* 'certificate to file action|\mcfa\M' then 'Naitala ang naisyung Certificate to File Action. Kumpirmahin sa barangay ang susunod na hakbang.' when coalesce(n->>'outcome','') ~* 'settlement|nagkaareglo|settled' then 'Nagkaareglo ang mga panig ayon sa naitalang resulta.' else 'Buksan ang report para sa naitalang huling resulta.' end;
  end if;
  if tg_op='UPDATE' and (n->>'hearing_note') is distinct from (o->>'hearing_note') then
    v_note:=coalesce(n->>'hearing_note','');
    v_previous_note:=coalesce(o->>'hearing_note','');
    if v_previous_note<>'' and left(v_note,length(v_previous_note))=v_previous_note then
      v_note:=substr(v_note,length(v_previous_note)+1);
    end if;
    v_note:=btrim(v_note,E' \r\n');
    -- The application prefixes each new entry with timestamp and actor.
    if split_part(v_note,E'\n',1) like '% · %' then
      v_note:=substr(v_note,strpos(v_note,E'\n')+1);
    end if;
    -- Venue and attendance already have their own fields/status.
    v_note:=btrim(regexp_replace(v_note,E'(^|\n)(Venue|Kalagayan): [^\r\n]*', '', 'g'),E' \r\n');
    if v_note<>'' then v_message:=v_message || E'\nTala:\n' || v_note; end if;
  end if;
  insert into public.resident_report_notifications(user_id,report_source,report_id,reference_no,event_kind,title,message,report_status,report_kind,hearing_date,hearing_completed,sender_name)
    values(v_owner,tg_table_name,v_id,v_ref,v_event,v_title,v_message,v_status,v_kind,v_when,coalesce((n->>'hearing_completed')::boolean,false),v_sender);
  return new;
end;
$$;
