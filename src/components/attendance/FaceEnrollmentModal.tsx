'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Eye,
  Smile,
  ArrowRight,
} from 'lucide-react'
import {
  loadBiometricModels,
  analyzeLiveFace,
  enrollEmployeeFace,
  BiometricDetection,
} from '@/lib/biometricEngine'
import { uploadSelfieSnapshot } from '@/lib/attendanceService'

interface Props {
  isOpen: boolean
  userId: string
  userName: string
  isReEnrollment?: boolean
  onClose: () => void
  onSuccess: (descriptor: number[]) => void
}

type Step = 'CAMERA' | 'ALIGN' | 'LIVENESS' | 'COMPLETED'

export default function FaceEnrollmentModal({
  isOpen,
  userId,
  userName,
  isReEnrollment = false,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>('ALIGN')
  const [modelLoading, setModelLoading] = useState(true)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [detectionState, setDetectionState] = useState<BiometricDetection | null>(null)
  const [livenessPassed, setLivenessPassed] = useState(false)
  const [blinkDetected, setBlinkDetected] = useState(false)
  const [turnDetected, setTurnDetected] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null)
  const [sampleCount, setSampleCount] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)
  const isEnrollingRef = useRef(false)
  const sampleDescriptorsRef = useRef<number[][]>([])

  // 1. Initialize models & camera when modal opens
  useEffect(() => {
    if (!isOpen) return

    let isCancelled = false

    async function init() {
      setModelLoading(true)
      const loaded = await loadBiometricModels()
      if (isCancelled) return
      setModelLoading(false)

      if (loaded) {
        startCamera()
      } else {
        setCameraError('Failed to load biometric recognition models. Please refresh and try again.')
      }
    }

    init()

    return () => {
      isCancelled = true
      stopCamera()
    }
  }, [isOpen])

  function stopCamera() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => {
        t.enabled = false
        t.stop()
      })
      activeStreamRef.current = null
    }
    setCameraStream(null)
  }

  async function startCamera() {
    stopCamera()
    setCameraError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      })

      activeStreamRef.current = stream
      setCameraStream(stream)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        startLiveTracking()
      }
    } catch (err: any) {
      console.error('Camera open error:', err)
      setCameraError('Camera access denied or unavailable. Please enable camera permissions in your browser.')
    }
  }

  // 2. Real-time Live Face Tracking loop
  function startLiveTracking() {
    let lastScanTime = 0

    async function scan() {
      if (!videoRef.current || isEnrollingRef.current) {
        animFrameRef.current = requestAnimationFrame(scan)
        return
      }

      const now = Date.now()
      // Scan every ~120ms for smooth 8 FPS tracking without overheating CPU
      if (now - lastScanTime >= 120) {
        lastScanTime = now
        const res = await analyzeLiveFace(videoRef.current, { requireCentered: true })
        setDetectionState(res)

        if (res.detected && res.liveness) {
          // Check for natural blink
          if (res.liveness.isBlinking) {
            setBlinkDetected(true)
          }

          // Check for slight head movement or turn
          if (res.liveness.headTurn !== 'CENTER') {
            setTurnDetected(true)
          }

          const hasLiveness = blinkDetected || turnDetected || res.liveness.isBlinking

          // Collect open-eyed frames only (never capture in the middle of a blink)
          if (hasLiveness && res.status === 'GOOD' && res.descriptor && !res.liveness.isBlinking) {
            setLivenessPassed(true)
            sampleDescriptorsRef.current.push(res.descriptor)
            const count = sampleDescriptorsRef.current.length
            setSampleCount(count)

            // Average 3 stable open-eyed frames for maximum accuracy
            if (count >= 3 && !isEnrollingRef.current) {
              const samples = sampleDescriptorsRef.current
              const avg = new Array(128).fill(0)
              for (const s of samples) {
                for (let i = 0; i < 128; i++) {
                  avg[i] += s[i] / samples.length
                }
              }
              // L2 normalize
              let norm = 0
              for (let i = 0; i < 128; i++) norm += avg[i] * avg[i]
              norm = Math.sqrt(norm) || 1
              for (let i = 0; i < 128; i++) avg[i] /= norm

              completeEnrollment(avg)
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scan)
    }

    animFrameRef.current = requestAnimationFrame(scan)
  }

  // 3. Finalize Biometric Registration
  async function completeEnrollment(descriptor: number[]) {
    if (isEnrollingRef.current || !videoRef.current) return
    isEnrollingRef.current = true
    setIsEnrolling(true)

    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Mirror snapshot horizontally
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }

      const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.9)
      setCapturedSnapshot(snapshotDataUrl)

      // Upload reference snapshot
      let uploadedUrl: string | null = null
      try {
        uploadedUrl = await uploadSelfieSnapshot(snapshotDataUrl, userId, 'in')
      } catch (e) {
        console.warn('Snapshot cloud upload note:', e)
      }

      // Save 128-d descriptor to profile
      await enrollEmployeeFace(userId, descriptor, uploadedUrl)

      stopCamera()
      setStep('COMPLETED')
      setIsEnrolling(false)

      setTimeout(() => {
        onSuccess(descriptor)
      }, 1400)
    } catch (err: any) {
      console.error('Enrollment completion error:', err)
      setCameraError('Enrollment failed. Please try again.')
      isEnrollingRef.current = false
      setIsEnrolling(false)
    }
  }

  // Manual fallback capture button
  async function handleManualCapture() {
    if (!videoRef.current || !detectionState?.detected || !detectionState.descriptor) {
      setCameraError('Please align your face inside the oval frame before capturing.')
      return
    }
    completeEnrollment(detectionState.descriptor)
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#1E293B',
                color: '#34D399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                {isReEnrollment ? 'Re-calibrate Biometric Face ID' : 'Set Up Biometric Face ID'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                For {userName} · 128-d Neural Biometric Security
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ color: '#94A3B8', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px' }}>
          {step === 'COMPLETED' ? (
            <div style={{ textAlign: 'center', padding: '24px 10px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Biometric Face ID Enrolled!
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', maxWidth: '380px', margin: '6px auto 0' }}>
                Your facial biometric fingerprint has been successfully registered. You can now punch in/out with instant 1-second biometric recognition.
              </p>
              {capturedSnapshot && (
                <div style={{ marginTop: '16px' }}>
                  <img
                    src={capturedSnapshot}
                    alt="Enrolled Snapshot"
                    style={{
                      width: '90px',
                      height: '90px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #10B981',
                      margin: '0 auto',
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Camera Preview with Biometric Oval Frame */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '320px',
                  backgroundColor: '#000000',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // Mirror selfie
                  }}
                />

                {/* Target Oval Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '190px',
                    height: '240px',
                    borderRadius: '50%',
                    border: `3px dashed ${
                      detectionState?.status === 'GOOD'
                        ? blinkDetected
                          ? '#10B981'
                          : '#F59E0B'
                        : '#64748B'
                    }`,
                    boxShadow:
                      detectionState?.status === 'GOOD'
                        ? '0 0 0 9999px rgba(0, 0, 0, 0.45), 0 0 20px rgba(16, 185, 129, 0.4)'
                        : '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                    transition: 'all 0.25s ease',
                    pointerEvents: 'none',
                  }}
                />

                {/* Status Badge in Video */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: '14px',
                    right: '14px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(4px)',
                    color: '#FFFFFF',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isEnrolling ? (
                      <RefreshCw size={14} className="animate-spin" style={{ color: '#38BDF8' }} />
                    ) : detectionState?.status === 'GOOD' ? (
                      <CheckCircle2 size={14} style={{ color: '#34D399' }} />
                    ) : (
                      <AlertCircle size={14} style={{ color: '#FBBF24' }} />
                    )}
                    <span>
                      {isEnrolling
                        ? 'Extracting biometric signature...'
                        : sampleCount > 0
                        ? `Liveness OK! Hold steady with eyes open (${sampleCount}/3)...`
                        : detectionState?.message || 'Aligning camera...'}
                    </span>
                  </div>

                  {blinkDetected && (
                    <span
                      style={{
                        backgroundColor: '#065F46',
                        color: '#A7F3D0',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      ✓ Liveness OK
                    </span>
                  )}
                </div>

                {/* Model Loading State */}
                {modelLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.92)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      gap: '12px',
                    }}
                  >
                    <RefreshCw size={24} className="animate-spin" style={{ color: '#10B981' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      Loading Biometric Neural Engine...
                    </span>
                  </div>
                )}
              </div>

              {/* Action guidance */}
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  <strong>Calibration Instruction:</strong>
                  <br />
                  Center your face inside the oval and <strong>blink naturally</strong> once.
                  <span style={{ display: 'block', marginTop: '3px', fontSize: '11px', color: '#64748B' }}>
                    💡 If wearing glasses, tilt head slightly so monitor reflection doesn't obscure your eyes.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleManualCapture}
                  disabled={!detectionState?.detected || isEnrolling}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                  }}
                >
                  <Camera size={14} />
                  <span>{isEnrolling ? 'Enrolling...' : 'Capture & Save'}</span>
                </button>
              </div>

              {cameraError && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    color: '#DC2626',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{cameraError}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
