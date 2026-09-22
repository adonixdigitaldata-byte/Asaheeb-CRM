'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Phone,
  Building,
  GripVertical,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import type { Lead, LeadStage, Profile } from '@/types/database'
import { formatTimeAgo, formatDate } from '@/lib/utils'
import StageChangeModal, { type StageChangePayload } from '@/components/leads/StageChangeModal'

interface Props {
  leads: Lead[]
  stages: LeadStage[]
  profile?: Profile
  onLeadMoved: () => void
  onOptimisticMove?: (leadId: string, targetStageId: string, extraUpdates?: Partial<Lead>) => void
  onFollowupScheduled?: (leadId: string) => void
  pendingFollowupLeadIds?: string[]
}

function KanbanCardItem({
  lead,
  isOverlay = false,
  isIdle = false,
  idleBadgeText = 'No next action scheduled',
  idleBadgeColor = 'red',
  onMarkMeetingDone,
  allStages,
  onStageSelect,
}: {
  lead: Lead
  isOverlay?: boolean
  isIdle?: boolean
  idleBadgeText?: string | null
  idleBadgeColor?: 'red' | 'amber' | null
  onMarkMeetingDone?: (lead: Lead) => void
  allStages?: LeadStage[]
  onStageSelect?: (lead: Lead, targetStageId: string) => void
}) {
  const router = useRouter()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: { lead },
    disabled: isOverlay,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.3 : 1,
  }

  // Agent initials
  const agentInitial = lead.assigned_agent?.name
    ? lead.assigned_agent.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null

  const propertyDisplayName = lead.property?.name_en || lead.interest
  const currentStage = lead.stage || allStages?.find((s) => s.id === lead.stage_id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isIdle ? 'is-idle' : ''}`}
      onClick={() => {
        if (!isDragging) {
          router.push(`/leads/${lead.id}`)
        }
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div
          className="kanban-card-title flex items-center"
          style={{ cursor: 'pointer', flexWrap: 'wrap', gap: '6px' }}
          title={lead.name || 'Unnamed Lead'}
        >
          <span>{lead.name || 'Unnamed Lead'}</span>
          {lead.client_category === 'VIP' && (
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 800,
                backgroundColor: '#FEF3C7',
                color: '#B45309',
                padding: '1px 6px',
                borderRadius: '4px',
                border: '1px solid #FCD34D',
                flexShrink: 0,
                marginLeft: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              👑 VIP
            </span>
          )}
        </div>

        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="drag-handle"
          title="Drag to change stage"
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', cursor: 'grab', padding: '1px 3px' }}
        >
          <GripVertical size={14} />
        </div>
      </div>

      {/* Idle Warning indicator */}
      {isIdle && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            fontWeight: 700,
            color: idleBadgeColor === 'amber' ? '#B45309' : '#DC2626',
            backgroundColor: idleBadgeColor === 'amber' ? '#FEF3C7' : '#FEF2F2',
            border: `1px solid ${idleBadgeColor === 'amber' ? '#FCD34D' : '#FECACA'}`,
            padding: '1px 6px',
            borderRadius: 4,
            marginBottom: 5,
          }}
          title={idleBadgeText || 'No action scheduled'}
        >
          <AlertTriangle size={10} style={{ flexShrink: 0 }} />
          <span>{idleBadgeText || 'No next action scheduled'}</span>
        </div>
      )}

      {/* Scheduled Meeting Date & Time + Quick Mark Done Button */}
      {(lead.meeting_date || lead.meeting_time) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            marginBottom: 5,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: onMarkMeetingDone ? '#1D4ED8' : '#059669',
              backgroundColor: onMarkMeetingDone ? '#EFF6FF' : '#ECFDF5',
              border: `1px solid ${onMarkMeetingDone ? '#BFDBFE' : '#A7F3D0'}`,
              padding: '2px 6px',
              borderRadius: 4,
              width: 'fit-content',
            }}
          >
            {onMarkMeetingDone ? (
              <Calendar size={11} style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle size={11} style={{ flexShrink: 0, color: '#059669' }} />
            )}
            <span>
              {lead.meeting_date ? formatDate(lead.meeting_date) : ''}
              {lead.meeting_time ? ` · ${lead.meeting_time}` : ''}
              {!onMarkMeetingDone ? ' (Done)' : ''}
            </span>
          </div>

          {onMarkMeetingDone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkMeetingDone(lead)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                fontWeight: 700,
                color: '#15803D',
                backgroundColor: '#DCFCE7',
                border: '1px solid #BBF7D0',
                padding: '2px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={
                lead.stage?.key === 'site_visit_scheduled'
                  ? 'Mark site visit as completed — record outcome and advance to next stage'
                  : 'Mark this meeting as completed — record outcome and schedule next steps'
              }
            >
              <CheckCircle size={10} style={{ flexShrink: 0 }} />
              <span>{lead.stage?.key === 'site_visit_scheduled' ? 'Mark Visit Done' : 'Mark Done'}</span>
            </button>
          )}
        </div>
      )}

      {/* Phone number */}
      {lead.phone ? (
        <div className="flex items-center gap-1" style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
          <Phone size={11} style={{ color: '#64748B', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.phone}
          </span>
        </div>
      ) : null}

      {/* Associated Property / Custom Project */}
      {propertyDisplayName ? (
        <div className="flex items-center gap-1" style={{ fontSize: 11.5, color: '#D97706', marginBottom: 4 }}>
          <Building size={11} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {propertyDisplayName}
          </span>
        </div>
      ) : null}

      {/* Footer Info: Time & Stage Dropdown & Agent Circle */}
      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 6,
          paddingTop: 5,
          borderTop: '1px solid #F1F5F9',
          fontSize: 11,
          color: '#64748B',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 10.5, color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatTimeAgo(lead.created_at)}
        </span>

        {/* Quick Stage Changer Dropdown */}
        {allStages && allStages.length > 0 && onStageSelect && (
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <select
              value={lead.stage_id}
              onChange={(e) => {
                e.stopPropagation()
                const val = e.target.value
                if (val && val !== lead.stage_id) {
                  onStageSelect(lead, val)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                fontSize: 10,
                fontWeight: 700,
                height: 22,
                padding: '1px 18px 1px 7px',
                borderRadius: 9999,
                border: `1px solid ${currentStage?.color_hex ? `${currentStage.color_hex}50` : '#CBD5E1'}`,
                backgroundColor: currentStage?.color_hex ? `${currentStage.color_hex}15` : '#F1F5F9',
                color: currentStage?.color_hex || '#334155',
                cursor: 'pointer',
                outline: 'none',
                maxWidth: 125,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 5px center',
                backgroundSize: '10px',
                lineHeight: '20px',
              }}
              title={`Stage: ${currentStage?.label || 'Unknown'}. Click to move to another stage.`}
            >
              {allStages.map((stg) => (
                <option
                  key={stg.id}
                  value={stg.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {stg.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {agentInitial ? (
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              fontSize: 9.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #BFDBFE',
              flexShrink: 0,
            }}
            title={`Assigned to ${lead.assigned_agent?.name}`}
          >
            {agentInitial}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>—</span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({
  stage,
  leads,
  pendingFollowupLeadIds,
  onMarkMeetingDone,
  allStages,
  onStageSelect,
}: {
  stage: LeadStage
  leads: Lead[]
  pendingFollowupLeadIds?: Set<string>
  onMarkMeetingDone?: (lead: Lead) => void
  allStages: LeadStage[]
  onStageSelect: (lead: Lead, targetStageId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: { stageId: stage.id },
  })

  const isClosedStage = ['won', 'lost'].includes(stage.key)

  return (
    <div
      ref={setNodeRef}
      className="kanban-column"
      style={{
        backgroundColor: isOver ? '#EFF6FF' : '#F8FAFC',
        borderColor: isOver ? '#3B82F6' : undefined,
      }}
    >
      {/* Stage Header */}
      <div
        className="kanban-header"
        style={{ borderTop: `3px solid ${stage.color_hex || '#3B82F6'}` }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>
          {stage.label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: '#F1F5F9',
            color: '#475569',
            padding: '2px 7px',
            borderRadius: 9999,
          }}
        >
          {leads.length}
        </span>
      </div>

      {/* Card List in Stage with Vertical Scroller */}
      <SortableContext
        id={stage.id}
        items={leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="kanban-list">
          {leads.map((lead) => {
            if (isClosedStage) {
              return (
                <KanbanCardItem
                  key={lead.id}
                  lead={lead}
                  isIdle={false}
                  allStages={allStages}
                  onStageSelect={onStageSelect}
                />
              )
            }

            const hasPendingFollowup = !!pendingFollowupLeadIds && pendingFollowupLeadIds.has(lead.id)

            // Check meeting date
            let isUpcomingMeeting = false
            let isPastMeeting = false

            if (lead.meeting_date) {
              const todayStart = new Date()
              todayStart.setHours(0, 0, 0, 0)
              const mDate = new Date(lead.meeting_date)
              mDate.setHours(0, 0, 0, 0)
              if (mDate >= todayStart) {
                isUpcomingMeeting = true
              } else {
                isPastMeeting = true
              }
            }

            // If it has an upcoming meeting OR a pending followup, it is NOT idle!
            if (isUpcomingMeeting || hasPendingFollowup) {
              return (
                <KanbanCardItem
                  key={lead.id}
                  lead={lead}
                  isIdle={false}
                  allStages={allStages}
                  onStageSelect={onStageSelect}
                  onMarkMeetingDone={
                    stage.key === 'meeting_scheduled' || stage.key === 'site_visit_scheduled'
                      ? onMarkMeetingDone
                      : undefined
                  }
                />
              )
            }

            // If it had a meeting that is in the past, and no follow-up was scheduled:
            if (isPastMeeting) {
              return (
                <KanbanCardItem
                  key={lead.id}
                  lead={lead}
                  isIdle={true}
                  idleBadgeText="Meeting passed — outcome needed"
                  idleBadgeColor="amber"
                  allStages={allStages}
                  onStageSelect={onStageSelect}
                  onMarkMeetingDone={
                    stage.key === 'meeting_scheduled' || stage.key === 'site_visit_scheduled'
                      ? onMarkMeetingDone
                      : undefined
                  }
                />
              )
            }

            // Truly idle (no upcoming meeting, no pending followup)
            return (
              <KanbanCardItem
                key={lead.id}
                lead={lead}
                isIdle={true}
                idleBadgeText="No next action scheduled"
                idleBadgeColor="red"
                allStages={allStages}
                onStageSelect={onStageSelect}
              />
            )
          })}

          {leads.length === 0 && (
            <div
              style={{
                flex: 1,
                minHeight: '140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              No leads in this stage
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function KanbanBoard({
  leads,
  stages,
  profile,
  onLeadMoved,
  onOptimisticMove,
  onFollowupScheduled,
  pendingFollowupLeadIds = [],
}: Props) {
  const supabase = createClient()
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [pendingStageChange, setPendingStageChange] = useState<{
    lead: Lead
    fromStage: LeadStage | null
    toStage: LeadStage
  } | null>(null)

  const pendingLeadIdsSet = new Set(pendingFollowupLeadIds)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const lead = leads.find((l) => l.id === active.id)
    if (lead) setActiveLead(lead)
  }

  async function executeDirectStageMove(lead: Lead, fromStage: LeadStage | null, toStage: LeadStage) {
    // 1. Instant optimistic UI update — card lands in the new column instantly!
    if (onOptimisticMove) {
      onOptimisticMove(lead.id, toStage.id)
    } else {
      lead.stage_id = toStage.id
    }

    let performerId = profile?.id
    if (!performerId) {
      const { data: { user } } = await supabase.auth.getUser()
      performerId = user?.id
    }

    const updates: any[] = [
      supabase.from('leads').update({ stage_id: toStage.id }).eq('id', lead.id),
      supabase.from('lead_stage_history').insert({
        lead_id: lead.id,
        from_stage_id: fromStage?.id || lead.stage_id,
        to_stage_id: toStage.id,
        changed_by: performerId || null,
      }),
      supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'STAGE_CHANGE',
        performed_by: performerId || null,
        metadata: {
          from_stage: fromStage?.label || '—',
          to_stage: toStage.label || '—',
        },
      }),
    ]

    // Auto schedule next action for specific stages so leads don't become idle
    if (toStage.key === 'no_reply') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(10, 0, 0, 0)
      updates.push(
        supabase.from('lead_followups').insert({
          lead_id: lead.id,
          agent_id: lead.assigned_agent_id || performerId,
          scheduled_at: tomorrow.toISOString(),
          note: 'Retry calling lead (no reply)',
          is_completed: false,
        })
      )
      if (onFollowupScheduled) onFollowupScheduled(lead.id)
    } else if (toStage.key === 'meeting_done') {
      const in2Days = new Date()
      in2Days.setDate(in2Days.getDate() + 2)
      in2Days.setHours(11, 0, 0, 0)
      updates.push(
        supabase.from('lead_followups').insert({
          lead_id: lead.id,
          agent_id: lead.assigned_agent_id || performerId,
          scheduled_at: in2Days.toISOString(),
          note: 'Post-meeting follow-up on next steps',
          is_completed: false,
        })
      )
      if (onFollowupScheduled) onFollowupScheduled(lead.id)
    } else if (['won', 'lost'].includes(toStage.key)) {
      updates.push(
        supabase
          .from('lead_followups')
          .update({ is_completed: true, completed_at: new Date().toISOString() })
          .eq('lead_id', lead.id)
          .eq('is_completed', false)
      )
    }

    await Promise.all(updates)
    onLeadMoved()
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveLead(null)

    if (!over) return

    const activeLeadId = active.id as string
    let targetStageId: string | null = null

    // Check if dropped directly on stage droppable
    if (typeof over.id === 'string' && over.id.startsWith('stage-')) {
      targetStageId = over.id.replace('stage-', '')
    } else if (stages.some((s) => s.id === over.id)) {
      targetStageId = over.id as string
    } else {
      // Dropped on a card inside a stage
      const overLead = leads.find((l) => l.id === over.id)
      if (overLead) {
        targetStageId = overLead.stage_id
      }
    }

    if (!targetStageId) return

    const lead = leads.find((l) => l.id === activeLeadId)
    if (lead && lead.stage_id !== targetStageId) {
      const fromStage = stages.find((s) => s.id === lead.stage_id) || null
      const toStage = stages.find((s) => s.id === targetStageId)
      if (!toStage) return

      // Intercept stage changes with action commitment popup modal
      const stagesRequiringIntercept = [
        'contacted',
        'no_reply',
        'followup',
        'qualified',
        'proposal',
        'meeting_scheduled',
        'site_visit_scheduled',
        'meeting_done',
        'negotiation',
        'lost',
        'won',
      ]

      if (stagesRequiringIntercept.includes(toStage.key)) {
        setPendingStageChange({
          lead,
          fromStage,
          toStage,
        })
        return
      }

      await executeDirectStageMove(lead, fromStage, toStage)
    }
  }

  async function handleConfirmStageChange(payload: StageChangePayload) {
    if (!pendingStageChange) return

    const { lead, fromStage, toStage } = pendingStageChange
    const effectiveStageId = payload.targetStageId
    const effectiveStage = stages.find((s) => s.id === effectiveStageId) || toStage

    // INSTANT OPTIMISTIC UPDATE: card lands in target column immediately!
    if (onOptimisticMove) {
      onOptimisticMove(lead.id, effectiveStageId, {
        meeting_date: payload.meetingDate,
        meeting_time: payload.meetingTime,
      })
    } else {
      lead.stage_id = effectiveStageId
      if (payload.meetingDate) lead.meeting_date = payload.meetingDate
      if (payload.meetingTime) lead.meeting_time = payload.meetingTime
    }

    if (payload.followupDate && onFollowupScheduled) {
      onFollowupScheduled(lead.id)
    }

    // Close modal immediately
    setPendingStageChange(null)

    let performerId = profile?.id
    if (!performerId) {
      const { data: { user } } = await supabase.auth.getUser()
      performerId = user?.id
    }

    // Prepare lead update
    const leadUpdate: Record<string, any> = { stage_id: effectiveStageId }
    if (payload.meetingDate) {
      leadUpdate.meeting_date = payload.meetingDate
      leadUpdate.meeting_time = payload.meetingTime || null
    }
    if (payload.lostReason) {
      // Store in form_data JSONB to prevent column does not exist DB error
      leadUpdate.form_data = {
        ...(lead.form_data || {}),
        lost_reason: payload.lostReason,
      }
    }

    const updates: any[] = [
      supabase.from('leads').update(leadUpdate).eq('id', lead.id),
      supabase.from('lead_stage_history').insert({
        lead_id: lead.id,
        from_stage_id: fromStage?.id || lead.stage_id,
        to_stage_id: effectiveStageId,
        changed_by: performerId || null,
      }),
      supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'STAGE_CHANGE',
        performed_by: performerId || null,
        metadata: {
          from_stage: fromStage?.label || '—',
          to_stage: effectiveStage.label || '—',
          outcome: payload.outcome || null,
          note: payload.note || null,
          lost_reason: payload.lostReason || null,
        },
      }),
    ]

    // Save note to lead_notes table so it is NEVER lost!
    let noteBodyToInsert: string | null = null
    if (payload.note && payload.note.trim()) {
      noteBodyToInsert = payload.note.trim()
    } else if (payload.lostReason) {
      noteBodyToInsert = `Marked as Lost. Reason: ${payload.lostReason}`
    }

    if (noteBodyToInsert) {
      updates.push(
        supabase.from('lead_notes').insert({
          lead_id: lead.id,
          author_id: performerId || null,
          body: noteBodyToInsert,
        })
      )
    }

    // Create follow-up record if scheduled
    if (payload.followupDate) {
      updates.push(
        supabase.from('lead_followups').insert({
          lead_id: lead.id,
          agent_id: lead.assigned_agent_id || performerId,
          scheduled_at: payload.followupDate,
          note: payload.followupNote || (payload.outcome ? `Follow-up after ${payload.outcome}` : 'Scheduled follow-up'),
          is_completed: false,
        })
      )
    }

    // If moved to won or lost, clear pending followups
    if (['won', 'lost'].includes(effectiveStage.key)) {
      updates.push(
        supabase
          .from('lead_followups')
          .update({ is_completed: true, completed_at: new Date().toISOString() })
          .eq('lead_id', lead.id)
          .eq('is_completed', false)
      )
    }

    await Promise.all(updates)
    onLeadMoved()
  }

  function handleMarkMeetingDone(targetLead: Lead) {
    const fromStage = stages.find((s) => s.id === targetLead.stage_id) || null
    if (fromStage?.key === 'site_visit_scheduled') {
      // Site Visit -> forward stages (proposal, negotiation, followup, won, lost)
      const forwardStage =
        stages.find((s) => s.key === 'proposal') ||
        stages.find((s) => s.key === 'followup') ||
        fromStage
      setPendingStageChange({
        lead: targetLead,
        fromStage,
        toStage: forwardStage,
      })
    } else {
      const meetingDoneStage = stages.find((s) => s.key === 'meeting_done')
      if (!meetingDoneStage) return
      // Open StageChangeModal for Meeting Done to collect meeting outcome & next follow-up schedule
      setPendingStageChange({
        lead: targetLead,
        fromStage,
        toStage: meetingDoneStage,
      })
    }
  }

  function handleStageSelect(lead: Lead, targetStageId: string) {
    if (lead.stage_id === targetStageId) return

    const fromStage = stages.find((s) => s.id === lead.stage_id) || null
    const toStage = stages.find((s) => s.id === targetStageId)
    if (!toStage) return

    const stagesRequiringIntercept = [
      'contacted',
      'no_reply',
      'followup',
      'qualified',
      'proposal',
      'meeting_scheduled',
      'site_visit_scheduled',
      'meeting_done',
      'negotiation',
      'lost',
      'won',
    ]

    if (stagesRequiringIntercept.includes(toStage.key)) {
      setPendingStageChange({
        lead,
        fromStage,
        toStage,
      })
      return
    }

    executeDirectStageMove(lead, fromStage, toStage)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-grid">
          {stages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage_id === stage.id)
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={stageLeads}
                pendingFollowupLeadIds={pendingLeadIdsSet}
                onMarkMeetingDone={handleMarkMeetingDone}
                allStages={stages}
                onStageSelect={handleStageSelect}
              />
            )
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeLead ? (
            <div style={{ transform: 'rotate(1.5deg)', cursor: 'grabbing', opacity: 0.95, filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.18))' }}>
              <KanbanCardItem lead={activeLead} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingStageChange && (
        <StageChangeModal
          isOpen={true}
          lead={pendingStageChange.lead}
          fromStage={pendingStageChange.fromStage}
          toStage={pendingStageChange.toStage}
          stages={stages}
          currentUserId={profile?.id}
          onConfirm={handleConfirmStageChange}
          onCancel={() => setPendingStageChange(null)}
        />
      )}
    </>
  )
}
