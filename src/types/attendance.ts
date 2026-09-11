export interface CompanyLocation {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type AttendancePunchStatus = 'APPROVED' | 'PENDING_REVIEW' | 'FLAGGED'

export interface AttendanceLog {
  id: string
  user_id: string
  date: string
  
  // Punch In
  punch_in_at: string | null
  punch_in_lat: number | null
  punch_in_lng: number | null
  punch_in_accuracy: number | null
  punch_in_distance_m: number | null
  punch_in_selfie_url: string | null
  punch_in_status: AttendancePunchStatus
  punch_in_reason: string | null
  punch_in_explanation: string | null

  // Punch Out
  punch_out_at: string | null
  punch_out_lat: number | null
  punch_out_lng: number | null
  punch_out_accuracy: number | null
  punch_out_distance_m: number | null
  punch_out_selfie_url: string | null
  punch_out_status: AttendancePunchStatus | null
  punch_out_reason: string | null
  punch_out_explanation: string | null
  punch_in_face_match_score?: number | null
  punch_out_face_match_score?: number | null

  // Work Duration & Review
  total_working_minutes: number
  is_auto_closed?: boolean
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null

  created_at: string
  updated_at: string

  // Joined profile fields (optional)
  employee_name?: string
  employee_email?: string
  employee_role?: string
  employee_avatar?: string
}

export type LeaveType = 'ANNUAL' | 'SICK' | 'UNPAID' | 'EMERGENCY'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface LeaveBalance {
  id: string
  user_id: string
  year: number
  annual_leave_total: number
  annual_leave_used: number
  sick_leave_total: number
  sick_leave_used: number
  unpaid_leave_used: number
  emergency_leave_used: number
  created_at?: string
  updated_at?: string
}

export interface LeaveRequest {
  id: string
  user_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: LeaveStatus
  approved_by: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string

  // Joined employee info
  employee_name?: string
  employee_email?: string
  employee_role?: string
  employee_avatar?: string
}

export type LiveAttendanceStatus = 'PRESENT_HQ' | 'PRESENT_REMOTE' | 'ON_LEAVE' | 'NOT_PUNCHED'

export interface RosterEmployee {
  profile_id: string
  name: string
  email: string
  role: string
  avatar_url: string | null
  work_status: string // 'AVAILABLE', 'BUSY', 'ON_LEAVE'
  today_log: AttendanceLog | null
  live_status: LiveAttendanceStatus
  active_minutes: number
  face_enrolled_at?: string | null
  has_face_id?: boolean
}

export const EXCEPTION_REASONS = [
  'Client / Business meeting',
  'Field work / Site inspection',
  'Property viewing / Villa tour',
  'Authorized remote work',
  'Traveling / returning from work',
  'Other',
] as const

export type ExceptionReason = typeof EXCEPTION_REASONS[number]

export interface DayShiftTiming {
  startTime: string // '09:00'
  endTime: string // '17:00'
  hours: number // 8.0
}

export interface CompanyHoliday {
  id: string
  name: string
  date: string // 'YYYY-MM-DD'
}

export interface CompanyWorkPolicy {
  id: string
  company_name: string
  work_days: string[] // e.g. ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']
  daily_expected_hours: number // e.g. 8.0 default
  shift_start_time: string // '09:00:00'
  shift_end_time: string // '17:00:00'
  grace_period_mins: number // 15
  default_annual_leave_quota: number // 21
  default_sick_leave_quota: number // 30
  custom_day_hours?: Record<string, number> // e.g. { 'THURSDAY': 6.0, 'SATURDAY': 4.0 }
  custom_day_schedules?: Record<string, DayShiftTiming>
  official_holidays?: CompanyHoliday[]
  updated_at?: string
}

export interface MonthlyWorkHoursAudit {
  employee_id: string
  employee_name: string
  employee_email: string
  employee_role: string
  month: string // 'YYYY-MM'
  expected_working_days: number
  expected_total_hours: number
  expected_to_date_hours: number
  elapsed_working_days: number
  actual_worked_hours: number
  approved_leave_hours: number
  non_working_hours: number // Shortfall hours to-date (Lost/Deficit)
  month_to_date_deficit: number
  overtime_hours: number
  attendance_adherence_percent: number
  hourly_rate: number
  estimated_pay_cut: number
  currency: string
  days_present: number
  days_remote: number
  days_late: number
  days_absent: number
}
