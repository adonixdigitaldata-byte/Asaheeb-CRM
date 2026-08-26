import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { payslipIds, month, year } = body

    const serviceClient = await createServiceClient()

    if (Array.isArray(payslipIds) && payslipIds.length > 0) {
      const { error } = await serviceClient.from('payslips').delete().in('id', payslipIds)
      if (error) throw error
      return NextResponse.json({ success: true, count: payslipIds.length })
    }

    if (month && year) {
      const { error } = await serviceClient
        .from('payslips')
        .delete()
        .eq('month', Number(month))
        .eq('year', Number(year))
      if (error) throw error
      return NextResponse.json({ success: true, month, year })
    }

    return NextResponse.json({ error: 'payslipIds or month & year required' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
