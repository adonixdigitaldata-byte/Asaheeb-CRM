'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  Trophy,
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  CircleDot,
  PhoneCall,
  ShieldAlert,
  Activity,
  Flame,
  UserX,
  TrendingDown,
  ArrowUpRight,
  Target,
  Zap,
  ArrowRight,
  Tv,
  BarChart2,
  Calendar,
  Check,
  TrendingUp,
  Sparkles,
  CalendarCheck,
  Building2,
  MessageSquare,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import type { LeadStage, Profile } from '@/types/database'
import { formatTimeAgo } from '@/lib/utils'
import SalesFloorTVModal from '@/components/dashboard/SalesFloorTVModal'

export interface AgentHealthStat {
  id: string
  name: string
  role: string
  totalLeads: number
  idleLeads: number
  overdueFollowups: number
  doneToday: number
  yesterdayCount: number
  target: number
  targetProgress: number
  targetStatus: 'crushed' | 'on_pace' | 'behind'
  sevenDayAvg: number
  sevenDayTargetMetCount: number
  history7Days: {
    date: string
    dayLabel: string
    uniqueLeads: number
    targetMet: boolean
  }[]
  meetingsBookedToday: number
}

export interface StageHealthStat {
  id: string
  key: string
  label: string
  colorHex: string
  totalLeads: number
  idleLeads: number
  idlePercent: number
  status: 'red' | 'amber' | 'green'
}

export interface ScheduledMeetingItem {
  id: string
  leadId: string
  leadName: string
  leadPhone?: string | null
  meetingDate?: string | null
  time?: string | null
  scheduledAtIso?: string | null
  type: 'SITE_VISIT' | 'MEETING'
  typeLabel: string
  stageKey?: string
  stageLabel?: string
  stageColor?: string
  agentId?: string | null
  agentName?: string | null
  projectName?: string | null
  note?: string | null
  status?: 'SCHEDULED' | 'COMPLETED' | 'OVERDUE'
}

interface Props {
  profile: Profile
  stages: LeadStage[]
  stageCounts: Record<string, number>
  sourceCounts: Record<string, number>
  totalLeads: number
  recentLeads: any[]
  followups: any[]
  overdueFollowups: any[]
  todayFollowups: any[]
  todayMeetings?: ScheduledMeetingItem[]
  doneTodayCount: number
  myAllLeads: { id: string; stage_id: string; name: string; created_at: string; meeting_date?: string | null }[]
  myPendingFollowupLeadIds: string[]
  agentHealthStats?: AgentHealthStat[]
  stageHealthStats?: StageHealthStat[]
}

function getWhatsAppUrl(phone?: string | null): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('05')) {
    digits = '966' + digits.slice(1)
  }
  if (!digits) return null
  return `https://wa.me/${digits}`
}

function formatMeetingTime(
  timeStr?: string | null,
  meetingDateStr?: string | null,
  scheduledAtIso?: string | null
): string {
  if (!timeStr && !scheduledAtIso) return 'Time not set'

  // 1. If we have an exact scheduledAt UTC ISO string (e.g. from lead_followups)
  if (scheduledAtIso) {
    try {
      const d = new Date(scheduledAtIso)
      if (!isNaN(d.getTime())) {
        const localFormatted = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
        const saudiFormatted = d.toLocaleTimeString([], { timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', hour12: true })
        const isSaudi = new Date().getTimezoneOffset() === -180
        if (isSaudi || localFormatted === saudiFormatted) {
          return `${localFormatted} (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })})`
        }
        return `${localFormatted} (${saudiFormatted} KSA)`
      }
    } catch {
      // fallback
    }
  }

  // 2. If timeStr is e.g. "12:00" or "15:00" (entered in Saudi Arabia AST, UTC+3)
  if (timeStr) {
    const parts = timeStr.trim().split(':')
    if (parts.length >= 2) {
      const rawHour = parseInt(parts[0], 10)
      const rawMinute = parts[1].slice(0, 2)
      if (!isNaN(rawHour)) {
        const datePart = meetingDateStr || new Date().toISOString().split('T')[0]
        const saudiIso = `${datePart}T${String(rawHour).padStart(2, '0')}:${rawMinute}:00+03:00`
        const localDate = new Date(saudiIso)

        if (!isNaN(localDate.getTime())) {
          const localFormatted = localDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
          const saudiAmpm = rawHour >= 12 ? 'PM' : 'AM'
          const saudi12 = rawHour % 12 || 12
          const saudiFormatted = `${saudi12}:${rawMinute} ${saudiAmpm}`
          const isSaudi = new Date().getTimezoneOffset() === -180

          if (isSaudi || localFormatted === saudiFormatted) {
            return `${localFormatted} (${timeStr.slice(0, 5)})`
          }

          // Show local device time prominently + Saudi office time
          return `${localFormatted} (${saudiFormatted} KSA)`
        }

        const ampm = rawHour >= 12 ? 'PM' : 'AM'
        const h12 = rawHour % 12 || 12
        return `${h12}:${rawMinute} ${ampm}`
      }
    }
    return timeStr
  }

  return 'Time not set'
}

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: 'Meta Ads',
  MANUAL: 'Manual',
  XLSX_IMPORT: 'XLSX Import',
  TIKTOK: 'TikTok',
  SNAPCHAT: 'Snapchat',
  WHATSAPP: 'WhatsApp',
  WEBSITE_FORM: 'Website Form',
  PROPERTY_INQUIRY: 'Project Inquiry',
  BROCHURE_DOWNLOAD: 'Brochure Download',
}

const CLOSED_STAGE_KEYS = ['won', 'lost']

export default function DashboardClient({
  profile,
  stages,
  stageCounts,
  sourceCounts,
  totalLeads,
  recentLeads,
  followups,
  overdueFollowups,
  todayFollowups,
  todayMeetings = [],
  doneTodayCount,
  myAllLeads,
  myPendingFollowupLeadIds,
  agentHealthStats = [],
  stageHealthStats = [],
}: Props) {
  const router = useRouter()
  const isAdmin = profile.role === 'ADMIN'
  const isManagerOrAdmin = profile.role === 'ADMIN' || profile.role === 'SALES_MANAGER'
  const [showTVModal, setShowTVModal] = useState(false)
  const [adminTab, setAdminTab] = useState<'leaderboard' | 'radar' | 'consistency'>('leaderboard')

  const closedStageIds = stages.filter((s) => CLOSED_STAGE_KEYS.includes(s.key)).map((s) => s.id)
  const coveredLeadIds = new Set(myPendingFollowupLeadIds)
  const isCovered = (l: (typeof myAllLeads)[0]) => {
    if (coveredLeadIds.has(l.id)) return true
    if (l.meeting_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const mDate = new Date(l.meeting_date)
      mDate.setHours(0, 0, 0, 0)
      if (mDate >= today) return true
    }
    return false
  }
  const idleLeads = myAllLeads.filter((l) => !closedStageIds.includes(l.stage_id) && !isCovered(l))
  const idleCount = idleLeads.length
  const overdueCount = overdueFollowups.length
  const todayCount = todayFollowups.length

  const urgencyLevel = overdueCount > 0 ? 'red' : idleCount > 5 || todayCount > 0 ? 'amber' : 'green'

  const bc = {
    red:   { bg: 'linear-gradient(135deg,#FEF2F2 0%,#FFF8F8 100%)', border: '#FECACA', accent: '#DC2626', leftBar: '#DC2626' },
    amber: { bg: 'linear-gradient(135deg,#FFFBEB 0%,#FEFCE8 100%)', border: '#FDE68A', accent: '#D97706', leftBar: '#D97706' },
    green: { bg: 'linear-gradient(135deg,#F0FDF4 0%,#F7FFF9 100%)', border: '#BBF7D0', accent: '#16A34A', leftBar: '#16A34A' },
  }[urgencyLevel]

  const wonStage = stages.find((s) => s.key === 'won')
  const wonCount = wonStage ? (stageCounts[wonStage.id] ?? 0) : 0
  const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0'
  const maxStageCount = Math.max(...stages.map((s) => stageCounts[s.id] ?? 0), 1)

  // Frontend Auto-refresh: Sync on tab switch, window focus, 10-min interval & Supabase WebSocket
  useEffect(() => {
    function handleVisibilityOrFocus() {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }
    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    // Gentle 10-minute fallback interval (only when active)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }, 10 * 60 * 1000)

    // Direct Supabase Realtime WebSocket (free, does not invoke Vercel serverless)
    const supabase = createClient()
    const channel = supabase
      .channel('dashboard-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_followups' }, () => {
        router.refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities' }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [router])

  function getGreeting() {
    const h = new Date().getHours()
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  }

  function formatOverdueTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    if (days > 0) return `${days}d overdue`
    if (hours > 0) return `${hours}h overdue`
    return 'Just overdue'
  }

  function formatTodayTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const showUrgencyPanel = profile.role === 'AGENT' || profile.role === 'SALES_MANAGER'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Dashboard</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Good {getGreeting()}, {profile.name?.split(' ')[0] || 'Staff'} &middot; Overview of real estate sales &amp; pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads" className="btn btn-outline btn-sm"><Users size={14} /> View All Leads</Link>
          <Link href="/leads?action=new" className="btn btn-primary btn-sm"><Plus size={14} /> Add Lead</Link>
        </div>
      </div>

      <div className="page-body">

        {/* -- URGENCY ACCOUNTABILITY PANEL ------------------------------- */}
        {showUrgencyPanel && (
          <div style={{ marginBottom: 26 }}>

            {/* High-Impact SLA / Stagnation Threat Banner */}
            {overdueCount > 0 ? (
              <div style={{
                background: '#FEF2F2',
                border: '2px solid #EF4444',
                borderRadius: 12,
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 16,
                flexWrap: 'wrap',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0 }}>
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#991B1B', letterSpacing: '-0.01em' }}>
                        🚨 CRITICAL SLA BREACH: {overdueCount} FOLLOW-UP{overdueCount > 1 ? 'S' : ''} PAST DUE!
                      </span>
                      <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 9999, letterSpacing: '0.04em' }}>
                        IMMEDIATE ACTION REQUIRED
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                      Delayed follow-ups cause immediate client churn. Overdue calls must be cleared immediately.
                    </div>
                  </div>
                </div>

                <Link
                  href="/leads?my_leads=true"
                  className="btn btn-sm"
                  style={{ background: '#DC2626', color: '#FFFFFF', border: 'none', fontWeight: 700, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)' }}
                >
                  <Zap size={13} />
                  <span>Call Overdue Leads Now &rarr;</span>
                </Link>
              </div>
            ) : idleCount > 0 ? (
              <div style={{
                background: '#FFFBEB',
                border: '2px solid #F59E0B',
                borderRadius: 12,
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 16,
                flexWrap: 'wrap',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0 }}>
                    <Flame size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#92400E', letterSpacing: '-0.01em' }}>
                        🔥 PIPELINE STAGNATION RISK: {idleCount} LEADS UNATTENDED!
                      </span>
                      <span style={{ background: '#EA580C', color: '#FFFFFF', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 9999, letterSpacing: '0.04em' }}>
                        HIGH DROP-OFF
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                      Leads without scheduled follow-ups go cold after 48 hours. Schedule a call, visit, or meeting now.
                    </div>
                  </div>
                </div>

                <Link
                  href="/leads?my_leads=true"
                  className="btn btn-sm"
                  style={{ background: '#EA580C', color: '#FFFFFF', border: 'none', fontWeight: 700, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)' }}
                >
                  <Zap size={13} />
                  <span>Attack Neglected Leads &rarr;</span>
                </Link>
              </div>
            ) : null}

            {/* Main Stats Banner */}
            <div style={{
              background: bc.bg,
              border: `1.5px solid ${bc.border}`,
              borderLeft: `6px solid ${bc.leftBar}`,
              borderRadius: 12,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
            }}>

              {/* All-clear */}
              {urgencyLevel === 'green' && overdueCount === 0 && idleCount === 0 && todayCount === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle2 size={22} color="#16A34A" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#15803D' }}>You&apos;re completely caught up!</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      {doneTodayCount > 0 ? `${doneTodayCount} action${doneTodayCount !== 1 ? 's' : ''} completed today. High performance maintained.` : 'No overdue follow-ups or neglected leads in your pipeline.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Urgency numbers */}
              {(overdueCount > 0 || todayCount > 0 || idleCount > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>

                  {/* Overdue */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: overdueCount > 0 ? '#FEE2E2' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={20} color={overdueCount > 0 ? '#DC2626' : '#94A3B8'} />
                    </div>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: overdueCount > 0 ? '#DC2626' : '#94A3B8', lineHeight: 1 }}>{overdueCount}</div>
                      <div style={{ fontSize: 10.5, color: overdueCount > 0 ? '#DC2626' : '#64748B', marginTop: 2, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Overdue Calls
                      </div>
                    </div>
                  </div>

                  <div style={{ width: 1, height: 38, background: '#E2E8F0' }} />

                  {/* Today */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: todayCount > 0 ? '#FEF3C7' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CalendarClock size={20} color={todayCount > 0 ? '#D97706' : '#94A3B8'} />
                    </div>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: todayCount > 0 ? '#D97706' : '#94A3B8', lineHeight: 1 }}>{todayCount}</div>
                      <div style={{ fontSize: 10.5, color: todayCount > 0 ? '#D97706' : '#64748B', marginTop: 2, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Due Today
                      </div>
                    </div>
                  </div>

                  <div style={{ width: 1, height: 38, background: '#E2E8F0' }} />

                  {/* Idle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: idleCount > 0 ? '#FFEDD5' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Flame size={20} color={idleCount > 0 ? '#EA580C' : '#94A3B8'} />
                    </div>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: idleCount > 0 ? '#EA580C' : '#94A3B8', lineHeight: 1 }}>{idleCount}</div>
                      <div style={{ fontSize: 10.5, color: idleCount > 0 ? '#EA580C' : '#64748B', marginTop: 2, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Neglected Leads
                      </div>
                    </div>
                  </div>

                  <div style={{ width: 1, height: 38, background: '#E2E8F0' }} />

                  {/* Done Today */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle2 size={20} color="#16A34A" />
                    </div>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#16A34A', lineHeight: 1 }}>{doneTodayCount}</div>
                      <div style={{ fontSize: 10.5, color: '#16A34A', marginTop: 2, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Done Today
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Action Button */}
              {(overdueCount > 0 || idleCount > 0 || todayCount > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: bc.accent, textAlign: 'right' }}>
                    {overdueCount > 0
                      ? `${overdueCount} follow-up${overdueCount > 1 ? 's' : ''} missed — resolve immediately`
                      : idleCount > 0
                        ? `${idleCount} active lead${idleCount !== 1 ? 's' : ''} have no next touchpoint`
                        : `${todayCount} follow-up${todayCount !== 1 ? 's' : ''} scheduled for today`}
                  </div>
                  <Link href="/leads?my_leads=true" className="btn btn-primary btn-sm" style={{ fontWeight: 700, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PhoneCall size={13} />
                    <span>Open Work Queue</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Daily Sales Activity Pace Bar (Quota: 35 Daily Touchpoints) */}
            <div style={{
              marginTop: 12,
              padding: '12px 18px',
              borderRadius: 10,
              background: doneTodayCount < 15 ? '#FFF1F2' : doneTodayCount < 35 ? '#FFFBEB' : '#F0FDF4',
              border: `1.5px solid ${doneTodayCount < 15 ? '#FECDD3' : doneTodayCount < 35 ? '#FDE68A' : '#BBF7D0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: doneTodayCount < 15 ? '#FEE2E2' : doneTodayCount < 35 ? '#FEF3C7' : '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: doneTodayCount < 15 ? '#E11D48' : doneTodayCount < 35 ? '#D97706' : '#16A34A',
                  flexShrink: 0,
                }}>
                  <Target size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                      Daily Unique Leads Engaged
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: doneTodayCount < 15 ? '#FEE2E2' : doneTodayCount < 35 ? '#FEF3C7' : '#DCFCE7',
                      color: doneTodayCount < 15 ? '#BE123C' : doneTodayCount < 35 ? '#B45309' : '#15803D',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {doneTodayCount < 15
                        ? `🚨 BEHIND PACE (${doneTodayCount} / 35 LEADS)`
                        : doneTodayCount < 35
                          ? `⚠️ IN PROGRESS (${doneTodayCount} / 35 LEADS)`
                          : `🔥 QUOTA MET (${doneTodayCount} / 35 LEADS)`}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                    {doneTodayCount < 15
                      ? `You have engaged ${doneTodayCount} unique leads today. Minimum 35 distinct clients required per shift.`
                      : doneTodayCount < 35
                        ? `${35 - doneTodayCount} more distinct leads to reach today's 35 client outreach target.`
                        : 'Outstanding daily outreach! You reached 35+ unique clients today.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', maxWidth: 300 }}>
                <div style={{ flex: 1, height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((doneTodayCount / 35) * 100))}%`,
                    background: doneTodayCount < 15 ? '#F43F5E' : doneTodayCount < 35 ? '#F59E0B' : '#10B981',
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: doneTodayCount < 15 ? '#BE123C' : '#0F172A', minWidth: 50, textAlign: 'right' }}>
                  {doneTodayCount} / 35
                </span>
              </div>
            </div>

            {/* Three Action Cards */}
            {(overdueCount > 0 || todayCount > 0 || idleCount > 0) && (
              <div className="rg-3" style={{ marginTop: 16 }}>

                {/* Card: Overdue */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `4px solid ${overdueCount > 0 ? '#DC2626' : '#10B981'}` }}>
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={15} color={overdueCount > 0 ? '#DC2626' : '#16A34A'} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: overdueCount > 0 ? '#DC2626' : '#0F172A' }}>Overdue Calls</span>
                      {overdueCount > 0 && <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 20 }}>{overdueCount}</span>}
                    </div>
                    {overdueCount > 0 && (
                      <Link href="/leads?my_leads=true" style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, textDecoration: 'none' }}>
                        View all &rarr;
                      </Link>
                    )}
                  </div>
                  <div style={{ padding: '4px 0', maxHeight: 290, overflowY: 'auto' }}>
                    {overdueCount === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#15803D', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <CheckCircle2 size={16} color="#16A34A" />
                        <span>Zero overdue follow-ups</span>
                      </div>
                    ) : (
                      overdueFollowups.map((f: any) => (
                        <Link key={f.id} href={f.lead?.id ? `/leads/${f.lead.id}` : '/leads'}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', textDecoration: 'none', borderBottom: '1px solid #FEF2F2', transition: 'background 0.15s' }}
                          className="hover:bg-red-50">
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.lead?.name || 'Lead'}</div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{f.lead?.phone || 'No phone'}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', background: '#FEF2F2', padding: '3px 9px', borderRadius: 20, flexShrink: 0, marginLeft: 8 }}>
                            {formatOverdueTime(f.scheduled_at)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                {/* Card: Due Today */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `4px solid ${todayCount > 0 ? '#D97706' : '#E2E8F0'}` }}>
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CalendarClock size={15} color={todayCount > 0 ? '#D97706' : '#94A3B8'} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: todayCount > 0 ? '#D97706' : '#0F172A' }}>Due Today</span>
                      {todayCount > 0 && <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 20 }}>{todayCount}</span>}
                    </div>
                  </div>
                  <div style={{ padding: '4px 0', maxHeight: 290, overflowY: 'auto' }}>
                    {todayCount === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <CheckCircle2 size={16} color="#10B981" />
                        <span>No more follow-ups due today</span>
                      </div>
                    ) : (
                      todayFollowups.map((f: any) => (
                        <Link key={f.id} href={f.lead?.id ? `/leads/${f.lead.id}` : '/leads'}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', textDecoration: 'none', borderBottom: '1px solid #FFFDF5', transition: 'background 0.15s' }}
                          className="hover:bg-amber-50">
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.lead?.name || 'Lead'}</div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{f.note || 'Follow-up call'}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#D97706', background: '#FEF9C3', padding: '3px 9px', borderRadius: 20, flexShrink: 0, marginLeft: 8 }}>
                            {formatTodayTime(f.scheduled_at)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                {/* Card: Idle Leads */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `4px solid ${idleCount > 0 ? '#EA580C' : '#10B981'}` }}>
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CircleDot size={15} color={idleCount > 0 ? '#EA580C' : '#16A34A'} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: idleCount > 0 ? '#EA580C' : '#0F172A' }}>Neglected Leads</span>
                      {idleCount > 0 && <span style={{ background: '#FFEDD5', color: '#EA580C', fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 20 }}>{idleCount}</span>}
                    </div>
                    {idleCount > 0 && (
                      <Link href="/leads?my_leads=true" style={{ fontSize: 11, color: '#EA580C', fontWeight: 700, textDecoration: 'none' }}>
                        Review all &rarr;
                      </Link>
                    )}
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    {idleCount === 0 ? (
                      <div style={{ textAlign: 'center', color: '#15803D', fontSize: 12, padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <CheckCircle2 size={16} color="#16A34A" />
                        <span>All leads have a scheduled next step</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ fontSize: 32, fontWeight: 900, color: '#EA580C', lineHeight: 1 }}>{idleCount}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Leads Neglected</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: '#9A3412', marginTop: 4, fontWeight: 500 }}>
                            High drop-off risk! These leads have zero upcoming calls or meetings.
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                          {idleLeads.map((l) => {
                            const stage = stages.find((s) => s.id === l.stage_id)
                            return (
                              <div
                                key={l.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 10px',
                                  background: '#FAFAFA',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  gap: 8,
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <Link
                                    href={`/leads/${l.id}`}
                                    style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    {l.name || 'Unnamed Lead'}
                                  </Link>
                                  {stage && (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: stage.color_hex || '#64748B', display: 'inline-block', marginTop: 2 }}>
                                      {stage.label}
                                    </span>
                                  )}
                                </div>

                                <Link
                                  href={`/leads/${l.id}`}
                                  className="btn btn-sm"
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    background: '#EA580C',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: 4,
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Zap size={11} />
                                  <span>Schedule</span>
                                </Link>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* -- ADMIN ONLY: EXECUTIVE SALES COMMAND & TEAM ACCOUNTABILITY ------- */}
        {isAdmin && (agentHealthStats.length > 0 || stageHealthStats.length > 0) && (
          <div style={{ marginBottom: 32 }}>
            {/* Admin Section Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 14,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                  }}>
                    <ShieldAlert size={18} />
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                    Executive Sales Command &amp; Floor Accountability
                  </h2>
                  <span style={{ fontSize: 11, fontWeight: 800, backgroundColor: '#FEE2E2', color: '#DC2626', padding: '3px 9px', borderRadius: 9999, letterSpacing: '0.04em' }}>
                    ADMIN VIEW
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: '#64748B', marginTop: 4, marginBottom: 0 }}>
                  Real-time monitoring of sales agent output against the 35 daily unique clients quota, previous day actions, and 7-day consistency.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowTVModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
                    color: '#F8FAFC',
                    border: '1px solid #334155',
                    borderRadius: 9,
                    padding: '8px 16px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Launch high-contrast fullscreen display for sales floor TV"
                >
                  <Tv size={15} style={{ color: '#38BDF8' }} />
                  <span>📺 Sales Floor TV Broadcast</span>
                  <span style={{
                    background: '#38BDF8',
                    color: '#0F172A',
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 9999,
                    letterSpacing: '0.04em',
                  }}>
                    LIVE
                  </span>
                </button>

                <Link href="/leads" className="btn btn-outline btn-sm" style={{ fontWeight: 600 }}>
                  <Users size={13} /> View Team Leads
                </Link>
              </div>
            </div>

            {/* Segmented Sub-Navigation Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              background: '#F1F5F9',
              padding: 4,
              borderRadius: 10,
              width: 'fit-content',
            }}>
              <button
                type="button"
                onClick={() => setAdminTab('leaderboard')}
                style={{
                  background: adminTab === 'leaderboard' ? '#FFFFFF' : 'transparent',
                  color: adminTab === 'leaderboard' ? '#0F172A' : '#64748B',
                  fontWeight: adminTab === 'leaderboard' ? 700 : 600,
                  fontSize: 12,
                  padding: '7px 14px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  boxShadow: adminTab === 'leaderboard' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Target size={14} color={adminTab === 'leaderboard' ? '#DC2626' : '#64748B'} />
                <span>🎯 Daily 35-Quota Leaderboard</span>
                <span style={{
                  background: adminTab === 'leaderboard' ? '#FEE2E2' : '#E2E8F0',
                  color: adminTab === 'leaderboard' ? '#DC2626' : '#64748B',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 9999,
                }}>
                  {agentHealthStats.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('radar')}
                style={{
                  background: adminTab === 'radar' ? '#FFFFFF' : 'transparent',
                  color: adminTab === 'radar' ? '#0F172A' : '#64748B',
                  fontWeight: adminTab === 'radar' ? 700 : 600,
                  fontSize: 12,
                  padding: '7px 14px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  boxShadow: adminTab === 'radar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <ShieldAlert size={14} color={adminTab === 'radar' ? '#EA580C' : '#64748B'} />
                <span>⚠️ Pipeline Stagnation Radar</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('consistency')}
                style={{
                  background: adminTab === 'consistency' ? '#FFFFFF' : 'transparent',
                  color: adminTab === 'consistency' ? '#0F172A' : '#64748B',
                  fontWeight: adminTab === 'consistency' ? 700 : 600,
                  fontSize: 12,
                  padding: '7px 14px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  boxShadow: adminTab === 'consistency' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Calendar size={14} color={adminTab === 'consistency' ? '#2563EB' : '#64748B'} />
                <span>📊 7-Day Consistency Matrix</span>
              </button>
            </div>

            {/* TAB 1: DAILY 35-QUOTA LEADERBOARD */}
            {adminTab === 'leaderboard' && (
              <div>
                {/* Top Agency Metric Bar */}
                {(() => {
                  const totalTouchesToday = agentHealthStats.reduce((acc, a) => acc + a.doneToday, 0)
                  const totalYesterdayTouches = agentHealthStats.reduce((acc, a) => acc + (a.yesterdayCount ?? 0), 0)
                  const totalTarget = agentHealthStats.length * 35
                  const teamPct = totalTarget > 0 ? Math.round((totalTouchesToday / totalTarget) * 100) : 0
                  const totalMeetingsToday = agentHealthStats.reduce((acc, a) => acc + (a.meetingsBookedToday ?? 0), 0)
                  const sorted = [...agentHealthStats].sort((a, b) => b.doneToday - a.doneToday)
                  const topAgent = sorted[0]

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12,
                      marginBottom: 16,
                    }}>
                      <div className="card" style={{ padding: '14px 18px', background: '#FAFAFA' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Agency Touches Today</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 900, color: '#0F172A' }}>{totalTouchesToday}</span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>/ {totalTarget} target</span>
                        </div>
                        <div style={{ fontSize: 11, color: teamPct >= 70 ? '#15803D' : '#D97706', fontWeight: 600, marginTop: 4 }}>
                          {teamPct}% team quota met today
                        </div>
                      </div>

                      <div className="card" style={{ padding: '14px 18px', background: '#FAFAFA' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Yesterday Comparison</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 900, color: '#334155' }}>{totalYesterdayTouches}</span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>unique leads</span>
                        </div>
                        <div style={{ fontSize: 11, color: totalTouchesToday >= totalYesterdayTouches ? '#15803D' : '#BE123C', fontWeight: 600, marginTop: 4 }}>
                          {totalTouchesToday >= totalYesterdayTouches ? `▲ +${totalTouchesToday - totalYesterdayTouches} ahead of yesterday` : `▼ -${totalYesterdayTouches - totalTouchesToday} behind yesterday`}
                        </div>
                      </div>

                      <div className="card" style={{ padding: '14px 18px', background: '#FAFAFA' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Top Producer Today</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{topAgent ? topAgent.name : 'None'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 700, marginTop: 4 }}>
                          {topAgent ? `${topAgent.doneToday} leads engaged today` : 'No touches yet'}
                        </div>
                      </div>

                      <div className="card" style={{ padding: '14px 18px', background: '#FAFAFA' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Meetings / Visits Booked</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 900, color: '#2563EB' }}>{totalMeetingsToday}</span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>today</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#2563EB', fontWeight: 600, marginTop: 4 }}>
                          Key stage pipeline conversions
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Agent Quota Rows */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: '#FAFAFA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Trophy size={16} color="#D97706" />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                        Floor Ranking &amp; Daily Target Progress (Quota: 35 Unique Leads)
                      </span>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                      Gaming-proof: Real client touches only (calls, notes, meetings, stage moves)
                    </span>
                  </div>

                  <div style={{ padding: '8px 0' }}>
                    {[...agentHealthStats]
                      .sort((a, b) => b.doneToday - a.doneToday)
                      .map((agent, index) => {
                        const target = agent.target || 35
                        const progress = Math.min(100, Math.round((agent.doneToday / target) * 100))
                        const isCrushed = agent.doneToday >= target
                        const isHalfway = agent.doneToday >= 15
                        const yesterdayDiff = agent.doneToday - (agent.yesterdayCount ?? 0)

                        const rankBadge =
                          index === 0
                            ? { emoji: '🥇', label: '#1', color: '#D97706', bg: '#FEF3C7' }
                            : index === 1
                              ? { emoji: '🥈', label: '#2', color: '#475569', bg: '#F1F5F9' }
                              : index === 2
                                ? { emoji: '🥉', label: '#3', color: '#B45309', bg: '#FFEDD5' }
                                : { emoji: '', label: `#${index + 1}`, color: '#94A3B8', bg: '#F8FAFC' }

                        const agentInitial = agent.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)

                        return (
                          <div
                            key={agent.id}
                            style={{
                              padding: '16px 20px',
                              borderBottom: '1px solid #F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 20,
                              flexWrap: 'wrap',
                              background: isCrushed ? '#FAFCFA' : '#FFFFFF',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* Agent Info & Rank */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 220 }}>
                              <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: rankBadge.bg,
                                color: rankBadge.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 12,
                                border: '1px solid rgba(0,0,0,0.06)',
                                flexShrink: 0,
                              }}>
                                {rankBadge.emoji || rankBadge.label}
                              </div>

                              <Link
                                href={`/team/${agent.id}`}
                                style={{ textDecoration: 'none' }}
                                title={`View full profile for ${agent.name}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{agent.name}</span>
                                  <ArrowUpRight size={13} color="#94A3B8" />
                                </div>
                                <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                  <span>{agent.role === 'SALES_MANAGER' ? 'Manager' : 'Agent'}</span>
                                  <span>·</span>
                                  <span>{agent.totalLeads} assigned</span>
                                </div>
                              </Link>
                            </div>

                            {/* Progress Meter */}
                            <div style={{ flex: '1 1 260px', minWidth: 200, maxWidth: 380 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 900, color: isCrushed ? '#15803D' : isHalfway ? '#D97706' : '#DC2626' }}>
                                    {agent.doneToday} / {target} leads
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                                    ({progress}%)
                                  </span>
                                </div>

                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: 9999,
                                  background: isCrushed ? '#DCFCE7' : isHalfway ? '#FEF3C7' : '#FEE2E2',
                                  color: isCrushed ? '#15803D' : isHalfway ? '#B45309' : '#DC2626',
                                  letterSpacing: '0.03em',
                                }}>
                                  {isCrushed ? 'TARGET CRUSHED 🚀' : isHalfway ? 'ON PACE ⚡' : 'BEHIND PACE ⚠️'}
                                </span>
                              </div>

                              <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    background: isCrushed
                                      ? 'linear-gradient(90deg, #10B981, #059669)'
                                      : isHalfway
                                        ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                                        : 'linear-gradient(90deg, #F43F5E, #E11D48)',
                                    borderRadius: 4,
                                    transition: 'width 0.3s ease',
                                  }}
                                />
                              </div>
                            </div>

                            {/* Yesterday Comparison & 7-Day Streak */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                              {/* Yesterday */}
                              <div style={{ textAlign: 'center', minWidth: 85 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Yesterday</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#334155', marginTop: 1 }}>
                                  {agent.yesterdayCount ?? 0} leads
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: yesterdayDiff >= 0 ? '#15803D' : '#BE123C' }}>
                                  {yesterdayDiff >= 0 ? `▲ +${yesterdayDiff}` : `▼ ${yesterdayDiff}`}
                                </div>
                              </div>

                              {/* 7-Day Consistency mini-dots */}
                              <div style={{ textAlign: 'center', minWidth: 110 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  7-Day Target
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
                                  {(agent.history7Days || []).map((h, i) => (
                                    <div
                                      key={i}
                                      title={`${h.dayLabel} (${h.date}): ${h.uniqueLeads} leads contacted`}
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: h.targetMet
                                          ? '#10B981'
                                          : h.uniqueLeads >= 15
                                            ? '#F59E0B'
                                            : h.uniqueLeads > 0
                                              ? '#F43F5E'
                                              : '#CBD5E1',
                                      }}
                                    />
                                  ))}
                                </div>
                                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginTop: 2 }}>
                                  {agent.sevenDayTargetMetCount ?? 0} / 7 days met
                                </div>
                              </div>

                              {/* 7-Day Avg */}
                              <div style={{ textAlign: 'center', minWidth: 80 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>7-Day Avg</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginTop: 1 }}>
                                  {agent.sevenDayAvg ?? 0} <span style={{ fontSize: 10, color: '#94A3B8' }}>/day</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                    {agentHealthStats.length === 0 && (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                        No agent performance records available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PIPELINE STAGNATION RADAR */}
            {adminTab === 'radar' && (
              <div className="rg-2" style={{ alignItems: 'stretch' }}>
                {/* Table 1: Team Accountability Table */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={15} color="var(--accent)" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Agent Workload &amp; Accountability</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{agentHealthStats.length} Sales Agents</span>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, zIndex: 1 }}>
                          <th style={{ padding: '10px 16px' }}>Agent</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Active Leads</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>No Next Action</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Overdue</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }} title="Distinct individual leads engaged, contacted, or advanced today">Unique Leads Today</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentHealthStats.map((agent) => {
                          const idleColor =
                            agent.idleLeads === 0
                              ? { bg: '#DCFCE7', text: '#15803D' }
                              : agent.idleLeads <= 10
                                ? { bg: '#FEF9C3', text: '#A16207' }
                                : agent.idleLeads <= 30
                                  ? { bg: '#FFEDD5', text: '#C2410C' }
                                  : { bg: '#FEE2E2', text: '#B91C1C' }

                          const overdueColor =
                            agent.overdueFollowups === 0
                              ? { bg: '#DCFCE7', text: '#15803D' }
                              : { bg: '#FEE2E2', text: '#DC2626' }

                          const agentInitial = agent.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)

                          return (
                            <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '10px 16px' }}>
                                <Link
                                  href={`/team/${agent.id}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    textDecoration: 'none',
                                  }}
                                  title={`View ${agent.name}'s full profile in Team Directory`}
                                >
                                  <div
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: '#EFF6FF',
                                      color: 'var(--accent)',
                                      fontWeight: 700,
                                      fontSize: 11,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid #BFDBFE',
                                    }}
                                  >
                                    {agentInitial}
                                  </div>
                                  <div>
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        color: '#0F172A',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <span style={{ color: 'var(--accent)' }}>{agent.name}</span>
                                      <ArrowUpRight size={12} style={{ color: '#94A3B8' }} />
                                    </div>
                                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{agent.role === 'SALES_MANAGER' ? 'Manager' : 'Agent'}</div>
                                  </div>
                                </Link>
                              </td>

                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                                {agent.totalLeads}
                              </td>

                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: idleColor.bg, color: idleColor.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                                  {agent.idleLeads > 20 && <Flame size={11} />}
                                  {agent.idleLeads} idle
                                </span>
                              </td>

                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: overdueColor.bg, color: overdueColor.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                                  {agent.overdueFollowups > 0 && <AlertTriangle size={11} />}
                                  {agent.overdueFollowups} overdue
                                </span>
                              </td>

                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: agent.doneToday > 0 ? '#DCFCE7' : '#F8FAFC', color: agent.doneToday > 0 ? '#15803D' : '#94A3B8', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                                  {agent.doneToday > 0 ? `+${agent.doneToday} done` : '0 done'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}

                        {agentHealthStats.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                              No agents found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 2: Pipeline Stage Health Panel */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TrendingDown size={15} color="#EA580C" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Pipeline Bottlenecks &amp; Idle Rates</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>By Stage</span>
                  </div>

                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                    {stageHealthStats.map((stg) => {
                      const isClosed = ['won', 'lost'].includes(stg.key)
                      const statusBadge = isClosed
                        ? { label: 'Closed', bg: '#F1F5F9', color: '#64748B' }
                        : stg.status === 'red'
                          ? { label: 'Rotting', bg: '#FEE2E2', color: '#DC2626' }
                          : stg.status === 'amber'
                            ? { label: 'Attention', bg: '#FEF3C7', color: '#D97706' }
                            : { label: 'Healthy', bg: '#DCFCE7', color: '#16A34A' }

                      return (
                        <div key={stg.id} style={{ padding: '8px 10px', borderRadius: 8, background: stg.status === 'red' && !isClosed ? '#FFF8F8' : '#FAFAFA', border: `1px solid ${stg.status === 'red' && !isClosed ? '#FECACA' : '#F1F5F9'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stg.colorHex }} />
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A' }}>{stg.label}</span>
                          </div>

                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${stg.idlePercent}%`, backgroundColor: stg.status === 'red' ? '#DC2626' : stg.status === 'amber' ? '#D97706' : '#16A34A', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#64748B', width: 65, textAlign: 'right' }}>
                              {stg.totalLeads} leads
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {!isClosed && (
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: stg.status === 'red' ? '#DC2626' : stg.status === 'amber' ? '#D97706' : '#64748B' }}>
                                {stg.idleLeads} idle ({stg.idlePercent}%)
                              </span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: statusBadge.bg, color: statusBadge.color }}>
                              {statusBadge.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: 7-DAY CONSISTENCY MATRIX */}
            {adminTab === 'consistency' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: '#FAFAFA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={16} color="#2563EB" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                      7-Day Daily Outreach History Matrix
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#64748B' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} /> 35+ Target Met
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} /> 15-34 In Progress
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F43F5E' }} /> &lt;15 Low Effort
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <th style={{ padding: '12px 18px', textAlign: 'left', minWidth: 160 }}>Agent</th>
                        {/* Day headers from history of first agent */}
                        {(agentHealthStats[0]?.history7Days || []).map((h, i) => (
                          <th key={i} style={{ padding: '12px 10px', textAlign: 'center', minWidth: 85 }}>
                            <div>{h.dayLabel}</div>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: '#94A3B8', marginTop: 1 }}>{h.date.slice(5)}</div>
                          </th>
                        ))}
                        <th style={{ padding: '12px 12px', textAlign: 'center', minWidth: 95 }}>7-Day Avg</th>
                        <th style={{ padding: '12px 12px', textAlign: 'center', minWidth: 110 }}>Hit Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentHealthStats.map((agent) => {
                        const hitPct = Math.round(((agent.sevenDayTargetMetCount ?? 0) / 7) * 100)

                        return (
                          <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px 18px' }}>
                              <Link
                                href={`/team/${agent.id}`}
                                style={{ fontWeight: 700, color: '#0F172A', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                              >
                                <span>{agent.name}</span>
                                <ArrowUpRight size={11} color="#94A3B8" />
                              </Link>
                              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
                                {agent.role === 'SALES_MANAGER' ? 'Manager' : 'Agent'}
                              </div>
                            </td>

                            {(agent.history7Days || []).map((h, i) => {
                              const isGreen = h.uniqueLeads >= 35
                              const isAmber = h.uniqueLeads >= 15 && h.uniqueLeads < 35
                              const isRed = h.uniqueLeads > 0 && h.uniqueLeads < 15
                              const isZero = h.uniqueLeads === 0

                              return (
                                <td key={i} style={{ padding: '10px 8px', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 3,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    minWidth: 42,
                                    background: isGreen
                                      ? '#DCFCE7'
                                      : isAmber
                                        ? '#FEF3C7'
                                        : isRed
                                          ? '#FEE2E2'
                                          : '#F1F5F9',
                                    color: isGreen
                                      ? '#15803D'
                                      : isAmber
                                        ? '#B45309'
                                        : isRed
                                          ? '#DC2626'
                                          : '#94A3B8',
                                  }}>
                                    {isGreen && <Check size={11} />}
                                    {h.uniqueLeads}
                                  </span>
                                </td>
                              )
                            })}

                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>
                              {agent.sevenDayAvg ?? 0}
                            </td>

                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 9999,
                                background: hitPct >= 70 ? '#DCFCE7' : hitPct >= 40 ? '#FEF3C7' : '#FEE2E2',
                                color: hitPct >= 70 ? '#15803D' : hitPct >= 40 ? '#B45309' : '#DC2626',
                              }}>
                                {agent.sevenDayTargetMetCount ?? 0}/7 days ({hitPct}%)
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -- METRIC SUMMARY CARDS --------------------------------------- */}
        <div className="rg-4 mb-6">
          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total Leads</span>
              <span style={{ padding: 6, borderRadius: 6, background: '#EFF6FF', color: 'var(--accent)' }}><Users size={16} /></span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{totalLeads}</div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
              {profile.role === 'SALES_MANAGER' ? `All Team: ${totalLeads} · Yours: ${myAllLeads.length}` : 'Active in sales pipeline'}
            </span>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Won Leads</span>
              <span style={{ padding: 6, borderRadius: 6, background: 'var(--success-light)', color: 'var(--success)' }}><Trophy size={16} /></span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>{wonCount}</div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>Closed property sales</span>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Conversion Rate</span>
              <span style={{ padding: 6, borderRadius: 6, background: '#FEF3C7', color: '#D97706' }}><SaudiRiyalIcon size={16} /></span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706' }}>{conversionRate}%</div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>Lead-to-deal conversion</span>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Pending Follow-ups</span>
              <span style={{ padding: 6, borderRadius: 6, background: 'var(--info-light)', color: 'var(--info)' }}><Clock size={16} /></span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--info)' }}>{followups.length}</div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>Scheduled agent calls</span>
          </div>
        </div>

        {/* -- FUNNEL + SOURCES ------------------------------------------- */}
        <div className="rg-2 mb-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Funnel Overview</h3>
              <Link href="/leads" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>View all leads &rarr;</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stages.map((stage) => {
                const count = stageCounts[stage.id] ?? 0
                const percent = (count / maxStageCount) * 100
                return (
                  <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 100, fontSize: 13, fontWeight: 500, color: '#0F172A', flexShrink: 0 }}>{stage.label}</div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stage.color_hex || '#3B82F6', flexShrink: 0 }} />
                    <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: count > 0 ? `${Math.max(percent, 3)}%` : '0%', backgroundColor: stage.color_hex || '#3B82F6', borderRadius: 4, transition: 'width 0.3s ease' }} />
                    </div>
                    <div style={{ width: 32, textAlign: 'right', fontSize: 13, fontWeight: 700, color: count > 0 ? '#0F172A' : '#94A3B8' }}>{count}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Lead Sources</h3>
              <span className="text-meta">{totalLeads} total</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Object.keys(SOURCE_LABELS).map((sourceKey) => {
                const count = sourceCounts[sourceKey] ?? 0
                const percent = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                if (count === 0 && sourceKey !== 'MANUAL' && sourceKey !== 'META_ADS') return null
                return (
                  <div key={sourceKey} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 110, fontSize: 13, fontWeight: 500, color: '#0F172A', flexShrink: 0 }}>{SOURCE_LABELS[sourceKey] || sourceKey}</div>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, backgroundColor: 'var(--accent)', borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 32, textAlign: 'right', fontSize: 13, fontWeight: 700, color: count > 0 ? '#0F172A' : '#94A3B8' }}>{count}</div>
                  </div>
                )
              })}
              {totalLeads === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>No lead sources recorded yet.</div>}
            </div>
          </div>
        </div>

        {/* -- RECENT LEADS + SCHEDULED FOLLOW-UPS ----------------------- */}
        <div className="rg-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Recent Leads</h3>
              <Link href="/leads" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>View all &rarr;</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
              {recentLeads.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', textDecoration: 'none', backgroundColor: '#FFFFFF', transition: 'background 0.15s ease' }}
                  className="hover:bg-slate-50">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{lead.name || 'Unnamed'}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', display: 'flex', gap: 8, marginTop: 2 }}>
                      <span>{lead.phone || 'No phone'}</span>
                      {(lead.property?.name_en || lead.interest) && <span style={{ color: '#D97706' }}>· {lead.property?.name_en || lead.interest}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge" style={{ backgroundColor: `${lead.stage?.color_hex || '#3B82F6'}15`, color: lead.stage?.color_hex || '#3B82F6', border: `1px solid ${lead.stage?.color_hex || '#3B82F6'}30` }}>
                      {lead.stage?.label}
                    </span>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{formatTimeAgo(lead.created_at)}</div>
                  </div>
                </Link>
              ))}
              {recentLeads.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>No leads registered yet.</div>}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Scheduled Follow-ups</h3>
              <span className="badge" style={{ background: '#EFF6FF', color: 'var(--accent)' }}>{followups.length} pending</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
              {followups.map((f) => {
                const leadId = f.lead_id || f.lead?.id
                const scheduledDate = new Date(f.scheduled_at)
                const isOverdue = scheduledDate.getTime() < Date.now()
                const isDifferentYear = scheduledDate.getFullYear() !== new Date().getFullYear()
                const formattedDate = scheduledDate.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  ...(isDifferentYear ? { year: 'numeric' } : {}),
                  hour: '2-digit',
                  minute: '2-digit'
                })

                return (
                  <Link key={f.id} href={leadId ? `/leads/${leadId}` : '/leads'}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 6, border: `1px solid ${isOverdue ? '#FECACA' : 'var(--border)'}`, background: isOverdue ? '#FFF5F5' : '#FAFAFA', textDecoration: 'none', transition: 'all 0.15s ease', cursor: 'pointer' }}
                    className="hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{f.note || 'Follow-up call'}</span>
                        {isOverdue && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626' }}>
                            Overdue
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                        Lead: <strong style={{ color: 'var(--accent)' }}>{f.lead?.name || 'Lead'}</strong> · {f.lead?.phone || 'No phone'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: isOverdue ? '#DC2626' : 'var(--info)' }}>
                        {formattedDate}
                      </span>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>View lead &rarr;</div>
                    </div>
                  </Link>
                )
              })}
              {followups.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>No pending follow-ups.</div>}
            </div>
          </div>
        </div>

        {/* -- TODAY'S SCHEDULED MEETINGS & SITE VISITS ------------------ */}
        <div style={{ marginTop: 24 }}>
          <div className="card" style={{ padding: '20px 24px', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            
            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 18, borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 3px 12px rgba(79, 70, 229, 0.3)',
                  flexShrink: 0,
                }}>
                  <CalendarCheck size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                      Today&apos;s Scheduled Meetings &amp; Site Visits
                    </h2>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 9999, letterSpacing: '0.04em', background: isManagerOrAdmin ? '#EEF2FF' : '#ECFDF5', color: isManagerOrAdmin ? '#4F46E5' : '#059669' }}>
                      {isManagerOrAdmin ? '👑 ALL TEAM APPOINTMENTS' : '👤 YOUR CONNECTED LEADS'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#64748B', marginTop: 4, marginBottom: 0 }}>
                    {isManagerOrAdmin
                      ? 'Executive daily agenda of all property site visits and client meetings scheduled across all sales agents today.'
                      : 'Your scheduled client meetings, presentations, and property site visits for today.'}
                  </p>
                </div>
              </div>

              {/* Counters / Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                }}>
                  <span>📅</span>
                  <span>{todayMeetings.length} Total Today</span>
                </div>

                {todayMeetings.length > 0 && (
                  <>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#4338CA',
                    }}>
                      <span>🏡</span>
                      <span>{todayMeetings.filter((m) => m.type === 'SITE_VISIT').length} Site Visits</span>
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#047857',
                    }}>
                      <span>🤝</span>
                      <span>{todayMeetings.filter((m) => m.type === 'MEETING').length} Office Meetings</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Content List */}
            {todayMeetings.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#FAFAFA',
                borderRadius: 10,
                border: '1px dashed #E2E8F0',
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  background: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  <CalendarClock size={24} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                  No meetings or site visits scheduled for today
                </div>
                <p style={{ fontSize: 12.5, color: '#64748B', maxWidth: 460, margin: '6px auto 14px' }}>
                  {isManagerOrAdmin
                    ? 'None of the agents currently have client meetings or property site visits booked for today.'
                    : 'You have no meetings or site visits scheduled on your leads for today.'}
                </p>
                <Link
                  href="/leads"
                  className="btn btn-outline btn-sm"
                  style={{ fontWeight: 600, fontSize: 12 }}
                >
                  <Users size={13} /> View Active Pipeline &amp; Leads
                </Link>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: 14,
              }}>
                {todayMeetings.map((item) => {
                  const isSiteVisit = item.type === 'SITE_VISIT'
                  const whatsappUrl = getWhatsAppUrl(item.leadPhone)
                  const formattedTime = formatMeetingTime(item.time, item.meetingDate, item.scheduledAtIso)

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isSiteVisit ? '#FAFAFF' : '#FAFCFA',
                        border: `1px solid ${isSiteVisit ? '#E0E7FF' : '#DCFCE7'}`,
                        borderRadius: 10,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      {/* Top Bar: Time & Type Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          padding: '4px 9px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#0F172A',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}>
                          <Clock size={13} style={{ color: isSiteVisit ? '#4F46E5' : '#059669' }} />
                          <span>{formattedTime}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: isSiteVisit ? '#EEF2FF' : '#ECFDF5',
                            color: isSiteVisit ? '#4338CA' : '#047857',
                            border: `1px solid ${isSiteVisit ? '#C7D2FE' : '#A7F3D0'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <span>{isSiteVisit ? '🏡' : '🤝'}</span>
                            <span>{item.typeLabel}</span>
                          </span>

                          {item.stageLabel && (
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 6,
                              background: '#FFFFFF',
                              color: item.stageColor || '#64748B',
                              border: `1px solid ${item.stageColor || '#E2E8F0'}40`,
                            }}>
                              {item.stageLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lead Details */}
                      <div>
                        <Link
                          href={`/leads/${item.leadId}`}
                          style={{
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#0F172A',
                          }}
                        >
                          <span style={{ fontSize: 14.5, fontWeight: 800 }}>
                            {item.leadName}
                          </span>
                          <ArrowUpRight size={13} style={{ color: 'var(--accent)' }} />
                        </Link>

                        {/* Phone & Quick Contact Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                            {item.leadPhone || 'No phone provided'}
                          </span>

                          {item.leadPhone && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <a
                                href={`tel:${item.leadPhone}`}
                                title={`Call ${item.leadName}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: '#EFF6FF',
                                  color: '#2563EB',
                                  border: '1px solid #BFDBFE',
                                  textDecoration: 'none',
                                }}
                              >
                                <PhoneCall size={12} />
                              </a>

                              {whatsappUrl && (
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`WhatsApp ${item.leadName}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    background: '#DCFCE7',
                                    color: '#15803D',
                                    border: '1px solid #86EFAC',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <MessageSquare size={12} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Project / Interest (if any) */}
                        {item.projectName && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            marginTop: 6,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#F1F5F9',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: '#334155',
                          }}>
                            <Building2 size={12} style={{ color: '#64748B' }} />
                            <span>{item.projectName}</span>
                          </div>
                        )}

                        {/* Note (if any) */}
                        {item.note && (
                          <div style={{
                            marginTop: 6,
                            fontSize: 11.5,
                            color: '#64748B',
                            fontStyle: 'italic',
                            background: 'rgba(255,255,255,0.7)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            borderLeft: '2px solid #CBD5E1',
                          }}>
                            &ldquo;{item.note}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Footer: Agent info & View Lead */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px solid rgba(0,0,0,0.05)',
                        marginTop: 4,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                            {isManagerOrAdmin ? 'Agent:' : 'Assigned:'}
                          </span>
                          {isManagerOrAdmin && item.agentId ? (
                            <Link
                              href={`/team/${item.agentId}`}
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: 'var(--accent)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <span>{item.agentName}</span>
                              <ArrowUpRight size={10} />
                            </Link>
                          ) : (
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                              {item.agentName || 'You'}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/leads/${item.leadId}`}
                          className="btn btn-outline btn-sm"
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            height: 'auto',
                            fontWeight: 700,
                          }}
                        >
                          View Lead &rarr;
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {showTVModal && (
        <SalesFloorTVModal
          isOpen={showTVModal}
          onClose={() => setShowTVModal(false)}
          agentStats={agentHealthStats}
          totalLeadsCount={totalLeads}
          onRefresh={() => {
            setTimeout(() => {
              router.refresh()
            }, 0)
          }}
        />
      )}
    </div>
  )
}
