import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import AssetsClient from './AssetsClient'
import type { CompanyAsset, Profile } from '@/types/database'

export const metadata: Metadata = { title: 'Company Assets & Equipment' }
export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  const supabase = await createClient()

  // 1. Get current logged in user profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!currentProfile) redirect('/login')

  const serviceSupabase = await createServiceClient()

  const isAdmin = currentProfile.role === 'ADMIN'
  const isManager = currentProfile.role === 'SALES_MANAGER'

  // 2. Fetch assets query (Admins/Managers see full inventory, Agents see only their assigned assets)
  let assetsQuery = serviceSupabase
    .from('company_assets')
    .select(`
      *,
      possessor:profiles!assigned_to(id, name, email, role, specialization, avatar_url, phone),
      creator:profiles!created_by(id, name, email)
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin && !isManager) {
    assetsQuery = assetsQuery.eq('assigned_to', user.id)
  }

  const { data: assetsData } = await assetsQuery

  // 3. Fetch active team members for assignment selection
  const { data: teamMembers } = await serviceSupabase
    .from('profiles')
    .select('id, name, email, role, specialization, avatar_url, phone, is_active')
    .order('name', { ascending: true })

  return (
    <AssetsClient
      currentProfile={currentProfile as Profile}
      initialAssets={(assetsData as CompanyAsset[]) ?? []}
      teamMembers={(teamMembers as Profile[]) ?? []}
    />
  )
}
