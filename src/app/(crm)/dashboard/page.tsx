import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DashboardClient, { ScheduledMeetingItem } from './DashboardClient'
import type { Profile, LeadStage } from '@/types/database'
import { sortLeadStages } from '@/types/database'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Date boundaries for today and 7-day consistency tracking
  const now = new Date()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

  // Candidate dates for today (Saudi Arabia Riyadh UTC+3 and server local ISO)
  const riyadhFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const riyadhDateStr = riyadhFormatter.format(now)
  const localDateStr = now.toISOString().split('T')[0]
  const dateCandidates = Array.from(new Set([riyadhDateStr, localDateStr]))

  // Role detection: Admin & Sales Manager see all; Agents see only their connected leads
  const isAdmin = profile?.role === 'ADMIN'
  const isManagerOrAdmin = profile?.role === 'ADMIN' || profile?.role === 'SALES_MANAGER'

  // Scheduled meetings & site visits query for today
  let todayMeetingsQuery = supabase
    .from('leads')
    .select(`
      id,
      name,
      phone,
      meeting_date,
      meeting_time,
      interest,
      stage_id,
      assigned_agent_id,
      stage:lead_stages(id, key, label, color_hex),
      assigned_agent:profiles(id, name, email),
      property:projects(name_en)
    `)
    .in('meeting_date', dateCandidates)

  if (!isManagerOrAdmin) {
    todayMeetingsQuery = todayMeetingsQuery.eq('assigned_agent_id', user.id)
  }

  // Today's scheduled followups that represent meetings or site visits
  let todayMeetingFollowupsQuery = supabase
    .from('lead_followups')
    .select(`
      id,
      lead_id,
      agent_id,
      scheduled_at,
      note,
      is_completed,
      lead:leads(
        id,
        name,
        phone,
        interest,
        meeting_date,
        meeting_time,
        assigned_agent_id,
        stage:lead_stages(id, key, label, color_hex),
        property:projects(name_en)
      ),
      agent:profiles(id, name, email)
    `)
    .gte('scheduled_at', todayStart.toISOString())
    .lte('scheduled_at', todayEnd.toISOString())
    .eq('is_completed', false)

  if (!isManagerOrAdmin) {
    todayMeetingFollowupsQuery = todayMeetingFollowupsQuery.eq('agent_id', user.id)
  }

  const [
    { data: stages },
    { data: leadsData },
    { data: recentLeads },
    { data: followups },
    { data: overdueFollowups },
    { data: todayFollowups },
    { data: completedTodayData },
    { data: myActivitiesTodayData },
    { data: myAllLeads },
    { data: myPendingFups },
    todayMeetingsRes,
    todayMeetingFollowupsRes,
    teamProfilesRes,
    teamPendingFupsRes,
    teamDone7DaysRes,
    teamActivities7DaysRes,
  ] = await Promise.all([
    supabase.from('lead_stages').select('*').order('sort_order'),

    supabase.from('leads').select('id, stage_id, source, assigned_agent_id, meeting_date'),

    supabase
      .from('leads')
      .select('id, name, phone, potential_value, stage_id, source, created_at, stage:lead_stages(label, color_hex), property:projects(name_en)')
      .order('created_at', { ascending: false })
      .limit(10),

    // Existing: global pending followups for "Scheduled Follow-ups" card
    supabase
      .from('lead_followups')
      .select('*, lead:leads(id, name, phone), agent:profiles(name)')
      .eq('is_completed', false)
      .order('scheduled_at', { ascending: true })
      .limit(10),

    // NEW: Overdue followups for current user (past due, not completed)
    supabase
      .from('lead_followups')
      .select('id, lead_id, scheduled_at, note, lead:leads(id, name, phone)')
      .eq('agent_id', user.id)
      .eq('is_completed', false)
      .lt('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true }),

    // NEW: Today's followups for current user
    supabase
      .from('lead_followups')
      .select('id, lead_id, scheduled_at, note, lead:leads(id, name, phone)')
      .eq('agent_id', user.id)
      .eq('is_completed', false)
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true }),

    // NEW: Completed follow-ups today by current user
    supabase
      .from('lead_followups')
      .select('lead_id')
      .eq('agent_id', user.id)
      .eq('is_completed', true)
      .gte('completed_at', todayStart.toISOString()),

    // NEW: All actions logged today by current user (calls, stage advances, notes, scheduled follow-ups)
    supabase
      .from('lead_activities')
      .select('lead_id')
      .eq('performed_by', user.id)
      .gte('created_at', todayStart.toISOString()),

    // NEW: All leads assigned to current user (for idle computation)
    supabase
      .from('leads')
      .select('id, stage_id, name, created_at, meeting_date')
      .eq('assigned_agent_id', user.id),

    // NEW: Lead IDs that already have a pending followup (non-idle)
    supabase
      .from('lead_followups')
      .select('lead_id')
      .eq('agent_id', user.id)
      .eq('is_completed', false),

    // Today's meetings & site visits
    todayMeetingsQuery,
    todayMeetingFollowupsQuery,

    // Team radar queries: strictly for ADMIN only
    isAdmin
      ? supabase.from('profiles').select('id, name, email, role').in('role', ['AGENT', 'SALES_MANAGER']).order('name')
      : Promise.resolve({ data: [] }),

    isAdmin
      ? supabase.from('lead_followups').select('id, lead_id, agent_id, scheduled_at, lead:leads(assigned_agent_id)').eq('is_completed', false)
      : Promise.resolve({ data: [] }),

    isAdmin
      ? supabase
          .from('lead_followups')
          .select('lead_id, agent_id, completed_at')
          .eq('is_completed', true)
          .gte('completed_at', sevenDaysAgo.toISOString())
      : Promise.resolve({ data: [] }),

    isAdmin
      ? supabase
          .from('lead_activities')
          .select('lead_id, performed_by, created_at, activity_type, metadata')
          .gte('created_at', sevenDaysAgo.toISOString())
      : Promise.resolve({ data: [] }),
  ])

  const totalLeads = leadsData?.length ?? 0

  const stageCounts: Record<string, number> = {}
  leadsData?.forEach((l: { stage_id: string }) => {
    stageCounts[l.stage_id] = (stageCounts[l.stage_id] ?? 0) + 1
  })

  const sourceCounts: Record<string, number> = {}
  leadsData?.forEach((l: { source: string }) => {
    sourceCounts[l.source] = (sourceCounts[l.source] ?? 0) + 1
  })

  const sortedStages = sortLeadStages((stages as LeadStage[]) ?? [])
  const closedStageIds = sortedStages.filter((s) => ['won', 'lost'].includes(s.key)).map((s) => s.id)

  // Manager aggregates (Admin only)
  let agentHealthStats: any[] = []

  let stageHealthStats: Array<{
    id: string
    key: string
    label: string
    colorHex: string
    totalLeads: number
    idleLeads: number
    idlePercent: number
    status: 'red' | 'amber' | 'green'
  }> = []

  if (isAdmin) {
    const teamAgents = teamProfilesRes.data ?? []
    const teamPending = teamPendingFupsRes.data ?? []
    const teamDone = teamDone7DaysRes.data ?? []
    const teamActs = teamActivities7DaysRes.data ?? []
    const teamPendingLeadIds = new Set(teamPending.map((f: any) => f.lead_id as string))

    const isLeadCovered = (l: any) => {
      if (teamPendingLeadIds.has(l.id)) return true
      if (l.meeting_date) {
        const mDate = new Date(l.meeting_date)
        mDate.setHours(0, 0, 0, 0)
        if (mDate >= todayStart) return true
      }
      return false
    }

    agentHealthStats = teamAgents.map((agent: any) => {
      const agentLeads = (leadsData ?? []).filter(
        (l: any) => l.assigned_agent_id === agent.id && !closedStageIds.includes(l.stage_id)
      )
      const idle = agentLeads.filter((l: any) => !isLeadCovered(l)).length
      const overdue = teamPending.filter((f: any) => {
        const belongsToAgent = f.agent_id === agent.id || f.lead?.assigned_agent_id === agent.id
        return belongsToAgent && f.scheduled_at && new Date(f.scheduled_at) < now
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
      const targetStatus: 'MET' | 'IN_PROGRESS' | 'BEHIND' =
        doneToday >= 35 ? 'MET' : doneToday >= 20 ? 'IN_PROGRESS' : 'BEHIND'

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

    // Sort agents by most critical (highest overdue first, then highest idle)
    agentHealthStats.sort((a, b) => b.overdueFollowups - a.overdueFollowups || b.idleLeads - a.idleLeads)

    stageHealthStats = sortedStages.map((stage) => {
      const isClosed = ['won', 'lost'].includes(stage.key)
      const stageTotal = stageCounts[stage.id] ?? 0
      if (isClosed) {
        return {
          id: stage.id,
          key: stage.key,
          label: stage.label,
          colorHex: stage.color_hex || '#94A3B8',
          totalLeads: stageTotal,
          idleLeads: 0,
          idlePercent: 0,
          status: 'green' as const,
        }
      }

      const idleInStage = (leadsData ?? []).filter(
        (l: any) => l.stage_id === stage.id && !isLeadCovered(l)
      ).length

      const percent = stageTotal > 0 ? Math.round((idleInStage / stageTotal) * 100) : 0
      const status = (percent >= 60 || idleInStage > 20 ? 'red' : percent >= 30 || idleInStage > 5 ? 'amber' : 'green') as 'red' | 'amber' | 'green'

      return {
        id: stage.id,
        key: stage.key,
        label: stage.label,
        colorHex: stage.color_hex || '#3B82F6',
        totalLeads: stageTotal,
        idleLeads: idleInStage,
        idlePercent: percent,
        status,
      }
    })
  }

  // Build unified today's scheduled meetings & site visits list
  const meetingLeadIds = new Set<string>()
  const todayMeetings: ScheduledMeetingItem[] = []

  ;(todayMeetingsRes?.data || []).forEach((lead: any) => {
    meetingLeadIds.add(lead.id)
    const isSiteVisit =
      lead.stage?.key === 'site_visit_scheduled' ||
      lead.stage?.label?.toLowerCase().includes('visit')

    todayMeetings.push({
      id: `lead_${lead.id}`,
      leadId: lead.id,
      leadName: lead.name || 'Unnamed Lead',
      leadPhone: lead.phone,
      time: lead.meeting_time,
      type: isSiteVisit ? 'SITE_VISIT' : 'MEETING',
      typeLabel: isSiteVisit ? 'Site Visit' : 'Office Meeting',
      stageKey: lead.stage?.key,
      stageLabel: lead.stage?.label || 'Meeting Scheduled',
      stageColor: lead.stage?.color_hex || '#8B5CF6',
      agentId: lead.assigned_agent_id,
      agentName: lead.assigned_agent?.name || lead.assigned_agent?.email || 'Unassigned',
      projectName: lead.property?.name_en || lead.interest || null,
      status: lead.stage?.key === 'meeting_done' || lead.stage?.key === 'won' ? 'COMPLETED' : 'SCHEDULED',
    })
  })

  ;(todayMeetingFollowupsRes?.data || []).forEach((fu: any) => {
    if (!fu.lead || meetingLeadIds.has(fu.lead.id)) return

    const noteLower = (fu.note || '').toLowerCase()
    const stageKey = fu.lead.stage?.key || ''
    const stageLabelLower = (fu.lead.stage?.label || '').toLowerCase()

    const isMeetingOrVisit =
      stageKey === 'meeting_scheduled' ||
      stageKey === 'site_visit_scheduled' ||
      noteLower.includes('meeting') ||
      noteLower.includes('visit') ||
      stageLabelLower.includes('meeting') ||
      stageLabelLower.includes('visit')

    if (!isMeetingOrVisit) return

    meetingLeadIds.add(fu.lead.id)

    const isSiteVisit =
      stageKey === 'site_visit_scheduled' ||
      noteLower.includes('site visit') ||
      noteLower.includes('visit')

    const fuDate = new Date(fu.scheduled_at)
    const timeStr = `${String(fuDate.getHours()).padStart(2, '0')}:${String(fuDate.getMinutes()).padStart(2, '0')}`

    todayMeetings.push({
      id: `fu_${fu.id}`,
      leadId: fu.lead.id,
      leadName: fu.lead.name || 'Unnamed Lead',
      leadPhone: fu.lead.phone,
      time: fu.lead.meeting_time || timeStr,
      type: isSiteVisit ? 'SITE_VISIT' : 'MEETING',
      typeLabel: isSiteVisit ? 'Site Visit' : 'Office Meeting',
      stageKey: fu.lead.stage?.key,
      stageLabel: fu.lead.stage?.label || 'Meeting Scheduled',
      stageColor: fu.lead.stage?.color_hex || '#8B5CF6',
      agentId: fu.agent_id || fu.lead.assigned_agent_id,
      agentName: fu.agent?.name || fu.agent?.email || 'Assigned Agent',
      projectName: fu.lead.property?.name_en || fu.lead.interest || null,
      note: fu.note,
      status: 'SCHEDULED',
    })
  })

  todayMeetings.sort((a, b) => {
    const timeA = a.time || '99:99'
    const timeB = b.time || '99:99'
    return timeA.localeCompare(timeB)
  })

  // Distinct unique leads worked today by current user
  const uniqueLeadsWorkedToday = new Set<string>()
  completedTodayData?.forEach((f: any) => { if (f.lead_id) uniqueLeadsWorkedToday.add(f.lead_id) })
  myActivitiesTodayData?.forEach((a: any) => { if (a.lead_id) uniqueLeadsWorkedToday.add(a.lead_id) })
  const personalDoneToday = uniqueLeadsWorkedToday.size

  return (
    <DashboardClient
      profile={profile as Profile}
      stages={sortedStages}
      stageCounts={stageCounts}
      sourceCounts={sourceCounts}
      totalLeads={totalLeads}
      recentLeads={recentLeads ?? []}
      followups={followups ?? []}
      overdueFollowups={overdueFollowups ?? []}
      todayFollowups={todayFollowups ?? []}
      todayMeetings={todayMeetings}
      doneTodayCount={personalDoneToday}
      myAllLeads={(myAllLeads ?? []) as { id: string; stage_id: string; name: string; created_at: string; meeting_date?: string | null }[]}
      myPendingFollowupLeadIds={(myPendingFups ?? []).map((f: any) => f.lead_id as string)}
      agentHealthStats={agentHealthStats}
      stageHealthStats={stageHealthStats}
    />
  )
}


