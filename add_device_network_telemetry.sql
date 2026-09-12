-- ==============================================================================
-- ASAHEEB CRM - DEVICE & NETWORK TELEMETRY UPGRADE FOR ATTENDANCE
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Add Device & Network Telemetry columns to public.attendance_logs
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS punch_in_device_info jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS punch_in_network_info jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS punch_in_ip text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS punch_out_device_info jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS punch_out_network_info jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS punch_out_ip text DEFAULT NULL;

-- 2. Add documentation comments
COMMENT ON COLUMN public.attendance_logs.punch_in_device_info IS 'JSON containing client device specs (OS, browser, screen, cores, RAM, form factor) recorded at punch-in';
COMMENT ON COLUMN public.attendance_logs.punch_in_network_info IS 'JSON containing network details (connection type, effective speed, RTT latency) recorded at punch-in';
COMMENT ON COLUMN public.attendance_logs.punch_in_ip IS 'Public IP address of the client at punch-in';

COMMENT ON COLUMN public.attendance_logs.punch_out_device_info IS 'JSON containing client device specs (OS, browser, screen, cores, RAM, form factor) recorded at punch-out';
COMMENT ON COLUMN public.attendance_logs.punch_out_network_info IS 'JSON containing network details (connection type, effective speed, RTT latency) recorded at punch-out';
COMMENT ON COLUMN public.attendance_logs.punch_out_ip IS 'Public IP address of the client at punch-out';

-- 3. Optional index for IP audit queries
CREATE INDEX IF NOT EXISTS idx_attendance_punch_in_ip ON public.attendance_logs(punch_in_ip);
CREATE INDEX IF NOT EXISTS idx_attendance_punch_out_ip ON public.attendance_logs(punch_out_ip);
