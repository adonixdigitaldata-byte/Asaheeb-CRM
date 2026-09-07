import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import AttendanceClient from './AttendanceClient'

export const metadata: Metadata = {
  title: 'Attendance & Leaves | Asaheeb CRM',
  description: 'Enterprise Geofenced Attendance, Facial Verification, and Leave Management',
}

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!currentProfile) {
    redirect('/login')
  }

  return <AttendanceClient profile={currentProfile} />
}
