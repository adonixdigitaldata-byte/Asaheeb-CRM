import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ContractPageClient from '@/app/(crm)/team/[id]/contract/ContractPageClient'
import type { EmployeeContract } from '@/types/contract'

export const metadata: Metadata = {
  title: 'My Partnership Agreement | Asaheeb CRM',
  description: 'Official Commercial Channel Partner & Brokerage Agreement',
}

export const dynamic = 'force-dynamic'

export default async function PartnerContractPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const serviceSupabase = await createServiceClient()

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Fetch existing contract from employee_contracts
  let contract: EmployeeContract | null = null
  try {
    const { data } = await serviceSupabase
      .from('employee_contracts')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      contract = data as EmployeeContract
    }
  } catch {
    // ignore
  }

  if (!contract) {
    contract = {
      id: `partner-${profile.id}`,
      profile_id: profile.id,
      contract_type: 'CHANNEL_PARTNER',
      status: profile.is_active === false ? 'TERMINATED' : 'ACTIVE',
      start_date: profile.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      end_date: null,
      designation: 'Certified Real Estate Broker / Channel Partner',
      department: 'External Partnerships',
      base_salary: 0,
      housing_allowance: 0,
      transport_allowance: 0,
      commission_rate_pct: Number(profile.commission_rate_pct) || 20,
      monthly_target_sar: Number(profile.commission_threshold_sar) || 0,
      probation_months: 0,
      notice_period_days: 30,
      national_id_iqama: profile.iqama_no || '',
      cr_number: '',
      fal_license_no: '',
      vat_number: '',
      brokerage_firm_name: profile.name,
      payment_terms:
        'Commissions disbursed within 5 business days upon title deed conveyance and full receipt of client funds.',
      custom_terms: '',
      signed_at: profile.created_at || new Date().toISOString(),
      signed_by_name: profile.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return (
    <ContractPageClient
      currentProfile={profile}
      member={profile}
      initialContract={contract}
      backUrl="/dashboard"
      backLabel="Dashboard"
      isPartnerPortalView={true}
    />
  )
}
