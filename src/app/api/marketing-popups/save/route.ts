import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()
    const body = await request.json()

    const {
      id,
      original_id,
      is_active,
      title_en,
      title_ar,
      subtitle_en,
      subtitle_ar,
      badge_en,
      badge_ar,
      image_url,
      target_url,
      cta_text_en,
      cta_text_ar,
      auto_dismiss_seconds,
      sort_order,
      frequency,
    } = body

    const missingFields: string[] = []
    if (!id?.trim()) missingFields.push('Campaign ID / Slug')
    if (!title_en?.trim()) missingFields.push('Title (English)')
    if (!title_ar?.trim()) missingFields.push('Title (Arabic)')
    if (!image_url?.trim()) missingFields.push('Banner Image URL')
    if (!target_url?.trim()) missingFields.push('Target Redirect URL')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required field(s): ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    const cleanId = id.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '')

    const payload = {
      id: cleanId,
      is_active: typeof is_active === 'boolean' ? is_active : true,
      title_en: title_en.trim(),
      title_ar: title_ar.trim(),
      subtitle_en: subtitle_en?.trim() || null,
      subtitle_ar: subtitle_ar?.trim() || null,
      badge_en: badge_en?.trim() || null,
      badge_ar: badge_ar?.trim() || null,
      image_url: image_url.trim(),
      target_url: target_url.trim(),
      cta_text_en: cta_text_en?.trim() || 'Explore Priority Access',
      cta_text_ar: cta_text_ar?.trim() || 'استكشف أولوية الحجز',
      auto_dismiss_seconds: typeof auto_dismiss_seconds === 'number' ? auto_dismiss_seconds : null,
      sort_order: typeof sort_order === 'number' ? sort_order : 1,
      frequency: frequency?.trim() || 'ONCE_PER_SESSION',
      updated_at: new Date().toISOString(),
    }

    // Upsert popup
    const { data: popup, error } = await serviceClient
      .from('marketing_popups')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // If slug was renamed from an existing popup, delete old record
    if (original_id && original_id !== cleanId) {
      await serviceClient.from('marketing_popups').delete().eq('id', original_id)
    }

    return NextResponse.json({ success: true, popup })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error saving marketing popup' }, { status: 500 })
  }
}
