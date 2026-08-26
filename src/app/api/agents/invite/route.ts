import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAgentInviteEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils/url'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body = await request.json()
    const { email, name, mode, role = 'AGENT', specialization = null, phone = null } = body

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name?.trim() || cleanEmail.split('@')[0]
    const appUrl = getAppUrl(request)
    const callbackUrl = `${appUrl}/reset-password`

    // If in forgot-password mode, verify profile exists
    if (mode === 'forgot') {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('email', cleanEmail)
        .maybeSingle()

      if (!existingProfile) {
        return NextResponse.json(
          { error: `No account found for "${cleanEmail}". Please ask your CRM Administrator to invite you.` },
          { status: 404 }
        )
      }
    }

    let userId: string | null = null
    let actionLink: string | null = null
    let isPasswordReset = mode === 'forgot'

    // 1. If not forgot mode, ensure user exists in Supabase Auth
    if (!isPasswordReset) {
      // Create user with standard trigger-compatible metadata (role: ADMIN or AGENT) to prevent database trigger errors
      const safeTriggerRole = role === 'ADMIN' ? 'ADMIN' : 'AGENT'
      const tempPassword = `Asaheeb@${Math.random().toString(36).slice(2, 8)}!2026`

      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: cleanName, role: safeTriggerRole },
      })

      if (createData?.user?.id) {
        userId = createData.user.id
      } else if (createErr) {
        console.log('User create note (checking if exists):', createErr.message)
      }
    }

    // 2. If user already existed, locate their Auth user ID
    if (!userId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle()

      if (prof?.id) {
        userId = prof.id
      } else {
        const { data: userList } = await supabase.auth.admin.listUsers()
        const found = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail)
        if (found?.id) {
          userId = found.id
        }
      }
    }

    // 3. Generate password setup/recovery action link
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: callbackUrl,
      },
    })

    if (recoveryError) {
      console.error('generateLink recovery error:', recoveryError)
      return NextResponse.json(
        { error: recoveryError.message || 'Failed to generate password setup link' },
        { status: 400 }
      )
    }

    actionLink = recoveryData.properties?.action_link ?? null
    userId = recoveryData.user?.id ?? userId

    // 4. Upsert profile in CRM directory with requested role and specialization
    let finalRole = role || 'AGENT'
    let finalSpec = specialization || null

    if (userId) {
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('role, specialization, work_status')
        .eq('id', userId)
        .maybeSingle()

      if (existingProf) {
        finalRole = body.role !== undefined ? body.role : existingProf.role
        finalSpec = body.specialization !== undefined ? body.specialization : (existingProf.specialization || null)
      }

      const profilePayload: any = {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: finalRole,
        specialization: finalSpec,
        phone: phone || null,
        work_status: existingProf?.work_status || 'AVAILABLE',
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      // Try upserting with target role; if database has older check constraint, fallback gracefully
      const { error: upsertErr } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
      if (upsertErr) {
        console.warn('Profile upsert warning, attempting safe fallback:', upsertErr.message)
        profilePayload.role = finalRole === 'ADMIN' ? 'ADMIN' : 'AGENT'
        if (finalRole === 'SALES_MANAGER' && !finalSpec) {
          profilePayload.specialization = 'Sales Manager'
        }
        await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
      }
    }

    // 5. Dispatch official branded invitation email via Resend
    if (actionLink) {
      await sendAgentInviteEmail(
        cleanEmail,
        cleanName,
        actionLink,
        finalRole,
        finalSpec,
        isPasswordReset
      )
    } else {
      return NextResponse.json({ error: 'Failed to generate invitation link' }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    console.error('Invite API route error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
