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

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
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

    // Nullify references in leads table before deletion to preserve leads
    await serviceClient.from('leads').update({ property_id: null }).eq('property_id', id)

    const { error } = await serviceClient
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logCmsActivity({
      entityType: 'PROJECT',
      entityId: id,
      actionType: 'DELETED',
      actorId: user.id,
      actorName,
      actorEmail,
      description: `Deleted project "${project?.name_en || id}" from system`,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error deleting project' }, { status: 500 })
  }
}

