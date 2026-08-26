import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PayrollClient from './PayrollClient'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  const supabase = await createClient()

  // 1. Get current user profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!currentProfile) redirect('/login')

  // Only Admin has access to full Payroll Management
  if (currentProfile.role !== 'ADMIN') {
    redirect('/payslips')
  }

  // 2. Fetch all team members
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true })

  // 3. Fetch salary profiles
  const { data: salaryProfiles } = await supabase
    .from('employee_salary_profiles')
    .select('*')

  // 4. Fetch all salary history timeline records
  const { data: salaryHistory } = await supabase
    .from('employee_salary_history')
    .select('*')
    .order('start_date', { ascending: true })

  // 5. Fetch all payslips
  const { data: payslips } = await supabase
    .from('payslips')
    .select(`
      *,
      employee:profiles!employee_id(id, name, email, role, specialization, avatar_url)
    `)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <PayrollClient
      currentProfile={currentProfile}
      teamMembers={teamMembers ?? []}
      salaryProfiles={salaryProfiles ?? []}
      initialPayslips={payslips ?? []}
      initialSalaryHistory={salaryHistory ?? []}
    />
  )
}
