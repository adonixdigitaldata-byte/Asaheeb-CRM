import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CmsActivity } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('cms_activities')
      .select('*')
      .eq('entity_type', entityType.toUpperCase())
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ activities: (data as CmsActivity[]) || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch activities' }, { status: 500 })
  }
}
