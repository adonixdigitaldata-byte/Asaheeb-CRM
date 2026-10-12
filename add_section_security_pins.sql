-- ============================================================
-- ASAHEEB CRM — DISTINCT SECURITY PINS FOR PROFILES
-- Adds distinct 4-digit PIN columns for Expenses, Attendance, and Commissions
-- Default for all is '1234'
-- ============================================================

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS expenses_pin text DEFAULT '1234',
  ADD COLUMN IF NOT EXISTS attendance_pin text DEFAULT '1234',
  ADD COLUMN IF NOT EXISTS commissions_pin text DEFAULT '1234';

-- Ensure existing rows get default '1234' if null
UPDATE profiles SET expenses_pin = '1234' WHERE expenses_pin IS NULL;
UPDATE profiles SET attendance_pin = '1234' WHERE attendance_pin IS NULL;
UPDATE profiles SET commissions_pin = '1234' WHERE commissions_pin IS NULL;
