'use client'

import { useState } from 'react'
import { X, Building } from 'lucide-react'
import type { LeadStage, Project, AdCampaign } from '@/types/database'

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
  { value: 'PROPERTY_INQUIRY', label: 'Property Inquiry' },
]

export default function AddLeadModal({
  stages,
  agents,
  projects,
  currentUserId,
  userRole,
  onClose,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    propertyMode: 'NONE' as 'NONE' | 'DB' | 'CUSTOM',
    property_id: '',
    customProperty: '',
    potential_value: '',
    source: 'MANUAL',
    stage_id: stages[0]?.id ?? '',
    assigned_agent_id: userRole === 'AGENT' ? currentUserId : '',
    notes: '',
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Full Name is required'
    if (!form.phone.trim() && !form.email.trim()) e.phone = 'Phone number or email is required'
    if (!form.stage_id) e.stage_id = 'Please select a pipeline stage'
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

    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          city: form.city.trim() || null,
          interest: resolvedInterest,
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
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
              Add New Lead
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
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

              {/* City */}
              <div className="form-group">
                <label className="form-label">City / Region</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="e.g. Riyadh, Jeddah, Dammam"
                  className="form-input"
                />
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
                <select
                  value={form.assigned_agent_id}
                  onChange={(e) => setForm({ ...form, assigned_agent_id: e.target.value })}
                  className="form-select"
                  disabled={userRole === 'AGENT'}
                >
                  <option value="">Leave Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Potential Value */}
              <div className="form-group">
                <label className="form-label">Estimated Deal Value (SAR)</label>
                <input
                  type="number"
                  value={form.potential_value}
                  onChange={(e) => setForm({ ...form, potential_value: e.target.value })}
                  placeholder="e.g. 1500000"
                  className="form-input"
                />
              </div>

              {/* Associated Property / Project (Dropdown & Custom Option) */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label flex items-center justify-between">
                  <span>Associated Property / Project</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    value={
                      form.propertyMode === 'CUSTOM'
                        ? 'CUSTOM'
                        : form.propertyMode === 'DB'
                        ? form.property_id
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'CUSTOM') {
                        setForm({ ...form, propertyMode: 'CUSTOM', property_id: '' })
                      } else if (val === '') {
                        setForm({ ...form, propertyMode: 'NONE', property_id: '', customProperty: '' })
                      } else {
                        setForm({ ...form, propertyMode: 'DB', property_id: val, customProperty: '' })
                      }
                    }}
                    className="form-select"
                    style={{ flex: '1 1 240px' }}
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

                  {/* Custom Property text input if CUSTOM is selected */}
                  {form.propertyMode === 'CUSTOM' && (
                    <input
                      type="text"
                      autoFocus
                      value={form.customProperty}
                      onChange={(e) => setForm({ ...form, customProperty: e.target.value })}
                      placeholder="Type property name (e.g. Al Narjis Luxury Villa)"
                      className="form-input"
                      style={{ flex: '1 1 260px' }}
                    />
                  )}
                </div>
              </div>
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
          <div className="modal-footer">
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
        </form>
      </div>
    </div>
  )
}
