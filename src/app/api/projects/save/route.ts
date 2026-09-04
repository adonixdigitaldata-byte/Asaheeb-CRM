import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logCmsActivity } from '@/lib/cms-activity'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()

    // Get current profile for accurate actor attribution
    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('id, name, email, role')
      .eq('id', user.id)
      .single()

    const actorName = userProfile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Team Member'
    const actorEmail = userProfile?.email || user.email || null

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
      expected_commission_en,
      expected_commission_ar,
      commission_notes_en,
      commission_notes_ar,
      discount_offer,
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

    // Check if previous project exists to determine action type & changes
    const targetLookupId = original_id || slug
    const { data: existingProject } = await serviceClient
      .from('projects')
      .select('*')
      .eq('id', targetLookupId)
      .maybeSingle()

    const isNew = !existingProject
    const imageList = Array.isArray(images) ? images : []
    const prevImages = Array.isArray(existingProject?.images) ? existingProject.images : []

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
      images: imageList,
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
      expected_commission_en: expected_commission_en?.trim() || null,
      expected_commission_ar: expected_commission_ar?.trim() || null,
      commission_notes_en: commission_notes_en?.trim() || null,
      commission_notes_ar: commission_notes_ar?.trim() || null,
      discount_offer: discount_offer && typeof discount_offer === 'object' ? discount_offer : null,
      is_published: typeof is_published === 'boolean' ? is_published : true,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
      updated_at: new Date().toISOString(),
    }

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

    // Determine description & action type for the audit log
    if (isNew) {
      await logCmsActivity({
        entityType: 'PROJECT',
        entityId: slug,
        actionType: 'CREATED',
        actorId: user.id,
        actorName,
        actorEmail,
        description: `Created new project "${name_en}" (${type_en || 'Property'}) in ${city_en}`,
        metadata: {
          changed_fields: ['Created Project'],
        },
      })
    } else {
      const changes: string[] = []

      // Compare individual fields to know exactly what was edited
      if (name_en.trim() !== (existingProject.name_en || '').trim()) {
        changes.push(`Name ("${name_en}")`)
      }
      if ((type_en?.trim() || '') !== (existingProject.type_en || '').trim()) {
        changes.push(`Property Type ("${type_en || 'None'}")`)
      }
      if ((status_en?.trim() || '') !== (existingProject.status_en || '').trim()) {
        changes.push(`Status ("${status_en || 'None'}")`)
      }
      if ((starting_price_en?.trim() || '') !== (existingProject.starting_price_en || '').trim()) {
        changes.push(`Starting Price ("${starting_price_en || 'On inquiry'}")`)
      }
      if ((price_range_en?.trim() || '') !== (existingProject.price_range_en || '').trim()) {
        changes.push(`Price Range ("${price_range_en || 'None'}")`)
      }
      if ((size_en?.trim() || '') !== (existingProject.size_en || '').trim()) {
        changes.push(`Property Sizes ("${size_en || 'None'}")`)
      }
      if ((developer_en?.trim() || '') !== (existingProject.developer_en || '').trim()) {
        changes.push(`Developer ("${developer_en || 'None'}")`)
      }
      if (
        (city_en?.trim() || '') !== (existingProject.city_en || '').trim() ||
        (district_en?.trim() || '') !== (existingProject.district_en || '').trim()
      ) {
        changes.push(`Location ("${district_en}, ${city_en}")`)
      }
      if ((expected_delivery_en?.trim() || '') !== (existingProject.expected_delivery_en || '').trim()) {
        changes.push(`Delivery Date ("${expected_delivery_en || 'None'}")`)
      }
      if ((units_count_en?.trim() || '') !== (existingProject.units_count_en || '').trim()) {
        changes.push(`Units Count ("${units_count_en || 'None'}")`)
      }
      if ((floors_en?.trim() || '') !== (existingProject.floors_en || '').trim()) {
        changes.push(`Floors Count ("${floors_en || 'None'}")`)
      }
      if ((payment_terms_en?.trim() || '') !== (existingProject.payment_terms_en || '').trim()) {
        changes.push(`Payment Terms ("${payment_terms_en || 'None'}")`)
      }
      if ((expected_commission_en?.trim() || '') !== (existingProject.expected_commission_en || '').trim()) {
        changes.push(`Brokerage Commission ("${expected_commission_en || 'Not set'}")`)
      }
      if ((commission_notes_en?.trim() || '') !== (existingProject.commission_notes_en || '').trim()) {
        changes.push(`Commission Notes/Limits`)
      }
      if ((overview_en?.trim() || '') !== (existingProject.overview_en || '').trim()) {
        changes.push(`Overview Description`)
      }
      if (JSON.stringify(highlights_en || []) !== JSON.stringify(existingProject.highlights_en || [])) {
        changes.push(`Highlights`)
      }
      if (imageList.length !== prevImages.length || JSON.stringify(imageList) !== JSON.stringify(prevImages)) {
        changes.push(`Gallery Photos (${prevImages.length} -> ${imageList.length})`)
      }
      const prevFloorPlans = Array.isArray(existingProject.floor_plans) ? existingProject.floor_plans : []
      const currFloorPlans = Array.isArray(floor_plans) ? floor_plans : []
      if (currFloorPlans.length !== prevFloorPlans.length || JSON.stringify(currFloorPlans) !== JSON.stringify(prevFloorPlans)) {
        changes.push(`Floor Plans (${prevFloorPlans.length} -> ${currFloorPlans.length})`)
      }
      const prevAmenities = Array.isArray(existingProject.amenities) ? existingProject.amenities : []
      const currAmenities = Array.isArray(amenities) ? amenities : []
      if (currAmenities.length !== prevAmenities.length) {
        changes.push(`Amenities (${prevAmenities.length} -> ${currAmenities.length})`)
      }
      const prevLandmarks = Array.isArray(existingProject.landmarks) ? existingProject.landmarks : []
      const currLandmarks = Array.isArray(landmarks) ? landmarks : []
      if (currLandmarks.length !== prevLandmarks.length) {
        changes.push(`Landmarks (${prevLandmarks.length} -> ${currLandmarks.length})`)
      }
      if (
        (brochure_url_en?.trim() || brochure_url?.trim() || '') !==
        (existingProject.brochure_url_en || existingProject.brochure_url || '').trim()
      ) {
        changes.push(`PDF Brochure`)
      }
      if ((video_url?.trim() || '') !== (existingProject.video_url || '').trim()) {
        changes.push(`Showcase Videos`)
      }
      if (
        (map_embed_url?.trim() || '') !== (existingProject.map_embed_url || '').trim() ||
        (google_maps_url?.trim() || '') !== (existingProject.google_maps_url || '').trim()
      ) {
        changes.push(`Map Location`)
      }
      if (JSON.stringify(discount_offer || null) !== JSON.stringify(existingProject.discount_offer || null)) {
        if (discount_offer?.is_active) {
          changes.push(`Promotional Offer ("${discount_offer.discount_badge_en || discount_offer.title_en || 'Active Offer'}")`)
        } else if (existingProject.discount_offer?.is_active && !discount_offer?.is_active) {
          changes.push(`Deactivated Promotional Offer`)
        } else {
          changes.push(`Discount Offer Settings`)
        }
      }

      // Determine main action badge
      let actionType: string = 'UPDATED_DETAILS'
      if (changes.some((c) => c.startsWith('Gallery Photos'))) {
        actionType = 'UPDATED_PHOTOS'
      } else if (changes.some((c) => c.startsWith('Brokerage Commission'))) {
        actionType = 'UPDATED_COMMISSION'
      } else if (changes.some((c) => c.startsWith('Promotional Offer') || c.startsWith('Discount Offer') || c.startsWith('Deactivated Promotional Offer'))) {
        actionType = 'UPDATED_DETAILS'
      }

      const summaryStr = changes.length > 0
        ? `Updated ${changes.join(', ')} for project "${name_en}"`
        : `Updated project configuration for "${name_en}"`

      await logCmsActivity({
        entityType: 'PROJECT',
        entityId: slug,
        actionType: actionType as any,
        actorId: user.id,
        actorName,
        actorEmail,
        description: summaryStr,
        metadata: {
          changed_fields: changes,
        },
      })
    }

    return NextResponse.json({ success: true, project })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error saving project' }, { status: 500 })
  }
}

