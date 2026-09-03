import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceSupabase = await createServiceClient()

    // 1. Fetch all documents with an expiry date
    const { data: docs, error: docsError } = await serviceSupabase
      .from('employee_documents')
      .select('*')
      .not('expiry_date', 'is', null)
      .order('expiry_date', { ascending: true })

    if (docsError) {
      return NextResponse.json({ documents: [], error: docsError.message }, { status: 200 })
    }

    // 2. Fetch profiles for staff mapping
    const { data: profiles } = await serviceSupabase
      .from('profiles')
      .select('id, name, email, role')

    const profileMap: Record<string, any> = {}
    ;(profiles || []).forEach((p: any) => {
      profileMap[p.id] = p
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 3. Generate signed URLs using service role
    const resolvedDocs = await Promise.all(
      (docs || []).map(async (doc: any) => {
        let effectiveUrl = doc.file_url

        let storagePath = doc.file_path
        if (!storagePath && doc.file_url && doc.file_url.includes('/employee-documents/')) {
          const parts = doc.file_url.split('/employee-documents/')
          if (parts[1]) storagePath = decodeURIComponent(parts[1])
        }

        if (storagePath && doc.source_type !== 'GOOGLE_DRIVE') {
          try {
            const { data: signed } = await serviceSupabase.storage
              .from('employee-documents')
              .createSignedUrl(storagePath, 60 * 60 * 4) // 4 hours
            if (signed?.signedUrl) {
              effectiveUrl = signed.signedUrl
            }
          } catch (err) {
            console.error('Error generating signed URL for storagePath:', storagePath, err)
          }
        }

        const expDate = new Date(doc.expiry_date)
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        let status: 'EXPIRED' | 'EXPIRING_30' | 'EXPIRING_90' | 'VALID' = 'VALID'
        if (diffDays < 0) {
          status = 'EXPIRED'
        } else if (diffDays <= 30) {
          status = 'EXPIRING_30'
        } else if (diffDays <= 90) {
          status = 'EXPIRING_90'
        }

        return {
          ...doc,
          file_url: effectiveUrl,
          download_url: effectiveUrl,
          diffDays,
          status,
          profile: profileMap[doc.profile_id] || null,
        }
      })
    )

    return NextResponse.json({ documents: resolvedDocs })
  } catch (err: any) {
    console.error('Error in GET /api/team/expiries:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
