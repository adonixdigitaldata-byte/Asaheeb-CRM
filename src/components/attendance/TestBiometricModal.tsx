'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  UserCheck,
  Scan,
  CheckCircle2,
  Users,
  Camera,
  Eye,
} from 'lucide-react'
import {
  loadBiometricModels,
  analyzeLiveFace,
  verifyFaceBiometrics,
  getEmployeeFaceEnrollment,
  BiometricDetection,
  BiometricMatchResult,
  createLivenessTracker,
  LivenessEvaluation,
  LivenessTracker,
} from '@/lib/biometricEngine'

interface Props {
  isOpen: boolean
  userId: string
  userName: string
  onClose: () => void
  onOpenEnrollment: () => void
}

export default function TestBiometricModal({
  isOpen,
  userId,
  userName,
  onClose,
  onOpenEnrollment,
}: Props) {
  const [modelLoading, setModelLoading] = useState(true)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(null)
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null)
  const [enrolledSnapshotUrl, setEnrolledSnapshotUrl] = useState<string | null>(null)
  const [hasEnrolledFace, setHasEnrolledFace] = useState<boolean>(true)
  const [isCheckingEnrollment, setIsCheckingEnrollment] = useState<boolean>(true)

  // Real-time live match state
  const [detection, setDetection] = useState<BiometricDetection | null>(null)
  const [matchResult, setMatchResult] = useState<BiometricMatchResult | null>(null)
  const [livenessResult, setLivenessResult] = useState<LivenessEvaluation | null>(null)

  // Verification Latch for test feedback stability
  const latchedVerifiedRef = useRef<{ match: BiometricMatchResult; expiresAt: number } | null>(null)
  const [latchedMatch, setLatchedMatch] = useState<BiometricMatchResult | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)
  const isScanningRef = useRef(false)
  const enrolledDescriptorRef = useRef<number[] | null>(null)
  const livenessTrackerRef = useRef<LivenessTracker>(createLivenessTracker())

  // 1. Load enrollment info & start camera
  useEffect(() => {
    if (!isOpen) return

    let isCancelled = false
    setIsCheckingEnrollment(true)
    livenessTrackerRef.current.reset()
    latchedVerifiedRef.current = null
    setLatchedMatch(null)
    setLivenessResult(null)
    setDetection(null)
    setMatchResult(null)

    async function init() {
      setModelLoading(true)

      // Load enrolled descriptor immediately
      if (userId) {
        try {
          const res = await getEmployeeFaceEnrollment(userId)
          if (!isCancelled) {
            if (res.descriptor && res.descriptor.length === 128) {
              enrolledDescriptorRef.current = res.descriptor
              setEnrolledDescriptor(res.descriptor)
              setEnrolledAt(res.enrolled_at)
              setEnrolledSnapshotUrl(res.snapshot_url || null)
              setHasEnrolledFace(true)
            } else {
              enrolledDescriptorRef.current = null
              setEnrolledDescriptor(null)
              setHasEnrolledFace(false)
            }
          }
        } catch (e) {
          console.warn('Enrollment load error:', e)
        }
      }
      setIsCheckingEnrollment(false)

      const modelsReady = await loadBiometricModels()
      if (isCancelled) return
      setModelLoading(false)

      if (modelsReady) {
        startCamera()
      } else {
        setCameraError('Failed to load neural models. Please check your network and refresh.')
      }
    }

    init()

    return () => {
      isCancelled = true
      stopCamera()
    }
  }, [isOpen, userId])

  // Attach camera stream to video element whenever stream updates
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      const video = videoRef.current
      video.srcObject = cameraStream
      video
        .play()
        .then(() => {
          startLiveTesting()
        })
        .catch((err) => console.warn('Video play auto-start error:', err))
    }
  }, [cameraStream])

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
    isScanningRef.current = false
    latchedVerifiedRef.current = null
    setLatchedMatch(null)
    livenessTrackerRef.current.reset()
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
    } catch (err: any) {
      console.error('Test camera error:', err)
      setCameraError('Camera access denied. Please allow camera permissions in your browser.')
    }
  }

  // 2. Real-time test evaluation loop (85ms polling)
  function startLiveTesting() {
    if (isScanningRef.current) return
    isScanningRef.current = true
    let lastScan = 0

    async function evaluate() {
      if (!videoRef.current || !isScanningRef.current) {
        animFrameRef.current = requestAnimationFrame(evaluate)
        return
      }

      const now = Date.now()
      // Evaluate every ~85ms for responsive real-time matching and accurate blink capture
      if (now - lastScan >= 85) {
        lastScan = now
        try {
          const scan = await analyzeLiveFace(videoRef.current, { requireCentered: false })
          setDetection(scan)

          // Run Anti-Spoofing & Liveness Tracker
          const liveCheck = livenessTrackerRef.current.update(scan)
          setLivenessResult(liveCheck)

          // Read latest enrolled descriptor directly from ref to avoid stale closures
          const activeDescriptor = enrolledDescriptorRef.current || enrolledDescriptor

          if (scan.detected && scan.descriptor) {
            if (activeDescriptor && activeDescriptor.length === 128) {
              const res = verifyFaceBiometrics(scan.descriptor, activeDescriptor, userName)
              setMatchResult(res)

              if (res.isMatch && liveCheck.isLive && !liveCheck.isSpoofDetected) {
                latchedVerifiedRef.current = { match: res, expiresAt: Date.now() + 5000 }
                setLatchedMatch(res)
              }
            } else {
              setMatchResult(null)
            }
          } else {
            if (!latchedVerifiedRef.current || latchedVerifiedRef.current.expiresAt <= Date.now()) {
              setMatchResult(null)
            }
          }

          if (liveCheck.isSpoofDetected) {
            latchedVerifiedRef.current = null
            setLatchedMatch(null)
          }
        } catch (e) {
          console.warn('Test evaluation frame error:', e)
        }
      }

      animFrameRef.current = requestAnimationFrame(evaluate)
    }

    animFrameRef.current = requestAnimationFrame(evaluate)
  }

  if (!isOpen) return null

  const isLatched = Boolean(
    latchedMatch &&
    latchedVerifiedRef.current &&
    latchedVerifiedRef.current.expiresAt > Date.now()
  )
  const isSpoof = livenessResult?.isSpoofDetected ?? false
  const activeMatchResult = (isLatched && !isSpoof) ? (latchedMatch || matchResult) : matchResult
  const isMatched = activeMatchResult?.isMatch ?? false
  const hasResult = Boolean(activeMatchResult)
  const isLive = (livenessResult?.isLive ?? false) || (isLatched && !isSpoof)
  const isFullyVerified = isMatched && isLive && !isSpoof

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
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
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#1E293B',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scan size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Live Biometric Face ID Scanner
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Real-Time Neural Verification Test for {userName}
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

        {/* Content Body */}
        <div style={{ padding: '20px 22px' }}>
          {!isCheckingEnrollment && !hasEnrolledFace ? (
            <div style={{ textAlign: 'center', padding: '24px 10px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <AlertTriangle size={30} />
              </div>
              <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                No Enrolled Face ID Found
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '380px', margin: '8px auto 20px', lineHeight: 1.4 }}>
                You have not registered a biometric face template yet. Complete a 10-second enrollment first to test live verification.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenEnrollment()
                }}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontWeight: 700,
                }}
              >
                <Camera size={16} /> Set Up Biometric Face ID Now
              </button>
            </div>
          ) : (
            <>
              {/* Camera Test Viewport */}
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
                  border: `3px solid ${
                    !detection?.detected
                      ? '#475569'
                      : isSpoof
                      ? '#EF4444'
                      : isFullyVerified
                      ? '#10B981'
                      : isMatched && !isLive
                      ? '#F59E0B'
                      : '#EF4444'
                  }`,
                  transition: 'border-color 0.2s ease',
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
                    transform: 'scaleX(-1)', // Mirror
                  }}
                />

                {/* Target Oval Guide Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '190px',
                    height: '240px',
                    borderRadius: '50%',
                    border: `2.5px solid ${
                      !detection?.detected
                        ? 'rgba(255, 255, 255, 0.4)'
                        : isSpoof
                        ? '#EF4444'
                        : isFullyVerified
                        ? '#10B981'
                        : isMatched && !isLive
                        ? '#F59E0B'
                        : '#EF4444'
                    }`,
                    boxShadow: isFullyVerified
                      ? '0 0 24px rgba(16, 185, 129, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.45)'
                      : isSpoof
                      ? '0 0 24px rgba(239, 68, 68, 0.6), 0 0 0 9999px rgba(0, 0, 0, 0.45)'
                      : isMatched && !isLive
                      ? '0 0 24px rgba(245, 158, 11, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.45)'
                      : hasResult && !isMatched
                      ? '0 0 24px rgba(239, 68, 68, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.45)'
                      : '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                    pointerEvents: 'none',
                    transition: 'all 0.2s ease',
                  }}
                />

                {/* Live Real-Time Match & Liveness Score HUD */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      padding: '5px 12px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(15, 23, 42, 0.88)',
                      backdropFilter: 'blur(6px)',
                      color: '#FFFFFF',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <UserCheck size={14} color="#38BDF8" />
                    <span>Registered: {userName}</span>
                  </div>

                  {detection?.detected && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Anti-spoofing alert or Match badge */}
                      {isSpoof ? (
                        <div
                          style={{
                            padding: '5px 12px',
                            borderRadius: '999px',
                            backgroundColor: '#DC2626',
                            color: '#FFFFFF',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                          }}
                        >
                          <AlertTriangle size={14} /> Static Phone/Photo Spoof
                        </div>
                      ) : activeMatchResult ? (
                        <div
                          style={{
                            padding: '5px 12px',
                            borderRadius: '999px',
                            backgroundColor: isFullyVerified
                              ? '#16A34A'
                              : isMatched
                              ? '#D97706'
                              : '#DC2626',
                            color: '#FFFFFF',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                          }}
                        >
                          {isFullyVerified ? (
                            <>
                              <CheckCircle2 size={14} /> {activeMatchResult?.similarityScore ?? 0}% Match (Verified &amp; Live)
                            </>
                          ) : isMatched ? (
                            <>
                              <Eye size={14} /> {activeMatchResult?.similarityScore ?? 0}% Match (Blink to verify)
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={14} /> {activeMatchResult?.similarityScore ?? 0}% Match (Mismatch)
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Live Real-Time Status Bar at Bottom */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    right: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(6px)',
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
                    {!detection?.detected ? (
                      <>
                        <Scan size={14} color="#FBBF24" className="animate-pulse" />
                        <span>Position face in the frame...</span>
                      </>
                    ) : isSpoof ? (
                      <>
                        <AlertTriangle size={15} color="#F87171" />
                        <span style={{ color: '#FCA5A5' }}>
                          ⚠️ Static Screen / Photo Detected (Proxy Rejected — Live Presence Required)
                        </span>
                      </>
                    ) : isFullyVerified ? (
                      <>
                        <CheckCircle2 size={15} color="#34D399" />
                        <span style={{ color: '#A7F3D0' }}>
                          ✓ Identity &amp; Live 3D Presence Verified: Attendance Allowed
                        </span>
                      </>
                    ) : isMatched && !isLive ? (
                      <>
                        <Eye size={15} color="#FBBF24" className="animate-pulse" />
                        <span style={{ color: '#FDE68A' }}>
                          👁️ Identity Matched! Please blink naturally to confirm live presence
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={15} color="#F87171" />
                        <span style={{ color: '#FCA5A5' }}>
                          ✕ Face Mismatch: Attendance Blocked (Proxy Rejection Active)
                        </span>
                      </>
                    )}
                  </div>

                  {detection?.detected && (activeMatchResult || matchResult) && !isSpoof && (
                    <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                      Dist: {(activeMatchResult || matchResult)?.euclideanDistance}
                    </span>
                  )}
                </div>

                {/* Model Loading State */}
                {modelLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.94)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      gap: '10px',
                    }}
                  >
                    <RefreshCw size={24} className="animate-spin" style={{ color: '#38BDF8' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      Loading Biometric Neural Scanner...
                    </span>
                  </div>
                )}
              </div>

              {/* Instructions & Interactive Proxy Testing Callout */}
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                  <Users size={16} color="#2563EB" />
                  <span>Interactive Biometric Verification Test</span>
                </div>
                <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                  <li>
                    <strong>Test 1 (You):</strong> Look at the camera. The scanner will show solid green (90–99% Match) and confirm attendance would be allowed.
                  </li>
                  <li>
                    <strong>Test 2 (Proxy Rejection):</strong> Have a colleague or friend step in front of the camera. The scanner will instantly turn red and show <strong>Mismatch</strong>.
                  </li>
                </ul>
              </div>

              {cameraError && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    color: '#DC2626',
                    fontSize: '12px',
                  }}
                >
                  {cameraError}
                </div>
              )}

              {/* Footer */}
              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {enrolledAt
                    ? `Enrolled template from ${new Date(enrolledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Active 128-d Vector Template'}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenEnrollment()
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '12px' }}
                  >
                    Re-calibrate Face ID
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '12px' }}
                  >
                    Done Testing
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
