import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!apiSecret) {
      return NextResponse.json({ error: 'Cloudinary API secret not configured' }, { status: 500 })
    }

    const body = await request.json()
    const paramsToSign = body.paramsToSign || {}

    // Sort parameters alphabetically
    const sortedKeys = Object.keys(paramsToSign).sort()
    const stringToSign = sortedKeys.map((key) => `${key}=${paramsToSign[key]}`).join('&') + apiSecret

    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex')

    return NextResponse.json({ signature })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Signature generation failed' }, { status: 500 })
  }
}
