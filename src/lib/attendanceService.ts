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
  faceMatchScore?: number
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
    punch_in_face_match_score: params.faceMatchScore ?? 95,
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
  faceMatchScore?: number
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
    punch_out_face_match_score: params.faceMatchScore ?? 95,
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
  const todayStr = new Date().toISOString().split('T')[0]
  let rawLogs: AttendanceLog[] = []
  const policy = await fetchCompanyWorkPolicy()

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(60)

    if (!error && data) {
      rawLogs = data as AttendanceLog[]
    }

    // Also fetch dedicated regularization requests for user to overlay pending requests
    const { data: regReqs } = await supabase
      .from('attendance_regularization_requests')
      .select('*')
      .eq('user_id', userId)
      .order('shift_date', { ascending: false })

    if (regReqs && regReqs.length > 0) {
      for (const req of regReqs) {
        const matchLog = rawLogs.find((l) => l.date === req.shift_date)
        const inDisp = formatDisplayTime(req.requested_punch_in)
        const outDisp = formatDisplayTime(req.requested_punch_out)
        const durHours = (req.requested_duration_minutes / 60).toFixed(1)
        const statusNote = req.status === 'APPROVED'
          ? `Regularized: ${req.reason}`
          : req.status === 'REJECTED'
          ? `REJECTED REGULARIZATION: ${req.admin_notes || req.reason}`
          : `REGULARIZATION REQUEST: ${req.reason} [Requested: In ${inDisp}, Out ${outDisp}, Duration ${durHours}h]`

        if (matchLog) {
          if (req.status === 'PENDING') {
            matchLog.punch_out_status = 'PENDING_REVIEW'
            matchLog.punch_in_status = matchLog.punch_in_status || 'PENDING_REVIEW'
            matchLog.review_notes = statusNote
          } else if (req.status === 'APPROVED' || req.status === 'REJECTED') {
            matchLog.review_notes = statusNote
          }
        } else {
          // If no log exists for this date, create a representation so the user sees their pending/regularized request
          rawLogs.push({
            id: req.attendance_log_id || req.id,
            user_id: req.user_id,
            date: req.shift_date,
            punch_in_at: req.requested_punch_in,
            punch_out_at: req.requested_punch_out,
            total_working_minutes: req.requested_duration_minutes,
            punch_in_status: req.status === 'APPROVED' ? 'APPROVED' : req.status === 'REJECTED' ? 'FLAGGED' : 'PENDING_REVIEW',
            punch_out_status: req.status === 'APPROVED' ? 'APPROVED' : req.status === 'REJECTED' ? 'FLAGGED' : 'PENDING_REVIEW',
            review_notes: statusNote,
            created_at: req.created_at,
            updated_at: req.updated_at,
          } as AttendanceLog)
        }
      }
      rawLogs.sort((a, b) => b.date.localeCompare(a.date))
    }
  } catch (err) {
    console.warn('Supabase history fetch failed:', err)
  }

  if (rawLogs.length === 0) {
    const logs = getLocalAttendance()
    rawLogs = logs.filter((l) => l.user_id === userId).sort((a, b) => b.date.localeCompare(a.date))
  }

  // Post-process logs: handle active shift and past unclosed shift fallback
  return rawLogs.map((log) => {
    // If punch in exists but no punch out:
    if (log.punch_in_at && !log.punch_out_at) {
      if (log.date === todayStr) {
        // Active shift today: calculate live running elapsed minutes
        const elapsedMins = Math.max(1, Math.round((Date.now() - new Date(log.punch_in_at).getTime()) / (1000 * 60)))
        return {
          ...log,
          total_working_minutes: elapsedMins,
        }
      } else if (log.date < todayStr) {
        // Past shift where employee forgot to punch out:
        // Calculate duration from punch_in_at up to shift end time (17:00 EOD)
        const inDate = new Date(log.punch_in_at)
        const inMinutes = inDate.getHours() * 60 + inDate.getMinutes()
        const endMinutes = 17 * 60
        const autoMins = Math.max(0, endMinutes - inMinutes)
        return {
          ...log,
          total_working_minutes: autoMins,
          punch_out_status: log.punch_out_status || ('PENDING_REVIEW' as AttendancePunchStatus),
          review_notes: log.review_notes || '⚠️ Auto-Closed (17:00 EOD): Employee forgot to punch out',
          is_auto_closed: true,
        }
      }
    }
    return log
  })
}

function isValidUuid(val?: string | null): boolean {
  return (
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
  )
}

/**
 * Regularize an attendance log: allows Admin or approved employee request to set punch in/out times
 */
export async function regularizeAttendanceLog(params: {
  logId: string
  punchInAt?: string
  punchOutAt: string
  reason?: string
  adminId?: string
  userId?: string
  date?: string
  inDisplay?: string
  outDisplay?: string
}): Promise<AttendanceLog | null> {
  const inTimeStr = params.punchInAt || new Date().toISOString()
  const outTimeStr = params.punchOutAt
  const inTime = new Date(inTimeStr).getTime()
  const outTime = new Date(outTimeStr).getTime()
  const workingMinutes = Math.max(1, Math.round((outTime - inTime) / (1000 * 60)))
  const dateStr = params.date || inTimeStr.slice(0, 10)

  // 1. Primary: Persist reliably via dedicated backend API (bypasses RLS with service role)
  try {
    const res = await fetch('/api/attendance/regularize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        logId: params.logId,
        userId: params.userId,
        date: dateStr,
        punchInAt: inTimeStr,
        punchOutAt: outTimeStr,
        reason: params.reason || 'Shift time regularized by Admin',
        adminId: params.adminId,
        inDisplay: params.inDisplay,
        outDisplay: params.outDisplay,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      if (json.success && json.log) {
        updateLocalLog(json.log as AttendanceLog)
        return json.log as AttendanceLog
      }
    }
  } catch (apiErr) {
    console.warn('API regularization failed, trying direct Supabase fallback:', apiErr)
  }

  // 2. Direct Supabase Fallback
  const supabase = createClient()
  let currentLog: AttendanceLog | null = null

  if (isValidUuid(params.logId)) {
    try {
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('id', params.logId)
        .maybeSingle()
      if (data) currentLog = data as AttendanceLog
    } catch (e) {}
  }

  if (!currentLog && params.userId && dateStr) {
    try {
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', params.userId)
        .eq('date', dateStr)
        .maybeSingle()
      if (data) currentLog = data as AttendanceLog
    } catch (e) {}
  }

  if (!currentLog) {
    const local = getLocalAttendance().find((l) => l.id === params.logId || (l.user_id === params.userId && l.date === dateStr))
    if (local) currentLog = local
  }

  const dbPayload: Record<string, any> = {
    punch_in_at: inTimeStr,
    punch_out_at: params.punchOutAt,
    total_working_minutes: workingMinutes,
    punch_in_status: 'APPROVED',
    punch_out_status: 'APPROVED',
    review_notes: params.reason ? `Regularized: ${params.reason}` : 'Regularized by Admin',
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (isValidUuid(params.adminId)) {
    dbPayload.reviewed_by = params.adminId
  }

  if (currentLog && isValidUuid(currentLog.id)) {
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(dbPayload)
        .eq('id', currentLog.id)
        .select()
        .maybeSingle()

      if (!error && data) {
        updateLocalLog(data as AttendanceLog)
        return data as AttendanceLog
      }
    } catch (err) {
      console.warn('Direct Supabase regularization update failed:', err)
    }
  }

  const updated = {
    ...(currentLog || {
      id: params.logId,
      user_id: params.userId || 'guest-user',
      date: dateStr,
      created_at: new Date().toISOString(),
    }),
    ...dbPayload,
  } as unknown as AttendanceLog
  updateLocalLog(updated)
  return updated
}

/**
 * Request attendance regularization: submitted by an employee for Admin review
 */
export async function requestAttendanceRegularization(params: {
  logId: string
  punchInAt?: string
  punchOutAt: string
  reason: string
  userId: string
  employeeName?: string
  date?: string
  inDisplay?: string
  outDisplay?: string
}): Promise<boolean> {
  const inTimeStr = params.punchInAt
  const inTime = inTimeStr ? new Date(inTimeStr).getTime() : Date.now()
  const outTime = new Date(params.punchOutAt).getTime()
  const workingMinutes = Math.max(1, Math.round((outTime - inTime) / (1000 * 60)))
  const inDisplay = params.inDisplay || (inTimeStr ? formatDisplayTime(inTimeStr) : '--:--')
  const outDisplay = params.outDisplay || formatDisplayTime(params.punchOutAt)
  const dateStr = params.date || (inTimeStr ? inTimeStr.slice(0, 10) : new Date().toISOString().slice(0, 10))

  // 1. Primary: Persist reliably via dedicated backend API (persists straight to PostgreSQL database)
  try {
    const res = await fetch('/api/attendance/regularize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request',
        logId: params.logId,
        userId: params.userId,
        date: dateStr,
        punchInAt: inTimeStr || localTimeToIso(dateStr, '09:00', false),
        punchOutAt: params.punchOutAt,
        reason: params.reason,
        inDisplay,
        outDisplay,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      if (json.success && json.log) {
        updateLocalLog(json.log as AttendanceLog)
        return true
      }
    }
  } catch (apiErr) {
    console.warn('API regularization request failed, trying direct Supabase fallback:', apiErr)
  }

  // 2. Direct Supabase Fallback
  const supabase = createClient()
  const cleanUserReason = cleanRegularizationReason(params.reason)
  const reviewNote = `REGULARIZATION REQUEST: ${cleanUserReason || 'Missed punch / shift regularization'} [Requested: In ${inDisplay}, Out ${outDisplay}, Duration ${(workingMinutes / 60).toFixed(1)}h]`

  const updatePayload = {
    punch_in_at: inTimeStr || localTimeToIso(dateStr, '09:00', false),
    punch_out_at: params.punchOutAt,
    total_working_minutes: workingMinutes,
    punch_out_status: 'PENDING_REVIEW' as AttendancePunchStatus,
    punch_in_status: 'PENDING_REVIEW' as AttendancePunchStatus,
    review_notes: reviewNote,
    updated_at: new Date().toISOString(),
  }

  // Check if row exists by UUID id or by (user_id, date)
  let existingId: string | null = null
  if (isValidUuid(params.logId)) {
    try {
      const { data } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('id', params.logId)
        .maybeSingle()
      if (data?.id) existingId = data.id
    } catch (e) {}
  }

  if (!existingId && params.userId && dateStr) {
    try {
      const { data } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('user_id', params.userId)
        .eq('date', dateStr)
        .maybeSingle()
      if (data?.id) existingId = data.id
    } catch (e) {}
  }

  if (existingId) {
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', existingId)

      if (!error) {
        const local = getLocalAttendance().find((l) => l.id === existingId || (l.user_id === params.userId && l.date === dateStr))
        if (local) {
          updateLocalLog({
            ...local,
            ...updatePayload,
          })
        }
        return true
      }
    } catch (err) {
      console.warn('Direct Supabase update failed:', err)
    }
  }

  const local = getLocalAttendance().find((l) => l.id === params.logId || (l.user_id === params.userId && l.date === dateStr))
  if (local) {
    updateLocalLog({
      ...local,
      ...updatePayload,
    })
    return true
  }

  const newLocal = {
    id: params.logId,
    user_id: params.userId,
    date: dateStr,
    created_at: new Date().toISOString(),
    ...updatePayload,
  } as unknown as AttendanceLog
  updateLocalLog(newLocal)
  return true
}

/**
 * Quick Approve a Regularization Request directly from the Exceptions Panel
 */
export async function quickApproveRegularization(
  log: AttendanceLog,
  adminId: string
): Promise<AttendanceLog | null> {
  const parsed = parseRegularizationRequestNotes(log.review_notes)
  const dateStr = log.date || new Date().toISOString().split('T')[0]

  let punchInIso = (log as any).requested_punch_in || log.punch_in_at
  let punchOutIso = (log as any).requested_punch_out || log.punch_out_at

  const in24 = parsed.requestedIn ? formatTo24HourTime(parsed.requestedIn) : null
  const out24 = parsed.requestedOut ? formatTo24HourTime(parsed.requestedOut) : null

  if (in24) {
    punchInIso = localTimeToIso(dateStr, in24, false)
  }
  if (out24) {
    let isOvernight = false
    if (in24) {
      const [inH, inM] = in24.split(':').map(Number)
      const [outH, outM] = out24.split(':').map(Number)
      if (outH * 60 + outM < inH * 60 + inM) {
        isOvernight = true
      }
    }
    punchOutIso = localTimeToIso(dateStr, out24, isOvernight)
  }

  if (!punchInIso) {
    punchInIso = localTimeToIso(dateStr, '09:00', false)
  }
  if (!punchOutIso) {
    punchOutIso = localTimeToIso(dateStr, '17:00', false)
  }

  const inDisp = parsed.requestedIn || formatDisplayTime(punchInIso)
  const outDisp = parsed.requestedOut || formatDisplayTime(punchOutIso)

  return await regularizeAttendanceLog({
    logId: log.id,
    punchInAt: punchInIso,
    punchOutAt: punchOutIso,
    reason: `Approved request: ${parsed.reason || 'Times verified by Admin'}`,
    adminId,
    userId: log.user_id,
    date: dateStr,
    inDisplay: inDisp,
    outDisplay: outDisp,
  })
}

/**
 * Reject a Regularization Request
 */
export async function rejectRegularizationRequest(
  logId: string,
  adminNotes: string,
  adminId: string,
  userId?: string,
  date?: string
): Promise<boolean> {
  const cleanAdminReason = cleanRegularizationReason(adminNotes)
  const dateStr = date || new Date().toISOString().slice(0, 10)

  // 1. Primary: Persist via backend API
  try {
    const res = await fetch('/api/attendance/regularize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject',
        logId,
        adminId,
        userId,
        date: dateStr,
        reason: cleanAdminReason || 'Declined by Admin',
      }),
    })

    if (res.ok) {
      const json = await res.json()
      if (json.success && json.log) {
        updateLocalLog(json.log as AttendanceLog)
        return true
      }
    }
  } catch (apiErr) {
    console.warn('API reject failed, trying fallback:', apiErr)
  }

  // 2. Direct Supabase Fallback
  const supabase = createClient()
  const dbPayload: Record<string, any> = {
    punch_in_status: 'FLAGGED' as AttendancePunchStatus,
    punch_out_status: 'FLAGGED' as AttendancePunchStatus,
    review_notes: `REJECTED REGULARIZATION: ${cleanAdminReason || 'Declined by Admin'}`,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (isValidUuid(adminId)) {
    dbPayload.reviewed_by = adminId
  }

  if (isValidUuid(logId)) {
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .update(dbPayload)
        .eq('id', logId)
        .select()
        .maybeSingle()

      if (!error && data) {
        updateLocalLog(data as AttendanceLog)
        return true
      }
    } catch (e) {}
  }

  if (userId && dateStr) {
    try {
      const res = await supabase
        .from('attendance_logs')
        .update(dbPayload)
        .eq('user_id', userId)
        .eq('date', dateStr)
        .select()
        .maybeSingle()
      if (!res.error && res.data) {
        updateLocalLog(res.data as AttendanceLog)
        return true
      }
    } catch (e) {}
  }

  const local = getLocalAttendance().find((l) => l.id === logId || (l.user_id === userId && l.date === dateStr))
  if (local) {
    updateLocalLog({ ...local, ...dbPayload })
    return true
  }
  return false
}

/**
 * Delete an Attendance Log or Regularization Request (Admin action)
 */
export async function deleteAttendanceLog(params: {
  logId?: string
  userId?: string
  date?: string
  isDedicatedRequest?: boolean
}): Promise<boolean> {
  try {
    const res = await fetch('/api/attendance/regularize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        logId: params.logId,
        userId: params.userId,
        date: params.date,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      if (json.success) {
        if (params.logId) {
          const logs = getLocalAttendance()
          const updated = logs.filter((l) => l.id !== params.logId)
          if (typeof window !== 'undefined') {
            localStorage.setItem('crm_attendance_logs', JSON.stringify(updated))
          }
        }
        return true
      }
    }
  } catch (apiErr) {
    console.warn('API delete failed, trying direct Supabase fallback:', apiErr)
  }

  // Fallback direct Supabase
  try {
    const supabase = createClient()
    if (params.logId && isValidUuid(params.logId)) {
      await supabase.from('attendance_logs').delete().eq('id', params.logId)
    }
    if (params.userId && params.date) {
      await supabase
        .from('attendance_regularization_requests')
        .delete()
        .eq('user_id', params.userId)
        .eq('shift_date', params.date)
    }
    return true
  } catch (err) {
    console.error('Supabase delete failed:', err)
  }

  return false
}

/**

 * Clean regularization reason by removing all nested prefixes and timestamps
 */
export function cleanRegularizationReason(notes?: string | null): string {
  if (!notes) return ''
  let str = notes.replace(/\[Requested:[^\]]+\]/gi, '')
  let prev = ''
  do {
    prev = str
    str = str
      .replace(/^REGULARIZATION REQUEST:\s*/i, '')
      .replace(/^Regularized:\s*/i, '')
      .replace(/^Approved request:\s*/i, '')
      .replace(/^REJECTED REGULARIZATION:\s*/i, '')
      .replace(/^ST:\s*verified\s*/i, '')
      .trim()
  } while (str !== prev)
  return str
}

/**
 * Regularization Request helper parsers
 */
export function parseRegularizationRequestNotes(notes?: string | null): {
  isRegularization: boolean
  requestedIn?: string
  requestedOut?: string
  requestedDurationHours?: string
  reason?: string
} {
  if (!notes) return { isRegularization: false }
  const isRegularization =
    notes.includes('REGULARIZATION REQUEST') ||
    notes.includes('[Requested:') ||
    notes.includes('Regularized:') ||
    notes.includes('REJECTED REGULARIZATION') ||
    notes.includes('ST: verified [Requested:')
  if (!isRegularization) return { isRegularization: false }

  const inMatch = notes.match(/In\s+([^,\]]+)/i)
  const outMatch = notes.match(/Out\s+([^,\]]+)/i)
  const durMatch = notes.match(/Duration\s+([^\]]+)/i)

  const reason = cleanRegularizationReason(notes)

  return {
    isRegularization: true,
    requestedIn: inMatch ? inMatch[1].trim() : undefined,
    requestedOut: outMatch ? outMatch[1].trim() : undefined,
    requestedDurationHours: durMatch ? durMatch[1].trim() : undefined,
    reason: reason || 'Missed punch / shift regularization',
  }
}

export function formatTo24HourTime(str?: string): string | null {
  if (!str) return null
  const cleaned = str.trim()
  if (/^\d{2}:\d{2}$/.test(cleaned)) return cleaned
  const m = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = m[3]?.toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return `${h.toString().padStart(2, '0')}:${min}`
}

export function formatTime24to12(time24?: string | null): string {
  if (!time24) return '--:--'
  const parts = time24.trim().split(':')
  if (parts.length < 2) return time24
  let h = parseInt(parts[0], 10)
  const m = parts[1].slice(0, 2)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`
}

export function localTimeToIso(dateStr: string, time24: string, isNextDay = false): string {
  const [h, m] = time24.split(':').map(Number)
  const [year, month, day] = dateStr.split('-').map(Number)
  const localDate = new Date(year, month - 1, day, h, m, 0)
  if (isNextDay) {
    localDate.setDate(localDate.getDate() + 1)
  }
  return localDate.toISOString()
}

export function formatDisplayTime(iso?: string | null): string {
  if (!iso) return '--:--'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return iso
  }
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
  // 1. Primary: Fetch via API with service role so RLS never hides records
  try {
    const res = await fetch('/api/attendance/regularize?type=exceptions')
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.logs)) {
        return json.logs as AttendanceLog[]
      }
    }
  } catch (apiErr) {
    console.warn('API exceptions fetch failed, falling back to direct query:', apiErr)
  }

  // 2. Direct Supabase Query Fallback
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, profiles:user_id (name, email, role, avatar_url)')
      .or(
        'punch_in_status.eq.PENDING_REVIEW,punch_out_status.eq.PENDING_REVIEW,punch_in_status.eq.FLAGGED,punch_out_status.eq.FLAGGED,punch_in_distance_m.gt.150,punch_out_distance_m.gt.150,review_notes.ilike.%REGULARIZATION%,review_notes.ilike.%Regularized%,review_notes.ilike.%Auto-Closed%'
      )
      .order('date', { ascending: false })
      .limit(100)

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
    (l) =>
      l.punch_in_status === 'PENDING_REVIEW' ||
      l.punch_out_status === 'PENDING_REVIEW' ||
      l.punch_in_status === 'FLAGGED' ||
      l.punch_out_status === 'FLAGGED' ||
      (l.punch_in_distance_m && l.punch_in_distance_m > 150) ||
      (l.punch_out_distance_m && l.punch_out_distance_m > 150) ||
      (l.review_notes && (l.review_notes.includes('REGULARIZATION') || l.review_notes.includes('Regularized')))
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

export const DEFAULT_OFFICIAL_HOLIDAYS: import('@/types/attendance').CompanyHoliday[] = [
  { id: 'hol-1', name: 'Saudi Founding Day', date: '2026-02-22' },
  { id: 'hol-2', name: 'Eid Al-Fitr Holiday', date: '2026-03-20' },
  { id: 'hol-3', name: 'Eid Al-Fitr Holiday', date: '2026-03-22' },
  { id: 'hol-4', name: 'Eid Al-Fitr Holiday', date: '2026-03-23' },
  { id: 'hol-5', name: 'Arafat Day', date: '2026-05-26' },
  { id: 'hol-6', name: 'Eid Al-Adha Holiday', date: '2026-05-27' },
  { id: 'hol-7', name: 'Eid Al-Adha Holiday', date: '2026-05-28' },
  { id: 'hol-8', name: 'Eid Al-Adha Holiday', date: '2026-05-29' },
  { id: 'hol-9', name: 'Saudi National Day', date: '2026-09-23' },
]

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
  official_holidays: DEFAULT_OFFICIAL_HOLIDAYS,
}

export async function fetchOfficialHolidays(): Promise<import('@/types/attendance').CompanyHoliday[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/attendance/holidays')
      if (res.ok) {
        const json = await res.json()
        if (json.holidays && Array.isArray(json.holidays)) {
          return json.holidays
        }
      }
    } catch (e) {
      console.warn('API /api/attendance/holidays fetch failed, trying direct:', e)
    }
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('company_holidays')
      .select('*')
      .order('date', { ascending: true })

    if (!error && data && data.length > 0) {
      return data.map((h) => ({
        id: h.id,
        name: h.name,
        date: typeof h.date === 'string' ? h.date.slice(0, 10) : h.date,
      }))
    }
  } catch (err) {
    // Fallback to work policy
  }

  const pol = await fetchCompanyWorkPolicy()
  return pol.official_holidays || DEFAULT_OFFICIAL_HOLIDAYS
}

export async function saveOfficialHolidays(
  holidays: import('@/types/attendance').CompanyHoliday[]
): Promise<import('@/types/attendance').CompanyHoliday[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/attendance/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holidays }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.holidays) {
          // Update cached policy
          const cachedRaw = localStorage.getItem(LOCAL_POLICY_KEY)
          if (cachedRaw) {
            try {
              const cached = JSON.parse(cachedRaw)
              cached.official_holidays = json.holidays
              if (cached.custom_day_hours) cached.custom_day_hours._holidays = json.holidays
              localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(cached))
            } catch (e) {}
          }
          return json.holidays
        }
      }
    } catch (e) {
      console.warn('API /api/attendance/holidays save failed:', e)
    }
  }

  // Also save via saveCompanyWorkPolicy
  const updated = await saveCompanyWorkPolicy({ official_holidays: holidays })
  return updated.official_holidays || holidays
}

export async function fetchCompanyWorkPolicy(): Promise<CompanyWorkPolicy> {
  // 1. In browser, fetch via backend API endpoint (bypasses RLS with service client)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/attendance/work-policy')
      if (res.ok) {
        const json = await res.json()
        if (json.policy) {
          const data = json.policy
          const holidays =
            data.official_holidays ||
            (data.custom_day_hours as any)?._holidays ||
            DEFAULT_OFFICIAL_HOLIDAYS
          const schedules = (data.custom_day_hours as any)?._schedules || data.custom_day_schedules || {}
          const fullPolicy: CompanyWorkPolicy = {
            ...data,
            custom_day_schedules: schedules,
            official_holidays: holidays,
          }
          localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(fullPolicy))
          return fullPolicy
        }
      }
    } catch (e) {
      console.warn('API /api/attendance/work-policy fetch failed, trying direct:', e)
    }
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('company_work_policy')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      // Also try fetching from company_holidays table if present
      let holidays = (data.custom_day_hours as any)?._holidays || (data as any).official_holidays || DEFAULT_OFFICIAL_HOLIDAYS
      try {
        const { data: hData } = await supabase.from('company_holidays').select('*').order('date', { ascending: true })
        if (hData && hData.length > 0) {
          holidays = hData.map((h) => ({
            id: h.id,
            name: h.name,
            date: typeof h.date === 'string' ? h.date.slice(0, 10) : h.date,
          }))
        }
      } catch (e) {}

      const parsedPolicy: CompanyWorkPolicy = {
        ...data,
        custom_day_schedules: (data.custom_day_hours as any)?._schedules || (data as any).custom_day_schedules || {},
        official_holidays: holidays,
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(parsedPolicy))
      }
      return parsedPolicy
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
        parsed.official_holidays = parsed.custom_day_hours?._holidays || parsed.official_holidays || DEFAULT_OFFICIAL_HOLIDAYS
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

  // Merge numeric hours, schedules, and holidays into custom_day_hours payload
  const rawCustomHours = policy.custom_day_hours !== undefined ? { ...policy.custom_day_hours } : { ...(current.custom_day_hours || {}) }
  const schedules = policy.custom_day_schedules || current.custom_day_schedules || {}
  if (Object.keys(schedules).length > 0) {
    rawCustomHours['_schedules'] = schedules as any
  } else {
    delete rawCustomHours['_schedules']
  }

  const holidays = policy.official_holidays !== undefined ? policy.official_holidays : (current.official_holidays || DEFAULT_OFFICIAL_HOLIDAYS)
  rawCustomHours['_holidays'] = holidays as any

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

  // 1. In browser, save via backend API endpoint (bypasses RLS with service client)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/attendance/work-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, official_holidays: holidays }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.policy) {
          const parsedSaved: CompanyWorkPolicy = {
            ...json.policy,
            custom_day_schedules: json.policy.custom_day_hours?._schedules || schedules,
            official_holidays: json.policy.official_holidays || json.policy.custom_day_hours?._holidays || holidays,
          }
          localStorage.setItem(LOCAL_POLICY_KEY, JSON.stringify(parsedSaved))
          return parsedSaved
        }
      }
    } catch (e) {
      console.warn('API /api/attendance/work-policy save failed, falling back to direct:', e)
    }
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
        official_holidays: saved.custom_day_hours?._holidays || holidays,
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
    official_holidays: holidays,
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
  customDayHours?: Record<string, number>,
  holidays?: import('@/types/attendance').CompanyHoliday[],
  upToDayParam?: number
): {
  count: number
  totalHours: number
  elapsedCount: number
  elapsedHours: number
  holidaysCount: number
} {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const targetDayIndices = workDays.map((w) => dayNames.indexOf(w.toUpperCase())).filter((i) => i >= 0)

  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)

  const effectiveUpToDay =
    upToDayParam !== undefined
      ? upToDayParam
      : isCurrentMonth
      ? Math.min(today.getDate(), daysInMonth)
      : isPastMonth
      ? daysInMonth
      : 0

  const holidayDateSet = new Set((holidays || []).map((h) => h.date))

  let count = 0
  let totalHours = 0
  let elapsedCount = 0
  let elapsedHours = 0
  let holidaysCount = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const d = new Date(year, month - 1, day)
    const dayIndex = d.getDay()
    const isWorkday = targetDayIndices.includes(dayIndex)
    const isHoliday = holidayDateSet.has(dateStr)

    if (isHoliday && isWorkday) {
      holidaysCount++
    }

    // Only count as expected working day if it is a scheduled workday AND NOT an official holiday!
    if (isWorkday && !isHoliday) {
      count++
      const dayName = dayNames[dayIndex]
      const hoursForDay =
        customDayHours && customDayHours[dayName] !== undefined && customDayHours[dayName] !== null
          ? Number(customDayHours[dayName])
          : defaultHours
      totalHours += hoursForDay

      if (day <= effectiveUpToDay) {
        elapsedCount++
        elapsedHours += hoursForDay
      }
    }
  }

  return {
    count,
    totalHours: Math.round(totalHours * 10) / 10,
    elapsedCount,
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    holidaysCount,
  }
}

export async function fetchMonthlyWorkHoursAudit(
  yearMonthStr: string // 'YYYY-MM'
): Promise<{
  auditList: import('@/types/attendance').MonthlyWorkHoursAudit[]
  expectedWorkingDays: number
  expectedHoursPerEmployee: number
  expectedToDateHours: number
  elapsedWorkingDays: number
}> {
  const [yearStr, monthStr] = yearMonthStr.split('-')
  const year = parseInt(yearStr, 10) || new Date().getFullYear()
  const month = parseInt(monthStr, 10) || new Date().getMonth() + 1

  const policy = await fetchCompanyWorkPolicy()
  const {
    count: workingDaysCount,
    totalHours: expectedHours,
    elapsedCount: elapsedWorkingDays,
    elapsedHours: expectedToDateHours,
  } = calculateExpectedHoursInMonth(
    year,
    month,
    policy.work_days,
    policy.daily_expected_hours,
    policy.custom_day_hours,
    policy.official_holidays
  )

  const startDateStr = `${yearMonthStr}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDateStr = `${yearMonthStr}-${lastDay.toString().padStart(2, '0')}`
  const todayStr = new Date().toISOString().split('T')[0]

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

    // Fetch salary profiles from employee_salary_profiles and active employee_salary_history
    const { data: salaryProfiles } = await supabase
      .from('employee_salary_profiles')
      .select('profile_id, base_salary, currency')

    const { data: salaryHistory } = await supabase
      .from('employee_salary_history')
      .select('profile_id, base_salary, currency')
      .is('end_date', null)

    const salMap = new Map<string, { base_salary: number; currency: string }>()
    ;(salaryHistory || []).forEach((sh: any) => {
      if (sh.profile_id && Number(sh.base_salary) > 0) {
        salMap.set(sh.profile_id, {
          base_salary: Number(sh.base_salary),
          currency: sh.currency || 'SAR',
        })
      }
    })
    ;(salaryProfiles || []).forEach((sp: any) => {
      if (sp.profile_id && Number(sp.base_salary) > 0) {
        salMap.set(sp.profile_id, {
          base_salary: Number(sp.base_salary),
          currency: sp.currency || 'SAR',
        })
      }
    })

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

        // Total active worked minutes (with auto-EOD fallback for past unclosed shifts up to shift_end_time)
        const totalWorkedMins = staffLogs.reduce((acc, curr) => {
          let mins = curr.total_working_minutes || 0
          if (curr.punch_in_at && !curr.punch_out_at) {
            if (curr.date < todayStr) {
              const inDate = new Date(curr.punch_in_at)
              const inMins = inDate.getHours() * 60 + inDate.getMinutes()
              const endMins = 17 * 60
              mins = Math.max(0, endMins - inMins)
            } else if (curr.date === todayStr && mins === 0) {
              mins = Math.max(1, Math.round((Date.now() - new Date(curr.punch_in_at).getTime()) / (1000 * 60)))
            }
          }
          return acc + mins
        }, 0)
        const actualHours = Math.round((totalWorkedMins / 60) * 10) / 10

        // Approved leave hours strictly elapsed up to today in the month (never future leaves!)
        let elapsedLeaveHours = 0
        let elapsedLeaveDays = 0
        staffLeaves.forEach((l) => {
          const start = new Date(l.start_date + 'T00:00:00')
          const end = new Date(l.end_date + 'T00:00:00')
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dYear = d.getFullYear()
            const dMonth = d.getMonth() + 1
            const dDay = d.getDate()
            const dDateStr = `${dYear}-${dMonth.toString().padStart(2, '0')}-${dDay.toString().padStart(2, '0')}`

            if (dYear === year && dMonth === month) {
              const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
              const isWorkDay = policy.work_days.includes(dayName)
              const isHoliday = (policy.official_holidays || []).some((h) => h.date === dDateStr)

              if (isWorkDay && !isHoliday && dDateStr <= todayStr) {
                elapsedLeaveDays++
                const dayHrs = (policy.custom_day_hours && policy.custom_day_hours[dayName] !== undefined)
                  ? policy.custom_day_hours[dayName]
                  : policy.daily_expected_hours
                elapsedLeaveHours += dayHrs
              }
            }
          }
        })
        const leaveHours = Math.round(elapsedLeaveHours * 10) / 10

        // Month-To-Date Non-working shortfall (based on elapsed expected hours so far, never future days!)
        const monthToDateDeficit = Math.max(
          0,
          Math.round((expectedToDateHours - actualHours - leaveHours) * 10) / 10
        )
        const overtimeHours = Math.max(0, Math.round((actualHours - expectedToDateHours) * 10) / 10)

        // Adherence based on elapsed days:
        const totalAccounted = actualHours + leaveHours
        const adherence =
          expectedToDateHours > 0
            ? Math.min(100, Math.round((totalAccounted / expectedToDateHours) * 100))
            : 100

        // Financial pay cut deduction calculation strictly based on REAL salary profile:
        const sal = salMap.get(p.id)
        const baseSalary = sal?.base_salary || 0
        const currency = sal?.currency || 'SAR'
        const hourlyRate = (expectedHours > 0 && baseSalary > 0)
          ? Math.round((baseSalary / expectedHours) * 100) / 100
          : 0
        const estimatedPayCut = (hourlyRate > 0 && monthToDateDeficit > 0)
          ? Math.round(monthToDateDeficit * hourlyRate * 10) / 10
          : 0

        const daysPresent = staffLogs.filter((l) => l.punch_in_status === 'APPROVED').length
        const daysRemote = staffLogs.filter(
          (l) => l.punch_in_status === 'PENDING_REVIEW' || l.punch_out_status === 'PENDING_REVIEW'
        ).length

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

        const daysAbsent = Math.max(0, elapsedWorkingDays - staffLogs.length - Math.round(elapsedLeaveDays))

        return {
          employee_id: p.id,
          employee_name: p.name,
          employee_email: p.email,
          employee_role: p.role,
          month: yearMonthStr,
          expected_working_days: workingDaysCount,
          expected_total_hours: expectedHours,
          expected_to_date_hours: expectedToDateHours,
          elapsed_working_days: elapsedWorkingDays,
          actual_worked_hours: actualHours,
          approved_leave_hours: leaveHours,
          non_working_hours: monthToDateDeficit,
          month_to_date_deficit: monthToDateDeficit,
          overtime_hours: overtimeHours,
          attendance_adherence_percent: adherence,
          hourly_rate: hourlyRate,
          estimated_pay_cut: estimatedPayCut,
          currency,
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
        expectedToDateHours,
        elapsedWorkingDays,
      }
    }
  } catch (err) {
    console.warn('Supabase monthly audit failed, returning local estimate:', err)
  }

  return {
    auditList: [],
    expectedWorkingDays: workingDaysCount,
    expectedHoursPerEmployee: expectedHours,
    expectedToDateHours: expectedHours,
    elapsedWorkingDays: workingDaysCount,
  }
}

export async function fetchUserSalaryProfile(userId: string): Promise<{ base_salary: number; currency: string } | null> {
  try {
    const supabase = createClient()
    // 1. Try employee_salary_profiles
    const { data: esp } = await supabase
      .from('employee_salary_profiles')
      .select('base_salary, currency')
      .eq('profile_id', userId)
      .maybeSingle()

    if (esp && Number(esp.base_salary) > 0) {
      return {
        base_salary: Number(esp.base_salary),
        currency: esp.currency || 'SAR',
      }
    }

    // 2. Try active employee_salary_history
    const { data: esh } = await supabase
      .from('employee_salary_history')
      .select('base_salary, currency')
      .eq('profile_id', userId)
      .is('end_date', null)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (esh && Number(esh.base_salary) > 0) {
      return {
        base_salary: Number(esh.base_salary),
        currency: esh.currency || 'SAR',
      }
    }

    // 3. Try payslips
    const { data: ps } = await supabase
      .from('payslips')
      .select('base_salary, currency')
      .eq('employee_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ps && Number(ps.base_salary) > 0) {
      return {
        base_salary: Number(ps.base_salary),
        currency: ps.currency || 'SAR',
      }
    }
  } catch (err) {
    console.warn('Supabase fetchUserSalaryProfile failed:', err)
  }
  return null
}

