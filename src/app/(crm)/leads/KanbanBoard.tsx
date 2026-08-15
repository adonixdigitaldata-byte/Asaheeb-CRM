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
} from 'lucide-react'
import type { Lead, LeadStage, Profile } from '@/types/database'
import { formatTimeAgo } from '@/lib/utils'

interface Props {
  leads: Lead[]
  stages: LeadStage[]
  profile?: Profile
  onLeadMoved: () => void
}

function KanbanCardItem({
  lead,
  isOverlay = false,
}: {
  lead: Lead
  isOverlay?: boolean
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
    transition,
    opacity: isDragging ? 0.25 : 1,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="kanban-card"
      onClick={() => {
        if (!isDragging) {
          router.push(`/leads/${lead.id}`)
        }
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div
          className="kanban-card-title"
          style={{ cursor: 'pointer' }}
          title={lead.name || 'Unnamed Lead'}
        >
          {lead.name || 'Unnamed Lead'}
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

      {/* Footer Info: Time & Agent Circle */}
      <div className="flex items-center justify-between" style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#64748B' }}>
        <span>{formatTimeAgo(lead.created_at)}</span>

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
            }}
            title={`Assigned to ${lead.assigned_agent?.name}`}
          >
            {agentInitial}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: '#94A3B8' }}>—</span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({
  stage,
  leads,
}: {
  stage: LeadStage
  leads: Lead[]
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: { stageId: stage.id },
  })

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
          {leads.map((lead) => (
            <KanbanCardItem key={lead.id} lead={lead} />
          ))}

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

export default function KanbanBoard({ leads, stages, profile, onLeadMoved }: Props) {
  const supabase = createClient()
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

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
      const fromStage = stages.find((s) => s.id === lead.stage_id)
      const toStage = stages.find((s) => s.id === targetStageId)

      // Optimistic update
      lead.stage_id = targetStageId
      onLeadMoved()

      // Resolve user id who performed the move
      let performerId = profile?.id
      if (!performerId) {
        const { data: { user } } = await supabase.auth.getUser()
        performerId = user?.id
      }

      // Record stage transition history and activity with the actual user profile id
      await Promise.all([
        supabase.from('leads').update({ stage_id: targetStageId }).eq('id', activeLeadId),
        supabase.from('lead_stage_history').insert({
          lead_id: activeLeadId,
          from_stage_id: lead.stage_id,
          to_stage_id: targetStageId,
          changed_by: performerId || null,
        }),
        supabase.from('lead_activities').insert({
          lead_id: activeLeadId,
          activity_type: 'STAGE_CHANGE',
          performed_by: performerId || null,
          metadata: {
            from_stage: fromStage?.label || '—',
            to_stage: toStage?.label || '—',
          },
        }),
      ])

      onLeadMoved()
    }
  }

  return (
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
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeLead ? <KanbanCardItem lead={activeLead} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
