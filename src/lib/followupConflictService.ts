import type { SupabaseClient } from '@supabase/supabase-js'

export interface ScheduleConflict {
  id: string
  scheduled_at: string
  note?: string | null
  lead_id: string
  lead_name: string
  lead_phone?: string | null
  formatted_time: string
}

export interface ConflictCheckOptions {
  agentId?: string | null
  scheduledAtIso: string
  excludeFollowupId?: string
  bufferMinutes?: number
}

/**
 * Checks if an agent has any pending follow-up, meeting, or site visit
 * scheduled within a ±bufferMinutes window of the target timestamp.
 * 
 * Uses existing B-tree indexes on (agent_id) and (scheduled_at) for
 * sub-millisecond execution directly against Supabase (zero Vercel CPU).
 */
export async function checkFollowupConflict(
  supabase: SupabaseClient,
  options: ConflictCheckOptions
): Promise<ScheduleConflict | null> {
  const { agentId, scheduledAtIso, excludeFollowupId, bufferMinutes = 30 } = options

  if (!agentId || !scheduledAtIso) return null

  const targetDate = new Date(scheduledAtIso)
  if (isNaN(targetDate.getTime())) return null

  const windowMs = bufferMinutes * 60 * 1000
  const startWindowIso = new Date(targetDate.getTime() - windowMs).toISOString()
  const endWindowIso = new Date(targetDate.getTime() + windowMs).toISOString()

  try {
    let query = supabase
      .from('lead_followups')
      .select('id, scheduled_at, note, lead_id, lead:leads(id, name, phone)')
      .eq('agent_id', agentId)
      .eq('is_completed', false)
      .gte('scheduled_at', startWindowIso)
      .lte('scheduled_at', endWindowIso)

    if (excludeFollowupId) {
      query = query.neq('id', excludeFollowupId)
    }

    const { data, error } = await query.limit(1)

    if (error || !data || data.length === 0) {
      return null
    }

    const item: any = data[0]
    const scheduledDate = new Date(item.scheduled_at)

    const formattedTime = !isNaN(scheduledDate.getTime())
      ? scheduledDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : ''

    const leadInfo = Array.isArray(item.lead) ? item.lead[0] : item.lead

    return {
      id: item.id,
      scheduled_at: item.scheduled_at,
      note: item.note,
      lead_id: item.lead_id,
      lead_name: leadInfo?.name || 'Another Lead',
      lead_phone: leadInfo?.phone || null,
      formatted_time: formattedTime,
    }
  } catch (err) {
    console.warn('[ConflictCheck] Error checking schedule conflict:', err)
    return null
  }
}
