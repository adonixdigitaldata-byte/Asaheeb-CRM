import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ContractPageClient from './ContractPageClient'
import type { EmployeeContract, ContractType } from '@/types/contract'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const service = await createServiceClient()
  const { data: member } = await service.from('profiles').select('name').eq('id', id).single()
  return {
    title: member?.name ? `${member.name} — Official Contract` : 'Official Contract & Paperwork',
  }
}

export default async function TeamMemberContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const fromParam = resolvedSearchParams?.from

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!currentProfile) redirect('/login')

  const isManagerOrAdmin =
    currentProfile.role === 'ADMIN' || currentProfile.role === 'SALES_MANAGER'

  // Channel partners should never access /team routes; send them to dedicated partner portal
  if (currentProfile.role === 'CHANNEL_PARTNER') {
    redirect('/partner-contract')
  }

  // Access check: Only Admin, Sales Manager, or the employee themselves
  if (!isManagerOrAdmin && currentProfile.id !== id) {
    redirect('/dashboard')
  }

  // Determine back navigation link:
  // - Admin: /team ('Team Directory')
  // - Channel Partner: /dashboard ('Dashboard')
  // - Sales Manager, Employees, Agents: /payslips ('My Payslips')
  let backUrl = '/payslips'
  let backLabel = 'My Payslips'

  if (currentProfile.role === 'ADMIN') {
    backUrl = '/team'
    backLabel = 'Team Directory'
  } else if (currentProfile.role === 'CHANNEL_PARTNER') {
    backUrl = '/dashboard'
    backLabel = 'Dashboard'
  } else {
    backUrl = '/payslips'
    backLabel = 'My Payslips'
  }

  const serviceSupabase = await createServiceClient()

  // 1. Fetch target member profile
  const { data: member } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) notFound()

  // 2. Fetch existing contract from employee_contracts (if exists)
  let contract: EmployeeContract | null = null
  try {
    const { data } = await serviceSupabase
      .from('employee_contracts')
      .select('*')
      .eq('profile_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      contract = data as EmployeeContract
    }
  } catch {
    // employee_contracts table might not be created yet, fallback below
  }

  // 3. Fallback / synthesis if no contract row exists yet
  if (!contract) {
    let salaryProfile: any = null
    try {
      const { data } = await serviceSupabase
        .from('employee_salary_profiles')
        .select('*')
        .eq('profile_id', id)
        .maybeSingle()
      salaryProfile = data
    } catch {
      // ignore
    }

    const isChannelPartner = member.role === 'CHANNEL_PARTNER'
    const contractType: ContractType = isChannelPartner ? 'CHANNEL_PARTNER' : 'INTERNAL_SALES'

    const defaultDesignation =
      salaryProfile?.designation ||
      (member.role === 'ADMIN'
        ? 'Executive Administrator'
        : member.role === 'SALES_MANAGER'
        ? 'Sales Manager'
        : member.role === 'CHANNEL_PARTNER'
        ? 'Certified Real Estate Broker / Channel Partner'
        : member.role === 'AGENT'
        ? 'Real Estate Sales Agent'
        : 'Operations Specialist')

    contract = {
      id: `synthetic-${member.id}`,
      profile_id: member.id,
      contract_type: contractType,
      status: member.is_active === false ? 'TERMINATED' : 'ACTIVE',
      start_date: salaryProfile?.joining_date || member.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      end_date: null,
      designation: defaultDesignation,
      department: salaryProfile?.department || (isChannelPartner ? 'External Partnerships' : 'Sales & Acquisitions'),
      base_salary: Number(salaryProfile?.base_salary) || (isChannelPartner ? 0 : 5000),
      housing_allowance: Number(salaryProfile?.housing_allowance) || 0,
      transport_allowance: Number(salaryProfile?.transport_allowance) || 0,
      commission_rate_pct: Number(member.commission_rate_pct) || (isChannelPartner ? 20 : 2.5),
      monthly_target_sar: Number(member.commission_threshold_sar) || (isChannelPartner ? 0 : 50000),
      probation_months: 3,
      notice_period_days: 30,
      national_id_iqama: member.iqama_no || salaryProfile?.pan_or_iqama || '',
      cr_number: isChannelPartner ? '' : null,
      fal_license_no: isChannelPartner ? '' : null,
      vat_number: isChannelPartner ? '' : null,
      brokerage_firm_name: isChannelPartner ? member.name : null,
      payment_terms: isChannelPartner
        ? 'Commissions disbursed within 5 business days upon title deed conveyance and full receipt of client funds.'
        : 'Commissions processed with monthly payroll cycle following closed transaction clearance.',
      custom_terms: '',
      signed_at: member.created_at || new Date().toISOString(),
      signed_by_name: member.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return (
    <ContractPageClient
      currentProfile={currentProfile}
      member={member}
      initialContract={contract}
      backUrl={backUrl}
      backLabel={backLabel}
    />
  )
}
