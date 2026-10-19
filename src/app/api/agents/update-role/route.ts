import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    const { userId, role, specialization, work_status, is_active, name, phone, commission_threshold_sar, commission_rate_pct } = body

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
    if (commission_threshold_sar !== undefined) updates.commission_threshold_sar = Number(commission_threshold_sar) || 0
    if (commission_rate_pct !== undefined) updates.commission_rate_pct = Number(commission_rate_pct) || 0
    updates.updated_at = new Date().toISOString()

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (profileError) {
      if (profileError.message?.includes('profiles_role_check')) {
        return NextResponse.json({
          error: "Database constraint: Please run the SQL in fix_commissions_rls.sql in your Supabase SQL Editor to permit the 'CHANNEL_PARTNER' role in the database.",
        }, { status: 400 })
      }
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
