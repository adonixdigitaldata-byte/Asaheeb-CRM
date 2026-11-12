import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerWebsiteBlogRevalidation } from '@/lib/website-sync'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await triggerWebsiteBlogRevalidation()
    if (!result.revalidated) {
      return NextResponse.json(
        { error: result.error || 'Failed to revalidate website cache' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
