import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllInBatches } from '@/lib/supabase/fetchAll'
import type { AgentHealthStat } from '@/app/(crm)/dashboard/DashboardClient'

// Outreach activity types considered genuine sales actions
const OUTREACH_ACTIVITY_TYPES = [
  'STAGE_CHANGE',
  'NOTE_ADDED',
  'NOTE_UPDATED',
  'FOLLOWUP_SCHEDULED',
  'FOLLOWUP_UPDATED',
  'FOLLOWUP_COMPLETED',
  'MEETING_SCHEDULED',
]

// Server-side in-memory cache to ensure multiple TVs/tabs or rapid refreshes
// do not trigger repeated heavy database requests.
interface CacheEntry {
  data: {
    agentHealthStats: AgentHealthStat[]
  }
  expiresAt: number
}

let cachedStats: CacheEntry | null = null
const CACHE_TTL_MS = 2.5 * 60 * 1000 // 2.5 minutes server cache

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Serve from cache if fresh
    const now = Date.now()
    if (cachedStats && now < cachedStats.expiresAt) {
      return NextResponse.json(cachedStats.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
        },
      })
    }

    const nowDate = new Date()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

    // Execute minimal queries required solely for TV leaderboard calculations
    const [
      teamProfilesRes,
      stagesRes,
      teamPending,
      teamDone,
      teamActs,
      assignedLeads,
    ] = await Promise.all([
      // 1. Team Agents & Managers
      supabase
        .from('profiles')
        .select('id, name, email, role')
        .in('role', ['AGENT', 'SALES_MANAGER'])
        .order('name'),

      // 2. Closed stages to exclude
      supabase.from('lead_stages').select('id, key'),

      // 3. Pending followups (for overdue & non-idle coverage check)
      fetchAllInBatches((from, to) =>
        supabase
          .from('lead_followups')
          .select('id, lead_id, agent_id, scheduled_at, lead:leads(assigned_agent_id)')
          .eq('is_completed', false)
          .range(from, to)
      ),

      // 4. Completed followups in the last 7 days
      fetchAllInBatches((from, to) =>
        supabase
          .from('lead_followups')
          .select('lead_id, agent_id, completed_at')
          .eq('is_completed', true)
          .gte('completed_at', sevenDaysAgo.toISOString())
          .range(from, to)
      ),

      // 5. Outreach activities in the last 7 days
      fetchAllInBatches((from, to) =>
        supabase
          .from('lead_activities')
          .select('lead_id, performed_by, created_at, activity_type, metadata')
          .gte('created_at', sevenDaysAgo.toISOString())
          .in('activity_type', OUTREACH_ACTIVITY_TYPES)
          .range(from, to)
      ),

      // 6. Only assigned leads (exclude unassigned leads to reduce row count)
      fetchAllInBatches<{
        id: string
        stage_id: string
        assigned_agent_id: string | null
        meeting_date: string | null
      }>((from, to) =>
        supabase
          .from('leads')
          .select('id, stage_id, assigned_agent_id, meeting_date')
          .not('assigned_agent_id', 'is', null)
          .range(from, to)
      ),
    ])

    const closedStageIds = (stagesRes.data ?? [])
      .filter((s: { key: string }) => ['won', 'lost'].includes(s.key))
      .map((s: { id: string }) => s.id)

    const teamAgents = teamProfilesRes.data ?? []
    const teamPendingLeadIds = new Set((teamPending ?? []).map((f: any) => f.lead_id as string))

    const isLeadCovered = (l: any) => {
      if (teamPendingLeadIds.has(l.id)) return true
      if (l.meeting_date) {
        const mDate = new Date(l.meeting_date)
        mDate.setHours(0, 0, 0, 0)
        if (mDate >= todayStart) return true
      }
      return false
    }

    const agentHealthStats: AgentHealthStat[] = teamAgents.map((agent: any) => {
      const agentLeads = (assignedLeads ?? []).filter(
        (l: any) => l.assigned_agent_id === agent.id && !closedStageIds.includes(l.stage_id)
      )
      const idle = agentLeads.filter((l: any) => !isLeadCovered(l)).length
      const overdue = teamPending.filter((f: any) => {
        const belongsToAgent = f.agent_id === agent.id || f.lead?.assigned_agent_id === agent.id
        return belongsToAgent && f.scheduled_at && new Date(f.scheduled_at) < nowDate
      }).length

      // Build 7-day history (6 days ago to today)
      const history7Days: Array<{ date: string; dayLabel: string; uniqueLeads: number; targetMet: boolean }> = []
      for (let i = 6; i >= 0; i--) {
        const dStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
        const dEnd = new Date(dStart.getTime() + 24 * 60 * 60 * 1000 - 1)
        const dateStr = dStart.toISOString().split('T')[0]
        const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Yday' : dStart.toLocaleDateString('en-US', { weekday: 'short' })

        const dLeadSet = new Set<string>()
        teamDone
          .filter((f: any) => {
            if (f.agent_id !== agent.id || !f.completed_at) return false
            const comp = new Date(f.completed_at)
            return comp >= dStart && comp <= dEnd
          })
          .forEach((f: any) => {
            if (f.lead_id) dLeadSet.add(f.lead_id)
          })

        teamActs
          .filter((a: any) => {
            if (a.performed_by !== agent.id || !a.created_at) return false
            if (!OUTREACH_ACTIVITY_TYPES.includes(a.activity_type)) return false
            const actTime = new Date(a.created_at)
            return actTime >= dStart && actTime <= dEnd
          })
          .forEach((a: any) => {
            if (a.lead_id) dLeadSet.add(a.lead_id)
          })

        history7Days.push({
          date: dateStr,
          dayLabel,
          uniqueLeads: dLeadSet.size,
          targetMet: dLeadSet.size >= 35,
        })
      }

      const doneToday = history7Days[history7Days.length - 1]?.uniqueLeads || 0
      const yesterdayCount = history7Days[history7Days.length - 2]?.uniqueLeads || 0
      const sevenDayTargetMetCount = history7Days.filter((h) => h.targetMet).length
      const sevenDayAvg = Math.round(history7Days.reduce((acc, h) => acc + h.uniqueLeads, 0) / 7)
      const targetProgress = Math.min(100, Math.round((doneToday / 35) * 100))
      const targetStatus: 'crushed' | 'on_pace' | 'behind' =
        doneToday >= 35 ? 'crushed' : doneToday >= 20 ? 'on_pace' : 'behind'

      // Meetings / site visits scheduled today
      const meetingsBookedToday = teamActs.filter((a: any) => {
        if (a.performed_by !== agent.id || !a.created_at) return false
        const actTime = new Date(a.created_at)
        if (actTime < todayStart) return false
        return (
          a.activity_type === 'MEETING_SCHEDULED' ||
          (a.activity_type === 'STAGE_CHANGE' &&
            (a.metadata?.to_stage?.toLowerCase().includes('meeting') ||
              a.metadata?.to_stage?.toLowerCase().includes('site visit')))
        )
      }).length

      return {
        id: agent.id,
        name: agent.name || agent.email || 'Agent',
        role: agent.role,
        totalLeads: agentLeads.length,
        idleLeads: idle,
        overdueFollowups: overdue,
        doneToday,
        target: 35,
        targetProgress,
        targetStatus,
        yesterdayCount,
        sevenDayAvg,
        sevenDayTargetMetCount,
        history7Days,
        meetingsBookedToday,
      }
    })

    // Store in cache for 2.5 minutes
    cachedStats = {
      data: { agentHealthStats },
      expiresAt: Date.now() + CACHE_TTL_MS,
    }

    return NextResponse.json(
      { agentHealthStats },
      {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
        },
      }
    )
  } catch (error: any) {
    console.error('Error fetching TV stats:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
