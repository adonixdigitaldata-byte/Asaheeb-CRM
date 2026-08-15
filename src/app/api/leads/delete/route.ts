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

  const { leadId } = await request.json()
  if (!leadId) {
    return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  // Clean up child records
  await serviceClient.from('lead_notes').delete().eq('lead_id', leadId)
  await serviceClient.from('lead_followups').delete().eq('lead_id', leadId)
  await serviceClient.from('lead_activities').delete().eq('lead_id', leadId)
  await serviceClient.from('lead_stage_history').delete().eq('lead_id', leadId)

  // Delete the lead
  const { error: deleteError } = await serviceClient
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
