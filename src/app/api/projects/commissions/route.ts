import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/projects/commissions?projectId=...&agentId=...
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const agentId = searchParams.get('agentId')

    let query = supabase.from('project_commissions').select('*')

    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (agentId) {
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
      created_by,
    } = body

    if (!project_id || !unit_name || !buyer_name) {
      return NextResponse.json({ error: 'Project ID, unit name, and buyer name are required' }, { status: 400 })
    }

    const newRecord = {
      project_id,
      unit_name: String(unit_name).trim(),
      buyer_name: String(buyer_name).trim(),
      agent_id: agent_id || null,
      agent_name: agent_name ? String(agent_name).trim() : null,
      commission_amount: Number(commission_amount) || 0,
      area_sqm: Number(area_sqm) || 0,
      deal_value_sar: Number(deal_value_sar) || 0,
      sale_date: sale_date || new Date().toISOString().split('T')[0],
      notes: notes ? String(notes).trim() : null,
      created_by: created_by || null,
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

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (unit_name !== undefined) updates.unit_name = String(unit_name).trim()
    if (buyer_name !== undefined) updates.buyer_name = String(buyer_name).trim()
    if (agent_id !== undefined) updates.agent_id = agent_id || null
    if (agent_name !== undefined) updates.agent_name = agent_name ? String(agent_name).trim() : null
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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Commission ID is required' }, { status: 400 })
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
