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

  const [
    { data: stages },
    { data: campaigns },
    { data: agents },
    { data: projects },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('ad_campaigns').select('id, name').order('name'),
    supabase
      .from('profiles')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('projects')
      .select('id, name_en, name_ar')
      .order('sort_order'),
  ])

  const sortedStages = sortLeadStages((stages as LeadStage[]) ?? [])

  return (
    <LeadsClient
      profile={profile as Profile}
      stages={sortedStages}
      campaigns={(campaigns as AdCampaign[]) ?? []}
      agents={agents ?? []}
      projects={(projects as Project[]) ?? []}
      initialSearchParams={resolvedSearchParams}
    />
  )
}
