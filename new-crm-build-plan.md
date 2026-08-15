# New Real Estate CRM — Build Plan (fresh Next.js + Supabase)

You're starting from zero. The files you gave me aren't things to migrate — they're your **reference architecture**. The leads/kanban/dashboard code is already the right shape for a real-estate CRM, so it gets reused almost line-for-line. Properties and blog are new tables designed from your `.ts` data shapes.

---

## 1. Stack & scaffold

```bash
npx create-next-app@latest asaheeb-crm --typescript --app --tailwind=false
cd asaheeb-crm
npm install @supabase/supabase-js @supabase/ssr @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react date-fns
```

You're not using Tailwind (your uploaded components use plain `className`s like `btn btn-primary`, `card`, `modal` — a hand-rolled CSS system). Bring/recreate that global stylesheet first; every component you copy depends on those class names existing.

Folder layout to mirror what you uploaded:
```
/app
  /leads
    page.tsx          (server component: auth check + queries)
    LeadsClient.tsx
    LeadsTable.tsx
    KanbanBoard.tsx
    AddLeadModal.tsx
  /leads/[id]
    page.tsx
    LeadDetailClient.tsx
  /dashboard
    page.tsx
    DashboardClient.tsx
  /projects            (NEW — public + admin)
  /blog                (NEW — public + admin)
  /api/leads/create/route.ts
  /api/leads/bulk-assign/route.ts
  /api/leads/webhook-form/route.ts   (NEW)
/lib/supabase/client.ts
/lib/supabase/server.ts
/types/database.ts
```

---

## 2. Database — trimmed schema

Keep from your schema.sql: **profiles, ad_campaigns/ad_sets/ads, lead_stages, leads, lead_stage_history, lead_notes, lead_followups, lead_activities**, plus all their triggers/RLS. Drop: clients, quotations, invoices, payments, client_tasks — nothing there is used by leads/kanban/dashboard, and you said skip billing for now.

Add projects + blog as new tables. Here's the full trimmed file:

```sql
-- ============================================================
-- 1. PROFILES
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('ADMIN','ACCOUNT_MANAGER','AGENT')),
  is_active boolean not null default true,
  avatar_url text,
  total_leads_assigned int not null default 0,
  open_leads_count int not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. AD ATTRIBUTION
-- ============================================================
create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  meta_campaign_id text unique,
  name text not null,
  objective text, status text,
  spend numeric(12,2), impressions bigint, clicks bigint,
  synced_at timestamptz, created_at timestamptz not null default now()
);

create table ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references ad_campaigns(id) on delete cascade,
  meta_adset_id text unique, name text not null, status text,
  created_at timestamptz not null default now()
);

create table ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid references ad_sets(id) on delete cascade,
  meta_ad_id text unique, name text not null,
  creative_thumbnail_url text, status text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. FUNNEL STAGES
-- ============================================================
create table lead_stages (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  sort_order int not null,
  color_hex text not null default '#71717A'
);

insert into lead_stages (key, label, sort_order, color_hex) values
  ('new',         'New',         1, '#0284C7'),
  ('contacted',   'Contacted',   2, '#D97706'),
  ('no_reply',    'No Reply',    3, '#64748B'),
  ('qualified',   'Qualified',   4, '#7C3AED'),
  ('proposal',    'Proposal',    5, '#DB2777'),
  ('negotiation', 'Negotiation', 6, '#EA580C'),
  ('won',         'Won',         7, '#16A34A'),
  ('lost',        'Lost',        8, '#DC2626'),
  ('followup',    'Follow-up',   9, '#0F766E');

-- ============================================================
-- 4. PROJECTS (properties)
-- ============================================================
create table projects (
  id text primary key,               -- slug, e.g. 'itlala-towers'
  name_en text not null, name_ar text not null,
  developer_en text, developer_ar text,
  city_en text not null, city_ar text not null,
  district_en text not null, district_ar text not null,

  starting_price_en text, starting_price_ar text,
  price_range_en text, price_range_ar text,

  size_en text, size_ar text,
  type_en text, type_ar text,
  status_en text, status_ar text,
  expected_delivery_en text, expected_delivery_ar text,
  units_count_en text, units_count_ar text,
  floors_en text, floors_ar text,

  overview_en text, overview_ar text,
  highlights_en jsonb default '[]',
  highlights_ar jsonb default '[]',

  video_url text,
  map_embed_url text,
  landmarks jsonb default '[]',      -- Landmark[]
  amenities jsonb default '[]',      -- Amenity[]

  brochure_url text,
  brochure_size_en text, brochure_size_ar text,

  is_published boolean not null default true,
  sort_order int default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_images (
  id uuid primary key default gen_random_uuid(),
  project_id text references projects(id) on delete cascade,
  url text not null,
  caption_en text, caption_ar text,
  sort_order int not null default 0
);
create index idx_project_images_project on project_images(project_id);

-- ============================================================
-- 5. BLOG POSTS
-- ============================================================
create table blog_posts (
  id text primary key,               -- slug
  category text, category_en text, category_ar text,
  accent text,
  title_en text not null, title_ar text not null,
  excerpt_en text, excerpt_ar text,
  author_en text, author_ar text,
  read_time_en text, read_time_ar text,
  summary_en jsonb default '[]',
  summary_ar jsonb default '[]',
  sections_en jsonb default '[]',    -- {heading, body, highlights?}[]
  sections_ar jsonb default '[]',
  stat_box jsonb default '[]',       -- {val, labelEn, labelAr}[]
  quote_en text, quote_ar text,
  featured boolean default false,
  is_published boolean not null default true,
  published_at timestamptz default now(),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. LEADS (core table) — source + property attribution from day 1
-- ============================================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in
    ('META_ADS','TIKTOK','SNAPCHAT','WHATSAPP','MANUAL','XLSX_IMPORT','WEBSITE_FORM','PROPERTY_INQUIRY')),

  campaign_id uuid references ad_campaigns(id),
  ad_set_id uuid references ad_sets(id),
  ad_id uuid references ads(id),
  property_id text references projects(id) on delete set null,

  name text, phone text, email text, city text,
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

create index idx_leads_campaign on leads(campaign_id);
create index idx_leads_stage on leads(stage_id);
create index idx_leads_agent on leads(assigned_agent_id);
create index idx_leads_property on leads(property_id);
create index idx_leads_phone on leads(phone);
create index idx_leads_email on leads(email);
create index idx_leads_created on leads(created_at desc);

-- ============================================================
-- 7. STAGE HISTORY, NOTES, FOLLOW-UPS, ACTIVITIES
-- ============================================================
create table lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  from_stage_id uuid references lead_stages(id),
  to_stage_id uuid references lead_stages(id) not null,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index idx_stage_history_lead on lead_stage_history(lead_id);

create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_notes_lead on lead_notes(lead_id);

create table lead_followups (
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
create index idx_followups_lead on lead_followups(lead_id);
create index idx_followups_agent on lead_followups(agent_id);
create index idx_followups_scheduled on lead_followups(scheduled_at);

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  activity_type text not null,
  performed_by uuid references profiles(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index idx_activities_lead on lead_activities(lead_id);

-- ============================================================
-- 8. TRIGGERS
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger leads_updated_at before update on leads for each row execute function update_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger projects_updated_at before update on projects for each row execute function update_updated_at();
create trigger blog_posts_updated_at before update on blog_posts for each row execute function update_updated_at();

create or replace function handle_new_user()
returns trigger as $$
declare v_name text; v_role text;
begin
  v_name := split_part(new.email, '@', 1);
  v_role := 'AGENT';
  if new.raw_user_meta_data is not null then
    if new.raw_user_meta_data->>'name' is not null then v_name := new.raw_user_meta_data->>'name'; end if;
    if new.raw_user_meta_data->>'role' is not null then v_role := new.raw_user_meta_data->>'role'; end if;
  end if;
  insert into profiles (id, name, email, role) values (new.id, v_name, coalesce(new.email, ''), v_role);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ============================================================
-- 9. RLS
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
alter table project_images enable row level security;
alter table blog_posts enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN');
$$ language sql stable security definer;

create policy "Authenticated users can view profiles" on profiles for select using (auth.uid() is not null);
create policy "Users can update their own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins can manage profiles" on profiles for all using (is_admin());

create policy "All authenticated can read stages" on lead_stages for select using (auth.uid() is not null);
create policy "Admins can manage stages" on lead_stages for all using (is_admin());

create policy "Admins full access leads" on leads for all using (is_admin());
create policy "Agents view assigned leads" on leads for select using (assigned_agent_id = auth.uid());
create policy "Agents update assigned leads" on leads for update using (assigned_agent_id = auth.uid());
-- allow the public webhook route to insert via service-role key (bypasses RLS) — no public insert policy needed

create policy "Admins full access notes" on lead_notes for all using (is_admin());
create policy "Agents manage notes on their leads" on lead_notes for all using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid()));

create policy "Admins full access followups" on lead_followups for all using (is_admin());
create policy "Agents manage followups on their leads" on lead_followups for all using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid()));

create policy "Admins full access activities" on lead_activities for all using (is_admin());
create policy "Agents view activities on their leads" on lead_activities for select using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid()));
create policy "Agents insert activities on their leads" on lead_activities for insert with check (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid()));

create policy "Admins full access stage history" on lead_stage_history for all using (is_admin());
create policy "Agents view stage history on their leads" on lead_stage_history for select using (
  exists (select 1 from leads where id = lead_id and assigned_agent_id = auth.uid()));

create policy "All authenticated read campaigns" on ad_campaigns for select using (auth.uid() is not null);
create policy "Admins manage campaigns" on ad_campaigns for all using (is_admin());
create policy "All authenticated read adsets" on ad_sets for select using (auth.uid() is not null);
create policy "Admins manage adsets" on ad_sets for all using (is_admin());
create policy "All authenticated read ads" on ads for select using (auth.uid() is not null);
create policy "Admins manage ads" on ads for all using (is_admin());

create policy "Public can read published projects" on projects for select using (is_published = true);
create policy "Admins full access projects" on projects for all using (is_admin());
create policy "Public can read project images" on project_images for select using (true);
create policy "Admins full access project_images" on project_images for all using (is_admin());

create policy "Public can read published posts" on blog_posts for select using (is_published = true);
create policy "Admins full access blog_posts" on blog_posts for all using (is_admin());
```

---

## 3. Types (`/types/database.ts`)

Copy the shape your `LeadDetailClient.tsx`/`KanbanBoard.tsx` already expect (`Lead`, `LeadStage`, `Profile`, `AdCampaign`), and add:

```ts
export interface Project {
  id: string
  name_en: string; name_ar: string
  developer_en?: string; developer_ar?: string
  city_en: string; city_ar: string
  district_en: string; district_ar: string
  starting_price_en?: string; starting_price_ar?: string
  price_range_en?: string; price_range_ar?: string
  overview_en?: string; overview_ar?: string
  highlights_en: string[]; highlights_ar: string[]
  landmarks: { nameEn: string; nameAr: string; distEn: string; distAr: string }[]
  amenities: { badge: string; titleEn: string; titleAr: string; descEn: string; descAr: string }[]
  is_published: boolean
  images?: { id: string; url: string; caption_en?: string; caption_ar?: string; sort_order: number }[]
}

export interface BlogPost {
  id: string
  title_en: string; title_ar: string
  excerpt_en?: string; excerpt_ar?: string
  category_en?: string; category_ar?: string
  sections_en: { heading: string; body: string; highlights?: string[] }[]
  sections_ar: { heading: string; body: string; highlights?: string[] }[]
  featured: boolean
  is_published: boolean
}

// Extend Lead with:
// property_id: string | null
// property?: { id: string; name_en: string; name_ar: string }
```

---

## 4. Reuse the leads code almost verbatim

Copy these files in as your starting point, with only the edits below:

| File | Change needed |
|---|---|
| `KanbanBoard.tsx` | None — already generic |
| `LeadsClient.tsx` | Add `property:projects(id, name_en)` to the `fetchLeads()` select; add a "Property" filter dropdown mirroring the campaign filter |
| `LeadsTable.tsx` | Add `WEBSITE_FORM: 'Website Form'` and `PROPERTY_INQUIRY: 'Property Inquiry'` to `SOURCE_LABELS`; show `lead.property?.name_en` as a small chip next to name when present |
| `AddLeadModal.tsx` | Add `WEBSITE_FORM`/`PROPERTY_INQUIRY` to `SOURCES`; add an optional Property `<select>` populated from `projects` |
| `DashboardClient.tsx` | None functionally — optionally add a "leads by property" breakdown chart alongside the existing source breakdown |
| `LeadDetailClient.tsx` | Show property name/link in the header if `lead.property_id` is set |

This is the "same structure" you're after — the kanban mechanics, drag-and-drop, stage history, activity log, bulk-assign, and dashboard aggregation are all reused unchanged.

---

## 5. Public-facing property/blog pages + inquiry capture

Public pages read from `projects`/`blog_posts` (published only) instead of importing `PROJECTS_DATA`/`POSTS` arrays — same TS interfaces, data just comes from Supabase now. Any inquiry form on a property page posts to one shared endpoint:

```ts
// /app/api/leads/webhook-form/route.ts
export async function POST(req: Request) {
  const supabase = createServiceRoleClient() // bypasses RLS for public inserts
  const { name, phone, email, message, property_id } = await req.json()

  const source = property_id ? 'PROPERTY_INQUIRY' : 'WEBSITE_FORM'
  let interest = message ?? null
  if (property_id) {
    const { data: project } = await supabase.from('projects').select('name_en').eq('id', property_id).single()
    interest = project?.name_en ?? interest
  }

  const { data: newStage } = await supabase.from('lead_stages').select('id').eq('key', 'new').single()

  const { error } = await supabase.from('leads').insert({
    name, phone, email, interest, source, property_id,
    stage_id: newStage!.id,
    form_data: { message, page: req.headers.get('referer') },
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
```

Every form on the site — the generic contact form and every property's inquiry form — points at this one route, passing `property_id` only when it's a property page. That single field is what makes "new" vs "new-with-a-property-name" work.

---

## 6. Admin CMS for projects/blog

New — build using the **Leads admin pattern as your template**: a server `page.tsx` that fetches + auth-checks, a client list component (table like `LeadsTable.tsx`), and a create/edit form. Given how large a project record is (images, amenities, landmarks, highlights, bilingual everything), give it a dedicated edit *page* rather than a modal; blog posts can use a modal like `AddLeadModal.tsx` since they're simpler.

---

## 7. Build order

1. Scaffold Next.js app, bring over your global CSS/design system.
2. Run the trimmed schema SQL above in Supabase.
3. Set up `/lib/supabase/client.ts` + `/lib/supabase/server.ts` (standard Supabase SSR helpers) and `/types/database.ts`.
4. Copy in `KanbanBoard.tsx`, `LeadsTable.tsx`, `LeadsClient.tsx`, `AddLeadModal.tsx`, `LeadDetailClient.tsx`, `DashboardClient.tsx`, and their `page.tsx` server wrappers — as-is first, get leads/kanban/dashboard fully working end to end with manually-entered leads.
5. Apply the small edits in section 4 for property linkage.
6. Build `/api/leads/webhook-form`.
7. Build public `/projects` and `/blog` pages reading from Supabase.
8. Build `/admin/projects` and `/admin/blog` CMS screens.
9. Seed a handful of real projects/posts by hand through the new CMS (or write a quick one-off script if you want to bulk-import your existing `projectsData.ts`/`blogData.ts` content into the new tables).
10. Wire real inquiry forms on the public property pages to the webhook route; test end-to-end.

This gets you the same battle-tested lead pipeline, with properties and blog as first-class database entities from the start instead of static files.
