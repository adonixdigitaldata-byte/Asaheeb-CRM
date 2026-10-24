import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logCmsActivity } from '@/lib/cms-activity'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ai_agent_enabled } = await request.json()
    if (!id || typeof ai_agent_enabled !== 'boolean') {
      return NextResponse.json({ error: 'id and ai_agent_enabled are required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const { data: project } = await serviceClient
      .from('projects')
      .select('name_en')
      .eq('id', id)
      .single()

    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    const actorName = userProfile?.name || user.email?.split('@')[0] || 'Team Member'
    const actorEmail = userProfile?.email || user.email || null

    const { error } = await serviceClient
      .from('projects')
      .update({ ai_agent_enabled, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logCmsActivity({
      entityType: 'PROJECT',
      entityId: id,
      actionType: 'UPDATED_DETAILS',
      actorId: user.id,
      actorName,
      actorEmail,
      description: ai_agent_enabled
        ? `Activated AI Property Advisor widget on project "${project?.name_en || id}"`
        : `Deactivated AI Property Advisor widget on project "${project?.name_en || id}"`,
    })

    return NextResponse.json({ success: true, ai_agent_enabled })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating AI Agent status' }, { status: 500 })
  }
}
