-- ============================================================
-- ASAHEEB CRM — CORE DATABASE SCHEMA
-- Roles: 'ADMIN', 'AGENT' (Sales Agent)
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES & ROLES
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'AGENT' check (role in ('ADMIN', 'SALES_MANAGER', 'AGENT', 'EMPLOYEE')),
  specialization text,
  work_status text not null default 'AVAILABLE' check (work_status in ('AVAILABLE', 'BUSY', 'ON_LEAVE')),
  phone text,
  is_active boolean not null default true,
  avatar_url text,
  total_leads_assigned int not null default 0,
  open_leads_count int not null default 0,
  last_seen_at timestamptz not null default now(),
  payroll_pin text default '1234',
  iqama_no text,
  iqama_expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-compatible columns for profiles:
alter table profiles add column if not exists iqama_no text;
alter table profiles add column if not exists iqama_expiry_date date;

-- ============================================================
-- 2. AD ATTRIBUTION (Meta, Google, Social Ads)
-- ============================================================
create table if not exists ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  meta_campaign_id text unique,
  name text not null,
  objective text,
  status text,
  spend numeric(12,2),
  impressions bigint,
  clicks bigint,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references ad_campaigns(id) on delete cascade,
  meta_adset_id text unique,
  name text not null,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid references ad_sets(id) on delete cascade,
  meta_ad_id text unique,
  name text not null,
  creative_thumbnail_url text,
  status text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. FUNNEL STAGES
-- ============================================================
create table if not exists lead_stages (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  sort_order int not null,
  color_hex text not null default '#71717A'
);

-- Insert default stages if table is empty
insert into lead_stages (key, label, sort_order, color_hex)
values
  ('new',                 'New',                  1, '#0284C7'),
  ('contacted',           'Contacted',            2, '#D97706'),
  ('no_reply',            'No Reply',             3, '#64748B'),
  ('followup',            'Follow-up',            4, '#0F766E'),
  ('qualified',           'Qualified',            5, '#7C3AED'),
  ('proposal',            'Proposal',             6, '#DB2777'),
  ('negotiation',         'Negotiation',          7, '#EA580C'),
  ('meeting_scheduled',   'Meeting Scheduled',    8, '#8B5CF6'),
  ('meeting_done',        'Meeting Done',         9, '#06B6D4'),
  ('site_visit_scheduled','Site Visit Scheduled', 10, '#F59E0B'),
  ('won',                 'Won',                 11, '#16A34A'),
  ('lost',                'Lost',                12, '#DC2626')
on conflict (key) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  color_hex = excluded.color_hex;

-- ============================================================
-- 4. PROJECTS / PROPERTIES
-- ============================================================
create table if not exists projects (
  id text primary key, -- Slug identifier, e.g. 'itlala-towers'
  name_en text not null,
  name_ar text not null,
  developer_en text,
  developer_ar text,
  city_en text not null,
  city_ar text not null,
  district_en text not null,
  district_ar text not null,
  starting_price_en text,
  starting_price_ar text,
  price_range_en text,
  price_range_ar text,
  size_en text,
  size_ar text,
  type_en text,
  type_ar text,
  status_en text,
  status_ar text,
  expected_delivery_en text,
  expected_delivery_ar text,
  units_count_en text,
  units_count_ar text,
  floors_en text,
  floors_ar text,
  overview_en text,
  overview_ar text,
  highlights_en jsonb default '[]',
  highlights_ar jsonb default '[]',
  images jsonb default '[]',
  video_url text,
  map_embed_url text,
  google_maps_url text,
  landmarks jsonb default '[]',
  amenities jsonb default '[]',
  brochure_url text,
  brochure_size_en text,
  brochure_size_ar text,
  expected_commission_en text, -- e.g. 'SAR 10,000 / Deal' or '2.5%'
  expected_commission_ar text,
  commission_notes_en text, -- e.g. '10% for penthouses, 5% for 1BR/2BR; SAR 50,000 cap; Layout 3 has custom bonus'
  commission_notes_ar text,
  is_published boolean not null default true,
  sort_order int default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-compatible column additions and data defaults for existing deployments:
alter table projects add column if not exists expected_commission_en text;
alter table projects add column if not exists expected_commission_ar text;
alter table projects add column if not exists commission_notes_en text;
alter table projects add column if not exists commission_notes_ar text;

-- Default existing projects to Apartments category
update projects set type_en = 'Apartments', type_ar = 'شقق سكنية' where type_en is null or type_en = '' or type_en = 'Apartment';

-- ============================================================
-- 4.1 BLOG ARTICLES / MARKET INSIGHTS
-- ============================================================
create table if not exists blogs (
  id text primary key, -- Slug identifier, e.g. 'capital-appreciation-vs-rental-yield'
  category text not null default 'guide',
  category_en text not null default '',
  category_ar text not null default '',
  accent text default '#B8873B',
  date_en text default '',
  date_ar text default '',
  read_time_en text default '',
  read_time_ar text default '',
  author_en text default 'Asaheeb Research',
  author_ar text default 'فريق أبحاث أساهيب',
  title_en text not null,
  title_ar text not null,
  excerpt_en text default '',
  excerpt_ar text default '',
  summary_en jsonb default '[]',
  summary_ar jsonb default '[]',
  sections_en jsonb default '[]',
  sections_ar jsonb default '[]',
  stat_box jsonb default '[]',
  quote_en text,
  quote_ar text,
  cover_image_url text,
  featured boolean not null default false,
  is_published boolean not null default true,
  sort_order int default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. LEADS (Core Table)
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in
    ('META_ADS','TIKTOK','SNAPCHAT','WHATSAPP','MANUAL','XLSX_IMPORT','WEBSITE_FORM','PROPERTY_INQUIRY')),
  campaign_id uuid references ad_campaigns(id),
  ad_set_id uuid references ad_sets(id),
  ad_id uuid references ads(id),
  property_id text references projects(id) on delete set null,
  name text,
  phone text,
  email text,
  city text,
  interest text,
  client_category text,
  budget_tier text,
  meeting_date date,
  meeting_time text,
  potential_value numeric(12,2) default 0.00,
  form_data jsonb not null default '{}',
  raw_payload jsonb,
  stage_id uuid references lead_stages(id) not null,
  assigned_agent_id uuid references profiles(id) on delete set null,
  lead_score int default 0,
  is_duplicate boolean default false,
  duplicate_of uuid references leads(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_campaign on leads(campaign_id);
create index if not exists idx_leads_stage on leads(stage_id);
create index if not exists idx_leads_agent on leads(assigned_agent_id);
create index if not exists idx_leads_property on leads(property_id);
create index if not exists idx_leads_phone on leads(phone);
create index if not exists idx_leads_email on leads(email);
create index if not exists idx_leads_client_category on leads(client_category);
create index if not exists idx_leads_meeting_date on leads(meeting_date);
create index if not exists idx_leads_created on leads(created_at desc);

-- ============================================================
-- 5.1 AUTOMATED ROUND-ROBIN LEAD ASSIGNMENT TRIGGER
-- Automatically assigns unassigned incoming leads to the next available sales agent
-- ============================================================
create or replace function fn_auto_assign_lead_round_robin()
returns trigger as $$
declare
  v_agent_id uuid;
begin
  -- If assigned_agent_id is already explicitly provided, keep it
  if NEW.assigned_agent_id is not null then
    return NEW;
  end if;

  -- 1. Find the best available active sales agent:
  -- Prioritize agents with work_status = 'AVAILABLE', then least recently assigned lead timestamp, then lowest active leads
  select p.id into v_agent_id
  from profiles p
  where p.is_active = true
    and p.role in ('AGENT', 'SALES_MANAGER')
  order by
    case when upper(coalesce(p.work_status, 'AVAILABLE')) = 'AVAILABLE' then 0 else 1 end asc,
    (
      select coalesce(max(l.created_at), '1970-01-01'::timestamptz)
      from leads l
      where l.assigned_agent_id = p.id
    ) asc,
    (
      select count(*)
      from leads l
      left join lead_stages s on l.stage_id = s.id
      where l.assigned_agent_id = p.id
        and (s.key is null or s.key not in ('won', 'lost'))
    ) asc
  limit 1;

  -- Fallback: If no dedicated sales agents exist, pick from any active staff (e.g. ADMIN)
  if v_agent_id is null then
    select p.id into v_agent_id
    from profiles p
    where p.is_active = true
    order by (
      select coalesce(max(l.created_at), '1970-01-01'::timestamptz)
      from leads l
      where l.assigned_agent_id = p.id
    ) asc
    limit 1;
  end if;

  if v_agent_id is not null then
    NEW.assigned_agent_id := v_agent_id;
  end if;

  -- Ensure stage_id is defaulted to 'new' stage if omitted
  if NEW.stage_id is null then
    select id into NEW.stage_id from lead_stages where key = 'new' limit 1;
    if NEW.stage_id is null then
      select id into NEW.stage_id from lead_stages order by sort_order asc limit 1;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_assign_lead_round_robin on leads;
create trigger trg_auto_assign_lead_round_robin
  before insert on leads
  for each row
  when (NEW.assigned_agent_id is null)
  execute function fn_auto_assign_lead_round_robin();

-- ============================================================
-- 6. STAGE HISTORY, NOTES, FOLLOW-UPS, ACTIVITIES
-- ============================================================
create table if not exists lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  from_stage_id uuid references lead_stages(id),
  to_stage_id uuid references lead_stages(id) not null,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists idx_stage_history_lead on lead_stage_history(lead_id);

create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_notes_lead on lead_notes(lead_id);

create table if not exists lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  agent_id uuid references profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  note text,
  is_completed boolean not null default false,
  reminder_sent boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_followups_lead on lead_followups(lead_id);
create index if not exists idx_followups_agent on lead_followups(agent_id);
create index if not exists idx_followups_scheduled on lead_followups(scheduled_at);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  activity_type text not null,
  performed_by uuid references profiles(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activities_lead on lead_activities(lead_id);

-- ============================================================
-- 7. TRIGGERS & AUTOMATIONS
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin 
  new.updated_at = now(); 
  return new; 
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at before update on leads for each row execute function update_updated_at();

-- Automatically record an initial activity in lead_activities when a lead is created
create or replace function fn_log_lead_creation_activity()
returns trigger as $$
declare
  v_agent_name text;
begin
  if NEW.assigned_agent_id is not null then
    select name into v_agent_name from profiles where id = NEW.assigned_agent_id;
  end if;

  insert into lead_activities (
    lead_id,
    activity_type,
    performed_by,
    metadata,
    created_at
  ) values (
    NEW.id,
    'LEAD_CREATED',
    null,
    jsonb_build_object(
      'source', coalesce(NEW.source, 'WEBSITE_FORM'),
      'assigned_agent_id', NEW.assigned_agent_id,
      'assigned_agent_name', v_agent_name,
      'client_category', NEW.client_category,
      'budget_tier', NEW.budget_tier,
      'meeting_date', NEW.meeting_date,
      'meeting_time', NEW.meeting_time,
      'auto_assigned', (NEW.assigned_agent_id is not null)
    ),
    now()
  );

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_log_lead_creation_activity on leads;
create trigger trg_log_lead_creation_activity
  after insert on leads
  for each row
  execute function fn_log_lead_creation_activity();

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles for each row execute function update_updated_at();

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at before update on projects for each row execute function update_updated_at();

-- Auto-create profile when a user signs up with 'ADMIN' or 'AGENT'
create or replace function handle_new_user()
returns trigger as $$
declare 
  v_name text; 
  v_role text;
begin
  v_name := split_part(new.email, '@', 1);
  v_role := 'AGENT'; -- Default role
  if new.raw_user_meta_data is not null then
    if new.raw_user_meta_data->>'name' is not null then 
      v_name := new.raw_user_meta_data->>'name'; 
    end if;
    if new.raw_user_meta_data->>'role' in ('ADMIN', 'SALES_MANAGER', 'AGENT', 'EMPLOYEE') then 
      v_role := new.raw_user_meta_data->>'role'; 
    end if;
  end if;
  insert into profiles (id, name, email, role) 
  values (new.id, v_name, coalesce(new.email, ''), v_role)
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created 
after insert on auth.users 
for each row execute function handle_new_user();

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
alter table profiles enable row level security;
alter table leads enable row level security;
alter table lead_stages enable row level security;
alter table lead_notes enable row level security;
alter table lead_followups enable row level security;
alter table lead_activities enable row level security;
alter table lead_stage_history enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_sets enable row level security;
alter table ads enable row level security;
alter table projects enable row level security;

-- Helper function: Check if current user is ADMIN
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles 
    where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql stable security definer;

-- Profiles Policies
drop policy if exists "Authenticated users can view profiles" on profiles;
create policy "Authenticated users can view profiles" on profiles for select using (auth.uid() is not null);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Admins can manage profiles" on profiles;
create policy "Admins can manage profiles" on profiles for all using (is_admin());

-- Lead Stages Policies
drop policy if exists "All authenticated can read stages" on lead_stages;
create policy "All authenticated can read stages" on lead_stages for select using (auth.uid() is not null);

drop policy if exists "Admins can manage stages" on lead_stages;
create policy "Admins can manage stages" on lead_stages for all using (is_admin());

-- Leads Policies
drop policy if exists "Admins full access leads" on leads;
create policy "Admins full access leads" on leads for all using (is_admin());

drop policy if exists "Agents view assigned leads" on leads;
create policy "Agents view assigned leads" on leads for select using (assigned_agent_id = auth.uid());

drop policy if exists "Agents update assigned leads" on leads;
create policy "Agents update assigned leads" on leads for update using (assigned_agent_id = auth.uid());

-- Lead Notes Policies
drop policy if exists "Admins full access notes" on lead_notes;
create policy "Admins full access notes" on lead_notes for all using (is_admin_or_sales_manager());

drop policy if exists "Agents manage notes on their leads" on lead_notes;
create policy "Agents manage notes on their leads" on lead_notes for all using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
);

-- Lead Followups Policies
drop policy if exists "Admins full access followups" on lead_followups;
create policy "Admins full access followups" on lead_followups for all using (is_admin_or_sales_manager());

drop policy if exists "Agents manage followups on their leads" on lead_followups;
create policy "Agents manage followups on their leads" on lead_followups for all using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
);

-- Lead Activities Policies
drop policy if exists "Admins full access activities" on lead_activities;
create policy "Admins full access activities" on lead_activities for all using (is_admin_or_sales_manager());

drop policy if exists "Agents view activities on their leads" on lead_activities;
create policy "Agents view activities on their leads" on lead_activities for select using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
);

drop policy if exists "Agents insert activities on their leads" on lead_activities;
create policy "Agents insert activities on their leads" on lead_activities for insert with check (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
);

-- Stage History Policies
drop policy if exists "Admins full access stage history" on lead_stage_history;
create policy "Admins full access stage history" on lead_stage_history for all using (is_admin_or_sales_manager());

drop policy if exists "Agents view stage history on their leads" on lead_stage_history;
create policy "Agents view stage history on their leads" on lead_stage_history for select using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
);

-- Ad Attribution Policies
drop policy if exists "All authenticated read campaigns" on ad_campaigns;
create policy "All authenticated read campaigns" on ad_campaigns for select using (auth.uid() is not null);
drop policy if exists "Admins manage campaigns" on ad_campaigns;
create policy "Admins manage campaigns" on ad_campaigns for all using (is_admin());

drop policy if exists "All authenticated read adsets" on ad_sets;
create policy "All authenticated read adsets" on ad_sets for select using (auth.uid() is not null);
drop policy if exists "Admins manage adsets" on ad_sets;
create policy "Admins manage adsets" on ad_sets for all using (is_admin());

drop policy if exists "All authenticated read ads" on ads;
create policy "All authenticated read ads" on ads for select using (auth.uid() is not null);
drop policy if exists "Admins manage ads" on ads;
create policy "Admins manage ads" on ads for all using (is_admin());

-- Projects Policies
drop policy if exists "Public can read published projects" on projects;
create policy "Public can read published projects" on projects for select using (is_published = true or auth.uid() is not null);

drop policy if exists "Admins full access projects" on projects;
create policy "All authenticated full access projects" on projects for all using (auth.uid() is not null);

-- Blogs Policies
alter table blogs enable row level security;
drop policy if exists "Public can read published blogs" on blogs;
create policy "Public can read published blogs" on blogs for select using (is_published = true or auth.uid() is not null);

drop policy if exists "Admins full access blogs" on blogs;
create policy "All authenticated full access blogs" on blogs for all using (auth.uid() is not null);

-- ============================================================
-- 9. IMPORT BATCHES
-- ============================================================
create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  total_rows int default 0,
  success_count int default 0,
  error_count int default 0,
  duplicate_count int default 0,
  error_log jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table leads add column if not exists import_batch_id uuid references import_batches(id) on delete set null;
create index if not exists idx_leads_import_batch on leads(import_batch_id);

alter table import_batches enable row level security;
drop policy if exists "Admins and Managers can view import batches" on import_batches;
create policy "Admins and Managers can view import batches" on import_batches
  for select using (is_admin() or exists (select 1 from profiles where id = auth.uid() and role = 'SALES_MANAGER') or uploaded_by = auth.uid());

drop policy if exists "Admins and Managers can insert import batches" on import_batches;
create policy "Admins and Managers can insert import batches" on import_batches
  for insert with check (is_admin() or exists (select 1 from profiles where id = auth.uid() and role = 'SALES_MANAGER'));

drop policy if exists "Admins can manage import batches" on import_batches;
create policy "Admins can manage import batches" on import_batches
  for all using (is_admin());

-- ============================================================
-- 10. PAYROLL & PAYSLIP SYSTEM
-- ============================================================
create table if not exists employee_salary_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade unique not null,
  currency text not null default 'SAR' check (currency in ('SAR', 'INR', 'USD')),
  base_salary numeric(12, 2) not null default 0,
  joining_date date not null default current_date,
  designation text,
  department text default 'Sales',
  employee_code text,
  bank_name text,
  account_number text,
  ifsc_or_iban text,
  pan_or_iqama text,
  default_allowances jsonb default '[]'::jsonb,
  default_deductions jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_profiles_profile on employee_salary_profiles(profile_id);

drop trigger if exists salary_profiles_updated_at on employee_salary_profiles;
create trigger salary_profiles_updated_at 
  before update on employee_salary_profiles
  for each row execute function update_updated_at();

alter table employee_salary_profiles enable row level security;
drop policy if exists "Admins manage all salary profiles" on employee_salary_profiles;
create policy "Admins manage all salary profiles" on employee_salary_profiles 
  for all using (is_admin());

drop policy if exists "Users view own salary profile" on employee_salary_profiles;
create policy "Users view own salary profile" on employee_salary_profiles 
  for select using (profile_id = auth.uid());

-- Salary History
create table if not exists employee_salary_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  base_salary numeric(12, 2) not null default 0,
  currency text not null default 'SAR' check (currency in ('SAR', 'INR', 'USD')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_history_profile on employee_salary_history(profile_id);
create index if not exists idx_salary_history_dates on employee_salary_history(start_date, end_date);

alter table employee_salary_history enable row level security;
drop policy if exists "Admins manage all salary histories" on employee_salary_history;
create policy "Admins manage all salary histories" on employee_salary_history 
  for all using (is_admin());

drop policy if exists "Users view own salary history" on employee_salary_history;
create policy "Users view own salary history" on employee_salary_history 
  for select using (profile_id = auth.uid());

-- Payslips
create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references profiles(id) on delete cascade not null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2000 and 2100),
  financial_year text not null,
  currency text not null default 'SAR' check (currency in ('SAR', 'INR', 'USD')),
  base_salary numeric(12, 2) not null default 0,
  earnings_breakdown jsonb not null default '[]'::jsonb,
  deductions_breakdown jsonb not null default '[]'::jsonb,
  gross_earnings numeric(12, 2) not null default 0,
  total_deductions numeric(12, 2) not null default 0,
  net_pay numeric(12, 2) not null default 0,
  net_pay_in_words text,
  working_days int not null default 30,
  paid_days int not null default 30,
  lop_days int not null default 0,
  status text not null default 'PAID' check (status in ('DRAFT', 'PUBLISHED', 'PAID')),
  payment_date date,
  period_start_date date,
  period_end_date date,
  payment_method text not null default 'BANK_TRANSFER' check (payment_method in ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'WIRE')),
  designation text,
  department text,
  employee_code text,
  bank_name text,
  account_number text,
  ifsc_or_iban text,
  pan_or_iqama text,
  joining_date date,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, month, year)
);

create index if not exists idx_payslips_employee on payslips(employee_id);
create index if not exists idx_payslips_period on payslips(year, month);
create index if not exists idx_payslips_fy on payslips(financial_year);
create index if not exists idx_payslips_status on payslips(status);

drop trigger if exists payslips_updated_at on payslips;
create trigger payslips_updated_at 
  before update on payslips
  for each row execute function update_updated_at();

alter table payslips enable row level security;
drop policy if exists "Admins manage all payslips" on payslips;
create policy "Admins manage all payslips" on payslips 
  for all using (is_admin());

drop policy if exists "Users view own published payslips" on payslips;
create policy "Users view own published payslips" on payslips 
  for select using (
    employee_id = auth.uid() and status in ('PUBLISHED', 'PAID')
  );

-- Backward-compatible column additions for payroll:
alter table employee_salary_profiles add column if not exists iqama_expiry_date date;
alter table payslips add column if not exists iqama_expiry_date date;

-- ============================================================
-- 9. PROJECT COMMISSIONS & SALES TRACKING (ADMIN ONLY)
-- ============================================================
create table if not exists project_commissions (
  id uuid primary key default gen_random_uuid(),
  project_id text references projects(id) on delete cascade not null,
  unit_name text not null, -- layout name, apartment name, villa name, property name
  buyer_name text not null,
  commission_amount numeric(14, 2) not null default 0,
  sale_date date not null default current_date,
  notes text,
  agent_id uuid references profiles(id) on delete set null, -- agent / team member who closed the deal
  agent_name text, -- agent name string for easy display & historical integrity
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-compatible column additions for project_commissions:
alter table project_commissions add column if not exists agent_id uuid references profiles(id) on delete set null;
alter table project_commissions add column if not exists agent_name text;

create index if not exists idx_project_commissions_project on project_commissions(project_id);
create index if not exists idx_project_commissions_date on project_commissions(sale_date);
create index if not exists idx_project_commissions_agent on project_commissions(agent_id);

drop trigger if exists project_commissions_updated_at on project_commissions;
create trigger project_commissions_updated_at 
  before update on project_commissions
  for each row execute function update_updated_at();

alter table project_commissions enable row level security;
drop policy if exists "Admins manage all project commissions" on project_commissions;
create policy "Admins manage all project commissions" on project_commissions 
  for all using (is_admin());

-- ============================================================
-- 10. CMS AUDIT LOG / ACTIVITY TRACKING (PROJECTS & BLOGS)
-- ============================================================
create table if not exists cms_activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('PROJECT', 'BLOG')),
  entity_id text not null, -- project slug or blog slug
  action_type text not null, -- 'CREATED', 'UPDATED_DETAILS', 'UPDATED_PHOTOS', 'PUBLISHED', 'UNPUBLISHED', 'DELETED', 'COMMISSION_RECORDED'
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null,
  actor_email text,
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_activities_entity on cms_activities(entity_type, entity_id);
create index if not exists idx_cms_activities_created_at on cms_activities(created_at desc);

alter table cms_activities enable row level security;
drop policy if exists "Authenticated users can read cms activities" on cms_activities;
create policy "Authenticated users can read cms activities" on cms_activities
  for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert cms activities" on cms_activities;
create policy "Authenticated users can insert cms activities" on cms_activities
  for insert with check (auth.role() = 'authenticated');



