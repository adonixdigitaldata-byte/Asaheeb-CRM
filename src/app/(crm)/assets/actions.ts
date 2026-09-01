'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AssetStatus, AssetCondition } from '@/types/database'

export interface CreateAssetInput {
  asset_tag?: string
  name: string
  category: string
  model_number?: string
  serial_number?: string
  sim_number?: string
  sim_carrier?: string
  status?: AssetStatus
  condition?: AssetCondition
  assigned_to?: string | null
  assigned_at?: string | null
  assignment_notes?: string
  purchase_date?: string | null
  purchase_cost?: number | null
  warranty_expiry?: string | null
  notes?: string
}

export interface UpdateAssetInput extends Partial<CreateAssetInput> {
  id: string
}

export async function createAsset(input: CreateAssetInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SALES_MANAGER')) {
      throw new Error('Unauthorized: Only Admin and Sales Managers can create assets')
    }

    const serviceSupabase = await createServiceClient()

    // Auto-generate asset_tag if missing
    let tag = input.asset_tag?.trim()
    if (!tag) {
      const rand = Math.floor(1000 + Math.random() * 9000)
      tag = `AST-${rand}`
    }

    const status = input.assigned_to ? 'ASSIGNED' : (input.status || 'AVAILABLE')
    const assigned_at = input.assigned_to ? (input.assigned_at || new Date().toISOString()) : null

    const { data: asset, error } = await serviceSupabase
      .from('company_assets')
      .insert({
        asset_tag: tag,
        name: input.name,
        category: input.category,
        model_number: input.model_number || null,
        serial_number: input.serial_number || null,
        sim_number: input.sim_number || null,
        sim_carrier: input.sim_carrier || null,
        status: status,
        condition: input.condition || 'GOOD',
        assigned_to: input.assigned_to || null,
        assigned_at: assigned_at,
        assignment_notes: input.assignment_notes || null,
        purchase_date: input.purchase_date || null,
        purchase_cost: input.purchase_cost || null,
        warranty_expiry: input.warranty_expiry || null,
        notes: input.notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Create log entry
    if (asset) {
      await serviceSupabase.from('asset_assignment_logs').insert({
        asset_id: asset.id,
        user_id: input.assigned_to || null,
        action: input.assigned_to ? 'ASSIGNED' : 'CREATED',
        condition_at_time: input.condition || 'GOOD',
        notes: input.assigned_to ? `Initial assignment during creation: ${input.assignment_notes || 'Assigned'}` : 'Asset registered in system',
        performed_by: user.id,
      })
    }

    revalidatePath('/assets')
    revalidatePath('/team')
    return { success: true, asset }
  } catch (error: any) {
    console.error('Error creating asset:', error)
    return { success: false, error: error.message || 'Failed to create asset' }
  }
}

export async function updateAsset(input: UpdateAssetInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SALES_MANAGER')) {
      throw new Error('Unauthorized: Only Admin and Sales Managers can update assets')
    }

    const serviceSupabase = await createServiceClient()

    // Fetch previous asset details to check if possessor changed
    const { data: oldAsset } = await serviceSupabase
      .from('company_assets')
      .select('*')
      .eq('id', input.id)
      .single()

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (input.name !== undefined) updatePayload.name = input.name
    if (input.asset_tag !== undefined) updatePayload.asset_tag = input.asset_tag
    if (input.category !== undefined) updatePayload.category = input.category
    if (input.model_number !== undefined) updatePayload.model_number = input.model_number || null
    if (input.serial_number !== undefined) updatePayload.serial_number = input.serial_number || null
    if (input.sim_number !== undefined) updatePayload.sim_number = input.sim_number || null
    if (input.sim_carrier !== undefined) updatePayload.sim_carrier = input.sim_carrier || null
    if (input.condition !== undefined) updatePayload.condition = input.condition
    if (input.purchase_date !== undefined) updatePayload.purchase_date = input.purchase_date || null
    if (input.purchase_cost !== undefined) updatePayload.purchase_cost = input.purchase_cost || null
    if (input.warranty_expiry !== undefined) updatePayload.warranty_expiry = input.warranty_expiry || null
    if (input.notes !== undefined) updatePayload.notes = input.notes || null

    if (input.assigned_to !== undefined) {
      updatePayload.assigned_to = input.assigned_to || null
      if (input.assigned_to) {
        updatePayload.status = 'ASSIGNED'
        updatePayload.assigned_at = input.assigned_at || new Date().toISOString()
      } else {
        updatePayload.status = input.status === 'ASSIGNED' ? 'AVAILABLE' : (input.status || 'AVAILABLE')
        updatePayload.assigned_at = null
      }
      updatePayload.assignment_notes = input.assignment_notes || null
    } else if (input.status !== undefined) {
      updatePayload.status = input.status
    }

    const { data: updatedAsset, error } = await serviceSupabase
      .from('company_assets')
      .update(updatePayload)
      .eq('id', input.id)
      .select()
      .single()

    if (error) throw error

    // Log assignment change if assigned_to changed
    if (oldAsset && input.assigned_to !== undefined && oldAsset.assigned_to !== input.assigned_to) {
      if (input.assigned_to) {
        await serviceSupabase.from('asset_assignment_logs').insert({
          asset_id: input.id,
          user_id: input.assigned_to,
          action: 'ASSIGNED',
          condition_at_time: input.condition || oldAsset.condition,
          notes: input.assignment_notes || 'Assigned to team member',
          performed_by: user.id,
        })
      } else {
        await serviceSupabase.from('asset_assignment_logs').insert({
          asset_id: input.id,
          user_id: oldAsset.assigned_to,
          action: 'RETURNED',
          condition_at_time: input.condition || oldAsset.condition,
          notes: input.assignment_notes || 'Returned to inventory / stock',
          performed_by: user.id,
        })
      }
    }

    revalidatePath('/assets')
    revalidatePath('/team')
    return { success: true, asset: updatedAsset }
  } catch (error: any) {
    console.error('Error updating asset:', error)
    return { success: false, error: error.message || 'Failed to update asset' }
  }
}

export async function assignAsset(assetId: string, userId: string, notes?: string, condition?: AssetCondition) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SALES_MANAGER')) {
      throw new Error('Unauthorized')
    }

    const serviceSupabase = await createServiceClient()

    const updateData: Record<string, any> = {
      assigned_to: userId,
      status: 'ASSIGNED',
      assigned_at: new Date().toISOString(),
      assignment_notes: notes || null,
      updated_at: new Date().toISOString(),
    }
    if (condition) {
      updateData.condition = condition
    }

    const { data: asset, error } = await serviceSupabase
      .from('company_assets')
      .update(updateData)
      .eq('id', assetId)
      .select()
      .single()

    if (error) throw error

    // Log the assignment
    await serviceSupabase.from('asset_assignment_logs').insert({
      asset_id: assetId,
      user_id: userId,
      action: 'ASSIGNED',
      condition_at_time: condition || asset?.condition || 'GOOD',
      notes: notes || 'Assigned to team member',
      performed_by: user.id,
    })

    revalidatePath('/assets')
    revalidatePath('/team')
    return { success: true, asset }
  } catch (error: any) {
    console.error('Error assigning asset:', error)
    return { success: false, error: error.message || 'Failed to assign asset' }
  }
}

export async function returnAsset(assetId: string, notes?: string, condition?: AssetCondition, targetStatus: AssetStatus = 'AVAILABLE') {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SALES_MANAGER')) {
      throw new Error('Unauthorized')
    }

    const serviceSupabase = await createServiceClient()

    // Get current possessor
    const { data: currentAsset } = await serviceSupabase
      .from('company_assets')
      .select('assigned_to, condition')
      .eq('id', assetId)
      .single()

    const updateData: Record<string, any> = {
      assigned_to: null,
      status: targetStatus,
      assigned_at: null,
      assignment_notes: null,
      updated_at: new Date().toISOString(),
    }
    if (condition) {
      updateData.condition = condition
    }

    const { data: asset, error } = await serviceSupabase
      .from('company_assets')
      .update(updateData)
      .eq('id', assetId)
      .select()
      .single()

    if (error) throw error

    // Log the return
    await serviceSupabase.from('asset_assignment_logs').insert({
      asset_id: assetId,
      user_id: currentAsset?.assigned_to || null,
      action: targetStatus === 'MAINTENANCE' ? 'MAINTENANCE' : 'RETURNED',
      condition_at_time: condition || currentAsset?.condition || 'GOOD',
      notes: notes || (targetStatus === 'MAINTENANCE' ? 'Sent for repair / maintenance' : 'Returned back to company inventory'),
      performed_by: user.id,
    })

    revalidatePath('/assets')
    revalidatePath('/team')
    return { success: true, asset }
  } catch (error: any) {
    console.error('Error returning asset:', error)
    return { success: false, error: error.message || 'Failed to return asset' }
  }
}

export async function deleteAsset(assetId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admin can delete assets')
    }

    const serviceSupabase = await createServiceClient()

    const { error } = await serviceSupabase
      .from('company_assets')
      .delete()
      .eq('id', assetId)

    if (error) throw error

    revalidatePath('/assets')
    revalidatePath('/team')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting asset:', error)
    return { success: false, error: error.message || 'Failed to delete asset' }
  }
}

export async function getAssetLogs(assetId: string) {
  try {
    const serviceSupabase = await createServiceClient()
    const { data: logs, error } = await serviceSupabase
      .from('asset_assignment_logs')
      .select(`
        *,
        user:profiles!user_id(id, name, email, avatar_url, role),
        performer:profiles!performed_by(id, name, email)
      `)
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { success: true, logs: logs || [] }
  } catch (error: any) {
    console.error('Error fetching asset logs:', error)
    return { success: false, logs: [], error: error.message }
  }
}
