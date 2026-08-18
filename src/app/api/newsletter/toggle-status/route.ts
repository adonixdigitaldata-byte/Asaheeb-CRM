import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, email, status } = body

  if ((!id && !email) || !status) {
    return NextResponse.json({ error: 'Subscriber ID or email and status are required' }, { status: 400 })
  }

  const newStatus = status.toUpperCase() === 'UNSUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED'
  const supabaseService = await createServiceClient()

  // 1. First find the target subscriber
  let findQuery = supabaseService.from('newsletter_subscribers').select('*')
  if (id) {
    findQuery = findQuery.eq('id', id)
  } else if (email) {
    findQuery = findQuery.eq('email', email.trim().toLowerCase())
  }

  const { data: existingRows, error: findError } = await findQuery

  if (findError) {
    console.error('Error finding subscriber:', findError)
    return NextResponse.json({ error: findError.message }, { status: 400 })
  }

  const targetSubscriber = existingRows && existingRows.length > 0 ? existingRows[0] : null

  if (!targetSubscriber) {
    // Try by email if id was provided
    if (id && email) {
      const { data: byEmailRows } = await supabaseService
        .from('newsletter_subscribers')
        .select('*')
        .eq('email', email.trim().toLowerCase())

      if (byEmailRows && byEmailRows.length > 0) {
        const found = byEmailRows[0]
        await supabaseService
          .from('newsletter_subscribers')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', found.id)

        return NextResponse.json({
          success: true,
          subscriber: { ...found, status: newStatus, updated_at: new Date().toISOString() },
        })
      }
    }

    return NextResponse.json({ error: 'Subscriber not found in database' }, { status: 404 })
  }

  // 2. Perform the update on the verified record
  const { error: updateError } = await supabaseService
    .from('newsletter_subscribers')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetSubscriber.id)

  if (updateError) {
    console.error('Error updating subscriber:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const updatedSubscriber = {
    ...targetSubscriber,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  return NextResponse.json({ success: true, subscriber: updatedSubscriber })
}
