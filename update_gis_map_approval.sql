-- GIS Command Center: map-approval workflow for incoming Digital Blotter reports.
-- Incoming pre_blotters rows must be reviewed before they are plotted on the
-- public Incident Hotspot / Pin Mapping map.

ALTER TABLE public.pre_blotters
    ADD COLUMN IF NOT EXISTS map_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    ADD COLUMN IF NOT EXISTS map_reviewed_by UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS map_reviewed_at TIMESTAMPTZ NULL;

-- Grandfather existing rows so already-live pins don't vanish from the map
-- the moment this migration runs; only new incoming reports start Pending.
UPDATE public.pre_blotters SET map_status = 'Approved', map_reviewed_at = NOW()
WHERE map_status = 'Pending';
