import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Recalculates developer_received_amount, developer_payment_status,
 * agent_paid_amount, and agent_payout_status on project_commissions
 * from the commission_payments ledger.
 */
async function recalculateCommissionCashFlow(supabase: any, commissionId: string) {
  const [{ data: comm, error: commErr }, { data: payments, error: payErr }] = await Promise.all([
    supabase.from('project_commissions').select('*').eq('id', commissionId).single(),
    supabase
      .from('commission_payments')
      .select('*')
      .eq('commission_id', commissionId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (commErr || !comm) {
    throw new Error(commErr?.message || 'Commission record not found')
  }
  if (payErr) {
    throw new Error(payErr.message)
  }

  const allPayments = payments || []
  const inflowTotal = allPayments
    .filter((p: any) => p.direction === 'INFLOW')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

  const outflowTotal = allPayments
    .filter((p: any) => p.direction === 'OUTFLOW')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

  const expectedDev = Number(comm.commission_amount || 0)
  let devStatus: 'PENDING' | 'PARTIAL' | 'RECEIVED' = 'PENDING'
  if (inflowTotal > 0) {
    devStatus = expectedDev > 0 && inflowTotal >= expectedDev ? 'RECEIVED' : 'PARTIAL'
  }

  const expectedAgent = Number(comm.agent_commission_amount || 0)
  let agentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID'
  if (outflowTotal > 0) {
    agentStatus = expectedAgent > 0 && outflowTotal >= expectedAgent ? 'PAID' : 'PARTIAL'
  }

  const { data: updatedComm, error: updateErr } = await supabase
    .from('project_commissions')
    .update({
      developer_received_amount: inflowTotal,
      developer_payment_status: devStatus,
      agent_paid_amount: outflowTotal,
      agent_payout_status: agentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commissionId)
    .select('*')
    .single()

  if (updateErr) {
    throw new Error(updateErr.message)
  }

  return { commission: updatedComm, payments: allPayments }
}

// GET /api/projects/commissions/payments?commissionId=...&recipientId=...&allOutflows=true
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(request.url)
    const commissionId = searchParams.get('commissionId')
    const recipientId = searchParams.get('recipientId')
    const allOutflows = searchParams.get('allOutflows') === 'true'

    if (allOutflows) {
      if (callerProfile?.role !== 'ADMIN') {
        const { data: payments, error } = await supabase
          .from('commission_payments')
          .select('*')
          .eq('direction', 'OUTFLOW')
          .eq('recipient_id', user.id)
          .order('payment_date', { ascending: false })
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ payments: payments || [] })
      }
      const { data: payments, error } = await supabase
        .from('commission_payments')
        .select('*')
        .eq('direction', 'OUTFLOW')
        .order('payment_date', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ payments: payments || [] })
    }

    if (recipientId) {
      if (callerProfile?.role !== 'ADMIN' && recipientId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const { data: payments, error } = await supabase
        .from('commission_payments')
        .select('*')
        .eq('direction', 'OUTFLOW')
        .eq('recipient_id', recipientId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ payments: payments || [] })
    }

    if (!commissionId) {
      return NextResponse.json({ error: 'commissionId or recipientId is required' }, { status: 400 })
    }

    // Non-admins can only view payments for their own deals
    if (callerProfile?.role !== 'ADMIN') {
      const { data: comm } = await supabase
        .from('project_commissions')
        .select('id, agent_id, created_by')
        .eq('id', commissionId)
        .single()

      if (!comm || (comm.agent_id !== user.id && comm.created_by !== user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: payments, error } = await supabase
      .from('commission_payments')
      .select('*')
      .eq('commission_id', commissionId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ payments: payments || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch payments' }, { status: 500 })
  }
}

// POST /api/projects/commissions/payments
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can record or modify commission payments' }, { status: 403 })
    }

    const body = await request.json()
    const { commission_id, action } = body

    // Mode 0: Batch mark multiple deals as Claim Sent
    if (action === 'BATCH_MARK_CLAIM_SENT') {
      const commissionIds: string[] = Array.isArray(body.commission_ids) ? body.commission_ids : []
      if (commissionIds.length === 0) {
        return NextResponse.json({ error: 'commission_ids array is required' }, { status: 400 })
      }
      const nowIso = new Date().toISOString()
      const { data: updatedRows, error: batchErr } = await supabase
        .from('project_commissions')
        .update({ claim_sent_at: nowIso, updated_at: nowIso })
        .in('id', commissionIds)
        .select('*')

      if (batchErr) {
        return NextResponse.json({ error: batchErr.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, commissions: updatedRows || [] })
    }

    // Mode 1: Monthly target-adjusted agent/manager payout (not tied to a single deal)
    if (action === 'MONTHLY_PAYOUT') {
      const { recipient_id, payout_month, amount, payment_date, payment_method, reference_no, notes } = body
      if (!recipient_id) {
        return NextResponse.json({ error: 'recipient_id is required' }, { status: 400 })
      }
      const numericAmount = Number(amount)
      if (!numericAmount || numericAmount <= 0) {
        return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 })
      }
      const { data: inserted, error: insErr } = await supabase
        .from('commission_payments')
        .insert({
          commission_id: null,
          direction: 'OUTFLOW',
          recipient_id,
          payout_month: payout_month || new Date().toISOString().slice(0, 7),
          amount: numericAmount,
          payment_date: payment_date || new Date().toISOString().split('T')[0],
          payment_method: payment_method || 'BANK_TRANSFER',
          reference_no: reference_no ? String(reference_no).trim() : null,
          notes: notes ? String(notes).trim() : null,
          recorded_by: user.id,
        })
        .select('*')
        .single()

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, payment: inserted }, { status: 201 })
    }

    if (!commission_id) {
      return NextResponse.json({ error: 'commission_id is required' }, { status: 400 })
    }

    // Mode 2: Update cash-flow terms (expected payout date, agent share, or mark claim sent)
    if (action === 'UPDATE_TERMS') {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }
      if (body.expected_payout_date !== undefined) {
        updates.expected_payout_date = body.expected_payout_date || null
      }
      if (body.agent_commission_amount !== undefined) {
        updates.agent_commission_amount = Math.max(0, Number(body.agent_commission_amount) || 0)
      }
      if (body.mark_claim_sent) {
        updates.claim_sent_at = new Date().toISOString()
      }

      const { error: termErr } = await supabase
        .from('project_commissions')
        .update(updates)
        .eq('id', commission_id)

      if (termErr) {
        return NextResponse.json({ error: termErr.message }, { status: 400 })
      }

      const result = await recalculateCommissionCashFlow(supabase, commission_id)
      return NextResponse.json({ success: true, ...result })
    }

    // Mode 3: Log a deal-level INFLOW or OUTFLOW payment tranche
    const { direction, amount, payment_date, payment_method, reference_no, notes, recipient_id } = body

    if (direction !== 'INFLOW' && direction !== 'OUTFLOW') {
      return NextResponse.json({ error: 'Invalid payment direction (INFLOW or OUTFLOW required)' }, { status: 400 })
    }

    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 })
    }

    const { error: insertErr } = await supabase.from('commission_payments').insert({
      commission_id,
      direction,
      recipient_id: direction === 'OUTFLOW' ? recipient_id || null : null,
      amount: numericAmount,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      payment_method: payment_method || 'BANK_TRANSFER',
      reference_no: reference_no ? String(reference_no).trim() : null,
      notes: notes ? String(notes).trim() : null,
      recorded_by: user.id,
    })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 })
    }

    const result = await recalculateCommissionCashFlow(supabase, commission_id)
    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to record payment' }, { status: 500 })
  }
}

// DELETE /api/projects/commissions/payments?id=...&commissionId=...
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can delete payment records' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const commissionId = searchParams.get('commissionId')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    if (commissionId && commissionId !== 'null' && commissionId !== 'undefined') {
      const { error } = await supabase
        .from('commission_payments')
        .delete()
        .eq('id', id)
        .eq('commission_id', commissionId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      const result = await recalculateCommissionCashFlow(supabase, commissionId)
      return NextResponse.json({ success: true, ...result })
    } else {
      // Monthly payout deletion (no commission_id)
      const { error } = await supabase
        .from('commission_payments')
        .delete()
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete payment' }, { status: 500 })
  }
}

// PUT /api/projects/commissions/payments (Edit an existing payment or monthly disbursement)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can edit payment records' }, { status: 403 })
    }

    const body = await request.json()
    const { id, commission_id, amount, payment_date, payment_method, reference_no, notes, payout_month } = body

    if (!id) {
      return NextResponse.json({ error: 'Payment id is required' }, { status: 400 })
    }

    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 })
    }

    const updates: Record<string, any> = {
      amount: numericAmount,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      payment_method: payment_method || 'BANK_TRANSFER',
      reference_no: reference_no ? String(reference_no).trim() : null,
      notes: notes ? String(notes).trim() : null,
    }
    if (payout_month !== undefined) {
      updates.payout_month = payout_month || null
    }

    const { data: updatedPayment, error } = await supabase
      .from('commission_payments')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (commission_id) {
      const result = await recalculateCommissionCashFlow(supabase, commission_id)
      return NextResponse.json({ success: true, payment: updatedPayment, ...result })
    }

    return NextResponse.json({ success: true, payment: updatedPayment })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update payment' }, { status: 500 })
  }
}
