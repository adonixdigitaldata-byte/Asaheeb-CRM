import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { EmployeeContract, ContractType } from '@/types/contract'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const profileId = searchParams.get('profile_id') || user.id

    // Check user role
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const isManagerOrAdmin =
      currentProfile?.role === 'ADMIN' || currentProfile?.role === 'SALES_MANAGER'

    // If not manager/admin, they can only view their own contract
    if (!isManagerOrAdmin && profileId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const serviceClient = await createServiceClient()

    // 1. Fetch targeted profile
    const { data: targetProfile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 2. Fetch existing contract from employee_contracts (if table exists)
    let contractData: any = null
    try {
      const { data } = await serviceClient
        .from('employee_contracts')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      contractData = data
    } catch {
      // Table might not exist yet before SQL migration, fallback seamlessly
    }

    // 3. Fetch salary profile (for default base salary & allowances)
    let salaryProfile: any = null
    try {
      const { data } = await serviceClient
        .from('employee_salary_profiles')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()
      salaryProfile = data
    } catch {
      // ignore
    }

    const isChannelPartner = targetProfile.role === 'CHANNEL_PARTNER'
    const defaultContractType: ContractType = isChannelPartner
      ? 'CHANNEL_PARTNER'
      : 'INTERNAL_SALES'

    // Synthesize contract terms if no explicit contract was saved yet
    const resolvedContract: EmployeeContract = {
      id: contractData?.id,
      profile_id: profileId,
      contract_type: contractData?.contract_type || defaultContractType,
      status: contractData?.status || 'ACTIVE',
      start_date:
        contractData?.start_date ||
        salaryProfile?.joining_date ||
        targetProfile.created_at?.split('T')[0] ||
        new Date().toISOString().split('T')[0],
      end_date: contractData?.end_date || null,
      designation:
        contractData?.designation ||
        salaryProfile?.designation ||
        (isChannelPartner
          ? 'Authorized External Broker / Channel Partner'
          : targetProfile.role === 'SALES_MANAGER'
          ? 'Sales Manager'
          : targetProfile.role === 'AGENT'
          ? 'Senior Property Sales Consultant'
          : 'Real Estate Executive'),
      department: contractData?.department || salaryProfile?.department || 'Sales & Acquisitions',
      base_salary:
        contractData?.base_salary !== undefined
          ? Number(contractData.base_salary)
          : Number(salaryProfile?.base_salary || 0),
      housing_allowance:
        contractData?.housing_allowance !== undefined
          ? Number(contractData.housing_allowance)
          : (salaryProfile?.default_allowances || []).find((a: any) =>
              a.name?.toLowerCase().includes('housing')
            )?.amount || 0,
      transport_allowance:
        contractData?.transport_allowance !== undefined
          ? Number(contractData.transport_allowance)
          : (salaryProfile?.default_allowances || []).find((a: any) =>
              a.name?.toLowerCase().includes('transport')
            )?.amount || 0,
      commission_rate_pct:
        contractData?.commission_rate_pct !== undefined
          ? Number(contractData.commission_rate_pct)
          : Number(targetProfile.commission_rate_pct ?? (isChannelPartner ? 20 : 15)),
      monthly_target_sar:
        contractData?.monthly_target_sar !== undefined
          ? Number(contractData.monthly_target_sar)
          : Number(targetProfile.commission_threshold_sar || 500000),
      probation_months: contractData?.probation_months ?? 3,
      notice_period_days: contractData?.notice_period_days ?? 30,
      national_id_iqama:
        contractData?.national_id_iqama ||
        targetProfile.iqama_no ||
        salaryProfile?.pan_or_iqama ||
        '',
      cr_number: contractData?.cr_number || '',
      fal_license_no: contractData?.fal_license_no || '',
      vat_number: contractData?.vat_number || '',
      brokerage_firm_name:
        contractData?.brokerage_firm_name ||
        (isChannelPartner ? targetProfile.name : 'Asaheeb and Adonix Developments Company'),
      payment_terms:
        contractData?.payment_terms ||
        (isChannelPartner
          ? 'Net 15 days following receipt of developer commission escrow settlement'
          : 'Monthly payroll on 27th calendar day; commission disbursed upon quarterly escrow completion'),
      custom_terms: contractData?.custom_terms || '',
      signed_at: contractData?.signed_at || null,
      signed_by_name: contractData?.signed_by_name || targetProfile.name,
      created_at: contractData?.created_at,
      updated_at: contractData?.updated_at,
    }

    return NextResponse.json({
      contract: resolvedContract,
      profile: targetProfile,
    })
  } catch (err: any) {
    console.error('Error in GET /api/contracts:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to fetch contract' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentProfile?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only Admins can update contract terms' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      profile_id,
      contract_type,
      status = 'ACTIVE',
      start_date,
      end_date,
      designation,
      department,
      base_salary = 0,
      housing_allowance = 0,
      transport_allowance = 0,
      commission_rate_pct = 0,
      monthly_target_sar = 0,
      probation_months = 3,
      notice_period_days = 30,
      national_id_iqama,
      cr_number,
      fal_license_no,
      vat_number,
      brokerage_firm_name,
      payment_terms,
      custom_terms,
      signed_at,
      signed_by_name,
      phone,
      email,
    } = body

    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const payload: any = {
      profile_id,
      contract_type: contract_type || 'INTERNAL_SALES',
      status,
      start_date: start_date || new Date().toISOString().split('T')[0],
      end_date: end_date || null,
      designation: designation?.trim() || null,
      department: department?.trim() || 'Sales',
      base_salary: Number(base_salary) || 0,
      housing_allowance: Number(housing_allowance) || 0,
      transport_allowance: Number(transport_allowance) || 0,
      commission_rate_pct: Number(commission_rate_pct) || 0,
      monthly_target_sar: Number(monthly_target_sar) || 0,
      probation_months: Number(probation_months) || 3,
      notice_period_days: Number(notice_period_days) || 30,
      national_id_iqama: national_id_iqama?.trim() || null,
      cr_number: cr_number?.trim() || null,
      fal_license_no: fal_license_no?.trim() || null,
      vat_number: vat_number?.trim() || null,
      brokerage_firm_name: brokerage_firm_name?.trim() || null,
      payment_terms: payment_terms?.trim() || null,
      custom_terms: custom_terms?.trim() || null,
      signed_at: signed_at || null,
      signed_by_name: signed_by_name?.trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }

    // 1. Try to upsert into employee_contracts
    let contractResult: any = null
    try {
      const { data: existingContract } = await serviceClient
        .from('employee_contracts')
        .select('id')
        .eq('profile_id', profile_id)
        .maybeSingle()

      if (existingContract?.id) {
        const { data, error } = await serviceClient
          .from('employee_contracts')
          .update(payload)
          .eq('id', existingContract.id)
          .select()
          .single()
        if (!error) contractResult = data
      } else {
        const { data, error } = await serviceClient
          .from('employee_contracts')
          .insert(payload)
          .select()
          .single()
        if (!error) contractResult = data
      }
    } catch {
      // Table might not be migrated yet in remote supabase
    }

    // 2. Synchronize commission_rate_pct, commission_threshold_sar, iqama_no, phone, email onto profiles
    const profileUpdates: Record<string, any> = {
      commission_rate_pct: Number(commission_rate_pct) || null,
      commission_threshold_sar: Number(monthly_target_sar) || null,
      iqama_no: national_id_iqama || null,
      updated_at: new Date().toISOString(),
    }
    if (phone !== undefined) {
      profileUpdates.phone = phone ? phone.trim() : null
    }
    if (email !== undefined && email.trim()) {
      profileUpdates.email = email.trim()
    }

    const { data: updatedProfile } = await serviceClient
      .from('profiles')
      .update(profileUpdates)
      .eq('id', profile_id)
      .select()
      .maybeSingle()

    // 3. Synchronize base_salary & allowances onto employee_salary_profiles if exists
    try {
      await serviceClient
        .from('employee_salary_profiles')
        .update({
          base_salary: Number(base_salary) || 0,
          designation: designation || null,
          department: department || 'Sales',
          pan_or_iqama: national_id_iqama || null,
          joining_date: start_date || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', profile_id)
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      contract: contractResult || payload,
      profile: updatedProfile,
    })
  } catch (err: any) {
    console.error('Error in POST /api/contracts:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to save contract terms' },
      { status: 500 }
    )
  }
}
