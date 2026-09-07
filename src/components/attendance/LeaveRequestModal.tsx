'use client'

import { useState } from 'react'
import {
  X,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react'
import { LeaveBalance, LeaveType } from '@/types/attendance'
import { submitLeaveRequest } from '@/lib/attendanceService'

interface LeaveRequestModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  balances: LeaveBalance
  onSubmitted: () => void
}

export default function LeaveRequestModal({
  isOpen,
  onClose,
  userId,
  balances,
  onSubmitted,
}: LeaveRequestModalProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>('ANNUAL')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  // Calculate days between start and end (inclusive)
  let totalDays = 0
  if (startDate && endDate) {
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (e >= s) {
      const diffTime = Math.abs(e.getTime() - s.getTime())
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    }
  }

  // Check quota
  const remainingAnnual = Math.max(0, balances.annual_leave_total - balances.annual_leave_used)
  const remainingSick = Math.max(0, balances.sick_leave_total - balances.sick_leave_used)
  const isOverAnnualQuota = leaveType === 'ANNUAL' && totalDays > remainingAnnual

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) {
      setErrorMsg('Please select both start and end dates.')
      return
    }
    if (totalDays <= 0) {
      setErrorMsg('End date must be on or after start date.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      await submitLeaveRequest({
        userId,
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason,
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onSubmitted()
        onClose()
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit leave request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Request Leave
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Submit time-off request for admin approval
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: '#E2E8F0',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Leave Quota Card */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-around',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Annual Leave Remaining
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284C7', marginTop: '2px' }}>
                {remainingAnnual} / {balances.annual_leave_total} days
              </div>
            </div>
            <div style={{ width: '1px', backgroundColor: '#E2E8F0' }} />
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Sick Leave Remaining
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                {remainingSick} / {balances.sick_leave_total} days
              </div>
            </div>
          </div>

          {/* Leave Type Select */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Leave Type *
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#0F172A',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="ANNUAL">Annual Paid Leave (Saudi Labor Standard)</option>
              <option value="SICK">Sick Leave (Medical Certificate)</option>
              <option value="EMERGENCY">Emergency Leave</option>
              <option value="UNPAID">Unpaid Leave</option>
            </select>
          </div>

          {/* Date Picker Range */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#0F172A',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                End Date *
              </label>
              <input
                type="date"
                required
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#0F172A',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Days Summary */}
          {totalDays > 0 && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: isOverAnnualQuota ? '#FEF2F2' : '#EFF6FF',
                border: `1px solid ${isOverAnnualQuota ? '#FCA5A5' : '#BFDBFE'}`,
                marginBottom: '16px',
                fontSize: '13px',
                color: isOverAnnualQuota ? '#B91C1C' : '#1D4ED8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Clock size={16} />
              <span>
                Total Duration: <strong>{totalDays} days</strong>
                {isOverAnnualQuota && (
                  <span> (Exceeds available annual quota of {remainingAnnual} days)</span>
                )}
              </span>
            </div>
          )}

          {/* Reason / Explanation */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Reason / Remarks
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Family vacation, medical appointment..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#0F172A',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || success}
              className="btn btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Submitting...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={15} /> Request Submitted!
                </>
              ) : (
                <>
                  <FileText size={15} /> Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
