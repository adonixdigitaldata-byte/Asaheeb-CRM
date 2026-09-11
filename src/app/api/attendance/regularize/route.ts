import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function isValidUuid(id?: string | null): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

function cleanReason(notes?: string | null): string {
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
 * GET /api/attendance/regularize
 * Fetch attendance exceptions / regularizations or user logs with full service role
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const userId = searchParams.get('userId')

    const supabase = await createServiceClient()

    if (type === 'exceptions') {
      // 1. Try querying dedicated attendance_regularization_requests table
      let dedicatedRequests: any[] = []
      try {
        const { data: reqs, error: reqErr } = await supabase
          .from('attendance_regularization_requests')
          .select('*, profiles:user_id (name, email, role, avatar_url)')
          .order('created_at', { ascending: false })

        if (!reqErr && reqs && reqs.length > 0) {
          dedicatedRequests = reqs.map((r: any) => {
            const isAppr = r.status === 'APPROVED'
            const isRej = r.status === 'REJECTED'

            return {
              id: r.id,
              user_id: r.user_id,
              date: r.shift_date,
              punch_in_at: r.requested_punch_in,
              punch_out_at: r.requested_punch_out,
              requested_punch_in: r.requested_punch_in,
              requested_punch_out: r.requested_punch_out,
              total_working_minutes: r.requested_duration_minutes,
              punch_in_status: isAppr ? 'APPROVED' : isRej ? 'FLAGGED' : 'PENDING_REVIEW',
              punch_out_status: isAppr ? 'APPROVED' : isRej ? 'FLAGGED' : 'PENDING_REVIEW',
              review_notes: isAppr
                ? `Regularized: ${r.reason}`
                : isRej
                ? `REJECTED REGULARIZATION: ${r.admin_notes || r.reason}`
                : (r.reason?.includes('REGULARIZATION REQUEST') ? r.reason : `REGULARIZATION REQUEST: ${r.reason}`),
              reason: r.reason,
              employee_name: r.profiles?.name || 'Staff Member',
              employee_email: r.profiles?.email || '',
              employee_role: r.profiles?.role || 'AGENT',
              employee_avatar: r.profiles?.avatar_url || null,
              is_dedicated_request: true,
              status: r.status,
            }
          })
        }
      } catch (err) {
        // Table may not be created in Supabase yet
      }

      // 2. Fetch logs with pending/flagged punches or review notes from attendance_logs
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*, profiles:user_id (name, email, role, avatar_url)')
        .or(
          'punch_in_status.eq.PENDING_REVIEW,punch_out_status.eq.PENDING_REVIEW,punch_in_status.eq.FLAGGED,punch_out_status.eq.FLAGGED,punch_in_distance_m.gt.150,punch_out_distance_m.gt.150,review_notes.ilike.%REGULARIZATION%,review_notes.ilike.%Regularized%,review_notes.ilike.%Auto-Closed%'
        )
        .order('date', { ascending: false })
        .limit(200)

      if (error) {
        console.error('Error fetching exceptions in API:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const logExceptions = (data || []).map((d: any) => ({
        ...d,
        employee_name: d.profiles?.name || 'Staff Member',
        employee_email: d.profiles?.email || '',
        employee_role: d.profiles?.role || 'AGENT',
        employee_avatar: d.profiles?.avatar_url || null,
      }))

      // Combine dedicated requests with attendance_logs exceptions (avoiding duplicates by date and user)
      const combined = [...dedicatedRequests]
      for (const item of logExceptions) {
        const alreadyCovered = combined.some(
          (c) => c.user_id === item.user_id && c.date === item.date && (c.id === item.id || c.is_dedicated_request)
        )
        if (!alreadyCovered) {
          combined.push(item)
        }
      }

      return NextResponse.json({ logs: combined })
    }

    if (userId) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(100)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ logs: data || [] })
    }

    return NextResponse.json({ error: 'Missing type or userId parameter' }, { status: 400 })
  } catch (err: any) {
    console.error('API /api/attendance/regularize GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/attendance/regularize
 * Handles:
 * 1. action: 'request' -> Employee submits regularization request
 *    - Inserts into dedicated attendance_regularization_requests table if present
 *    - Updates attendance_logs with PENDING_REVIEW audit note WITHOUT overwriting original punch times
 * 2. action: 'approve' -> Admin approves shift regularization
 *    - Marks dedicated request APPROVED
 *    - Updates attendance_logs with the approved punch times and status APPROVED
 * 3. action: 'reject' -> Admin rejects shift regularization
 *    - Marks dedicated request REJECTED
 *    - Leaves original attendance_logs punch times intact
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      action = 'request',
      logId,
      userId,
      date,
      punchInAt,
      punchOutAt,
      reason = '',
      adminId,
      inDisplay: bodyInDisplay,
      outDisplay: bodyOutDisplay,
    } = body

    if (!action || !['request', 'approve', 'reject', 'admin_adjust'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }

    if (!userId && !isValidUuid(logId)) {
      return NextResponse.json({ error: 'Missing userId or valid logId' }, { status: 400 })
    }

    const dateStr = date || (punchInAt ? punchInAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
    const supabase = await createServiceClient()

    // Locate existing row in attendance_logs
    let existingRow: any = null
    if (isValidUuid(logId)) {
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('id', logId)
        .maybeSingle()
      if (data) existingRow = data
    }

    if (!existingRow && userId && dateStr) {
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .maybeSingle()
      if (data) existingRow = data
    }

    // Calculate working minutes
    const inTimeStr = punchInAt || existingRow?.punch_in_at || `${dateStr}T09:00:00.000Z`
    const outTimeStr = punchOutAt || existingRow?.punch_out_at || `${dateStr}T17:00:00.000Z`
    const inMs = new Date(inTimeStr).getTime()
    const outMs = new Date(outTimeStr).getTime()
    const workingMinutes = Math.max(1, Math.round((outMs - inMs) / (1000 * 60)))
    const inDisplay = bodyInDisplay || new Date(inTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const outDisplay = bodyOutDisplay || new Date(outTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const cleanUserReason = cleanReason(reason)

    // ==========================================
    // ACTION: REQUEST (Employee Submitting Request)
    // ==========================================
    if (action === 'request') {
      const reviewNote = `REGULARIZATION REQUEST: ${cleanUserReason || 'Missed punch / shift regularization'} [Requested: In ${inDisplay}, Out ${outDisplay}, Duration ${(workingMinutes / 60).toFixed(1)}h]`

      // 1. Store in dedicated attendance_regularization_requests table (strictly enforce 1 pending request at a time)
      let dedicatedInserted = false
      try {
        const targetUserId = userId || existingRow?.user_id
        if (targetUserId) {
          const { data: existingPending } = await supabase
            .from('attendance_regularization_requests')
            .select('id')
            .eq('user_id', targetUserId)
            .eq('shift_date', dateStr)
            .eq('status', 'PENDING')
            .maybeSingle()

          if (existingPending?.id) {
            // Update the single existing pending request with revised times
            const { error: upErr } = await supabase
              .from('attendance_regularization_requests')
              .update({
                attendance_log_id: existingRow?.id || (isValidUuid(logId) ? logId : null),
                requested_punch_in: inTimeStr,
                requested_punch_out: outTimeStr,
                requested_duration_minutes: workingMinutes,
                reason: cleanUserReason || 'Missed punch / shift regularization',
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingPending.id)
            if (!upErr) dedicatedInserted = true
          } else {
            // Insert fresh single pending request
            const { error: insErr } = await supabase
              .from('attendance_regularization_requests')
              .insert({
                attendance_log_id: existingRow?.id || (isValidUuid(logId) ? logId : null),
                user_id: targetUserId,
                shift_date: dateStr,
                requested_punch_in: inTimeStr,
                requested_punch_out: outTimeStr,
                requested_duration_minutes: workingMinutes,
                reason: cleanUserReason || 'Missed punch / shift regularization',
                status: 'PENDING',
              })
            if (!insErr) {
              dedicatedInserted = true
            }
          }
        }
      } catch (tblErr) {
        // Dedicated table not migrated yet
      }

      // 2. Update attendance_logs status without mutating the original punch times!
      let savedData: any = null

      if (existingRow) {
        // DO NOT overwrite existingRow.punch_in_at or punch_out_at! Keep original punches intact.
        const logPayload: Record<string, any> = {
          punch_out_status: 'PENDING_REVIEW',
          punch_in_status: 'PENDING_REVIEW',
          review_notes: reviewNote,
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from('attendance_logs')
          .update(logPayload)
          .eq('id', existingRow.id)
          .select('*, profiles:user_id (name, email, role, avatar_url)')
          .single()

        if (error) {
          console.error('API update error for request:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        savedData = data
      } else {
        // No prior attendance record: insert a placeholder log with PENDING_REVIEW
        const insertPayload: Record<string, any> = {
          user_id: userId,
          date: dateStr,
          punch_in_at: inTimeStr,
          punch_out_at: outTimeStr,
          total_working_minutes: workingMinutes,
          punch_in_status: 'PENDING_REVIEW',
          punch_out_status: 'PENDING_REVIEW',
          review_notes: reviewNote,
          created_at: new Date().toISOString(),
        }
        if (isValidUuid(logId)) {
          insertPayload.id = logId
        }

        const { data, error } = await supabase
          .from('attendance_logs')
          .insert(insertPayload)
          .select('*, profiles:user_id (name, email, role, avatar_url)')
          .single()

        if (error) {
          console.error('API insert error for request:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        savedData = data
      }

      return NextResponse.json({
        success: true,
        dedicatedTableSaved: dedicatedInserted,
        log: {
          ...savedData,
          employee_name: savedData?.profiles?.name || 'Staff Member',
          employee_email: savedData?.profiles?.email || '',
        },
      })
    }

    // ==========================================
    // ACTION: APPROVE / ADMIN_ADJUST (Admin Approval)
    // ==========================================
    if (action === 'approve' || action === 'admin_adjust') {
      const reviewNote = `Regularized: ${cleanUserReason || 'Shift time verified by Admin'}`

      // 1. Update dedicated attendance_regularization_requests table if present
      try {
        await supabase
          .from('attendance_regularization_requests')
          .update({
            status: 'APPROVED',
            reviewed_by: isValidUuid(adminId) ? adminId : null,
            reviewed_at: new Date().toISOString(),
            admin_notes: `Approved by Admin: ${cleanUserReason}`,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId || existingRow?.user_id)
          .eq('shift_date', dateStr)
      } catch (tblErr) {}

      // 2. NOW update attendance_logs with the verified approved punch times
      const payload: Record<string, any> = {
        punch_in_at: inTimeStr,
        punch_out_at: outTimeStr,
        total_working_minutes: workingMinutes,
        punch_in_status: 'APPROVED',
        punch_out_status: 'APPROVED',
        review_notes: reviewNote,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (isValidUuid(adminId)) {
        payload.reviewed_by = adminId
      }

      let savedData: any = null

      if (existingRow) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .update(payload)
          .eq('id', existingRow.id)
          .select('*, profiles:user_id (name, email, role, avatar_url)')
          .single()

        if (error) {
          console.error('API update error for approve:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        savedData = data
      } else {
        const insertPayload: Record<string, any> = {
          user_id: userId,
          date: dateStr,
          ...payload,
          created_at: new Date().toISOString(),
        }
        if (isValidUuid(logId)) {
          insertPayload.id = logId
        }

        const { data, error } = await supabase
          .from('attendance_logs')
          .insert(insertPayload)
          .select('*, profiles:user_id (name, email, role, avatar_url)')
          .single()

        if (error) {
          console.error('API insert error for approve:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        savedData = data
      }

      return NextResponse.json({
        success: true,
        log: {
          ...savedData,
          employee_name: savedData.profiles?.name || 'Staff Member',
          employee_email: savedData.profiles?.email || '',
        },
      })
    }

    // ==========================================
    // ACTION: REJECT (Admin Decline)
    // ==========================================
    if (action === 'reject') {
      const reviewNote = `REJECTED REGULARIZATION: ${cleanUserReason || 'Declined by Admin'}`

      // 1. Update dedicated attendance_regularization_requests table if present
      try {
        await supabase
          .from('attendance_regularization_requests')
          .update({
            status: 'REJECTED',
            reviewed_by: isValidUuid(adminId) ? adminId : null,
            reviewed_at: new Date().toISOString(),
            admin_notes: cleanUserReason || 'Declined by Admin',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId || existingRow?.user_id)
          .eq('shift_date', dateStr)
      } catch (tblErr) {}

      // 2. Update attendance_logs status without changing punches
      const payload: Record<string, any> = {
        punch_in_status: 'FLAGGED',
        punch_out_status: 'FLAGGED',
        review_notes: reviewNote,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (isValidUuid(adminId)) {
        payload.reviewed_by = adminId
      }

      let savedData: any = null

      if (existingRow) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .update(payload)
          .eq('id', existingRow.id)
          .select('*, profiles:user_id (name, email, role, avatar_url)')
          .single()

        if (error) {
          console.error('API update error for reject:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        savedData = data
      } else {
        return NextResponse.json({ error: 'Attendance log not found to reject' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        log: {
          ...savedData,
          employee_name: savedData.profiles?.name || 'Staff Member',
          employee_email: savedData.profiles?.email || '',
        },
      })
    }

    // ==========================================
    // ACTION: DELETE (Admin Delete Log / Request)
    // ==========================================
    if (action === 'delete') {
      let deletedLog = false
      let deletedReq = false

      if (logId) {
        // Delete from attendance_logs if logId is valid
        const { error: logErr } = await supabase
          .from('attendance_logs')
          .delete()
          .eq('id', logId)

        if (!logErr) deletedLog = true
      }

      // Also delete dedicated request if user_id and date or logId matches
      if (userId && dateStr) {
        const { error: reqErr } = await supabase
          .from('attendance_regularization_requests')
          .delete()
          .eq('user_id', userId)
          .eq('shift_date', dateStr)

        if (!reqErr) deletedReq = true
      } else if (logId) {
        const { error: reqErr } = await supabase
          .from('attendance_regularization_requests')
          .delete()
          .eq('id', logId)

        if (!reqErr) deletedReq = true
      }

      return NextResponse.json({
        success: true,
        deletedLog,
        deletedReq,
        message: 'Record deleted successfully',
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('API /api/attendance/regularize POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const logId = searchParams.get('id')
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')

    if (!logId && (!userId || !date)) {
      return NextResponse.json({ error: 'Missing logId or userId and date' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    if (logId) {
      await supabase.from('attendance_logs').delete().eq('id', logId)
    }

    if (userId && date) {
      await supabase
        .from('attendance_regularization_requests')
        .delete()
        .eq('user_id', userId)
        .eq('shift_date', date)
    } else if (logId) {
      await supabase
        .from('attendance_regularization_requests')
        .delete()
        .eq('id', logId)
    }

    return NextResponse.json({ success: true, message: 'Record deleted successfully' })
  } catch (err: any) {
    console.error('API /api/attendance/regularize DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

