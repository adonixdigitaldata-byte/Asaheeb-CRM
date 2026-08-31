export type UserRole = 'ADMIN' | 'SALES_MANAGER' | 'AGENT' | 'EMPLOYEE'
export type WorkStatus = 'AVAILABLE' | 'BUSY' | 'ON_LEAVE'

export type LeadSource =
  | 'META_ADS'
  | 'TIKTOK'
  | 'SNAPCHAT'
  | 'WHATSAPP'
  | 'MANUAL'
  | 'XLSX_IMPORT'
  | 'WEBSITE_FORM'
  | 'PROPERTY_INQUIRY'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  specialization?: string | null
  work_status?: WorkStatus
  phone?: string | null
  is_active: boolean
  avatar_url?: string | null
  total_leads_assigned: number
  open_leads_count: number
  last_seen_at: string
  created_at: string
  updated_at: string
  payroll_pin?: string | null
  iqama_no?: string | null
  iqama_expiry_date?: string | null
}

export interface LeadStage {
  id: string
  key: string
  label: string
  sort_order: number
  color_hex: string
}

export const STAGE_ORDER_MAP: Record<string, number> = {
  new: 1,
  contacted: 2,
  no_reply: 3,
  followup: 4,
  qualified: 5,
  proposal: 6,
  meeting_scheduled: 7,
  meeting_done: 8,
  site_visit_scheduled: 9,
  negotiation: 10,
  won: 11,
  lost: 12,
}

export function sortLeadStages(stages: LeadStage[]): LeadStage[] {
  return [...stages].sort((a, b) => {
    const orderA = STAGE_ORDER_MAP[a.key] ?? a.sort_order ?? 99
    const orderB = STAGE_ORDER_MAP[b.key] ?? b.sort_order ?? 99
    return orderA - orderB
  })
}

export interface ProjectCommission {
  id: string
  project_id: string
  unit_name: string
  buyer_name: string
  commission_amount: number
  sale_date: string
  notes?: string | null
  agent_id?: string | null
  agent_name?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface AdCampaign {
  id: string
  meta_campaign_id?: string | null
  name: string
  objective?: string | null
  status?: string | null
  spend?: number | null
  impressions?: number | null
  clicks?: number | null
  synced_at?: string | null
  created_at: string
}

export interface AdSet {
  id: string
  campaign_id: string
  meta_adset_id?: string | null
  name: string
  status?: string | null
  created_at: string
}

export interface Ad {
  id: string
  ad_set_id: string
  meta_ad_id?: string | null
  name: string
  creative_thumbnail_url?: string | null
  status?: string | null
  created_at: string
}

export interface ProjectImage {
  url: string
  captionEn?: string
  captionAr?: string
}

export interface ProjectVideo {
  url: string
  titleEn?: string
  titleAr?: string
}

export interface Landmark {
  nameEn: string
  nameAr: string
  distEn: string
  distAr: string
}

export interface Amenity {
  badge: string
  titleEn: string
  titleAr: string
  descEn: string
  descAr: string
}

export interface Project {
  id: string
  name_en: string
  name_ar: string
  developer_en?: string | null
  developer_ar?: string | null
  city_en: string
  city_ar: string
  district_en: string
  district_ar: string
  starting_price_en?: string | null
  starting_price_ar?: string | null
  price_range_en?: string | null
  price_range_ar?: string | null
  size_en?: string | null
  size_ar?: string | null
  type_en?: string | null
  type_ar?: string | null
  status_en?: string | null
  status_ar?: string | null
  expected_delivery_en?: string | null
  expected_delivery_ar?: string | null
  units_count_en?: string | null
  units_count_ar?: string | null
  floors_en?: string | null
  floors_ar?: string | null
  overview_en?: string | null
  overview_ar?: string | null
  highlights_en?: string[] | null
  highlights_ar?: string[] | null
  images?: ProjectImage[] | null
  video_url?: string | null
  video_items?: ProjectVideo[] | null
  map_embed_url?: string | null
  google_maps_url?: string | null
  landmarks?: Landmark[] | null
  amenities?: Amenity[] | null
  brochure_url?: string | null
  brochure_url_en?: string | null
  brochure_url_ar?: string | null
  brochure_size_en?: string | null
  brochure_size_ar?: string | null
  payment_terms_en?: string | null
  payment_terms_ar?: string | null
  floor_plans?: ProjectImage[] | null
  expected_commission_en?: string | null
  expected_commission_ar?: string | null
  commission_notes_en?: string | null
  commission_notes_ar?: string | null
  is_published: boolean
  sort_order: number
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface BlogSection {
  heading: string
  body: string
  highlights?: string[]
}

export interface BlogStatBox {
  val: string
  labelEn: string
  labelAr: string
}

export interface Blog {
  id: string
  category: string
  category_en: string
  category_ar: string
  accent?: string | null
  date_en?: string | null
  date_ar?: string | null
  read_time_en?: string | null
  read_time_ar?: string | null
  author_en?: string | null
  author_ar?: string | null
  title_en: string
  title_ar: string
  excerpt_en?: string | null
  excerpt_ar?: string | null
  summary_en?: string[] | null
  summary_ar?: string[] | null
  sections_en?: BlogSection[] | null
  sections_ar?: BlogSection[] | null
  stat_box?: BlogStatBox[] | null
  quote_en?: string | null
  quote_ar?: string | null
  cover_image_url?: string | null
  featured: boolean
  is_published: boolean
  sort_order: number
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  source: LeadSource
  campaign_id?: string | null
  ad_set_id?: string | null
  ad_id?: string | null
  property_id?: string | null
  name: string
  phone?: string | null
  email?: string | null
  city?: string | null
  interest?: string | null
  client_category?: string | null
  budget_tier?: string | null
  meeting_date?: string | null
  meeting_time?: string | null
  potential_value?: number | null
  form_data?: Record<string, any>
  raw_payload?: any
  stage_id: string
  assigned_agent_id?: string | null
  lead_score?: number
  is_duplicate?: boolean
  duplicate_of?: string | null
  import_batch_id?: string | null
  created_at: string
  updated_at: string
  // Joins
  stage?: LeadStage | null
  assigned_agent?: { id: string; name: string; email?: string } | null
  campaign?: { id: string; name: string } | null
  property?: { id: string; name_en: string; name_ar: string } | null
}

export const CLIENT_CATEGORIES = [
  { value: 'End-User Buyer', label: 'End-User Buyer', description: 'Wants to live in it himself' },
  { value: 'Investor', label: 'Investor', description: 'Wants ROI / rental income' },
  { value: 'Tenant / Renter', label: 'Tenant / Renter', description: 'Looking for rental investment' },
  { value: 'Seller / Landlord', label: 'Seller / Landlord', description: 'Wants to list his property with you' },
  { value: 'Developer', label: 'Developer', description: 'Looking for land / bulk deal' },
  { value: 'Cold Client', label: 'Cold Client', description: 'Just exploring' },
] as const

export type ClientCategoryValue = (typeof CLIENT_CATEGORIES)[number]['value']

export const BUDGET_TIERS = [
  { value: 'A - Premium: 2M+', label: 'A - Premium: 2M+', min: 2000000, max: null },
  { value: 'B - Mid-Range: 700K - 2M SAR', label: 'B - Mid-Range: 700K - 2M SAR', min: 700000, max: 2000000 },
  { value: 'C - Affordable: Below 700K SAR', label: 'C - Affordable: Below 700K SAR', min: 0, max: 700000 },
] as const

export type BudgetTierValue = (typeof BUDGET_TIERS)[number]['value']

export interface ImportBatch {
  id: string
  file_name: string
  uploaded_by?: string | null
  total_rows: number
  success_count: number
  error_count: number
  duplicate_count: number
  error_log?: any[]
  created_at: string
  uploader?: Profile | null
}

export interface LeadStageHistory {
  id: string
  lead_id: string
  from_stage_id?: string | null
  to_stage_id: string
  changed_by?: string | null
  changed_at: string
  from_stage?: LeadStage | null
  to_stage?: LeadStage | null
  changer?: Profile | null
}

export interface LeadNote {
  id: string
  lead_id: string
  author_id?: string | null
  body: string
  created_at: string
  author?: Profile | null
}

export interface LeadFollowup {
  id: string
  lead_id: string
  agent_id?: string | null
  scheduled_at: string
  note?: string | null
  is_completed: boolean
  reminder_sent: boolean
  completed_at?: string | null
  created_at: string
  agent?: Profile | null
  lead?: { id: string; name: string; phone?: string } | null
}

export interface LeadActivity {
  id: string
  lead_id: string
  activity_type: string
  performed_by?: string | null
  metadata?: Record<string, any> | null
  created_at: string
  performer?: Profile | null
}

export interface NewsletterSubscriber {
  id: string
  email: string
  source?: string
  status?: string
  created_at: string
  updated_at?: string
}

// ============================================================
// PAYROLL & PAYSLIP TYPES
// ============================================================
export type PayslipCurrency = 'SAR' | 'INR' | 'USD'
export type PayslipStatus = 'DRAFT' | 'PUBLISHED' | 'PAID'
export type PaymentMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'UPI' | 'WIRE'

export interface PayslipLineItem {
  id?: string
  name: string
  amount: number
  description?: string
  type?: 'allowance' | 'deduction'
}

export interface EmployeeSalaryProfile {
  id: string
  profile_id: string
  currency: PayslipCurrency
  base_salary: number
  joining_date: string
  designation?: string | null
  department?: string | null
  employee_code?: string | null
  bank_name?: string | null
  account_number?: string | null
  ifsc_or_iban?: string | null
  pan_or_iqama?: string | null
  iqama_expiry_date?: string | null
  default_allowances?: PayslipLineItem[]
  default_deductions?: PayslipLineItem[]
  created_at: string
  updated_at: string
  profile?: Profile | null
}

export interface EmployeeSalaryHistory {
  id: string
  profile_id: string
  base_salary: number
  currency: PayslipCurrency
  start_date: string
  end_date?: string | null
  created_at: string
  updated_at: string
  profile?: Profile | null
}

export interface Payslip {
  id: string
  employee_id: string
  month: number
  year: number
  financial_year: string
  currency: PayslipCurrency
  base_salary: number
  earnings_breakdown: PayslipLineItem[]
  deductions_breakdown: PayslipLineItem[]
  gross_earnings: number
  total_deductions: number
  net_pay: number
  net_pay_in_words?: string | null
  working_days: number
  paid_days: number
  lop_days: number
  status: PayslipStatus
  payment_date?: string | null
  period_start_date?: string | null
  period_end_date?: string | null
  payment_method: PaymentMethod
  designation?: string | null
  department?: string | null
  employee_code?: string | null
  bank_name?: string | null
  account_number?: string | null
  ifsc_or_iban?: string | null
  pan_or_iqama?: string | null
  iqama_expiry_date?: string | null
  joining_date?: string | null
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  employee?: Profile | null
  creator?: Profile | null
}

export interface CmsActivity {
  id: string
  entity_type: 'PROJECT' | 'BLOG'
  entity_id: string
  action_type: string
  actor_id?: string | null
  actor_name: string
  actor_email?: string | null
  description: string
  metadata?: Record<string, any> | null
  created_at: string
}


