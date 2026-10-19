import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import LeadsClient from './LeadsClient'
import type { Profile, LeadStage, AdCampaign, Project } from '@/types/database'
import { sortLeadStages } from '@/types/database'

export const metadata: Metadata = { title: 'Leads Pipeline' }

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isManagerOrAdmin = profile?.role === 'ADMIN' || profile?.role === 'SALES_MANAGER'

  const [
    { data: stages },
    { data: campaigns },
    agentsRes,
    { data: projects },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    profile?.role === 'CHANNEL_PARTNER'
      ? Promise.resolve({ data: [] })
      : supabase.from('ad_campaigns').select('id, name').order('name'),
    isManagerOrAdmin
      ? supabase.from('profiles').select('id, name, email').eq('is_active', true).order('name')
      : Promise.resolve({ data: profile ? [{ id: profile.id, name: profile.name, email: profile.email }] : [] }),
    supabase
      .from('projects')
      .select('id, name_en, name_ar, city_en, city_ar, district_en, district_ar, starting_price_en, developer_en')
      .order('sort_order'),
  ])

  const sortedStages = sortLeadStages((stages as LeadStage[]) ?? [])
  const agents = agentsRes.data ?? []

  return (
    <LeadsClient
      profile={profile as Profile}
      stages={sortedStages}
      campaigns={(campaigns as AdCampaign[]) ?? []}
      agents={agents}
      projects={(projects as Project[]) ?? []}
      initialSearchParams={resolvedSearchParams}
    />
  )
}
