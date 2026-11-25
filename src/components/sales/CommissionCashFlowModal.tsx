'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Loader2,
  FileText,
  Save,
  AlertCircle,
} from 'lucide-react'
import type { ProjectCommission, CommissionPayment, Project, Profile } from '@/types/database'

interface Props {
  commission: ProjectCommission
  project?: Project
  agent?: Profile
  onClose: () => void
  onUpdated: (updatedCommission: ProjectCommission) => void
  onOpenReceipt: (commission: ProjectCommission, payments: CommissionPayment[]) => void
}

export default function CommissionCashFlowModal({
  commission,
  project,
  agent,
  onClose,
  onUpdated,
  onOpenReceipt,
}: Props) {
  const [currentComm, setCurrentComm] = useState<ProjectCommission>(commission)
  const [payments, setPayments] = useState<CommissionPayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [activeTab, setActiveTab] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW')

  // Deal Cash Flow Terms state
  const [expectedDate, setExpectedDate] = useState(commission.expected_payout_date || '')
  const thresholdX = Number(agent?.commission_threshold_sar || 0)
  const rateY = Number(agent?.commission_rate_pct || 0)
  const autoSuggestedShare =
    thresholdX <= 0 && rateY > 0
      ? Number(((Number(commission.commission_amount || 0) * rateY) / 100).toFixed(2))
      : 0

  const [agentShare, setAgentShare] = useState(
    commission.agent_commission_amount && Number(commission.agent_commission_amount) > 0
      ? String(commission.agent_commission_amount)
      : autoSuggestedShare > 0
      ? String(autoSuggestedShare)
      : ''
  )
  const [savingTerms, setSavingTerms] = useState(false)

  // New / Edit Payment Form state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'PAYROLL' | 'OTHER'>('BANK_TRANSFER')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true)
    try {
      const res = await fetch(`/api/projects/commissions/payments?commissionId=${encodeURIComponent(commission.id)}`)
      const data = await res.json()
      if (res.ok && data.payments) {
        setPayments(data.payments)
      }
    } catch (err) {
      console.error('Failed to load commission payments:', err)
    } finally {
      setLoadingPayments(false)
    }
  }, [commission.id])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const devExpected = Number(currentComm.commission_amount || 0)
  const devReceived = Number(currentComm.developer_received_amount || 0)
  const devRemaining = Math.max(0, devExpected - devReceived)

  const agentExpected = Number(currentComm.agent_commission_amount || 0)
  const agentPaid = Number(currentComm.agent_paid_amount || 0)
  const agentRemaining = Math.max(0, agentExpected - agentPaid)

  const netRetained = devReceived - agentPaid

  async function handleSaveTerms(e: React.FormEvent) {
    e.preventDefault()
    setSavingTerms(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/projects/commissions/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_id: currentComm.id,
          action: 'UPDATE_TERMS',
          expected_payout_date: expectedDate || null,
          agent_commission_amount: Number(agentShare) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update terms')
      setCurrentComm(data.commission)
      if (data.payments) setPayments(data.payments)
      onUpdated(data.commission)
      setSuccessMsg('Cash flow terms updated.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating terms')
    } finally {
      setSavingTerms(false)
    }
  }

  function startEditPayment(p: CommissionPayment) {
    setEditingPaymentId(p.id)
    setAmount(String(p.amount))
    setPaymentDate(p.payment_date || new Date().toISOString().split('T')[0])
    setPaymentMethod((p.payment_method as any) || 'BANK_TRANSFER')
    setReferenceNo(p.reference_no || '')
    setNotes(p.notes || '')
    setErrorMsg('')
  }

  function cancelEditPayment() {
    setEditingPaymentId(null)
    setAmount('')
    setReferenceNo('')
    setNotes('')
    setErrorMsg('')
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than 0.')
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      if (editingPaymentId) {
        const res = await fetch('/api/projects/commissions/payments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPaymentId,
            commission_id: currentComm.id,
            amount: num,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            reference_no: referenceNo,
            notes,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update payment')
        setCurrentComm(data.commission)
        setPayments(data.payments || [])
        onUpdated(data.commission)
        setEditingPaymentId(null)
        setSuccessMsg('Payment entry updated & balances recalculated!')
      } else {
        const res = await fetch('/api/projects/commissions/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commission_id: currentComm.id,
            direction: activeTab,
            recipient_id: activeTab === 'OUTFLOW' ? currentComm.agent_id || null : null,
            amount: num,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            reference_no: referenceNo,
            notes,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to record payment')
        setCurrentComm(data.commission)
        setPayments(data.payments || [])
        onUpdated(data.commission)
        setSuccessMsg(
          activeTab === 'INFLOW'
            ? 'Developer payment received & recorded!'
            : 'Team commission disbursement recorded!'
        )
      }
      setAmount('')
      setReferenceNo('')
      setNotes('')
      setTimeout(() => setSuccessMsg(''), 3500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save payment')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm('Remove this payment entry? Balances will be recalculated automatically.')) return
    setErrorMsg('')
    try {
      const res = await fetch(
        `/api/projects/commissions/payments?id=${encodeURIComponent(paymentId)}&commissionId=${encodeURIComponent(currentComm.id)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete payment')
      setCurrentComm(data.commission)
      setPayments(data.payments || [])
      onUpdated(data.commission)
      setSuccessMsg('Payment removed and balances updated.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting payment')
    }
  }

  const filteredPayments = payments.filter((p) => p.direction === activeTab)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                Commission Cash Flow
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 999,
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  whiteSpace: 'nowrap',
                }}
              >
                {project?.name_en || 'Project'} · {currentComm.unit_name}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
              Buyer: <strong>{currentComm.buyer_name}</strong> · Closed by:{' '}
              <strong>{agent?.name || currentComm.agent_name || 'Assigned Agent'}</strong> ({currentComm.sale_date})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => onOpenReceipt(currentComm, payments)}
              className="btn btn-outline btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderColor: '#BFDBFE',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                fontWeight: 700,
              }}
            >
              <FileText size={13} /> Developer Claim / Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Summary Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                Developer Inflow (Receivable)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#065F46', marginTop: 4 }}>
                SAR {devReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span style={{ fontSize: 12, fontWeight: 600, color: '#047857' }}>
                  {' '}
                  / {devExpected.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: devRemaining > 0 ? '#B45309' : '#059669', fontWeight: 700, marginTop: 2 }}>
                {devRemaining > 0 ? `Pending: SAR ${devRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Fully Received'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase' }}>
                Team Payout (Disbursed)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#1E3A8A', marginTop: 4 }}>
                SAR {agentPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
                  {' '}
                  / {agentExpected.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: agentRemaining > 0 ? '#B45309' : '#1D4ED8', fontWeight: 700, marginTop: 2 }}>
                {agentExpected <= 0
                  ? 'Set agent share below'
                  : agentRemaining > 0
                  ? `Payable: SAR ${agentRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                  : 'Fully Disbursed'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Net Cash Retained
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: netRetained >= 0 ? '#0F172A' : '#DC2626',
                  marginTop: 4,
                }}
              >
                SAR {netRetained.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                Received minus Disbursed
              </div>
            </div>
          </div>

          {/* Terms Bar (Expected Payout Date & Agent Share) */}
          <form
            onSubmit={handleSaveTerms}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 12,
              flexWrap: 'wrap',
              padding: '12px 14px',
              borderRadius: 10,
              backgroundColor: '#FAFBFD',
              border: '1px solid #E2E8F0',
              marginBottom: 18,
            }}
          >
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Expected Developer Payout Date
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: 34, fontSize: 12.5 }}
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Agent / Manager Share (SAR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 15000"
                value={agentShare}
                onChange={(e) => setAgentShare(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: 34, fontSize: 12.5 }}
              />
            </div>

            <button
              type="submit"
              disabled={savingTerms}
              className="btn btn-outline btn-sm"
              style={{ height: 34, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              {savingTerms ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save Terms</span>
            </button>

            {thresholdX > 0 && (
              <div style={{ flexBasis: '100%', fontSize: 11, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 10px' }}>
                <strong>Monthly Target Member (X = SAR {thresholdX.toLocaleString('en-US')}, Tier = {rateY}%):</strong>{' '}
                Since this member&apos;s commission is calculated monthly above target <strong>X</strong>, use the <strong>Payouts</strong> button on the Team Leaderboard for target-adjusted monthly disbursements (or enter a deal-specific bonus above).
              </div>
            )}
          </form>

          {/* Notices */}
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: 12.5,
                marginBottom: 14,
              }}
            >
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              <CheckCircle2 size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Switch Tabs: INFLOW vs OUTFLOW */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #E2E8F0', marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setActiveTab('INFLOW')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: activeTab === 'INFLOW' ? 800 : 600,
                color: activeTab === 'INFLOW' ? '#059669' : '#64748B',
                border: 'none',
                borderBottom: activeTab === 'INFLOW' ? '3px solid #059669' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                marginBottom: -2,
              }}
            >
              <ArrowDownLeft size={15} />
              <span>Developer Payments Received ({payments.filter((p) => p.direction === 'INFLOW').length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('OUTFLOW')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: activeTab === 'OUTFLOW' ? 800 : 600,
                color: activeTab === 'OUTFLOW' ? '#1D4ED8' : '#64748B',
                border: 'none',
                borderBottom: activeTab === 'OUTFLOW' ? '3px solid #1D4ED8' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                marginBottom: -2,
              }}
            >
              <ArrowUpRight size={15} />
              <span>Team Commission Disbursed ({payments.filter((p) => p.direction === 'OUTFLOW').length})</span>
            </button>
          </div>

          {/* Log / Edit Payment Form */}
          <form
            onSubmit={handleAddPayment}
            style={{
              padding: 16,
              borderRadius: 10,
              border: editingPaymentId ? '1.5px solid #F59E0B' : '1px solid #E2E8F0',
              backgroundColor: editingPaymentId ? '#FFFBEB' : activeTab === 'INFLOW' ? '#F0FDF4' : '#EFF6FF',
              marginBottom: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: editingPaymentId ? '#B45309' : activeTab === 'INFLOW' ? '#065F46' : '#1E3A8A' }}>
                {editingPaymentId
                  ? '✏️ Edit Payment Entry'
                  : activeTab === 'INFLOW'
                  ? '+ Record Payment Received from Developer'
                  : `+ Record Commission Disbursed to ${agent?.name || currentComm.agent_name || 'Agent'}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editingPaymentId && (
                  <button
                    type="button"
                    onClick={cancelEditPayment}
                    style={{ fontSize: 11, fontWeight: 700, color: '#64748B', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                  >
                    Cancel Edit
                  </button>
                )}
                {!editingPaymentId && activeTab === 'INFLOW' && devRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(devRemaining))}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#047857',
                      background: '#DCFCE7',
                      border: '1px solid #86EFAC',
                      borderRadius: 6,
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    Fill Remaining (SAR {devRemaining.toLocaleString('en-US')})
                  </button>
                )}
                {!editingPaymentId && activeTab === 'OUTFLOW' && agentRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(agentRemaining))}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#1D4ED8',
                      background: '#DBEAFE',
                      border: '1px solid #93C5FD',
                      borderRadius: 6,
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    Fill Remaining (SAR {agentRemaining.toLocaleString('en-US')})
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Amount (SAR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="form-input"
                  style={{ width: '100%', height: 34, fontSize: 12.5, background: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', height: 34, fontSize: 12.5, background: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="form-select"
                  style={{ width: '100%', height: 34, fontSize: 12.5, background: '#fff' }}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="PAYROLL">With Payroll</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Transfer / Cheque Ref #
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. TXN-90421"
                  className="form-input"
                  style={{ width: '100%', height: 34, fontSize: 12.5, background: '#fff' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note (e.g. First 50% tranche on SPA)"
                className="form-input"
                style={{ flex: 1, height: 34, fontSize: 12.5, background: '#fff' }}
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-sm"
                style={{
                  height: 34,
                  background: editingPaymentId ? '#D97706' : activeTab === 'INFLOW' ? '#059669' : '#1D4ED8',
                  borderColor: editingPaymentId ? '#D97706' : activeTab === 'INFLOW' ? '#059669' : '#1D4ED8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                <span>{editingPaymentId ? 'Save Changes' : activeTab === 'INFLOW' ? 'Record Receipt' : 'Record Payout'}</span>
              </button>
            </div>
          </form>

          {/* Payment History List */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
              {activeTab === 'INFLOW' ? 'Developer Payment History' : 'Agent Disbursement History'}
            </div>

            {loadingPayments ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                <Clock size={18} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                Loading ledger...
              </div>
            ) : filteredPayments.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: '#64748B',
                  fontSize: 12.5,
                  border: '1px dashed #CBD5E1',
                  borderRadius: 10,
                }}
              >
                No {activeTab === 'INFLOW' ? 'developer payments' : 'disbursements'} logged yet for this deal.
              </div>
            ) : (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: 11 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Method &amp; Ref</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Notes</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Calendar size={12} color="#64748B" />
                            <span>{p.payment_date}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{p.payment_method.replace('_', ' ')}</span>
                          {p.reference_no && (
                            <span style={{ marginLeft: 6, fontSize: 11, fontFamily: 'monospace', color: '#475569', background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>
                              {p.reference_no}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748B' }}>{p.notes || '—'}</td>
                        <td
                          style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontWeight: 800,
                            color: activeTab === 'INFLOW' ? '#059669' : '#1D4ED8',
                          }}
                        >
                          SAR {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => startEditPayment(p)}
                              title="Edit payment entry"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', padding: 4 }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.id)}
                              title="Delete payment entry"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
