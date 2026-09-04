'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Tag,
  Clock,
  MessageSquare,
  CheckCircle,
  Plus,
  Activity,
  Building,
  DollarSign,
  Send,
  Trash2,
  Edit2,
  X,
  Check,
  Loader2,
  Calendar,
  ExternalLink,
  Globe,
  UserCheck,
  User,
  Search,
} from 'lucide-react'
import {
  CLIENT_CATEGORIES,
  BUDGET_TIERS,
  type Lead,
  type LeadStage,
  type Profile,
  type LeadNote,
  type LeadFollowup,
  type LeadActivity,
  type Project,
} from '@/types/database'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PREDEFINED_CITIES } from '@/lib/cities'
import ConfirmModal from '@/components/ConfirmModal'
import ProjectSearchModal from '@/components/ProjectSearchModal'
import { useEffect } from 'react'

interface Props {
  lead: Lead
  profile: Profile
  stages: LeadStage[]
  agents: { id: string; name: string; email?: string }[]
  notes: LeadNote[]
  followups: LeadFollowup[]
  activities: LeadActivity[]
  projects?: Project[]
}

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://asaheebrealestate.com'

export default function LeadDetailClient({
  lead: initialLead,
  profile,
  stages,
  agents,
  notes: initialNotes,
  followups: initialFollowups,
  activities: initialActivities,
  projects = [],
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = profile?.role === 'ADMIN'
  const isManager = profile?.role === 'SALES_MANAGER'
  const isLeadManager = isAdmin || isManager

  // Local state for instantaneous optimistic UI updates
  const [lead, setLead] = useState<Lead>(initialLead)
  const [notes, setNotes] = useState<LeadNote[]>(initialNotes)
  const [followups, setFollowups] = useState<LeadFollowup[]>(initialFollowups)
  const [activities, setActivities] = useState<LeadActivity[]>(initialActivities)

  // Realtime subscription for activities and notes
  useEffect(() => {
    const channel = supabase
      .channel(`lead-realtime-${lead.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_activities', filter: `lead_id=eq.${lead.id}` },
        (payload) => {
          const newAct = payload.new as LeadActivity
          setActivities((prev) => {
            if (prev.some((a) => a.id === newAct.id)) return prev
            return [{ ...newAct, performer: profile }, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, lead.id, profile])

  // Helper to record activity locally and to Supabase
  async function logActivity(activityType: string, metadata: any = {}) {
    const optimisticAct: LeadActivity = {
      id: crypto.randomUUID(),
      lead_id: lead.id,
      activity_type: activityType,
      created_at: new Date().toISOString(),
      performed_by: profile.id,
      performer: profile,
      metadata,
    }
    setActivities((prev) => [optimisticAct, ...prev])

    try {
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: activityType,
        performed_by: profile.id,
        metadata,
      })
    } catch (err) {
      console.error('Failed to log activity:', err)
    }
  }

  // Edit Lead Modal / Inline State
  const [isEditingLead, setIsEditingLead] = useState(false)
  const isInitialCityPredefined = initialLead.city
    ? PREDEFINED_CITIES.some((c) => c.value.toLowerCase() === initialLead.city?.toLowerCase())
    : true
  const [editForm, setEditForm] = useState({
    name: initialLead.name || '',
    phone: initialLead.phone || '',
    email: initialLead.email || '',
    cityMode: isInitialCityPredefined ? ('PREDEFINED' as 'PREDEFINED' | 'CUSTOM') : ('CUSTOM' as 'PREDEFINED' | 'CUSTOM'),
    city: isInitialCityPredefined ? (initialLead.city || '') : 'CUSTOM',
    customCity: isInitialCityPredefined ? '' : (initialLead.city || ''),
    client_category: initialLead.client_category || '',
    budget_tier: initialLead.budget_tier || '',
    meeting_date: initialLead.meeting_date || '',
    meeting_time: initialLead.meeting_time || '',
    potential_value: initialLead.potential_value ? String(initialLead.potential_value) : '',
    property_type: initialLead.property_type || '',
  })
  const [savingLead, setSavingLead] = useState(false)

  // Edit Property Modal State
  const [isEditingPropertyModal, setIsEditingPropertyModal] = useState(false)
  const [isProjectSearchOpen, setIsProjectSearchOpen] = useState(false)
  const [propertyForm, setPropertyForm] = useState({
    propertyMode: 'NONE' as 'NONE' | 'DB' | 'CUSTOM',
    property_id: '',
    customProperty: '',
    property_type: 'Apartment',
  })
  const [savingProperty, setSavingProperty] = useState(false)

  function handleOpenPropertyEdit() {
    const isDb = Boolean(lead.property_id)
    const isCustom = !isDb && Boolean(lead.interest)
    setPropertyForm({
      propertyMode: isDb ? 'DB' : isCustom ? 'CUSTOM' : 'NONE',
      property_id: lead.property_id || '',
      customProperty: isCustom ? (lead.interest || '') : '',
      property_type: lead.property_type || 'Apartment',
    })
    setIsEditingPropertyModal(true)
  }

  // Edit / Delete Follow-up State
  const [showFollowupForm, setShowFollowupForm] = useState(false)
  const [followupDate, setFollowupDate] = useState('')
  const [followupNote, setFollowupNote] = useState('')
  const [editingFollowupId, setEditingFollowupId] = useState<string | null>(null)
  const [savingFollowup, setSavingFollowup] = useState(false)

  // Notes state
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteBody, setEditNoteBody] = useState('')

  // Delete modals state
  const [showDeleteLeadModal, setShowDeleteLeadModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null)
  const [followupIdToDelete, setFollowupIdToDelete] = useState<string | null>(null)

  // Format exact timestamp
  function formatExactTime(dateStr: string) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Handle Stage change with immediate UI feedback
  async function handleStageChange(newStageId: string) {
    if (newStageId === lead.stage_id) return

    const oldStage = stages.find((s) => s.id === lead.stage_id)
    const newStage = stages.find((s) => s.id === newStageId)

    // Instant local state update
    setLead((prev) => ({ ...prev, stage_id: newStageId, stage: newStage || prev.stage }))
    logActivity('STAGE_CHANGE', {
      from_stage: oldStage?.label || '—',
      to_stage: newStage?.label || '—',
    })

    // Background sync
    await Promise.all([
      supabase.from('leads').update({ stage_id: newStageId }).eq('id', lead.id),
      supabase.from('lead_stage_history').insert({
        lead_id: lead.id,
        from_stage_id: lead.stage_id,
        to_stage_id: newStageId,
        changed_by: profile.id,
      }),
    ])
  }

  // Handle Agent change with immediate UI feedback and duplicate guard
  async function handleAgentChange(newAgentId: string) {
    // Guard against redundant/repeated triggers for the same agent
    if (newAgentId === (lead.assigned_agent_id || '')) return

    const targetAgent = agents.find((a) => a.id === newAgentId)
    setLead((prev) => ({
      ...prev,
      assigned_agent_id: newAgentId || null,
      assigned_agent: targetAgent || null,
    }))

    logActivity('ASSIGNED', { agent_name: targetAgent?.name || 'Unassigned' })
    await supabase.from('leads').update({ assigned_agent_id: newAgentId || null }).eq('id', lead.id)
  }

  // Save Lead Contact Details (Edit Lead)
  async function handleSaveLeadDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.name.trim()) return

    setSavingLead(true)
    const resolvedCity =
      editForm.cityMode === 'CUSTOM'
        ? editForm.customCity.trim() || null
        : editForm.city.trim() || null

    const updatedFields = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      city: resolvedCity,
      client_category: editForm.client_category || null,
      budget_tier: editForm.budget_tier || null,
      meeting_date: editForm.meeting_date || null,
      meeting_time: editForm.meeting_time.trim() || null,
      potential_value: editForm.potential_value ? parseFloat(editForm.potential_value) : null,
      property_type: editForm.property_type || null,
    }

    // Instant local update
    setLead((prev) => ({ ...prev, ...updatedFields }))
    setIsEditingLead(false)

    logActivity('LEAD_UPDATED', { fields: Object.keys(updatedFields) })
    await supabase.from('leads').update(updatedFields).eq('id', lead.id)
    setSavingLead(false)
  }

  // Save Property & Property Type Details
  async function handleSavePropertyDetails(e: React.FormEvent) {
    e.preventDefault()
    setSavingProperty(true)

    let resolvedPropertyId: string | null = null
    let resolvedInterest: string | null = null
    let resolvedPropertyObj: any = null

    if (propertyForm.propertyMode === 'DB' && propertyForm.property_id) {
      resolvedPropertyId = propertyForm.property_id
      const matched = projects.find((p) => p.id === propertyForm.property_id)
      resolvedInterest = matched ? matched.name_en : null
      resolvedPropertyObj = matched ? { id: matched.id, name_en: matched.name_en, name_ar: matched.name_ar } : null
    } else if (propertyForm.propertyMode === 'CUSTOM' && propertyForm.customProperty.trim()) {
      resolvedPropertyId = null
      resolvedInterest = propertyForm.customProperty.trim()
      resolvedPropertyObj = null
    }

    const updatedFields = {
      property_id: resolvedPropertyId,
      interest: resolvedInterest,
      property_type: propertyForm.property_type || null,
    }

    setLead((prev) => ({
      ...prev,
      ...updatedFields,
      property: resolvedPropertyObj,
    }))

    setIsEditingPropertyModal(false)

    logActivity('PROPERTY_UPDATED', {
      property: resolvedInterest || 'General Inquiry',
      property_type: propertyForm.property_type || 'None',
    })

    await supabase.from('leads').update(updatedFields).eq('id', lead.id)
    setSavingProperty(false)
  }

  // Add Note with instant UI feedback
  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNote.trim()) return

    const noteBody = newNote.trim()
    setNewNote('')

    const optimisticNote: LeadNote = {
      id: crypto.randomUUID(),
      lead_id: lead.id,
      author_id: profile.id,
      body: noteBody,
      created_at: new Date().toISOString(),
      author: profile,
    }
    setNotes((prev) => [optimisticNote, ...prev])
    logActivity('NOTE_ADDED', { snippet: noteBody.slice(0, 50) })

    const { data } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: lead.id,
        author_id: profile.id,
        body: noteBody,
      })
      .select('*, author:profiles(id, name, email)')
      .single()

    if (data) {
      setNotes((prev) => [data, ...prev.filter((n) => n.id !== optimisticNote.id)])
    }
  }

  // Edit Note
  async function handleSaveEditedNote(noteId: string) {
    if (!editNoteBody.trim()) return

    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, body: editNoteBody.trim() } : n))
    )
    setEditingNoteId(null)
    logActivity('NOTE_UPDATED', { snippet: editNoteBody.slice(0, 50) })

    await supabase.from('lead_notes').update({ body: editNoteBody.trim() }).eq('id', noteId)
  }

  // Delete Note
  async function executeDeleteNote() {
    if (!noteIdToDelete) return
    const id = noteIdToDelete
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setNoteIdToDelete(null)
    logActivity('NOTE_DELETED')

    await supabase.from('lead_notes').delete().eq('id', id)
  }

  // Save / Schedule Followup
  async function handleSaveFollowup(e: React.FormEvent) {
    e.preventDefault()
    if (!followupDate) return

    setSavingFollowup(true)
    const isoDate = new Date(followupDate).toISOString()

    if (editingFollowupId) {
      // Edit existing
      setFollowups((prev) =>
        prev.map((f) =>
          f.id === editingFollowupId
            ? { ...f, scheduled_at: isoDate, note: followupNote.trim() || null }
            : f
        )
      )
      setShowFollowupForm(false)
      setEditingFollowupId(null)
      logActivity('FOLLOWUP_UPDATED', { date: followupDate })

      await supabase
        .from('lead_followups')
        .update({ scheduled_at: isoDate, note: followupNote.trim() || null })
        .eq('id', editingFollowupId)
    } else {
      // Create new
      const optimisticFollowup: LeadFollowup = {
        id: crypto.randomUUID(),
        lead_id: lead.id,
        agent_id: profile.id,
        scheduled_at: isoDate,
        note: followupNote.trim() || null,
        is_completed: false,
        reminder_sent: false,
        created_at: new Date().toISOString(),
        agent: profile,
      }
      setFollowups((prev) => [optimisticFollowup, ...prev])
      setShowFollowupForm(false)
      logActivity('FOLLOWUP_SCHEDULED', { date: followupDate })

      const { data } = await supabase
        .from('lead_followups')
        .insert({
          lead_id: lead.id,
          agent_id: profile.id,
          scheduled_at: isoDate,
          note: followupNote.trim() || null,
          is_completed: false,
        })
        .select('*, agent:profiles(id, name, email)')
        .single()

      if (data) {
        setFollowups((prev) => [data, ...prev.filter((f) => f.id !== optimisticFollowup.id)])
      }
    }

    setFollowupDate('')
    setFollowupNote('')
    setSavingFollowup(false)
  }

  // Toggle complete followup
  async function handleToggleFollowup(followupId: string, currentStatus: boolean) {
    const nextStatus = !currentStatus
    setFollowups((prev) =>
      prev.map((f) =>
        f.id === followupId
          ? { ...f, is_completed: nextStatus, completed_at: nextStatus ? new Date().toISOString() : null }
          : f
      )
    )

    logActivity(nextStatus ? 'FOLLOWUP_COMPLETED' : 'FOLLOWUP_UPDATED')

    await supabase
      .from('lead_followups')
      .update({
        is_completed: nextStatus,
        completed_at: nextStatus ? new Date().toISOString() : null,
      })
      .eq('id', followupId)
  }

  // Delete Follow-up
  async function executeDeleteFollowup() {
    if (!followupIdToDelete) return
    const id = followupIdToDelete
    setFollowups((prev) => prev.filter((f) => f.id !== id))
    setFollowupIdToDelete(null)
    logActivity('FOLLOWUP_DELETED')

    await supabase.from('lead_followups').delete().eq('id', id)
  }

  // Delete Lead
  async function executeDeleteLead() {
    setIsDeleting(true)
    const res = await fetch('/api/leads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id }),
    })

    if (res.ok) {
      router.push('/leads')
    } else {
      alert('Failed to delete lead')
      setIsDeleting(false)
      setShowDeleteLeadModal(false)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            href="/leads"
            className="btn btn-outline btn-icon"
            style={{ borderRadius: '50%', color: '#0F172A' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 className="text-page-title" style={{ fontSize: 20 }}>{lead.name || 'Unnamed Lead'}</h1>
              <span className="badge badge-source">{lead.source}</span>
            </div>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Created on {formatDate(lead.created_at)} ({formatExactTime(lead.created_at)})
            </p>
          </div>
        </div>

        {/* Action Controls & Delete Lead */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Stage Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Stage:</span>
            <select
              value={lead.stage_id}
              onChange={(e) => handleStageChange(e.target.value)}
              className="form-select"
              style={{ width: 'auto', fontSize: 12.5, padding: '5px 10px' }}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Agent Selector / Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Assigned Agent:</span>
            {isLeadManager ? (
              <select
                value={lead.assigned_agent_id || ''}
                onChange={(e) => handleAgentChange(e.target.value)}
                className="form-select"
                style={{ width: 'auto', fontSize: 12.5, padding: '5px 10px', height: 32 }}
              >
                <option value="">⚡ Unassigned / Pool</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="badge badge-secondary" style={{ fontSize: 12, fontWeight: 700, backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                {lead.assigned_agent?.name || agents.find((a) => a.id === lead.assigned_agent_id)?.name || 'Unassigned'}
              </span>
            )}
          </div>

          {/* Delete Lead Button */}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteLeadModal(true)}
              disabled={isDeleting}
              className="btn btn-danger btn-sm"
              title="Delete Lead"
            >
              <Trash2 size={14} />
              <span>Delete Lead</span>
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Layout Grid */}
        <div className="lead-detail-grid">
          {/* Left Column: Lead Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Assigned Sales Agent Card */}
            <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #0284C7' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <h3 className="text-section-header" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  <UserCheck size={16} style={{ color: '#0284C7' }} />
                  <span>Assigned Sales Agent</span>
                </h3>
                {isLeadManager && (
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                    {lead.assigned_agent_id ? 'Re-assignable' : 'Unassigned'}
                  </span>
                )}
              </div>

              {(() => {
                const assignedAgentObj = lead.assigned_agent || agents.find((a) => a.id === lead.assigned_agent_id)
                if (assignedAgentObj) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          backgroundColor: '#1E3A8A',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 14,
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(30, 58, 138, 0.2)',
                        }}>
                          {assignedAgentObj.name ? assignedAgentObj.name.substring(0, 2).toUpperCase() : 'AG'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {assignedAgentObj.name}
                          </div>
                          {assignedAgentObj.email && (
                            <div style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {assignedAgentObj.email}
                            </div>
                          )}
                        </div>
                      </div>

                      {isLeadManager && (
                        <div style={{ marginTop: 4 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Change Assigned Agent:</label>
                          <select
                            value={lead.assigned_agent_id || ''}
                            onChange={(e) => handleAgentChange(e.target.value)}
                            className="form-select"
                            style={{ width: '100%', fontSize: 12, height: 32 }}
                          >
                            <option value="">Remove Assignment (Unassign)</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ color: '#D97706', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', padding: '8px 12px', borderRadius: 6, border: '1px solid #FDE68A' }}>
                      <span>⚠️ Unassigned Lead</span>
                    </div>
                    {isLeadManager ? (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Assign Sales Agent:</label>
                        <select
                          value=""
                          onChange={(e) => handleAgentChange(e.target.value)}
                          className="form-select"
                          style={{ width: '100%', fontSize: 12, height: 32 }}
                        >
                          <option value="">Select Agent to Assign...</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>
                        No sales agent has been assigned to this lead yet.
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Contact Details Card */}
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <h3 className="text-section-header">Contact &amp; Profile</h3>
                <button
                  onClick={() => {
                    const isPredefined = lead.city
                      ? PREDEFINED_CITIES.some((c) => c.value.toLowerCase() === lead.city?.toLowerCase())
                      : true
                    const matchedCity = isPredefined && lead.city
                      ? PREDEFINED_CITIES.find((c) => c.value.toLowerCase() === lead.city?.toLowerCase())?.value || lead.city
                      : ''

                    setEditForm({
                      name: lead.name || '',
                      phone: lead.phone || '',
                      email: lead.email || '',
                      cityMode: isPredefined ? 'PREDEFINED' : 'CUSTOM',
                      city: isPredefined ? matchedCity : 'CUSTOM',
                      customCity: isPredefined ? '' : (lead.city || ''),
                      client_category: lead.client_category || '',
                      budget_tier: lead.budget_tier || '',
                      meeting_date: lead.meeting_date || '',
                      meeting_time: lead.meeting_time || '',
                      potential_value: lead.potential_value ? String(lead.potential_value) : '',
                      property_type: lead.property_type || '',
                    })
                    setIsEditingLead(true)
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--accent)', padding: '2px 6px' }}
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Phone size={16} style={{ color: '#3B82F6' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>PHONE</div>
                    <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13.5 }}>
                      {lead.phone || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mail size={16} style={{ color: '#8B5CF6' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>EMAIL</div>
                    <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13.5 }}>
                      {lead.email || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapPin size={16} style={{ color: '#F59E0B' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>CITY / REGION</div>
                    <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13.5 }}>
                      {lead.city || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Tag size={16} style={{ color: '#6366F1' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>CLIENT CATEGORY</div>
                    {lead.client_category ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: lead.client_category === 'VIP' ? '#FEF3C7' : '#EEF2FF',
                            color: lead.client_category === 'VIP' ? '#B45309' : '#4338CA',
                            border: lead.client_category === 'VIP' ? '1px solid #FCD34D' : '1px solid #C7D2FE',
                          }}
                        >
                          {lead.client_category === 'VIP' ? '👑 VIP' : `🏷️ ${lead.client_category}`}
                        </span>
                      </div>
                    ) : (
                      <div style={{ color: '#94A3B8', fontSize: 13 }}>Not categorized</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <DollarSign size={16} style={{ color: '#10B981' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>BUDGET &amp; VALUE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      {lead.budget_tier && (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: '#ECFDF5',
                            color: '#047857',
                            border: '1px solid #A7F3D0',
                          }}
                        >
                          {lead.budget_tier}
                        </span>
                      )}
                      <span style={{ color: '#10B981', fontWeight: 700, fontSize: 14 }}>
                        {formatCurrency(lead.potential_value)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scheduled Meeting Info */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Calendar size={16} style={{ color: '#2563EB', marginTop: 2 }} />
                  <div style={{ width: '100%' }}>
                    <div className="text-label" style={{ fontSize: 11 }}>SCHEDULED MEETING</div>
                    {lead.meeting_date ? (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '6px 10px',
                          backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '12.5px',
                          color: '#1E40AF',
                          fontWeight: 600,
                        }}
                      >
                        <span>📅 {formatDate(lead.meeting_date)}</span>
                        {lead.meeting_time && <span>⏰ {lead.meeting_time}</span>}
                      </div>
                    ) : (
                      <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>No meeting scheduled</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Property & Attribution Card */}
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <h3 className="text-section-header">
                  Property &amp; Source
                </h3>
                <button
                  onClick={handleOpenPropertyEdit}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--accent)', padding: '2px 6px' }}
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Building size={16} style={{ color: '#D97706', marginTop: '2px' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>PROJECT / PROPERTY</div>
                    <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{lead.property ? lead.property.name_en : (lead.interest || 'General Inquiry')}</span>
                      {(lead.property_id || lead.property?.id) && (
                        <a
                          href={`${WEBSITE_URL}/projects/${lead.property_id || lead.property?.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{
                            fontSize: '11px',
                            color: '#2563EB',
                            padding: '1px 6px',
                            height: '22px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#EFF6FF',
                            borderRadius: '4px',
                          }}
                          title="Open Property Page on Public Website"
                        >
                          <Globe size={11} />
                          <span>View on Website</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Property Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Building size={16} style={{ color: '#6366F1', marginTop: '1px' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>PROPERTY TYPE</div>
                    <div style={{ marginTop: 3 }}>
                      {lead.property_type ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            backgroundColor: '#EEF2FF',
                            color: '#4338CA',
                            border: '1px solid #C7D2FE',
                          }}
                        >
                          🏠 {lead.property_type}
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: 13 }}>
                          Not specified (Click Edit to set)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {lead.campaign && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Tag size={16} style={{ color: '#0284C7' }} />
                    <div>
                      <div className="text-label" style={{ fontSize: 11 }}>MARKETING CAMPAIGN</div>
                      <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13.5 }}>
                        {lead.campaign.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Website Form Submission / Ingestion Data Card */}
            {lead.form_data && Object.keys(lead.form_data).length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between" style={{ marginBottom: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                  <h3 className="text-section-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={15} style={{ color: '#0284C7' }} />
                    <span>Website Inquiry Details</span>
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#EFF6FF',
                      color: '#1D4ED8',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {lead.form_data.form_type || lead.source}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lead.form_data.message && (
                    <div>
                      <div className="text-label" style={{ fontSize: 11, marginBottom: 4 }}>MESSAGE</div>
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                          color: '#0F172A',
                          fontSize: '13px',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {lead.form_data.message}
                      </div>
                    </div>
                  )}

                  {lead.form_data.budget && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <DollarSign size={16} style={{ color: '#10B981' }} />
                      <div>
                        <div className="text-label" style={{ fontSize: 11 }}>BUDGET RANGE</div>
                        <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13 }}>
                          {lead.form_data.budget}
                        </div>
                      </div>
                    </div>
                  )}

                  {lead.form_data.project_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Building size={16} style={{ color: '#D97706' }} />
                      <div>
                        <div className="text-label" style={{ fontSize: 11 }}>TARGET PROPERTY</div>
                        <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{lead.form_data.project_name}</span>
                          {(lead.property_id || lead.property?.id) && (
                            <a
                              href={`${WEBSITE_URL}/projects/${lead.property_id || lead.property?.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              style={{
                                fontSize: '11px',
                                color: '#2563EB',
                                padding: '1px 6px',
                                height: '22px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#EFF6FF',
                                borderRadius: '4px',
                              }}
                              title="Open Property on Public Website"
                            >
                              <Globe size={11} />
                              <span>View on Website</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {lead.form_data.submitted_at && (
                    <div style={{ fontSize: '11.5px', color: '#64748B', borderTop: '1px dashed #E2E8F0', paddingTop: '8px', marginTop: '2px' }}>
                      Submitted on website: {new Date(lead.form_data.submitted_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Follow-ups, Notes & Activity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Follow-ups Section */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-section-header flex items-center gap-2">
                  <Clock size={15} style={{ color: '#0284C7' }} />
                  <span>Scheduled Follow-ups</span>
                </h3>

                <button
                  onClick={() => {
                    setEditingFollowupId(null)
                    setFollowupDate('')
                    setFollowupNote('')
                    setShowFollowupForm(!showFollowupForm)
                  }}
                  className="btn btn-outline btn-sm"
                >
                  <Plus size={13} />
                  <span>Schedule Follow-up</span>
                </button>
              </div>

              {/* Schedule / Edit Form */}
              {showFollowupForm && (
                <form onSubmit={handleSaveFollowup} style={{
                  backgroundColor: '#F8FAFC',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  marginBottom: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label">Date &amp; Time *</label>
                      <input
                        type="datetime-local"
                        required
                        value={followupDate}
                        onChange={(e) => setFollowupDate(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Reminder Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Call back regarding unit pricing"
                        value={followupNote}
                        onChange={(e) => setFollowupNote(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFollowupForm(false)
                        setEditingFollowupId(null)
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingFollowup}
                      className="btn btn-primary btn-sm"
                    >
                      {savingFollowup ? 'Saving...' : editingFollowupId ? 'Update Follow-up' : 'Save Follow-up'}
                    </button>
                  </div>
                </form>
              )}

              {/* Follow-ups List with Edit & Delete */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {followups.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 6,
                      backgroundColor: f.is_completed ? '#F8FAFC' : '#FFFFFF',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        onClick={() => handleToggleFollowup(f.id, f.is_completed)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: f.is_completed ? '#10B981' : '#94A3B8' }}
                      >
                        <CheckCircle size={18} />
                      </button>
                      <div>
                        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, textDecoration: f.is_completed ? 'line-through' : 'none' }}>
                          {f.note || 'Follow-up call'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                          {formatExactTime(f.scheduled_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingFollowupId(f.id)
                          // Format for input datetime-local
                          const d = new Date(f.scheduled_at)
                          const pad = (n: number) => String(n).padStart(2, '0')
                          const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                          setFollowupDate(formatted)
                          setFollowupNote(f.note || '')
                          setShowFollowupForm(true)
                        }}
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Edit Follow-up"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        onClick={() => setFollowupIdToDelete(f.id)}
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: '#EF4444' }}
                        title="Delete Follow-up"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {followups.length === 0 && !showFollowupForm && (
                  <div style={{ color: '#94A3B8', fontSize: 12.5, textAlign: 'center', padding: '16px 0' }}>
                    No scheduled follow-ups.
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section with Edit & Delete */}
            <div className="card">
              <h3 className="text-section-header flex items-center gap-2" style={{ marginBottom: 14 }}>
                <MessageSquare size={15} style={{ color: '#8B5CF6' }} />
                <span>Notes &amp; Discussion</span>
              </h3>

              {/* Note input */}
              <form onSubmit={handleAddNote} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    rows={2}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a discussion note or requirement update..."
                    className="form-textarea"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    disabled={!newNote.trim()}
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-end', padding: '8px 12px' }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>

              {/* Notes List with inline Edit & Delete */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 6,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                        {n.author?.name || 'Agent'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 11, color: '#64748B' }}>
                          {formatExactTime(n.created_at)}
                        </span>
                        <button
                          onClick={() => {
                            setEditingNoteId(n.id)
                            setEditNoteBody(n.body)
                          }}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ padding: 2 }}
                          title="Edit Note"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setNoteIdToDelete(n.id)}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: '#EF4444', padding: 2 }}
                          title="Delete Note"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {editingNoteId === n.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        <textarea
                          rows={2}
                          value={editNoteBody}
                          onChange={(e) => setEditNoteBody(e.target.value)}
                          className="form-textarea"
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="btn btn-ghost btn-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditedNote(n.id)}
                            className="btn btn-primary btn-sm"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#0F172A', whiteSpace: 'pre-wrap' }}>
                        {n.body}
                      </div>
                    )}
                  </div>
                ))}

                {notes.length === 0 && (
                  <div style={{ color: '#94A3B8', fontSize: 12.5, textAlign: 'center', padding: '16px 0' }}>
                    No notes recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Activity History with Exact Timestamp */}
            <div className="card">
              <h3 className="text-section-header flex items-center gap-2" style={{ marginBottom: 12 }}>
                <Activity size={15} style={{ color: '#10B981' }} />
                <span>Activity History</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activities.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                      paddingBlock: 6,
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="badge badge-source" style={{ fontSize: 10.5 }}>
                        {a.activity_type}
                      </span>
                      <span style={{ color: '#64748B' }}>
                        by <strong style={{ color: '#0F172A' }}>{a.performer?.name || 'System'}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                      {formatExactTime(a.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Lead Modal */}
      {isEditingLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="text-section-header">Edit Lead Information</h3>
              <button
                onClick={() => setIsEditingLead(false)}
                className="btn btn-ghost btn-icon"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLeadDetails}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City / Region</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <select
                      value={editForm.cityMode === 'CUSTOM' ? 'CUSTOM' : editForm.city}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'CUSTOM') {
                          setEditForm({ ...editForm, cityMode: 'CUSTOM', city: 'CUSTOM', customCity: '' })
                        } else {
                          setEditForm({ ...editForm, cityMode: 'PREDEFINED', city: val, customCity: '' })
                        }
                      }}
                      className="form-select"
                    >
                      <option value="">Select City / None</option>
                      <optgroup label="Saudi Arabia">
                        {PREDEFINED_CITIES.filter((c) => c.group === 'Saudi Arabia').map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="UAE & GCC">
                        {PREDEFINED_CITIES.filter((c) => c.group === 'UAE & GCC').map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                      <option value="CUSTOM">➕ Custom City (Free text)</option>
                    </select>

                    {editForm.cityMode === 'CUSTOM' && (
                      <input
                        type="text"
                        autoFocus
                        value={editForm.customCity}
                        onChange={(e) => setEditForm({ ...editForm, customCity: e.target.value })}
                        placeholder="Type custom city name..."
                        className="form-input"
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Client Category</label>
                  <select
                    value={editForm.client_category}
                    onChange={(e) => setEditForm({ ...editForm, client_category: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Client Category...</option>
                    {CLIENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label} — {cat.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Budget Tier</label>
                  <select
                    value={editForm.budget_tier}
                    onChange={(e) => setEditForm({ ...editForm, budget_tier: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Budget Tier...</option>
                    {BUDGET_TIERS.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Estimated Deal Value (SAR)</label>
                  <input
                    type="number"
                    value={editForm.potential_value}
                    onChange={(e) => setEditForm({ ...editForm, potential_value: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Scheduled Meeting section */}
                <div className="form-group" style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Calendar size={14} style={{ color: '#2563EB' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Client Meeting Schedule</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Date</label>
                      <input
                        type="date"
                        value={editForm.meeting_date}
                        onChange={(e) => setEditForm({ ...editForm, meeting_date: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Time</label>
                      <input
                        type="time"
                        value={editForm.meeting_time}
                        onChange={(e) => setEditForm({ ...editForm, meeting_time: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsEditingLead(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="btn btn-primary"
                >
                  {savingLead ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Property & Inquired Project Modal */}
      {isEditingPropertyModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                  Edit Property &amp; Inquired Project
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                  Update the linked project and property type for this lead
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingPropertyModal(false)}
                className="btn btn-ghost btn-icon"
                style={{ color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePropertyDetails} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Associated Project */}
                <div className="form-group">
                  <label className="form-label flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building size={14} style={{ color: '#2563EB' }} />
                      <span>Associated Property / Project</span>
                    </span>
                    {propertyForm.propertyMode !== 'NONE' && (
                      <button
                        type="button"
                        onClick={() => setPropertyForm({ ...propertyForm, propertyMode: 'NONE', property_id: '', customProperty: '' })}
                        className="btn btn-ghost btn-xs"
                        style={{ color: '#94A3B8', fontSize: '11px', padding: '1px 6px' }}
                      >
                        Clear Selection
                      </button>
                    )}
                  </label>

                  {propertyForm.propertyMode === 'DB' && propertyForm.property_id && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: '#EFF6FF',
                        border: '1.5px solid #93C5FD',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            backgroundColor: '#DBEAFE',
                            color: '#1D4ED8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Building size={18} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1E3A8A' }}>
                              {projects.find((p) => p.id === propertyForm.property_id)?.name_en || 'Selected Project'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', color: '#60A5FA', marginTop: 2 }}>
                            {projects.find((p) => p.id === propertyForm.property_id)?.city_en && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#2563EB' }}>
                                <MapPin size={11} />
                                {projects.find((p) => p.id === propertyForm.property_id)?.city_en}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setIsProjectSearchOpen(true)}
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '5px 10px', height: 'auto', borderRadius: 6 }}
                        >
                          <Search size={13} style={{ marginRight: 4 }} />
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => setPropertyForm({ ...propertyForm, propertyMode: 'NONE', property_id: '', customProperty: '' })}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: '#64748B', padding: 4 }}
                          title="Remove project"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {propertyForm.propertyMode === 'CUSTOM' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          autoFocus
                          value={propertyForm.customProperty}
                          onChange={(e) => setPropertyForm({ ...propertyForm, customProperty: e.target.value })}
                          placeholder="Type property name (e.g. Al Narjis Luxury Villa, Compound Unit 4)"
                          className="form-input"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => setIsProjectSearchOpen(true)}
                          className="btn btn-sm btn-secondary"
                          style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Search size={14} />
                          <span>Search Database</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {propertyForm.propertyMode === 'NONE' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setIsProjectSearchOpen(true)}
                        className="form-input"
                        style={{
                          flex: '1 1 240px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          textAlign: 'left',
                          backgroundColor: '#F8FAFC',
                          border: '1.5px dashed #CBD5E1',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          color: '#64748B',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
                          <Search size={15} style={{ color: '#2563EB' }} />
                          <span>Click to search project in database...</span>
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: '#EFF6FF',
                            color: '#2563EB',
                            padding: '3px 8px',
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        >
                          Browse ({projects.length})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPropertyForm({ ...propertyForm, propertyMode: 'CUSTOM', customProperty: '' })}
                        className="btn btn-ghost btn-sm"
                        style={{
                          color: '#475569',
                          fontSize: '0.78rem',
                          padding: '8px 12px',
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        + Custom Property
                      </button>
                    </div>
                  )}
                </div>

                {/* Property Type Field */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building size={13} style={{ color: '#2563EB' }} />
                    <span>Property Type</span>
                    {propertyForm.propertyMode === 'DB' && propertyForm.property_type && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: '#059669',
                          padding: '2px 7px',
                          borderRadius: '20px',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        Inherited from project
                      </span>
                    )}
                  </label>

                  <select
                    value={propertyForm.property_type}
                    onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Property Type...</option>
                    <optgroup label="Residential">
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Townhouse">Townhouse</option>
                      <option value="Duplex">Duplex</option>
                      <option value="Studio">Studio</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Compound Unit">Compound Unit</option>
                      <option value="Chalet">Chalet</option>
                    </optgroup>
                    <optgroup label="Commercial">
                      <option value="Office Space">Office Space</option>
                      <option value="Retail / Shop">Retail / Shop</option>
                      <option value="Showroom">Showroom</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Commercial Building">Commercial Building</option>
                    </optgroup>
                    <optgroup label="Land">
                      <option value="Residential Land">Residential Land</option>
                      <option value="Commercial Land">Commercial Land</option>
                      <option value="Agricultural Land">Agricultural Land</option>
                      <option value="Mixed-Use Land">Mixed-Use Land</option>
                    </optgroup>
                    <option value="Mixed-Use">Mixed-Use</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsEditingPropertyModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProperty}
                  className="btn btn-primary"
                >
                  {savingProperty ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Search Modal Triggered From Edit Property Modal */}
      <ProjectSearchModal
        isOpen={isProjectSearchOpen}
        projects={projects}
        selectedProjectId={propertyForm.property_id}
        customPropertyName={propertyForm.customProperty}
        propertyMode={propertyForm.propertyMode}
        onSelectProject={(proj) => {
          setPropertyForm({
            ...propertyForm,
            propertyMode: 'DB',
            property_id: proj.id,
            customProperty: '',
            property_type: proj.type_en || propertyForm.property_type || 'Apartment',
          })
          setIsProjectSearchOpen(false)
        }}
        onSelectNone={() => {
          setPropertyForm({
            ...propertyForm,
            propertyMode: 'NONE',
            property_id: '',
            customProperty: '',
          })
          setIsProjectSearchOpen(false)
        }}
        onSelectCustom={(customName) => {
          setPropertyForm({
            ...propertyForm,
            propertyMode: 'CUSTOM',
            property_id: '',
            customProperty: customName,
          })
          setIsProjectSearchOpen(false)
        }}
        onClose={() => setIsProjectSearchOpen(false)}
      />

      {/* Delete Lead Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteLeadModal}
        title="Delete Lead"
        message={
          <>
            Are you sure you want to completely delete <strong>"{lead.name || 'this lead'}"</strong>? This will permanently remove all associated notes, scheduled follow-ups, and activity history. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Lead"
        variant="danger"
        loading={isDeleting}
        onConfirm={executeDeleteLead}
        onCancel={() => setShowDeleteLeadModal(false)}
      />

      {/* Delete Note Confirmation Modal */}
      <ConfirmModal
        isOpen={!!noteIdToDelete}
        title="Delete Discussion Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete Note"
        variant="danger"
        onConfirm={executeDeleteNote}
        onCancel={() => setNoteIdToDelete(null)}
      />

      {/* Delete Follow-up Confirmation Modal */}
      <ConfirmModal
        isOpen={!!followupIdToDelete}
        title="Delete Scheduled Follow-up"
        message="Are you sure you want to delete this scheduled follow-up reminder?"
        confirmLabel="Delete Follow-up"
        variant="danger"
        onConfirm={executeDeleteFollowup}
        onCancel={() => setFollowupIdToDelete(null)}
      />
    </div>
  )
}
