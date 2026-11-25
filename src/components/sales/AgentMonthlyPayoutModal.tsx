'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Calendar, CheckCircle2, Trash2, Edit2, Loader2, AlertCircle, Banknote, ShieldCheck } from 'lucide-react'
import type { Profile, CommissionPayment } from '@/types/database'

interface Props {
  member: Profile
  payoutMonth: string // 'ALL' or 'YYYY-MM'
  earnedCommission: number
  grossVolume: number
  collectedFromDevelopers: number
  onClose: () => void
  onPayoutChanged: () => void
}

export default function AgentMonthlyPayoutModal({
  member,
  payoutMonth,
  earnedCommission,
  grossVolume,
  collectedFromDevelopers,
  onClose,
  onPayoutChanged,
}: Props) {
  const [payments, setPayments] = useState<CommissionPayment[]>([])
  const [loading, setLoading] = useState(true)

  // Filter for KPI display: 'ALL' or specific 'YYYY-MM'
  const [kpiFilter, setKpiFilter] = useState<string>(payoutMonth || 'ALL')

  // Form state (used for both Add & Edit)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(
    payoutMonth && payoutMonth !== 'ALL' ? payoutMonth : new Date().toISOString().slice(0, 7)
  )
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'PAYROLL' | 'OTHER'>('BANK_TRANSFER')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchPayouts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/commissions/payments?recipientId=${encodeURIComponent(member.id)}`)
      const data = await res.json()
      if (res.ok && data.payments) {
        setPayments(data.payments)
      }
    } catch (err) {
      console.error('Failed to fetch agent payouts:', err)
    } finally {
      setLoading(false)
    }
  }, [member.id])

  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  // Total paid matching current KPI filter ('ALL' or specific YYYY-MM)
  const matchingPayments =
    kpiFilter === 'ALL'
      ? payments
      : payments.filter((p) => (p.payout_month || (p.payment_date || '').slice(0, 7)) === kpiFilter)

  const totalPaid = matchingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const balancePayable = Math.max(0, earnedCommission - totalPaid)

  const thresholdX = Number(member.commission_threshold_sar || 0)
  const rateY = Number(member.commission_rate_pct || 0)
  const collectionPct = grossVolume > 0 ? Math.round((collectedFromDevelopers / grossVolume) * 100) : 0

  function startEdit(p: CommissionPayment) {
    setEditingPaymentId(p.id)
    setSelectedMonth(p.payout_month || (p.payment_date || '').slice(0, 7))
    setAmount(String(p.amount))
    setPaymentDate(p.payment_date || new Date().toISOString().split('T')[0])
    setPaymentMethod((p.payment_method as any) || 'BANK_TRANSFER')
    setReferenceNo(p.reference_no || '')
    setNotes(p.notes || '')
    setErrorMsg('')
  }

  function cancelEdit() {
    setEditingPaymentId(null)
    setAmount('')
    setReferenceNo('')
    setNotes('')
    setErrorMsg('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) {
      setErrorMsg('Please enter an amount greater than 0.')
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
            payout_month: selectedMonth,
            amount: num,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            reference_no: referenceNo,
            notes,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update disbursement')
        setEditingPaymentId(null)
        setSuccessMsg('Disbursement updated successfully!')
      } else {
        const res = await fetch('/api/projects/commissions/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'MONTHLY_PAYOUT',
            recipient_id: member.id,
            payout_month: selectedMonth,
            amount: num,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            reference_no: referenceNo,
            notes,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to record payout')
        setSuccessMsg(`Disbursement of SAR ${num.toLocaleString('en-US')} recorded for ${member.name}!`)
      }

      setAmount('')
      setReferenceNo('')
      setNotes('')
      await fetchPayouts()
      onPayoutChanged()
      setTimeout(() => setSuccessMsg(''), 3500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving payout')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(p: CommissionPayment) {
    if (!confirm('Remove this disbursement record?')) return
    try {
      const res = await fetch(
        `/api/projects/commissions/payments?id=${encodeURIComponent(p.id)}&commissionId=${encodeURIComponent(p.commission_id || '')}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to delete')
      }
      if (editingPaymentId === p.id) cancelEdit()
      await fetchPayouts()
      onPayoutChanged()
      setSuccessMsg('Disbursement removed.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting disbursement')
    }
  }

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
          maxWidth: 740,
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
            padding: '16px 22px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Banknote size={18} color="#059669" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                Monthly Commission Payouts — {member.name}
              </h3>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
              Target Rule: <strong>X = SAR {thresholdX.toLocaleString('en-US')}</strong> · Tier Share:{' '}
              <strong>{rateY > 0 ? `${rateY}% above X` : '100% (No threshold)'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={kpiFilter}
              onChange={(e) => setKpiFilter(e.target.value)}
              className="form-select"
              style={{ width: 'auto', height: 32, fontSize: 12, fontWeight: 700 }}
              title="Filter disbursed KPI by cycle"
            >
              <option value="ALL">All Cycles</option>
              {Array.from(
                new Set([
                  new Date().toISOString().slice(0, 7),
                  ...payments.map((p) => p.payout_month || (p.payment_date || '').slice(0, 7)).filter(Boolean),
                ])
              )
                .sort()
                .reverse()
                .map((m) => (
                  <option key={m} value={m}>
                    Cycle: {m}
                  </option>
                ))}
            </select>

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
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                Earned (After Target X)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#065F46', marginTop: 4 }}>
                SAR {earnedCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                From SAR {grossVolume.toLocaleString('en-US')} volume
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase' }}>
                Disbursed ({kpiFilter === 'ALL' ? 'All Cycles' : kpiFilter})
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#1E3A8A', marginTop: 4 }}>
                SAR {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: balancePayable > 0 ? '#B45309' : '#059669', fontWeight: 700, marginTop: 2 }}>
                {balancePayable > 0 ? `Payable: SAR ${balancePayable.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Settled'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#B45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} /> Dev Collection
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#92400E', marginTop: 4 }}>
                {collectionPct}% Collected
              </div>
              <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                SAR {collectedFromDevelopers.toLocaleString('en-US')} received
              </div>
            </div>
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12.5, marginBottom: 12 }}>
              <AlertCircle size={14} /> <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
              <CheckCircle2 size={14} /> <span>{successMsg}</span>
            </div>
          )}

          {/* Log / Edit Disbursement Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: 14,
              borderRadius: 10,
              border: editingPaymentId ? '1.5px solid #F59E0B' : '1px solid #BFDBFE',
              background: editingPaymentId ? '#FFFBEB' : '#EFF6FF',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: editingPaymentId ? '#B45309' : '#1E3A8A' }}>
                {editingPaymentId ? '✏️ Edit Recorded Disbursement' : '+ Record Monthly Commission Disbursement'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {editingPaymentId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    style={{ fontSize: 11, fontWeight: 700, color: '#64748B', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                  >
                    Cancel Edit
                  </button>
                )}
                {!editingPaymentId && balancePayable > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(balancePayable.toFixed(2)))}
                    style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: '#DBEAFE', border: '1px solid #93C5FD', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                  >
                    Fill Payable (SAR {balancePayable.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                  Cycle Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', height: 32, fontSize: 12, background: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#334155', marginBottom: 3 }}>
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
                  style={{ width: '100%', height: 32, fontSize: 12, background: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                  Paid Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', height: 32, fontSize: 12, background: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                  Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="form-select"
                  style={{ width: '100%', height: 32, fontSize: 12, background: '#fff' }}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="PAYROLL">With Payroll</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Ref # (optional)"
                className="form-input"
                style={{ width: 150, height: 32, fontSize: 12, background: '#fff' }}
              />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (e.g. Oct commission settlement)"
                className="form-input"
                style={{ flex: 1, height: 32, fontSize: 12, background: '#fff' }}
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-sm"
                style={{
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: editingPaymentId ? '#D97706' : undefined,
                  borderColor: editingPaymentId ? '#D97706' : undefined,
                }}
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>{editingPaymentId ? 'Save Changes' : 'Record Payout'}</span>
              </button>
            </div>
          </form>

          {/* Payout History */}
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
            Disbursement History for {member.name} ({matchingPayments.length})
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 12.5 }}>Loading...</div>
          ) : matchingPayments.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 12.5, border: '1px dashed #CBD5E1', borderRadius: 10 }}>
              No disbursements recorded for this selection.
            </div>
          ) : (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: 11 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Paid Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Cycle</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Method &amp; Ref</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Notes</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matchingPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9', background: editingPaymentId === p.id ? '#FFFBEB' : undefined }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} color="#64748B" /> {p.payment_date}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1E40AF' }}>
                        {p.payout_month || p.payment_date.slice(0, 7)}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {p.payment_method.replace('_', ' ')} {p.reference_no ? `(${p.reference_no})` : ''}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>{p.notes || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1D4ED8', whiteSpace: 'nowrap' }}>
                        SAR {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', padding: 3 }}
                            title="Edit disbursement"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 3 }}
                            title="Delete disbursement"
                          >
                            <Trash2 size={12} />
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
  )
}
