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
  role text not null default 'AGENT' check (role in ('ADMIN', 'AGENT')),
  is_active boolean not null default true,
  avatar_url text,
  total_leads_assigned int not null default 0,
  open_leads_count int not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  ('new',         'New',         1, '#0284C7'),
  ('contacted',   'Contacted',   2, '#D97706'),
  ('no_reply',    'No Reply',    3, '#64748B'),
  ('qualified',   'Qualified',   4, '#7C3AED'),
  ('proposal',    'Proposal',    5, '#DB2777'),
  ('negotiation', 'Negotiation', 6, '#EA580C'),
  ('won',         'Won',         7, '#16A34A'),
  ('lost',        'Lost',        8, '#DC2626'),
  ('followup',    'Follow-up',   9, '#0F766E')
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
  video_url text,
  map_embed_url text,
  landmarks jsonb default '[]',
  amenities jsonb default '[]',
  brochure_url text,
  brochure_size_en text,
  brochure_size_ar text,
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
create index if not exists idx_leads_created on leads(created_at desc);

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
    if new.raw_user_meta_data->>'role' in ('ADMIN', 'AGENT') then 
      v_role := new.raw_user_meta_data->>'role'; 
    end if;
  end if;
  insert into profiles (id, name, email, role) 
  values (new.id, v_name, coalesce(new.email, ''), v_role)
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email;
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
create policy "Admins full access notes" on lead_notes for all using (is_admin());

drop policy if exists "Agents manage notes on their leads" on lead_notes;
create policy "Agents manage notes on their leads" on lead_notes for all using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
);

-- Lead Followups Policies
drop policy if exists "Admins full access followups" on lead_followups;
create policy "Admins full access followups" on lead_followups for all using (is_admin());

drop policy if exists "Agents manage followups on their leads" on lead_followups;
create policy "Agents manage followups on their leads" on lead_followups for all using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid())
);

-- Lead Activities Policies
drop policy if exists "Admins full access activities" on lead_activities;
create policy "Admins full access activities" on lead_activities for all using (is_admin());

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
create policy "Admins full access stage history" on lead_stage_history for all using (is_admin());

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
create policy "Public can read published projects" on projects for select using (is_published = true);

drop policy if exists "Admins full access projects" on projects;
create policy "Admins full access projects" on projects for all using (is_admin());
