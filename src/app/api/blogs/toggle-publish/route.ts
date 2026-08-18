import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can update article status' }, { status: 403 })
    }

    const { id, is_published, featured } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

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

    return NextResponse.json({ success: true, ...updatePayload })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating article status' }, { status: 500 })
  }
}
