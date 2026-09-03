import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { CustomRecordType } from '@/types/database'

export const dynamic = 'force-dynamic'

// GET: List custom records for an employee
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
    const { data: records, error } = await serviceSupabase
      .from('employee_custom_records')
      .select('*')
      .eq('profile_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ records: [], error: error.message }, { status: 200 })
    }

    return NextResponse.json({ records: records || [] })
  } catch (err: any) {
    console.error('Error in GET /api/team/[id]/custom-records:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST: Create a custom record (Experience, Emergency Contact, Custom Field)
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

    const body = await request.json()
    const { record_type, title, data } = body

    if (!record_type || !title) {
      return NextResponse.json({ error: 'Record type and title are required' }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()
    const { data: record, error } = await serviceSupabase
      .from('employee_custom_records')
      .insert({
        profile_id: id,
        record_type: record_type as CustomRecordType,
        title,
        data: data || {},
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ record }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/team/[id]/custom-records:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// DELETE: Remove a custom record
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
      return NextResponse.json({ error: 'Only admins and managers can delete records' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const recordId = searchParams.get('recordId')

    if (!recordId) {
      return NextResponse.json({ error: 'Missing recordId parameter' }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()
    const { error } = await serviceSupabase
      .from('employee_custom_records')
      .delete()
      .eq('id', recordId)
      .eq('profile_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/team/[id]/custom-records:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// PUT: Update an existing custom record (Experience or Custom Field)
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
    const { recordId, title, data } = body

    if (!recordId) {
      return NextResponse.json({ error: 'Missing recordId parameter' }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()
    const { data: updatedRecord, error } = await serviceSupabase
      .from('employee_custom_records')
      .update({
        title: title || 'Record',
        data: data || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .eq('profile_id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ record: updatedRecord })
  } catch (err: any) {
    console.error('Error in PUT /api/team/[id]/custom-records:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

