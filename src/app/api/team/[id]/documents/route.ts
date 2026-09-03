import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { DocumentCategory, DocumentSourceType } from '@/types/database'

export const dynamic = 'force-dynamic'

// Helper to ensure the private bucket exists
async function ensureBucket(serviceSupabase: any) {
  try {
    const { data: buckets } = await serviceSupabase.storage.listBuckets()
    const bucketExists = buckets?.some((b: any) => b.name === 'employee-documents')
    if (!bucketExists) {
      await serviceSupabase.storage.createBucket('employee-documents', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      })
    }
  } catch (err) {
    console.error('Error ensuring bucket exists:', err)
  }
}

// GET: Fetch documents for an employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceSupabase = await createServiceClient()

    const { data: docs, error } = await serviceSupabase
      .from('employee_documents')
      .select('*, uploader:profiles!employee_documents_uploaded_by_fkey(id, name, email)')
      .eq('profile_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      // Table might not exist yet if migration hasn't run
      return NextResponse.json({ documents: [], error: error.message }, { status: 200 })
    }

    // Generate signed URLs for private uploads
    const resolvedDocs = await Promise.all(
      (docs || []).map(async (doc) => {
        if (doc.source_type === 'UPLOAD' && doc.file_path) {
          try {
            const { data: signed } = await serviceSupabase.storage
              .from('employee-documents')
              .createSignedUrl(doc.file_path, 60 * 60 * 2) // 2 hours
            if (signed?.signedUrl) {
              return { ...doc, download_url: signed.signedUrl }
            }
          } catch (e) {
            console.error('Error creating signed URL for', doc.file_path, e)
          }
        }
        return { ...doc, download_url: doc.file_url }
      })
    )

    return NextResponse.json({ documents: resolvedDocs })
  } catch (err: any) {
    console.error('Error in GET /api/team/[id]/documents:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST: Add new document (either file upload or Google Drive link)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const isAdminOrManager = currentProfile?.role === 'ADMIN' || currentProfile?.role === 'SALES_MANAGER'
    if (!isAdminOrManager && user.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceSupabase = await createServiceClient()
    const formData = await request.formData()

    const category = (formData.get('category') as DocumentCategory) || 'OTHER'
    const customCategoryName = (formData.get('custom_category_name') as string) || null
    const title = (formData.get('title') as string) || 'Document'
    const documentNumber = (formData.get('document_number') as string) || null
    const sourceType = (formData.get('source_type') as DocumentSourceType) || 'UPLOAD'
    const issueDate = (formData.get('issue_date') as string) || null
    const expiryDate = (formData.get('expiry_date') as string) || null
    const notes = (formData.get('notes') as string) || null
    const rawMeta = (formData.get('metadata') as string) || '{}'
    let metadata = {}
    try {
      metadata = JSON.parse(rawMeta)
    } catch {}

    let fileUrl = ''
    let filePath: string | null = null
    let fileName = ''
    let fileSizeBytes: number | null = null
    let fileType: string | null = null

    if (sourceType === 'UPLOAD') {
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'Please choose a file to upload' }, { status: 400 })
      }

      await ensureBucket(serviceSupabase)

      fileName = file.name
      fileSizeBytes = file.size
      fileType = file.type || 'application/octet-stream'

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `${id}/${Date.now()}_${sanitizedName}`

      const fileBuffer = Buffer.from(await file.arrayBuffer())

      const { data: uploadData, error: uploadError } = await serviceSupabase.storage
        .from('employee-documents')
        .upload(storagePath, fileBuffer, {
          contentType: fileType,
          upsert: false,
        })

      if (uploadError) {
        console.error('Supabase upload error:', uploadError)
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
      }

      filePath = storagePath
      // Public URL fallback (even if private, will generate signed URL on fetch)
      const { data: publicUrlData } = serviceSupabase.storage
        .from('employee-documents')
        .getPublicUrl(storagePath)
      fileUrl = publicUrlData?.publicUrl || storagePath
    } else {
      // Google Drive or External Link
      const linkUrl = (formData.get('link_url') as string)?.trim()
      if (!linkUrl) {
        return NextResponse.json({ error: 'Please provide a valid document link' }, { status: 400 })
      }
      fileUrl = linkUrl
      fileName = (formData.get('file_name') as string) || title
      fileType = sourceType === 'GOOGLE_DRIVE' ? 'application/google-drive' : 'text/uri-list'
    }

    const { data: insertedDoc, error: insertError } = await serviceSupabase
      .from('employee_documents')
      .insert({
        profile_id: id,
        category,
        custom_category_name: customCategoryName,
        title,
        document_number: documentNumber,
        source_type: sourceType,
        file_url: fileUrl,
        file_path: filePath,
        file_name: fileName,
        file_size_bytes: fileSizeBytes,
        file_type: fileType,
        issue_date: issueDate ? issueDate : null,
        expiry_date: expiryDate ? expiryDate : null,
        notes,
        metadata,
        uploaded_by: user.id,
      })
      .select('*, uploader:profiles!employee_documents_uploaded_by_fkey(id, name, email)')
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Generate signed URL if uploaded
    let downloadUrl = insertedDoc.file_url
    if (insertedDoc.source_type === 'UPLOAD' && insertedDoc.file_path) {
      const { data: signed } = await serviceSupabase.storage
        .from('employee-documents')
        .createSignedUrl(insertedDoc.file_path, 60 * 60 * 2)
      if (signed?.signedUrl) {
        downloadUrl = signed.signedUrl
      }
    }

    return NextResponse.json({ document: { ...insertedDoc, download_url: downloadUrl } }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/team/[id]/documents:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// DELETE: Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (currentProfile?.role !== 'ADMIN' && currentProfile?.role !== 'SALES_MANAGER') {
      return NextResponse.json({ error: 'Only admins and managers can delete employee documents' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')

    if (!docId) {
      return NextResponse.json({ error: 'Missing docId parameter' }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()

    // Find document first to see if file needs deleting from storage
    const { data: doc } = await serviceSupabase
      .from('employee_documents')
      .select('file_path, source_type')
      .eq('id', docId)
      .eq('profile_id', id)
      .maybeSingle()

    if (doc?.source_type === 'UPLOAD' && doc.file_path) {
      try {
        await serviceSupabase.storage
          .from('employee-documents')
          .remove([doc.file_path])
      } catch (storageErr) {
        console.warn('Storage file deletion error (non-fatal):', storageErr)
      }
    }

    const { error } = await serviceSupabase
      .from('employee_documents')
      .delete()
      .eq('id', docId)
      .eq('profile_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/team/[id]/documents:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// PUT: Update document metadata (title, category, doc number, dates, notes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const isAdminOrManager = currentProfile?.role === 'ADMIN' || currentProfile?.role === 'SALES_MANAGER'
    if (!isAdminOrManager && user.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { docId, title, category, custom_category_name, document_number, issue_date, expiry_date, notes } = body

    if (!docId) {
      return NextResponse.json({ error: 'Missing docId' }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()
    const { data: updatedDoc, error } = await serviceSupabase
      .from('employee_documents')
      .update({
        title: title || 'Document',
        category: category || 'OTHER',
        custom_category_name: custom_category_name || null,
        document_number: document_number || null,
        issue_date: issue_date || null,
        expiry_date: expiry_date || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId)
      .eq('profile_id', id)
      .select('*, uploader:profiles!employee_documents_uploaded_by_fkey(id, name, email)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ document: updatedDoc })
  } catch (err: any) {
    console.error('Error in PUT /api/team/[id]/documents:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

