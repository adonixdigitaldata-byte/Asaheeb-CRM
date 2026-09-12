import { NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { CompanyHoliday } from '@/types/attendance'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

const DEFAULT_OFFICIAL_HOLIDAYS: CompanyHoliday[] = [
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

export async function GET() {
  try {
    const serviceClient = await createServiceClient()

    // 1. Try fetching from dedicated public.company_holidays table
    try {
      const { data, error } = await serviceClient
        .from('company_holidays')
        .select('*')
        .order('date', { ascending: true })

      if (!error && data && data.length > 0) {
        return NextResponse.json(
          {
            holidays: data.map((h) => ({
              id: h.id,
              name: h.name,
              date: typeof h.date === 'string' ? h.date.slice(0, 10) : h.date,
            })),
          },
          { headers: NO_CACHE_HEADERS }
        )
      }
    } catch (tblErr) {
      // Table may not have been created in database yet
    }

    // 2. Fallback to company_work_policy.custom_day_hours._holidays
    const { data: policyData } = await serviceClient
      .from('company_work_policy')
      .select('custom_day_hours')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const holidays =
      policyData?.custom_day_hours?._holidays ||
      (policyData as any)?.official_holidays ||
      DEFAULT_OFFICIAL_HOLIDAYS

    return NextResponse.json({ holidays }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('API /api/attendance/holidays GET error:', err)
    return NextResponse.json({ holidays: DEFAULT_OFFICIAL_HOLIDAYS, error: err.message }, { status: 200, headers: NO_CACHE_HEADERS })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { holidays } = body

    const serviceClient = await createServiceClient()

    let updatedHolidays: CompanyHoliday[] = []

    if (Array.isArray(holidays)) {
      updatedHolidays = holidays
    } else if (body.name && body.date) {
      const getRes = await GET()
      const existing = (await getRes.json()).holidays || []
      const newHol: CompanyHoliday = {
        id: body.id || `hol-${Date.now()}`,
        name: body.name.trim(),
        date: body.date,
      }
      updatedHolidays = [...existing.filter((h: CompanyHoliday) => h.date !== body.date), newHol].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    } else {
      return NextResponse.json({ error: 'Invalid holiday payload' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    // Try persisting to public.company_holidays table if present
    try {
      await serviceClient.from('company_holidays').upsert(
        updatedHolidays.map((h) => ({
          name: h.name,
          date: h.date,
        })),
        { onConflict: 'date' }
      )
    } catch (tblErr) {
      console.warn('Syncing to company_holidays table skipped/fallback:', tblErr)
    }

    // Always synchronize with company_work_policy.custom_day_hours._holidays
    try {
      const { data: currentPolicy } = await serviceClient
        .from('company_work_policy')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (currentPolicy?.id) {
        const rawCustom = { ...(currentPolicy.custom_day_hours || {}) }
        rawCustom['_holidays'] = updatedHolidays
        await serviceClient
          .from('company_work_policy')
          .update({
            custom_day_hours: rawCustom,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentPolicy.id)
      }
    } catch (polErr) {
      console.warn('Syncing to company_work_policy failed:', polErr)
    }

    return NextResponse.json({ success: true, holidays: updatedHolidays }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('API /api/attendance/holidays POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const holidayId = searchParams.get('id')
    const holidayDate = searchParams.get('date')

    if (!holidayId && !holidayDate) {
      return NextResponse.json({ error: 'id or date is required to delete' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const serviceClient = await createServiceClient()

    // 1. Delete from company_holidays table if present
    try {
      if (holidayDate) {
        await serviceClient.from('company_holidays').delete().eq('date', holidayDate)
      } else if (holidayId) {
        await serviceClient.from('company_holidays').delete().eq('id', holidayId)
      }
    } catch (e) {}

    // 2. Delete from company_work_policy
    const { data: currentPolicy } = await serviceClient
      .from('company_work_policy')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let remainingHolidays: CompanyHoliday[] = []
    if (currentPolicy?.id) {
      const rawCustom = { ...(currentPolicy.custom_day_hours || {}) }
      const currentList: CompanyHoliday[] = rawCustom['_holidays'] || DEFAULT_OFFICIAL_HOLIDAYS
      remainingHolidays = currentList.filter((h) => {
        if (holidayId && h.id === holidayId) return false
        if (holidayDate && h.date === holidayDate) return false
        return true
      })
      rawCustom['_holidays'] = remainingHolidays
      await serviceClient
        .from('company_work_policy')
        .update({
          custom_day_hours: rawCustom,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentPolicy.id)
    }

    return NextResponse.json({ success: true, holidays: remainingHolidays }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('API /api/attendance/holidays DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
