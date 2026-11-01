ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS civil_status VARCHAR(30) NULL;

-- Legacy staff placeholders should appear as blank fields in Profile Management.
UPDATE public.users
SET address = ''
WHERE address = 'N/A'
  AND role_id IN (
    SELECT role_id
    FROM public.roles
    WHERE role_name <> 'Residente'
  );
