'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
  Building,
} from 'lucide-react'
import type { LeadStage } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { checkFollowupConflict, type ScheduleConflict } from '@/lib/followupConflictService'

export interface StageChangePayload {
  targetStageId: string
  followupDate?: string // ISO format
  followupTime?: string // HH:mm
  followupNote?: string
  meetingDate?: string
  meetingTime?: string
  meetingLocation?: string
  lostReason?: string
  outcome?: string
  note?: string
}

interface Props {
  isOpen: boolean
  lead: {
    id: string
    name?: string | null
    phone?: string | null
    stage_id: string
    assigned_agent_id?: string | null
  }
  fromStage?: LeadStage | null
  toStage: LeadStage
  stages: LeadStage[]
  onConfirm: (payload: StageChangePayload) => Promise<void>
  onCancel: () => void
  currentUserId?: string | null
}

const LOST_REASONS = [
  'Budget too low / Unqualified',
  'Purchased competitor property',
  'Invalid / unreachable number',
  'No response after multiple attempts (Ghosted)',
  'Location / unit mismatch',
  'Postponed purchase indefinitely',
  'Customer was just exploring / Not serious',
  'Other',
]

const CONTACTED_OUTCOMES = [
  {
    id: 'connected_interested',
    title: 'Connected — Interested',
    desc: 'Lead showed genuine interest; needs follow-up or qualification',
    defaultAction: 'schedule_followup',
  },
  {
    id: 'connected_info_sent',
    title: 'Connected — Brochure / Info Sent',
    desc: 'Sent project materials; agreed to review and talk soon',
    defaultAction: 'schedule_followup_2d',
  },
  {
    id: 'connected_call_back',
    title: 'Connected — Asked to Call Back Later',
    desc: 'Lead requested a specific date/time to talk',
    defaultAction: 'schedule_followup',
  },
  {
    id: 'no_answer',
    title: 'No Answer / Line Busy',
    desc: 'Could not connect; retry tomorrow',
    defaultAction: 'retry_tomorrow',
  },
  {
    id: 'wrong_number',
    title: 'Wrong Number / Not Working',
    desc: 'Invalid contact details',
    defaultAction: 'move_lost',
  },
  {
    id: 'not_interested',
    title: 'Not Interested',
    desc: 'Lead explicitly rejected or stated no purchase intention',
    defaultAction: 'move_lost',
  },
]

export default function StageChangeModal({
  isOpen,
  lead,
  fromStage,
  toStage,
  stages,
  onConfirm,
  onCancel,
  currentUserId,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeTargetStageId, setActiveTargetStageId] = useState(toStage.id)
  const isSiteVisitTransition = fromStage?.key === 'site_visit_scheduled'
  const postVisitStages = stages.filter((s) =>
    ['proposal', 'negotiation', 'followup', 'won', 'lost'].includes(s.key)
  )

  const currentTargetStage = stages.find((s) => s.id === activeTargetStageId) || toStage
  const stageKey = currentTargetStage.key

  // Form states
  const [outcome, setOutcome] = useState('connected_info_sent')
  const [followupDate, setFollowupDate] = useState('')
  const [followupTime, setFollowupTime] = useState('11:00')
  const [followupNote, setFollowupNote] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('15:00')
  const [meetingLocation, setMeetingLocation] = useState('Office Meeting')
  const [schedulePreMeetingReminder, setSchedulePreMeetingReminder] = useState(true)
  const [preMeetingReminderType, setPreMeetingReminderType] = useState<
    '1_hour_before' | '2_hours_before' | 'morning_of' | 'at_meeting'
  >('1_hour_before')
  const [preMeetingNote, setPreMeetingNote] = useState('Pre-meeting confirmation call with client')
  const [lostReason, setLostReason] = useState(LOST_REASONS[0])
  const [generalNote, setGeneralNote] = useState('')

  // Conflict detection state
  const supabase = createClient()
  const [conflict, setConflict] = useState<ScheduleConflict | null>(null)
  const [allowConflictOverlap, setAllowConflictOverlap] = useState(false)

  // Reset overlap toggle on date/time change
  useEffect(() => {
    setAllowConflictOverlap(false)
  }, [meetingDate, meetingTime, followupDate, followupTime])

  // Conflict detection effect
  useEffect(() => {
    if (!isOpen) {
      setConflict(null)
      return
    }

    let scheduledIso: string | null = null
    if (stageKey === 'meeting_scheduled' || stageKey === 'site_visit_scheduled') {
      if (meetingDate && meetingTime) {
        const dt = new Date(`${meetingDate}T${meetingTime}:00`)
        if (!isNaN(dt.getTime())) scheduledIso = dt.toISOString()
      }
    } else if (followupDate) {
      const timePart = followupTime || '10:00'
      const dt = new Date(`${followupDate}T${timePart}:00`)
      if (!isNaN(dt.getTime())) scheduledIso = dt.toISOString()
    }

    if (!scheduledIso) {
      setConflict(null)
      return
    }

    const targetAgentId = lead.assigned_agent_id || currentUserId
    if (!targetAgentId) return

    let active = true
    const timer = setTimeout(async () => {
      const found = await checkFollowupConflict(supabase, {
        agentId: targetAgentId,
        scheduledAtIso: scheduledIso,
        bufferMinutes: 30,
      })
      if (active) {
        setConflict(found)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isOpen, stageKey, meetingDate, meetingTime, followupDate, followupTime, lead.assigned_agent_id, currentUserId])

  // Helper date generators
  function getFutureDate(daysAhead: number): string {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    return d.toISOString().split('T')[0]
  }

  // Prepopulate defaults based on target stage
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSubmitting(false)

    let initialTarget = toStage
    if (fromStage?.key === 'site_visit_scheduled' && (toStage.key === 'site_visit_scheduled' || toStage.key === 'meeting_done')) {
      const forwardDefault = stages.find((s) => s.key === 'proposal') || stages.find((s) => s.key === 'followup') || toStage
      initialTarget = forwardDefault
      setActiveTargetStageId(forwardDefault.id)
    } else {
      setActiveTargetStageId(toStage.id)
    }

    const key = initialTarget.key

    if (key === 'contacted') {
      setOutcome('connected_info_sent')
      setFollowupDate(getFutureDate(2))
      setFollowupTime('11:00')
      setFollowupNote('Review brochure and check client feedback')
    } else if (key === 'no_reply') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('10:00')
      setFollowupNote('Retry calling lead (no answer on first attempt)')
    } else if (key === 'followup') {
      setFollowupDate(getFutureDate(fromStage?.key === 'site_visit_scheduled' ? 2 : 1))
      setFollowupTime('11:00')
      setFollowupNote(fromStage?.key === 'site_visit_scheduled' ? 'Post site visit follow-up' : 'Scheduled follow-up discussion')
    } else if (key === 'proposal') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('12:00')
      setFollowupNote(fromStage?.key === 'site_visit_scheduled' ? 'Send proposal and unit pricing breakdown' : 'Proposal feedback & price discussion')
    } else if (key === 'meeting_scheduled' || key === 'site_visit_scheduled') {
      setMeetingDate(getFutureDate(1))
      setMeetingTime('16:00')
      setMeetingLocation(key === 'site_visit_scheduled' ? 'On-Site Project Visit' : 'Office Meeting')
      setSchedulePreMeetingReminder(true)
      setPreMeetingReminderType('1_hour_before')
      setPreMeetingNote(
        key === 'site_visit_scheduled'
          ? 'Confirm site visit with client (1h before)'
          : 'Pre-meeting confirmation call with client (1h before)'
      )
    } else if (key === 'meeting_done') {
      setFollowupDate(getFutureDate(2))
      setFollowupTime('11:00')
      setFollowupNote('Post-meeting follow-up on next steps')
    } else if (key === 'negotiation') {
      setFollowupDate(getFutureDate(1))
      setFollowupTime('14:00')
      setFollowupNote(fromStage?.key === 'site_visit_scheduled' ? 'Negotiate price and payment terms after site visit' : 'Check in on contract terms & payment plan')
    } else if (key === 'lost') {
      setLostReason(LOST_REASONS[0])
    }
  }, [isOpen, toStage.id, fromStage?.key])

  if (!isOpen) return null

  const needsFollowup = [
    'contacted',
    'no_reply',
    'followup',
    'proposal',
    'meeting_done',
    'negotiation',
  ].includes(stageKey)

  const isContacted = stageKey === 'contacted'
  const isLostOutcome = stageKey === 'lost' || (isContacted && (outcome === 'wrong_number' || outcome === 'not_interested'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (stageKey === 'lost' || isLostOutcome) {
      if (!lostReason) {
        setError('Please select a reason for marking this lead as lost.')
        return
      }
    }

    if (stageKey === 'meeting_scheduled' || stageKey === 'site_visit_scheduled') {
      if (!meetingDate) {
        setError('Please select the scheduled meeting / site visit date.')
        return
      }
    }

    if (needsFollowup && !isLostOutcome) {
      if (!followupDate) {
        setError('A next follow-up date is required so this lead does not become neglected.')
        return
      }
    }

    // Schedule conflict safety check
    if (conflict && !allowConflictOverlap) {
      setError(`⚠️ Schedule Conflict: You already have a commitment around ${conflict.formatted_time} with "${conflict.lead_name}". Adjust the time or check "Schedule anyway" below to proceed.`)
      return
    }

    // Determine effective stage
    let effectiveStageId = activeTargetStageId
    if (isContacted) {
      if (isLostOutcome) {
        const lostStage = stages.find((s) => s.key === 'lost')
        if (lostStage) effectiveStageId = lostStage.id
      } else if (outcome === 'no_answer') {
        const noReplyStage = stages.find((s) => s.key === 'no_reply')
        if (noReplyStage) effectiveStageId = noReplyStage.id
      }
    }

    setSubmitting(true)

    try {
      let combinedFollowupIso: string | undefined
      let finalFollowupNote: string | undefined = followupNote

      if (stageKey === 'meeting_scheduled' || stageKey === 'site_visit_scheduled') {
        if (schedulePreMeetingReminder && meetingDate) {
          const timePart = meetingTime || '15:00'
          const mDateTime = new Date(`${meetingDate}T${timePart}:00`)
          if (preMeetingReminderType === '1_hour_before') {
            mDateTime.setHours(mDateTime.getHours() - 1)
          } else if (preMeetingReminderType === '2_hours_before') {
            mDateTime.setHours(mDateTime.getHours() - 2)
          } else if (preMeetingReminderType === 'morning_of') {
            mDateTime.setHours(10, 0, 0, 0)
          }
          combinedFollowupIso = mDateTime.toISOString()
          finalFollowupNote =
            preMeetingNote?.trim() ||
            `🤝 Pre-meeting confirmation call (${meetingLocation || 'Meeting'})`
        }
      } else if (followupDate) {
        const timePart = followupTime || '10:00'
        combinedFollowupIso = new Date(`${followupDate}T${timePart}:00`).toISOString()
      }

      await onConfirm({
        targetStageId: effectiveStageId,
        followupDate: combinedFollowupIso,
        followupTime,
        followupNote: finalFollowupNote,
        meetingDate,
        meetingTime,
        meetingLocation,
        lostReason: stageKey === 'lost' || isLostOutcome ? lostReason : undefined,
        outcome: isContacted ? outcome : undefined,
        note: generalNote,
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to update lead stage. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        animation: 'fade-in 0.15s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.25), 0 8px 16px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--accent)',
                  backgroundColor: '#EFF6FF',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                Action Required
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Stage Transition
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
              {lead.name || 'Unnamed Lead'}
              {lead.phone && (
                <span style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginLeft: 8 }}>
                  ({lead.phone})
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              padding: 6,
              borderRadius: 6,
              cursor: 'pointer',
              color: '#94A3B8',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Transition Summary Bar */}
        <div
          style={{
            padding: '10px 20px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
          }}
        >
          <span style={{ color: '#64748B' }}>Moving from</span>
          <span
            style={{
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 6,
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
            }}
          >
            {fromStage?.label || 'Current'}
          </span>
          <ArrowRight size={13} color="#94A3B8" />
          <span
            style={{
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              background: `${currentTargetStage.color_hex || '#3B82F6'}18`,
              color: currentTargetStage.color_hex || '#3B82F6',
              border: `1px solid ${currentTargetStage.color_hex || '#3B82F6'}40`,
            }}
          >
            {currentTargetStage.label}
          </span>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Site Visit Completed: Advance to Forward Stage Selector */}
            {/* Site Visit Completed: Select Outcome Stage (Shows All Stages) */}
            {isSiteVisitTransition && (
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1.5px solid #FDE68A',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                  <Sparkles size={16} color="#D97706" /> Site Visit Completed — Select Outcome Stage:
                </div>
                <p style={{ fontSize: 11.5, color: '#92400E', margin: '0 0 10px' }}>
                  The client completed the on-site property tour. Select the appropriate outcome stage:
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {stages.map((stg) => {
                    const isSelected = activeTargetStageId === stg.id
                    return (
                      <button
                        key={stg.id}
                        type="button"
                        onClick={() => {
                          setActiveTargetStageId(stg.id)
                          if (stg.key === 'proposal') {
                            setFollowupDate(getFutureDate(1))
                            setFollowupTime('12:00')
                            setFollowupNote('Send proposal and unit pricing breakdown')
                          } else if (stg.key === 'negotiation') {
                            setFollowupDate(getFutureDate(1))
                            setFollowupTime('14:00')
                            setFollowupNote('Negotiate price & payment plan terms')
                          } else if (stg.key === 'followup') {
                            setFollowupDate(getFutureDate(2))
                            setFollowupTime('11:00')
                            setFollowupNote('Follow-up with client after site visit reflection')
                          } else if (stg.key === 'lost') {
                            setLostReason(LOST_REASONS[0])
                          } else if (stg.key === 'site_visit_scheduled') {
                            setMeetingDate(getFutureDate(2))
                            setMeetingTime('16:00')
                            setMeetingLocation('On-Site Project Visit')
                            setSchedulePreMeetingReminder(true)
                            setPreMeetingNote('Confirm rescheduled site visit')
                          } else if (stg.key === 'meeting_scheduled') {
                            setMeetingDate(getFutureDate(2))
                            setMeetingTime('15:00')
                            setMeetingLocation('Office Meeting')
                            setSchedulePreMeetingReminder(true)
                            setPreMeetingNote('Confirm post-visit office meeting')
                          } else {
                            setFollowupDate(getFutureDate(1))
                            setFollowupTime('11:00')
                            setFollowupNote(`Follow-up for ${stg.label}`)
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: `1.5px solid ${isSelected ? stg.color_hex || '#D97706' : '#E2E8F0'}`,
                          background: isSelected ? `${stg.color_hex || '#D97706'}20` : '#FFFFFF',
                          color: isSelected ? stg.color_hex || '#B45309' : '#334155',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {stg.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* STAGE SPECIFIC FIELDS */}

            {/* 1. Contacted Stage: Outcomes */}
            {isContacted && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                  What was the outcome of your call? <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CONTACTED_OUTCOMES.map((item) => {
                    const isSelected = outcome === item.id
                    return (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: `1.5px solid ${isSelected ? 'var(--accent)' : '#E2E8F0'}`,
                          background: isSelected ? '#F0F7FF' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="contacted_outcome"
                          value={item.id}
                          checked={isSelected}
                          onChange={() => setOutcome(item.id)}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--accent)' : '#0F172A' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                            {item.desc}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 2. Lost Stage OR Lost Outcome: Reason Dropdown */}
            {(stageKey === 'lost' || isLostOutcome) && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                  Why was this lead marked as Lost? <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    color: '#0F172A',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  Managers track lost reasons to analyze marketing quality and agent objections.
                </p>
              </div>
            )}

            {/* 3. Meeting Scheduled / Site Visit: Date & Time + Pre-Meeting Confirmation Follow-up */}
            {(stageKey === 'meeting_scheduled' || stageKey === 'site_visit_scheduled') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#1D4ED8', fontWeight: 700, fontSize: 13 }}>
                    <Calendar size={16} /> Meeting / Visit Schedule
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                        Meeting Date <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                        Meeting Time <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="time"
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Meeting Type / Location
                    </label>
                    <input
                      type="text"
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      placeholder="e.g. Office, Site visit, Zoom call"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>

                  {/* Conflict Alert Banner for Meeting */}
                  {conflict && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        borderRadius: 8,
                        backgroundColor: '#FEF3C7',
                        border: '1.5px solid #F59E0B',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#92400E', fontWeight: 700, fontSize: 12.5 }}>
                        <AlertTriangle size={15} color="#D97706" style={{ flexShrink: 0 }} />
                        <span>⚠️ Time Conflict ({conflict.formatted_time})</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#78350F', lineHeight: '1.4' }}>
                        You already have an appointment with <strong>{conflict.lead_name}</strong> around this time
                        {conflict.note ? ` ("${conflict.note}")` : ''}.
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginTop: 4, fontSize: 11.5, fontWeight: 600, color: '#92400E' }}>
                        <input
                          type="checkbox"
                          checked={allowConflictOverlap}
                          onChange={(e) => setAllowConflictOverlap(e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: '#D97706', cursor: 'pointer' }}
                        />
                        <span>Schedule anyway (allow overlap)</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Pre-Meeting Follow-up Reminder */}
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803D', fontWeight: 700, fontSize: 13 }}>
                      <Clock size={16} /> Pre-Meeting Confirmation Call
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={schedulePreMeetingReminder}
                        onChange={(e) => setSchedulePreMeetingReminder(e.target.checked)}
                      />
                      <span>Add to follow-ups</span>
                    </label>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#166534', margin: '0 0 10px' }}>
                    Automatically adds a confirmation follow-up to your work queue so you can call the client before the meeting.
                  </p>

                  {schedulePreMeetingReminder && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setPreMeetingReminderType('1_hour_before')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: `1.5px solid ${preMeetingReminderType === '1_hour_before' ? '#16A34A' : '#DCFCE7'}`,
                            background: preMeetingReminderType === '1_hour_before' ? '#DCFCE7' : '#FFFFFF',
                            color: preMeetingReminderType === '1_hour_before' ? '#15803D' : '#334155',
                          }}
                        >
                          ⚡ 1 hour before meeting (Recommended)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreMeetingReminderType('2_hours_before')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: `1.5px solid ${preMeetingReminderType === '2_hours_before' ? '#16A34A' : '#DCFCE7'}`,
                            background: preMeetingReminderType === '2_hours_before' ? '#DCFCE7' : '#FFFFFF',
                            color: preMeetingReminderType === '2_hours_before' ? '#15803D' : '#334155',
                          }}
                        >
                          2 hours before
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreMeetingReminderType('morning_of')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: `1.5px solid ${preMeetingReminderType === 'morning_of' ? '#16A34A' : '#DCFCE7'}`,
                            background: preMeetingReminderType === 'morning_of' ? '#DCFCE7' : '#FFFFFF',
                            color: preMeetingReminderType === 'morning_of' ? '#15803D' : '#334155',
                          }}
                        >
                          Morning of meeting (10:00 AM)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreMeetingReminderType('at_meeting')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: `1.5px solid ${preMeetingReminderType === 'at_meeting' ? '#16A34A' : '#DCFCE7'}`,
                            background: preMeetingReminderType === 'at_meeting' ? '#DCFCE7' : '#FFFFFF',
                            color: preMeetingReminderType === 'at_meeting' ? '#15803D' : '#334155',
                          }}
                        >
                          At meeting time
                        </button>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={preMeetingNote}
                          onChange={(e) => setPreMeetingNote(e.target.value)}
                          placeholder="Follow-up note (e.g. Call client to confirm location & time)"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12.5 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Mandatory Follow-up Date/Time when required */}
            {needsFollowup && !isLostOutcome && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309', fontWeight: 700, fontSize: 13 }}>
                    <Clock size={16} /> Next Follow-up Commitment
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: 10 }}>
                    Mandatory
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: '#92400E', marginBottom: 10 }}>
                  Active leads must have a scheduled follow-up. Leads without a date accumulate as <strong>Idle</strong> on your dashboard.
                </p>

                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFollowupDate(getFutureDate(1))}
                    style={{ padding: '3px 8px', borderRadius: 6, background: '#FEF3C7', border: '1px solid #FCD34D', fontSize: 11, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowupDate(getFutureDate(2))}
                    style={{ padding: '3px 8px', borderRadius: 6, background: '#FEF3C7', border: '1px solid #FCD34D', fontSize: 11, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}
                  >
                    In 2 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowupDate(getFutureDate(4))}
                    style={{ padding: '3px 8px', borderRadius: 6, background: '#FEF3C7', border: '1px solid #FCD34D', fontSize: 11, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}
                  >
                    In 4 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowupDate(getFutureDate(7))}
                    style={{ padding: '3px 8px', borderRadius: 6, background: '#FEF3C7', border: '1px solid #FCD34D', fontSize: 11, fontWeight: 600, color: '#92400E', cursor: 'pointer' }}
                  >
                    Next Week
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Date <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Time
                    </label>
                    <input
                      type="time"
                      value={followupTime}
                      onChange={(e) => setFollowupTime(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Follow-up Agenda / Note
                  </label>
                  <input
                    type="text"
                    value={followupNote}
                    onChange={(e) => setFollowupNote(e.target.value)}
                    placeholder="e.g. Call to discuss payment plan options"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
                  />
                </div>

                {/* Conflict Alert Banner for Follow-up */}
                {conflict && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      borderRadius: 8,
                      backgroundColor: '#FEF3C7',
                      border: '1.5px solid #F59E0B',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#92400E', fontWeight: 700, fontSize: 12.5 }}>
                      <AlertTriangle size={15} color="#D97706" style={{ flexShrink: 0 }} />
                      <span>⚠️ Time Conflict ({conflict.formatted_time})</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#78350F', lineHeight: '1.4' }}>
                      You already have a commitment scheduled with <strong>{conflict.lead_name}</strong> around this time
                      {conflict.note ? ` ("${conflict.note}")` : ''}.
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginTop: 4, fontSize: 11.5, fontWeight: 600, color: '#92400E' }}>
                      <input
                        type="checkbox"
                        checked={allowConflictOverlap}
                        onChange={(e) => setAllowConflictOverlap(e.target.checked)}
                        style={{ width: 14, height: 14, accentColor: '#D97706', cursor: 'pointer' }}
                      />
                      <span>Schedule anyway (allow overlap)</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 5. Won Stage Confirmation */}
            {stageKey === 'won' && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <CheckCircle2 size={24} color="#16A34A" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#15803D' }}>
                  Celebrate Deal Won!
                </div>
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
                  Moving this lead to Won marks the transaction as closed. All pending follow-ups will be cleared.
                </p>
              </div>
            )}

            {/* General Note */}
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Activity Log Note <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Log details of discussion or key context for the team..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 12.5,
                  resize: 'none',
                }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #F1F5F9',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#64748B',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              {submitting ? 'Saving...' : 'Confirm Stage Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
