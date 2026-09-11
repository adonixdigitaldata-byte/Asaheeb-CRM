-- ==============================================================================
-- ASAHEEB CRM - OFFICIAL COMPANY HOLIDAYS DATABASE MIGRATION
-- Run this in your Supabase Project SQL Editor
-- ==============================================================================

-- 1. Create company_holidays table
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Allow authenticated to view holidays" ON public.company_holidays;
CREATE POLICY "Allow authenticated to view holidays"
  ON public.company_holidays FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admins to manage holidays" ON public.company_holidays;
CREATE POLICY "Allow admins to manage holidays"
  ON public.company_holidays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
      AND public.profiles.role IN ('ADMIN', 'SALES_MANAGER')
    )
  );

-- 4. Preload Standard Saudi Official Holidays
INSERT INTO public.company_holidays (name, date) VALUES
  ('Saudi Founding Day', '2026-02-22'),
  ('Eid Al-Fitr Holiday', '2026-03-20'),
  ('Eid Al-Fitr Holiday', '2026-03-22'),
  ('Eid Al-Fitr Holiday', '2026-03-23'),
  ('Arafat Day', '2026-05-26'),
  ('Eid Al-Adha Holiday', '2026-05-27'),
  ('Eid Al-Adha Holiday', '2026-05-28'),
  ('Eid Al-Adha Holiday', '2026-05-29'),
  ('Saudi National Day', '2026-09-23')
ON CONFLICT (date) DO NOTHING;
