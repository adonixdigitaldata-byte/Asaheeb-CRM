import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabaseUser
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Only administrators can delete leads' }, { status: 403 })
  }

  const body = await request.json()
  const { leadIds } = body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'leadIds array is required' }, { status: 400 })
  }

  const idsToDelete = leadIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
  if (idsToDelete.length === 0) {
    return NextResponse.json({ error: 'No valid lead IDs provided' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  // Clean up child records
  await serviceClient.from('lead_notes').delete().in('lead_id', idsToDelete)
  await serviceClient.from('lead_followups').delete().in('lead_id', idsToDelete)
  await serviceClient.from('lead_activities').delete().in('lead_id', idsToDelete)
  await serviceClient.from('lead_stage_history').delete().in('lead_id', idsToDelete)

  // Delete the leads
  const { error: deleteError } = await serviceClient
    .from('leads')
    .delete()
    .in('id', idsToDelete)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, count: idsToDelete.length })
}
