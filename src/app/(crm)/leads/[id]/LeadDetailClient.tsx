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
} from 'lucide-react'
import type {
  Lead,
  LeadStage,
  Profile,
  LeadNote,
  LeadFollowup,
  LeadActivity,
  Project,
} from '@/types/database'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  lead: Lead
  profile: Profile
  stages: LeadStage[]
  agents: { id: string; name: string }[]
  notes: LeadNote[]
  followups: LeadFollowup[]
  activities: LeadActivity[]
  projects?: Project[]
}

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

  // Local state for instantaneous optimistic UI updates
  const [lead, setLead] = useState<Lead>(initialLead)
  const [notes, setNotes] = useState<LeadNote[]>(initialNotes)
  const [followups, setFollowups] = useState<LeadFollowup[]>(initialFollowups)
  const [activities, setActivities] = useState<LeadActivity[]>(initialActivities)

  // Edit Lead Modal / Inline State
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [editForm, setEditForm] = useState({
    name: initialLead.name || '',
    phone: initialLead.phone || '',
    email: initialLead.email || '',
    city: initialLead.city || '',
    potential_value: initialLead.potential_value ? String(initialLead.potential_value) : '',
  })
  const [savingLead, setSavingLead] = useState(false)

  // Edit Property Modal State
  const [isEditingProperty, setIsEditingProperty] = useState(false)
  const [propertyEditMode, setPropertyEditMode] = useState<'NONE' | 'DB' | 'CUSTOM'>('NONE')
  const [selectedPropertyId, setSelectedPropertyId] = useState(initialLead.property_id || '')
  const [customPropertyName, setCustomPropertyName] = useState(initialLead.interest || '')
  const [savingProperty, setSavingProperty] = useState(false)

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

  // Delete lead state
  const [isDeleting, setIsDeleting] = useState(false)

  const isAdmin = profile?.role === 'ADMIN'

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

    const newActivity: LeadActivity = {
      id: crypto.randomUUID(),
      lead_id: lead.id,
      activity_type: 'STAGE_CHANGE',
      created_at: new Date().toISOString(),
      performer: profile,
      metadata: {
        from_stage: oldStage?.label || '—',
        to_stage: newStage?.label || '—',
      },
    }
    setActivities((prev) => [newActivity, ...prev])

    // Background sync
    await Promise.all([
      supabase.from('leads').update({ stage_id: newStageId }).eq('id', lead.id),
      supabase.from('lead_stage_history').insert({
        lead_id: lead.id,
        from_stage_id: lead.stage_id,
        to_stage_id: newStageId,
        changed_by: profile.id,
      }),
      supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'STAGE_CHANGE',
        performed_by: profile.id,
        metadata: {
          from_stage: oldStage?.label || '—',
          to_stage: newStage?.label || '—',
        },
      }),
    ])
  }

  // Handle Agent change with immediate UI feedback
  async function handleAgentChange(newAgentId: string) {
    const targetAgent = agents.find((a) => a.id === newAgentId)
    setLead((prev) => ({
      ...prev,
      assigned_agent_id: newAgentId || null,
      assigned_agent: targetAgent || null,
    }))

    const newActivity: LeadActivity = {
      id: crypto.randomUUID(),
      lead_id: lead.id,
      activity_type: 'ASSIGNED',
      created_at: new Date().toISOString(),
      performer: profile,
      metadata: { agent_name: targetAgent?.name || 'Unassigned' },
    }
    setActivities((prev) => [newActivity, ...prev])

    await Promise.all([
      supabase.from('leads').update({ assigned_agent_id: newAgentId || null }).eq('id', lead.id),
      supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'ASSIGNED',
        performed_by: profile.id,
        metadata: { agent_name: targetAgent?.name || 'Unassigned' },
      }),
    ])
  }

  // Save Lead Contact Details (Edit Lead)
  async function handleSaveLeadDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.name.trim()) return

    setSavingLead(true)
    const updatedFields = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      city: editForm.city.trim() || null,
      potential_value: editForm.potential_value ? parseFloat(editForm.potential_value) : null,
    }

    // Instant local update
    setLead((prev) => ({ ...prev, ...updatedFields }))
    setIsEditingLead(false)

    await supabase.from('leads').update(updatedFields).eq('id', lead.id)
    setSavingLead(false)
  }

  // Save Property & Interest Details
  async function handleSaveProperty(e: React.FormEvent) {
    e.preventDefault()
    setSavingProperty(true)

    let updatedPropertyId: string | null = null
    let updatedInterest: string | null = null
    let updatedPropertyObj: any = null

    if (propertyEditMode === 'DB' && selectedPropertyId) {
      updatedPropertyId = selectedPropertyId
      const p = projects.find((proj) => proj.id === selectedPropertyId)
      updatedInterest = p ? p.name_en : null
      updatedPropertyObj = p ? { id: p.id, name_en: p.name_en, name_ar: p.name_ar } : null
    } else if (propertyEditMode === 'CUSTOM' && customPropertyName.trim()) {
      updatedPropertyId = null
      updatedInterest = customPropertyName.trim()
      updatedPropertyObj = null
    }

    setLead((prev) => ({
      ...prev,
      property_id: updatedPropertyId,
      interest: updatedInterest,
      property: updatedPropertyObj,
    }))
    setIsEditingProperty(false)

    await Promise.all([
      supabase.from('leads').update({
        property_id: updatedPropertyId,
        interest: updatedInterest,
      }).eq('id', lead.id),
      supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'PROPERTY_UPDATED',
        performed_by: profile.id,
        metadata: {
          property: updatedPropertyObj?.name_en || updatedInterest || 'General Inquiry',
        },
      }),
    ])

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

    const { data, error } = await supabase
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

    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'NOTE_ADDED',
      performed_by: profile.id,
    })
  }

  // Edit Note
  async function handleSaveEditedNote(noteId: string) {
    if (!editNoteBody.trim()) return

    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, body: editNoteBody.trim() } : n))
    )
    setEditingNoteId(null)

    await supabase.from('lead_notes').update({ body: editNoteBody.trim() }).eq('id', noteId)
  }

  // Delete Note
  async function handleDeleteNote(noteId: string) {
    if (!confirm('Are you sure you want to delete this note?')) return

    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    await supabase.from('lead_notes').delete().eq('id', noteId)
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

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'FOLLOWUP_SCHEDULED',
        performed_by: profile.id,
        metadata: { date: followupDate },
      })
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

    await Promise.all([
      supabase
        .from('lead_followups')
        .update({
          is_completed: nextStatus,
          completed_at: nextStatus ? new Date().toISOString() : null,
        })
        .eq('id', followupId),
      supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: nextStatus ? 'FOLLOWUP_COMPLETED' : 'FOLLOWUP_UPDATED',
        performed_by: profile.id,
      }),
    ])
  }

  // Delete Follow-up
  async function handleDeleteFollowup(followupId: string) {
    if (!confirm('Are you sure you want to delete this follow-up?')) return

    setFollowups((prev) => prev.filter((f) => f.id !== followupId))
    await supabase.from('lead_followups').delete().eq('id', followupId)
  }

  // Delete Lead
  async function handleDeleteLead() {
    if (!confirm(`Are you sure you want to completely delete "${lead.name}"? This action cannot be undone.`)) return

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

          {/* Agent Selector (Admin only) */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Agent:</span>
              <select
                value={lead.assigned_agent_id || ''}
                onChange={(e) => handleAgentChange(e.target.value)}
                className="form-select"
                style={{ width: 'auto', fontSize: 12.5, padding: '5px 10px' }}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Delete Lead Button */}
          {isAdmin && (
            <button
              onClick={handleDeleteLead}
              disabled={isDeleting}
              className="btn btn-danger btn-sm"
              title="Delete Lead"
            >
              <Trash2 size={14} />
              <span>{isDeleting ? 'Deleting...' : 'Delete Lead'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Layout Grid */}
        <div className="rg-3" style={{ gridTemplateColumns: '340px 1fr' }}>
          {/* Left Column: Lead Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Contact Details Card */}
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <h3 className="text-section-header">Contact Information</h3>
                <button
                  onClick={() => {
                    setEditForm({
                      name: lead.name || '',
                      phone: lead.phone || '',
                      email: lead.email || '',
                      city: lead.city || '',
                      potential_value: lead.potential_value ? String(lead.potential_value) : '',
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
                  <DollarSign size={16} style={{ color: '#10B981' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>ESTIMATED VALUE</div>
                    <div style={{ color: '#10B981', fontWeight: 700, fontSize: 15 }}>
                      {formatCurrency(lead.potential_value)}
                    </div>
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
                  onClick={() => {
                    if (lead.property_id) {
                      setPropertyEditMode('DB')
                      setSelectedPropertyId(lead.property_id)
                      setCustomPropertyName('')
                    } else if (lead.interest) {
                      setPropertyEditMode('CUSTOM')
                      setSelectedPropertyId('')
                      setCustomPropertyName(lead.interest)
                    } else {
                      setPropertyEditMode('NONE')
                      setSelectedPropertyId('')
                      setCustomPropertyName('')
                    }
                    setIsEditingProperty(true)
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
                  <Building size={16} style={{ color: '#D97706' }} />
                  <div>
                    <div className="text-label" style={{ fontSize: 11 }}>PROJECT / PROPERTY</div>
                    <div style={{ color: '#0F172A', fontWeight: 600, fontSize: 13.5 }}>
                      {lead.property ? lead.property.name_en : (lead.interest || 'General Inquiry')}
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
                        onClick={() => handleDeleteFollowup(f.id)}
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
                          onClick={() => handleDeleteNote(n.id)}
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
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="form-input"
                  />
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

      {/* Edit Property & Project Association Modal */}
      {isEditingProperty && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="text-section-header">Edit Associated Property</h3>
              <button
                onClick={() => setIsEditingProperty(false)}
                className="btn btn-ghost btn-icon"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProperty}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Property Selection Mode</label>
                  <select
                    value={
                      propertyEditMode === 'CUSTOM'
                        ? 'CUSTOM'
                        : propertyEditMode === 'DB'
                        ? selectedPropertyId
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'CUSTOM') {
                        setPropertyEditMode('CUSTOM')
                        setSelectedPropertyId('')
                      } else if (val === '') {
                        setPropertyEditMode('NONE')
                        setSelectedPropertyId('')
                        setCustomPropertyName('')
                      } else {
                        setPropertyEditMode('DB')
                        setSelectedPropertyId(val)
                        setCustomPropertyName('')
                      }
                    }}
                    className="form-select"
                  >
                    <option value="">None / General Inquiry</option>
                    {projects.length > 0 && (
                      <optgroup label="Database Projects">
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name_en} ({p.city_en})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="CUSTOM">➕ Custom Property Name (Free text)</option>
                  </select>
                </div>

                {propertyEditMode === 'CUSTOM' && (
                  <div className="form-group">
                    <label className="form-label">Custom Property Name *</label>
                    <input
                      type="text"
                      autoFocus
                      required
                      value={customPropertyName}
                      onChange={(e) => setCustomPropertyName(e.target.value)}
                      placeholder="e.g. Al Narjis Luxury Villa, Tower B 401"
                      className="form-input"
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsEditingProperty(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProperty}
                  className="btn btn-primary"
                >
                  {savingProperty ? 'Saving...' : 'Update Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
