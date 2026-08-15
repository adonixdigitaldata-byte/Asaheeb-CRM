import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ActivityTracker from '@/components/ActivityTracker'
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
    <div className="app-shell">
      <Sidebar profile={profile as Profile} />
      <ActivityTracker userId={user.id} />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
