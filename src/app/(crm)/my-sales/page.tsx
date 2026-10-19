import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MySalesClient from './MySalesClient'

export const dynamic = 'force-dynamic'

export default async function MySalesPage() {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Fetch user profile
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!currentProfile) {
    redirect('/login')
  }

  return <MySalesClient profile={currentProfile} />
}
