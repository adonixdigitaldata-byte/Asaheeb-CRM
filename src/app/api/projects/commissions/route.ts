import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/projects/commissions?projectId=...&agentId=...
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const agentId = searchParams.get('agentId')

    let query = supabase.from('project_commissions').select('*')

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    // Role-based visibility isolation:
    // Non-admin roles (Sales Managers, Sales Agents, Employees) can ONLY see their own sales
    if (callerProfile?.role !== 'ADMIN') {
      query = query.or(`agent_id.eq.${user.id},created_by.eq.${user.id}`)
    } else if (agentId) {
      // Admin can filter by agentId if specified, or view company-wide
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query.order('sale_date', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ commissions: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch commissions' }, { status: 500 })
  }
}

// POST /api/projects/commissions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const {
      project_id,
      unit_name,
      buyer_name,
      agent_id,
      agent_name,
      commission_amount,
      area_sqm,
      deal_value_sar,
      sale_date,
      notes,
    } = body

    if (!project_id || !unit_name || !buyer_name) {
      return NextResponse.json({ error: 'Project ID, unit name, and buyer name are required' }, { status: 400 })
    }

    let finalAgentId = agent_id || null
    let finalAgentName = agent_name ? String(agent_name).trim() : null

    // If the caller is not an Admin, strictly attribute the sale to themselves
    if (callerProfile?.role !== 'ADMIN') {
      finalAgentId = user.id
      finalAgentName = callerProfile?.name || 'Sales Team'
    }

    const newRecord = {
      project_id,
      unit_name: String(unit_name).trim(),
      buyer_name: String(buyer_name).trim(),
      agent_id: finalAgentId,
      agent_name: finalAgentName,
      commission_amount: Number(commission_amount) || 0,
      area_sqm: Number(area_sqm) || 0,
      deal_value_sar: Number(deal_value_sar) || 0,
      sale_date: sale_date || new Date().toISOString().split('T')[0],
      notes: notes ? String(notes).trim() : null,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('project_commissions')
      .insert(newRecord)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, commission: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to record commission' }, { status: 500 })
  }
}

// PUT /api/projects/commissions
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const {
      id,
      unit_name,
      buyer_name,
      agent_id,
      agent_name,
      commission_amount,
      area_sqm,
      deal_value_sar,
      sale_date,
      notes,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Commission ID is required' }, { status: 400 })
    }

    // Role check: non-admins can only edit their own sales
    if (callerProfile?.role !== 'ADMIN') {
      const { data: existing } = await supabase
        .from('project_commissions')
        .select('id, agent_id, created_by')
        .eq('id', id)
        .single()

      if (!existing || (existing.agent_id !== user.id && existing.created_by !== user.id)) {
        return NextResponse.json(
          { error: 'You are only authorized to edit your own sales records' },
          { status: 403 }
        )
      }
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (unit_name !== undefined) updates.unit_name = String(unit_name).trim()
    if (buyer_name !== undefined) updates.buyer_name = String(buyer_name).trim()
    if (callerProfile?.role === 'ADMIN') {
      if (agent_id !== undefined) updates.agent_id = agent_id || null
      if (agent_name !== undefined) updates.agent_name = agent_name ? String(agent_name).trim() : null
    }
    if (commission_amount !== undefined) updates.commission_amount = Number(commission_amount) || 0
    if (area_sqm !== undefined) updates.area_sqm = Number(area_sqm) || 0
    if (deal_value_sar !== undefined) updates.deal_value_sar = Number(deal_value_sar) || 0
    if (sale_date !== undefined) updates.sale_date = sale_date
    if (notes !== undefined) updates.notes = notes ? String(notes).trim() : null

    const { data, error } = await supabase
      .from('project_commissions')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, commission: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update commission' }, { status: 500 })
  }
}

// DELETE /api/projects/commissions?id=...
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Commission ID is required' }, { status: 400 })
    }

    // Role check: non-admins can only delete their own sales
    if (callerProfile?.role !== 'ADMIN') {
      const { data: existing } = await supabase
        .from('project_commissions')
        .select('id, agent_id, created_by')
        .eq('id', id)
        .single()

      if (!existing || (existing.agent_id !== user.id && existing.created_by !== user.id)) {
        return NextResponse.json(
          { error: 'You are only authorized to delete your own sales records' },
          { status: 403 }
        )
      }
    }

    const { error } = await supabase
      .from('project_commissions')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete commission' }, { status: 500 })
  }
}
