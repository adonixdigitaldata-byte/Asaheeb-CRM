import { NextRequest } from 'next/server'

export function getAppUrl(request?: Request | NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'http'
    if (host) return `${proto}://${host}`
  }
  return 'http://localhost:3000'
}
