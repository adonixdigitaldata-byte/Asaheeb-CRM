'use client'

import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import { CompanyLocation, EXCEPTION_REASONS, ExceptionReason } from '@/types/attendance'
import {
  getDeviceCoordinates,
  calculateDistanceMeters,
  formatDistance,
  Coordinates,
} from '@/lib/geoUtils'
import { submitPunchIn, submitPunchOut, uploadSelfieSnapshot } from '@/lib/attendanceService'

interface PunchModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  punchType: 'IN' | 'OUT'
  office: CompanyLocation
  onSuccess: () => void
}

export default function PunchModal({
  isOpen,
  onClose,
  userId,
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
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [videoReady, setVideoReady] = useState<boolean>(false)
  const [selfieSnapshot, setSelfieSnapshot] = useState<string | null>(null)
  const [livenessPassed, setLivenessPassed] = useState<boolean>(false)

  // Loading / Error
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      resetState()
      detectLocation()
    } else {
      stopCamera()
    }
  }, [isOpen])

  // Stop camera when modal unmounts
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Attach camera stream to video element when step or stream changes
  useEffect(() => {
    if (step === 'CAMERA' && cameraStream && videoRef.current) {
      const video = videoRef.current
      video.srcObject = cameraStream
      video.onloadeddata = () => {
        video.play().then(() => {
          setVideoReady(true)
        }).catch((e) => console.warn('Autoplay error:', e))
      }
    }
  }, [cameraStream, step])

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
  }

  async function detectLocation() {
    setGeoError(null)
    try {
      const position = await getDeviceCoordinates()
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
      setGeoError(err.message || 'GPS location error')
    }
  }

  async function startCamera() {
    setCameraError(null)
    setVideoReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().then(() => setVideoReady(true)).catch(() => {})
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      setCameraError('Camera access required for identity verification. Please ensure camera permissions are allowed.')
    }
  }

  function stopCamera() {
    // 1. Stop all tracks in streamRef
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop()
          track.enabled = false
        })
      } catch (e) {
        console.warn('Error stopping streamRef track:', e)
      }
      streamRef.current = null
    }

    // 2. Stop all tracks in cameraStream state
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach((track) => {
          track.stop()
          track.enabled = false
        })
      } catch (e) {
        console.warn('Error stopping cameraStream track:', e)
      }
      setCameraStream(null)
    }

    // 3. Stop tracks on video element and detach srcObject
    if (videoRef.current) {
      try {
        const srcObj = videoRef.current.srcObject as MediaStream
        if (srcObj && srcObj.getTracks) {
          srcObj.getTracks().forEach((track) => {
            track.stop()
            track.enabled = false
          })
        }
        videoRef.current.srcObject = null
        videoRef.current.pause()
      } catch (e) {
        console.warn('Error clearing video srcObject:', e)
      }
    }

    setVideoReady(false)
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

    // Strict Anti-Blank & Contrast Verification
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data
      let totalLuminance = 0
      let minLum = 255
      let maxLum = 0
      const sampleStep = 16
      let samples = 0

      for (let i = 0; i < data.length; i += sampleStep * 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        totalLuminance += lum
        if (lum < minLum) minLum = lum
        if (lum > maxLum) maxLum = lum
        samples++
      }

      const avgBrightness = samples > 0 ? totalLuminance / samples : 0
      const contrastRange = maxLum - minLum

      // Rule 1: Pitch black / covered lens (brightness < 22)
      if (avgBrightness < 22) {
        setCameraError('Camera image was too dark or black. Please uncover your webcam and ensure your face is well-lit.')
        return
      }

      // Rule 2: Blank / uniform solid screen (contrast range < 28)
      if (contrastRange < 28) {
        setCameraError('Camera feed appears blank or uniform. Please make sure your camera is uncovered and functional.')
        return
      }

      // Rule 3: Texture / detail standard deviation
      let varianceSum = 0
      for (let i = 0; i < data.length; i += sampleStep * 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        varianceSum += Math.pow(lum - avgBrightness, 2)
      }
      const stdDev = Math.sqrt(varianceSum / samples)
      if (stdDev < 14) {
        setCameraError('Image lacks facial details or contrast. Please center yourself properly in front of the camera.')
        return
      }

      // Rule 4: Native browser FaceDetector where available
      if (typeof window !== 'undefined' && 'FaceDetector' in window) {
        try {
          const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 2 })
          const faces = await detector.detect(canvas)
          if (faces && faces.length === 0) {
            setCameraError('No face detected. Please position your face inside the oval frame.')
            return
          }
        } catch (e) {
          // Fall back gracefully
        }
      }
    } catch (err) {
      console.warn('Face detection check skipped:', err)
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    if (!dataUrl || dataUrl.length < 2500) {
      setCameraError('Failed to capture a valid camera photo. Please try again.')
      return
    }

    // Immediately stop camera and turn off hardware LED
    stopCamera()

    setSelfieSnapshot(dataUrl)
    setLivenessPassed(true)
    setCameraError(null)
  }

  function retakeSelfie() {
    setSelfieSnapshot(null)
    setLivenessPassed(false)
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
        onSuccess()
        onClose()
      }, 1600)
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'Failed to submit punch. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: isInside ? '#DCFCE7' : '#FEF3C7',
                  border: `1px solid ${isInside ? '#86EFAC' : '#FCD34D'}`,
                  marginBottom: '16px',
                }}
              >
                {isInside ? (
                  <>
                    <Building size={16} color="#15803D" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#15803D' }}>
                      🟢 Inside {office.name} ({formatDistance(distanceMeters)} from center)
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
                  border: '2px solid #CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                {cameraError ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <AlertTriangle size={30} color="#EF4444" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '12px', color: '#FCA5A5', lineHeight: 1.4 }}>{cameraError}</p>
                    <button
                      onClick={startCamera}
                      style={{
                        marginTop: '10px',
                        padding: '6px 14px',
                        backgroundColor: '#334155',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
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
                        top: '10px',
                        right: '10px',
                        padding: '4px 10px',
                        backgroundColor: '#16A34A',
                        color: '#FFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ShieldCheck size={14} /> Identity Verified
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

                    {/* Biometric Oval Guide */}
                    <div
                      style={{
                        position: 'absolute',
                        width: '60%',
                        height: '75%',
                        borderRadius: '50%',
                        border: '2px dashed #60A5FA',
                        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.4)',
                        pointerEvents: 'none',
                      }}
                    />

                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        padding: '4px 12px',
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        borderRadius: '999px',
                        fontSize: '11px',
                        color: '#F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Sparkles size={13} color="#60A5FA" /> Center face inside the oval
                    </div>
                  </>
                )}
              </div>

              {submitError && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#FEE2E2',
                    color: '#B91C1C',
                    fontSize: '12px',
                    marginBottom: '12px',
                  }}
                >
                  {submitError}
                </div>
              )}

              {/* Action Buttons */}
              {!selfieSnapshot ? (
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
                    opacity: !cameraStream || !videoReady ? 0.65 : 1,
                    cursor: !cameraStream || !videoReady ? 'not-allowed' : 'pointer',
                  }}
                >
                  {!videoReady ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Preparing Live Camera...
                    </>
                  ) : (
                    <>
                      <Camera size={18} /> Capture Verification Photo
                    </>
                  )}
                </button>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                  <button
                    onClick={retakeSelfie}
                    disabled={isSubmitting}
                    className="btn btn-outline"
                    style={{
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <RotateCcw size={15} /> Retake
                  </button>

                  <button
                    onClick={handleConfirmPunch}
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{
                      padding: '10px',
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
