import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentWeekCycle, isBookingInCycle } from '@/lib/consultations'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function handleRollover(req: NextRequest) {
  try {
    // 1. Optional security token check
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = req.headers.get('authorization')
      const xSecret = req.headers.get('x-cron-secret')
      const querySecret = req.nextUrl.searchParams.get('secret')

      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` ||
        xSecret === cronSecret ||
        querySecret === cronSecret

      if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' }, { status: 401 })
      }
    }

    // 2. Initialize Supabase Service Client (bypasses RLS for automated cron maintenance)
    const supabase = await createServiceClient()

    // 3. Calculate current Saudi operating week cycle (Saturday through Thursday)
    const activeCycle = getCurrentWeekCycle()

    // 4. Fetch current consultation settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('consultation_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (settingsError || !settingsData) {
      return NextResponse.json(
        { error: 'Failed to retrieve consultation_settings', details: settingsError?.message },
        { status: 500 }
      )
    }

    // 5. Fetch confirmed paid bookings to compute active week slots
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('consultation_bookings')
      .select('id, booking_reference, week_cycle, paid_at, created_at, amount_paid, payment_status, status')
      .eq('payment_status', 'SUCCESS')
      .neq('status', 'CANCELLED_REFUNDED')
      .neq('status', 'PAYMENT_PENDING')

    if (bookingsError) {
      return NextResponse.json(
        { error: 'Failed to retrieve consultation_bookings', details: bookingsError.message },
        { status: 500 }
      )
    }

    // 6. Filter bookings that belong to the active weekly cycle
    const currentWeekBookings = (bookingsData || []).filter((b) =>
      isBookingInCycle(b, activeCycle)
    )
    const computedSlots = currentWeekBookings.length

    const previousCycle = settingsData.current_week_cycle
    const previousSlots = settingsData.slots_booked_this_week

    const needsUpdate =
      previousCycle !== activeCycle.cycleString || previousSlots !== computedSlots

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('consultation_settings')
        .update({
          current_week_cycle: activeCycle.cycleString,
          slots_booked_this_week: computedSlots,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settingsData.id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update consultation_settings', details: updateError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      updated: needsUpdate,
      current_cycle: activeCycle.cycleString,
      previous_cycle: previousCycle,
      slots_booked_this_week: computedSlots,
      weekly_slot_capacity: settingsData.weekly_slot_capacity,
      remaining_allocations: Math.max(0, settingsData.weekly_slot_capacity - computedSlots),
      active_week_bookings_count: computedSlots,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('Error executing consultation rollover cron:', err)
    return NextResponse.json(
      { error: 'Internal server error during consultation rollover', details: err?.message },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return handleRollover(req)
}

export async function POST(req: NextRequest) {
  return handleRollover(req)
}

