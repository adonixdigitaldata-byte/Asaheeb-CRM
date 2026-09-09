import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import MarketingPopupsClient from './MarketingPopupsClient'
import type { Profile } from '@/types/database'

export const metadata: Metadata = { title: 'Marketing Pop-ups & Ads — Asaheeb CRM' }

export default async function MarketingPopupsPage() {
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

  return <MarketingPopupsClient profile={profile as Profile} />
}
