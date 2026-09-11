'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, Calendar, CheckCircle2, AlertTriangle, Edit3, ShieldAlert, Send, Moon } from 'lucide-react'
import { AttendanceLog } from '@/types/attendance'
import {
  regularizeAttendanceLog,
  requestAttendanceRegularization,
  parseRegularizationRequestNotes,
  formatTo24HourTime,
  cleanRegularizationReason,
  localTimeToIso,
  formatTime24to12,
  formatDisplayTime,
} from '@/lib/attendanceService'

interface RegularizeAttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  log: AttendanceLog | null
  employeeName?: string
  adminId: string
  expectedHours?: number
  isRequestMode?: boolean
  onSuccess: () => void
}

export default function RegularizeAttendanceModal({
  isOpen,
  onClose,
  log,
  employeeName = '',
  adminId,
  expectedHours = 8,
  isRequestMode = false,
  onSuccess,
}: RegularizeAttendanceModalProps) {
  const [date, setDate] = useState('')
  const [inTime, setInTime] = useState('09:00')
  const [outTime, setOutTime] = useState('17:00')
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [regularizationDetails, setRegularizationDetails] = useState<{
    isRegularization: boolean
    requestedIn?: string
    requestedOut?: string
    requestedDurationHours?: string
    reason?: string
  }>({ isRegularization: false })

  // Prevents closing modal when user is clicking & dragging to select text
  const isMouseDownOnOverlayRef = useRef(false)

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    isMouseDownOnOverlayRef.current = e.target === e.currentTarget
  }

  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    if (isMouseDownOnOverlayRef.current && e.target === e.currentTarget) {
      onClose()
    }
    isMouseDownOnOverlayRef.current = false
  }

  useEffect(() => {
    if (isOpen) {
      if (log) {
        setDate(log.date || new Date().toISOString().split('T')[0])
        const inStr = log.punch_in_at
          ? new Date(log.punch_in_at).toTimeString().slice(0, 5)
          : '09:00'
        const outStr = log.punch_out_at
          ? new Date(log.punch_out_at).toTimeString().slice(0, 5)
          : '17:00'

        const parsed = parseRegularizationRequestNotes(log.review_notes)
        setRegularizationDetails(parsed)

        if (parsed.isRegularization) {
          // Both Admin and Employee: pre-populate with requested times
          const reqIn24 = parsed.requestedIn ? formatTo24HourTime(parsed.requestedIn) : null
          const reqOut24 = parsed.requestedOut ? formatTo24HourTime(parsed.requestedOut) : null

          setInTime(reqIn24 || inStr)
          setOutTime(reqOut24 || outStr)

          if (!isRequestMode) {
            const clean = cleanRegularizationReason(parsed.reason)
            setReason(clean ? `Approved: ${clean}` : 'Shift regularization approved')
          } else {
            setReason(cleanRegularizationReason(parsed.reason) || '')
          }
        } else if (isRequestMode) {
          // Fresh employee request
          setInTime(inStr)
          setOutTime(outStr)
          setReason('')
        } else {
          // Admin adjusting a log
          setInTime(inStr)
          setOutTime(outStr)
          const clean = cleanRegularizationReason(log.review_notes)
          setReason(clean || 'Shift time regularized by Admin')
        }
      } else {
        setDate(new Date().toISOString().split('T')[0])
        setInTime('09:00')
        setOutTime('17:00')
        setReason('')
        setRegularizationDetails({ isRegularization: false })
      }
      setErrorMsg('')
      setSuccessMsg('')
    }
  }, [isOpen, log, isRequestMode])

  if (!isOpen) return null

  // Calculate live duration & handle overnight shifts crossing midnight
  let durationMins = 0
  let isOvernight = false
  if (inTime && outTime) {
    const [inH, inM] = inTime.split(':').map(Number)
    const [outH, outM] = outTime.split(':').map(Number)
    const inTotal = inH * 60 + inM
    const outTotal = outH * 60 + outM
    if (outTotal < inTotal) {
      isOvernight = true
      durationMins = (24 * 60 - inTotal) + outTotal
    } else {
      durationMins = outTotal - inTotal
    }
  }

  const durationHrs = (durationMins / 60).toFixed(1)
  const expectedMins = expectedHours * 60
  const diffMins = durationMins - expectedMins
  const hasDeficit = diffMins < 0
  const deficitHrs = (Math.abs(diffMins) / 60).toFixed(1)

  async function handleSave() {
    if (!date || !inTime || !outTime) {
      setErrorMsg('Please specify date, punch-in time, and punch-out time.')
      return
    }

    if (isRequestMode && (!reason || !reason.trim())) {
      setErrorMsg('Please specify the reason for your regularization request.')
      return
    }

    setIsSaving(true)
    setErrorMsg('')
    try {
      // Create exact local timezone ISO strings and explicit local 12-hour display strings
      const punchInIso = localTimeToIso(date, inTime, false)
      const punchOutIso = localTimeToIso(date, outTime, isOvernight)
      const inDisplay = formatTime24to12(inTime)
      const outDisplay = formatTime24to12(outTime)

      if (isRequestMode) {
        await requestAttendanceRegularization({
          logId: log?.id || `req-${Date.now()}`,
          punchInAt: punchInIso,
          punchOutAt: punchOutIso,
          reason: reason.trim(),
          userId: log?.user_id || adminId,
          employeeName,
          date,
          inDisplay,
          outDisplay,
        })
        setSuccessMsg('Regularization request submitted to Admin successfully!')
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1200)
      } else {
        await regularizeAttendanceLog({
          logId: log?.id || `reg-${Date.now()}`,
          punchInAt: punchInIso,
          punchOutAt: punchOutIso,
          reason: reason || 'Shift time regularized by Admin',
          adminId,
          userId: log?.user_id || adminId,
          date,
          inDisplay,
          outDisplay,
        })
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Failed to process regularization.')
    } finally {
      setIsSaving(false)
    }
  }

  const modalContent = (
    <div
      className="modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="card"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Edit3 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {isRequestMode
                  ? regularizationDetails.isRegularization
                    ? 'Update Shift Regularization'
                    : 'Request Shift Regularization'
                  : 'Regularize Shift Attendance'}
              </h3>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                {isRequestMode
                  ? regularizationDetails.isRegularization
                    ? 'Update your pending request for this shift (only 1 request allowed at a time)'
                    : 'Submit proposed shift times for Admin verification & approval'
                  : employeeName
                  ? `Adjusting log for ${employeeName}`
                  : 'Correct punch-in / punch-out times'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isRequestMode && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: regularizationDetails.isRegularization ? '#F5F3FF' : '#EFF6FF',
                border: regularizationDetails.isRegularization ? '1px solid #DDD6FE' : '1px solid #BFDBFE',
                color: regularizationDetails.isRegularization ? '#6D28D9' : '#1E40AF',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Send size={15} color={regularizationDetails.isRegularization ? '#7C3AED' : '#2563EB'} />
              <span>
                {regularizationDetails.isRegularization ? (
                  <>
                    <strong>Active Request Pending:</strong> You already have a request under review for this shift. Modifying below will revise your submitted request (only 1 request allowed at a time).
                  </>
                ) : (
                  <>
                    <strong>Employee Request:</strong> This will submit your requested shift times to the Admin team for review and approval (only 1 request allowed per shift).
                  </>
                )}
              </span>
            </div>
          )}

          {regularizationDetails.isRegularization && !isRequestMode && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                backgroundColor: '#F5F3FF',
                border: '1px solid #DDD6FE',
                color: '#5B21B6',
                fontSize: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <Clock size={16} color="#7C3AED" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700 }}>Employee Regularization Request Details:</div>
                <div style={{ marginTop: 3 }}>
                  Requested:{' '}
                  <strong>
                    {regularizationDetails.requestedIn || '--'} → {regularizationDetails.requestedOut || '--'}
                  </strong>
                  {regularizationDetails.requestedDurationHours && (
                    <span style={{ marginLeft: 6, color: '#6D28D9' }}>
                      ({regularizationDetails.requestedDurationHours})
                    </span>
                  )}
                </div>
                {regularizationDetails.reason && (
                  <div style={{ marginTop: 3, color: '#4C1D95' }}>
                    Reason: <em>&ldquo;{regularizationDetails.reason}&rdquo;</em>
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: 11, color: '#6D28D9', fontStyle: 'italic' }}>
                  Requested punch times have been pre-filled below. You can adjust them or confirm directly.
                </div>
              </div>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                color: '#15803D',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={15} color="#16A34A" />
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={15} />
              {errorMsg}
            </div>
          )}

          {/* Date */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Shift Date
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Times Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Punch In (Start)
              </label>
              <input
                type="time"
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Punch Out (End)
              </label>
              <input
                type="time"
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Duration & Policy Compliance Card */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              backgroundColor: hasDeficit ? '#FFFBEB' : '#F0FDF4',
              border: hasDeficit ? '1px solid #FDE68A' : '1px solid #BBF7D0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                Calculated Shift Duration:
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                {durationHrs} hrs ({durationMins}m)
              </span>
            </div>

            <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              {hasDeficit ? (
                <span style={{ color: '#D97706' }}>⚠️ -{deficitHrs}h Deficit vs configured {expectedHours}h standard</span>
              ) : (
                <span style={{ color: '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} color="#16A34A" />
                  Target Met (0h Deficit • Full Shift)
                </span>
              )}
              {isOvernight && (
                <span style={{ color: '#2563EB', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: 4, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Moon size={12} /> Overnight shift (ends {outTime} next morning)
                </span>
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              {isRequestMode ? 'Reason for Regularization Request *' : 'Reason for Adjustment'}
            </label>
            <input
              type="text"
              placeholder={isRequestMode ? 'Explain why punch-out was missed or regularized times requested...' : 'e.g. Employee forgot to punch out at EOD, verified with manager'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            backgroundColor: '#F8FAFC',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="btn btn-outline"
            style={{ fontSize: 13, padding: '8px 16px' }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || Boolean(successMsg)}
            className="btn btn-primary"
            style={{
              fontSize: 13,
              padding: '8px 20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isSaving
              ? isRequestMode
                ? 'Submitting Request...'
                : 'Saving...'
              : isRequestMode
              ? regularizationDetails.isRegularization
                ? 'Update Regularization Request'
                : 'Submit Regularization Request'
              : 'Confirm & Save Adjustment'}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
