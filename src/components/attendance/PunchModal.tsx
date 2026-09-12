'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Navigation,
  ShieldCheck,
  Building,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Wifi,
  Cpu,
  ArrowRight,
  Server,
  Edit3,
  Check,
  Laptop,
} from 'lucide-react'
import { CompanyLocation, EXCEPTION_REASONS, ExceptionReason } from '@/types/attendance'
import {
  getDeviceCoordinates,
  calculateDistanceMeters,
  formatDistance,
  Coordinates,
} from '@/lib/geoUtils'
import { submitPunchIn, submitPunchOut } from '@/lib/attendanceService'
import {
  captureClientTelemetry,
  saveDeviceNickname,
  getSavedDeviceNickname,
  AttendanceTelemetry,
  DeviceSpecs,
  NetworkSpecs,
} from '@/lib/deviceTelemetry'

interface PunchModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userName?: string
  userAvatar?: string | null
  punchType: 'IN' | 'OUT'
  office: CompanyLocation
  onSuccess: () => void
}

export default function PunchModal({
  isOpen,
  onClose,
  userId,
  userName = 'Employee',
  punchType,
  office,
  onSuccess,
}: PunchModalProps) {
  const [step, setStep] = useState<'GEO' | 'REASON' | 'CONFIRM' | 'SUBMITTING' | 'SUCCESS'>('GEO')
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [distanceMeters, setDistanceMeters] = useState<number>(0)
  const [isInside, setIsInside] = useState<boolean>(true)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Telemetry state
  const [telemetry, setTelemetry] = useState<AttendanceTelemetry | null>(null)
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(true)

  // Exception inputs
  const [reason, setReason] = useState<ExceptionReason>('Client / Business meeting')
  const [explanation, setExplanation] = useState<string>('')

  // Submitting / Error state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isComponentOpenRef = useRef<boolean>(isOpen)

  useEffect(() => {
    isComponentOpenRef.current = isOpen
    if (isOpen) {
      resetState()
      runVerificationPipeline()
    }
  }, [isOpen, userId])

  function resetState() {
    setStep('GEO')
    setCoords(null)
    setDistanceMeters(0)
    setIsInside(true)
    setGeoError(null)
    setTelemetry(null)
    setTelemetryLoading(true)
    setReason('Client / Business meeting')
    setExplanation('')
    setSubmitError(null)
    setIsSubmitting(false)
  }

  async function runVerificationPipeline() {
    setGeoError(null)
    setTelemetryLoading(true)

    try {
      // 1. Fetch telemetry and GPS concurrently
      const [pos, telem] = await Promise.all([
        getDeviceCoordinates(),
        captureClientTelemetry(),
      ])

      if (!isComponentOpenRef.current) return

      setCoords(pos)
      setTelemetry(telem)
      setTelemetryLoading(false)

      const dist = calculateDistanceMeters(
        pos.latitude,
        pos.longitude,
        office.latitude,
        office.longitude
      )
      setDistanceMeters(dist)
      const inside = dist <= office.radius_meters
      setIsInside(inside)

      if (inside) {
        setStep('CONFIRM')
      } else {
        setStep('REASON')
      }
    } catch (err: any) {
      if (isComponentOpenRef.current) {
        // Even if GPS fails, still try to capture telemetry
        captureClientTelemetry()
          .then((telem) => {
            if (isComponentOpenRef.current) {
              setTelemetry(telem)
              setTelemetryLoading(false)
            }
          })
          .catch(() => {})

        setGeoError(err.message || 'GPS location error. Please ensure location permissions are enabled.')
      }
    }
  }

  async function handleConfirmPunch() {
    if (!coords) {
      setSubmitError('Precise GPS location is required to verify your attendance record.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setStep('SUBMITTING')

    try {
      const payload = {
        userId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        distanceMeters,
        isInsideGeofence: isInside,
        reason: !isInside ? reason : undefined,
        explanation: !isInside ? explanation : undefined,
        deviceInfo: telemetry?.device || null,
        networkInfo: telemetry?.network || null,
        ipAddress: telemetry?.network.ip || null,
      }

      if (punchType === 'IN') {
        await submitPunchIn(payload)
      } else {
        await submitPunchOut(payload)
      }

      setStep('SUCCESS')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'Failed to submit punch. Please try again.')
      setStep('CONFIRM')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const isPunchIn = punchType === 'IN'
  const actionTitle = isPunchIn ? 'Punch In' : 'Punch Out'

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
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: isPunchIn ? '#DCFCE7' : '#FEE2E2',
                color: isPunchIn ? '#16A34A' : '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {actionTitle} Verification
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0, marginTop: '2px' }}>
                Secure Geofence &amp; Device Network Diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {/* STEP 1: INITIAL LOCATION & TELEMETRY LOADING */}
          {step === 'GEO' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '30px 10px',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Loader2 size={30} className="animate-spin" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Acquiring Geolocation &amp; Device Specs
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '380px', margin: '0 auto' }}>
                  Verifying your position relative to {office.name} and capturing network telemetry...
                </p>
              </div>

              {geoError && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: '#991B1B',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    marginTop: '10px',
                    width: '100%',
                  }}
                >
                  <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>{geoError}</div>
                  <button
                    onClick={runVerificationPipeline}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#DC2626',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: REMOTE EXCEPTION REASON */}
          {step === 'REASON' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
                    Remote Location Detected ({formatDistance(distanceMeters)} from HQ)
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.9 }}>
                    You are outside the {office.radius_meters}m geofence perimeter of {office.name}. Please select a business reason for admin review.
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Business Exception Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ExceptionReason)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    outline: 'none',
                  }}
                >
                  {EXCEPTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Additional Notes / Details (Optional)
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="e.g. Attending client meeting at King Road Tower..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep('CONFIRM')}
                  style={{
                    flex: 1.5,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Review Telemetry</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 & 4: CONFIRMATION & TELEMETRY SUMMARY */}
          {(step === 'CONFIRM' || step === 'SUBMITTING') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Geofence Status Card */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: isInside ? '#F0FDF4' : '#FFFBEB',
                  border: `1px solid ${isInside ? '#BBF7D0' : '#FDE68A'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: isInside ? '#DCFCE7' : '#FEF3C7',
                    color: isInside ? '#16A34A' : '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: isInside ? '#166534' : '#92400E' }}>
                    {isInside ? '🟢 Within Jeddah Headquarters Geofence' : `🟡 Remote Punch (${formatDistance(distanceMeters)})`}
                  </div>
                  <div style={{ fontSize: '12px', color: isInside ? '#15803D' : '#B45309', marginTop: '1px' }}>
                    {isInside
                      ? `Verified inside ${office.radius_meters}m perimeter (${formatDistance(distanceMeters)} away)`
                      : `Exception: ${reason} (Queued for Admin Approval)`}
                  </div>
                </div>
              </div>

              {/* Telemetry Details Grid */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Hardware &amp; Network Fingerprint
                  </div>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: '#16A34A',
                      backgroundColor: '#DCFCE7',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ShieldCheck size={12} /> Auto-Verified
                  </span>
                </div>

                {/* Device / Laptop Model Banner */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Laptop size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                      Identified Device / Laptop
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {telemetry?.device.deviceName || 'Personal Workstation'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Device Form & OS */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {telemetry?.device.deviceType === 'Mobile' ? (
                      <Smartphone size={18} style={{ color: '#2563EB', flexShrink: 0 }} />
                    ) : telemetry?.device.deviceType === 'Tablet' ? (
                      <Tablet size={18} style={{ color: '#2563EB', flexShrink: 0 }} />
                    ) : (
                      <Monitor size={18} style={{ color: '#2563EB', flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>Device &amp; OS</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {telemetry?.device.os || 'Desktop OS'}
                      </div>
                    </div>
                  </div>

                  {/* Browser */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Globe size={18} style={{ color: '#0284C7', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>Browser</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {telemetry?.device.browser || 'Browser'}
                      </div>
                    </div>
                  </div>

                  {/* Public IP */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Server size={18} style={{ color: '#7C3AED', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>Client IP Address</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {telemetry?.network.ip || '127.0.0.1'}
                      </div>
                    </div>
                  </div>

                  {/* Connection / Speed */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Wifi size={18} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>Network &amp; Speed</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {telemetry?.network.effectiveType || 'Broadband'} ({telemetry?.network.downlinkMbps || 'Fast'})
                      </div>
                    </div>
                  </div>
                </div>

                {/* Micro hardware info line */}
                <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px', flexWrap: 'wrap' }}>
                  <Cpu size={13} />
                  <span>
                    CPU: {telemetry?.device.hardwareConcurrency} · RAM: {telemetry?.device.deviceMemoryGb} · Graphics: {telemetry?.device.gpuRenderer} · Screen: {telemetry?.device.screenResolution}
                  </span>
                </div>
              </div>

              {submitError && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#991B1B',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPunch}
                  disabled={isSubmitting}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: isPunchIn ? '#16A34A' : '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: isPunchIn
                      ? '0 4px 12px rgba(22, 163, 74, 0.3)'
                      : '0 4px 12px rgba(220, 38, 38, 0.3)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Recording Punch...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirm &amp; Record {actionTitle}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS CONFIRMATION */}
          {step === 'SUCCESS' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '24px 10px',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                  {actionTitle} Successfully Recorded!
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Timestamp, Geolocation, and Device Specs logged securely.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
