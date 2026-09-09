'use client'

import React, { useState } from 'react'
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Scan,
  RefreshCw,
  Camera,
  Trash2,
  CheckCircle2,
  Lock,
  ChevronRight,
} from 'lucide-react'
import { resetEmployeeFaceEnrollment } from '@/lib/biometricEngine'

interface Props {
  isOpen: boolean
  userId: string
  userName: string
  hasFaceId: boolean
  enrolledAt?: string | null
  snapshotUrl?: string | null
  onClose: () => void
  onOpenTest: () => void
  onOpenEnrollment: () => void
  onFaceIdReset: () => void
}

export default function BiometricManagementModal({
  isOpen,
  userId,
  userName,
  hasFaceId,
  enrolledAt,
  snapshotUrl,
  onClose,
  onOpenTest,
  onOpenEnrollment,
  onFaceIdReset,
}: Props) {
  const [isResetting, setIsResetting] = useState(false)
  const [confirmReEnroll, setConfirmReEnroll] = useState(false)

  if (!isOpen) return null

  async function handleReset() {
    const ok = window.confirm(
      `Are you sure you want to remove your registered Biometric Face ID?\n\nYou will need to register your face again before punching attendance.`
    )
    if (!ok) return

    setIsResetting(true)
    await resetEmployeeFaceEnrollment(userId)
    setIsResetting(false)
    onFaceIdReset()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#1E293B',
                color: hasFaceId ? '#34D399' : '#FBBF24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                Biometric Face ID Hub
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                {userName} · Attendance Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Status Box */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: hasFaceId ? '#F0FDF4' : '#FFFBEB',
              border: `1.5px solid ${hasFaceId ? '#BBF7D0' : '#FDE68A'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            {snapshotUrl ? (
              <img
                src={snapshotUrl}
                alt="Enrolled face"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #10B981',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: hasFaceId ? '#DCFCE7' : '#FEF3C7',
                  color: hasFaceId ? '#15803D' : '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {hasFaceId ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
              </div>
            )}

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 800,
                    color: hasFaceId ? '#15803D' : '#92400E',
                  }}
                >
                  {hasFaceId ? 'Face ID Enrolled & Active' : 'Face ID Not Registered'}
                </span>
                {hasFaceId && <Lock size={13} style={{ color: '#16A34A', flexShrink: 0 }} />}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px', lineHeight: 1.4 }}>
                {hasFaceId
                  ? enrolledAt
                    ? `Enrolled ${new Date(enrolledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · 128-d Neural Biometrics`
                    : '128-d Neural Biometrics Active'
                  : 'Manual registration required before punching in attendance.'}
              </div>
            </div>
          </div>

          {/* Action Hub Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* OPTION 1: TEST BIOMETRIC SCANNER */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenTest()
              }}
              style={{
                width: '100%',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38BDF8'
                e.currentTarget.style.backgroundColor = '#F0F9FF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0'
                e.currentTarget.style.backgroundColor = '#FFFFFF'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#E0F2FE',
                    color: '#0284C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Scan size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                    Test Biometric Face ID Scanner
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    Open live camera to verify your face match score &amp; test proxy rejection.
                  </div>
                </div>
              </div>
              <ChevronRight size={20} style={{ color: '#94A3B8', flexShrink: 0 }} />
            </button>

            {/* OPTION 2: ENROLL OR RE-CALIBRATE */}
            {!confirmReEnroll ? (
              <button
                type="button"
                onClick={() => {
                  if (hasFaceId) {
                    setConfirmReEnroll(true)
                  } else {
                    onClose()
                    onOpenEnrollment()
                  }
                }}
                style={{
                  width: '100%',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4ADE80'
                  e.currentTarget.style.backgroundColor = '#F0FDF4'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0'
                  e.currentTarget.style.backgroundColor = '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Camera size={21} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                      {hasFaceId ? 'Re-calibrate Biometric Face ID' : 'Register Biometric Face ID'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {hasFaceId
                        ? 'Update your face template if your appearance changed (glasses, beard).'
                        : 'Quick 10-second calibration with 3D open-eyed liveness check.'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} style={{ color: '#94A3B8', flexShrink: 0 }} />
              </button>
            ) : (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#FEF3C7',
                  border: '1.5px solid #FCD34D',
                  borderRadius: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, color: '#92400E' }}>
                  <AlertTriangle size={17} color="#D97706" /> Confirm Re-calibration
                </div>
                <p style={{ fontSize: '12px', color: '#78350F', margin: '6px 0 14px', lineHeight: 1.45 }}>
                  This will replace your currently registered biometric fingerprint with a new scan. Make sure good room lighting is available.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReEnroll(false)
                      onClose()
                      onOpenEnrollment()
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '12.5px', padding: '8px 16px', fontWeight: 700 }}
                  >
                    Unlock &amp; Re-enroll Face
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReEnroll(false)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '12.5px', padding: '8px 14px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer separator & Reset */}
          {hasFaceId && (
            <div
              style={{
                marginTop: '22px',
                paddingTop: '16px',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#DC2626',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  opacity: isResetting ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEF2F2'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {isResetting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isResetting ? 'Removing Face ID...' : 'Remove Registered Face ID'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
