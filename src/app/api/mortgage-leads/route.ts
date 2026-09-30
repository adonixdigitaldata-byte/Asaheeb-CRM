import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zqmrubwzhxpigncueqig.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// CORS headers for public website submissions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      full_name,
      phone,
      phone_number,
      bank_name,
      bank_name_en,
      bank_slug,
      property_price,
      down_payment_amount,
      down_payment_pct,
      loan_period_years,
      applied_rate_pct,
      monthly_instalment,
      total_payable,
      total_payable_value,
      total_loan_amount,
      monthly_income,
      monthly_obligations,
      is_citizen,
      is_first_home,
      has_redf_support,
      redf_supported,
      source,
    } = body

    if (!full_name || (!phone && !phone_number)) {
      return NextResponse.json(
        { success: false, error: 'Full name and phone number are required.' },
        { status: 400, headers: corsHeaders }
      )
    }

    const client = createClient(supabaseUrl, supabaseServiceKey)

    const resolvedPhone = phone || phone_number
    const resolvedBankName = bank_name || bank_name_en || bank_slug || 'Selected Bank'
    const resolvedTotalPayable = total_payable ?? total_payable_value ?? 0
    const resolvedHasRedf = has_redf_support ?? redf_supported

    const leadRecord = {
      full_name,
      phone: resolvedPhone,
      phone_number: resolvedPhone,
      bank_name: resolvedBankName,
      bank_name_en: resolvedBankName,
      bank_slug: bank_slug || '',
      property_price: Number(property_price) || 0,
      down_payment_amount: Number(down_payment_amount) || 0,
      down_payment_pct: Number(down_payment_pct) || 0,
      loan_period_years: Number(loan_period_years) || 15,
      applied_rate_pct: Number(applied_rate_pct) || 0,
      monthly_instalment: Number(monthly_instalment) || 0,
      total_payable: Number(resolvedTotalPayable),
      total_payable_value: Number(resolvedTotalPayable),
      total_loan_amount: Number(total_loan_amount) || (Number(property_price) - Number(down_payment_amount)),
      monthly_income: monthly_income ? Number(monthly_income) : null,
      monthly_obligations: monthly_obligations ? Number(monthly_obligations) : null,
      is_citizen: is_citizen ?? true,
      is_first_home: is_first_home ?? null,
      has_redf_support: resolvedHasRedf ?? null,
      redf_supported: resolvedHasRedf ?? null,
      status: 'new',
      source: source || 'website_mortgage_calculator',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await client
      .from('mortgage_leads')
      .insert(leadRecord)
      .select('id, full_name, status, created_at')
      .single()

    if (error) {
      console.error('Failed to insert mortgage lead:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: true, lead: data },
      { status: 201, headers: corsHeaders }
    )
  } catch (err: any) {
    console.error('Error in POST /api/mortgage-leads:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const client = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status')
    const limit = Number(searchParams.get('limit')) || 100

    let query = client
      .from('mortgage_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json({ success: true, leads: data }, { status: 200, headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500, headers: corsHeaders })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const client = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(req.url)
    const queryId = searchParams.get('id')

    let idsToDelete: string[] = []

    if (queryId) {
      idsToDelete = [queryId]
    } else {
      try {
        const body = await req.json()
        if (Array.isArray(body.ids)) {
          idsToDelete = body.ids.filter((id: any) => typeof id === 'string' && id.trim().length > 0)
        } else if (body.id && typeof body.id === 'string') {
          idsToDelete = [body.id.trim()]
        }
      } catch {
        // No json body
      }
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No lead ID(s) provided for deletion.' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { error } = await client
      .from('mortgage_leads')
      .delete()
      .in('id', idsToDelete)

    if (error) {
      console.error('Failed to delete mortgage lead(s):', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: true, count: idsToDelete.length },
      { status: 200, headers: corsHeaders }
    )
  } catch (err: any) {
    console.error('Error in DELETE /api/mortgage-leads:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const client = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required for update.' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { data, error } = await client
      .from('mortgage_leads')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update mortgage lead:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      { success: true, lead: data },
      { status: 200, headers: corsHeaders }
    )
  } catch (err: any) {
    console.error('Error in PATCH /api/mortgage-leads:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
