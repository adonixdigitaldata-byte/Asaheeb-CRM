import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFinancialYear, numberToWords } from '@/lib/payroll-utils'

// GET: Fetch all payslips (Admin only)
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('payslips')
    .select(`
      *,
      employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
    `)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, data })
}

// POST: Create a single manual payslip (Admin only)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      employee_id,
      month,
      year,
      currency = 'SAR',
      base_salary = 0,
      earnings_breakdown = [],
      deductions_breakdown = [],
      working_days = 30,
      paid_days = 30,
      lop_days = 0,
      status = 'PAID',
      payment_date = null,
      period_start_date = null,
      period_end_date = null,
      payment_method = 'BANK_TRANSFER',
      designation,
      department,
      employee_code,
      bank_name,
      account_number,
      ifsc_or_iban,
      pan_or_iqama,
      notes,
    } = body

    if (!employee_id || !month || !year) {
      return NextResponse.json({ error: 'employee_id, month, and year are required' }, { status: 400 })
    }

    const grossEarnings = (earnings_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const totalDeductions = (deductions_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const netPay = Math.max(0, grossEarnings - totalDeductions)
    const netPayInWords = numberToWords(netPay, currency)

    const serviceClient = await createServiceClient()

    const { data, error } = await serviceClient
      .from('payslips')
      .upsert(
        {
          employee_id,
          month: Number(month),
          year: Number(year),
          financial_year: getFinancialYear(Number(year), Number(month)),
          currency,
          base_salary: Number(base_salary) || 0,
          earnings_breakdown,
          deductions_breakdown,
          gross_earnings: grossEarnings,
          total_deductions: totalDeductions,
          net_pay: netPay,
          net_pay_in_words: netPayInWords,
          working_days: Number(working_days) || 30,
          paid_days: Number(paid_days) || 30,
          lop_days: Number(lop_days) || 0,
          status,
          payment_date,
          period_start_date,
          period_end_date,
          payment_method,
          designation: designation?.trim() || null,
          department: department?.trim() || null,
          employee_code: employee_code?.trim() || null,
          bank_name: bank_name?.trim() || null,
          account_number: account_number?.trim() || null,
          ifsc_or_iban: ifsc_or_iban?.trim() || null,
          pan_or_iqama: pan_or_iqama?.trim() || null,
          notes: notes?.trim() || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id,month,year' }
      )
      .select(`
        *,
        employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// PUT: Update existing payslip
export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      id,
      currency,
      base_salary,
      earnings_breakdown = [],
      deductions_breakdown = [],
      working_days = 30,
      paid_days = 30,
      lop_days = 0,
      status = 'PAID',
      payment_date = null,
      payment_method = 'BANK_TRANSFER',
      designation,
      department,
      employee_code,
      bank_name,
      account_number,
      ifsc_or_iban,
      pan_or_iqama,
      notes,
      period_start_date = null,
      period_end_date = null,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Payslip ID is required' }, { status: 400 })
    }

    const grossEarnings = (earnings_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const totalDeductions = (deductions_breakdown || []).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const netPay = Math.max(0, grossEarnings - totalDeductions)
    const netPayInWords = numberToWords(netPay, currency || 'SAR')

    const serviceClient = await createServiceClient()

    const { data, error } = await serviceClient
      .from('payslips')
      .update({
        currency,
        base_salary: Number(base_salary) || 0,
        earnings_breakdown,
        deductions_breakdown,
        gross_earnings: grossEarnings,
        total_deductions: totalDeductions,
        net_pay: netPay,
        net_pay_in_words: netPayInWords,
        working_days: Number(working_days) || 30,
        paid_days: Number(paid_days) || 30,
        lop_days: Number(lop_days) || 0,
        status,
        payment_date,
        payment_method,
        designation: designation?.trim() || null,
        department: department?.trim() || null,
        employee_code: employee_code?.trim() || null,
        bank_name: bank_name?.trim() || null,
        account_number: account_number?.trim() || null,
        ifsc_or_iban: ifsc_or_iban?.trim() || null,
        pan_or_iqama: pan_or_iqama?.trim() || null,
        notes: notes?.trim() || null,
        period_start_date,
        period_end_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// DELETE: Delete single or bulk payslips
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const queryId = searchParams.get('id')

  let bodyIds: string[] = []
  let bodyId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body.ids)) bodyIds = body.ids
    else if (Array.isArray(body.payslipIds)) bodyIds = body.payslipIds
    else if (body.id) bodyId = body.id
  } catch (_) {
    // Ignore JSON parsing if body is empty
  }

  const targetIds = bodyIds.length > 0 ? bodyIds : (queryId || bodyId ? [queryId || bodyId!] : [])

  if (targetIds.length === 0) {
    return NextResponse.json({ error: 'Payslip ID is required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient.from('payslips').delete().in('id', targetIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, count: targetIds.length })
}
