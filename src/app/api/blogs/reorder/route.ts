import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can reorder blog articles' }, { status: 403 })
    }

    const body = await request.json()
    const items: { id: string; sort_order: number }[] = body.items || []

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided for reordering' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    for (const item of items) {
      await serviceClient
        .from('blogs')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reorder blog articles' }, { status: 500 })
  }
}
