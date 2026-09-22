'use client'

import React, { useState, useEffect } from 'react'
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

  // Live Clock (Riyadh / Local)
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

  // Auto-refresh timer every 30s
  useEffect(() => {
    if (!isOpen) return
    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          if (onRefresh) onRefresh()
          return 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
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

  if (!isOpen) return null

  // Sort agents by today's performance descending
  const sortedAgents = [...agentStats].sort((a, b) => b.doneToday - a.doneToday)

  // Aggregates
  const totalDoneToday = agentStats.reduce((acc, a) => acc + a.doneToday, 0)
  const agentsMeetingTarget = agentStats.filter((a) => a.doneToday >= (a.target || 35)).length
  const totalIdleLeads = agentStats.reduce((acc, a) => acc + a.idleLeads, 0)
  const totalOverdue = agentStats.reduce((acc, a) => acc + a.overdueFollowups, 0)
  const totalMeetingsToday = agentStats.reduce((acc, a) => acc + (a.meetingsBookedToday || 0), 0)

  const attainmentRate = agentStats.length > 0 ? Math.round((agentsMeetingTarget / agentStats.length) * 100) : 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#090D16',
        color: '#F8FAFC',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top TV Bar */}
      <div
        style={{
          padding: '16px 32px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: '#F87171',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                boxShadow: '0 0 10px #EF4444',
                display: 'inline-block',
                animation: 'pulse 1.5s infinite',
              }}
            />
            LIVE SALES FLOOR BROADCAST
          </div>

          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: '#FFFFFF' }}>
              Asaheeb Sales Pace &amp; Quota Command Center
            </h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>
              Target: <strong style={{ color: '#38BDF8' }}>35 Unique Clients Engaged / Shift</strong> • Live Performance Radar
            </p>
          </div>
        </div>

        {/* Live Clock & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 10,
              padding: '8px 16px',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Local Time
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#38BDF8', letterSpacing: '0.02em', fontFamily: 'monospace' }}>
              {time || '--:--:--'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                if (onRefresh) onRefresh()
                setSecondsUntilRefresh(30)
              }}
              title="Refresh Data Now"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#CBD5E1',
                padding: '9px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <RefreshCw size={14} />
              <span>{secondsUntilRefresh}s</span>
            </button>

            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#CBD5E1',
                padding: '9px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            <button
              onClick={onClose}
              title="Close Broadcast Mode (Esc)"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#FCA5A5',
                padding: '9px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <X size={15} />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {/* Card 1: Team Quota Progress */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8' }}>
                Team Quota Attainment
              </span>
              <Target size={18} color="#38BDF8" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#38BDF8', lineHeight: 1 }}>
                {attainmentRate}%
              </span>
              <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 600 }}>
                ({agentsMeetingTarget} of {agentStats.length} agents on target)
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${attainmentRate}%`, height: '100%', background: '#38BDF8', borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* Card 2: Agency Unique Touches Today */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8' }}>
                Total Unique Clients Reached
              </span>
              <Users size={18} color="#10B981" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#10B981', lineHeight: 1 }}>
                {totalDoneToday}
              </span>
              <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 600 }}>
                Unique Leads Engaged Today
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#6EE7B7', marginTop: 10 }}>
              🎯 Target Pace: {agentStats.length * 35} total client touches
            </div>
          </div>

          {/* Card 3: Meetings & Visits Booked Today */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8' }}>
                Meetings &amp; Visits Booked
              </span>
              <Calendar size={18} color="#C084FC" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#C084FC', lineHeight: 1 }}>
                {totalMeetingsToday}
              </span>
              <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 600 }}>
                Scheduled Today
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#E9D5FF', marginTop: 10 }}>
              High-intent conversions into site visits
            </div>
          </div>

          {/* Card 4: Stagnation Risk / Neglected Capital */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8' }}>
                Pipeline Drop-off Risk
              </span>
              <Flame size={18} color="#EF4444" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#EF4444', lineHeight: 1 }}>
                {totalIdleLeads}
              </span>
              <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 600 }}>
                Neglected Leads ({totalOverdue} overdue)
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#FCA5A5', marginTop: 10 }}>
              ⚠️ Immediate action required to stop client churn
            </div>
          </div>
        </div>

        {/* Live Agent Performance Board */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trophy size={20} color="#FBBF24" />
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                Daily Agent Performance &amp; Consistency Leaderboard
              </h2>
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>
              Target: <strong style={{ color: '#F8FAFC' }}>35 Distinct Leads Worked / Day</strong>
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
                  ? { label: '🥇 1ST PLACE', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' }
                  : index === 1
                    ? { label: '🥈 2ND PLACE', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)' }
                    : index === 2
                      ? { label: '🥉 3RD PLACE', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)', border: 'rgba(217, 119, 6, 0.4)' }
                      : null

              const statusBadge = isMet
                ? { label: 'TARGET CRUSHED 🚀', color: '#10B981', bg: 'rgba(16, 185, 129, 0.2)' }
                : isClose
                  ? { label: 'ON PACE ⚡', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)' }
                  : { label: 'BEHIND PACE ⚠️', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.2)' }

              return (
                <div
                  key={agent.id}
                  style={{
                    background: isMet
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(30, 41, 59, 0.7) 100%)'
                      : 'rgba(30, 41, 59, 0.5)',
                    border: `1.5px solid ${isMet ? 'rgba(16, 185, 129, 0.4)' : index === 0 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: 14,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    boxShadow: index === 0 ? '0 0 20px rgba(245, 158, 11, 0.1)' : 'none',
                  }}
                >
                  {/* Header: Agent info & Rank */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF' }}>
                          {agent.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                          ({agent.role === 'SALES_MANAGER' ? 'Manager' : 'Agent'})
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
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
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: statusBadge.bg,
                          color: statusBadge.color,
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
                        <span style={{ fontSize: 38, fontWeight: 900, color: isMet ? '#10B981' : isClose ? '#F59E0B' : '#FFFFFF', lineHeight: 1 }}>
                          {done}
                        </span>
                        <span style={{ fontSize: 16, color: '#94A3B8', fontWeight: 700 }}>
                          / {target}
                        </span>
                        <span style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 600, marginLeft: 4 }}>
                          leads touched
                        </span>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: isMet ? '#10B981' : isClose ? '#F59E0B' : '#94A3B8' }}>
                        {percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 8, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 6, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: isMet ? 'linear-gradient(90deg, #10B981, #34D399)' : isClose ? '#F59E0B' : '#EF4444',
                          borderRadius: 6,
                          transition: 'width 0.5s ease',
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
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ color: '#94A3B8', fontSize: 11 }}>Yesterday</div>
                      <div style={{ fontWeight: 700, color: '#E2E8F0', marginTop: 2 }}>
                        {agent.yesterdayCount !== undefined ? `${agent.yesterdayCount} leads` : '—'}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#94A3B8', fontSize: 11 }}>7-Day Streak Met</div>
                      <div style={{ fontWeight: 700, color: agent.sevenDayTargetMetCount && agent.sevenDayTargetMetCount >= 5 ? '#10B981' : '#F59E0B', marginTop: 2 }}>
                        {agent.sevenDayTargetMetCount !== undefined ? `${agent.sevenDayTargetMetCount} of 7 days` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* 7-Day Mini Trend Dots */}
                  {agent.history7Days && agent.history7Days.length > 0 && (
                    <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 10.5, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          7-Day Consistency Trend
                        </span>
                        <span style={{ fontSize: 10.5, color: '#64748B' }}>
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
                              background: 'rgba(255, 255, 255, 0.04)',
                              borderRadius: 6,
                              padding: '4px 2px',
                            }}
                          >
                            <span style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600 }}>
                              {day.dayLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: day.targetMet ? '#10B981' : day.uniqueLeads >= 20 ? '#F59E0B' : '#EF4444',
                              }}
                            >
                              {day.uniqueLeads}
                            </span>
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: day.targetMet ? '#10B981' : '#EF4444',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accountability Warnings */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                    <span
                      style={{
                        color: agent.idleLeads > 20 ? '#F87171' : '#94A3B8',
                        fontWeight: agent.idleLeads > 20 ? 700 : 500,
                      }}
                    >
                      {agent.idleLeads > 0 ? `⚠️ ${agent.idleLeads} neglected leads` : '✓ 0 neglected leads'}
                    </span>

                    <span
                      style={{
                        color: agent.overdueFollowups > 0 ? '#EF4444' : '#10B981',
                        fontWeight: 700,
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
