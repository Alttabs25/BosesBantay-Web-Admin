-- 1. DISABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- (This ensures the admin portal can fetch and update all tables successfully without RLS policies blocking reads/writes. You can re-enable and configure granular RLS policies when preparing for production).
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.barangay_sectors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_recordings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_extractions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_blotters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports DISABLE ROW LEVEL SECURITY;


-- 2. CREATE THE USER CREATION TRIGGER FUNCTION
-- (This ensures that new admin users created without an ID image will default to 'N/A' instead of crashing the trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id INT;
BEGIN
    -- Map user metadata role to database role, defaulting to 'Residente'
    SELECT role_id INTO default_role_id 
    FROM public.roles 
    WHERE role_name = COALESCE(new.raw_user_meta_data->>'role', 'Residente') 
    LIMIT 1;

    INSERT INTO public.users (
        id,
        role_id,
        first_name,
        last_name,
        email,
        address,
        barangay_id_image,
        verification_status,
        approval_status
    ) VALUES (
        new.id,
        default_role_id,
        COALESCE(new.raw_user_meta_data->>'first_name', 'Bago'),
        COALESCE(new.raw_user_meta_data->>'last_name', 'User'),
        new.email,
        COALESCE(new.raw_user_meta_data->>'address', 'N/A'),
        COALESCE(new.raw_user_meta_data->>'barangay_id_image', 'N/A'), -- Defaults to 'N/A' if none provided
        'Pending',
        'Pending'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ATTACH THE TRIGGER TO auth.users
-- (This is the critical step that actually hooks up the trigger to fire on user creation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 4. UPDATE EXISTING ROLE NAMES TO ALIGN WITH REACT CONSTANTS
UPDATE public.roles SET role_name = 'Residente' WHERE role_name = 'Resident';
UPDATE public.roles SET role_name = 'Tanod / BPSO' WHERE role_name = 'Tanod/BPSO';
UPDATE public.roles SET role_name = 'Kagawad (Committee Chair)' WHERE role_name = 'Kagawad';
UPDATE public.roles SET role_name = 'Barangay Captain' WHERE role_name = 'Punong Barangay';
UPDATE public.roles SET role_name = 'System Administrator' WHERE role_name = 'System Admin';


-- 5. UTILITY FUNCTION FOR REMOTE DIAGNOSTICS (Bypasses RLS to see DB rows)
CREATE OR REPLACE FUNCTION public.get_all_users_bypass_rls()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT json_agg(u) INTO result FROM (
        SELECT u.*, r.role_name
        FROM public.users u
        LEFT JOIN public.roles r ON u.role_id = r.role_id
    ) u;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. UTILITY FUNCTION TO CHECK POLICIES
CREATE OR REPLACE FUNCTION public.get_users_policies()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT json_agg(p) INTO result FROM pg_policies p WHERE tablename = 'users';
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
