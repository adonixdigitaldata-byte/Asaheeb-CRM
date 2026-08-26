'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, Lock, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authenticating, setAuthenticating] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    // 1. Check if Supabase session is already active or established via URL hash
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession()
      
      // If URL hash contains access_token, parse and set session
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        }
      }

      setAuthenticating(false)
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setAuthenticating(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    // Ensure session exists
    const { data: { session } } = await supabase.auth.getSession()

    // If session is still missing, attempt setting from hash
    if (!session && typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1500)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E2E8F0',
        backgroundImage: `
          radial-gradient(at 10% 20%, rgba(2, 132, 199, 0.12) 0px, transparent 50%),
          radial-gradient(at 90% 80%, rgba(99, 102, 241, 0.12) 0px, transparent 50%),
          radial-gradient(at 50% 50%, #F1F5F9 0px, #E2E8F0 100%)
        `,
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative ambient background orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-100px',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(2, 132, 199, 0.22), rgba(2, 132, 199, 0) 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-100px',
          left: '-100px',
          width: '360px',
          height: '360px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79, 70, 229, 0.18), rgba(79, 70, 229, 0) 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '24px',
          padding: '2.5rem 2.25rem 2rem',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 8px 20px -4px rgba(2, 132, 199, 0.22)',
              marginBottom: '1rem',
            }}
          >
            <Image
              src="/Favicon.png"
              alt="Asaheeb Logo"
              width={56}
              height={56}
              style={{ objectFit: 'contain', borderRadius: '50%' }}
              priority
            />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#0F172A',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Asaheeb CRM
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#64748B',
              margin: 0,
              fontWeight: 500,
            }}
          >
            Set up your account password to continue
          </p>
        </div>

        {authenticating ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748B', fontSize: '13.5px' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#0284C7' }} />
            <div>Verifying security link...</div>
          </div>
        ) : success ? (
          <div
            style={{
              padding: '16px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '12px',
              color: '#15803D',
              fontSize: '13.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <CheckCircle2 size={18} />
            <span>Password updated! Redirecting to dashboard...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* New Password */}
            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                New password <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={17}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  style={{
                    width: '100%',
                    height: '44px',
                    paddingLeft: '40px',
                    paddingRight: '40px',
                    fontSize: '14px',
                    color: '#0F172A',
                    backgroundColor: '#F0F6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '10px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Confirm password <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={17}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    paddingLeft: '40px',
                    paddingRight: '14px',
                    fontSize: '14px',
                    color: '#0F172A',
                    backgroundColor: '#F0F6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '10px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '10px',
                  color: '#DC2626',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: '#0284C7',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                marginTop: '4px',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving password...</span>
                </>
              ) : (
                <>
                  <span>Save Password &amp; Enter CRM</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer info badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '22px',
            paddingTop: '16px',
            borderTop: '1px solid #F1F5F9',
            fontSize: '12px',
            color: '#64748B',
            fontWeight: 500,
          }}
        >
          <ShieldCheck size={14} style={{ color: '#0284C7' }} />
          <span>Authorized Staff &amp; Sales Agents Portal</span>
        </div>
      </div>
    </div>
  )
}
