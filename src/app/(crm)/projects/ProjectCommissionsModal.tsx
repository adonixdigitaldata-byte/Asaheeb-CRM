'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  Plus,
  Edit2,
  Trash2,
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
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import { createClient } from '@/lib/supabase/client'
import type { Project, Profile, ProjectCommission } from '@/types/database'
import DealCelebrationModal, { DealCelebrationData, unlockCelebrationAudio } from '@/components/DealCelebrationModal'

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
  const [areaSqm, setAreaSqm] = useState('')
  const [dealValueSar, setDealValueSar] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [celebrationDeal, setCelebrationDeal] = useState<DealCelebrationData | null>(null)

  // Fetch commission entries for this project
  const fetchCommissions = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/projects/commissions?projectId=${encodeURIComponent(project.id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load commissions')
      setCommissions((data.commissions as ProjectCommission[]) || [])
    } catch (err: any) {
      console.error('Error fetching project commissions:', err)
      setErrorMsg(err.message || 'Failed to load commissions')
    } finally {
      setLoading(false)
    }
  }, [project.id])

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

  // Role-based visibility isolation:
  // Admin sees all company sales for this project.
  // Non-admin roles (Sales Managers, Agents, Employees) see ONLY their own recorded sales!
  const displayedCommissions = useMemo(() => {
    if (profile.role === 'ADMIN') return commissions
    return commissions.filter((c) => c.agent_id === profile.id || c.created_by === profile.id)
  }, [commissions, profile.id, profile.role])

  // Total summary calculations
  const totalCommission = useMemo(() => {
    return displayedCommissions.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0)
  }, [displayedCommissions])

  const totalAreaSqm = useMemo(() => {
    return displayedCommissions.reduce((sum, item) => sum + Number(item.area_sqm || 0), 0)
  }, [displayedCommissions])

  function resetForm() {
    setEditingId(null)
    setUnitName('')
    setBuyerName('')
    setAgentId('')
    setAgentName('')
    setIsCustomAgent(false)
    setCommissionAmount('')
    setAreaSqm('')
    setDealValueSar('')
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
    setAreaSqm(item.area_sqm ? String(item.area_sqm) : '')
    setDealValueSar(item.deal_value_sar ? String(item.deal_value_sar) : '')
    setSaleDate(item.sale_date || new Date().toISOString().split('T')[0])
    setNotes(item.notes || '')
    setIsFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    // Pre-unlock AudioContext synchronously inside user click event for zero delay
    unlockCelebrationAudio()

    if (!unitName.trim() || !buyerName.trim() || !commissionAmount) {
      setErrorMsg('Please fill in Unit/Property name, Buyer name, and Commission amount.')
      return
    }

    const numAmount = Number(commissionAmount)
    if (isNaN(numAmount) || numAmount < 0) {
      setErrorMsg('Please enter a valid commission amount.')
      return
    }

    const numArea = areaSqm ? Number(areaSqm) : 0
    const numDealValue = dealValueSar ? Number(dealValueSar) : 0

    setSaving(true)
    setErrorMsg('')

    // Resolve final agent attribution
    let finalAgentName = agentName.trim()
    let finalAgentId = agentId || null

    if (profile.role !== 'ADMIN') {
      // Non-admins can only attribute sales to THEMSELVES
      finalAgentId = profile.id
      finalAgentName = profile.name || 'Sales Agent'
    } else {
      if (agentId && !isCustomAgent) {
        const selected = teamProfiles.find((p) => p.id === agentId)
        if (selected) finalAgentName = selected.name
      } else if (isCustomAgent) {
        finalAgentId = null
      }
    }

    try {
      if (editingId) {
        // Update existing record
        const res = await fetch('/api/projects/commissions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            unit_name: unitName.trim(),
            buyer_name: buyerName.trim(),
            agent_id: finalAgentId,
            agent_name: finalAgentName || null,
            commission_amount: numAmount,
            area_sqm: numArea || 0,
            deal_value_sar: numDealValue || 0,
            sale_date: saleDate,
            notes: notes.trim() || null,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update commission record')
        setSuccessMsg('Commission record updated successfully!')
      } else {
        // Create new record
        const res = await fetch('/api/projects/commissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project.id,
            unit_name: unitName.trim(),
            buyer_name: buyerName.trim(),
            agent_id: finalAgentId,
            agent_name: finalAgentName || null,
            commission_amount: numAmount,
            area_sqm: numArea || 0,
            deal_value_sar: numDealValue || 0,
            sale_date: saleDate,
            notes: notes.trim() || null,
            created_by: profile.id,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to save commission record')
        setSuccessMsg('Commission record added successfully!')

        const celebrationData: DealCelebrationData = {
          agentName: finalAgentName || profile.name || 'Asaheeb Sales Team',
          agentRole: profile.role,
          projectName: project.name_en,
          unitName: unitName.trim(),
          areaSqm: numArea > 0 ? numArea : null,
          dealValueSar: numDealValue > 0 ? numDealValue : null,
          commissionAmount: numAmount,
          saleDate: saleDate,
        }

        // Trigger Deal Closed Celebration on new closed sale for the recorder!
        setCelebrationDeal(celebrationData)

        // Realtime broadcast to Admin's open tabs
        try {
          const celebrationChannel = supabase.channel('crm-sales-celebration')
          celebrationChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              celebrationChannel.send({
                type: 'broadcast',
                event: 'deal-celebration',
                payload: {
                  deal: celebrationData,
                  recorderId: profile.id,
                  saleId: data.commission?.id || Date.now().toString(),
                  timestamp: Date.now(),
                },
              })
            }
          })
        } catch (bErr) {
          console.error('Failed to broadcast celebration:', bErr)
        }
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
      const res = await fetch(`/api/projects/commissions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete commission record')

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
      onClick={(e) => {
        if (e.target === e.currentTarget && !celebrationDeal) {
          onClose()
        }
      }}
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
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
            color: '#FFFFFF',
            flexShrink: 0,
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
              <SaudiRiyalIcon size={22} />
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
                    backgroundColor: profile.role === 'ADMIN' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: profile.role === 'ADMIN' ? '#34D399' : '#93C5FD',
                    border: profile.role === 'ADMIN' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)',
                  }}
                >
                  {profile.role === 'ADMIN' ? 'Admin Vault' : 'My Sales Ledger'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                {profile.role === 'ADMIN'
                  ? `Project Sales & Layout Commissions Configurator · ${project.city_en}`
                  : `Record & view your personal sales transactions · ${project.city_en}`}
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

        {/* Scrollable Body Content (Includes Metrics + Form + Commission Breakdown Table) */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {/* Total Metric Overview Bar */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              marginBottom: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {profile.role === 'ADMIN' ? 'Total Commission Earned' : 'My Commission Earned'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#065F46', marginTop: '2px' }}>
                SAR {totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: '#059669', marginTop: '1px' }}>
                Across {displayedCommissions.length} unit / layout sale{displayedCommissions.length === 1 ? '' : 's'}
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {profile.role === 'ADMIN' ? 'Units / Layouts Sold' : 'My Units Sold'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#1E40AF', marginTop: '2px' }}>
                {displayedCommissions.length} Sold
              </div>
              <div style={{ fontSize: '11px', color: '#2563EB', marginTop: '1px' }}>
                {project.developer_en || 'Asaheeb Developments'}
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {profile.role === 'ADMIN' ? 'Total Area Sold (m²)' : 'My Area Sold (m²)'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#92400E', marginTop: '2px' }}>
                {totalAreaSqm.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²
              </div>
              <div style={{ fontSize: '11px', color: '#B45309', marginTop: '1px' }}>
                Across {displayedCommissions.filter(c => Number(c.area_sqm || 0) > 0).length} recorded units
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
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={16} />
                  <span>Record Unit Sale</span>
                </button>
              )}
            </div>
          </div>
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
                    {profile.role === 'ADMIN' && (
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
                    )}
                  </label>

                  {profile.role !== 'ADMIN' ? (
                    <div
                      style={{
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 12px',
                        backgroundColor: '#F1F5F9',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1E293B',
                      }}
                    >
                      <User size={15} color="#059669" />
                      <span>{profile.name} (You)</span>
                    </div>
                  ) : isCustomAgent ? (
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
                    {profile.role === 'ADMIN'
                      ? 'Assign credit to the sales agent who closed this deal.'
                      : 'This sale will be automatically credited to your sales profile.'}
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

                {/* Area in Square Meters */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Area (m² / Square Meters)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 145.5"
                      className="form-input"
                      value={areaSqm}
                      onChange={(e) => setAreaSqm(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', fontWeight: 600, color: '#1E293B' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748B',
                      }}
                    >
                      m²
                    </span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Layout / apartment area in square meters.
                  </div>
                </div>

                {/* Total Property Deal Value */}
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Property Price / Deal Value (SAR)
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
                      min="0"
                      step="any"
                      placeholder="e.g. 1250000"
                      className="form-input"
                      value={dealValueSar}
                      onChange={(e) => setDealValueSar(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', paddingLeft: '44px', fontWeight: 600, color: '#1E293B' }}
                    />
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Gross property purchase price (optional).
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
              Sales &amp; Commission Breakdown ({displayedCommissions.length})
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
              <Clock size={24} style={{ margin: '0 auto 8px', animation: 'spin 1.5s linear infinite' }} />
              <div>Loading commissions ledger...</div>
            </div>
          ) : displayedCommissions.length === 0 ? (
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
              <SaudiRiyalIcon size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#334155' }}>
                {profile.role === 'ADMIN'
                  ? 'No commission entries recorded yet'
                  : `You haven't recorded any sales for this project yet`}
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '400px', margin: '4px auto 14px' }}>
                {profile.role === 'ADMIN'
                  ? 'Record sales made across different apartment layouts, hotel units, or villa plots to track total project commission.'
                  : 'Record your closed sales deals to track your commissions and celebrate milestones.'}
              </p>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                >
                  <Plus size={14} />
                  <span>{profile.role === 'ADMIN' ? 'Add First Sale' : 'Record My Sale'}</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* DESKTOP TABLE VIEW (Visible on tablet/desktop, min-width >= 640px) */}
              <div
                className="commissions-desktop-view"
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  width: '100%',
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '23%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '70px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border)', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Unit / Layout</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Sold By (Agent)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Buyer Name</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Area (m²)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Commission</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Sale Date</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCommissions.map((c, idx) => {
                      const agentDisplay = c.agent_name || 'Asaheeb Direct'
                      const initial = agentDisplay.charAt(0).toUpperCase()

                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: idx === displayedCommissions.length - 1 ? 'none' : '1px solid #F1F5F9',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '10px 12px', overflow: 'hidden' }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: '#0F172A',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={c.unit_name}
                            >
                              {c.unit_name}
                            </div>
                            {c.notes && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#64748B',
                                  marginTop: '2px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={c.notes}
                              >
                                {c.notes}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', overflow: 'hidden' }}>
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
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155', overflow: 'hidden' }}>
                            <div
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={c.buyer_name}
                            >
                              {c.buyer_name}
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {c.area_sqm && Number(c.area_sqm) > 0 ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#92400E', backgroundColor: '#FEF3C7', padding: '2px 6px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                                {Number(c.area_sqm).toLocaleString('en-US')} m²
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '13px', whiteSpace: 'nowrap' }}>
                            SAR {Number(c.commission_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {c.sale_date}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => startEdit(c)}
                                className="btn btn-outline btn-xs"
                                title="Edit Commission"
                                style={{ padding: '3px 6px', borderRadius: '5px' }}
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === c.id}
                                onClick={() => handleDelete(c.id)}
                                className="btn btn-outline btn-xs"
                                title="Delete Record"
                                style={{ padding: '3px 6px', borderRadius: '5px', color: '#DC2626', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}
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
                      <td colSpan={4} style={{ padding: '12px 14px', color: '#065F46', fontSize: '13px' }}>
                        {profile.role === 'ADMIN' ? 'TOTAL COMMISSION' : 'MY TOTAL COMMISSION'} ({displayedCommissions.length} Units Sold {totalAreaSqm > 0 ? `· ${totalAreaSqm.toLocaleString()} m²` : ''})
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', color: '#047857', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                        SAR {totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} style={{ padding: '12px 10px' }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* MOBILE CARDS VIEW (Visible strictly on mobile screens, zero cutting or overlapping text!) */}
              <div className="commissions-mobile-view" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {displayedCommissions.map((c) => {
                  const agentDisplay = c.agent_name || 'Asaheeb Direct'
                  return (
                    <div
                      key={c.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      {/* Top: Unit Name + Area badge + Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                            {c.unit_name}
                          </span>
                          {c.area_sqm && Number(c.area_sqm) > 0 && (
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400E', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                              {Number(c.area_sqm).toLocaleString('en-US')} m²
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="btn btn-outline btn-xs"
                            title="Edit Commission"
                            style={{ padding: '4px 8px', borderRadius: '6px', height: '28px' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === c.id}
                            onClick={() => handleDelete(c.id)}
                            className="btn btn-outline btn-xs"
                            title="Delete Record"
                            style={{ padding: '4px 8px', borderRadius: '6px', height: '28px', color: '#DC2626', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Middle metadata: Agent, Buyer, Date */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', padding: '8px 0', borderTop: '1px dashed #F1F5F9', borderBottom: '1px dashed #F1F5F9' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Agent</span>
                          <div style={{ fontWeight: 600, color: '#1E293B', marginTop: '1px' }}>{agentDisplay}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Buyer</span>
                          <div style={{ fontWeight: 600, color: '#334155', marginTop: '1px' }}>{c.buyer_name}</div>
                        </div>
                      </div>

                      {/* Bottom: Date + Commission */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          Sale Date: {c.sale_date || '—'}
                        </span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#047857' }}>
                          SAR {Number(c.commission_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Mobile Total Card */}
                <div
                  style={{
                    backgroundColor: '#ECFDF5',
                    border: '1.5px solid #A7F3D0',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                      {profile.role === 'ADMIN' ? 'Total Commission' : 'My Total Commission'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>
                      {displayedCommissions.length} Sold {totalAreaSqm > 0 ? `· ${totalAreaSqm.toLocaleString()} m²` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#065F46' }}>
                    SAR {totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Responsive Styles for Desktop Table vs Mobile Cards */}
              <style jsx>{`
                @media (max-width: 639px) {
                  .commissions-desktop-view {
                    display: none !important;
                  }
                  .commissions-mobile-view {
                    display: flex !important;
                  }
                }
                @media (min-width: 640px) {
                  .commissions-desktop-view {
                    display: block !important;
                  }
                  .commissions-mobile-view {
                    display: none !important;
                  }
                }
              `}</style>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B' }}>
            {profile.role === 'ADMIN'
              ? 'All project sales and commissions ledger · Executive Vault'
              : 'Personal sales ledger · Asaheeb Sales Network'}
          </div>
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm">
            Close
          </button>
        </div>
      </div>

      {/* Deal Closed Celebration Modal */}
      {celebrationDeal && (
        <DealCelebrationModal
          deal={celebrationDeal}
          onClose={() => setCelebrationDeal(null)}
        />
      )}
    </div>
  )
}
