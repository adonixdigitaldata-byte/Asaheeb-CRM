import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ProjectsClient from './ProjectsClient'
import type { Profile } from '@/types/database'

export const metadata: Metadata = { title: 'Projects CMS — Asaheeb CRM' }

export default async function ProjectsPage() {
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

  return <ProjectsClient profile={profile as Profile} />
}
