import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import MyDocumentsClient from './MyDocumentsClient'

export const metadata: Metadata = { title: 'My Documents & Vault' }
export const dynamic = 'force-dynamic'

export default async function MyDocumentsPage() {
  const supabase = await createClient()

  // 1. Get current logged in user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!currentProfile) redirect('/login')

  // Block channel partners completely
  if (currentProfile.role === 'CHANNEL_PARTNER') {
    redirect('/dashboard')
  }

  const serviceSupabase = await createServiceClient()

  // 2. Fetch employee documents & custom records
  const [{ data: employeeDocuments }, { data: employeeCustomRecords }] = await Promise.all([
    serviceSupabase
      .from('employee_documents')
      .select('*, uploader:profiles!employee_documents_uploaded_by_fkey(id, name, email)')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('employee_custom_records')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  // 3. Resolve signed URLs for private uploads
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
        } catch { }
      }
      return { ...doc, download_url: doc.file_url }
    })
  )

  return (
    <MyDocumentsClient
      currentProfile={currentProfile}
      initialDocuments={resolvedDocuments ?? []}
      initialCustomRecords={employeeCustomRecords ?? []}
    />
  )
}
