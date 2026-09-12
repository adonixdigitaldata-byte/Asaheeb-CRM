import { NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { DEFAULT_JEDDAH_HQ } from '@/lib/geoUtils'
import { CompanyLocation } from '@/types/attendance'

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
      .from('company_locations')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching office location via serviceClient:', error)
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
    }

    if (data) {
      return NextResponse.json({ location: data as CompanyLocation }, { headers: NO_CACHE_HEADERS })
    }

    // If no row exists yet in database, create the initial default row
    const defaultPayload = {
      name: DEFAULT_JEDDAH_HQ.name,
      address: DEFAULT_JEDDAH_HQ.address,
      latitude: DEFAULT_JEDDAH_HQ.latitude,
      longitude: DEFAULT_JEDDAH_HQ.longitude,
      radius_meters: DEFAULT_JEDDAH_HQ.radius_meters,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    const { data: created, error: createErr } = await serviceClient
      .from('company_locations')
      .insert(defaultPayload)
      .select()
      .single()

    if (!createErr && created) {
      return NextResponse.json({ location: created as CompanyLocation }, { headers: NO_CACHE_HEADERS })
    }

    return NextResponse.json(
      {
        location: {
          id: 'default-jeddah',
          ...defaultPayload,
        } as CompanyLocation,
      },
      { headers: NO_CACHE_HEADERS }
    )
  } catch (err: any) {
    console.error('API /api/attendance/office-location GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

export async function POST(req: Request) {
  try {
    // Optional permission verification for Admin/Manager
    try {
      const userClient = await createClient()
      const {
        data: { user },
      } = await userClient.auth.getUser()
      if (user) {
        const { data: profile } = await userClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile && profile.role !== 'ADMIN' && profile.role !== 'SALES_MANAGER') {
          return NextResponse.json(
            { error: 'Forbidden: Admin or Manager access required' },
            { status: 403, headers: NO_CACHE_HEADERS }
          )
        }
      }
    } catch (authErr) {
      console.warn('Auth check skipped in office location update:', authErr)
    }

    const body = await req.json()
    const serviceClient = await createServiceClient()

    const payload = {
      name: body.name || DEFAULT_JEDDAH_HQ.name,
      address: body.address || DEFAULT_JEDDAH_HQ.address,
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      radius_meters: Number(body.radius_meters) || 150,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    // Check if any existing company location row exists
    const { data: existing } = await serviceClient
      .from('company_locations')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let saved: CompanyLocation | null = null

    if (existing?.id) {
      const { data, error } = await serviceClient
        .from('company_locations')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating company_locations via serviceClient:', error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
      }
      saved = data as CompanyLocation
    } else {
      const { data, error } = await serviceClient
        .from('company_locations')
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error('Error inserting company_locations via serviceClient:', error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
      }
      saved = data as CompanyLocation
    }

    return NextResponse.json({ success: true, location: saved }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('API /api/attendance/office-location POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
