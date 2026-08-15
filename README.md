# Asaheeb CRM — Real Estate Sales Platform

Enterprise Real Estate CRM built with Next.js 15 (App Router), TypeScript, and Supabase.

## Features
- **Leads Pipeline & Kanban Board**: 4-column 2-row drag-and-drop funnel stages with custom scroller.
- **Table & List View**: Advanced multi-attribute search, stage/agent/source filtering, and bulk assignments.
- **Lead Details**: Real-time optimistic stage transitions, follow-up scheduling, discussion notes, and activity history.
- **Manual Lead Creation & Custom Properties**: Fast lead entry with free-text custom property support.
- **Real Estate Marketing Integration**: Meta Ads attribution tracking (Campaigns, Ad Sets, Ads) and automated lead webhooks.
- **Light & Dark Theme Styling**: Clean design with tailored brand assets and logo loaders.

## Tech Stack
- **Framework**: Next.js 15 / React 19 / TypeScript
- **Database & Auth**: Supabase PostgreSQL & Supabase Auth
- **Icons & UI**: Lucide React / Tailwind-free vanilla CSS
- **Drag & Drop**: @dnd-kit

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

3. Run the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```
