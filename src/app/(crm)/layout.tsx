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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <CRMAppShell profile={profile as Profile} userId={user.id}>
      {children}
    </CRMAppShell>
  )
}
