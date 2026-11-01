-- Snapshot only the newly recorded admin note for this notification. No schema or permission changes.
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
