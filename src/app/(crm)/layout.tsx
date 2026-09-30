import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CRMAppShell from '@/components/CRMAppShell'
import type { Profile } from '@/types/database'

export default async function CRMProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const nowIso = new Date().toISOString()
  const [profileRes, overdueRes, newMortgageRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('lead_followups')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', user.id)
      .eq('is_completed', false)
      .lt('scheduled_at', nowIso),
    supabase
      .from('mortgage_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
  ])

  const profile = profileRes.data
  const overdueCount = overdueRes.count ?? 0
  const newMortgageCount = newMortgageRes?.count ?? 0

  return (
    <CRMAppShell
      profile={profile as Profile}
      userId={user.id}
      overdueCount={overdueCount}
      newMortgageCount={newMortgageCount}
    >
      {children}
    </CRMAppShell>
  )
}
