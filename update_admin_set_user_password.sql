-- ==============================================================
-- BOSESBANTAY: ADMIN DIRECT PASSWORD RESET FUNCTION
-- ==============================================================
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard -> SQL Editor.
-- 2. Paste the SQL code below and click "Run".
-- ==============================================================

CREATE OR REPLACE FUNCTION public.admin_set_user_password(
    target_user_id UUID, 
    new_password TEXT, 
    must_change_pw BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner (superuser) privileges to modify auth.users
SET search_path = public, pg_catalog, auth, extensions
AS $$
DECLARE
    caller_role VARCHAR(50);
BEGIN
    -- Get the role name of the currently logged-in admin user
    SELECT r.role_name INTO caller_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.role_id
    WHERE u.id = auth.uid();
    
    -- Only allow System Administrator, Barangay Captain, or Barangay Secretary
    IF caller_role IS NULL OR caller_role NOT IN ('System Administrator', 'Barangay Captain', 'Barangay Secretary') THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can update user passwords.';
    END IF;
    
    -- Update the password and must_change_password flag in auth.users
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf', 10)),
        raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{must_change_password}',
            to_jsonb(must_change_pw)
        ),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;
