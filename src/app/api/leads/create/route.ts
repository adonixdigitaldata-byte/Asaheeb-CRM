import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getNextRoundRobinAgent } from '@/lib/round-robin'

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

  const body = await request.json()
  const { name, phone, email, city, interest, potential_value, source, stage_id, assigned_agent_id, property_id, campaign_id, notes } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const supabaseService = await createServiceClient()

  let targetAgentId = assigned_agent_id || null
  let autoAssignedAgent: any = null

  // 1. Auto-assign to self if current user is an AGENT and no agent was explicitly selected
  if (profile?.role === 'AGENT' && (!targetAgentId || targetAgentId === 'AUTO')) {
    targetAgentId = user.id
  } 
  // 2. If left unassigned, empty, or 'AUTO', run Round-Robin among available sales agents
  else if (!targetAgentId || targetAgentId === 'AUTO') {
    const nextAgent = await getNextRoundRobinAgent(supabaseService)
    if (nextAgent) {
      targetAgentId = nextAgent.id
      autoAssignedAgent = nextAgent
    } else {
      targetAgentId = null
    }
  } else if (targetAgentId === 'UNASSIGNED') {
    targetAgentId = null
  }

  const payload: any = {
    name: name.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    city: city?.trim() || null,
    interest: interest?.trim() || null,
    potential_value: potential_value ? parseFloat(potential_value) : null,
    source: source || 'MANUAL',
    stage_id: stage_id,
    assigned_agent_id: targetAgentId,
    property_id: property_id || null,
    campaign_id: campaign_id || null,
    form_data: {},
  }

  const { data: lead, error: insertError } = await supabaseService
    .from('leads')
    .insert(payload)
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  // Update open_leads_count on assigned agent profile
  if (targetAgentId) {
    const { data: agentProfile } = await supabaseService
      .from('profiles')
      .select('open_leads_count')
      .eq('id', targetAgentId)
      .single()

    const currentCount = Number(agentProfile?.open_leads_count) || 0
    await supabaseService
      .from('profiles')
      .update({ open_leads_count: currentCount + 1 })
      .eq('id', targetAgentId)
  }

  // Log activity
  await supabaseService.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'LEAD_CREATED',
    performed_by: user.id,
    metadata: {
      source: source || 'MANUAL',
      round_robin_assigned: !!autoAssignedAgent,
      assigned_agent_name: autoAssignedAgent ? autoAssignedAgent.name : null,
    },
  })

  // Add note if provided
  if (notes && notes.trim()) {
    await supabaseService.from('lead_notes').insert({
      lead_id: lead.id,
      author_id: user.id,
      body: notes.trim(),
    })
  }

  return NextResponse.json({ success: true, lead })
}
