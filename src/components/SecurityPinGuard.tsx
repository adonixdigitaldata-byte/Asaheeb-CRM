'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ShieldCheck, KeyRound, Eye, EyeOff, X, CheckCircle2, ShieldAlert, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

export type PinSectionType = 'expenses' | 'attendance' | 'commissions' | 'payroll'

interface SecurityPinGuardProps {
  pinType: PinSectionType
  profile: Profile | null
  title: string
  subtitle?: string
  sectionName?: string
  backUrl?: string
  backLabel?: string
  enabled?: boolean
  children:
    | React.ReactNode
    | ((controls: { onLock: () => void; onChangePin: () => void; isUnlocked: boolean }) => React.ReactNode)
}

export default function SecurityPinGuard({
  pinType,
  profile,
  title,
  subtitle = 'Protected executive area. Please enter your security PIN to access confidential data.',
  sectionName,
  backUrl,
  backLabel,
  enabled = true,
  children,
}: SecurityPinGuardProps) {
  const router = useRouter()
  const supabase = createClient()

  const storageKey = `asaheeb_${pinType}_unlocked`
  const pinStorageKey = `asaheeb_${pinType}_pin`
  const defaultPin = '1234'

  // Retrieve current PIN from profile column (e.g. expenses_pin, attendance_pin, etc.) or localStorage fallback
  const getProfilePin = (): string => {
    if (!profile) return localStorage.getItem(pinStorageKey) || defaultPin
    const colName = `${pinType}_pin` as keyof Profile
    const val = profile[colName]
    if (typeof val === 'string' && val.trim()) {
      return val.trim()
    }
    return localStorage.getItem(pinStorageKey) || defaultPin
  }

  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [showPinText, setShowPinText] = useState(false)
  const [pinError, setPinError] = useState('')
  const [storedPin, setStoredPin] = useState<string>(getProfilePin())

  // Change PIN modal state
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [changeError, setChangeError] = useState('')
  const [changeSuccess, setChangeSuccess] = useState('')
  const [isSavingPin, setIsSavingPin] = useState(false)

  // Sync initial state and check session storage
  useEffect(() => {
    const activePin = getProfilePin()
    setStoredPin(activePin)

    const sessionUnlocked = sessionStorage.getItem(storageKey) === 'true'
    if (sessionUnlocked) {
      setIsUnlocked(true)
    }
  }, [profile, pinType])

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput.trim() === storedPin) {
      setIsUnlocked(true)
      sessionStorage.setItem(storageKey, 'true')
      setPinError('')
      setPinInput('')
    } else {
      setPinError('Incorrect PIN. (Default is 1234)')
    }
  }

  const handleLock = () => {
    setIsUnlocked(false)
    sessionStorage.removeItem(storageKey)
  }

  const openChangePin = () => {
    setNewPin('')
    setConfirmPin('')
    setChangeError('')
    setChangeSuccess('')
    setShowChangeModal(true)
  }

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError('')
    setChangeSuccess('')

    if (!newPin.trim() || newPin.trim().length < 4) {
      setChangeError('PIN must be at least 4 digits.')
      return
    }

    if (newPin.trim() !== confirmPin.trim()) {
      setChangeError('New PIN and Confirm PIN do not match.')
      return
    }

    setIsSavingPin(true)
    const cleanPin = newPin.trim()

    try {
      // 1. Save to local storage for instant fallback
      localStorage.setItem(pinStorageKey, cleanPin)
      setStoredPin(cleanPin)

      // 2. Persist to Supabase profiles table if logged in
      if (profile?.id) {
        const updatePayload: Record<string, string> = {
          [`${pinType}_pin`]: cleanPin,
        }
        const { error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', profile.id)

        if (error) {
          console.warn(`Could not persist ${pinType}_pin to database column, using localStorage fallback:`, error.message)
        } else {
          // Mutate local profile object
          ;(profile as any)[`${pinType}_pin`] = cleanPin
        }
      }

      setChangeSuccess('PIN updated successfully!')
      setTimeout(() => {
        setShowChangeModal(false)
        setChangeSuccess('')
      }, 1000)
    } catch (err: any) {
      setChangeError(err?.message || 'Failed to update PIN.')
    } finally {
      setIsSavingPin(false)
    }
  }

  // If pin protection is disabled (e.g. for non-admin employees), render content directly without PIN
  if (!enabled) {
    return typeof children === 'function'
      ? children({ onLock: () => {}, onChangePin: () => {}, isUnlocked: true })
      : children
  }

  // If locked, render the lock vault card
  if (!isUnlocked) {
    return (
      <div
        style={{
          minHeight: '72vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 440, width: '100%', marginBottom: 14, display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={() => {
              if (backUrl) router.push(backUrl)
              else router.back()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
            title={backLabel || 'Go Back'}
          >
            <ArrowLeft size={14} />
            <span>{backLabel || 'Back'}</span>
          </button>
        </div>

        <div
          className="card"
          style={{
            maxWidth: 440,
            width: '100%',
            padding: '36px 30px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            background: '#FFFFFF',
          }}
        >
          {/* Header Icon */}
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 20px rgba(30, 58, 138, 0.25)',
            }}
          >
            <Lock size={26} />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
            {title}
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 24px', lineHeight: 1.5 }}>
            {subtitle}
          </p>

          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPinText ? 'text' : 'password'}
                autoFocus
                placeholder="Enter 4-Digit Security PIN"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value)
                  if (pinError) setPinError('')
                }}
                maxLength={10}
                style={{
                  width: '100%',
                  height: 48,
                  fontSize: 18,
                  letterSpacing: showPinText ? '0.1em' : '0.25em',
                  textAlign: 'center',
                  borderRadius: 10,
                  border: pinError ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  fontWeight: 700,
                  outline: 'none',
                  paddingRight: 40,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPinText(!showPinText)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title={showPinText ? 'Hide PIN' : 'Show PIN'}
              >
                {showPinText ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {pinError && (
              <div style={{ fontSize: 12.5, color: '#EF4444', fontWeight: 600 }}>
                {pinError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                height: 44,
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <KeyRound size={16} />
              <span>Unlock Vault</span>
            </button>
          </form>

          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11.5,
              color: '#94A3B8',
            }}
          >
            <span>Default PIN: <strong>1234</strong></span>
            <span style={{ color: '#0284C7', fontWeight: 600 }}>
              {sectionName || pinType.toUpperCase()} LOCK
            </span>
          </div>
        </div>
      </div>
    )
  }

  // When unlocked, render children alongside Change PIN modal
  return (
    <>
      {typeof children === 'function'
        ? children({ onLock: handleLock, onChangePin: openChangePin, isUnlocked: true })
        : children}

      {/* Change PIN Modal */}
      {showChangeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 400,
              width: '100%',
              padding: '24px 24px',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} color="#0284C7" />
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Change {sectionName || pinType} PIN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: '#64748B', margin: '0 0 16px' }}>
              Enter a new security PIN (at least 4 digits) for {sectionName || pinType}.
            </p>

            <form onSubmit={handleSaveNewPin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  New PIN
                </label>
                <input
                  type="password"
                  required
                  placeholder="e.g. 5678"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  maxLength={10}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: 14,
                    letterSpacing: '0.15em',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  maxLength={10}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: 14,
                    letterSpacing: '0.15em',
                  }}
                />
              </div>

              {changeError && (
                <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>
                  {changeError}
                </div>
              )}

              {changeSuccess && (
                <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} />
                  <span>{changeSuccess}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowChangeModal(false)}
                  style={{ flex: 1, height: 38 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 38, fontWeight: 700 }}
                >
                  {isSavingPin ? 'Saving...' : 'Save PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
