-- Add explicit, reason-required triage outcomes. No new permissions.
create or replace function public.save_service_complaint_action(p_source text,p_report_id text,p_action text,p_note text,p_request_id uuid,p_expected_last uuid default null)
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
 v_stage:=coalesce(v_last.stage,case when lower(v_row->>'status') in ('resolved','nareselba','completed') then 'resolved' when lower(v_row->>'status') in ('closed','cancelled','canceled','spam','out of scope') then 'closed_unresolved' when lower(v_row->>'status') in ('investigating','inimbestigahan','in progress','assigned','processing') then 'in_progress' else 'received' end);
 if v_stage in ('resolved','closed_unresolved') and p_action<>'reopen' then raise exception 'Reopen the complaint before recording another action'; end if;
 if p_action='reopen' and v_stage not in ('resolved','closed_unresolved') then raise exception 'Only closed complaints can be reopened'; end if;
 if p_action='start' and v_stage<>'received' then raise exception 'This complaint has already been received'; end if;
 if p_action in ('note','follow_up','resolve') and v_stage='received' then raise exception 'Confirm receipt before recording work or resolution'; end if;
 v_stage:=case p_action when 'start' then 'in_progress' when 'reopen' then 'in_progress' when 'note' then v_stage when 'follow_up' then 'follow_up' when 'resolve' then 'resolved' when 'close_unresolved' then 'closed_unresolved' when 'spam' then 'closed_unresolved' when 'out_of_scope' then 'closed_unresolved' else null end;
 if v_stage is null then raise exception 'Invalid action'; end if;
 v_status:=case when p_action='spam' then 'Spam' when p_action='out_of_scope' then 'Out of Scope' else case v_stage when 'resolved' then 'Resolved' when 'closed_unresolved' then 'Closed' else 'Investigating' end end;
 v_title:=case p_action when 'start' then 'Complaint received' when 'note' then 'Service complaint update' when 'follow_up' then 'Follow-up needed' when 'resolve' then 'Complaint resolved' when 'close_unresolved' then 'Closed — not resolved' when 'reopen' then 'Complaint reopened' when 'spam' then 'Complaint marked as spam' when 'out_of_scope' then 'Complaint outside barangay service scope' end;
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
