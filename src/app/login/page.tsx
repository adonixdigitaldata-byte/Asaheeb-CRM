'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (searchParams.get('error') === 'deactivated') {
      setError('Your account has been deactivated. Please contact your administrator.')
      const supabase = createClient()
      supabase.auth.signOut()
    } else if (searchParams.get('error')) {
      setError(searchParams.get('error') || 'Authentication error')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/agents/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), name: email.split('@')[0], mode: 'forgot' }),
        })
        const data = await res.json()
        if (res.ok) {
          setSuccess(`Password reset link sent to ${email}. Please check your inbox!`)
        } else {
          setError(data.error || 'Failed to send password reset email')
        }
      } catch (err: any) {
        setError(err?.message || 'Error sending password reset link')
      }
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, role')
        .eq('id', authData.user.id)
        .single()

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        setError('Your account has been deactivated. Please contact your administrator.')
        setLoading(false)
        return
      }

      let targetUrl = '/dashboard'
      if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('/login')) {
        targetUrl = redirectTo
      }

      router.push(targetUrl)
      router.refresh()
    }
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
            {mode === 'login'
              ? 'Real Estate Sales & Lead Management'
              : 'Enter your email to receive a password reset link'}
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: '14px 16px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '12px',
                color: '#15803D',
                fontSize: '13.5px',
                lineHeight: 1.4,
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {success}
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setMode('login')
                setSuccess('')
                setError('')
              }}
              style={{
                width: '100%',
                justifyContent: 'center',
                height: '44px',
                borderRadius: '10px',
                fontWeight: 600,
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
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
                  id="email"
                  type="email"
                  placeholder="name@asaheeb.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
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
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            {mode === 'login' && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    htmlFor="password"
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#334155',
                    }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setError('')
                      setSuccess('')
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284C7',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
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
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
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
            )}

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
                transition: 'background-color 0.15s ease, transform 0.1s ease',
                marginTop: '4px',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{mode === 'login' ? 'Signing in...' : 'Sending reset link...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign in to CRM' : 'Send Password Reset Link'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError('')
                  setSuccess('')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '4px',
                }}
              >
                Remembered your password? <strong style={{ color: '#0284C7' }}>Back to Sign In</strong>
              </button>
            )}
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: '#0284C7' }} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
