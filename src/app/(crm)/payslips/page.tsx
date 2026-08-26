import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyPayslipsClient from './MyPayslipsClient'

export const dynamic = 'force-dynamic'

export default async function MyPayslipsPage() {
  const supabase = await createClient()

  // 1. Get current logged in user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!currentProfile) redirect('/login')

  // 2. Fetch all published/paid payslips belonging to this team member
  const { data: payslips } = await supabase
    .from('payslips')
    .select(`
      *,
      employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
    `)
    .eq('employee_id', user.id)
    .in('status', ['PUBLISHED', 'PAID'])
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  return (
    <MyPayslipsClient
      currentProfile={currentProfile}
      payslips={payslips ?? []}
    />
  )
}
