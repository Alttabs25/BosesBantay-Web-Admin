-- ==========================================
-- BOSESBANTAY: EMAIL 2FA SETUP (USING RESEND)
-- ==========================================
-- 
-- INSTRUCTIONS FOR SETUP:
-- 1. Go to your Supabase Dashboard -> Database -> Extensions.
-- 2. Search for and enable the "pg_net" extension (allows database HTTP requests).
-- 3. In the Supabase SQL Editor, run this script.
-- 4. Set your Resend API Key in the database by running:
--    INSERT INTO public.app_settings (key, value) 
--    VALUES ('resend_api_key', 're_your_actual_resend_api_key')
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- 5. Set your custom sender email if verified on Resend (Optional):
--    INSERT INTO public.app_settings (key, value) 
--    VALUES ('resend_from_email', 'BosesBantay Security <security@yourverifieddomain.com>')
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 1. Create table for system configurations
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Enable Row Level Security (RLS) on settings
-- (With no policies created, only database-level/security-definer functions or SQL Editor can read/write this table)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Create table for temporary 2FA codes
CREATE TABLE IF NOT EXISTS public.temp_2fa_codes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on temporary codes
ALTER TABLE public.temp_2fa_codes ENABLE ROW LEVEL SECURITY;

-- 3. Create database function to generate 2FA and send via Resend
CREATE OR REPLACE FUNCTION public.send_2fa_code(admin_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner privileges
AS $$
DECLARE
    generated_code VARCHAR(6);
    resend_api_key TEXT;
    resend_from_email TEXT;
BEGIN
    admin_email := lower(trim(admin_email));

    -- Retrieve Resend API Key from database settings table
    SELECT value INTO resend_api_key FROM public.app_settings WHERE key = 'resend_api_key';
    
    IF resend_api_key IS NULL OR resend_api_key = '' THEN
        RAISE EXCEPTION 'Resend API Key is not configured. Please insert your key into public.app_settings.';
    END IF;

    -- Retrieve custom verified domain sender if configured, otherwise fallback to Resend Sandbox onboarding address
    SELECT value INTO resend_from_email FROM public.app_settings WHERE key = 'resend_from_email';
    IF resend_from_email IS NULL OR resend_from_email = '' THEN
        resend_from_email := 'BosesBantay Security <onboarding@resend.dev>';
    END IF;

    -- Generate a secure 6-digit random code
    generated_code := lpad(floor(random() * 1000000)::text, 6, '0');
    
    -- Clear any existing codes for this email
    DELETE FROM public.temp_2fa_codes WHERE email = admin_email;
    
    -- Insert new verification code (expires in 5 minutes)
    INSERT INTO public.temp_2fa_codes (email, code, expires_at)
    VALUES (admin_email, generated_code, NOW() + INTERVAL '5 minutes');
    
    -- Make HTTP POST request to Resend API asynchronously using pg_net extension
    PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || resend_api_key,
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'from', resend_from_email,
            'to', array[admin_email],
            'subject', 'BosesBantay Command Center - 2FA Security Code',
            'html', '<div style="font-family: system-ui, -apple-system, sans-serif; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; max-width: 480px; margin: 20px auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">' ||
                    '<div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px;">' ||
                    '<h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">BosesBantay</h2>' ||
                    '<p style="color: #6b7280; font-size: 14px; margin: 4px 0 0 0; font-weight: 500;">Administrative Command Center Security</p>' ||
                    '</div>' ||
                    '<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Isang request para mag-login ang natanggap mula sa iyong account. Gamitin ang verification code sa ibaba para makapasok sa dashboard:</p>' ||
                    '<div style="background-color: #f3f4f6; text-align: center; padding: 18px; font-size: 32px; font-weight: 800; letter-spacing: 8px; border-radius: 8px; margin: 24px 0; color: #1e3a8a; border: 1px solid #e5e7eb; font-family: monospace;">' || generated_code || '</div>' ||
                    '<p style="color: #ef4444; font-size: 13px; font-weight: 600; margin: 0 0 8px 0; text-align: center;">Ang code na ito ay may bisa lamang sa loob ng 5 minuto.</p>' ||
                    '<p style="color: #9ca3af; font-size: 12px; line-height: 1.4; text-align: center; margin: 0;">Kung hindi ikaw ang nag-request nito, mangyaring palitan kaagad ang iyong password at makipag-ugnayan sa Administrator.</p>' ||
                    '</div>'
        )
    );
    
    RETURN TRUE;
END;
$$;

-- 4. Create database function to verify the entered 2FA code
CREATE OR REPLACE FUNCTION public.verify_2fa_code(admin_email TEXT, input_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner privileges
AS $$
DECLARE
    is_valid BOOLEAN;
BEGIN
    admin_email := lower(trim(admin_email));
    input_code := trim(input_code);

    -- Check if there is a matching, unexpired code
    SELECT EXISTS (
        SELECT 1 
        FROM public.temp_2fa_codes 
        WHERE email = admin_email 
          AND code = input_code 
          AND expires_at > NOW()
    ) INTO is_valid;
    
    -- If valid, delete it immediately to prevent reuse
    IF is_valid THEN
        DELETE FROM public.temp_2fa_codes WHERE email = admin_email;
    END IF;
    
    RETURN is_valid;
END;
$$;
