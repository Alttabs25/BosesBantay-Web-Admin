-- Committee ownership used to scope Kagawad dashboards, GIS and complaints.
create table if not exists public.barangay_committees (
  committee_id smallint primary key,
  committee_name text not null unique,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.barangay_committees(committee_id,committee_name,description) values
  (1,'Peace and Order','Public safety, peace and order concerns'),
  (2,'Health and Sanitation','Health, sanitation and community wellness'),
  (3,'Public Works and Infrastructure','Roads, drainage, facilities and infrastructure'),
  (4,'Social Services','Social welfare, family, youth and senior concerns'),
  (5,'Environment and Waste Management','Environment, cleanliness and solid waste')
on conflict (committee_id) do update set committee_name=excluded.committee_name,description=excluded.description;

alter table public.users add column if not exists committee_id smallint null references public.barangay_committees(committee_id);
alter table public.pre_blotters add column if not exists committee_id smallint null references public.barangay_committees(committee_id);
alter table public.reports add column if not exists committee_id smallint null references public.barangay_committees(committee_id);
alter table public.service_complaints add column if not exists committee_id smallint null references public.barangay_committees(committee_id);

create index if not exists users_committee_idx on public.users(committee_id) where committee_id is not null;
create index if not exists pre_blotters_committee_idx on public.pre_blotters(committee_id) where committee_id is not null;
create index if not exists reports_committee_idx on public.reports(committee_id) where committee_id is not null;
create index if not exists service_complaints_committee_idx on public.service_complaints(committee_id) where committee_id is not null;

alter table public.barangay_committees enable row level security;
drop policy if exists bb_committees_read on public.barangay_committees;
create policy bb_committees_read on public.barangay_committees for select to authenticated using (true);
drop policy if exists bb_committees_admin_write on public.barangay_committees;
create policy bb_committees_admin_write on public.barangay_committees for all to authenticated
using (public.bb_current_role()='System Administrator') with check (public.bb_current_role()='System Administrator');

create or replace function public.bb_my_committee_id() returns smallint language sql stable security definer
set search_path=public,pg_catalog set row_security=off as $$
  select u.committee_id from public.users u where u.id=auth.uid()
$$;
revoke all on function public.bb_my_committee_id() from public;
grant execute on function public.bb_my_committee_id() to authenticated;

-- Replace the fail-closed Kagawad record policies with committee-aware versions.
drop policy if exists bb_pre_blotter_read on public.pre_blotters;
create policy bb_pre_blotter_read on public.pre_blotters for select to authenticated using (
  user_id=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('sinuri','under review','pending')))
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and public.bb_case_assigned_to_me('pre_blotters',reference_no) and lower(status) in ('inimbestigahan','investigating'))
  or (public.bb_current_role()='Sangguniang Barangay Kagawad' and committee_id is not null and committee_id=public.bb_my_committee_id())
);

drop policy if exists bb_reports_read on public.reports;
create policy bb_reports_read on public.reports for select to authenticated using (
  user_id=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('sinuri','under review','pending')))
  or (public.bb_current_role()='Lupong Tagapamayapa Member' and public.bb_case_assigned_to_me('reports',reference_no) and lower(status) in ('inimbestigahan','investigating'))
  or (public.bb_current_role()='Sangguniang Barangay Kagawad' and committee_id is not null and committee_id=public.bb_my_committee_id())
);

drop policy if exists bb_complaints_read on public.service_complaints;
create policy bb_complaints_read on public.service_complaints for select to authenticated using (
  user_id=auth.uid() or public.bb_current_role() in ('System Administrator','Barangay Secretary','Punong Barangay (Barangay Captain)')
  or (public.bb_current_role()='Tanod / BPSO' and (user_id=auth.uid() or lower(status) in ('under review','pending')))
  or (public.bb_current_role()='Sangguniang Barangay Kagawad' and committee_id is not null and committee_id=public.bb_my_committee_id())
);

create or replace function public.bb_assign_user_committee(target_user_id uuid, target_committee_id smallint)
returns boolean language plpgsql security definer set search_path=public,pg_catalog set row_security=off as $$
begin
  if public.bb_current_role()<>'System Administrator' then raise exception 'Only the System Administrator may assign committees' using errcode='42501'; end if;
  if target_committee_id is not null and not exists(select 1 from public.barangay_committees where committee_id=target_committee_id and is_active) then raise exception 'Invalid committee'; end if;
  if target_committee_id is not null and not exists(
    select 1 from public.users u join public.roles r on r.role_id=u.role_id where u.id=target_user_id and r.role_name in ('Kagawad','Kagawad (Committee Chair)','Sangguniang Barangay Kagawad')
  ) then raise exception 'Only a Kagawad account may receive a committee assignment'; end if;
  update public.users set committee_id=target_committee_id,updated_at=now() where id=target_user_id;
  return found;
end $$;
revoke all on function public.bb_assign_user_committee(uuid,smallint) from public;
grant execute on function public.bb_assign_user_committee(uuid,smallint) to authenticated;

create or replace function public.bb_assign_record_committee(p_source text,p_record_key text,p_committee_id smallint)
returns boolean language plpgsql security definer set search_path=public,pg_catalog set row_security=off as $$
declare changed integer:=0;
begin
  if public.bb_current_role()<>'System Administrator' then raise exception 'Only the System Administrator may tag committee records' using errcode='42501'; end if;
  if p_committee_id is not null and not exists(select 1 from public.barangay_committees where committee_id=p_committee_id and is_active) then raise exception 'Invalid committee'; end if;
  if p_source='pre_blotters' then update public.pre_blotters set committee_id=p_committee_id where reference_no=p_record_key or blotter_id::text=p_record_key;
  elsif p_source='reports' then update public.reports set committee_id=p_committee_id where reference_no=p_record_key or id::text=p_record_key;
  elsif p_source='service_complaints' then update public.service_complaints set committee_id=p_committee_id where reference_no=p_record_key or complaint_id::text=p_record_key;
  else raise exception 'Unsupported record source'; end if;
  get diagnostics changed=row_count;
  return changed>0;
end $$;
revoke all on function public.bb_assign_record_committee(text,text,smallint) from public;
grant execute on function public.bb_assign_record_committee(text,text,smallint) to authenticated;

notify pgrst,'reload schema';
