'use client'

import { useState } from 'react'
import {
  X,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  User,
} from 'lucide-react'
import { AttendanceLog } from '@/types/attendance'
import { formatDistance, getGoogleMapsUrl } from '@/lib/geoUtils'
import { reviewAttendancePunch } from '@/lib/attendanceService'

interface ExceptionReviewModalProps {
  isOpen: boolean
  onClose: () => void
  log: AttendanceLog | null
  punchType: 'IN' | 'OUT'
  adminId: string
  onReviewed: () => void
}

export default function ExceptionReviewModal({
  isOpen,
  onClose,
  log,
  punchType,
  adminId,
  onReviewed,
}: ExceptionReviewModalProps) {
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen || !log) return null

  const isPunchIn = punchType === 'IN'
  const reason = isPunchIn ? log.punch_in_reason : log.punch_out_reason
  const explanation = isPunchIn ? log.punch_in_explanation : log.punch_out_explanation
  const selfieUrl = isPunchIn ? log.punch_in_selfie_url : log.punch_out_selfie_url
  const distance = isPunchIn ? log.punch_in_distance_m : log.punch_out_distance_m
  const lat = isPunchIn ? log.punch_in_lat : log.punch_out_lat
  const lng = isPunchIn ? log.punch_in_lng : log.punch_out_lng
  const accuracy = isPunchIn ? log.punch_in_accuracy : log.punch_out_accuracy
  const time = isPunchIn ? log.punch_in_at : log.punch_out_at

  async function handleAction(action: 'APPROVED' | 'FLAGGED') {
    if (!log) return
    setIsProcessing(true)
    try {
      await reviewAttendancePunch(
        log.id,
        punchType,
        action,
        adminNotes || (action === 'APPROVED' ? 'Approved by admin' : 'Flagged for review'),
        adminId
      )
      onReviewed()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: '560px',
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
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Remote Punch Exception Review
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                {log.employee_name || 'Employee'} • {log.date} at{' '}
                {time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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

        {/* Content */}
        <div style={{ padding: '24px', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Employee & Distance Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Employee
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0F172A',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <User size={15} color="#2563EB" /> {log.employee_name || 'Staff Member'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                {log.employee_role || 'AGENT'}
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FCD34D',
              }}
            >
              <div style={{ fontSize: '11px', color: '#B45309', textTransform: 'uppercase', fontWeight: 600 }}>
                Distance from HQ
              </div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#D97706',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <MapPin size={16} /> {formatDistance(distance || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#78350F', marginTop: '2px' }}>
                GPS Accuracy: ±{Math.round(accuracy || 10)}m
              </div>
            </div>
          </div>

          {/* Reason & Explanation */}
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
              Stated Reason &amp; Explanation
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              {reason || 'Field Work'}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#334155',
                marginTop: '6px',
                lineHeight: 1.5,
                backgroundColor: '#FFFFFF',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
              }}
            >
              &ldquo;{explanation || 'No explanation provided.'}&rdquo;
            </div>
          </div>

          {/* Selfie Snapshot */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Camera size={14} /> Biometric Selfie Snapshot
              </div>

              {lat && lng && (
                <a
                  href={getGoogleMapsUrl(lat, lng)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '11px',
                    color: '#2563EB',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Inspect on Map <ExternalLink size={11} />
                </a>
              )}
            </div>

            <div
              style={{
                width: '100%',
                maxHeight: '220px',
                borderRadius: '10px',
                overflow: 'hidden',
                backgroundColor: '#F1F5F9',
                border: '1px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selfieUrl ? (
                <img
                  src={selfieUrl}
                  alt="Selfie evidence"
                  style={{ width: '100%', maxHeight: '220px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ padding: '30px', color: '#94A3B8', fontSize: '12px' }}>
                  No selfie snapshot recorded for this punch.
                </div>
              )}
            </div>
          </div>

          {/* Admin Decision Notes */}
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
              Admin Review Notes (Optional)
            </label>
            <input
              type="text"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Verified with client meeting schedule"
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

        {/* Action Buttons */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Close
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleAction('FLAGGED')}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertTriangle size={15} /> Flag Punch
            </button>

            <button
              onClick={() => handleAction('APPROVED')}
              disabled={isProcessing}
              className="btn btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: '#16A34A',
                borderColor: '#16A34A',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} /> Approve Exception
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
