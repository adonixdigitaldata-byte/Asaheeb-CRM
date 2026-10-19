export type ContractType = 'INTERNAL_SALES' | 'CHANNEL_PARTNER'
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'

export interface EmployeeContract {
  id?: string
  profile_id: string
  contract_type: ContractType
  status: ContractStatus
  start_date: string
  end_date?: string | null
  designation: string
  department: string
  base_salary: number
  housing_allowance: number
  transport_allowance: number
  commission_rate_pct: number
  monthly_target_sar: number
  probation_months: number
  notice_period_days: number
  national_id_iqama?: string | null
  cr_number?: string | null
  fal_license_no?: string | null
  vat_number?: string | null
  brokerage_firm_name?: string | null
  payment_terms?: string | null
  custom_terms?: string | null
  signed_at?: string | null
  signed_by_name?: string | null
  created_at?: string
  updated_at?: string
}
