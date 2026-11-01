-- Add structured audit context, server-derived request IPs, and authentication
-- attempt escalation. Existing audit rows and row-level security policies stay intact.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_name_snapshot text,
  ADD COLUMN IF NOT EXISTS actor_role_snapshot text,
  ADD COLUMN IF NOT EXISTS target_key text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_severity_check;
UPDATE public.audit_logs
SET severity = CASE WHEN severity IN ('warning', 'critical') THEN severity ELSE 'normal' END;
ALTER TABLE public.audit_logs ALTER COLUMN severity SET DEFAULT 'normal';
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_severity_check CHECK (severity IN ('normal', 'warning', 'critical'));

CREATE INDEX IF NOT EXISTS audit_logs_target_key_idx
  ON public.audit_logs (target_table, target_key)
  WHERE target_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_logs_severity_created_idx
  ON public.audit_logs (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_failed_signin_ip_idx
  ON public.audit_logs (ip_address, created_at DESC)
  WHERE action_type IN ('login_failure', 'login_2fa_failure');

-- Capture the request address from headers exposed by Supabase's API gateway;
-- never accept an IP value submitted in the audit row itself.
CREATE OR REPLACE FUNCTION public.capture_audit_request_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_headers jsonb := '{}'::jsonb;
  raw_ip text;
  failed_count integer := 1;
BEGIN
  BEGIN
    request_headers := COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    request_headers := '{}'::jsonb;
  END;

  raw_ip := NULLIF(BTRIM(request_headers->>'cf-connecting-ip'), '');
  IF raw_ip IS NULL THEN
    raw_ip := NULLIF(BTRIM(SPLIT_PART(COALESCE(request_headers->>'x-forwarded-for', ''), ',', 1)), '');
  END IF;

  BEGIN
    NEW.ip_address := raw_ip::inet;
  EXCEPTION WHEN invalid_text_representation THEN
    NEW.ip_address := NULL;
  END;

  IF NEW.action_type IN ('login_failure', 'login_2fa_failure') THEN
    IF NEW.ip_address IS NOT NULL THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.ip_address::text));
      SELECT COUNT(*) + 1 INTO failed_count
      FROM public.audit_logs
      WHERE ip_address = NEW.ip_address
        AND action_type IN ('login_failure', 'login_2fa_failure')
        AND created_at >= NOW() - INTERVAL '10 minutes';
    END IF;

    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
      || jsonb_build_object('failed_attempts_last_10m', failed_count);
    NEW.severity := CASE WHEN failed_count >= 5 THEN 'critical' ELSE 'warning' END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_audit_request_context() FROM PUBLIC;
DROP TRIGGER IF EXISTS audit_logs_capture_request_context ON public.audit_logs;
CREATE TRIGGER audit_logs_capture_request_context
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_audit_request_context();
