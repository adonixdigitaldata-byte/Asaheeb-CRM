import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { extractCloudinaryPublicId } from '@/lib/cloudinary'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'diwqmlpr'
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary API credentials are not configured on server.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const rawUrl = body.url as string | undefined
    let publicId = (body.public_id as string | undefined)?.trim()

    if (!publicId && rawUrl) {
      publicId = extractCloudinaryPublicId(rawUrl) || undefined
    }

    if (!publicId) {
      return NextResponse.json({
        success: false,
        message: 'No valid Cloudinary public_id found or provided URL is not a Cloudinary asset.',
      })
    }

    const timestamp = Math.round(new Date().getTime() / 1000)

    // Cloudinary destroy parameters to sign: sorted alphabetically
    // Parameters: public_id, timestamp
    const paramsToSign: Record<string, any> = {
      public_id: publicId,
      timestamp,
    }

    const sortedKeys = Object.keys(paramsToSign).sort()
    const stringToSign = sortedKeys.map((key) => `${key}=${paramsToSign[key]}`).join('&') + apiSecret
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex')

    const formData = new FormData()
    formData.append('public_id', publicId)
    formData.append('api_key', apiKey)
    formData.append('timestamp', String(timestamp))
    formData.append('signature', signature)

    // Try destroying as 'image' first
    const imageRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: 'POST',
        body: formData,
      }
    )

    const imageResult = await imageRes.json()

    // If result was 'not found', it might have been uploaded as 'raw' (e.g. document/pdf)
    if (imageResult.result === 'not found') {
      const rawRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/destroy`,
        {
          method: 'POST',
          body: formData,
        }
      )
      const rawResult = await rawRes.json()
      if (rawResult.result === 'ok') {
        return NextResponse.json({
          success: true,
          result: 'ok',
          public_id: publicId,
          resource_type: 'raw',
        })
      }
    }

    const isOk = imageResult.result === 'ok'
    return NextResponse.json({
      success: isOk,
      result: imageResult.result || (isOk ? 'ok' : 'unknown'),
      public_id: publicId,
      raw: imageResult,
    })
  } catch (err: any) {
    console.error('Error in Cloudinary destroy API:', err)
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred deleting the asset.' },
      { status: 500 }
    )
  }
}
