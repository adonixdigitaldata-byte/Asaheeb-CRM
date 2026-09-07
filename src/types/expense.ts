export type ExpenseCategory =
  | 'Office Expenses'
  | 'Fuel & Fleet'
  | 'Payroll & Broker Splits'
  | 'Portals & Digital Ads'
  | 'VIP & Investor Hospitality'
  | 'Government, REGA & Balady'
  | 'Utilities & Telecom'
  | 'IT & Software Tools'
  | 'Legal & Professional'
  | 'Miscellaneous'

export type ExpensePaymentMethod =
  | 'Corporate Card'
  | 'Bank Transfer (WPS/Corporate)'
  | 'SADAD Payment'
  | 'Cash / Petty Cash'
  | 'Company Cheque'
  | 'Mada Card'

export type ExpenseCostCenter =
  | 'Jeddah HQ'
  | 'Marketing & Lead Gen'
  | 'Sales & Client Relations'
  | 'Executive & Investment'
  | 'Compliance & Legal'
  | 'General Brokerage'
  | 'Executive Fleet'

export type ExpenseStatus = 'Paid' | 'Pending Approval' | 'Under Review'

export interface Expense {
  id: string
  reference_number: string
  title: string
  category: ExpenseCategory
  amount: number
  currency: string // 'SAR'
  vat_amount: number
  vat_rate?: number // standard 15% in KSA
  expense_date: string // YYYY-MM-DD
  vendor_payee: string
  cost_center: ExpenseCostCenter
  payment_method: ExpensePaymentMethod
  status: ExpenseStatus
  notes?: string | null
  receipt_url?: string | null
  receipt_file_name?: string | null
  is_recurring: boolean
  approved_by?: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseFilters {
  search?: string
  category?: string
  cost_center?: string
  payment_method?: string
  status?: string
  month_key?: string
  startDate?: string
  endDate?: string
}

export interface ExpenseSummaryStats {
  totalSpent: number
  totalVat: number
  netSpent: number
  totalTransactions: number
  averageTransaction: number
  pendingCount: number
  underReviewCount: number
  recurringMonthlyCommitment: number
  largestExpense: Expense | null
}

