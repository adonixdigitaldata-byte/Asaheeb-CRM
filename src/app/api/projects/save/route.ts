import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can manage projects' }, { status: 403 })
    }

    const body = await request.json()
    const {
      id,
      original_id,
      name_en,
      name_ar,
      developer_en,
      developer_ar,
      city_en,
      city_ar,
      district_en,
      district_ar,
      starting_price_en,
      starting_price_ar,
      price_range_en,
      price_range_ar,
      size_en,
      size_ar,
      type_en,
      type_ar,
      status_en,
      status_ar,
      expected_delivery_en,
      expected_delivery_ar,
      units_count_en,
      units_count_ar,
      floors_en,
      floors_ar,
      overview_en,
      overview_ar,
      highlights_en,
      highlights_ar,
      images,
      video_url,
      video_items,
      map_embed_url,
      google_maps_url,
      landmarks,
      amenities,
      brochure_url,
      brochure_url_en,
      brochure_url_ar,
      brochure_size_en,
      brochure_size_ar,
      payment_terms_en,
      payment_terms_ar,
      floor_plans,
      is_published,
      sort_order,
    } = body

    const missingFields: string[] = []
    if (!id?.trim()) missingFields.push('Project Slug / ID')
    if (!name_en?.trim()) missingFields.push('Project Name (English)')
    if (!name_ar?.trim()) missingFields.push('Project Name (Arabic)')
    if (!city_en?.trim()) missingFields.push('City (English)')
    if (!district_en?.trim()) missingFields.push('District (English)')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `The following required field(s) are missing: ${missingFields.join(', ')}.` },
        { status: 400 }
      )
    }

    const slug = id.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')

    const payload = {
      id: slug,
      name_en: name_en.trim(),
      name_ar: name_ar.trim(),
      developer_en: developer_en?.trim() || null,
      developer_ar: developer_ar?.trim() || null,
      city_en: city_en.trim(),
      city_ar: city_ar?.trim() || city_en.trim(),
      district_en: district_en.trim(),
      district_ar: district_ar?.trim() || district_en.trim(),
      starting_price_en: starting_price_en?.trim() || null,
      starting_price_ar: starting_price_ar?.trim() || null,
      price_range_en: price_range_en?.trim() || null,
      price_range_ar: price_range_ar?.trim() || null,
      size_en: size_en?.trim() || null,
      size_ar: size_ar?.trim() || null,
      type_en: type_en?.trim() || null,
      type_ar: type_ar?.trim() || null,
      status_en: status_en?.trim() || null,
      status_ar: status_ar?.trim() || null,
      expected_delivery_en: expected_delivery_en?.trim() || null,
      expected_delivery_ar: expected_delivery_ar?.trim() || null,
      units_count_en: units_count_en?.trim() || null,
      units_count_ar: units_count_ar?.trim() || null,
      floors_en: floors_en?.trim() || null,
      floors_ar: floors_ar?.trim() || null,
      overview_en: overview_en || '',
      overview_ar: overview_ar || '',
      highlights_en: Array.isArray(highlights_en) ? highlights_en : [],
      highlights_ar: Array.isArray(highlights_ar) ? highlights_ar : [],
      images: Array.isArray(images) ? images : [],
      video_url: video_url?.trim() || (Array.isArray(video_items) && video_items[0]?.url ? video_items[0].url : null),
      video_items: Array.isArray(video_items) ? video_items : [],
      map_embed_url: map_embed_url?.trim() || null,
      google_maps_url: google_maps_url?.trim() || null,
      landmarks: Array.isArray(landmarks) ? landmarks : [],
      amenities: Array.isArray(amenities) ? amenities : [],
      brochure_url: brochure_url_en?.trim() || brochure_url?.trim() || null,
      brochure_url_en: brochure_url_en?.trim() || brochure_url?.trim() || null,
      brochure_url_ar: brochure_url_ar?.trim() || null,
      brochure_size_en: brochure_size_en?.trim() || null,
      brochure_size_ar: brochure_size_ar?.trim() || null,
      payment_terms_en: payment_terms_en?.trim() || null,
      payment_terms_ar: payment_terms_ar?.trim() || null,
      floor_plans: Array.isArray(floor_plans) ? floor_plans : [],
      is_published: typeof is_published === 'boolean' ? is_published : true,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
      updated_at: new Date().toISOString(),
    }

    const serviceClient = await createServiceClient()

    // If ID/slug was renamed from an existing project, remove the old ID after upserting new
    const { data: project, error } = await serviceClient
      .from('projects')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (original_id && original_id !== slug) {
      await serviceClient.from('projects').delete().eq('id', original_id)
    }

    return NextResponse.json({ success: true, project })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error saving project' }, { status: 500 })
  }
}
