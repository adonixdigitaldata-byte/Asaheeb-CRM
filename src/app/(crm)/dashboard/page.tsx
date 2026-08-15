import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DashboardClient from './DashboardClient'
import type { Profile, LeadStage } from '@/types/database'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
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

  // Fire queries in parallel
  const [
    { data: stages },
    { data: leadsData },
    { data: recentLeads },
    { data: followups },
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('leads').select('stage_id, source, assigned_agent_id'),
    supabase
      .from('leads')
      .select('id, name, phone, potential_value, stage_id, source, created_at, stage:lead_stages(label, color_hex), property:projects(name_en)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('lead_followups')
      .select('*, lead:leads(id, name, phone), agent:profiles(name)')
      .eq('is_completed', false)
      .order('scheduled_at', { ascending: true })
      .limit(10),
  ])

  const totalLeads = leadsData?.length ?? 0

  const stageCounts: Record<string, number> = {}
  leadsData?.forEach((l: { stage_id: string }) => {
    stageCounts[l.stage_id] = (stageCounts[l.stage_id] ?? 0) + 1
  })

  const sourceCounts: Record<string, number> = {}
  leadsData?.forEach((l: { source: string }) => {
    sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1
  })

  return (
    <DashboardClient
      profile={profile as Profile}
      stages={(stages as LeadStage[]) ?? []}
      stageCounts={stageCounts}
      sourceCounts={sourceCounts}
      totalLeads={totalLeads}
      recentLeads={recentLeads ?? []}
      followups={followups ?? []}
    />
  )
}
