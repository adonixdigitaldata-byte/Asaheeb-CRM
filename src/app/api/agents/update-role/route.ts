import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    const { userId, role, specialization, work_status, is_active, name, phone } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (name !== undefined && name.trim()) updates.name = name.trim()
    if (role !== undefined) updates.role = role
    if (specialization !== undefined) updates.specialization = specialization
    if (work_status !== undefined) updates.work_status = work_status
    if (is_active !== undefined) updates.is_active = is_active
    if (phone !== undefined) updates.phone = phone
    updates.updated_at = new Date().toISOString()

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Update user_metadata in auth.users
    const authMetadataUpdates: Record<string, any> = {}
    if (role) authMetadataUpdates.role = role
    if (name) authMetadataUpdates.name = name.trim()

    if (Object.keys(authMetadataUpdates).length > 0) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: authMetadataUpdates,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update user profile' }, { status: 500 })
  }
}
