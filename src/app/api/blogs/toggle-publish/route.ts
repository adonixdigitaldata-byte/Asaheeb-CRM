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

    const { id, is_published, featured } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const { data: blog } = await serviceClient
      .from('blogs')
      .select('title_en')
      .eq('id', id)
      .single()

    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    const actorName = userProfile?.name || user.email?.split('@')[0] || 'Team Member'
    const actorEmail = userProfile?.email || user.email || null

    if (typeof featured === 'boolean') {
      if (featured) {
        // Enforce SINGLE featured article: Unfeature all others
        await serviceClient
          .from('blogs')
          .update({ featured: false, updated_at: new Date().toISOString() })
          .neq('id', id)

        // Pin the newly featured article to slot #1 (sort_order = 1)
        await serviceClient
          .from('blogs')
          .update({ featured: true, sort_order: 1, updated_at: new Date().toISOString() })
          .eq('id', id)

        // Shift remaining blogs to sort_order 2, 3, 4...
        const { data: otherBlogs } = await serviceClient
          .from('blogs')
          .select('id, sort_order')
          .neq('id', id)
          .order('sort_order', { ascending: true })

        if (otherBlogs && otherBlogs.length > 0) {
          for (let i = 0; i < otherBlogs.length; i++) {
            await serviceClient
              .from('blogs')
              .update({ sort_order: i + 2 })
              .eq('id', otherBlogs[i].id)
          }
        }

        await logCmsActivity({
          entityType: 'BLOG',
          entityId: id,
          actionType: 'UPDATED_DETAILS',
          actorId: user.id,
          actorName,
          actorEmail,
          description: `Set article "${blog?.title_en || id}" as primary featured insight`,
        })

        return NextResponse.json({ success: true, featured: true, sort_order: 1 })
      } else {
        // Unfeaturing
        await serviceClient
          .from('blogs')
          .update({ featured: false, updated_at: new Date().toISOString() })
          .eq('id', id)

        return NextResponse.json({ success: true, featured: false })
      }
    }

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (typeof is_published === 'boolean') updatePayload.is_published = is_published

    const { error } = await serviceClient
      .from('blogs')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (typeof is_published === 'boolean') {
      await logCmsActivity({
        entityType: 'BLOG',
        entityId: id,
        actionType: is_published ? 'PUBLISHED' : 'UNPUBLISHED',
        actorId: user.id,
        actorName,
        actorEmail,
        description: is_published
          ? `Published article "${blog?.title_en || id}" to live website`
          : `Unpublished article "${blog?.title_en || id}" (moved to draft)`,
      })
    }

    return NextResponse.json({ success: true, ...updatePayload })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating article status' }, { status: 500 })
  }
}

