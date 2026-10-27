'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Trophy,
  PartyPopper,
  RotateCcw,
  Award,
  TrendingUp,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'

export interface DealCelebrationData {
  agentName: string
  agentRole?: string
  agentAvatarUrl?: string | null
  projectName: string
  unitName: string
  areaSqm?: number | null
  dealValueSar?: number | null
  commissionAmount: number
  saleDate?: string
}

interface Props {
  deal: DealCelebrationData
  onClose: () => void
}

/**
 * Pre-warms the GTA audio track synchronously on user click/touch.
 */
export function unlockCelebrationAudio(): void {
  if (typeof window === 'undefined') return
  try {
    const audio = new Audio('/sounds/gta-sound.mp3')
    audio.preload = 'auto'
    audio.load()
  } catch {}
}

/* -------------------------------------------------------------
 * 3D SILK RIBBONS & CONFETTI ENGINE (HTML5 High-Performance Canvas)
 * ------------------------------------------------------------- */
interface RibbonSegment {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  color1: string
  color2: string
  angle: number
  angleSpeed: number
  waviness: number
  waveSpeed: number
  waveOffset: number
  points: { x: number; y: number; width: number }[]
}

interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotationX: number
  rotationY: number
  rotationZ: number
  speedRotX: number
  speedRotY: number
  shape: 'rect' | 'circle' | 'star'
  opacity: number
}

const LUXURY_PALETTE = [
  { c1: '#FFD700', c2: '#B8860B' }, // 24k Gold
  { c1: '#10B981', c2: '#047857' }, // Emerald
  { c1: '#38BDF8', c2: '#0284C7' }, // Cyan Diamond
  { c1: '#F43F5E', c2: '#BE123C' }, // Ruby Red
  { c1: '#A855F7', c2: '#7E22CE' }, // Royal Purple
  { c1: '#F59E0B', c2: '#D97706' }, // Amber
  { c1: '#FFFFFF', c2: '#CBD5E1' }, // Silver Silk
]

export default function DealCelebrationModal({ deal, onClose }: Props) {
  const [isMuted, setIsMuted] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(18)
  const [totalDuration, setTotalDuration] = useState(18)
  const [replayCount, setReplayCount] = useState(1)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ribbonsRef = useRef<RibbonSegment[]>([])
  const confettiRef = useRef<ConfettiPiece[]>([])
  const animFrameRef = useRef<number | null>(null)

  // Spawn flowing ribbons and burst particles
  const spawnCelebrationBurst = useCallback((count = 45) => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const w = canvas.width || (typeof window !== 'undefined' ? window.innerWidth : 800)
    const h = canvas.height || (typeof window !== 'undefined' ? window.innerHeight : 600)

    const ribbonCount = 5
    for (let r = 0; r < ribbonCount; r++) {
      const palette = LUXURY_PALETTE[Math.floor(Math.random() * LUXURY_PALETTE.length)]
      const startX = Math.random() * w
      const segments: { x: number; y: number; width: number }[] = []
      const len = 20
      for (let s = 0; s < len; s++) {
        segments.push({
          x: startX,
          y: -s * 16 - Math.random() * 60,
          width: 12 + Math.sin((s / len) * Math.PI) * 8,
        })
      }

      ribbonsRef.current.push({
        x: startX,
        y: -80 - Math.random() * 150,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 2.2 + Math.random() * 2.2,
        width: 12,
        color1: palette.c1,
        color2: palette.c2,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: 0.02 + Math.random() * 0.03,
        waviness: 22 + Math.random() * 18,
        waveSpeed: 0.04 + Math.random() * 0.04,
        waveOffset: Math.random() * Math.PI * 2,
        points: segments,
      })
    }

    const colors = ['#FFD700', '#F59E0B', '#10B981', '#38BDF8', '#F43F5E', '#A855F7', '#FFFFFF']
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 8
      confettiRef.current.push({
        x: w / 2 + (Math.random() - 0.5) * 180,
        y: h * 0.3 + (Math.random() - 0.5) * 80,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: 7 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotationX: Math.random() * Math.PI * 2,
        rotationY: Math.random() * Math.PI * 2,
        rotationZ: Math.random() * Math.PI * 2,
        speedRotX: (Math.random() - 0.5) * 0.2,
        speedRotY: (Math.random() - 0.5) * 0.2,
        shape: Math.random() > 0.4 ? 'rect' : Math.random() > 0.5 ? 'star' : 'circle',
        opacity: 1,
      })
    }
  }, [])

  // Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    spawnCelebrationBurst(60)

    let t = 0
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.02

      // Draw ribbons
      for (let i = ribbonsRef.current.length - 1; i >= 0; i--) {
        const r = ribbonsRef.current[i]
        r.x += r.vx
        r.y += r.vy
        r.angle += r.angleSpeed

        if (r.y > canvas.height + 200) {
          ribbonsRef.current.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.beginPath()
        for (let p = 0; p < r.points.length; p++) {
          const pt = r.points[p]
          const curX = r.x + Math.sin(t * r.waveSpeed + p * 0.3 + r.waveOffset) * r.waviness
          const curY = r.y + p * 12
          if (p === 0) ctx.moveTo(curX, curY)
          else ctx.lineTo(curX, curY)
        }
        ctx.lineWidth = r.width
        const grad = ctx.createLinearGradient(r.x, r.y, r.x + 30, r.y + 120)
        grad.addColorStop(0, r.color1)
        grad.addColorStop(1, r.color2)
        ctx.strokeStyle = grad
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()
      }

      // Draw confetti
      for (let i = confettiRef.current.length - 1; i >= 0; i--) {
        const c = confettiRef.current[i]
        c.x += c.vx
        c.y += c.vy
        c.vy += 0.12 // gravity
        c.vx *= 0.99
        c.rotationX += c.speedRotX
        c.rotationY += c.speedRotY

        if (c.y > canvas.height + 30) {
          confettiRef.current.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.translate(c.x, c.y)
        ctx.rotate(c.rotationX)
        ctx.scale(Math.cos(c.rotationY), 1)
        ctx.fillStyle = c.color
        ctx.globalAlpha = c.opacity

        if (c.shape === 'rect') {
          ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6)
        } else if (c.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [spawnCelebrationBurst])

  // Play GTA Audio Soundtrack on Mount (Per CEO Directive)
  useEffect(() => {
    let audio: HTMLAudioElement | null = null
    try {
      audio = new Audio('/sounds/gta-sound.mp3')
      audio.preload = 'auto'
      audio.volume = 1.0
      audioRef.current = audio

      audio.onloadedmetadata = () => {
        if (audio && audio.duration && !isNaN(audio.duration)) {
          const dur = Math.ceil(audio.duration)
          setTotalDuration(dur)
          setSecondsRemaining(dur)
        }
      }

      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('GTA celebration soundtrack autoplay deferred by browser policy:', err)
        })
      }
    } catch (err) {
      console.warn('Audio initialization error:', err)
    }

    const countdown = setInterval(() => {
      setSecondsRemaining((s) => (s > 0 ? s - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(countdown)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current = null
      }
    }
  }, [])

  // Replay GTA Track
  const replayGtaTrack = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation()
      spawnCelebrationBurst(50)
      setReplayCount((c) => c + 1)
      setSecondsRemaining(totalDuration)

      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      } else {
        const audio = new Audio('/sounds/gta-sound.mp3')
        audio.preload = 'auto'
        audio.volume = 1.0
        audio.muted = isMuted
        audioRef.current = audio
        audio.play().catch(() => {})
      }
    },
    [isMuted, spawnCelebrationBurst, totalDuration]
  )

  // Mute / Unmute
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMuted((prev) => {
      const next = !prev
      if (audioRef.current) {
        audioRef.current.muted = next
      }
      return next
    })
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(2, 6, 23, 0.94)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 3D Flowing Ribbons & Gold Confetti Canvas Backdrop */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Main Floor TV Celebration Shell */}
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: 'min(94dvh, 760px)',
          background: 'radial-gradient(ellipse at top, #1E293B 0%, #0F172A 50%, #020617 100%)',
          border: '2px solid rgba(245, 158, 11, 0.65)',
          borderRadius: '24px',
          boxShadow: '0 30px 80px -10px rgba(245, 158, 11, 0.45), 0 0 120px rgba(16, 185, 129, 0.25)',
          position: 'relative',
          zIndex: 10,
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'celebrationEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Celebration Neon Progress Bar */}
        <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.1)', width: '100%', flexShrink: 0 }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #F59E0B, #10B981, #38BDF8, #F59E0B)',
              backgroundSize: '200% 100%',
              width: `${(secondsRemaining / Math.max(totalDuration, 1)) * 100}%`,
              transition: 'width 1s linear',
              animation: 'shimmerBar 2s linear infinite',
            }}
          />
        </div>

        {/* TOP HEADER: Clean Mission / Victory Bar */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            flexShrink: 0,
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.2) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.55)',
                  color: '#FDE68A',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={12} color="#F59E0B" />
                <span>MISSION PASSED</span>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: secondsRemaining > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                  border: `1px solid ${secondsRemaining > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                  color: secondsRemaining > 0 ? '#6EE7B7' : '#94A3B8',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: secondsRemaining > 0 ? '#10B981' : '#94A3B8',
                    animation: secondsRemaining > 0 ? 'pulseDot 1s ease-in-out infinite' : 'none',
                  }}
                />
                <span>{secondsRemaining > 0 ? `${secondsRemaining}s` : 'Victory'}</span>
              </div>
            </div>

            {/* Quick Action Icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                aria-label="Toggle Sound"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: isMuted ? '#EF4444' : '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>

              <button
                type="button"
                onClick={onClose}
                title="Close Announcement"
                aria-label="Close"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#F87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* CENTERPIECE SHOWCASE: Heavily Focused Agent, Amount Closed & Commission */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Glowing Trophy Medal / Respect Shield */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            {/* Ambient Gold Halo */}
            <div
              style={{
                position: 'absolute',
                inset: '-20px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, rgba(16, 185, 129, 0.15) 50%, transparent 75%)',
                animation: 'ringPulse 1.8s ease-out infinite',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #FEF08A 0%, #F59E0B 50%, #B45309 85%, #78350F 100%)',
                border: '3.5px solid #FDE68A',
                boxShadow:
                  '0 0 40px rgba(245, 158, 11, 0.8), 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 2px 5px rgba(255, 255, 255, 0.9)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 3,
              }}
            >
              <Trophy
                size={38}
                style={{
                  filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))',
                  color: '#FFFFFF',
                }}
              />
            </div>
          </div>

          {/* GTA Respect / Deal Title Banner */}
          <div style={{ marginBottom: '14px' }}>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 900,
                margin: '0 0 3px 0',
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FDE68A 45%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
                textShadow: '0 0 22px rgba(245, 158, 11, 0.5)',
              }}
            >
              ★ DEAL CLOSED &amp; CERTIFIED ★
            </h2>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Live broadcast across the Asaheeb Executive Floor
            </p>
          </div>

          {/* MAIN SPOTLIGHT 1: SALES AGENT NAME (HEAVILY FOCUSED) */}
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '2px solid rgba(56, 189, 248, 0.5)',
              borderRadius: '16px',
              padding: '14px 16px',
              textAlign: 'center',
              marginBottom: '12px',
              boxShadow: '0 0 30px rgba(56, 189, 248, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10.5px',
                color: '#38BDF8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 800,
                marginBottom: '4px',
              }}
            >
              <Award size={13} color="#38BDF8" />
              <span>CLOSING CHAMPION &amp; LEAD AGENT</span>
            </div>

            {/* Massive Agent Name */}
            <div
              style={{
                fontSize: '25px',
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                textShadow: '0 0 24px rgba(56, 189, 248, 0.7)',
                background: 'linear-gradient(135deg, #FFFFFF 0%, #BAE6FD 50%, #38BDF8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {deal.agentName}
            </div>

            {deal.agentRole && (
              <div
                style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#93C5FD',
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  border: '1px solid rgba(96, 165, 250, 0.35)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {deal.agentRole.replace(/_/g, ' ')}
              </div>
            )}

            <div style={{ fontSize: '13px', fontWeight: 700, color: '#CBD5E1', marginTop: '6px' }}>
              {deal.projectName} · <span style={{ color: '#FDE68A', fontWeight: 800 }}>Unit {deal.unitName}</span>
            </div>
          </div>

          {/* MAIN SPOTLIGHT 2 & 3: AMOUNT CLOSED & DEAL COMMISSION (HERO DUAL BOXES) */}
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '12px',
            }}
          >
            {/* Box A: Amount Closed in Deal (Total Deal Value) */}
            <div
              style={{
                background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.16) 0%, rgba(217, 119, 6, 0.08) 100%)',
                border: '2px solid rgba(245, 158, 11, 0.6)',
                borderRadius: '14px',
                padding: '12px 10px',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: '#FDE68A',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '4px',
                }}
              >
                <TrendingUp size={12} color="#F59E0B" />
                <span>AMOUNT CLOSED</span>
              </div>

              <div
                style={{
                  fontSize: '19px',
                  fontWeight: 900,
                  color: '#FEF08A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  letterSpacing: '-0.02em',
                }}
              >
                <SaudiRiyalIcon size={16} color="#FEF08A" />
                <span>
                  {deal.dealValueSar && deal.dealValueSar > 0
                    ? deal.dealValueSar.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    : '—'}
                </span>
              </div>
              <div style={{ fontSize: '9.5px', color: '#FCD34D', fontWeight: 600, marginTop: '2px' }}>
                Total Transaction Value
              </div>
            </div>

            {/* Box B: Deal Commission Earned */}
            <div
              style={{
                background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.18) 0%, rgba(4, 120, 87, 0.09) 100%)',
                border: '2px solid rgba(16, 185, 129, 0.65)',
                borderRadius: '14px',
                padding: '12px 10px',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: '#6EE7B7',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '4px',
                }}
              >
                <Sparkles size={12} color="#10B981" />
                <span>DEAL COMMISSION</span>
              </div>

              <div
                style={{
                  fontSize: '19px',
                  fontWeight: 900,
                  color: '#34D399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  letterSpacing: '-0.02em',
                }}
              >
                <SaudiRiyalIcon size={16} color="#34D399" />
                <span>
                  {deal.commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ fontSize: '9.5px', color: '#A7F3D0', fontWeight: 600, marginTop: '2px' }}>
                Agent Commission
              </div>
            </div>
          </div>

          {/* Secondary Details Bar: Area & Date */}
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              marginBottom: '14px',
              fontSize: '11px',
              color: '#94A3B8',
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: '#64748B' }}>Area: </span>
              <span style={{ fontWeight: 800, color: '#F1F5F9' }}>
                {deal.areaSqm ? `${deal.areaSqm.toLocaleString()} m²` : '—'}
              </span>
            </div>
            <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
            <div>
              <span style={{ fontWeight: 600, color: '#64748B' }}>Closed On: </span>
              <span style={{ fontWeight: 800, color: '#F1F5F9' }}>{deal.saleDate || 'Today'}</span>
            </div>
          </div>

          {/* ACTION BUTTONS: Replay GTA Sound, Confetti, Dismiss */}
          <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
            {/* Replay GTA Sound Button */}
            <button
              type="button"
              onClick={replayGtaTrack}
              style={{
                flex: 2,
                padding: '11px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                color: '#000000',
                fontWeight: 900,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
              }}
            >
              <RotateCcw size={15} />
              <span>Replay Track ({replayCount})</span>
            </button>

            {/* Confetti Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                spawnCelebrationBurst(45)
              }}
              style={{
                flex: 1,
                padding: '11px 10px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#FCD34D',
                fontWeight: 800,
                fontSize: '12px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <PartyPopper size={14} />
              <span>Confetti</span>
            </button>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '11px 10px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#94A3B8',
                fontWeight: 700,
                fontSize: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Animations */}
      <style jsx global>{`
        @keyframes celebrationEntrance {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes ringPulse {
          0% {
            transform: scale(0.92);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(0.92);
            opacity: 0.6;
          }
        }
        @keyframes shimmerBar {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
        @keyframes pulseDot {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(0.7);
          }
        }
      `}</style>
    </div>
  )
}
