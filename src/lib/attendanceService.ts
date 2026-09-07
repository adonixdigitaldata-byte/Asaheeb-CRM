import { createClient } from '@/lib/supabase/client'
import {
  CompanyLocation,
  AttendanceLog,
  AttendancePunchStatus,
  LeaveBalance,
  LeaveRequest,
  RosterEmployee,
  LiveAttendanceStatus,
  CompanyWorkPolicy,
  MonthlyWorkHoursAudit,
} from '@/types/attendance'
import { DEFAULT_JEDDAH_HQ } from '@/lib/geoUtils'

const LOCAL_OFFICE_KEY = 'asaheeb_crm_office_location_v1'
const LOCAL_ATTENDANCE_KEY = 'asaheeb_crm_attendance_logs_v1'
const LOCAL_LEAVE_BALANCES_KEY = 'asaheeb_crm_leave_balances_v1'
const LOCAL_LEAVE_REQUESTS_KEY = 'asaheeb_crm_leave_requests_v1'

// ==========================================
// LOCAL STORAGE FALLBACK HELPERS
// ==========================================
function getLocalOffice(): CompanyLocation {
  if (typeof window === 'undefined') {
    return {
      id: 'default-jeddah',
      ...DEFAULT_JEDDAH_HQ,
      is_active: true,
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_OFFICE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return {
    id: 'default-jeddah',
    ...DEFAULT_JEDDAH_HQ,
    is_active: true,
  }
}

function saveLocalOffice(loc: CompanyLocation) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_OFFICE_KEY, JSON.stringify(loc))
  } catch (e) {
    console.error(e)
  }
}

function getLocalAttendance(): AttendanceLog[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_ATTENDANCE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return []
}

function saveLocalAttendance(logs: AttendanceLog[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(logs))
  } catch (e) {
    console.error(e)
  }
}

function getLocalLeaveBalances(): LeaveBalance[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_LEAVE_BALANCES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return []
}

function saveLocalLeaveBalances(balances: LeaveBalance[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_LEAVE_BALANCES_KEY, JSON.stringify(balances))
  } catch (e) {
    console.error(e)
  }
}

function getLocalLeaveRequests(): LeaveRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_LEAVE_REQUESTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return []
}

function saveLocalLeaveRequests(reqs: LeaveRequest[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_LEAVE_REQUESTS_KEY, JSON.stringify(reqs))
  } catch (e) {
    console.error(e)
  }
}

// ==========================================
// 1. OFFICE GEOFENCE & LOCATION API
// ==========================================
export async function fetchOfficeLocation(): Promise<CompanyLocation> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('company_locations')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      saveLocalOffice(data as CompanyLocation)
      return data as CompanyLocation
    }
  } catch (err) {
    console.warn('Using local office location fallback:', err)
  }
  return getLocalOffice()
}

export async function saveOfficeLocation(
  loc: Partial<CompanyLocation> & { latitude: number; longitude: number; radius_meters: number }
): Promise<CompanyLocation> {
  const payload = {
    name: loc.name || DEFAULT_JEDDAH_HQ.name,
    address: loc.address || DEFAULT_JEDDAH_HQ.address,
    latitude: loc.latitude,
    longitude: loc.longitude,
    radius_meters: loc.radius_meters,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  try {
    const supabase = createClient()
    const existing = await fetchOfficeLocation()
    let resData: CompanyLocation | null = null

    if (existing?.id && existing.id !== 'default-jeddah') {
      const { data, error } = await supabase
        .from('company_locations')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (!error && data) resData = data as CompanyLocation
    } else {
      const { data, error } = await supabase
        .from('company_locations')
        .insert(payload)
        .select()
        .single()
      if (!error && data) resData = data as CompanyLocation
    }

    if (resData) {
      saveLocalOffice(resData)
      return resData
    }
  } catch (err) {
    console.warn('Supabase office save failed, saving locally:', err)
  }

  const fallback: CompanyLocation = {
    id: loc.id || 'default-jeddah',
    name: payload.name,
    address: payload.address,
    latitude: payload.latitude,
    longitude: payload.longitude,
    radius_meters: payload.radius_meters,
    is_active: true,
    updated_at: payload.updated_at,
  }
  saveLocalOffice(fallback)
  return fallback
}

// ==========================================
// 2. DAILY PUNCH-IN & PUNCH-OUT API
// ==========================================
export async function fetchTodayAttendance(userId: string): Promise<AttendanceLog | null> {
  const todayStr = new Date().toISOString().split('T')[0]
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle()

    if (!error && data) {
      return data as AttendanceLog
    }
  } catch (err) {
    console.warn('Supabase attendance fetch failed, checking local:', err)
  }

  const logs = getLocalAttendance()
  return logs.find((l) => l.user_id === userId && l.date === todayStr) || null
}

export async function submitPunchIn(params: {
  userId: string
  latitude: number
  longitude: number
  accuracy?: number
  distanceMeters: number
  isInsideGeofence: boolean
  selfieUrl: string | null
  reason?: string
  explanation?: string
}): Promise<AttendanceLog> {
  const todayStr = new Date().toISOString().split('T')[0]
  const punchStatus: AttendancePunchStatus = params.isInsideGeofence ? 'APPROVED' : 'PENDING_REVIEW'

  const recordPayload = {
    user_id: params.userId,
    date: todayStr,
    punch_in_at: new Date().toISOString(),
    punch_in_lat: params.latitude,
    punch_in_lng: params.longitude,
    punch_in_accuracy: params.accuracy || null,
    punch_in_distance_m: params.distanceMeters,
    punch_in_selfie_url: params.selfieUrl,
    punch_in_status: punchStatus,
    punch_in_reason: params.reason || null,
    punch_in_explanation: params.explanation || null,
    total_working_minutes: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_logs')
      .upsert(recordPayload, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (!error && data) {
      updateLocalLog(data as AttendanceLog)
      return data as AttendanceLog
    }
  } catch (err) {
    console.warn('Supabase punch in failed, storing locally:', err)
  }

  const localLog: AttendanceLog = {
    id: `local-log-${Date.now()}`,
    ...recordPayload,
    punch_out_at: null,
    punch_out_lat: null,
    punch_out_lng: null,
    punch_out_accuracy: null,
    punch_out_distance_m: null,
    punch_out_selfie_url: null,
    punch_out_status: null,
    punch_out_reason: null,
    punch_out_explanation: null,
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
  }
  updateLocalLog(localLog)
  return localLog
}

export async function submitPunchOut(params: {
  userId: string
  latitude: number
  longitude: number
  accuracy?: number
  distanceMeters: number
  isInsideGeofence: boolean
  selfieUrl: string | null
  reason?: string
  explanation?: string
}): Promise<AttendanceLog> {
  const todayStr = new Date().toISOString().split('T')[0]
  const punchStatus: AttendancePunchStatus = params.isInsideGeofence ? 'APPROVED' : 'PENDING_REVIEW'
  const currentRecord = await fetchTodayAttendance(params.userId)

  let minutes = 0
  if (currentRecord?.punch_in_at) {
    const inTime = new Date(currentRecord.punch_in_at).getTime()
    const outTime = Date.now()
    minutes = Math.max(1, Math.round((outTime - inTime) / (1000 * 60)))
  }

  const updatePayload = {
    punch_out_at: new Date().toISOString(),
    punch_out_lat: params.latitude,
    punch_out_lng: params.longitude,
    punch_out_accuracy: params.accuracy || null,
    punch_out_distance_m: params.distanceMeters,
    punch_out_selfie_url: params.selfieUrl,
    punch_out_status: punchStatus,
    punch_out_reason: params.reason || null,
    punch_out_explanation: params.explanation || null,
    total_working_minutes: minutes,
    updated_at: new Date().toISOString(),
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_logs')
      .update(updatePayload)
      .eq('user_id', params.userId)
      .eq('date', todayStr)
      .select()
      .single()

    if (!error && data) {
      updateLocalLog(data as AttendanceLog)
      return data as AttendanceLog
    }
  } catch (err) {
    console.warn('Supabase punch out failed, updating locally:', err)
  }

  if (currentRecord) {
    const updated: AttendanceLog = {
      ...currentRecord,
      ...updatePayload,
    }
    updateLocalLog(updated)
    return updated
  }

  throw new Error('No punch-in record found for today to punch out from.')
}

function updateLocalLog(log: AttendanceLog) {
  const logs = getLocalAttendance()
  const idx = logs.findIndex((l) => l.user_id === log.user_id && l.date === log.date)
  if (idx >= 0) {
    logs[idx] = log
  } else {
    logs.unshift(log)
  }
  saveLocalAttendance(logs)
}

// ==========================================
// 3. ATTENDANCE HISTORY & TIMESHEETS
// ==========================================
export async function fetchUserAttendanceHistory(userId: string): Promise<AttendanceLog[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(60)

    if (!error && data) {
      return data as AttendanceLog[]
    }
  } catch (err) {
    console.warn('Supabase history fetch failed:', err)
  }

  const logs = getLocalAttendance()
  return logs.filter((l) => l.user_id === userId).sort((a, b) => b.date.localeCompare(a.date))
}

// ==========================================
// 4. ADMIN LIVE ROSTER & EXCEPTION QUEUE
// ==========================================
export async function fetchAdminDailyRoster(dateStr: string): Promise<RosterEmployee[]> {
  try {
    const supabase = createClient()
    // Fetch profiles
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, email, role, avatar_url, work_status')
      .eq('is_active', true)
      .order('name')

    // Fetch attendance logs for date
    const { data: logs, error: lErr } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('date', dateStr)

    if (!pErr && profiles) {
      const logsMap = new Map<string, AttendanceLog>()
      ;(logs || []).forEach((l: AttendanceLog) => logsMap.set(l.user_id, l))

      return profiles.map((p) => {
        const log = logsMap.get(p.id) || null
        let liveStatus: LiveAttendanceStatus = 'NOT_PUNCHED'
        let activeMinutes = 0

        if (p.work_status === 'ON_LEAVE') {
          liveStatus = 'ON_LEAVE'
        } else if (log?.punch_in_at) {
          if (log.punch_out_at) {
            // Finished day
            liveStatus = log.punch_in_status === 'APPROVED' ? 'PRESENT_HQ' : 'PRESENT_REMOTE'
            activeMinutes = log.total_working_minutes
          } else {
            // Currently active
            liveStatus = log.punch_in_status === 'APPROVED' ? 'PRESENT_HQ' : 'PRESENT_REMOTE'
            const inTime = new Date(log.punch_in_at).getTime()
            activeMinutes = Math.max(1, Math.round((Date.now() - inTime) / (1000 * 60)))
          }
        }

        return {
          profile_id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          avatar_url: p.avatar_url,
          work_status: p.work_status,
          today_log: log,
          live_status: liveStatus,
          active_minutes: activeMinutes,
        }
      })
    }
  } catch (err) {
    console.warn('Supabase roster fetch failed, using fallback:', err)
  }

  // Local fallback
  return [
    {
      profile_id: 'sample-admin-1',
      name: 'Adil Al-Harbi',
      email: 'adil@asaheeb.sa',
      role: 'ADMIN',
      avatar_url: null,
      work_status: 'AVAILABLE',
      today_log: null,
      live_status: 'PRESENT_HQ',
      active_minutes: 240,
    },
    {
      profile_id: 'sample-agent-1',
      name: 'Ahmed Mansoor',
      email: 'ahmed@asaheeb.sa',
      role: 'AGENT',
      avatar_url: null,
      work_status: 'AVAILABLE',
      today_log: null,
      live_status: 'PRESENT_REMOTE',
      active_minutes: 185,
    },
    {
      profile_id: 'sample-agent-2',
      name: 'Fatima Zahra',
      email: 'fatima@asaheeb.sa',
      role: 'AGENT',
      avatar_url: null,
      work_status: 'ON_LEAVE',
      today_log: null,
      live_status: 'ON_LEAVE',
      active_minutes: 0,
    },
  ]
}

export async function fetchPendingExceptions(): Promise<AttendanceLog[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, profiles:user_id (name, email, role, avatar_url)')
      .or('punch_in_status.eq.PENDING_REVIEW,punch_out_status.eq.PENDING_REVIEW')
      .order('date', { ascending: false })
      .limit(50)

    if (!error && data) {
      return data.map((d: any) => ({
        ...d,
        employee_name: d.profiles?.name || 'Staff Member',
        employee_email: d.profiles?.email || '',
        employee_role: d.profiles?.role || 'AGENT',
        employee_avatar: d.profiles?.avatar_url || null,
      })) as AttendanceLog[]
    }
  } catch (err) {
    console.warn('Supabase exceptions fetch failed:', err)
  }

  const logs = getLocalAttendance()
  return logs.filter(
    (l) => l.punch_in_status === 'PENDING_REVIEW' || l.punch_out_status === 'PENDING_REVIEW'
  )
}

export async function reviewAttendancePunch(
  attendanceId: string,
  punchType: 'IN' | 'OUT',
  newStatus: AttendancePunchStatus,
  adminNotes: string,
  adminId: string
): Promise<boolean> {
  const updatePayload: Record<string, any> = {
    review_notes: adminNotes,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (punchType === 'IN') {
    updatePayload.punch_in_status = newStatus
  } else {
    updatePayload.punch_out_status = newStatus
  }

  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('attendance_logs')
      .update(updatePayload)
      .eq('id', attendanceId)

    if (!error) return true
  } catch (err) {
    console.warn('Supabase review update failed:', err)
  }

  // Local update
  const logs = getLocalAttendance()
  const item = logs.find((l) => l.id === attendanceId)
  if (item) {
    if (punchType === 'IN') item.punch_in_status = newStatus
    else item.punch_out_status = newStatus
    item.review_notes = adminNotes
    item.reviewed_by = adminId
    item.reviewed_at = new Date().toISOString()
    saveLocalAttendance(logs)
    return true
  }
  return false
}

// ==========================================
// 5. LEAVE BALANCES & LEAVE REQUESTS API
// ==========================================
export async function fetchLeaveBalances(userId: string, year?: number): Promise<LeaveBalance> {
  const targetYear = year || new Date().getFullYear()
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('employee_leave_balances')
      .select('*')
      .eq('user_id', userId)
      .eq('year', targetYear)
      .maybeSingle()

    if (!error && data) {
      return data as LeaveBalance
    }
  } catch (err) {
    console.warn('Supabase leave balances fetch failed:', err)
  }

  const balances = getLocalLeaveBalances()
  const found = balances.find((b) => b.user_id === userId && b.year === targetYear)
  if (found) return found

  const def: LeaveBalance = {
    id: `leave-bal-${userId}-${targetYear}`,
    user_id: userId,
    year: targetYear,
    annual_leave_total: 21.0,
    annual_leave_used: 0.0,
    sick_leave_total: 30.0,
    sick_leave_used: 0.0,
    unpaid_leave_used: 0.0,
    emergency_leave_used: 0.0,
  }
  balances.push(def)
  saveLocalLeaveBalances(balances)
  return def
}

export async function fetchUserLeaveRequests(userId: string): Promise<LeaveRequest[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })

    if (!error && data) {
      return data as LeaveRequest[]
    }
  } catch (err) {
    console.warn('Supabase leave requests fetch failed:', err)
  }

  const reqs = getLocalLeaveRequests()
  return reqs.filter((r) => r.user_id === userId).sort((a, b) => b.start_date.localeCompare(a.start_date))
}

export async function fetchAllLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, profiles:user_id (name, email, role, avatar_url)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      return data.map((d: any) => ({
        ...d,
        employee_name: d.profiles?.name || 'Staff Member',
        employee_email: d.profiles?.email || '',
        employee_role: d.profiles?.role || 'AGENT',
        employee_avatar: d.profiles?.avatar_url || null,
      })) as LeaveRequest[]
    }
  } catch (err) {
    console.warn('Supabase all leave requests fetch failed:', err)
  }

  return getLocalLeaveRequests()
}

export async function submitLeaveRequest(params: {
  userId: string
  leaveType: 'ANNUAL' | 'SICK' | 'UNPAID' | 'EMERGENCY'
  startDate: string
  endDate: string
  totalDays: number
  reason: string
}): Promise<LeaveRequest> {
  const payload = {
    user_id: params.userId,
    leave_type: params.leaveType,
    start_date: params.startDate,
    end_date: params.endDate,
    total_days: params.totalDays,
    reason: params.reason,
    status: 'PENDING' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('leave_requests')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      return data as LeaveRequest
    }
  } catch (err) {
    console.warn('Supabase leave submit failed, saving locally:', err)
  }

  const reqs = getLocalLeaveRequests()
  const localReq: LeaveRequest = {
    id: `leave-req-${Date.now()}`,
    ...payload,
    approved_by: null,
    admin_notes: null,
  }
  reqs.unshift(localReq)
  saveLocalLeaveRequests(reqs)
  return localReq
}

export async function reviewLeaveRequest(
  requestId: string,
  newStatus: 'APPROVED' | 'REJECTED',
  adminNotes: string,
  adminId: string
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: newStatus,
        admin_notes: adminNotes,
        approved_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (!error) return true
  } catch (err) {
    console.warn('Supabase leave review failed:', err)
  }

  // Local fallback with auto-deduction
  const reqs = getLocalLeaveRequests()
  const target = reqs.find((r) => r.id === requestId)
  if (target) {
    target.status = newStatus
    target.admin_notes = adminNotes
    target.approved_by = adminId
    target.updated_at = new Date().toISOString()
    saveLocalLeaveRequests(reqs)

    // Deduct from balance if approved
    if (newStatus === 'APPROVED') {
      const balances = getLocalLeaveBalances()
      const bal = balances.find((b) => b.user_id === target.user_id)
      if (bal) {
        if (target.leave_type === 'ANNUAL') bal.annual_leave_used += target.total_days
        else if (target.leave_type === 'SICK') bal.sick_leave_used += target.total_days
        else if (target.leave_type === 'EMERGENCY') bal.emergency_leave_used += target.total_days
        else if (target.leave_type === 'UNPAID') bal.unpaid_leave_used += target.total_days
        saveLocalLeaveBalances(balances)
      }
    }
    return true
  }
  return false
}

// ==========================================
// 6. SELFIE SNAPSHOT UPLOADER
// ==========================================
export async function uploadSelfieSnapshot(
  dataUrl: string,
  userId: string,
  type: 'in' | 'out'
): Promise<string | null> {
  try {
    const supabase = createClient()
    const filename = `${userId}/${Date.now()}_${type}.jpg`
    
    // Convert base64 dataUrl to blob
    const res = await fetch(dataUrl)
    const blob = await res.blob()

    const { data, error } = await supabase.storage
      .from('attendance-snapshots')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (!error && data?.path) {
      const { data: publicUrlData } = supabase.storage
        .from('attendance-snapshots')
        .getPublicUrl(data.path)
      return publicUrlData.publicUrl
    }
  } catch (err) {
    console.warn('Storage upload failed, retaining inline preview dataUrl:', err)
  }

  // Fallback: return the dataUrl directly so photo verification is never lost
  return dataUrl
}

// ==========================================
// 7. COMPANY WORK POLICY & SCHEDULE API
// ==========================================
const LOCAL_POLICY_KEY = 'asaheeb_crm_work_policy_v1'

export const DEFAULT_WORK_POLICY: CompanyWorkPolicy = {
  id: 'default-policy',
  company_name: 'Asaheeb Real Estate',
  work_days: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'],
  daily_expected_hours: 8.0,
  shift_start_time: '09:00:00',
  shift_end_time: '17:00:00',
  grace_period_mins: 15,
  default_annual_leave_quota: 21,
  default_sick_leave_quota: 30,
  custom_day_hours: {},
}

export async function fetchCompanyWorkPolicy(): Promise<CompanyWorkPolicy> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('company_work_policy')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(data))
      }
      const parsedPolicy = {
        ...data,
        custom_day_schedules: (data.custom_day_hours as any)?._schedules || (data as any).custom_day_schedules || {},
      }
      return parsedPolicy as CompanyWorkPolicy
    }
  } catch (err) {
    console.warn('Supabase work policy fetch failed:', err)
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_POLICY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.custom_day_schedules = parsed.custom_day_hours?._schedules || parsed.custom_day_schedules || {}
        return parsed
      }
    } catch (e) {
      console.error(e)
    }
  }
  return DEFAULT_WORK_POLICY
}

export async function saveCompanyWorkPolicy(
  policy: Partial<CompanyWorkPolicy>
): Promise<CompanyWorkPolicy> {
  const current = await fetchCompanyWorkPolicy()

  // Merge numeric hours and schedules into custom_day_hours payload
  const rawCustomHours = policy.custom_day_hours !== undefined ? { ...policy.custom_day_hours } : { ...(current.custom_day_hours || {}) }
  const schedules = policy.custom_day_schedules || current.custom_day_schedules || {}
  if (Object.keys(schedules).length > 0) {
    rawCustomHours['_schedules'] = schedules as any
  } else {
    delete rawCustomHours['_schedules']
  }

  const payload = {
    company_name: policy.company_name || current.company_name,
    work_days: policy.work_days || current.work_days,
    daily_expected_hours: Number(policy.daily_expected_hours || current.daily_expected_hours),
    shift_start_time: policy.shift_start_time || current.shift_start_time,
    shift_end_time: policy.shift_end_time || current.shift_end_time,
    grace_period_mins: Number(policy.grace_period_mins ?? current.grace_period_mins),
    default_annual_leave_quota: Number(policy.default_annual_leave_quota || current.default_annual_leave_quota),
    default_sick_leave_quota: Number(policy.default_sick_leave_quota || current.default_sick_leave_quota),
    custom_day_hours: rawCustomHours,
    updated_at: new Date().toISOString(),
  }

  try {
    const supabase = createClient()
    let saved: any = null
    if (current?.id && current.id !== 'default-policy') {
      const { data, error } = await supabase
        .from('company_work_policy')
        .update(payload)
        .eq('id', current.id)
        .select()
        .single()
      if (!error && data) saved = data
    } else {
      const { data, error } = await supabase
        .from('company_work_policy')
        .insert(payload)
        .select()
        .single()
      if (!error && data) saved = data
    }

    if (saved) {
      const parsedSaved: CompanyWorkPolicy = {
        ...saved,
        custom_day_schedules: saved.custom_day_hours?._schedules || {},
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(parsedSaved))
      }
      return parsedSaved
    }
  } catch (err) {
    console.warn('Supabase policy save failed, updating locally:', err)
  }

  const localRes: CompanyWorkPolicy = {
    id: current.id || 'default-policy',
    ...payload,
    custom_day_schedules: schedules,
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(localRes))
  }
  return localRes
}

// ==========================================
// 8. MONTHLY WORK HOURS & NON-WORKING AUDIT
// ==========================================
export function calculateWorkingDaysInMonth(
  year: number,
  month: number, // 1 to 12
  workDays: string[]
): number {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const targetDayIndices = workDays.map((w) => dayNames.indexOf(w.toUpperCase())).filter((i) => i >= 0)

  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day)
    if (targetDayIndices.includes(d.getDay())) {
      count++
    }
  }
  return count
}

export function calculateExpectedHoursInMonth(
  year: number,
  month: number, // 1 to 12
  workDays: string[],
  defaultHours: number,
  customDayHours?: Record<string, number>
): { count: number; totalHours: number } {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const targetDayIndices = workDays.map((w) => dayNames.indexOf(w.toUpperCase())).filter((i) => i >= 0)

  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  let totalHours = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day)
    const dayIndex = d.getDay()
    if (targetDayIndices.includes(dayIndex)) {
      count++
      const dayName = dayNames[dayIndex]
      const hoursForDay =
        customDayHours && customDayHours[dayName] !== undefined && customDayHours[dayName] !== null
          ? Number(customDayHours[dayName])
          : defaultHours
      totalHours += hoursForDay
    }
  }
  return { count, totalHours: Math.round(totalHours * 10) / 10 }
}

export async function fetchMonthlyWorkHoursAudit(
  yearMonthStr: string // 'YYYY-MM'
): Promise<{
  auditList: import('@/types/attendance').MonthlyWorkHoursAudit[]
  expectedWorkingDays: number
  expectedHoursPerEmployee: number
}> {
  const [yearStr, monthStr] = yearMonthStr.split('-')
  const year = parseInt(yearStr, 10) || new Date().getFullYear()
  const month = parseInt(monthStr, 10) || new Date().getMonth() + 1

  const policy = await fetchCompanyWorkPolicy()
  const { count: workingDaysCount, totalHours: expectedHours } = calculateExpectedHoursInMonth(
    year,
    month,
    policy.work_days,
    policy.daily_expected_hours,
    policy.custom_day_hours
  )

  const startDateStr = `${yearMonthStr}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDateStr = `${yearMonthStr}-${lastDay.toString().padStart(2, '0')}`

  try {
    const supabase = createClient()
    // Fetch active staff profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('is_active', true)
      .order('name')

    // Fetch month's attendance logs
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    // Fetch month's approved leaves
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'APPROVED')
      .gte('start_date', startDateStr)
      .lte('end_date', endDateStr)

    if (profiles) {
      const logsByStaff = new Map<string, AttendanceLog[]>()
      ;(logs || []).forEach((l: AttendanceLog) => {
        const arr = logsByStaff.get(l.user_id) || []
        arr.push(l)
        logsByStaff.set(l.user_id, arr)
      })

      const leavesByStaff = new Map<string, LeaveRequest[]>()
      ;(leaves || []).forEach((r: LeaveRequest) => {
        const arr = leavesByStaff.get(r.user_id) || []
        arr.push(r)
        leavesByStaff.set(r.user_id, arr)
      })

      const auditList = profiles.map((p) => {
        const staffLogs = logsByStaff.get(p.id) || []
        const staffLeaves = leavesByStaff.get(p.id) || []

        // Total active worked minutes
        const totalWorkedMins = staffLogs.reduce((acc, curr) => acc + (curr.total_working_minutes || 0), 0)
        const actualHours = Math.round((totalWorkedMins / 60) * 10) / 10

        // Approved leave hours
        const leaveDays = staffLeaves.reduce((acc, curr) => acc + (curr.total_days || 0), 0)
        const leaveHours = Math.round(leaveDays * policy.daily_expected_hours * 10) / 10

        // Non-working shortfall hours
        const nonWorkingHours = Math.max(0, Math.round((expectedHours - actualHours - leaveHours) * 10) / 10)
        const overtimeHours = Math.max(0, Math.round((actualHours - expectedHours) * 10) / 10)

        const totalAccounted = actualHours + leaveHours
        const adherence = expectedHours > 0 ? Math.min(100, Math.round((totalAccounted / expectedHours) * 100)) : 100

        const daysPresent = staffLogs.filter((l) => l.punch_in_status === 'APPROVED').length
        const daysRemote = staffLogs.filter((l) => l.punch_in_status === 'PENDING_REVIEW' || l.punch_out_status === 'PENDING_REVIEW').length

        // Late days calculation based on policy shift_start_time + grace_period_mins
        const [shiftH, shiftM] = policy.shift_start_time.split(':').map(Number)
        const cutoffMinutes = shiftH * 60 + shiftM + policy.grace_period_mins

        let daysLate = 0
        staffLogs.forEach((l) => {
          if (l.punch_in_at) {
            const punchDate = new Date(l.punch_in_at)
            const punchMins = punchDate.getHours() * 60 + punchDate.getMinutes()
            if (punchMins > cutoffMinutes) daysLate++
          }
        })

        const daysAbsent = Math.max(0, workingDaysCount - staffLogs.length - Math.round(leaveDays))

        return {
          employee_id: p.id,
          employee_name: p.name,
          employee_email: p.email,
          employee_role: p.role,
          month: yearMonthStr,
          expected_working_days: workingDaysCount,
          expected_total_hours: expectedHours,
          actual_worked_hours: actualHours,
          approved_leave_hours: leaveHours,
          non_working_hours: nonWorkingHours,
          overtime_hours: overtimeHours,
          attendance_adherence_percent: adherence,
          days_present: daysPresent,
          days_remote: daysRemote,
          days_late: daysLate,
          days_absent: daysAbsent,
        }
      })

      return {
        auditList,
        expectedWorkingDays: workingDaysCount,
        expectedHoursPerEmployee: expectedHours,
      }
    }
  } catch (err) {
    console.warn('Supabase monthly audit failed, returning local estimate:', err)
  }

  return {
    auditList: [],
    expectedWorkingDays: workingDaysCount,
    expectedHoursPerEmployee: expectedHours,
  }
}

