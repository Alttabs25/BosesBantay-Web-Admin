-- Optional personal information used by Profile Management.
-- Every statement is idempotent so this migration is safe to run more than once.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS civil_status VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS birthdate DATE NULL,
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS address TEXT NULL;

COMMENT ON COLUMN public.users.gender IS 'Optional self-described gender for the staff or resident profile.';
COMMENT ON COLUMN public.users.civil_status IS 'Optional civil status shown in Profile Management.';
COMMENT ON COLUMN public.users.birthdate IS 'Optional date of birth; age is calculated by the application.';
COMMENT ON COLUMN public.users.mobile_number IS 'Optional contact number for the user profile.';
COMMENT ON COLUMN public.users.address IS 'Optional current address for the user profile.';

-- Legacy staff placeholders should appear as blank fields in Profile Management.
UPDATE public.users
SET address = ''
WHERE address = 'N/A'
  AND role_id IN (
    SELECT role_id
    FROM public.roles
    WHERE role_name <> 'Residente'
  );

-- Ask PostgREST/Supabase to recognize the new columns without waiting for its
-- normal schema-cache refresh interval.
NOTIFY pgrst, 'reload schema';
