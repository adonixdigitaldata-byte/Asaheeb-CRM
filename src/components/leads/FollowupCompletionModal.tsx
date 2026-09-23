'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  Flame,
  CalendarClock,
  ArrowRight,
  Sparkles,
  PhoneCall,
  UserX,
  Send,
} from 'lucide-react'
import type { LeadStage, LeadFollowup } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { checkFollowupConflict, type ScheduleConflict } from '@/lib/followupConflictService'

export interface FollowupCompletionData {
  followupId: string
  outcomeNote: string
  targetStageId: string
  nextStepType: 'FOLLOWUP' | 'MEETING' | 'LOST' | 'NONE'
  // Follow-up details
  nextFollowupDate?: string // ISO
  nextFollowupNote?: string
  // Meeting details
  meetingDate?: string
  meetingTime?: string
  meetingLocation?: string
  meetingNote?: string
  // Lost details
  lostReason?: string
}

interface Props {
  isOpen: boolean
  followup: LeadFollowup | null
  lead: {
    id: string
    name: string
    phone?: string | null
    stage_id: string
    assigned_agent_id?: string | null
  }
  stages: LeadStage[]
  onClose: () => void
  onSubmit: (data: FollowupCompletionData) => Promise<void>
  currentUserId?: string | null
}

const LOST_REASONS = [
  'Budget too low / Unqualified',
  'Purchased competitor property',
  'Invalid / Unreachable phone number',
  'No response after multiple attempts (Ghosted)',
  'Location / Property unit mismatch',
  'Postponed purchase indefinitely',
  'Client was just exploring / Not serious',
  'Other',
]

const MEETING_LOCATIONS = [
  'Asaheeb Sales Office',
  'On-Site Project Visit',
  'Client Office / Residence',
  'Online Zoom / Video Call',
  'Phone Consultation',
]

export default function FollowupCompletionModal({
  isOpen,
  followup,
  lead,
  stages,
  onClose,
  onSubmit,
  currentUserId,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Outcome Note
  const [outcomeNote, setOutcomeNote] = useState('')

  // Step 2: Stage Selection
  const [targetStageId, setTargetStageId] = useState('')

  // Step 3: Next Action
  const [nextStepType, setNextStepType] = useState<'FOLLOWUP' | 'MEETING' | 'LOST' | 'NONE'>('FOLLOWUP')

  // Follow-up fields
  const [nextFollowupDate, setNextFollowupDate] = useState('')
  const [nextFollowupNote, setNextFollowupNote] = useState('')

  // Meeting fields
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('15:00')
  const [meetingLocation, setMeetingLocation] = useState(MEETING_LOCATIONS[0])
  const [meetingNote, setMeetingNote] = useState('')

  // Lost fields
  const [lostReason, setLostReason] = useState(LOST_REASONS[0])

  // Helper for quick date formatting
  function getFutureDateTime(daysAhead: number, hours = 11, minutes = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    d.setHours(hours, minutes, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function getFutureDateOnly(daysAhead: number): string {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  // Initialize or reset form when opened
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSubmitting(false)
    setOutcomeNote('')
    setTargetStageId(lead.stage_id)
    setNextStepType('FOLLOWUP')

    // Default next follow-up to tomorrow 11:00 AM
    setNextFollowupDate(getFutureDateTime(1, 11, 0))
    setNextFollowupNote(
      followup?.note ? `Follow-up after: ${followup.note}` : 'Check client feedback & next steps'
    )

    // Default meeting fields
    setMeetingDate(getFutureDateOnly(2))
    setMeetingTime('15:00')
    setMeetingLocation(MEETING_LOCATIONS[0])
    setMeetingNote('Site & project presentation')
    setLostReason(LOST_REASONS[0])
  }, [isOpen, lead.stage_id, followup])

  // Conflict detection state
  const supabase = createClient()
  const [conflict, setConflict] = useState<ScheduleConflict | null>(null)
  const [allowConflictOverlap, setAllowConflictOverlap] = useState(false)

  // Reset overlap toggle on date/time change
  useEffect(() => {
    setAllowConflictOverlap(false)
  }, [nextFollowupDate, meetingDate, meetingTime, nextStepType])

  // Conflict detection effect
  useEffect(() => {
    if (!isOpen || !followup) {
      setConflict(null)
      return
    }

    let scheduledIso: string | null = null
    if (nextStepType === 'FOLLOWUP' && nextFollowupDate) {
      const dt = new Date(nextFollowupDate)
      if (!isNaN(dt.getTime())) scheduledIso = dt.toISOString()
    } else if (nextStepType === 'MEETING' && meetingDate) {
      const timePart = meetingTime || '15:00'
      const dt = new Date(`${meetingDate}T${timePart}:00`)
      if (!isNaN(dt.getTime())) scheduledIso = dt.toISOString()
    }

    if (!scheduledIso) {
      setConflict(null)
      return
    }

    const targetAgentId = followup.agent_id || lead.assigned_agent_id || currentUserId
    if (!targetAgentId) return

    let active = true
    const timer = setTimeout(async () => {
      const found = await checkFollowupConflict(supabase, {
        agentId: targetAgentId,
        scheduledAtIso: scheduledIso,
        excludeFollowupId: followup.id,
        bufferMinutes: 10,
      })
      if (active) {
        setConflict(found)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isOpen, followup?.id, followup?.agent_id, nextStepType, nextFollowupDate, meetingDate, meetingTime, lead.assigned_agent_id, currentUserId])

  // Smart stage sync when user clicks Next Step types
  const handleSelectNextStep = (type: 'FOLLOWUP' | 'MEETING' | 'LOST' | 'NONE') => {
    setNextStepType(type)
    if (type === 'MEETING') {
      const meetingStage = stages.find(
        (s) => s.key === 'meeting_scheduled' || s.key === 'site_visit_scheduled' || s.label.toLowerCase().includes('meeting')
      )
      if (meetingStage) setTargetStageId(meetingStage.id)
    } else if (type === 'LOST') {
      const lostStage = stages.find((s) => s.key === 'lost')
      if (lostStage) setTargetStageId(lostStage.id)
    } else if (type === 'FOLLOWUP') {
      // If was previously on lost, restore to lead.stage_id or followup stage
      const currentStage = stages.find((s) => s.id === targetStageId)
      if (currentStage?.key === 'lost') {
        setTargetStageId(lead.stage_id)
      }
    }
  }

  // Smart action sync when user changes Stage dropdown
  const handleStageChange = (newStageId: string) => {
    setTargetStageId(newStageId)
    const selectedStage = stages.find((s) => s.id === newStageId)
    if (!selectedStage) return

    if (selectedStage.key === 'lost') {
      setNextStepType('LOST')
    } else if (selectedStage.key === 'meeting_scheduled' || selectedStage.key === 'site_visit_scheduled') {
      setNextStepType('MEETING')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followup) return

    if (!outcomeNote.trim()) {
      setError('Please provide a brief outcome note describing what happened.')
      return
    }

    if (nextStepType === 'FOLLOWUP' && !nextFollowupDate) {
      setError('Please specify when the next follow-up call should take place.')
      return
    }

    if (nextStepType === 'MEETING' && !meetingDate) {
      setError('Please specify the date for the meeting / site visit.')
      return
    }

    // Conflict safety check
    if (conflict && !allowConflictOverlap) {
      setError(`⚠️ Schedule Conflict: You already have a commitment around ${conflict.formatted_time} with "${conflict.lead_name}". Adjust the time or check "Schedule anyway" below to proceed.`)
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      let isoFollowupDate: string | undefined = undefined
      if (nextStepType === 'FOLLOWUP' && nextFollowupDate) {
        isoFollowupDate = new Date(nextFollowupDate).toISOString()
      }

      await onSubmit({
        followupId: followup.id,
        outcomeNote: outcomeNote.trim(),
        targetStageId,
        nextStepType,
        nextFollowupDate: isoFollowupDate,
        nextFollowupNote: nextFollowupNote.trim() || undefined,
        meetingDate: nextStepType === 'MEETING' ? meetingDate : undefined,
        meetingTime: nextStepType === 'MEETING' ? meetingTime : undefined,
        meetingLocation: nextStepType === 'MEETING' ? meetingLocation : undefined,
        meetingNote: nextStepType === 'MEETING' ? meetingNote.trim() : undefined,
        lostReason: nextStepType === 'LOST' ? lostReason : undefined,
      })

      onClose()
    } catch (err: any) {
      console.error('Error completing follow-up:', err)
      setError(err?.message || 'Failed to complete follow-up. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !followup) return null

  const selectedStageObj = stages.find((s) => s.id === targetStageId)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.15)',
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Follow-up Completed: What is the Outcome?
                </h3>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
                Lead: <strong style={{ color: '#1E293B' }}>{lead.name}</strong>
                {lead.phone ? ` • ${lead.phone}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            flex: 1,
            padding: '20px 22px',
            gap: 18,
          }}
        >
          {error && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Follow-up Note Reference */}
          {followup.note && (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#475569',
              }}
            >
              <span style={{ fontWeight: 700, color: '#0F172A' }}>Completed Task: </span>
              {followup.note}
            </div>
          )}

          {/* 1. Quick Outcome Note */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                1. Quick Outcome Note <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Logged to lead activity &amp; notes</span>
            </div>
            <textarea
              required
              rows={2}
              className="input"
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              placeholder="e.g. Spoke on phone, interested in 3BHK in Riyadh; requested payment plan and brochure."
              style={{
                width: '100%',
                resize: 'vertical',
                fontSize: 13,
                lineHeight: '1.5',
                padding: '10px 12px',
                borderRadius: 8,
              }}
            />
          </div>

          {/* 2. Pipeline Stage Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                2. Current / Target Pipeline Stage
              </label>
              {selectedStageObj && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    backgroundColor: `${selectedStageObj.color_hex}15`,
                    color: selectedStageObj.color_hex,
                    border: `1px solid ${selectedStageObj.color_hex}40`,
                  }}
                >
                  {selectedStageObj.label}
                </span>
              )}
            </div>
            <select
              className="input"
              value={targetStageId}
              onChange={(e) => handleStageChange(e.target.value)}
              style={{
                width: '100%',
                fontWeight: 600,
                fontSize: 13,
                padding: '9px 12px',
                borderRadius: 8,
                background: '#FFFFFF',
              }}
            >
              {stages.map((stg) => (
                <option key={stg.id} value={stg.id}>
                  {stg.label} {stg.id === lead.stage_id ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Next Step Selection (4 Options) */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: 8 }}>
              3. What is the Next Step?
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {/* Option 1: Schedule Follow-up */}
              <button
                type="button"
                onClick={() => handleSelectNextStep('FOLLOWUP')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `2px solid ${nextStepType === 'FOLLOWUP' ? 'var(--accent)' : '#E2E8F0'}`,
                  background: nextStepType === 'FOLLOWUP' ? '#EFF6FF' : '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: nextStepType === 'FOLLOWUP' ? 'var(--accent)' : '#0F172A', fontWeight: 700, fontSize: 13 }}>
                  <CalendarClock size={16} color={nextStepType === 'FOLLOWUP' ? 'var(--accent)' : '#2563EB'} />
                  <span>📅 Next Call / Follow-up</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Keeps lead active, never becomes neglected.
                </div>
              </button>

              {/* Option 2: Meeting Booked */}
              <button
                type="button"
                onClick={() => handleSelectNextStep('MEETING')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `2px solid ${nextStepType === 'MEETING' ? '#8B5CF6' : '#E2E8F0'}`,
                  background: nextStepType === 'MEETING' ? '#F5F3FF' : '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: nextStepType === 'MEETING' ? '#7C3AED' : '#0F172A', fontWeight: 700, fontSize: 13 }}>
                  <Calendar size={16} color={nextStepType === 'MEETING' ? '#7C3AED' : '#8B5CF6'} />
                  <span>🤝 Meeting / Site Visit</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Advances to Meeting Scheduled &amp; records visit.
                </div>
              </button>

              {/* Option 3: Lost */}
              <button
                type="button"
                onClick={() => handleSelectNextStep('LOST')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `2px solid ${nextStepType === 'LOST' ? '#DC2626' : '#E2E8F0'}`,
                  background: nextStepType === 'LOST' ? '#FEF2F2' : '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: nextStepType === 'LOST' ? '#DC2626' : '#0F172A', fontWeight: 700, fontSize: 13 }}>
                  <UserX size={16} color={nextStepType === 'LOST' ? '#DC2626' : '#EF4444'} />
                  <span>❌ Not Interested / Lost</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Officially closes lead with reason. Never neglected.
                </div>
              </button>

              {/* Option 4: Leave Idle */}
              <button
                type="button"
                onClick={() => handleSelectNextStep('NONE')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `2px solid ${nextStepType === 'NONE' ? '#EA580C' : '#E2E8F0'}`,
                  background: nextStepType === 'NONE' ? '#FFF7ED' : '#FFFFFF',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: nextStepType === 'NONE' ? '#EA580C' : '#0F172A', fontWeight: 700, fontSize: 13 }}>
                  <Flame size={16} color={nextStepType === 'NONE' ? '#EA580C' : '#F97316'} />
                  <span>⏭️ No Next Action</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Leave idle without a scheduled touchpoint.
                </div>
              </button>
            </div>
          </div>

          {/* DYNAMIC SUB-SECTIONS ACCORDING TO SELECTED NEXT STEP */}

          {/* Sub-form 1: FOLLOWUP */}
          {nextStepType === 'FOLLOWUP' && (
            <div
              style={{
                background: '#F0F7FF',
                border: '1px solid #BFDBFE',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1E40AF' }}>
                  📅 Schedule Next Touchpoint
                </span>
                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setNextFollowupDate(getFutureDateTime(1, 11, 0))}
                    style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#DBEAFE', color: '#1E40AF', border: 'none', cursor: 'pointer' }}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextFollowupDate(getFutureDateTime(2, 11, 0))}
                    style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#DBEAFE', color: '#1E40AF', border: 'none', cursor: 'pointer' }}
                  >
                    +2 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextFollowupDate(getFutureDateTime(4, 11, 0))}
                    style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#DBEAFE', color: '#1E40AF', border: 'none', cursor: 'pointer' }}
                  >
                    +4 Days
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF', display: 'block', marginBottom: 4 }}>
                    Date &amp; Time <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    className="input"
                    value={nextFollowupDate}
                    onChange={(e) => setNextFollowupDate(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', fontSize: 12.5, padding: '8px 10px', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF', display: 'block', marginBottom: 4 }}>
                    Next Call Objective / Note
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={nextFollowupNote}
                    onChange={(e) => setNextFollowupNote(e.target.value)}
                    placeholder="e.g. Call to discuss brochure feedback and schedule site visit"
                    style={{ width: '100%', background: '#FFFFFF', fontSize: 12.5, padding: '8px 10px', borderRadius: 6 }}
                  />
                </div>
              </div>

              {/* Conflict Alert Banner for Follow-up */}
              {conflict && (
                <div
                  style={{
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

          {/* Sub-form 2: MEETING */}
          {nextStepType === 'MEETING' && (
            <div
              style={{
                background: '#FAF5FF',
                border: '1px solid #DDD6FE',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#6B21A8' }}>
                  🤝 Meeting / Site Visit Details
                </span>
                <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>
                  Advances to Meeting Scheduled
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#6B21A8', display: 'block', marginBottom: 4 }}>
                    Meeting Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', fontSize: 12.5, padding: '8px 10px', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#6B21A8', display: 'block', marginBottom: 4 }}>
                    Meeting Time
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', fontSize: 12.5, padding: '8px 10px', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#6B21A8', display: 'block', marginBottom: 4 }}>
                    Meeting Location / Mode
                  </label>
                  <select
                    className="input"
                    value={meetingLocation}
                    onChange={(e) => setMeetingLocation(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', fontSize: 12.5, padding: '8px 10px', borderRadius: 6 }}
                  >
                    {MEETING_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#6B21A8', display: 'block', marginBottom: 4 }}>
                    Meeting Purpose / Project
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={meetingNote}
                    onChange={(e) => setMeetingNote(e.target.value)}
                    placeholder="e.g. Present project brochure & floor plan"
                    style={{ width: '100%', background: '#FFFFFF', fontSize: 12.5, padding: '8px 10px', borderRadius: 6 }}
                  />
                </div>
              </div>

              {/* Conflict Alert Banner for Meeting */}
              {conflict && (
                <div
                  style={{
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
          )}

          {/* Sub-form 3: LOST */}
          {nextStepType === 'LOST' && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#991B1B' }}>
                  ❌ Close Out Lead as Lost
                </span>
                <span style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>
                  Moves to Lost Stage
                </span>
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#991B1B', display: 'block', marginBottom: 4 }}>
                  Disqualification Reason <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  className="input"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', fontSize: 12.5, padding: '8px 10px', borderRadius: 6 }}
                >
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: '#7F1D1D' }}>
                This officially concludes the lead cycle. The lead will be archived in the Lost stage and will not count as neglected.
              </div>
            </div>
          )}

          {/* Sub-form 4: NONE (LEAVE IDLE WARNING) */}
          {nextStepType === 'NONE' && (
            <div
              style={{
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <Flame size={20} color="#EA580C" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#C2410C' }}>
                  ⚠️ Warning: This lead will be flagged as Neglected!
                </div>
                <div style={{ fontSize: 12, color: '#9A3412', marginTop: 4, lineHeight: 1.5 }}>
                  By not scheduling a next call or closing this lead, it will immediately appear under{' '}
                  <strong>Neglected Leads</strong> on your personal dashboard and your manager&apos;s team radar.
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              marginTop: 6,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-outline"
              style={{ fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
              }}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  <span>Saving Outcome...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Complete Follow-up &amp; Save Next Step</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
