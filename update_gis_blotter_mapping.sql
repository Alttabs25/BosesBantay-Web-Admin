-- GIS Command Center & Digital Blotter Integration Migration
-- Extends the incident data model so Digital Blotter and GIS Command Center
-- share the same source of truth for mapped/unmapped incidents.

-- 1. Add GIS mapping columns to pre_blotters table
ALTER TABLE public.pre_blotters
    ADD COLUMN IF NOT EXISTS is_mapped BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mapped_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS mapped_by UUID REFERENCES public.users(id);

-- 2. Add GIS mapping columns to mobile reports table (if resident reports are converted/mapped)
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) NULL,
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL,
    ADD COLUMN IF NOT EXISTS is_mapped BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mapped_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS mapped_by UUID REFERENCES public.users(id);

-- 3. Synchronize existing records: Any pre_blotters that already have valid coordinates
-- and Approved map_status become officially mapped.
UPDATE public.pre_blotters
SET is_mapped = TRUE,
    mapped_at = COALESCE(map_reviewed_at, submitted_at, NOW())
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND (map_status = 'Approved' OR map_status IS NULL);

-- Records without valid coordinates remain unmapped.
UPDATE public.pre_blotters
SET is_mapped = FALSE
WHERE latitude IS NULL OR longitude IS NULL;
