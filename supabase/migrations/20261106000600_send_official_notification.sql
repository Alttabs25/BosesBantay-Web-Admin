-- Role-authorized broadcast entry point. Global broadcasts use user_id = null;
-- notification readers still receive only rows allowed by their RLS policy.
create or replace function public.bb_send_official_notification(
  p_title text,
  p_message text,
  p_notification_type text,
  p_target text,
  p_level text
)
returns bigint
language plpgsql
security definer
set search_path=public,pg_catalog
set row_security=off
as $$
declare
  v_role text:=public.bb_current_role();
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 180 then raise exception 'Notification title is required and must be at most 180 characters' using errcode='22023'; end if;
  if length(btrim(coalesce(p_message,''))) not between 1 and 4000 then raise exception 'Notification message is required and must be at most 4000 characters' using errcode='22023'; end if;
  if p_level not in ('Normal na Pagpapayo','Mataas na Alerto','Emergency') then raise exception 'Invalid alert level' using errcode='22023'; end if;

  if v_role in ('Barangay Secretary','Punong Barangay (Barangay Captain)') then
    if p_notification_type not in ('Governance Notice','Safety Advisory','Community Announcement')
      or p_target not in ('Lahat ng Residente','Mga Kagawad','Lupon Members','Field Patrol Tanods Lamang') then
      raise exception 'Notification type or audience is not allowed for this role' using errcode='42501';
    end if;
  elsif v_role='System Administrator' then
    if p_notification_type<>'System-level Broadcast' or p_target<>'System-wide Broadcast' then
      raise exception 'System Administrator broadcasts must use the system-wide channel' using errcode='42501';
    end if;
  else
    raise exception 'Role cannot send notifications' using errcode='42501';
  end if;

  insert into public.notifications(user_id,sent_by,title,message,notification_type,is_read)
  values(null,auth.uid(),format('[%s | %s] %s',p_target,p_level,btrim(p_title)),btrim(p_message),p_notification_type,false)
  returning notification_id into v_id;
  return v_id;
end $$;

revoke all on function public.bb_send_official_notification(text,text,text,text,text) from public;
grant execute on function public.bb_send_official_notification(text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
