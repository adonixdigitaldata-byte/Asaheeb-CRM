import type { SupabaseClient } from '@supabase/supabase-js'

export interface RoundRobinAgentResult {
  id: string
  name: string
  email: string
  role: string
  work_status: string
  last_assigned_at: string | null
  open_leads_count: number
}

/**
 * Deterministic Round-Robin Lead Distribution Algorithm
 * 
 * 1. Queries all active team members with sales roles ('AGENT', 'SALES_MANAGER').
 * 2. Prioritizes agents who are currently AVAILABLE (if any are online/available).
 * 3. Identifies the timestamp of the most recent lead assigned to each agent.
 * 4. Selects the agent who was LEAST RECENTLY assigned a lead (or never assigned).
 * 5. Tie-breaks using lowest open leads count.
 */
export async function getNextRoundRobinAgent(
  supabase: SupabaseClient
): Promise<RoundRobinAgentResult | null> {
  try {
    // 1. Fetch active profiles
    const { data: allProfiles, error: profError } = await supabase
      .from('profiles')
      .select('id, name, email, role, is_active, work_status, open_leads_count')
      .neq('is_active', false)

    if (profError || !allProfiles || allProfiles.length === 0) {
      console.warn('Round Robin: No active profiles found in database', profError)
      return null
    }

    // 2. Filter for sales agents / managers first
    let candidates = allProfiles.filter(
      (p) => p.role === 'AGENT' || p.role === 'SALES_MANAGER'
    )

    // Fallback: If no dedicated sales agents exist, include ADMINs
    if (candidates.length === 0) {
      candidates = allProfiles.filter((p) => p.role === 'ADMIN' || p.role === 'EMPLOYEE')
    }

    if (candidates.length === 0) {
      return null
    }

    // If only 1 candidate exists, return immediately
    if (candidates.length === 1) {
      const single = candidates[0]
      return {
        id: single.id,
        name: single.name,
        email: single.email,
        role: single.role,
        work_status: single.work_status || 'AVAILABLE',
        last_assigned_at: null,
        open_leads_count: single.open_leads_count || 0,
      }
    }

    // 3. Check for AVAILABLE work_status preference
    const availableCandidates = candidates.filter(
      (p) => (p.work_status || 'AVAILABLE').toUpperCase() === 'AVAILABLE'
    )

    // If some agents are explicitly marked AVAILABLE, prioritize them; else use all candidates
    const activePool = availableCandidates.length > 0 ? availableCandidates : candidates
    const candidateIds = activePool.map((c) => c.id)

    // 4. Query recent leads for these candidate IDs to find the last assigned timestamp
    const { data: recentLeads } = await supabase
      .from('leads')
      .select('assigned_agent_id, created_at')
      .in('assigned_agent_id', candidateIds)
      .order('created_at', { ascending: false })

    // Map each candidate to their most recent lead assigned time
    const lastAssignedMap = new Map<string, number>()
    if (recentLeads) {
      for (const lead of recentLeads) {
        if (lead.assigned_agent_id && !lastAssignedMap.has(lead.assigned_agent_id)) {
          lastAssignedMap.set(lead.assigned_agent_id, new Date(lead.created_at).getTime())
        }
      }
    }

    // 5. Sort candidates:
    // a) Agents with NO previous leads (time = 0) come first
    // b) Agents with oldest last_assigned timestamp come next (true round robin)
    // c) Tie-breaker: lowest open_leads_count
    const scoredCandidates = activePool.map((c) => {
      const lastTime = lastAssignedMap.get(c.id) || 0
      return {
        candidate: c,
        lastTime,
        openCount: Number(c.open_leads_count) || 0,
      }
    })

    scoredCandidates.sort((a, b) => {
      // Primary: Least recently assigned first
      if (a.lastTime !== b.lastTime) {
        return a.lastTime - b.lastTime
      }
      // Secondary: Fewest open leads
      return a.openCount - b.openCount
    })

    const selected = scoredCandidates[0].candidate
    const lastTime = lastAssignedMap.get(selected.id)

    return {
      id: selected.id,
      name: selected.name,
      email: selected.email,
      role: selected.role,
      work_status: selected.work_status || 'AVAILABLE',
      last_assigned_at: lastTime ? new Date(lastTime).toISOString() : null,
      open_leads_count: selected.open_leads_count || 0,
    }
  } catch (err) {
    console.error('Error executing getNextRoundRobinAgent:', err)
    return null
  }
}
