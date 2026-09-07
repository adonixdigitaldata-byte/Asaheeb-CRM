import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExpensesClient from './ExpensesClient'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
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

  // Strictly restrict expense ledger and financial analytics to ADMIN
  if (currentProfile.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  // 3. Fetch initial expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })

  return (
    <ExpensesClient
      currentProfile={currentProfile}
      initialExpenses={expenses || []}
    />
  )
}

