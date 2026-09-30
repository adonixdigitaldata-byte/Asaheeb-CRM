import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zqmrubwzhxpigncueqig.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, leadIds, id, ids } = body

    let idsToDelete: string[] = []
    if (Array.isArray(leadIds)) {
      idsToDelete = leadIds.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
    } else if (Array.isArray(ids)) {
      idsToDelete = ids.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
    } else if (typeof leadId === 'string' && leadId.trim().length > 0) {
      idsToDelete = [leadId.trim()]
    } else if (typeof id === 'string' && id.trim().length > 0) {
      idsToDelete = [id.trim()]
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json(
        { success: false, error: 'leadId or leadIds array is required.' },
        { status: 400 }
      )
    }

    const client = createClient(supabaseUrl, supabaseServiceKey)
    const { error } = await client
      .from('mortgage_leads')
      .delete()
      .in('id', idsToDelete)

    if (error) {
      console.error('Failed to delete mortgage lead(s):', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, count: idsToDelete.length })
  } catch (err: any) {
    console.error('Error in /api/mortgage-leads/delete:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}