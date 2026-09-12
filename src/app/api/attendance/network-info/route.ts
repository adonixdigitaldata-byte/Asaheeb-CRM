import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

export async function GET(req: NextRequest) {
  try {
    // Extract client IP from standard proxy/CDN headers
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const cfConnectingIp = req.headers.get('cf-connecting-ip')
    
    let clientIp = cfConnectingIp || realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : null)
    
    // Local development fallback
    if (!clientIp || clientIp === '::1' || clientIp === '127.0.0.1') {
      clientIp = '127.0.0.1 (Localhost / Dev)'
    }

    const userAgent = req.headers.get('user-agent') || ''

    return NextResponse.json(
      {
        success: true,
        ip: clientIp,
        userAgent,
        timestamp: new Date().toISOString(),
      },
      { headers: NO_CACHE_HEADERS }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ip: 'Unknown', error: error.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
