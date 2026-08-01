-- Enable PostGIS extension for Sector boundaries/GIS (if needed)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. ROLES TABLE
CREATE TABLE IF NOT EXISTS public.roles (
    role_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255) NULL
);

-- Insert Default Roles matching permissions.js
INSERT INTO public.roles (role_name, description) VALUES
('Residente', 'Standard community resident'),
('Barangay Secretary', 'Handles verification and documents'),
('Tanod / BPSO', 'Field and safety responder'),
('Lupon Member', 'Peace and justice conciliation member'),
('Kagawad (Committee Chair)', 'Barangay Councilor'),
('Barangay Captain', 'Barangay Captain / Approver'),
('System Administrator', 'System administrator')
ON CONFLICT (role_name) DO NOTHING;

-- 2. USERS TABLE (Integrated with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INT REFERENCES public.roles(role_id),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    suffix VARCHAR(20) NULL,
    gender VARCHAR(20) NULL,
    birthdate DATE NULL,
    mobile_number VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    barangay_id_image TEXT NULL, -- changed to NULL for easy initial admin seedings
    verification_status VARCHAR(20) DEFAULT 'Pending',
    approval_status VARCHAR(20) DEFAULT 'Pending',
    verified_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BARANGAY SECTORS
CREATE TABLE IF NOT EXISTS public.barangay_sectors (
    sector_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sector_name VARCHAR(100) NOT NULL,
    boundary TEXT NULL -- Can be converted to GEOMETRY(Polygon, 4326) if PostGIS is enabled
);

-- 4. VOICE RECORDINGS
CREATE TABLE IF NOT EXISTS public.voice_recordings (
    recording_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    audio_file TEXT NOT NULL,
    duration INTEGER NULL,
    language_detected VARCHAR(50) NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRANSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.transcriptions (
    transcription_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recording_id BIGINT REFERENCES public.voice_recordings(recording_id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    model_used VARCHAR(100) NULL,
    confidence_score DECIMAL(5,2) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AI EXTRACTION
CREATE TABLE IF NOT EXISTS public.ai_extractions (
    extraction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transcription_id BIGINT REFERENCES public.transcriptions(transcription_id) ON DELETE CASCADE,
    incident_type VARCHAR(100) NULL,
    incident_datetime TIMESTAMPTZ NULL,
    incident_location TEXT NULL,
    complainant VARCHAR(255) NULL,
    respondent VARCHAR(255) NULL,
    narrative_summary TEXT NULL,
    json_output JSONB NULL,
    is_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PRE-BLOTTERS
CREATE TABLE IF NOT EXISTS public.pre_blotters (
    blotter_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    extraction_id BIGINT REFERENCES public.ai_extractions(extraction_id) ON DELETE SET NULL,
    sector_id BIGINT REFERENCES public.barangay_sectors(sector_id),
    latitude DECIMAL(10,8) NULL,
    longitude DECIMAL(11,8) NULL,
    status VARCHAR(50) DEFAULT 'Under Review',
    verified_by UUID REFERENCES public.users(id),
    remarks TEXT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SERVICE COMPLAINTS
CREATE TABLE IF NOT EXISTS public.service_complaints (
    complaint_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference_no VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    sector_id BIGINT REFERENCES public.barangay_sectors(sector_id),
    category VARCHAR(100) NULL,
    description TEXT NOT NULL,
    location TEXT NULL,
    latitude DECIMAL(10,8) NULL,
    longitude DECIMAL(11,8) NULL,
    status VARCHAR(50) DEFAULT 'Under Review',
    assigned_to UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.status_history (
    history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    blotter_id BIGINT REFERENCES public.pre_blotters(blotter_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    updated_by UUID REFERENCES public.users(id),
    remarks TEXT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
    document_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    ordinance_no VARCHAR(50) NULL,
    section VARCHAR(50) NULL,
    file_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id),
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    approval_status VARCHAR(20) DEFAULT 'Pending',
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 11. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL allowed for global broadcast
    sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. EMERGENCY CONTACTS
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    contact_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agency_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NULL,
    phone_number VARCHAR(20) NOT NULL,
    category VARCHAR(100) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    authorized_by UUID REFERENCES public.users(id)
);

-- 13. ACCOUNT BLOCKS
CREATE TABLE IF NOT EXISTS public.account_blocks (
    block_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    blotter_id BIGINT REFERENCES public.pre_blotters(blotter_id),
    blocked_by UUID REFERENCES public.users(id),
    reason TEXT NULL,
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    lifted_at TIMESTAMPTZ NULL
);

-- 14. LOGIN LOGS
CREATE TABLE IF NOT EXISTS public.login_logs (
    log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_time TIMESTAMPTZ NULL,
    ip_address VARCHAR(45) NULL,
    device_info VARCHAR(255) NULL,
    status VARCHAR(20) DEFAULT 'Success'
);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(50) NULL,
    target_id BIGINT NULL,
    details TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. GENERATED REPORTS
CREATE TABLE IF NOT EXISTS public.generated_reports (
    report_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    generated_by UUID REFERENCES public.users(id),
    date_from DATE NULL,
    date_to DATE NULL,
    sector_id BIGINT REFERENCES barangay_sectors(sector_id),
    incident_type_filter VARCHAR(100) NULL,
    file_format VARCHAR(10) DEFAULT 'PDF',
    file_path TEXT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barangay_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_blotters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- Simple permissive RLS policies (adjust in production based on role access)
CREATE POLICY "Allow read access to authenticated users" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Allow select for public.users to authenticated users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow insert/update/delete for users own record" ON public.users 
    FOR ALL USING (auth.uid() = id);

-- Create automatic user profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id INT;
BEGIN
    SELECT role_id INTO default_role_id FROM public.roles WHERE role_name = COALESCE(new.raw_user_meta_data->>'role', 'Residente') LIMIT 1;

    INSERT INTO public.users (
        id,
        role_id,
        first_name,
        last_name,
        email,
        address,
        verification_status,
        approval_status
    ) VALUES (
        new.id,
        default_role_id,
        COALESCE(new.raw_user_meta_data->>'first_name', 'Bago'),
        COALESCE(new.raw_user_meta_data->>'last_name', 'User'),
        new.email,
        COALESCE(new.raw_user_meta_data->>'address', 'N/A'),
        'Pending',
        'Pending'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
