import { NextResponse, NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendAgentInviteEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils/url'

// POST: Invite / Create a team member (Admin only)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      email,
      name,
      role = 'AGENT',
      specialization,
      phone,
      password,
    } = body

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const appUrl = getAppUrl(req)
    const callbackUrl = `${appUrl}/reset-password`

    // 1. Create or invite user via Supabase Auth Admin
    let authUserId: string | null = null
    let actionLink: string | null = null

    if (password && password.length >= 6) {
      const { data: newUser, error: createErr } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      })
      if (createErr) throw createErr
      authUserId = newUser.user.id
    } else {
      // Generate invite link
      const { data: inviteData } = await serviceClient.auth.admin.generateLink({
        type: 'invite',
        email: email.trim(),
        options: {
          redirectTo: callbackUrl,
          data: { name, role },
        },
      })

      if (inviteData?.properties?.action_link) {
        actionLink = inviteData.properties.action_link
        authUserId = inviteData.user?.id ?? null
      } else {
        // Fallback: generate recovery link
        const { data: recData } = await serviceClient.auth.admin.generateLink({
          type: 'recovery',
          email: email.trim(),
          options: { redirectTo: callbackUrl },
        })
        actionLink = recData?.properties?.action_link ?? null
        authUserId = recData?.user?.id ?? null
      }
    }

    // 2. Ensure profile is updated
    if (authUserId) {
      await serviceClient.from('profiles').upsert({
        id: authUserId,
        name,
        email,
        role,
        specialization: specialization || null,
        phone: phone || null,
        is_active: true,
        work_status: 'AVAILABLE',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    // 3. Send email notification via Resend
    if (actionLink) {
      await sendAgentInviteEmail(email.trim(), name, actionLink, role, specialization)
    }

    return NextResponse.json({ success: true, userId: authUserId })
  } catch (err: any) {
    console.error('Invite team member error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 400 })
  }
}

// PUT: Update team member (Admin only)
export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      id,
      name,
      role,
      specialization,
      work_status,
      is_active,
      phone,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (name !== undefined) updates.name = name
    if (role !== undefined) updates.role = role
    if (specialization !== undefined) updates.specialization = specialization
    if (work_status !== undefined) updates.work_status = work_status
    if (is_active !== undefined) updates.is_active = is_active
    if (phone !== undefined) updates.phone = phone

    const { data, error } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('Update team member error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 400 })
  }
}

// DELETE: Delete or deactivate user
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 })
  }

  if (id === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 })
  }

  try {
    const serviceClient = await createServiceClient()
    // Delete from auth.users (cascade will delete profile or clean up)
    const { error: authErr } = await serviceClient.auth.admin.deleteUser(id)
    if (authErr) {
      // Fallback: mark is_active = false
      await serviceClient.from('profiles').update({ is_active: false }).eq('id', id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 400 })
  }
}
