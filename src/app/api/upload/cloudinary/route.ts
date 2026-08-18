import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'diwqmlpr'
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName) {
      return NextResponse.json(
        { error: 'Cloudinary Cloud Name is not configured.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'asaheeb/projects'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to base64 data URI
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const mimeType = file.type || 'image/jpeg'
    const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`

    const timestamp = Math.round(new Date().getTime() / 1000)

    // Prepare upload payload
    const uploadBody = new FormData()
    uploadBody.append('file', base64Data)
    uploadBody.append('folder', folder)

    if (apiKey && apiSecret) {
      // Signed Upload
      const paramsToSign: Record<string, any> = {
        folder,
        timestamp,
      }
      const sortedKeys = Object.keys(paramsToSign).sort()
      const stringToSign = sortedKeys.map((key) => `${key}=${paramsToSign[key]}`).join('&') + apiSecret
      const signature = crypto.createHash('sha1').update(stringToSign).digest('hex')

      uploadBody.append('api_key', apiKey)
      uploadBody.append('timestamp', String(timestamp))
      uploadBody.append('signature', signature)
    } else if (uploadPreset) {
      // Unsigned Upload with Preset
      uploadBody.append('upload_preset', uploadPreset)
    }

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: uploadBody,
      }
    )

    const result = await cloudinaryRes.json()

    if (!cloudinaryRes.ok || result.error) {
      const errMsg = result.error?.message || 'Failed to upload image to Cloudinary'
      let userFriendly = errMsg
      if (errMsg.includes('Request forbidden') || errMsg.includes('missing permissions') || errMsg.includes('create')) {
        userFriendly = `Cloudinary API Key permissions restricted. Please enable the "create" permission in Cloudinary Settings > Access Keys, or use the Native Cloudinary Widget.`
      }
      return NextResponse.json(
        { error: userFriendly, raw: errMsg },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      url: result.secure_url || result.url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred during image upload.' },
      { status: 500 }
    )
  }
}

