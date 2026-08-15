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
    return NextResponse.json({ error: 'Only administrators can bulk assign leads' }, { status: 403 })
  }

  const body = await request.json()
  const { leadIds, agentId } = body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: 'No leads selected for assignment' }, { status: 400 })
  }

  const supabaseService = await createServiceClient()
  const targetAgentId = agentId || null

  const { error: updateError } = await supabaseService
    .from('leads')
    .update({ assigned_agent_id: targetAgentId })
    .in('id', leadIds)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  // Insert activity records
  const activityPayloads = leadIds.map((leadId: string) => ({
    lead_id: leadId,
    activity_type: 'ASSIGNED',
    performed_by: user.id,
    metadata: { assigned_to: targetAgentId },
  }))

  await supabaseService.from('lead_activities').insert(activityPayloads)

  return NextResponse.json({ success: true, count: leadIds.length })
}
