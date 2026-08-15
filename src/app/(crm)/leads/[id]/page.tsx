import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import LeadDetailClient from './LeadDetailClient'
import type { Profile, Lead, LeadStage, LeadNote, LeadFollowup, LeadActivity, Project } from '@/types/database'

export const metadata: Metadata = { title: 'Lead Details' }

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  // Parallel fetch: lead, stages, agents, notes, followups, activities, projects
  const [
    { data: lead },
    { data: stages },
    { data: agents },
    { data: notes },
    { data: followups },
    { data: activities },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select(`
        *,
        stage:lead_stages(*),
        assigned_agent:profiles(id, name, email),
        campaign:ad_campaigns(id, name),
        property:projects(id, name_en, name_ar)
      `)
      .eq('id', id)
      .single(),
    supabase.from('lead_stages').select('*').order('sort_order'),
    supabase.from('profiles').select('id, name, email').eq('is_active', true).order('name'),
    supabase
      .from('lead_notes')
      .select('*, author:profiles(id, name, email)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('lead_followups')
      .select('*, agent:profiles(id, name, email)')
      .eq('lead_id', id)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('lead_activities')
      .select('*, performer:profiles(id, name, email)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('*')
      .eq('is_published', true)
      .order('name_en'),
  ])

  if (!lead) {
    notFound()
  }

  // Security check: if AGENT and not assigned to this lead, redirect
  if (profile?.role === 'AGENT' && lead.assigned_agent_id !== profile.id) {
    redirect('/leads')
  }

  return (
    <LeadDetailClient
      lead={lead as Lead}
      profile={profile as Profile}
      stages={(stages as LeadStage[]) ?? []}
      agents={agents ?? []}
      notes={(notes as LeadNote[]) ?? []}
      followups={(followups as LeadFollowup[]) ?? []}
      activities={(activities as LeadActivity[]) ?? []}
      projects={(projects as Project[]) ?? []}
    />
  )
}
