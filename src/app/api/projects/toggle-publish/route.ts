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

    const { id, is_published } = await request.json()
    if (!id || typeof is_published !== 'boolean') {
      return NextResponse.json({ error: 'id and is_published are required' }, { status: 400 })
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
      .update({ is_published, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await logCmsActivity({
      entityType: 'PROJECT',
      entityId: id,
      actionType: is_published ? 'PUBLISHED' : 'UNPUBLISHED',
      actorId: user.id,
      actorName,
      actorEmail,
      description: is_published
        ? `Published project "${project?.name_en || id}" to live website`
        : `Unpublished project "${project?.name_en || id}" (moved to draft)`,
    })

    return NextResponse.json({ success: true, is_published })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating publish status' }, { status: 500 })
  }
}

