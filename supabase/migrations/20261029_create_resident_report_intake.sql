-- New canonical intake table for future mobile and admin integration.
-- Existing reports, service_complaints, and pre_blotters are not changed.
create table public.resident_report_intake (
  id uuid primary key default gen_random_uuid(),
  report_type text not null
    check (report_type in ('service_complaint', 'blotter')),
  reference_no text not null unique,
  user_id uuid not null,
  status text not null default 'Under Review',
  category text not null,
  summary text not null,
  description text not null,
  location_label text,
  location_address text,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  evidence_paths text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resident_report_intake_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  ),
  constraint resident_report_intake_latitude_range check (
    latitude is null or latitude between -90 and 90
  ),
  constraint resident_report_intake_longitude_range check (
    longitude is null or longitude between -180 and 180
  )
);

create index resident_report_intake_type_created_idx
  on public.resident_report_intake (report_type, created_at desc);

create index resident_report_intake_user_created_idx
  on public.resident_report_intake (user_id, created_at desc);

alter table public.resident_report_intake enable row level security;

-- No client policies yet: the new table remains private and empty until the
-- mobile/admin read and write flows are deliberately migrated to it.
revoke all on public.resident_report_intake from anon, authenticated;
