export type UserRole = 'ADMIN' | 'AGENT'

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
  is_active: boolean
  avatar_url?: string | null
  total_leads_assigned: number
  open_leads_count: number
  last_seen_at: string
  created_at: string
  updated_at: string
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
  negotiation: 7,
  won: 8,
  lost: 9,
}

export function sortLeadStages(stages: LeadStage[]): LeadStage[] {
  return [...stages].sort((a, b) => {
    const orderA = STAGE_ORDER_MAP[a.key] ?? a.sort_order ?? 99
    const orderB = STAGE_ORDER_MAP[b.key] ?? b.sort_order ?? 99
    return orderA - orderB
  })
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
  potential_value?: number | null
  form_data?: Record<string, any>
  raw_payload?: any
  stage_id: string
  assigned_agent_id?: string | null
  lead_score?: number
  is_duplicate?: boolean
  duplicate_of?: string | null
  created_at: string
  updated_at: string
  // Joins
  stage?: LeadStage | null
  assigned_agent?: { id: string; name: string; email?: string } | null
  campaign?: { id: string; name: string } | null
  property?: { id: string; name_en: string; name_ar: string } | null
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
