'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Bell,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Trophy,
  PartyPopper,
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

export type BellSoundStyle = 'SHIP_BELL' | 'BRONZE_GONG' | 'VICTORY_FANFARE'

/**
 * Pre-unlocks AudioContext synchronously during a direct user click/touch event.
 * Eliminates browser audio autoplay policy delays and starts sounds on millisecond 0.
 */
export function unlockCelebrationAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return null
    if (!(window as any)._sharedCelebrationCtx || (window as any)._sharedCelebrationCtx.state === 'closed') {
      (window as any)._sharedCelebrationCtx = new AudioContextClass()
    }
    const ctx = (window as any)._sharedCelebrationCtx as AudioContext
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    return ctx
  } catch {
    return null
  }
}

/**
 * Physical Mallet Impact Transient (Metallic strike crack)
 */
function scheduleMalletImpact(ctx: AudioContext, time: number, outputNode: AudioNode, intensity = 1.0) {
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.05) // 50ms burst
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008))
    }
    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(3200, time)
    filter.Q.setValueAtTime(3.0, time)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.6 * intensity, time)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)

    whiteNoise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(outputNode)

    whiteNoise.start(time)
    whiteNoise.stop(time + 0.05)
  } catch {}
}

/**
 * High-Definition FM Synthesized Brass Ship Bell Strike (DX7 Chowning Bell Model)
 */
function scheduleShipBellStrike(
  ctx: AudioContext,
  time: number,
  outputNode: AudioNode,
  intensity = 1.0,
  pitchMultiplier = 1.0
) {
  scheduleMalletImpact(ctx, time, outputNode, intensity)

  const carrierFreq = 440 * pitchMultiplier
  const modFreq = carrierFreq * 1.414

  const modOsc = ctx.createOscillator()
  const modGain = ctx.createGain()
  modOsc.frequency.setValueAtTime(modFreq, time)
  modGain.gain.setValueAtTime(carrierFreq * 3.5 * intensity, time)
  modGain.gain.exponentialRampToValueAtTime(1.0, time + 2.0)

  const carrierOsc = ctx.createOscillator()
  const carrierGain = ctx.createGain()
  carrierOsc.frequency.setValueAtTime(carrierFreq, time)
  carrierGain.gain.setValueAtTime(0.001, time)
  carrierGain.gain.linearRampToValueAtTime(0.85 * intensity, time + 0.004)
  carrierGain.gain.exponentialRampToValueAtTime(0.0001, time + 3.2)

  modOsc.connect(modGain)
  modGain.connect(carrierOsc.frequency)
  carrierOsc.connect(carrierGain)
  carrierGain.connect(outputNode)

  modOsc.start(time)
  carrierOsc.start(time)
  modOsc.stop(time + 3.3)
  carrierOsc.stop(time + 3.3)

  const partials = [
    { freq: 220 * pitchMultiplier, vol: 0.7, decay: 2.8 },
    { freq: 659 * pitchMultiplier, vol: 0.5, decay: 2.4 },
    { freq: 880 * pitchMultiplier, vol: 0.6, decay: 2.9 },
    { freq: 1320 * pitchMultiplier, vol: 0.45, decay: 2.0 },
    { freq: 1760 * pitchMultiplier, vol: 0.35, decay: 1.8 },
    { freq: 2640 * pitchMultiplier, vol: 0.25, decay: 1.4 },
  ]

  partials.forEach((p) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(p.freq, time)

    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(p.vol * intensity, time + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + p.decay)

    osc.connect(gain)
    gain.connect(outputNode)
    osc.start(time)
    osc.stop(time + p.decay + 0.1)
  })
}

/**
 * Deep Imperial Bronze Gong (Massive room-shaking bronze boom)
 */
function scheduleBronzeGong(ctx: AudioContext, time: number, outputNode: AudioNode, intensity = 1.0) {
  scheduleMalletImpact(ctx, time, outputNode, intensity * 0.8)

  const gongFrequencies = [
    { freq: 98, vol: 0.9, decay: 4.5 },
    { freq: 147, vol: 0.8, decay: 4.2 },
    { freq: 220, vol: 0.75, decay: 3.8 },
    { freq: 330, vol: 0.6, decay: 3.2 },
    { freq: 440, vol: 0.5, decay: 2.8 },
    { freq: 698, vol: 0.35, decay: 2.2 },
  ]

  gongFrequencies.forEach((g) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(g.freq, time)
    osc.frequency.exponentialRampToValueAtTime(g.freq * 0.98, time + g.decay)

    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(g.vol * intensity, time + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + g.decay)

    osc.connect(gain)
    gain.connect(outputNode)
    osc.start(time)
    osc.stop(time + g.decay + 0.2)
  })
}

/**
 * Victory Stadium Fanfare Chords
 */
function scheduleFanfareChord(ctx: AudioContext, time: number, outputNode: AudioNode, notes: number[]) {
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const noteTime = time + idx * 0.08

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, noteTime)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, noteTime)

    gain.gain.setValueAtTime(0.001, noteTime)
    gain.gain.linearRampToValueAtTime(0.35, noteTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.4)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(outputNode)
    osc.start(noteTime)
    osc.stop(noteTime + 1.5)
  })
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
  const [soundStyle, setSoundStyle] = useState<BellSoundStyle>('SHIP_BELL')
  const [ringsCount, setRingsCount] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [bellPulsing, setBellPulsing] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(16)
  const [shockwaves, setShockwaves] = useState<number[]>([])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
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

  // Setup Canvas and Animation Loop
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
      t += 0.02
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (ribbonsRef.current.length < 6 && Math.random() < 0.07) {
        const palette = LUXURY_PALETTE[Math.floor(Math.random() * LUXURY_PALETTE.length)]
        const startX = Math.random() * canvas.width
        const segments: { x: number; y: number; width: number }[] = []
        for (let s = 0; s < 20; s++) {
          segments.push({
            x: startX,
            y: -s * 15 - 40,
            width: 10 + Math.sin((s / 20) * Math.PI) * 8,
          })
        }
        ribbonsRef.current.push({
          x: startX,
          y: -70,
          vx: (Math.random() - 0.5) * 1.4,
          vy: 2.0 + Math.random() * 1.6,
          width: 10,
          color1: palette.c1,
          color2: palette.c2,
          angle: Math.random() * Math.PI * 2,
          angleSpeed: 0.03,
          waviness: 24,
          waveSpeed: 0.04,
          waveOffset: Math.random() * 10,
          points: segments,
        })
      }

      // Render Ribbons
      for (let i = ribbonsRef.current.length - 1; i >= 0; i--) {
        const r = ribbonsRef.current[i]
        r.y += r.vy
        r.x += r.vx
        r.angle += r.angleSpeed

        const headX = r.x + Math.sin(t * r.waveSpeed * 10 + r.waveOffset) * r.waviness
        const headY = r.y
        r.points.unshift({
          x: headX,
          y: headY,
          width: r.width * Math.abs(Math.cos(r.angle)),
        })
        if (r.points.length > 22) {
          r.points.pop()
        }

        if (r.points.length >= 2) {
          for (let p = 0; p < r.points.length - 1; p++) {
            const p1 = r.points[p]
            const p2 = r.points[p + 1]
            const w1 = Math.max(2, p1.width)
            const w2 = Math.max(2, p2.width)

            const grad = ctx.createLinearGradient(p1.x - w1, p1.y, p1.x + w1, p1.y)
            grad.addColorStop(0, r.color1)
            grad.addColorStop(0.5, '#FFFFFF')
            grad.addColorStop(1, r.color2)

            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.moveTo(p1.x - w1, p1.y)
            ctx.lineTo(p1.x + w1, p1.y)
            ctx.lineTo(p2.x + w2, p2.y)
            ctx.lineTo(p2.x - w2, p2.y)
            ctx.closePath()
            ctx.fill()
          }
        }

        if (r.points[r.points.length - 1]?.y > canvas.height + 120) {
          ribbonsRef.current.splice(i, 1)
        }
      }

      // Render Confetti
      for (let i = confettiRef.current.length - 1; i >= 0; i--) {
        const c = confettiRef.current[i]
        c.x += c.vx
        c.y += c.vy
        c.vy += 0.15
        c.vx *= 0.985
        c.rotationX += c.speedRotX
        c.rotationY += c.speedRotY

        ctx.save()
        ctx.translate(c.x, c.y)
        ctx.rotate(c.rotationZ)
        ctx.scale(Math.cos(c.rotationX), Math.sin(c.rotationY))

        ctx.fillStyle = c.color
        ctx.shadowColor = c.color
        ctx.shadowBlur = 4

        if (c.shape === 'rect') {
          ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.7)
        } else if (c.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, c.size / 2.5, 0, Math.PI * 2)
          ctx.fill()
        } else {
          const s = c.size * 0.6
          ctx.beginPath()
          ctx.moveTo(0, -s)
          ctx.lineTo(s * 0.3, -s * 0.3)
          ctx.lineTo(s, 0)
          ctx.lineTo(s * 0.3, s * 0.3)
          ctx.lineTo(0, s)
          ctx.lineTo(-s * 0.3, s * 0.3)
          ctx.lineTo(-s, 0)
          ctx.lineTo(-s * 0.3, -s * 0.3)
          ctx.closePath()
          ctx.fill()
        }

        ctx.restore()

        if (c.y > canvas.height + 40) {
          confettiRef.current.splice(i, 1)
        }
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [spawnCelebrationBurst])

  // Shockwave trigger for visual bell ripple
  const triggerShockwave = useCallback(() => {
    const id = Date.now()
    setShockwaves((prev) => [...prev.slice(-2), id])
    setTimeout(() => {
      setShockwaves((prev) => prev.filter((sw) => sw !== id))
    }, 1000)
  }, [])

  // Start 15+ Second Continuous Dubai Sales Celebration Audio
  const startFullCelebrationAudio = useCallback(
    (style: BellSoundStyle = soundStyle) => {
      try {
        let ctx = unlockCelebrationAudio()
        if (!ctx) return
        audioCtxRef.current = ctx

        const compressor = ctx.createDynamicsCompressor()
        compressor.threshold.setValueAtTime(-14, ctx.currentTime)
        compressor.knee.setValueAtTime(8, ctx.currentTime)
        compressor.ratio.setValueAtTime(12, ctx.currentTime)
        compressor.attack.setValueAtTime(0.002, ctx.currentTime)
        compressor.release.setValueAtTime(0.2, ctx.currentTime)

        const master = ctx.createGain()
        master.gain.setValueAtTime(1.0, ctx.currentTime)
        masterGainRef.current = master

        compressor.connect(master)
        master.connect(ctx.destination)

        const now = ctx.currentTime

        if (style === 'SHIP_BELL') {
          const pairsCount = 10
          for (let p = 0; p < pairsCount; p++) {
            const pairStart = now + p * 1.5

            scheduleShipBellStrike(ctx, pairStart, compressor, 1.15, 1.0)
            scheduleShipBellStrike(ctx, pairStart + 0.16, compressor, 0.95, 1.05)

            setTimeout(() => {
              setBellPulsing(true)
              triggerShockwave()
              setTimeout(() => setBellPulsing(false), 450)
            }, p * 1500)
          }

          scheduleFanfareChord(ctx, now + 0.4, compressor, [523.25, 659.25, 783.99])
          scheduleFanfareChord(ctx, now + 6.0, compressor, [587.33, 739.99, 880.0])
          scheduleFanfareChord(ctx, now + 12.0, compressor, [783.99, 987.77, 1318.51])
        } else if (style === 'BRONZE_GONG') {
          const gongCount = 8
          for (let g = 0; g < gongCount; g++) {
            const gongTime = now + g * 2.0
            scheduleBronzeGong(ctx, gongTime, compressor, 1.3)

            setTimeout(() => {
              setBellPulsing(true)
              triggerShockwave()
              setTimeout(() => setBellPulsing(false), 550)
            }, g * 2000)
          }
        } else {
          scheduleFanfareChord(ctx, now + 0.1, compressor, [523.25, 659.25, 783.99, 1046.5])
          scheduleFanfareChord(ctx, now + 2.5, compressor, [587.33, 739.99, 880.0, 1174.66])
          scheduleFanfareChord(ctx, now + 5.0, compressor, [659.25, 830.61, 987.77, 1318.51])
          scheduleFanfareChord(ctx, now + 8.0, compressor, [783.99, 987.77, 1174.66, 1567.98])
          scheduleFanfareChord(ctx, now + 12.0, compressor, [1046.5, 1318.51, 1567.98, 2093.0])

          for (let b = 0; b < 10; b++) {
            scheduleShipBellStrike(ctx, now + b * 1.5, compressor, 0.95)
            setTimeout(() => {
              setBellPulsing(true)
              triggerShockwave()
              setTimeout(() => setBellPulsing(false), 450)
            }, b * 1500)
          }
        }
      } catch (err) {
        console.warn('Audio synthesis error:', err)
      }
    },
    [soundStyle, triggerShockwave]
  )

  // Instant Manual Strike / Gong Ring
  const triggerManualRing = useCallback(
    (e?: React.MouseEvent | React.TouchEvent) => {
      if (e) {
        e.stopPropagation()
      }
      setBellPulsing(true)
      triggerShockwave()
      spawnCelebrationBurst(35)
      setTimeout(() => setBellPulsing(false), 500)
      setRingsCount((c) => c + 1)

      if (isMuted) return

      try {
        let ctx = unlockCelebrationAudio()
        if (!ctx) return
        audioCtxRef.current = ctx

        if (masterGainRef.current) {
          if (soundStyle === 'BRONZE_GONG') {
            scheduleBronzeGong(ctx, ctx.currentTime, masterGainRef.current, 1.4)
          } else {
            scheduleShipBellStrike(ctx, ctx.currentTime, masterGainRef.current, 1.35, 1.0)
            scheduleShipBellStrike(ctx, ctx.currentTime + 0.16, masterGainRef.current, 1.15, 1.05)
          }
        } else {
          startFullCelebrationAudio()
        }
      } catch (err) {
        console.warn('Manual ring error:', err)
      }
    },
    [isMuted, soundStyle, startFullCelebrationAudio, triggerShockwave, spawnCelebrationBurst]
  )

  const handleSwitchSound = (newStyle: BellSoundStyle) => {
    setSoundStyle(newStyle)
    startFullCelebrationAudio(newStyle)
  }

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMuted((prev) => {
      const next = !prev
      if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setValueAtTime(next ? 0 : 1.0, audioCtxRef.current.currentTime)
      }
      return next
    })
  }, [])

  useEffect(() => {
    startFullCelebrationAudio()

    const countdown = setInterval(() => {
      setSecondsRemaining((s) => (s > 0 ? s - 1 : 0))
    }, 1000)

    return () => {
      clearInterval(countdown)
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
      }
    }
  }, [startFullCelebrationAudio])

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

      {/* Acoustic Radial Shockwaves Emitter Behind Card */}
      {shockwaves.map((swId) => (
        <div
          key={swId}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: '3px solid rgba(245, 158, 11, 0.85)',
            boxShadow: '0 0 50px rgba(245, 158, 11, 0.6), inset 0 0 30px rgba(245, 158, 11, 0.4)',
            pointerEvents: 'none',
            zIndex: 2,
            animation: 'acousticShockwave 1.1s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
          }}
        />
      ))}

      {/* Main Floor TV Celebration Shell (Centered layout with zero overflow on mobile screens) */}
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: 'min(94dvh, 720px)',
          background: 'radial-gradient(ellipse at top, #1E293B 0%, #0F172A 45%, #020617 100%)',
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
        {/* Top 15-Second Active Broadcast Celebration Neon Progress Bar */}
        <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.1)', width: '100%', flexShrink: 0 }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #F59E0B, #10B981, #38BDF8, #F59E0B)',
              backgroundSize: '200% 100%',
              width: `${(secondsRemaining / 16) * 100}%`,
              transition: 'width 1s linear',
              animation: 'shimmerBar 2s linear infinite',
            }}
          />
        </div>

        {/* TOP HEADER: Centered & Clean */}
        <div
          style={{
            padding: '10px 16px 8px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            flexShrink: 0,
            zIndex: 5,
          }}
        >
          {/* Top Row: Luxury Brand Badge + Countdown + Sound/Close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  color: '#FDE68A',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <Sparkles size={11} color="#F59E0B" />
                <span>CLOSING BELL</span>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
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
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: secondsRemaining > 0 ? '#10B981' : '#94A3B8',
                    animation: secondsRemaining > 0 ? 'pulseDot 1s ease-in-out infinite' : 'none',
                  }}
                />
                <span>{secondsRemaining > 0 ? `${secondsRemaining}s` : 'Done'}</span>
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

          {/* Sound Preset Selector Bar - Centered */}
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '2px 4px',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, paddingRight: '4px' }}>
              Style:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {(
                [
                  { id: 'SHIP_BELL', label: '🔔 Bell' },
                  { id: 'BRONZE_GONG', label: '🪙 Gong' },
                  { id: 'VICTORY_FANFARE', label: '🎺 Fanfare' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSwitchSound(s.id)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '10px',
                    fontWeight: soundStyle === s.id ? 800 : 500,
                    border: soundStyle === s.id ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid transparent',
                    cursor: 'pointer',
                    backgroundColor: soundStyle === s.id ? '#F59E0B' : 'transparent',
                    color: soundStyle === s.id ? '#000000' : '#CBD5E1',
                    boxShadow: soundStyle === s.id ? '0 1px 4px rgba(245, 158, 11, 0.3)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTERPIECE SHOWCASE: Perfectly Centered Bell & Balanced Text */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Centered Golden Sales Bell */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '2px auto 8px auto',
              cursor: 'pointer',
            }}
            onClick={triggerManualRing}
          >
            {/* Ambient Gold Halo */}
            <div
              style={{
                position: 'absolute',
                inset: '-18px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.5) 0%, rgba(217, 119, 6, 0.15) 50%, transparent 75%)',
                animation: 'ringPulse 1.4s ease-out infinite',
                pointerEvents: 'none',
              }}
            />

            {/* Glowing Golden 3D Bell Strike Button */}
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #FEF08A 0%, #F59E0B 50%, #B45309 85%, #78350F 100%)',
                border: '4px solid #FDE68A',
                boxShadow:
                  '0 0 35px rgba(245, 158, 11, 0.75), 0 8px 18px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: bellPulsing ? 'scale(1.15) rotate(-15deg)' : 'scale(1) rotate(0deg)',
                transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                position: 'relative',
                zIndex: 3,
                userSelect: 'none',
              }}
            >
              <Bell
                size={40}
                style={{
                  filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.5))',
                  color: '#FFFFFF',
                }}
              />
            </div>

            {/* Interactive Cue */}
            <div
              style={{
                marginTop: '5px',
                fontSize: '10px',
                fontWeight: 800,
                color: '#FCD34D',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>⚡ TAP BELL TO STRIKE</span>
            </div>
          </div>

          {/* Centered Headline */}
          <div style={{ marginBottom: '10px' }}>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 900,
                margin: '0 0 2px 0',
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FDE68A 50%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
                textShadow: '0 0 18px rgba(245, 158, 11, 0.4)',
              }}
            >
              🎉 NEW SALE CLOSED!
            </h2>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, fontWeight: 500 }}>
              Live broadcast across the Asaheeb Sales Floor Screen
            </p>
          </div>

          {/* Luxury Deal Highlights Card (100% Balanced & Centered) */}
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              padding: '12px 14px',
              textAlign: 'center',
              marginBottom: '12px',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Champion & Layout Centered Banner */}
            <div style={{ paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '8px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                <Trophy size={12} color="#F59E0B" />
                <span>CLOSING CHAMPION</span>
              </div>
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#38BDF8', marginTop: '1px' }}>
                {deal.agentName}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#E2E8F0', marginTop: '2px' }}>
                {deal.projectName} · <span style={{ color: '#FFFFFF', fontWeight: 800 }}>{deal.unitName}</span>
              </div>
            </div>

            {/* Balanced 2-Column Row: Sold Area & Transaction Value */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ fontSize: '9.5px', color: '#FCD34D', fontWeight: 700, textTransform: 'uppercase' }}>
                  Sold Area
                </div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#FDE68A', marginTop: '2px' }}>
                  {deal.areaSqm ? `${deal.areaSqm.toLocaleString()} m²` : '—'}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontSize: '9.5px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Sale Date
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#F1F5F9', marginTop: '2px' }}>
                  {deal.saleDate || 'Today'}
                </div>
              </div>
            </div>

            {/* Full-Width Centered Deal Commission Hero Box */}
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '10px',
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '10px', color: '#6EE7B7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Deal Commission
                </div>
                {deal.dealValueSar && deal.dealValueSar > 0 && (
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                    Val: SAR {deal.dealValueSar.toLocaleString('en-US')}
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 900,
                  color: '#34D399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <SaudiRiyalIcon size={14} color="#34D399" />
                <span>SAR {deal.commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: 100% Symmetrical, Balanced Row */}
          <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
            {/* Primary Ring Button */}
            <button
              type="button"
              onClick={triggerManualRing}
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
                boxShadow: '0 3px 12px rgba(245, 158, 11, 0.4)',
              }}
            >
              <Bell size={16} />
              <span>Ring Bell ({ringsCount})</span>
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
                fontSize: '12.5px',
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
                fontSize: '12.5px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Global Embedded Animations */}
      <style jsx global>{`
        @keyframes acousticShockwave {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(4.5);
            opacity: 0;
          }
        }
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
