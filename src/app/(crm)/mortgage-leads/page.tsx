import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import MortgageLeadsClient from './MortgageLeadsClient'
import type { Profile } from '@/types/database'

export const metadata: Metadata = {
  title: 'Mortgage Leads Pipeline | Asaheeb CRM',
  description: 'Manage high-intent financing and mortgage calculation inquiries',
}

export default async function MortgageLeadsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <MortgageLeadsClient profile={profile as Profile} />
}
