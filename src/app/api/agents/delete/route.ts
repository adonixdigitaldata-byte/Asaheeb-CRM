import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const {
      data: { user },
    } = await supabaseUser.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()
    
    // Check if the current user is an Admin
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Admins can delete users' }, { status: 403 })
    }

    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 })
    }

    // Check if target is root admin or another admin
    const { data: targetProfile } = await serviceClient
      .from('profiles')
      .select('email, role')
      .eq('id', userId)
      .maybeSingle()

    if (targetProfile?.email === 'probabilix.ai@gmail.com' || targetProfile?.role === 'ADMIN') {
      return NextResponse.json({ error: 'System Administrator accounts cannot be deleted' }, { status: 400 })
    }

    // 1. Clean up / disassociate references to this user across all tables to prevent foreign key constraint errors
    await Promise.allSettled([
      serviceClient.from('leads').update({ assigned_agent_id: null }).eq('assigned_agent_id', userId),
      serviceClient.from('lead_activities').update({ performed_by: null }).eq('performed_by', userId),
      serviceClient.from('lead_notes').update({ author_id: null }).eq('author_id', userId),
      serviceClient.from('lead_followups').update({ agent_id: null }).eq('agent_id', userId),
      serviceClient.from('lead_stage_history').update({ changed_by: null }).eq('changed_by', userId),
      serviceClient.from('import_batches').update({ uploaded_by: null }).eq('uploaded_by', userId),
    ])

    // 2. Delete from public profiles table
    const { error: profileErr } = await serviceClient
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileErr) {
      console.warn('Profile delete warning:', profileErr)
    }

    // 3. Delete from Supabase Auth completely using service role
    const { error: authErr } = await serviceClient.auth.admin.deleteUser(userId)
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
