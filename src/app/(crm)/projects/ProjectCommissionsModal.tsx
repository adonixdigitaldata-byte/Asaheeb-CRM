'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Calendar,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  Save,
  Clock
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Project, Profile, ProjectCommission } from '@/types/database'

interface Props {
  project: Project
  profile: Profile
  onClose: () => void
}

export default function ProjectCommissionsModal({ project, profile, onClose }: Props) {
  const supabase = createClient()

  const [commissions, setCommissions] = useState<ProjectCommission[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Add / Edit form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [unitName, setUnitName] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [agentId, setAgentId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [isCustomAgent, setIsCustomAgent] = useState(false)
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([])
  const [commissionAmount, setCommissionAmount] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch commission entries for this project
  const fetchCommissions = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data, error } = await supabase
        .from('project_commissions')
        .select('*')
        .eq('project_id', project.id)
        .order('sale_date', { ascending: false })

      if (error) throw error
      setCommissions((data as ProjectCommission[]) || [])
    } catch (err: any) {
      console.error('Error fetching project commissions:', err)
      setErrorMsg(err.message || 'Failed to load commissions')
    } finally {
      setLoading(false)
    }
  }, [supabase, project.id])

  const fetchTeam = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, avatar_url')
        .order('name', { ascending: true })

      if (!error && data) {
        setTeamProfiles(data as Profile[])
      }
    } catch (err) {
      console.error('Error loading team profiles for commissions:', err)
    }
  }, [supabase])

  useEffect(() => {
    fetchCommissions()
    fetchTeam()
  }, [fetchCommissions, fetchTeam])

  // Total summary calculations
  const totalCommission = useMemo(() => {
    return commissions.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0)
  }, [commissions])

  function resetForm() {
    setEditingId(null)
    setUnitName('')
    setBuyerName('')
    setAgentId('')
    setAgentName('')
    setIsCustomAgent(false)
    setCommissionAmount('')
    setSaleDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setIsFormOpen(false)
    setErrorMsg('')
  }

  function startEdit(item: ProjectCommission) {
    setEditingId(item.id)
    setUnitName(item.unit_name)
    setBuyerName(item.buyer_name)
    setAgentId(item.agent_id || '')
    setAgentName(item.agent_name || '')
    setIsCustomAgent(!!item.agent_name && !item.agent_id)
    setCommissionAmount(String(item.commission_amount))
    setSaleDate(item.sale_date || new Date().toISOString().split('T')[0])
    setNotes(item.notes || '')
    setIsFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!unitName.trim() || !buyerName.trim() || !commissionAmount) {
      setErrorMsg('Please fill in Unit/Property name, Buyer name, and Commission amount.')
      return
    }

    const numAmount = Number(commissionAmount)
    if (isNaN(numAmount) || numAmount < 0) {
      setErrorMsg('Please enter a valid commission amount.')
      return
    }

    setSaving(true)
    setErrorMsg('')

    // Resolve final agent attribution
    let finalAgentName = agentName.trim()
    let finalAgentId = agentId || null
    if (agentId && !isCustomAgent) {
      const selected = teamProfiles.find((p) => p.id === agentId)
      if (selected) finalAgentName = selected.name
    } else if (isCustomAgent) {
      finalAgentId = null
    }

    try {
      if (editingId) {
        // Update existing record
        const { error } = await supabase
          .from('project_commissions')
          .update({
            unit_name: unitName.trim(),
            buyer_name: buyerName.trim(),
            agent_id: finalAgentId,
            agent_name: finalAgentName || null,
            commission_amount: numAmount,
            sale_date: saleDate,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)

        if (error) throw error
        setSuccessMsg('Commission record updated successfully!')
      } else {
        // Create new record
        const { error } = await supabase
          .from('project_commissions')
          .insert({
            project_id: project.id,
            unit_name: unitName.trim(),
            buyer_name: buyerName.trim(),
            agent_id: finalAgentId,
            agent_name: finalAgentName || null,
            commission_amount: numAmount,
            sale_date: saleDate,
            notes: notes.trim() || null,
            created_by: profile.id,
          })

        if (error) throw error
        setSuccessMsg('Commission record added successfully!')
      }

      await fetchCommissions()
      resetForm()
      setTimeout(() => setSuccessMsg(''), 3500)
    } catch (err: any) {
      console.error('Error saving commission:', err)
      setErrorMsg(err.message || 'Failed to save commission record')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this commission record?')) return

    setDeletingId(id)
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('project_commissions')
        .delete()
        .eq('id', id)

      if (error) throw error
      setCommissions((prev) => prev.filter((c) => c.id !== id))
      setSuccessMsg('Commission record removed.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      console.error('Error deleting commission:', err)
      setErrorMsg(err.message || 'Failed to delete commission record')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34D399',
              }}
            >
              <DollarSign size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>
                  {project.name_en}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34D399',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                  }}
                >
                  Admin Vault
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Project Sales &amp; Layout Commissions Configurator · {project.city_en}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Total Metric Overview Bar */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Commission Earned
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#065F46', marginTop: '2px' }}>
              SAR {totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: '#059669', marginTop: '1px' }}>
              Across {commissions.length} unit / layout sale{commissions.length === 1 ? '' : 's'}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Units / Layouts Sold
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#1E40AF', marginTop: '2px' }}>
              {commissions.length} Sold
            </div>
            <div style={{ fontSize: '11px', color: '#2563EB', marginTop: '1px' }}>
              {project.developer_en || 'Asaheeb Developments'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {!isFormOpen && (
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setIsFormOpen(true)
                }}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '10px 18px',
                  backgroundColor: '#1E3A8A',
                }}
              >
                <Plus size={16} />
                <span>Record Unit Sale</span>
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Notification Messages */}
          {errorMsg && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                color: '#991B1B',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #6EE7B7',
                borderRadius: '8px',
                color: '#065F46',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Record Sale / Edit Form Drawer */}
          {isFormOpen && (
            <form
              onSubmit={handleSave}
              style={{
                marginBottom: '24px',
                padding: '18px 20px',
                backgroundColor: '#F8FAFC',
                border: '1.5px solid #BFDBFE',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(30, 58, 138, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1E3A8A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} />
                  <span>{editingId ? 'Edit Sale / Commission Record' : 'Record New Property / Layout Sale'}</span>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '12px', color: '#64748B' }}
                >
                  Cancel
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {/* Unit / Property Name */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Unit / Layout / Property Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Layout 4, Apt 302, Villa B1"
                    className="form-input"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Specify sold layout, apartment, villa, or whole property.
                  </div>
                </div>

                {/* Sold By (Sales Agent) */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Sold By (Sales Agent)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomAgent(!isCustomAgent)
                        setAgentId('')
                        setAgentName('')
                      }}
                      className="btn btn-ghost btn-xs"
                      style={{ fontSize: '10.5px', color: '#2563EB', padding: '0 4px', height: 'auto' }}
                    >
                      {isCustomAgent ? 'Choose Team Member' : 'Custom / External'}
                    </button>
                  </label>

                  {isCustomAgent ? (
                    <input
                      type="text"
                      placeholder="e.g. External Partner / Direct Broker"
                      className="form-input"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      style={{ height: '38px', fontSize: '13px' }}
                    />
                  ) : (
                    <select
                      className="form-select"
                      value={agentId}
                      onChange={(e) => {
                        const val = e.target.value
                        setAgentId(val)
                        const found = teamProfiles.find((p) => p.id === val)
                        if (found) setAgentName(found.name)
                        else setAgentName('')
                      }}
                      style={{ height: '38px', fontSize: '13px', width: '100%' }}
                    >
                      <option value="">Select Agent (or Company Direct)</option>
                      {teamProfiles.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          {tp.name} ({tp.role})
                        </option>
                      ))}
                    </select>
                  )}
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Assign credit to the sales agent who closed this deal.
                  </div>
                </div>

                {/* Buyer Name */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Buyer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmad Al-Subaie"
                    className="form-input"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Name of the purchasing client or investor.
                  </div>
                </div>

                {/* Commission Amount */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Commission Earned (SAR) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#64748B',
                      }}
                    >
                      SAR
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder="e.g. 75000"
                      className="form-input"
                      value={commissionAmount}
                      onChange={(e) => setCommissionAmount(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', paddingLeft: '44px', fontWeight: 700, color: '#047857' }}
                    />
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Net commission / brokerage fee received.
                  </div>
                </div>

                {/* Sale Date */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Sale Date
                  </label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginTop: '12px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Deal Notes / Payment Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50% deposit received, Bank transfer via SNB"
                  className="form-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ height: '36px', fontSize: '12.5px' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-outline btn-sm"
                  style={{ height: '36px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                  style={{
                    height: '36px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#1E3A8A',
                  }}
                >
                  <Save size={14} />
                  <span>{saving ? 'Saving...' : editingId ? 'Update Record' : 'Save Commission'}</span>
                </button>
              </div>
            </form>
          )}

          {/* List of Commissions */}
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Sales &amp; Commission Breakdown ({commissions.length})
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
              <Clock size={24} style={{ margin: '0 auto 8px', animation: 'spin 1.5s linear infinite' }} />
              <div>Loading commissions ledger...</div>
            </div>
          ) : commissions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                backgroundColor: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                borderRadius: '12px',
                color: '#64748B',
              }}
            >
              <DollarSign size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#334155' }}>
                No commission entries recorded yet
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '400px', margin: '4px auto 14px' }}>
                Record sales made across different apartment layouts, hotel units, or villa plots to track total project commission.
              </p>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                >
                  <Plus size={14} />
                  <span>Add First Sale</span>
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '10px',
                overflow: 'hidden',
                width: '100%',
              }}
            >
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border)', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ width: '22%', padding: '10px 12px', textAlign: 'left' }}>Unit / Layout</th>
                    <th style={{ width: '18%', padding: '10px 12px', textAlign: 'left' }}>Sold By (Agent)</th>
                    <th style={{ width: '20%', padding: '10px 12px', textAlign: 'left' }}>Buyer Name</th>
                    <th style={{ width: '18%', padding: '10px 12px', textAlign: 'right' }}>Commission</th>
                    <th style={{ width: '12%', padding: '10px 12px', textAlign: 'center' }}>Sale Date</th>
                    <th style={{ width: '10%', padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c, idx) => {
                    const agentDisplay = c.agent_name || 'Asaheeb Direct'
                    const initial = agentDisplay.charAt(0).toUpperCase()

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: idx === commissions.length - 1 ? 'none' : '1px solid #F1F5F9',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                      >
                        {/* Unit / Property Name */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.unit_name}>
                            {c.unit_name}
                          </div>
                          {c.notes && (
                            <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.notes}>
                              {c.notes}
                            </div>
                          )}
                        </td>

                        {/* Sold By Agent */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%' }}>
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: c.agent_id ? '#EFF6FF' : '#F1F5F9',
                                color: c.agent_id ? '#2563EB' : '#64748B',
                                border: `1px solid ${c.agent_id ? '#BFDBFE' : '#CBD5E1'}`,
                                fontSize: '10px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {initial}
                            </span>
                            <span
                              style={{
                                fontWeight: 600,
                                color: c.agent_id ? '#1E293B' : '#64748B',
                                fontSize: '12px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={agentDisplay}
                            >
                              {agentDisplay}
                            </span>
                          </div>
                        </td>

                        {/* Buyer Name */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.buyer_name}>
                            {c.buyer_name}
                          </div>
                        </td>

                        {/* Commission Earned */}
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '13px' }}>
                          SAR {Number(c.commission_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Sale Date */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                          {c.sale_date}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => startEdit(c)}
                              className="btn btn-outline btn-xs"
                              title="Edit Commission"
                              style={{ padding: '3px 6px' }}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === c.id}
                              onClick={() => handleDelete(c.id)}
                              className="btn btn-outline btn-xs"
                              title="Delete"
                              style={{ padding: '3px 6px', color: '#EF4444' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#F0FDF4', borderTop: '2px solid #A7F3D0', fontWeight: 800 }}>
                    <td colSpan={3} style={{ padding: '12px 12px', color: '#065F46', fontSize: '13px' }}>
                      TOTAL COMMISSION ({commissions.length} Units Sold)
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', color: '#047857', fontSize: '14px' }}>
                      SAR {totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B' }}>
            All commission entries are restricted to Administrator access.
          </div>
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
