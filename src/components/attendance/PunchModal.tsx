'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Loader2,
  Navigation,
  ShieldCheck,
  Building,
  UserCheck,
  Scan,
} from 'lucide-react'
import { CompanyLocation, EXCEPTION_REASONS, ExceptionReason } from '@/types/attendance'
import {
  getDeviceCoordinates,
  calculateDistanceMeters,
  formatDistance,
  Coordinates,
} from '@/lib/geoUtils'
import { submitPunchIn, submitPunchOut, uploadSelfieSnapshot } from '@/lib/attendanceService'
import {
  detectFace,
  matchFaceWithProfile,
  registerMediaTrack,
  forceStopAllCameraTracks,
  FaceDetectionResult,
  FaceMatchResult,
} from '@/lib/faceDetection'

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
  userAvatar,
  punchType,
  office,
  onSuccess,
}: PunchModalProps) {
  const [step, setStep] = useState<'GEO' | 'REASON' | 'CAMERA' | 'SUBMITTING' | 'SUCCESS'>('GEO')
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [distanceMeters, setDistanceMeters] = useState<number>(0)
  const [isInside, setIsInside] = useState<boolean>(true)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Exception inputs
  const [reason, setReason] = useState<ExceptionReason>('Client / Business meeting')
  const [explanation, setExplanation] = useState<string>('')

  // Camera & Face Verification
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const sessionCountRef = useRef<number>(0)
  const isComponentOpenRef = useRef<boolean>(isOpen)
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [videoReady, setVideoReady] = useState<boolean>(false)
  const [selfieSnapshot, setSelfieSnapshot] = useState<string | null>(null)
  const [livenessPassed, setLivenessPassed] = useState<boolean>(false)

  // Live Real-Time Face Detection State
  const [faceResult, setFaceResult] = useState<FaceDetectionResult>({
    detected: false,
    status: 'NO_FACE',
    message: 'Align face inside the biometric frame',
    confidence: 0,
  })

  // Biometric Profile Match Result
  const [faceMatch, setFaceMatch] = useState<FaceMatchResult | null>(null)

  // Loading / Error
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Cleanup helper
  const terminateAllCameraHardware = useCallback(() => {
    sessionCountRef.current += 1

    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current)
      detectionTimerRef.current = null
    }

    forceStopAllCameraTracks()

    if (videoRef.current) {
      try {
        const srcObj = videoRef.current.srcObject as MediaStream | null
        if (srcObj && srcObj.getTracks) {
          srcObj.getTracks().forEach((track) => {
            track.enabled = false
            track.stop()
          })
        }
        videoRef.current.srcObject = null
        videoRef.current.pause()
      } catch (e) {
        console.warn('Video element cleanup:', e)
      }
    }

    setCameraStream(null)
    setVideoReady(false)
    setFaceResult({
      detected: false,
      status: 'NO_FACE',
      message: 'Camera stopped',
      confidence: 0,
    })
  }, [])

  // Sync isOpen prop
  useEffect(() => {
    isComponentOpenRef.current = isOpen
    if (isOpen) {
      resetState()
      detectLocation()
      // Preload BlazeFace ML Model
      import('@/lib/faceDetection').then((m) => m.getBlazeFaceModel()).catch(() => {})
    } else {
      terminateAllCameraHardware()
    }
  }, [isOpen, terminateAllCameraHardware])

  // Guaranteed unmount & pagehide cleanup
  useEffect(() => {
    const handleUnload = () => terminateAllCameraHardware()
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      terminateAllCameraHardware()
    }
  }, [terminateAllCameraHardware])

  function handleCloseModal() {
    isComponentOpenRef.current = false
    terminateAllCameraHardware()
    onClose()
  }

  // Attach camera stream to video element
  useEffect(() => {
    if (step === 'CAMERA' && cameraStream && videoRef.current) {
      const video = videoRef.current
      video.srcObject = cameraStream
      video.onloadeddata = () => {
        video
          .play()
          .then(() => {
            setVideoReady(true)
          })
          .catch((e) => console.warn('Autoplay error:', e))
      }
    }
  }, [cameraStream, step])

  // Real-time Face Detection Loop on Active Video Stream
  useEffect(() => {
    if (step === 'CAMERA' && videoReady && !selfieSnapshot && videoRef.current) {
      const interval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const res = await detectFace(videoRef.current, { requireCentered: true })
          setFaceResult(res)
        } catch (e) {
          // ignore detection errors
        }
      }, 130)

      detectionTimerRef.current = interval

      return () => {
        clearInterval(interval)
        detectionTimerRef.current = null
      }
    }
  }, [step, videoReady, selfieSnapshot])

  function resetState() {
    setStep('GEO')
    setCoords(null)
    setDistanceMeters(0)
    setIsInside(true)
    setGeoError(null)
    setReason('Client / Business meeting')
    setExplanation('')
    setSelfieSnapshot(null)
    setLivenessPassed(false)
    setVideoReady(false)
    setCameraError(null)
    setSubmitError(null)
    setFaceMatch(null)
    setFaceResult({
      detected: false,
      status: 'NO_FACE',
      message: 'Align face inside the biometric frame',
      confidence: 0,
    })
  }

  async function detectLocation() {
    setGeoError(null)
    try {
      const position = await getDeviceCoordinates()
      if (!isComponentOpenRef.current) {
        terminateAllCameraHardware()
        return
      }

      setCoords(position)

      const dist = calculateDistanceMeters(
        position.latitude,
        position.longitude,
        office.latitude,
        office.longitude
      )
      setDistanceMeters(dist)
      const inside = dist <= office.radius_meters
      setIsInside(inside)

      if (inside) {
        setStep('CAMERA')
        startCamera()
      } else {
        setStep('REASON')
      }
    } catch (err: any) {
      if (isComponentOpenRef.current) {
        setGeoError(err.message || 'GPS location error')
      }
    }
  }

  async function startCamera() {
    setCameraError(null)
    setVideoReady(false)
    setFaceResult({
      detected: false,
      status: 'NO_FACE',
      message: 'Initializing biometric camera...',
      confidence: 0,
    })

    const currentSession = ++sessionCountRef.current

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      })

      // Register every track in global set
      stream.getTracks().forEach((track) => {
        registerMediaTrack(track)
      })

      // If modal was closed or session cancelled while awaiting getUserMedia
      if (!isComponentOpenRef.current || sessionCountRef.current !== currentSession) {
        stream.getTracks().forEach((track) => {
          track.enabled = false
          track.stop()
        })
        return
      }

      setCameraStream(stream)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current
          .play()
          .then(() => setVideoReady(true))
          .catch(() => {})
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      setCameraError(
        'Camera access is required for facial verification. Please ensure camera permissions are allowed in your browser.'
      )
    }
  }

  async function captureSelfie() {
    if (!videoRef.current) return
    const video = videoRef.current

    if (!videoReady || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera stream is still initializing. Please wait a moment for the preview to load.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Mirror horizontally for natural selfie
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // 1. Biometric Face Detection Validation
    try {
      const verification = await detectFace(canvas, { requireCentered: true })

      if (!verification.detected) {
        setCameraError(
          `Biometric Scan: ${verification.message}. Please face the camera directly in the center.`
        )
        return
      }
    } catch (err) {
      console.warn('Face detection error during capture:', err)
    }

    // 2. Facial Identity Match against Profile
    try {
      const match = await matchFaceWithProfile(canvas, userAvatar, userName)
      setFaceMatch(match)
    } catch (err) {
      console.warn('Match face error:', err)
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    if (!dataUrl || dataUrl.length < 2500) {
      setCameraError('Failed to capture a valid camera photo. Please try again.')
      return
    }

    // Immediately stop live hardware camera stream & LED
    terminateAllCameraHardware()

    setSelfieSnapshot(dataUrl)
    setLivenessPassed(true)
    setCameraError(null)
  }

  function retakeSelfie() {
    setSelfieSnapshot(null)
    setLivenessPassed(false)
    setFaceMatch(null)
    setVideoReady(false)
    startCamera()
  }

  async function handleConfirmPunch() {
    if (!coords) return
    if (!selfieSnapshot || selfieSnapshot.length < 2500) {
      setSubmitError('A clear facial selfie snapshot is strictly required to verify attendance.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    // Ensure camera is fully stopped
    terminateAllCameraHardware()

    try {
      const selfieUrl = await uploadSelfieSnapshot(
        selfieSnapshot,
        userId,
        punchType === 'IN' ? 'in' : 'out'
      )

      if (punchType === 'IN') {
        await submitPunchIn({
          userId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          distanceMeters,
          isInsideGeofence: isInside,
          selfieUrl,
          reason: !isInside ? reason : undefined,
          explanation: !isInside ? explanation : undefined,
        })
      } else {
        await submitPunchOut({
          userId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          distanceMeters,
          isInsideGeofence: isInside,
          selfieUrl,
          reason: !isInside ? reason : undefined,
          explanation: !isInside ? explanation : undefined,
        })
      }

      setStep('SUCCESS')
      setTimeout(() => {
        terminateAllCameraHardware()
        onSuccess()
        handleCloseModal()
      }, 1600)
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'Failed to submit punch. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCloseModal} style={{ zIndex: 9999 }}>
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.18)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: punchType === 'IN' ? '#DCFCE7' : '#FEE2E2',
                  color: punchType === 'IN' ? '#15803D' : '#B91C1C',
                }}
              >
                {punchType === 'IN' ? 'Punch In' : 'Punch Out'}
              </span>
              <span style={{ fontSize: '13px', color: '#64748B' }}>• {office.name}</span>
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '4px 0 0 0' }}>
              {punchType === 'IN' ? 'Start Your Workday' : 'Clock Out for Today'}
            </h2>
          </div>

          <button
            onClick={handleCloseModal}
            aria-label="Close modal"
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

        {/* Body Content */}
        <div style={{ padding: '24px', flex: 1 }}>
          {/* STEP 1: GPS DETECTION */}
          {step === 'GEO' && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              {geoError ? (
                <div>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <AlertTriangle size={26} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>
                    GPS Permission Needed
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, marginBottom: '20px' }}>
                    {geoError}
                  </p>
                  <button
                    onClick={detectLocation}
                    className="btn btn-primary"
                    style={{
                      padding: '10px 20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Navigation size={15} /> Retry GPS Check
                  </button>
                </div>
              ) : (
                <div>
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
                      margin: '0 auto 16px',
                    }}
                  >
                    <Loader2 size={28} className="animate-spin" />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                    Verifying Geolocation...
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B' }}>
                    Validating distance to {office.name}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: OUTSIDE HQ REASON */}
          {step === 'REASON' && (
            <div>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  marginBottom: '18px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <MapPin size={22} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#B45309' }}>
                    🟡 Outside Jeddah HQ ({formatDistance(distanceMeters)} away)
                  </div>
                  <div style={{ fontSize: '12px', color: '#78350F', marginTop: '2px' }}>
                    Your punch will be marked as <strong>Pending Review</strong> and submitted for admin review.
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '8px',
                  }}
                >
                  Reason for Working Outside HQ *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {EXCEPTION_REASONS.map((r) => (
                    <label
                      key={r}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: reason === r ? '#EFF6FF' : '#F8FAFC',
                        border: `1px solid ${reason === r ? '#2563EB' : '#E2E8F0'}`,
                        color: reason === r ? '#1D4ED8' : '#334155',
                        fontSize: '13px',
                        fontWeight: reason === r ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <input
                        type="radio"
                        name="exceptionReason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        style={{ accentColor: '#2563EB' }}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '8px',
                  }}
                >
                  What are you working on? (Explanation) *
                </label>
                <textarea
                  rows={3}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="e.g. Client meeting regarding Villa in Al-Basateen..."
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

              <button
                disabled={!explanation.trim()}
                onClick={() => {
                  setStep('CAMERA')
                  startCamera()
                }}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Continue to Facial Verification <Camera size={18} />
              </button>
            </div>
          )}

          {/* STEP 3: CAMERA VERIFICATION */}
          {step === 'CAMERA' && (
            <div>
              {/* Location Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: isInside ? '#DCFCE7' : '#FEF3C7',
                  border: `1px solid ${isInside ? '#86EFAC' : '#FCD34D'}`,
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isInside ? (
                    <>
                      <Building size={16} color="#15803D" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#15803D' }}>
                        🟢 Inside {office.name} ({formatDistance(distanceMeters)})
                      </span>
                    </>
                  ) : (
                    <>
                      <MapPin size={16} color="#B45309" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#B45309' }}>
                        🟡 Outside HQ ({formatDistance(distanceMeters)}) • {reason}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  <UserCheck size={14} color="#2563EB" />
                  <span>{userName}</span>
                </div>
              </div>

              {/* Camera Viewport */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1/1',
                  maxHeight: '320px',
                  backgroundColor: '#0F172A',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: `2px solid ${
                    selfieSnapshot
                      ? '#16A34A'
                      : faceResult.detected
                      ? '#22C55E'
                      : '#CBD5E1'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {cameraError ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '12px', color: '#FCA5A5', lineHeight: 1.4, maxWidth: '280px', margin: '0 auto' }}>
                      {cameraError}
                    </p>
                    <button
                      onClick={startCamera}
                      style={{
                        marginTop: '12px',
                        padding: '6px 14px',
                        backgroundColor: '#334155',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Retry Camera
                    </button>
                  </div>
                ) : selfieSnapshot ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src={selfieSnapshot}
                      alt="Selfie verification"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        padding: '5px 12px',
                        backgroundColor: '#16A34A',
                        color: '#FFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)',
                      }}
                    >
                      <ShieldCheck size={14} /> Biometric Facial Identity Verified
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        right: '12px',
                        padding: '6px 12px',
                        backgroundColor: 'rgba(15, 23, 42, 0.88)',
                        backdropFilter: 'blur(6px)',
                        color: '#F8FAFC',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{userName}</span>
                      <span style={{ color: '#4ADE80' }}>
                        {faceMatch ? faceMatch.message : 'Identity Authenticated'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={() => videoRef.current?.play()}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                      }}
                    />

                    {/* Biometric Oval Guide Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        width: '62%',
                        height: '78%',
                        borderRadius: '50%',
                        border: faceResult.detected
                          ? '3px solid #22C55E'
                          : '2px dashed rgba(245, 158, 11, 0.85)',
                        boxShadow: faceResult.detected
                          ? '0 0 22px rgba(34, 197, 94, 0.5), 0 0 0 9999px rgba(15, 23, 42, 0.45)'
                          : '0 0 0 9999px rgba(15, 23, 42, 0.45)',
                        pointerEvents: 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Biometric Corner Brackets when face detected */}
                      {faceResult.detected && (
                        <>
                          <div style={{ position: 'absolute', top: '-6px', left: '22%', width: '14px', height: '3px', backgroundColor: '#22C55E', borderRadius: '2px' }} />
                          <div style={{ position: 'absolute', top: '-6px', right: '22%', width: '14px', height: '3px', backgroundColor: '#22C55E', borderRadius: '2px' }} />
                          <div style={{ position: 'absolute', bottom: '-6px', left: '22%', width: '14px', height: '3px', backgroundColor: '#22C55E', borderRadius: '2px' }} />
                          <div style={{ position: 'absolute', bottom: '-6px', right: '22%', width: '14px', height: '3px', backgroundColor: '#22C55E', borderRadius: '2px' }} />
                        </>
                      )}
                    </div>

                    {/* Live Dynamic Status Bar inside camera */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        padding: '6px 14px',
                        backgroundColor: faceResult.detected
                          ? 'rgba(22, 101, 52, 0.92)'
                          : 'rgba(15, 23, 42, 0.88)',
                        backdropFilter: 'blur(6px)',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#F8FAFC',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: `1px solid ${
                          faceResult.detected ? '#4ADE80' : 'rgba(255, 255, 255, 0.15)'
                        }`,
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {faceResult.detected ? (
                        <>
                          <CheckCircle2 size={13} color="#4ADE80" />
                          <span>Face Detected ({faceResult.confidence}%) • Ready to Capture</span>
                        </>
                      ) : (
                        <>
                          <Scan size={13} color="#F59E0B" className="animate-pulse" />
                          <span>{faceResult.message}</span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {submitError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    color: '#B91C1C',
                    fontSize: '12px',
                    marginBottom: '14px',
                    lineHeight: 1.4,
                  }}
                >
                  {submitError}
                </div>
              )}

              {/* Action Buttons */}
              {!selfieSnapshot ? (
                <div>
                  <button
                    type="button"
                    onClick={captureSelfie}
                    disabled={!cameraStream || !videoReady}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backgroundColor: faceResult.detected ? '#16A34A' : '#2563EB',
                      borderColor: faceResult.detected ? '#16A34A' : '#2563EB',
                      opacity: !cameraStream || !videoReady ? 0.65 : 1,
                      cursor: !cameraStream || !videoReady ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {!videoReady ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Initializing Camera...
                      </>
                    ) : (
                      <>
                        <Camera size={18} /> Capture Verification Photo
                      </>
                    )}
                  </button>

                  {!faceResult.detected && videoReady && (
                    <p
                      style={{
                        fontSize: '11px',
                        color: '#64748B',
                        textAlign: 'center',
                        marginTop: '8px',
                        marginBottom: '0',
                      }}
                    >
                      💡 Please position your face inside the oval frame to capture.
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                  <button
                    onClick={retakeSelfie}
                    disabled={isSubmitting}
                    className="btn btn-outline"
                    style={{
                      padding: '11px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <RotateCcw size={15} /> Retake
                  </button>

                  <button
                    onClick={handleConfirmPunch}
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{
                      padding: '11px',
                      fontSize: '14px',
                      fontWeight: 700,
                      backgroundColor: punchType === 'IN' ? '#16A34A' : '#DC2626',
                      borderColor: punchType === 'IN' ? '#16A34A' : '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Recording Punch...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Confirm {punchType === 'IN' ? 'Punch In' : 'Punch Out'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'SUCCESS' && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                {punchType === 'IN' ? 'Punched In Successfully!' : 'Punched Out Successfully!'}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B' }}>
                {isInside
                  ? `🟢 Verified inside ${office.name}`
                  : '🟡 Remote Punch recorded (Pending Review)'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
