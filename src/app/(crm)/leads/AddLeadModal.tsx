'use client'

import { useState } from 'react'
import { X, Building, Calendar, Clock, DollarSign, Tag, Search, MapPin, Edit2 } from 'lucide-react'
import { CLIENT_CATEGORIES, BUDGET_TIERS, type LeadStage, type Project, type AdCampaign } from '@/types/database'
import { PREDEFINED_CITIES } from '@/lib/cities'
import ProjectSearchModal from '@/components/ProjectSearchModal'

interface Props {
  stages: LeadStage[]
  agents: { id: string; name: string }[]
  projects: Project[]
  campaigns?: AdCampaign[]
  currentUserId: string
  userRole?: string
  onClose: () => void
  onSuccess: () => void
}

const SOURCES = [
  { value: 'MANUAL', label: 'Manual Entry' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'META_ADS', label: 'Meta Ads' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'SNAPCHAT', label: 'Snapchat' },
  { value: 'WEBSITE_FORM', label: 'Website Form' },
  { value: 'PROPERTY_INQUIRY', label: 'Project Inquiry' },
  { value: 'BROCHURE_DOWNLOAD', label: 'Brochure Download' },
  { value: 'XLSX_IMPORT', label: 'Excel Import' },
]

export default function AddLeadModal({
  stages,
  agents,
  projects,
  campaigns = [],
  currentUserId,
  userRole,
  onClose,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    cityMode: 'PREDEFINED' as 'PREDEFINED' | 'CUSTOM',
    city: '',
    customCity: '',
    client_category: '',
    budget_tier: '',
    meeting_date: '',
    meeting_time: '',
    propertyMode: 'NONE' as 'NONE' | 'DB' | 'CUSTOM',
    property_id: '',
    customProperty: '',
    property_type: '',
    potential_value: '',
    source: 'MANUAL',
    stage_id: stages[0]?.id ?? '',
    assigned_agent_id: (userRole === 'AGENT' || userRole === 'EMPLOYEE') ? currentUserId : 'AUTO',
    notes: '',
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Full Name is required'
    if (!form.phone.trim() && !form.email.trim()) e.phone = 'Phone number or email is required'
    if (!form.stage_id) e.stage_id = 'Please select a pipeline stage'
    if (form.potential_value && (Number(form.potential_value) < 0 || Number(form.potential_value) >= 10000000000)) {
      e.potential_value = 'Deal value must be less than 10,000,000,000 SAR'
    }
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setLoading(true)

    // Resolve property and interest
    let resolvedPropertyId: string | null = null
    let resolvedInterest: string | null = null

    if (form.propertyMode === 'DB' && form.property_id) {
      resolvedPropertyId = form.property_id
      const matched = projects.find((p) => p.id === form.property_id)
      resolvedInterest = matched ? matched.name_en : null
    } else if (form.propertyMode === 'CUSTOM' && form.customProperty.trim()) {
      resolvedPropertyId = null
      resolvedInterest = form.customProperty.trim()
    }

    // Resolve city
    const resolvedCity =
      form.cityMode === 'CUSTOM'
        ? form.customCity.trim() || null
        : form.city.trim() || null

    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          city: resolvedCity,
          interest: resolvedInterest,
          property_type: form.property_type || null,
          client_category: form.client_category || null,
          budget_tier: form.budget_tier || null,
          meeting_date: form.meeting_date || null,
          meeting_time: form.meeting_time.trim() || null,
          potential_value: form.potential_value ? parseFloat(form.potential_value) : null,
          source: form.source,
          stage_id: form.stage_id,
          assigned_agent_id: form.assigned_agent_id || null,
          property_id: resolvedPropertyId,
          campaign_id: null, // Always none for manual entry
          notes: form.notes.trim() || null,
        }),
      })


      const data = await res.json()
      if (!res.ok) {
        setErrors({ form: data.error || 'Failed to create lead' })
        setLoading(false)
        return
      }

      onSuccess()
    } catch {
      setErrors({ form: 'Network error. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
              Add New Lead
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.15rem' }}>
              Create a new client record and assign pipeline details
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ color: '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, maxHeight: '88vh' }}>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, maxHeight: 'calc(85vh - 120px)' }}>
            {errors.form && (
              <div style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
              }}>
                {errors.form}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mohammed Al-Otaibi"
                  className="form-input"
                />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>

              {/* Phone */}
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+966 50 123 4567"
                  className="form-input"
                />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="client@example.com"
                  className="form-input"
                />
              </div>

              {/* City / Region */}
              <div className="form-group">
                <label className="form-label">City / Region</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select
                    value={form.cityMode === 'CUSTOM' ? 'CUSTOM' : form.city}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'CUSTOM') {
                        setForm({ ...form, cityMode: 'CUSTOM', city: '', customCity: '' })
                      } else {
                        setForm({ ...form, cityMode: 'PREDEFINED', city: val, customCity: '' })
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

                  {form.cityMode === 'CUSTOM' && (
                    <input
                      type="text"
                      autoFocus
                      value={form.customCity}
                      onChange={(e) => setForm({ ...form, customCity: e.target.value })}
                      placeholder="Type custom city name..."
                      className="form-input"
                    />
                  )}
                </div>
              </div>

              {/* Lead Source */}
              <div className="form-group">
                <label className="form-label">Lead Source</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="form-select"
                >
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Funnel Stage */}
              <div className="form-group">
                <label className="form-label">Initial Pipeline Stage *</label>
                <select
                  value={form.stage_id}
                  onChange={(e) => setForm({ ...form, stage_id: e.target.value })}
                  className="form-select"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {errors.stage_id && <span className="form-error">{errors.stage_id}</span>}
              </div>

              {/* Assigned Agent */}
              <div className="form-group">
                <label className="form-label">Assign to Agent</label>
                {(userRole === 'AGENT' || userRole === 'EMPLOYEE') ? (
                  <div>
                    <div
                      className="form-input flex items-center justify-between"
                      style={{
                        backgroundColor: '#F8FAFC',
                        color: '#334155',
                        cursor: 'not-allowed',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span>👤</span>
                        <span>Assign to Myself ({agents.find((a) => a.id === currentUserId)?.name || 'Current User'})</span>
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Default</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#16A34A', marginTop: 4, display: 'block' }}>
                      ✓ As a sales agent, leads you create are automatically assigned to your personal pipeline.
                    </span>
                  </div>
                ) : (
                  <>
                    <select
                      value={form.assigned_agent_id}
                      onChange={(e) => setForm({ ...form, assigned_agent_id: e.target.value })}
                      className="form-select"
                    >
                      <option value="AUTO">⚡ Auto-Assign (Round-Robin to Available Agent)</option>
                      <option value="UNASSIGNED">Leave Unassigned</option>
                      <optgroup label="Specific Sales Agents">
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} {a.id === currentUserId ? '(You)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {form.assigned_agent_id === 'AUTO' && (
                      <span style={{ fontSize: 11, color: '#2563EB', marginTop: 4, display: 'block' }}>
                        💡 Lead will be automatically assigned to the next active, available sales agent via round-robin.
                      </span>
                    )}
                    {form.assigned_agent_id === currentUserId && (
                      <span style={{ fontSize: 11, color: '#16A34A', marginTop: 4, display: 'block' }}>
                        ✓ This lead will be added directly to your personal pipeline.
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Client Category */}
              <div className="form-group">
                <label className="form-label flex items-center gap-1">
                  <Tag size={13} style={{ color: '#6366F1' }} />
                  <span>Client Category</span>
                </label>
                <select
                  value={form.client_category}
                  onChange={(e) => setForm({ ...form, client_category: e.target.value })}
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

              {/* Budget Tier */}
              <div className="form-group">
                <label className="form-label flex items-center gap-1">
                  <DollarSign size={13} style={{ color: '#10B981' }} />
                  <span>Budget Tier</span>
                </label>
                <select
                  value={form.budget_tier}
                  onChange={(e) => setForm({ ...form, budget_tier: e.target.value })}
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

              {/* Potential Value */}
              <div className="form-group">
                <label className="form-label">Estimated Deal Value (SAR)</label>
                <input
                  type="number"
                  max="9999999999"
                  value={form.potential_value}
                  onChange={(e) => setForm({ ...form, potential_value: e.target.value })}
                  placeholder="e.g. 1500000"
                  className="form-input"
                />
                {errors.potential_value && <span className="form-error">{errors.potential_value}</span>}
              </div>

              {/* Scheduled Meeting (Date & Time) */}
              <div className="form-group" style={{ gridColumn: '1 / -1', background: '#F8FAFC', padding: '12px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Calendar size={14} style={{ color: '#2563EB' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Schedule Client Meeting (Optional)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>Meeting Date</label>
                    <input
                      type="date"
                      value={form.meeting_date}
                      onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>Meeting Time</label>
                    <input
                      type="time"
                      value={form.meeting_time}
                      onChange={(e) => setForm({ ...form, meeting_time: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Associated Property / Project (Searchable Modal & Custom Option) */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building size={14} style={{ color: '#2563EB' }} />
                    <span>Associated Property / Project</span>
                  </span>
                  {form.propertyMode !== 'NONE' && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, propertyMode: 'NONE', property_id: '', customProperty: '' })}
                      className="btn btn-ghost btn-xs"
                      style={{ color: '#94A3B8', fontSize: '11px', padding: '1px 6px' }}
                    >
                      Clear Selection
                    </button>
                  )}
                </label>

                {/* Selected Database Project View */}
                {form.propertyMode === 'DB' && form.property_id && (
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
                            {projects.find((p) => p.id === form.property_id)?.name_en || 'Selected Project'}
                          </span>
                          {projects.find((p) => p.id === form.property_id)?.name_ar && (
                            <span style={{ fontSize: '0.75rem', color: '#3B82F6', direction: 'rtl' }}>
                              ({projects.find((p) => p.id === form.property_id)?.name_ar})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', color: '#60A5FA', marginTop: 2 }}>
                          {(projects.find((p) => p.id === form.property_id)?.city_en || projects.find((p) => p.id === form.property_id)?.district_en) && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#2563EB' }}>
                              <MapPin size={11} />
                              {[projects.find((p) => p.id === form.property_id)?.district_en, projects.find((p) => p.id === form.property_id)?.city_en].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {projects.find((p) => p.id === form.property_id)?.developer_en && (
                            <span style={{ color: '#475569' }}>
                              Dev: {projects.find((p) => p.id === form.property_id)?.developer_en}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setIsProjectModalOpen(true)}
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '5px 10px', height: 'auto', borderRadius: 6 }}
                      >
                        <Search size={13} style={{ marginRight: 4 }} />
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, propertyMode: 'NONE', property_id: '', customProperty: '' })}
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: '#64748B', padding: 4 }}
                        title="Remove project"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Property View */}
                {form.propertyMode === 'CUSTOM' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        autoFocus
                        value={form.customProperty}
                        onChange={(e) => setForm({ ...form, customProperty: e.target.value })}
                        placeholder="Type property name (e.g. Al Narjis Luxury Villa, Compound Unit 4)"
                        className="form-input"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => setIsProjectModalOpen(true)}
                        className="btn btn-sm btn-secondary"
                        style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Search size={14} />
                        <span>Search Database</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '11px', color: '#D97706' }}>
                      ✍️ Custom property name will be recorded as client interest.
                    </span>
                  </div>
                )}

                {/* Unselected / None View */}
                {form.propertyMode === 'NONE' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setIsProjectModalOpen(true)}
                      className="form-input"
                      style={{
                        flex: '1 1 280px',
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
                        <span>Click to search &amp; select project from database...</span>
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
                      onClick={() => setForm({ ...form, propertyMode: 'CUSTOM', customProperty: '' })}
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
            </div>

            {/* Property Type — auto-inherited from DB project, or manual for custom/general */}
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building size={13} style={{ color: '#2563EB' }} />
                <span>Property Type</span>
                {form.propertyMode === 'DB' && form.property_type && (
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
                    Auto-inherited from project
                  </span>
                )}
              </label>

              {form.propertyMode === 'DB' && form.property_type ? (
                /* Read-only inherited badge when DB project selected */
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    backgroundColor: '#F0FDF4',
                    border: '1.5px solid #86EFAC',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#15803D' }}>
                    {form.property_type}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, property_type: '' })}
                    className="btn btn-ghost btn-xs"
                    style={{ color: '#64748B', fontSize: '11px', padding: '1px 6px', marginLeft: 'auto' }}
                  >
                    Override ✏️
                  </button>
                </div>
              ) : (
                /* Manual dropdown for CUSTOM/NONE modes, or when inherited is overridden */
                <select
                  value={form.property_type}
                  onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select Property Type (Optional)</option>
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
              )}
            </div>

            {/* Initial Note */}
            <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <label className="form-label">Initial Note / Requirements</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Details regarding property type, budget, bedroom requirements, etc."
                className="form-textarea"
              />
            </div>
          </div>


          {/* Footer */}
          <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', padding: '12px 20px', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {errors.form && (
                <span style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600, display: 'block' }}>
                  ⚠️ {errors.form}
                </span>
              )}
              {Object.keys(errors).length > 0 && !errors.form && (
                <span style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 600, display: 'block' }}>
                  ⚠️ Please fill required fields ({Object.values(errors).join(', ')})
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Saving...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Project Search Modal */}
      <ProjectSearchModal
        isOpen={isProjectModalOpen}
        projects={projects}
        selectedProjectId={form.property_id}
        customPropertyName={form.customProperty}
        propertyMode={form.propertyMode}
        onSelectProject={(project) => {
          setForm({
            ...form,
            propertyMode: 'DB',
            property_id: project.id,
            customProperty: '',
            // Auto-inherit the project's property type
            property_type: project.type_en || '',
          })
        }}
        onSelectNone={() => {
          setForm({
            ...form,
            propertyMode: 'NONE',
            property_id: '',
            customProperty: '',
          })
        }}
        onSelectCustom={(customName) => {
          setForm({
            ...form,
            propertyMode: 'CUSTOM',
            property_id: '',
            customProperty: customName,
          })
        }}
        onClose={() => setIsProjectModalOpen(false)}
      />
    </div>
  )
}
