import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import TeamClient from './TeamClient'

export const metadata: Metadata = { title: 'Team Management' }
export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!currentProfile) redirect('/login')

  // Parallel fetch: profiles, authUsers, leadCounts, wonLeads, followups
  const serviceSupabase = await createServiceClient()

  const [
    { data: profiles },
    { data: authUsers },
    { data: leadCounts },
    { data: wonStageData },
    { data: completedFus },
    { data: salaryProfiles },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    serviceSupabase.auth.admin.listUsers().catch(() => ({ data: { users: [] } })),
    supabase
      .from('leads')
      .select('assigned_agent_id')
      .not('assigned_agent_id', 'is', null),
    supabase
      .from('lead_stages')
      .select('id')
      .eq('key', 'won')
      .maybeSingle(),
    supabase
      .from('lead_followups')
      .select('agent_id')
      .eq('is_completed', true),
    supabase
      .from('employee_salary_profiles')
      .select('profile_id, base_salary, currency'),
  ])

  const authUserMap: Record<string, { last_sign_in_at: string | null; confirmed_at: string | null }> = {}
  authUsers?.users?.forEach((u: any) => {
    authUserMap[u.id] = {
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed_at: u.email_confirmed_at ?? null,
    }
  })

  // Lead counts per agent
  const agentLeadCounts: Record<string, number> = {}
  leadCounts?.forEach((l: any) => {
    if (l.assigned_agent_id)
      agentLeadCounts[l.assigned_agent_id] = (agentLeadCounts[l.assigned_agent_id] ?? 0) + 1
  })

  // Won counts per agent
  const wonCounts: Record<string, number> = {}
  if (wonStageData) {
    const { data: wonLeads } = await supabase
      .from('leads')
      .select('assigned_agent_id')
      .eq('stage_id', wonStageData.id)
      .not('assigned_agent_id', 'is', null)

    wonLeads?.forEach((l: any) => {
      if (l.assigned_agent_id)
        wonCounts[l.assigned_agent_id] = (wonCounts[l.assigned_agent_id] ?? 0) + 1
    })
  }

  // Completed followups per agent
  const fuCounts: Record<string, number> = {}
  completedFus?.forEach((f: any) => {
    if (f.agent_id) fuCounts[f.agent_id] = (fuCounts[f.agent_id] ?? 0) + 1
  })

  // Salary profile lookup
  const salaryProfileMap: Record<string, { base_salary: number; currency: string }> = {}
  salaryProfiles?.forEach((sp) => {
    salaryProfileMap[sp.profile_id] = { base_salary: sp.base_salary, currency: sp.currency }
  })

  // Combine profile + stats
  const enrichedMembers = (profiles ?? []).map((member) => {
    const total = agentLeadCounts[member.id] ?? 0
    const won = wonCounts[member.id] ?? 0
    return {
      ...member,
      total_leads_assigned: total,
      last_sign_in_at: authUserMap[member.id]?.last_sign_in_at ?? null,
      is_confirmed: !!authUserMap[member.id]?.last_sign_in_at,
      wonLeads: won,
      conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
      completedFollowups: fuCounts[member.id] ?? 0,
      salaryProfile: salaryProfileMap[member.id] ?? null,
    }
  })

  return (
    <TeamClient
      members={enrichedMembers}
      currentProfile={currentProfile}
    />
  )
}
