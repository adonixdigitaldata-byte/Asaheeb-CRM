import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ProjectCommissionsPageClient from './ProjectCommissionsPageClient'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Project Commissions & Sales Performance — Asaheeb CRM',
  description: 'Portfolio-wide earned commissions leaderboard, brokerage terms, and sales transaction log',
}

export default async function ProjectCommissionsPage() {
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

  if (!profile) redirect('/login')

  // Strictly restricted to ADMIN role only
  if (profile.role !== 'ADMIN') {
    redirect('/projects')
  }

  return <ProjectCommissionsPageClient profile={profile as Profile} />
}
