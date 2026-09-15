-- GIS Command Center & Digital Blotter Integration Migration
-- Connects the Digital Blotter and Geospatial Governance Command Center (GIS Dashboard).
-- Single source of truth: only verified/confirmed incidents (Investigating / Resolved)
-- can have is_mapped = true and be plotted on the GIS map.

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

-- 3. Synchronize existing records:
-- Only officially verified/confirmed pre_blotters (Investigating / Resolved)
-- that have valid coordinates become officially mapped.
UPDATE public.pre_blotters
SET is_mapped = TRUE,
    mapped_at = COALESCE(map_reviewed_at, submitted_at, NOW())
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND status NOT IN ('Sinuri', 'Under Review', 'Pending', 'Spam')
  AND (map_status = 'Approved' OR map_status IS NULL);

-- Records that are still Under Review (Sinuri), Spam, or lack valid coordinates remain unmapped.
UPDATE public.pre_blotters
SET is_mapped = FALSE
WHERE latitude IS NULL 
   OR longitude IS NULL 
   OR status IN ('Sinuri', 'Under Review', 'Pending', 'Spam');

-- Add performance indexes for GIS queries
CREATE INDEX IF NOT EXISTS idx_pre_blotters_is_mapped ON public.pre_blotters (is_mapped);
CREATE INDEX IF NOT EXISTS idx_pre_blotters_coords ON public.pre_blotters (latitude, longitude) WHERE is_mapped = TRUE;
