-- Central database enforcement for the web-admin officer permission matrix.
-- Existing System Administrator privileges are intentionally retained.

create or replace function public.bb_current_role()
returns text language sql stable security definer
set search_path = public, pg_catalog set row_security = off as $$
  select case r.role_name
    when 'Lupon Member' then 'Lupong Tagapamayapa Member'
    when 'Kagawad (Committee Chair)' then 'Sangguniang Barangay Kagawad'
    when 'Kagawad' then 'Sangguniang Barangay Kagawad'
    when 'Barangay Captain' then 'Punong Barangay (Barangay Captain)'
    when 'Punong Barangay' then 'Punong Barangay (Barangay Captain)'
    when 'System Admin' then 'System Administrator'
    else r.role_name end
  from public.users u join public.roles r on r.role_id=u.role_id
  where u.id=auth.uid()
$$;
revoke all on function public.bb_current_role() from public;
grant execute on function public.bb_current_role() to authenticated;

create or replace function public.bb_case_assigned_to_me(p_source text, p_reference text)
returns boolean language sql stable security definer
set search_path = public, pg_catalog set row_security = off as $$
  select exists (
    select 1 from public.bb_blotter_events e
    where e.source_table=p_source and e.reference_no=p_reference
      and e.kind='assignment' and e.payload->>'assigned_to'=auth.uid()::text
      and e.sequence=(select max(x.sequence) from public.bb_blotter_events x
        where x.source_table=e.source_table and x.reference_no=e.reference_no and x.kind='assignment')
  )
$$;
revoke all on function public.bb_case_assigned_to_me(text,text) from public;
grant execute on function public.bb_case_assigned_to_me(text,text) to authenticated;

-- Remove legacy permissive policies only on the tables governed below.
do $$ declare t text; p record;
begin
  foreach t in array array['users','pre_blotters','reports','service_complaints','ai_extractions','documents','notifications','emergency_contacts','audit_logs','generated_reports','bb_blotter_events','bb_service_events'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
        execute format('drop policy if exists %I on public.%I',p.policyname,t);
      end loop;
    end if;
  end loop;
end $$;

create policy bb_users_read on public.users for select to authenticated using (
  id=auth.uid() or public.bb_current_role() in ('System Administrator','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Barangay Secretary' and role_id in (select role_id from public.roles where role_name in ('Residente','Resident')))
);
create policy bb_users_self_profile on public.users for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy bb_users_officer_update on public.users for update to authenticated using (
  public.bb_current_role() in ('System Administrator','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Barangay Secretary' and role_id in (select role_id from public.roles where role_name in ('Residente','Resident')))
) with check (true);
create policy bb_users_admin_insert on public.users for insert to authenticated with check (public.bb_current_role()='System Administrator');
create policy bb_users_admin_delete on public.users for delete to authenticated using (public.bb_current_role()='System Administrator');

create or replace function public.bb_guard_user_update() returns trigger language plpgsql security definer
set search_path=public,pg_catalog set row_security=off as $$
declare role_name text:=public.bb_current_role();
begin
  if role_name='System Administrator' then return new; end if;
  if old.id=auth.uid() then
    if new.role_id is distinct from old.role_id or new.verification_status is distinct from old.verification_status
      or new.approval_status is distinct from old.approval_status or new.verified_by is distinct from old.verified_by
      or new.approved_by is distinct from old.approved_by then raise exception 'Cannot change your own authority fields' using errcode='42501'; end if;
    return new;
  end if;
  if role_name='Barangay Secretary' then
    if (to_jsonb(new)-array['verification_status','verified_by','updated_at']) is distinct from
       (to_jsonb(old)-array['verification_status','verified_by','updated_at']) then
      raise exception 'Secretary may only verify resident ID submissions' using errcode='42501';
    end if;
    if new.verification_status='pb_authorized' then raise exception 'Final approval belongs to the Punong Barangay' using errcode='42501'; end if;
    return new;
  end if;
  if role_name='Punong Barangay (Barangay Captain)' then
    if (to_jsonb(new)-array['role_id','verification_status','approval_status','verified_by','approved_by','updated_at']) is distinct from
       (to_jsonb(old)-array['role_id','verification_status','approval_status','verified_by','approved_by','updated_at']) then
      raise exception 'Punong Barangay update exceeds account authority' using errcode='42501';
    end if;
    return new;
  end if;
  raise exception 'Account update not permitted' using errcode='42501';
end $$;
drop trigger if exists bb_enforce_user_update on public.users;
create trigger bb_enforce_user_update before update on public.users for each row execute function public.bb_guard_user_update();

create policy bb_pre_blotter_read on public.pre_blotters for select to authenticated using (
  user_id=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('sinuri','under review','pending')))
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and public.bb_case_assigned_to_me('pre_blotters',reference_no) and lower(status) in ('inimbestigahan','investigating'))
);
create policy bb_pre_blotter_insert on public.pre_blotters for insert to authenticated with check (
  public.bb_current_role() in ('System Administrator','Barangay Secretary','Tanod / BPSO')
  and lower(coalesce(status,'under review')) in ('sinuri','under review','pending')
);
create policy bb_pre_blotter_update on public.pre_blotters for update to authenticated using (
  public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and public.bb_case_assigned_to_me('pre_blotters',reference_no) and lower(status) in ('inimbestigahan','investigating'))
) with check (true);
create policy bb_pre_blotter_delete on public.pre_blotters for delete to authenticated using (public.bb_current_role()='System Administrator');

create policy bb_reports_read on public.reports for select to authenticated using (
  user_id=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('sinuri','under review','pending')))
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and public.bb_case_assigned_to_me('reports',reference_no) and lower(status) in ('inimbestigahan','investigating'))
);
create policy bb_reports_insert on public.reports for insert to authenticated with check (
  user_id=auth.uid() or (public.bb_current_role() in ('System Administrator','Barangay Secretary','Tanod / BPSO')
  and lower(coalesce(status,'pending')) in ('sinuri','under review','pending'))
);
create policy bb_reports_update on public.reports for update to authenticated using (
  public.bb_current_role() in ('System Administrator','Barangay Secretary')
  or (public.bb_current_role()='Punong Barangay (Barangay Captain)' and coalesce(full_details->>'type','service_complaint')='blotter')
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and coalesce(full_details->>'type','service_complaint')='blotter' and public.bb_case_assigned_to_me('reports',reference_no) and lower(status) in ('inimbestigahan','investigating'))
) with check (true);
create policy bb_reports_delete on public.reports for delete to authenticated using (public.bb_current_role()='System Administrator');

create or replace function public.bb_guard_lupon_case_update() returns trigger language plpgsql security definer
set search_path=public,pg_catalog as $$
begin
  if public.bb_current_role()='Lupong Tagapamayapa Member' and
    (to_jsonb(new)-array['hearing_date','hearing_note','hearing_completed','updated_at']) is distinct from
    (to_jsonb(old)-array['hearing_date','hearing_note','hearing_completed','updated_at']) then
    raise exception 'Lupon members may only update hearing schedules and mediation notes' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists bb_enforce_lupon_pre_blotter_update on public.pre_blotters;
create trigger bb_enforce_lupon_pre_blotter_update before update on public.pre_blotters for each row execute function public.bb_guard_lupon_case_update();
drop trigger if exists bb_enforce_lupon_report_update on public.reports;
create trigger bb_enforce_lupon_report_update before update on public.reports for each row execute function public.bb_guard_lupon_case_update();

create policy bb_complaints_read on public.service_complaints for select to authenticated using (
  user_id=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('under review','pending')))
);
create policy bb_complaints_insert on public.service_complaints for insert to authenticated with check (
  user_id=auth.uid() or (public.bb_current_role() in ('System Administrator','Barangay Secretary','Tanod / BPSO')
  and lower(coalesce(status,'under review')) in ('under review','pending'))
);
create policy bb_complaints_update on public.service_complaints for update to authenticated using (public.bb_current_role() in ('System Administrator','Barangay Secretary')) with check (true);
create policy bb_complaints_delete on public.service_complaints for delete to authenticated using (public.bb_current_role()='System Administrator');

create policy bb_extractions_read on public.ai_extractions for select to authenticated using (
  public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or exists(select 1 from public.pre_blotters b where b.extraction_id=ai_extractions.extraction_id)
);
create policy bb_extractions_insert on public.ai_extractions for insert to authenticated with check (public.bb_current_role() in ('System Administrator','Barangay Secretary','Tanod / BPSO'));
create policy bb_extractions_update on public.ai_extractions for update to authenticated using (public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')) with check (true);
create policy bb_extractions_delete on public.ai_extractions for delete to authenticated using (public.bb_current_role()='System Administrator');

create policy bb_documents_read on public.documents for select to authenticated using (public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)'));
create policy bb_documents_insert on public.documents for insert to authenticated with check (public.bb_current_role() in ('System Administrator','Barangay Secretary'));
create policy bb_documents_update on public.documents for update to authenticated using (public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')) with check (true);
create policy bb_documents_delete on public.documents for delete to authenticated using (public.bb_current_role()='System Administrator');

create or replace function public.bb_guard_document_update() returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  if public.bb_current_role()='Punong Barangay (Barangay Captain)' and
    (to_jsonb(new)-array['approval_status','approved_by','approved_at','is_active']) is distinct from
    (to_jsonb(old)-array['approval_status','approved_by','approved_at','is_active']) then
    raise exception 'Punong Barangay may only approve knowledge-base documents' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists bb_enforce_document_update on public.documents;
create trigger bb_enforce_document_update before update on public.documents for each row execute function public.bb_guard_document_update();

create policy bb_notifications_read on public.notifications for select to authenticated using (
  user_id=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Sangguniang Barangay Kagawad' and notification_type='Committee-scoped Advisory')
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and title like '[Lupon Members |%')
  or (public.bb_current_role()='Tanod / BPSO' and title like '[Field Patrol Tanods Lamang |%')
  or title like '[Lahat ng Residente |%'
);
create policy bb_notifications_insert on public.notifications for insert to authenticated with check (public.bb_current_role() in ('System Administrator','Barangay Secretary','Sangguniang Barangay Kagawad','Punong Barangay (Barangay Captain)'));
create policy bb_notifications_delete on public.notifications for delete to authenticated using (public.bb_current_role()='System Administrator');

create policy bb_directory_read on public.emergency_contacts for select to authenticated using (public.bb_current_role() in ('System Administrator','Barangay Secretary','Tanod / BPSO','Lupong Tagapamayapa Member','Sangguniang Barangay Kagawad','Punong Barangay (Barangay Captain)'));
create policy bb_directory_insert on public.emergency_contacts for insert to authenticated with check (public.bb_current_role()='System Administrator');
create policy bb_directory_update on public.emergency_contacts for update to authenticated using (public.bb_current_role() in ('System Administrator','Punong Barangay (Barangay Captain)')) with check (true);
create policy bb_directory_delete on public.emergency_contacts for delete to authenticated using (public.bb_current_role()='System Administrator');

create or replace function public.bb_guard_directory_update() returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  if public.bb_current_role()='Punong Barangay (Barangay Captain)' and
    (to_jsonb(new)-array['is_active','authorized_by']) is distinct from (to_jsonb(old)-array['is_active','authorized_by']) then
    raise exception 'Punong Barangay may only authorize contact publication' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists bb_enforce_directory_update on public.emergency_contacts;
create trigger bb_enforce_directory_update before update on public.emergency_contacts for each row execute function public.bb_guard_directory_update();

create policy bb_audit_read on public.audit_logs for select to authenticated using (public.bb_current_role() in ('System Administrator','Punong Barangay (Barangay Captain)'));
create policy bb_audit_insert on public.audit_logs for insert to authenticated with check (actor_id=auth.uid());
create policy bb_generated_read on public.generated_reports for select to authenticated using (generated_by=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)'));
create policy bb_generated_insert on public.generated_reports for insert to authenticated with check (generated_by=auth.uid() and public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)'));

-- Append-only workflow tables: reads are scoped and writes remain RPC-only.
create policy bb_case_event_read on public.bb_blotter_events for select to authenticated using (
  public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and public.bb_case_assigned_to_me(source_table,reference_no))
  or (public.bb_current_role()='Tanod / BPSO' and kind='assignment' and payload->>'assigned_to'=auth.uid()::text)
);
create policy bb_service_event_read on public.bb_service_events for select to authenticated using (
  public.bb_current_role() in ('System Administrator','Barangay Secretary')
  or (public.bb_current_role()='Tanod / BPSO' and actor_id=auth.uid())
);

create or replace function public.bb_guard_service_event_insert() returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  if public.bb_current_role() not in ('System Administrator','Barangay Secretary') then
    raise exception 'Role cannot update service complaints' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists bb_enforce_service_event_insert on public.bb_service_events;
create trigger bb_enforce_service_event_insert before insert on public.bb_service_events for each row execute function public.bb_guard_service_event_insert();

create or replace function public.bb_guard_case_event_insert() returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare role_name text:=public.bb_current_role();
begin
  if role_name in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)') then return new; end if;
  if role_name='Lupong Tagapamayapa Member'
    and public.bb_case_assigned_to_me(new.source_table,new.reference_no)
    and new.kind in ('meeting_scheduled','meeting_rescheduled','meeting_recorded','notice_served','document','correction','compliance') then return new; end if;
  raise exception 'Role cannot record this blotter action' using errcode='42501';
end $$;
drop trigger if exists bb_enforce_case_event_insert on public.bb_blotter_events;
create trigger bb_enforce_case_event_insert before insert on public.bb_blotter_events for each row execute function public.bb_guard_case_event_insert();

-- Password resets are System Administrator-only. Officer account approval does not
-- imply authority to replace credentials.
create or replace function public.admin_set_user_password(target_user_id uuid,new_password text,must_change_pw boolean default true)
returns boolean language plpgsql security definer set search_path=public,pg_catalog,auth,extensions as $$
begin
  if public.bb_current_role()<>'System Administrator' then raise exception 'Unauthorized password reset' using errcode='42501'; end if;
  update auth.users set encrypted_password=crypt(new_password,gen_salt('bf',10)),
    raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb),'{must_change_password}',to_jsonb(must_change_pw)),updated_at=now()
  where id=target_user_id;
  return found;
end $$;
revoke all on function public.admin_set_user_password(uuid,text,boolean) from public;
grant execute on function public.admin_set_user_password(uuid,text,boolean) to authenticated;

-- Audit records are append-only even for the System Administrator and Captain.
revoke update, delete, truncate on public.audit_logs from authenticated, anon;
