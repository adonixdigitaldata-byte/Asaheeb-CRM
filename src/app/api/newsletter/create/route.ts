import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, source = 'MANUAL' } = body

  if (!email || !email.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabaseService = await createServiceClient()

  const { data, error } = await supabaseService
    .from('newsletter_subscribers')
    .upsert(
      [
        {
          email: cleanEmail,
          source,
          status: 'SUBSCRIBED',
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'email' }
    )
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const createdSubscriber = data && data.length > 0 ? data[0] : null

  return NextResponse.json({ success: true, subscriber: createdSubscriber })
}
