-- ==============================================================================
-- ASAHEEB CRM - ATTENDANCE REGULARIZATION REQUESTS TABLE
-- Run this in your Supabase Project SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_regularization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  shift_date date NOT NULL,
  
  -- Requested Shift Times
  requested_punch_in timestamptz NOT NULL,
  requested_punch_out timestamptz NOT NULL,
  requested_duration_minutes integer NOT NULL DEFAULT 0,
  
  -- Employee Reason
  reason text NOT NULL,
  
  -- Status: PENDING, APPROVED, REJECTED
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  
  -- Admin Review Audit
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  admin_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_reg_requests_user ON public.attendance_regularization_requests(user_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_reg_requests_status ON public.attendance_regularization_requests(status);
CREATE INDEX IF NOT EXISTS idx_reg_requests_date ON public.attendance_regularization_requests(shift_date DESC);

-- Enforce ONLY ONE active pending regularization request at a time per user per shift
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_pending_reg_per_shift 
  ON public.attendance_regularization_requests(user_id, shift_date) 
  WHERE (status = 'PENDING');

-- Enable RLS
ALTER TABLE public.attendance_regularization_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow users to view own or admins/managers to view all regularizations" ON public.attendance_regularization_requests;
CREATE POLICY "Allow users to view own or admins/managers to view all regularizations"
  ON public.attendance_regularization_requests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
      AND public.profiles.role IN ('ADMIN', 'SALES_MANAGER')
    )
  );

DROP POLICY IF EXISTS "Allow users to create regularization requests" ON public.attendance_regularization_requests;
CREATE POLICY "Allow users to create regularization requests"
  ON public.attendance_regularization_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
      AND public.profiles.role IN ('ADMIN')
    )
  );

DROP POLICY IF EXISTS "Allow admins to update regularization requests" ON public.attendance_regularization_requests;
CREATE POLICY "Allow admins to update regularization requests"
  ON public.attendance_regularization_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
      AND public.profiles.role IN ('ADMIN', 'SALES_MANAGER')
    )
    OR user_id = auth.uid()
  );
