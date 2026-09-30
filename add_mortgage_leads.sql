-- ============================================================
-- ASAHEEB CRM — MORTGAGE LEADS SCHEMA & SECURITY MIGRATION
-- Captures high-intent mortgage calculations from public website
-- ============================================================

-- 1. Create table if not exists
create table if not exists public.mortgage_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  phone_number text,
  bank_name text,
  bank_name_en text,
  bank_slug text not null default '',
  property_price numeric not null default 0,
  down_payment_amount numeric not null default 0,
  down_payment_pct numeric not null default 0,
  loan_period_years integer not null default 15,
  applied_rate_pct numeric not null default 0,
  monthly_instalment numeric not null default 0,
  total_payable numeric,
  total_payable_value numeric,
  total_loan_amount numeric,
  monthly_income numeric,
  monthly_obligations numeric,
  is_citizen boolean not null default true,
  is_first_home boolean default null,
  has_redf_support boolean default null,
  redf_supported boolean default null,
  bank_profit_percentage numeric,
  status text not null default 'new',
  notes text,
  source text default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Add columns if table already exists from previous setup
alter table public.mortgage_leads add column if not exists phone text;
alter table public.mortgage_leads add column if not exists phone_number text;
alter table public.mortgage_leads add column if not exists bank_name text;
alter table public.mortgage_leads add column if not exists bank_name_en text;
alter table public.mortgage_leads add column if not exists total_payable numeric;
alter table public.mortgage_leads add column if not exists total_payable_value numeric;
alter table public.mortgage_leads add column if not exists total_loan_amount numeric;
alter table public.mortgage_leads add column if not exists has_redf_support boolean;
alter table public.mortgage_leads add column if not exists redf_supported boolean;
alter table public.mortgage_leads add column if not exists bank_profit_percentage numeric;
alter table public.mortgage_leads add column if not exists monthly_income numeric;
alter table public.mortgage_leads add column if not exists monthly_obligations numeric;
alter table public.mortgage_leads add column if not exists is_first_home boolean;
alter table public.mortgage_leads add column if not exists notes text;
alter table public.mortgage_leads add column if not exists source text default 'website';
alter table public.mortgage_leads add column if not exists updated_at timestamptz default now();

-- 3. Performance Indexes
create index if not exists idx_mortgage_leads_created_at on public.mortgage_leads (created_at desc);
create index if not exists idx_mortgage_leads_status on public.mortgage_leads (status);
create index if not exists idx_mortgage_leads_bank_slug on public.mortgage_leads (bank_slug);
create index if not exists idx_mortgage_leads_phone on public.mortgage_leads (phone);
create index if not exists idx_mortgage_leads_phone_number on public.mortgage_leads (phone_number);

-- 4. Enable RLS
alter table public.mortgage_leads enable row level security;

-- 5. Policies
-- Website public insertion
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'mortgage_leads' and policyname = 'Public website can insert mortgage leads'
  ) then
    create policy "Public website can insert mortgage leads"
      on public.mortgage_leads for insert
      to anon, authenticated
      with check (true);
  end if;
end $$;

-- Staff SELECT access
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'mortgage_leads' and policyname = 'Authenticated staff can select mortgage leads'
  ) then
    create policy "Authenticated staff can select mortgage leads"
      on public.mortgage_leads for select
      to authenticated
      using (true);
  end if;
end $$;

-- Staff UPDATE access
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'mortgage_leads' and policyname = 'Authenticated staff can update mortgage leads'
  ) then
    create policy "Authenticated staff can update mortgage leads"
      on public.mortgage_leads for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
