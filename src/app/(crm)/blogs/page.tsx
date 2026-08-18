import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import BlogsClient from './BlogsClient'
import type { Profile } from '@/types/database'

export const metadata: Metadata = { title: 'Blog CMS — Asaheeb CRM' }

export default async function BlogsPage() {
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

  return <BlogsClient profile={profile as Profile} />
}
