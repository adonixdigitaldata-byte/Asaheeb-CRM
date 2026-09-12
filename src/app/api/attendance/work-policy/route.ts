import { NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

export async function GET() {
  try {
    const serviceClient = await createServiceClient()
    const { data, error } = await serviceClient
      .from('company_work_policy')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching work policy in API:', error)
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
    }

    let policyObj = data ? { ...data } : null
    if (policyObj) {
      policyObj.exempt_employee_ids =
        policyObj.custom_day_hours?._exempt_ids || policyObj.exempt_employee_ids || []
      policyObj.custom_employee_schedules =
        policyObj.custom_day_hours?._employee_schedules || policyObj.custom_employee_schedules || {}
      policyObj.custom_day_schedules =
        policyObj.custom_day_hours?._schedules || policyObj.custom_day_schedules || {}
      policyObj.tracking_start_date =
        policyObj.custom_day_hours?._tracking_start_date || policyObj.tracking_start_date || null

      try {
        const { data: holidaysData } = await serviceClient
          .from('company_holidays')
          .select('*')
          .order('date', { ascending: true })

        if (holidaysData && holidaysData.length > 0) {
          policyObj.official_holidays = holidaysData.map((h) => ({
            id: h.id,
            name: h.name,
            date: typeof h.date === 'string' ? h.date.slice(0, 10) : h.date,
          }))
        } else {
          policyObj.official_holidays = policyObj.custom_day_hours?._holidays || []
        }
      } catch {
        policyObj.official_holidays = policyObj.custom_day_hours?._holidays || []
      }
    }

    return NextResponse.json({ policy: policyObj }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('API /api/attendance/work-policy GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

export async function POST(req: Request) {
  try {
    // Optional role check: allow Admin or Manager to modify policy
    try {
      const userClient = await createClient()
      const { data: { user } } = await userClient.auth.getUser()
      if (user) {
        const { data: profile } = await userClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile && profile.role !== 'ADMIN' && profile.role !== 'SALES_MANAGER') {
          return NextResponse.json({ error: 'Forbidden: Admin or Manager access required' }, { status: 403, headers: NO_CACHE_HEADERS })
        }
      }
    } catch (authErr) {
      console.warn('Auth check skipped or warning in work policy update:', authErr)
    }

    const body = await req.json()
    const serviceClient = await createServiceClient()

    // Check if an existing policy row exists
    const { data: existing } = await serviceClient
      .from('company_work_policy')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const holidays = body.official_holidays || body.custom_day_hours?._holidays
    const exemptIds = body.exempt_employee_ids || body.custom_day_hours?._exempt_ids
    const empSchedules = body.custom_employee_schedules || body.custom_day_hours?._employee_schedules
    const daySchedules = body.custom_day_schedules || body.custom_day_hours?._schedules
    const trackingStartDate = body.tracking_start_date !== undefined ? body.tracking_start_date : (body.custom_day_hours?._tracking_start_date || null)
    const customDayHours = body.custom_day_hours || {}

    if (holidays && Array.isArray(holidays)) {
      customDayHours['_holidays'] = holidays
    }
    if (exemptIds && Array.isArray(exemptIds)) {
      customDayHours['_exempt_ids'] = exemptIds
    }
    if (empSchedules && typeof empSchedules === 'object') {
      customDayHours['_employee_schedules'] = empSchedules
    }
    if (daySchedules && typeof daySchedules === 'object') {
      customDayHours['_schedules'] = daySchedules
    }
    if (trackingStartDate) {
      customDayHours['_tracking_start_date'] = trackingStartDate
    } else {
      delete customDayHours['_tracking_start_date']
    }

    const payload = {
      company_name: body.company_name || 'Asaheeb Real Estate',
      work_days: body.work_days || ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'SATURDAY'],
      daily_expected_hours: Number(body.daily_expected_hours) || 9,
      shift_start_time: body.shift_start_time || '09:00:00',
      shift_end_time: body.shift_end_time || '17:00:00',
      grace_period_mins: Number(body.grace_period_mins ?? 15),
      default_annual_leave_quota: Number(body.default_annual_leave_quota || 21),
      default_sick_leave_quota: Number(body.default_sick_leave_quota || 30),
      custom_day_hours: customDayHours,
      updated_at: new Date().toISOString(),
    }

    let savedData: any = null
    if (existing?.id) {
      const { data, error } = await serviceClient
        .from('company_work_policy')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating company_work_policy via serviceClient:', error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
      }
      savedData = data
    } else {
      const { data, error } = await serviceClient
        .from('company_work_policy')
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error('Error inserting company_work_policy via serviceClient:', error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
      }
      savedData = data
    }

    // Also sync to company_holidays table if provided
    if (holidays && Array.isArray(holidays)) {
      try {
        await serviceClient.from('company_holidays').upsert(
          holidays.map((h: any) => ({
            name: h.name,
            date: typeof h.date === 'string' ? h.date.slice(0, 10) : h.date,
          })),
          { onConflict: 'date' }
        )
      } catch (hErr) {
        // Table may not exist yet, fallback to custom_day_hours JSONB is already saved
      }
    }

    const returnObj = {
      ...savedData,
      exempt_employee_ids: exemptIds || savedData?.custom_day_hours?._exempt_ids || [],
      custom_employee_schedules: empSchedules || savedData?.custom_day_hours?._employee_schedules || {},
      custom_day_schedules: daySchedules || savedData?.custom_day_hours?._schedules || {},
      official_holidays: holidays || savedData?.custom_day_hours?._holidays || [],
      tracking_start_date: trackingStartDate,
    }

    return NextResponse.json({ success: true, policy: returnObj }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('API /api/attendance/work-policy POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
