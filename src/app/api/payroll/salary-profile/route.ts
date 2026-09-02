import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      profile_id,
      currency = 'SAR',
      base_salary = 0,
      joining_date = new Date().toISOString().split('T')[0],
      designation = '',
      department = 'Sales',
      employee_code = '',
      bank_name = '',
      account_number = '',
      ifsc_or_iban = '',
      pan_or_iqama = '',
      iqama_expiry_date = null,
      default_allowances = [],
      default_deductions = [],
    } = body

    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const payload = {
      profile_id,
      currency,
      base_salary: Number(base_salary) || 0,
      joining_date,
      designation: designation?.trim() || null,
      department: department?.trim() || 'Sales',
      employee_code: employee_code?.trim() || null,
      bank_name: bank_name?.trim() || null,
      account_number: account_number?.trim() || null,
      ifsc_or_iban: ifsc_or_iban?.trim() || null,
      pan_or_iqama: pan_or_iqama?.trim() || null,
      iqama_expiry_date: iqama_expiry_date || null,
      default_allowances: default_allowances || [],
      default_deductions: default_deductions || [],
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await serviceClient
      .from('employee_salary_profiles')
      .upsert(payload, { onConflict: 'profile_id' })
      .select('*')
      .single()

    if (error) {
      console.error('Error saving salary profile:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Sync to profiles table for global lookup & n8n automations
    await serviceClient
      .from('profiles')
      .update({
        iqama_no: pan_or_iqama?.trim() || null,
        iqama_expiry_date: iqama_expiry_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile_id)

    // Sync to active open-ended salary history interval (if exists) or create initial record
    const { data: activeHistories } = await serviceClient
      .from('employee_salary_history')
      .select('*')
      .eq('profile_id', profile_id)
      .is('end_date', null)
      .order('start_date', { ascending: false })

    if (activeHistories && activeHistories.length > 0) {
      // Update the active open-ended interval
      await serviceClient
        .from('employee_salary_history')
        .update({
          base_salary: Number(base_salary) || 0,
          currency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeHistories[0].id)
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Salary profile server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
