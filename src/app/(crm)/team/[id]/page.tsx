import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import TeamMemberDetailClient from './TeamMemberDetailClient'
import { sortLeadStages, type LeadStage, type CompanyAsset } from '@/types/database'

export const metadata: Metadata = { title: 'Staff Member Profile' }
export const dynamic = 'force-dynamic'

export default async function TeamMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!currentProfile) redirect('/login')

  // Use service client to fetch staff details
  const serviceSupabase = await createServiceClient()

  // Fetch member profile
  const { data: member } = await serviceSupabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!member) notFound()

  // Parallel queries
  const [
    { data: leads },
    { data: stages },
    { data: followups },
    { data: activities },
    { data: salaryProfile },
    { data: salaryHistory },
    { data: payslips },
    { data: assignedAssets },
    { data: employeeDocuments },
    { data: employeeCustomRecords },
  ] = await Promise.all([
    serviceSupabase
      .from('leads')
      .select('id, name, phone, email, source, potential_value, created_at, stage_id, stage:lead_stages(id, key, label, color_hex)')
      .eq('assigned_agent_id', id)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('lead_stages')
      .select('*')
      .order('sort_order'),
    serviceSupabase
      .from('lead_followups')
      .select('id, lead_id, scheduled_at, is_completed, completed_at, note, lead:leads(id, name)')
      .eq('agent_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(100),
    serviceSupabase
      .from('lead_activities')
      .select('*, lead:leads(id, name)')
      .eq('performed_by', id)
      .order('created_at', { ascending: false })
      .limit(100),
    serviceSupabase
      .from('employee_salary_profiles')
      .select('*')
      .eq('profile_id', id)
      .maybeSingle(),
    serviceSupabase
      .from('employee_salary_history')
      .select('*')
      .eq('profile_id', id)
      .order('start_date', { ascending: true }),
    serviceSupabase
      .from('payslips')
      .select('*')
      .eq('employee_id', id)
      .order('year', { ascending: false })
      .order('month', { ascending: false }),
    serviceSupabase
      .from('company_assets')
      .select('*')
      .eq('assigned_to', id)
      .order('assigned_at', { ascending: false }),
    serviceSupabase
      .from('employee_documents')
      .select('*, uploader:profiles!employee_documents_uploaded_by_fkey(id, name, email)')
      .eq('profile_id', id)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('employee_custom_records')
      .select('*')
      .eq('profile_id', id)
      .order('created_at', { ascending: false }),
  ])

  // Resolve signed URLs for private uploads
  const resolvedDocuments = await Promise.all(
    (employeeDocuments || []).map(async (doc: any) => {
      if (doc.source_type === 'UPLOAD' && doc.file_path) {
        try {
          const { data: signed } = await serviceSupabase.storage
            .from('employee-documents')
            .createSignedUrl(doc.file_path, 60 * 60 * 2)
          if (signed?.signedUrl) {
            return { ...doc, download_url: signed.signedUrl }
          }
        } catch {}
      }
      return { ...doc, download_url: doc.file_url }
    })
  )

  return (
    <TeamMemberDetailClient
      member={member}
      currentProfile={currentProfile}
      leads={leads ?? []}
      stages={sortLeadStages((stages as LeadStage[]) ?? [])}
      followups={followups ?? []}
      activities={activities ?? []}
      salaryProfile={salaryProfile}
      salaryHistory={salaryHistory ?? []}
      payslips={payslips ?? []}
      assignedAssets={(assignedAssets as CompanyAsset[]) ?? []}
      initialDocuments={resolvedDocuments ?? []}
      initialCustomRecords={employeeCustomRecords ?? []}
    />
  )
}

