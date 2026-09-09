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

    const serviceClient = await createServiceClient()
    const { id, is_active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Popup ID is required' }, { status: 400 })
    }

    const { data: popup, error } = await serviceClient
      .from('marketing_popups')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, popup })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error toggling marketing popup' }, { status: 500 })
  }
}
