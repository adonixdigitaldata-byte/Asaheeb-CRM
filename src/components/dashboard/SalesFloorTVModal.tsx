'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Trophy,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { AgentHealthStat } from '@/app/(crm)/dashboard/DashboardClient'

interface Props {
  isOpen: boolean
  onClose: () => void
  agentStats: AgentHealthStat[]
  totalLeadsCount: number
  onRefresh?: () => void
}

export default function SalesFloorTVModal({
  isOpen,
  onClose,
  agentStats,
  totalLeadsCount,
  onRefresh,
}: Props) {
  const [time, setTime] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Live Clock (Local / Riyadh)
  useEffect(() => {
    if (!isOpen) return
    const updateTime = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [isOpen])

  // Countdown timer for display
  useEffect(() => {
    if (!isOpen) return
    const countdown = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? 30 : prev - 1))
    }, 1000)
    return () => clearInterval(countdown)
  }, [isOpen])

  // Safe auto-refresh trigger outside state updaters
  useEffect(() => {
    if (!isOpen || !onRefresh) return
    const refreshTimer = setInterval(() => {
      setIsRefreshing(true)
      onRefresh()
      setTimeout(() => setIsRefreshing(false), 800)
    }, 30000)
    return () => clearInterval(refreshTimer)
  }, [isOpen, onRefresh])

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    if (onRefresh) onRefresh()
    setSecondsUntilRefresh(30)
    setTimeout(() => setIsRefreshing(false), 800)
  }

  if (!isOpen) return null

  // Sort agents by today's performance descending
  const sortedAgents = [...agentStats].sort((a, b) => b.doneToday - a.doneToday)

  // Aggregates
  const totalDoneToday = agentStats.reduce((acc, a) => acc + a.doneToday, 0)
  const agentsMeetingTarget = agentStats.filter((a) => a.doneToday >= (a.target || 35)).length
  const totalIdleLeads = agentStats.reduce((acc, a) => acc + a.idleLeads, 0)
  const totalOverdue = agentStats.reduce((acc, a) => acc + a.overdueFollowups, 0)
  const totalMeetingsToday = agentStats.reduce((acc, a) => acc + (a.meetingsBookedToday || 0), 0)
  const topAgent = sortedAgents[0]

  const attainmentRate =
    agentStats.length > 0 ? Math.round((agentsMeetingTarget / agentStats.length) * 100) : 0

  // Ticker items for animated broadcast ribbon
  const tickerItems = [
    { icon: '🏆', label: '1ST PLACE AGENT', val: topAgent ? `${topAgent.name} (${topAgent.doneToday} touches)` : '—' },
    { icon: '⚡', label: 'FLOOR ATTAINMENT', val: `${attainmentRate}% on target` },
    { icon: '👥', label: 'UNIQUE CLIENTS TODAY', val: `${totalDoneToday} engaged` },
    { icon: '📅', label: 'MEETINGS & VISITS', val: `${totalMeetingsToday} booked today` },
    { icon: '🎯', label: 'DAILY QUOTA', val: '35 unique clients per agent' },
    { icon: '🚨', label: 'OVERDUE CALLS', val: `${totalOverdue} calls pending` },
    { icon: '🛡️', label: 'NEGLECTED LEADS', val: `${totalIdleLeads} idle across floor` },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes tvPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.15); }
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sales-ticker-content {
          display: flex;
          align-items: center;
          gap: 32px;
          white-space: nowrap;
          animation: tickerScroll 38s linear infinite;
        }
        .sales-ticker-content:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Top TV Bar */}
      <div
        style={{
          padding: '14px 28px',
          borderBottom: '1px solid #E2E8F0',
          background: '#FFFFFF',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Live broadcast pill with pulsing indicator */}
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              background: '#FEF2F2',
              border: '1.5px solid #FECACA',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: '#DC2626',
              textTransform: 'uppercase',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)',
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: '#DC2626',
                boxShadow: '0 0 8px #DC2626',
                display: 'inline-block',
                animation: 'tvPulse 1.8s infinite',
              }}
            />
            LIVE SALES BROADCAST
          </div>

          <div>
            <h1
              style={{
                fontSize: 21,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                margin: 0,
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Asaheeb Sales Pace &amp; Quota Command Center
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid #BFDBFE',
                }}
              >
                HD TV MODE
              </span>
            </h1>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 0' }}>
              Target: <strong style={{ color: '#0284C7' }}>35 Unique Clients Engaged / Shift</strong> • Live Performance Radar
            </p>
          </div>
        </div>

        {/* Live Clock & Quick Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Local Riyadh / Office Clock */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              padding: '6px 14px',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Local Time
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', letterSpacing: '0.02em', fontFamily: 'monospace' }}>
              {time || '--:--:--'}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleManualRefresh}
              title="Refresh Data Now"
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#334155',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw
                size={14}
                style={{
                  animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
                  color: isRefreshing ? '#0284C7' : '#64748B',
                }}
              />
              <span>{secondsUntilRefresh}s</span>
            </button>

            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#334155',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            </button>

            <button
              onClick={onClose}
              title="Close Broadcast Mode (Esc)"
              style={{
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                transition: 'all 0.15s ease',
              }}
            >
              <X size={15} />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Animated Live Ticker Marquee Ribbon */}
      <div
        style={{
          background: 'linear-gradient(90deg, #0F172A 0%, #1E293B 100%)',
          borderBottom: '1px solid #334155',
          padding: '8px 0',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Sticky Ticker Title Badge */}
        <div
          style={{
            zIndex: 10,
            background: 'linear-gradient(90deg, #0284C7, #0369A1)',
            color: '#FFFFFF',
            padding: '4px 14px',
            marginRight: 12,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: '0 6px 6px 0',
            boxShadow: '4px 0 12px rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}
        >
          <Zap size={13} fill="#FFFFFF" />
          <span>RADAR TICKER</span>
        </div>

        {/* Continuous Scrolling Content */}
        <div className="sales-ticker-content">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#E2E8F0',
                padding: '0 8px',
              }}
            >
              <span style={{ fontSize: 13 }}>{item.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.04em' }}>
                {item.label}:
              </span>
              <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{item.val}</span>
              <span style={{ color: '#475569', margin: '0 12px', fontSize: 12 }}>•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          flex: 1,
          animation: 'cardFadeIn 0.3s ease-out',
        }}
      >
        {/* Top KPI Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {/* Card 1: Team Quota Progress */}
          <div
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
              border: '1.5px solid #BAE6FD',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#0369A1',
                }}
              >
                Team Quota Attainment
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#E0F2FE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Target size={18} color="#0284C7" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#0284C7', lineHeight: 1 }}>
                {attainmentRate}%
              </span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>
                ({agentsMeetingTarget} of {agentStats.length} agents on target)
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 7,
                background: '#E2E8F0',
                borderRadius: 4,
                marginTop: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${attainmentRate}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0284C7, #38BDF8)',
                  borderRadius: 4,
                  transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>

          {/* Card 2: Agency Unique Touches Today */}
          <div
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)',
              border: '1.5px solid #BBF7D0',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#15803D',
                }}
              >
                Total Unique Clients Reached
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={18} color="#16A34A" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#16A34A', lineHeight: 1 }}>
                {totalDoneToday}
              </span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>
                Unique Leads Engaged Today
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#15803D', fontWeight: 600, marginTop: 10 }}>
              🎯 Target Pace: {agentStats.length * 35} total client touches
            </div>
          </div>

          {/* Card 3: Meetings & Visits Booked Today */}
          <div
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FAF5FF 100%)',
              border: '1.5px solid #E9D5FF',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(168, 85, 247, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#7E22CE',
                }}
              >
                Meetings &amp; Visits Booked
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#F3E8FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={18} color="#9333EA" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#9333EA', lineHeight: 1 }}>
                {totalMeetingsToday}
              </span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>
                Scheduled Today
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#7E22CE', fontWeight: 600, marginTop: 10 }}>
              High-intent conversions into site visits
            </div>
          </div>

          {/* Card 4: Stagnation Risk / Neglected Capital */}
          <div
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF1F2 100%)',
              border: '1.5px solid #FECDD3',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(244, 63, 94, 0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#BE123C',
                }}
              >
                Pipeline Drop-off Risk
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#FFE4E6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Flame size={18} color="#E11D48" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#E11D48', lineHeight: 1 }}>
                {totalIdleLeads}
              </span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>
                Neglected Leads ({totalOverdue} overdue)
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#BE123C', fontWeight: 600, marginTop: 10 }}>
              ⚠️ Immediate action required to stop client churn
            </div>
          </div>
        </div>

        {/* Live Agent Performance Board */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trophy size={22} color="#D97706" />
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Daily Agent Performance &amp; Consistency Leaderboard
              </h2>
            </div>
            <span style={{ fontSize: 12.5, color: '#64748B', fontWeight: 500 }}>
              Target: <strong style={{ color: '#0F172A' }}>35 Distinct Leads Worked / Day</strong>
            </span>
          </div>

          {/* Agent Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {sortedAgents.map((agent, index) => {
              const target = agent.target || 35
              const done = agent.doneToday
              const percent = Math.min(100, Math.round((done / target) * 100))
              const isMet = done >= target
              const isClose = done >= 20 && !isMet

              const rankBadge =
                index === 0
                  ? { label: '🥇 1ST PLACE', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' }
                  : index === 1
                    ? { label: '🥈 2ND PLACE', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' }
                    : index === 2
                      ? { label: '🥉 3RD PLACE', color: '#92400E', bg: '#FFEDD5', border: '#FDBA74' }
                      : null

              const statusBadge = isMet
                ? { label: 'TARGET CRUSHED 🚀', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' }
                : isClose
                  ? { label: 'ON PACE ⚡', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' }
                  : { label: 'BEHIND PACE ⚠️', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' }

              return (
                <div
                  key={agent.id}
                  style={{
                    background: isMet
                      ? 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)'
                      : index === 0
                        ? 'linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%)'
                        : '#FFFFFF',
                    border: `1.5px solid ${isMet ? '#86EFAC' : index === 0 ? '#FCD34D' : '#E2E8F0'}`,
                    borderRadius: 14,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    boxShadow: index === 0 ? '0 6px 20px rgba(245, 158, 11, 0.12)' : '0 2px 10px rgba(0, 0, 0, 0.02)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Subtle top indicator bar for podium */}
                  {index < 3 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background:
                          index === 0
                            ? 'linear-gradient(90deg, #F59E0B, #FCD34D)'
                            : index === 1
                              ? 'linear-gradient(90deg, #94A3B8, #E2E8F0)'
                              : 'linear-gradient(90deg, #D97706, #FED7AA)',
                      }}
                    />
                  )}

                  {/* Header: Agent info & Rank */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                          {agent.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                          ({agent.role === 'SALES_MANAGER' ? 'Manager' : 'Agent'})
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 3, fontWeight: 500 }}>
                        {agent.totalLeads} active leads assigned
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {rankBadge && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: rankBadge.bg,
                            color: rankBadge.color,
                            border: `1px solid ${rankBadge.border}`,
                          }}
                        >
                          {rankBadge.label}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: statusBadge.bg,
                          color: statusBadge.color,
                          border: `1px solid ${statusBadge.border}`,
                        }}
                      >
                        {statusBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Big Number Progress */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 38,
                            fontWeight: 900,
                            color: isMet ? '#15803D' : isClose ? '#B45309' : '#0F172A',
                            lineHeight: 1,
                          }}
                        >
                          {done}
                        </span>
                        <span style={{ fontSize: 16, color: '#64748B', fontWeight: 700 }}>
                          / {target}
                        </span>
                        <span style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginLeft: 4 }}>
                          leads touched
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          color: isMet ? '#15803D' : isClose ? '#B45309' : '#64748B',
                        }}
                      >
                        {percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 8, background: '#E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: isMet
                            ? 'linear-gradient(90deg, #16A34A, #4ADE80)'
                            : isClose
                              ? 'linear-gradient(90deg, #F59E0B, #FCD34D)'
                              : 'linear-gradient(90deg, #EF4444, #F87171)',
                          borderRadius: 6,
                          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Metrics Footer & 7-Day Consistency History */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      paddingTop: 10,
                      borderTop: '1px solid #F1F5F9',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ color: '#64748B', fontSize: 11, fontWeight: 500 }}>Yesterday</div>
                      <div style={{ fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                        {agent.yesterdayCount !== undefined ? `${agent.yesterdayCount} leads` : '—'}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#64748B', fontSize: 11, fontWeight: 500 }}>7-Day Streak Met</div>
                      <div
                        style={{
                          fontWeight: 800,
                          color:
                            agent.sevenDayTargetMetCount && agent.sevenDayTargetMetCount >= 5
                              ? '#15803D'
                              : '#B45309',
                          marginTop: 2,
                        }}
                      >
                        {agent.sevenDayTargetMetCount !== undefined ? `${agent.sevenDayTargetMetCount} of 7 days` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* 7-Day Mini Trend Dots */}
                  {agent.history7Days && agent.history7Days.length > 0 && (
                    <div style={{ paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 10.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                          7-Day Consistency Trend
                        </span>
                        <span style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600 }}>
                          Avg: {agent.sevenDayAvg || 0}/day
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                        {agent.history7Days.map((day, dIdx) => (
                          <div
                            key={dIdx}
                            title={`${day.dayLabel} (${day.date}): ${day.uniqueLeads} unique leads (${day.targetMet ? 'Met Target' : 'Below Target'})`}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 4,
                              background: '#F8FAFC',
                              border: '1px solid #F1F5F9',
                              borderRadius: 6,
                              padding: '5px 2px',
                            }}
                          >
                            <span style={{ fontSize: 9.5, color: '#64748B', fontWeight: 700 }}>
                              {day.dayLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                color: day.targetMet ? '#15803D' : day.uniqueLeads >= 20 ? '#B45309' : '#DC2626',
                              }}
                            >
                              {day.uniqueLeads}
                            </span>
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: day.targetMet ? '#16A34A' : '#EF4444',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accountability Warnings */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      paddingTop: 6,
                    }}
                  >
                    <span
                      style={{
                        color: agent.idleLeads > 20 ? '#DC2626' : '#64748B',
                        fontWeight: agent.idleLeads > 20 ? 800 : 500,
                      }}
                    >
                      {agent.idleLeads > 0 ? `⚠️ ${agent.idleLeads} neglected leads` : '✓ 0 neglected leads'}
                    </span>

                    <span
                      style={{
                        color: agent.overdueFollowups > 0 ? '#DC2626' : '#15803D',
                        fontWeight: 800,
                      }}
                    >
                      {agent.overdueFollowups > 0 ? `🚨 ${agent.overdueFollowups} overdue calls` : '✓ 0 overdue'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
