'use client'

import { useState } from 'react'
import Image from 'next/image'
import { login } from './actions'
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const formData = new FormData(event.currentTarget)
      const result = await login(formData)

      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
    } catch (err: any) {
      if (err?.message !== 'NEXT_REDIRECT') {
        setError('Authentication failed. Please check your credentials.')
        setLoading(false)
      }
    }
  }

  return (
    <div style={{
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
    }}>
      {/* Decorative ambient background orbs */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        right: '-100px',
        width: '380px',
        height: '380px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(2, 132, 199, 0.22), rgba(2, 132, 199, 0) 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-100px',
        left: '-100px',
        width: '360px',
        height: '360px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 70, 229, 0.18), rgba(79, 70, 229, 0) 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Main Login Card */}
      <div style={{
        width: '100%',
        maxWidth: '430px',
        background: '#FFFFFF',
        border: '1px solid #CBD5E1',
        borderRadius: '20px',
        padding: '2.5rem 2.25rem',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            border: '1.5px solid #E2E8F0',
            boxShadow: '0 8px 20px -4px rgba(2, 132, 199, 0.25)',
            marginBottom: '1rem',
          }}>
            <Image
              src="/Favicon.png"
              alt="Asaheeb Logo"
              width={64}
              height={64}
              style={{ objectFit: 'contain', borderRadius: '50%' }}
              priority
            />
          </div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
            Asaheeb CRM
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.35rem', fontWeight: 500 }}>
            Real Estate Sales &amp; Lead Management
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            fontSize: '0.8125rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Email field */}
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.45rem', color: '#1E293B', fontWeight: 600, fontSize: '0.8125rem' }}>
              Email address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type="email"
                name="email"
                required
                placeholder="name@asaheeb.com"
                className="form-input"
                style={{
                  paddingLeft: '2.6rem',
                  height: '44px',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  borderColor: '#CBD5E1',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease',
                }}
              />
            </div>
          </div>

          {/* Password field with Show/Hide toggle */}
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.45rem', color: '#1E293B', fontWeight: 600, fontSize: '0.8125rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                placeholder="••••••••"
                className="form-input"
                style={{
                  paddingLeft: '2.6rem',
                  paddingRight: '2.75rem',
                  height: '44px',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  borderColor: '#CBD5E1',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
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
                  justifyContent: 'center',
                  borderRadius: '6px',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '46px',
              marginTop: '0.5rem',
              justifyContent: 'center',
              fontSize: '0.925rem',
              fontWeight: 700,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              border: 'none',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in to CRM</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '1.75rem',
          borderTop: '1px solid #E2E8F0',
          paddingTop: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <ShieldCheck size={14} style={{ color: '#0284C7' }} />
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
            Authorized Staff &amp; Sales Agents Portal
          </span>
        </div>
      </div>
    </div>
  )
}
