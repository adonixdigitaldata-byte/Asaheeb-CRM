'use client'

import { useState, useEffect } from 'react'
import {
  X,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  User,
  ShieldCheck,
  Monitor,
  Smartphone,
  Globe,
  Server,
  Wifi,
  Edit3,
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
  onOpenAdjustHours?: (log: AttendanceLog) => void
}

export default function ExceptionReviewModal({
  isOpen,
  onClose,
  log,
  punchType,
  adminId,
  onReviewed,
  onOpenAdjustHours,
}: ExceptionReviewModalProps) {
  const [activePunchType, setActivePunchType] = useState<'IN' | 'OUT'>(punchType)
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    setActivePunchType(punchType)
  }, [punchType, isOpen])

  useEffect(() => {
    if (log) {
      setAdminNotes(log.review_notes || '')
    }
  }, [log, isOpen])

  if (!isOpen || !log) return null

  const isPunchIn = activePunchType === 'IN'
  const currentStatus = isPunchIn ? log.punch_in_status : log.punch_out_status
  const reason = isPunchIn ? log.punch_in_reason : log.punch_out_reason
  const explanation = isPunchIn ? log.punch_in_explanation : log.punch_out_explanation
  const selfieUrl = isPunchIn ? log.punch_in_selfie_url : log.punch_out_selfie_url
  const distance = isPunchIn ? log.punch_in_distance_m : log.punch_out_distance_m
  const lat = isPunchIn ? log.punch_in_lat : log.punch_out_lat
  const lng = isPunchIn ? log.punch_in_lng : log.punch_out_lng
  const accuracy = isPunchIn ? log.punch_in_accuracy : log.punch_out_accuracy
  const time = isPunchIn ? log.punch_in_at : log.punch_out_at
  const matchScore = isPunchIn ? log.punch_in_face_match_score : log.punch_out_face_match_score
  const deviceInfo = isPunchIn ? log.punch_in_device_info : log.punch_out_device_info
  const networkInfo = isPunchIn ? log.punch_in_network_info : log.punch_out_network_info
  const ipAddress = isPunchIn ? log.punch_in_ip : log.punch_out_ip

  async function handleAction(action: 'APPROVED' | 'FLAGGED') {
    if (!log) return
    setIsProcessing(true)
    try {
      await reviewAttendancePunch(
        log.id,
        activePunchType,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Remote Punch Review
                </h2>
                {currentStatus === 'FLAGGED' ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      border: '1px solid #FCA5A5',
                    }}
                  >
                    🚩 Flagged
                  </span>
                ) : currentStatus === 'APPROVED' ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#DCFCE7',
                      color: '#16A34A',
                      border: '1px solid #86EFAC',
                    }}
                  >
                    ✅ Approved
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#FEF3C7',
                      color: '#B45309',
                      border: '1px solid #FCD34D',
                    }}
                  >
                    ⏳ Pending Review
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                {log.employee_name || 'Employee'} • {log.date} at{' '}
                {time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
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

        {/* Punch In / Out Tab Selector if both exist */}
        {log.punch_out_at && (
          <div
            style={{
              display: 'flex',
              padding: '8px 24px 0',
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={() => setActivePunchType('IN')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px 6px 0 0',
                border: 'none',
                borderBottom: activePunchType === 'IN' ? '2px solid #2563EB' : '2px solid transparent',
                backgroundColor: activePunchType === 'IN' ? '#FFFFFF' : 'transparent',
                color: activePunchType === 'IN' ? '#2563EB' : '#64748B',
                cursor: 'pointer',
              }}
            >
              Punch In ({log.punch_in_status || 'PENDING'})
            </button>
            <button
              type="button"
              onClick={() => setActivePunchType('OUT')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px 6px 0 0',
                border: 'none',
                borderBottom: activePunchType === 'OUT' ? '2px solid #2563EB' : '2px solid transparent',
                backgroundColor: activePunchType === 'OUT' ? '#FFFFFF' : 'transparent',
                color: activePunchType === 'OUT' ? '#2563EB' : '#64748B',
                cursor: 'pointer',
              }}
            >
              Punch Out ({log.punch_out_status || 'PENDING'})
            </button>
          </div>
        )}

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

          {/* Device & Network Telemetry */}
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>
                Device &amp; Network Telemetry
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
                    fontWeight: 600,
                  }}
                >
                  Inspect GPS on Map <ExternalLink size={11} />
                </a>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Monitor size={14} color="#2563EB" />
                <span style={{ color: '#0F172A', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deviceInfo?.deviceName || deviceInfo?.os || 'Desktop OS'} ({deviceInfo?.browser || 'Browser'})
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Server size={14} color="#7C3AED" />
                <span style={{ color: '#0F172A', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  IP: {ipAddress || networkInfo?.ip || 'N/A'}
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  fontSize: '11px',
                  color: '#64748B',
                  gridColumn: 'span 2',
                }}
              >
                Network: <strong>{networkInfo?.effectiveType || 'Broadband'}</strong> · Latency: <strong>{networkInfo?.rttMs || '<50ms'}</strong> · Cores: <strong>{deviceInfo?.hardwareConcurrency || 'N/A'}</strong> · RAM: <strong>{deviceInfo?.deviceMemoryGb || 'N/A'}</strong>
              </div>
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
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            Close
          </button>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {onOpenAdjustHours && (
              <button
                type="button"
                onClick={() => {
                  onOpenAdjustHours(log)
                  onClose()
                }}
                className="btn btn-outline"
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  borderColor: '#93C5FD',
                  color: '#1E40AF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Adjust punch times and granted work hours"
              >
                <Edit3 size={15} /> Adjust Work Hours
              </button>
            )}

            <button
              onClick={() => handleAction('FLAGGED')}
              disabled={isProcessing}
              style={{
                padding: '8px 14px',
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
                padding: '8px 18px',
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
