/**
 * Device & Network Telemetry Capture Module for Attendance Verification
 */

export const DEVICE_NICKNAME_KEY = 'asaheeb_crm_device_nickname_v1'

export interface DeviceSpecs {
  deviceName?: string
  deviceType: 'Mobile' | 'Tablet' | 'Desktop'
  os: string
  browser: string
  gpuRenderer?: string
  screenResolution: string
  windowSize: string
  hardwareConcurrency: number | string
  deviceMemoryGb: number | string
  platform: string
  language: string
  timezone: string
  userAgent: string
}

export interface NetworkSpecs {
  ip: string
  effectiveType: string
  downlinkMbps: number | string
  rttMs: number | string
  saveData: boolean
  online: boolean
}

export interface AttendanceTelemetry {
  device: DeviceSpecs
  network: NetworkSpecs
}

function parseOS(ua: string): string {
  if (/windows phone/i.test(ua)) return 'Windows Phone'
  if (/win(dows )?nt 10\.0/i.test(ua)) return 'Windows 10/11'
  if (/win(dows )?nt 6\.3/i.test(ua)) return 'Windows 8.1'
  if (/win(dows )?nt 6\.2/i.test(ua)) return 'Windows 8'
  if (/win(dows )?nt 6\.1/i.test(ua)) return 'Windows 7'
  if (/android/i.test(ua)) {
    const match = ua.match(/android\s([0-9\.]+)/i)
    return match ? `Android ${match[1]}` : 'Android'
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    const match = ua.match(/os\s([0-9_]+)/i)
    const ver = match ? match[1].replace(/_/g, '.') : ''
    return /ipad/i.test(ua) ? `iPadOS ${ver}`.trim() : `iOS ${ver}`.trim()
  }
  if (/mac os x/i.test(ua)) {
    const match = ua.match(/mac os x\s([0-9_]+)/i)
    const ver = match ? match[1].replace(/_/g, '.') : ''
    return `macOS ${ver}`.trim()
  }
  if (/linux/i.test(ua)) return 'Linux'
  if (/cros/i.test(ua)) return 'Chrome OS'
  return 'Windows / PC'
}

function parseBrowser(ua: string): string {
  if (/edg\/([0-9\.]+)/i.test(ua)) {
    const m = ua.match(/edg\/([0-9\.]+)/i)
    return `Edge ${m ? m[1] : ''}`.trim()
  }
  if (/opr\/([0-9\.]+)/i.test(ua) || /opera/i.test(ua)) {
    const m = ua.match(/opr\/([0-9\.]+)/i)
    return `Opera ${m ? m[1] : ''}`.trim()
  }
  if (/chrome\/([0-9\.]+)/i.test(ua)) {
    const m = ua.match(/chrome\/([0-9\.]+)/i)
    return `Chrome ${m ? m[1] : ''}`.trim()
  }
  if (/firefox\/([0-9\.]+)/i.test(ua)) {
    const m = ua.match(/firefox\/([0-9\.]+)/i)
    return `Firefox ${m ? m[1] : ''}`.trim()
  }
  if (/version\/([0-9\.]+).*safari/i.test(ua)) {
    const m = ua.match(/version\/([0-9\.]+)/i)
    return `Safari ${m ? m[1] : ''}`.trim()
  }
  return 'Chrome / WebKit'
}

function detectDeviceType(ua: string): 'Mobile' | 'Tablet' | 'Desktop' {
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet'
  }
  if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(
      ua
    )
  ) {
    return 'Mobile'
  }
  return 'Desktop'
}

function getGpuRenderer(): string {
  if (typeof window === 'undefined') return 'N/A'
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return 'Standard GPU'
    const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''
      // Clean up ANGLE / Direct3D wrappers
      const clean = renderer
        .replace(/ANGLE \((.*?), (.*?), (.*?)\)/i, '$2')
        .replace(/Direct3D.*?vs_\d+_\d+.*?ps_\d+_\d+/i, '')
        .trim()
      return clean || renderer
    }
  } catch (e) {}
  return 'Graphics Accelerator'
}

export function getSavedDeviceNickname(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(DEVICE_NICKNAME_KEY)
  } catch (e) {
    return null
  }
}

export function saveDeviceNickname(name: string) {
  if (typeof window === 'undefined') return
  try {
    if (name.trim()) {
      localStorage.setItem(DEVICE_NICKNAME_KEY, name.trim())
    } else {
      localStorage.removeItem(DEVICE_NICKNAME_KEY)
    }
  } catch (e) {}
}

export async function captureClientTelemetry(): Promise<AttendanceTelemetry> {
  const isClient = typeof window !== 'undefined'
  const ua = isClient ? navigator.userAgent : ''
  const nav = isClient ? (navigator as any) : {}

  // 1. Device Specs
  const deviceType = detectDeviceType(ua)
  const os = parseOS(ua)
  const browser = parseBrowser(ua)
  const gpu = isClient ? getGpuRenderer() : 'N/A'
  const screenResolution = isClient
    ? `${window.screen.width} x ${window.screen.height} (DPR ${window.devicePixelRatio || 1}x)`
    : 'N/A'
  const windowSize = isClient ? `${window.innerWidth} x ${window.innerHeight}` : 'N/A'
  const hardwareConcurrency = nav.hardwareConcurrency ? `${nav.hardwareConcurrency} Cores` : 'N/A'
  const deviceMemoryGb = nav.deviceMemory ? `~${nav.deviceMemory} GB RAM` : 'N/A'
  const platform = nav.platform || 'N/A'
  const language = nav.language || 'en'
  let timezone = 'UTC'
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch (e) {}

  // User-defined or auto-detected device model
  let deviceModel = getSavedDeviceNickname()
  if (!deviceModel && nav.userAgentData && nav.userAgentData.getHighEntropyValues) {
    try {
      const hints = await nav.userAgentData.getHighEntropyValues(['model', 'architecture', 'bitness'])
      if (hints.model) {
        deviceModel = hints.model
      }
    } catch (e) {}
  }

  // Friendly Fallback Name if no custom nickname is set
  const cleanGpu = gpu.split('(')[0].replace(/NVIDIA|Intel|AMD|Apple/i, (m) => m).trim()
  const friendlyFallback = deviceModel
    ? deviceModel
    : deviceType === 'Mobile'
    ? `${os} Mobile`
    : deviceType === 'Tablet'
    ? `${os} Tablet`
    : `${os} PC (${cleanGpu || 'Workstation'})`

  const device: DeviceSpecs = {
    deviceName: friendlyFallback,
    deviceType,
    os,
    browser,
    gpuRenderer: gpu,
    screenResolution,
    windowSize,
    hardwareConcurrency,
    deviceMemoryGb,
    platform,
    language,
    timezone,
    userAgent: ua,
  }

  // 2. Network Specs
  let ip = 'Resolving...'
  try {
    const res = await fetch('/api/attendance/network-info', { method: 'GET', cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data.ip) ip = data.ip
    }
  } catch (err) {
    ip = 'Local / Direct Network'
  }

  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {}
  const network: NetworkSpecs = {
    ip,
    effectiveType: conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Broadband / WiFi',
    downlinkMbps: conn.downlink ? `${conn.downlink} Mbps` : 'High Speed',
    rttMs: conn.rtt ? `${conn.rtt} ms` : '< 50 ms',
    saveData: Boolean(conn.saveData),
    online: isClient ? navigator.onLine : true,
  }

  return { device, network }
}
