-- SQL Migration to support persistent hearing scheduling dates and details.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query > Run).

-- 1. Update public.pre_blotters table
ALTER TABLE public.pre_blotters ADD COLUMN IF NOT EXISTS hearing_date TIMESTAMPTZ NULL;
ALTER TABLE public.pre_blotters ADD COLUMN IF NOT EXISTS hearing_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pre_blotters ADD COLUMN IF NOT EXISTS hearing_note TEXT NULL;
ALTER TABLE public.pre_blotters ADD COLUMN IF NOT EXISTS outcome TEXT NULL;

-- 2. Update public.reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS hearing_date TIMESTAMPTZ NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS hearing_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS hearing_note TEXT NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS outcome TEXT NULL;
