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

    const { data: userProfile } = await serviceClient
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    const actorName = userProfile?.name || user.email?.split('@')[0] || 'Team Member'
    const actorEmail = userProfile?.email || user.email || null

    const body = await request.json()
    const {
      id,
      original_id,
      category,
      category_en,
      category_ar,
      accent,
      date_en,
      date_ar,
      read_time_en,
      read_time_ar,
      author_en,
      author_ar,
      title_en,
      title_ar,
      excerpt_en,
      excerpt_ar,
      summary_en,
      summary_ar,
      sections_en,
      sections_ar,
      stat_box,
      quote_en,
      quote_ar,
      cover_image_url,
      featured,
      is_published,
      sort_order,
    } = body

    const missingFields: string[] = []
    if (!id?.trim()) missingFields.push('Article Slug / ID')
    if (!title_en?.trim()) missingFields.push('Article Title (English)')
    if (!title_ar?.trim()) missingFields.push('Article Title (Arabic)')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `The following required field(s) are missing: ${missingFields.join(', ')}.` },
        { status: 400 }
      )
    }

    const slug = id.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')

    const targetLookupId = original_id || slug
    const { data: existingBlog } = await serviceClient
      .from('blogs')
      .select('*')
      .eq('id', targetLookupId)
      .maybeSingle()

    const isNew = !existingBlog

    const payload = {
      id: slug,
      category: category?.trim() || 'guide',
      category_en: category_en?.trim() || 'Investment Guide',
      category_ar: category_ar?.trim() || 'دليل الاستثمار',
      accent: accent?.trim() || '#B8873B',
      date_en: date_en?.trim() || '',
      date_ar: date_ar?.trim() || '',
      read_time_en: read_time_en?.trim() || '5 min read',
      read_time_ar: read_time_ar?.trim() || '٥ دقائق قراءة',
      author_en: author_en?.trim() || 'Asaheeb Research',
      author_ar: author_ar?.trim() || 'فريق أبحاث أساهيب',
      title_en: title_en.trim(),
      title_ar: title_ar.trim(),
      excerpt_en: excerpt_en?.trim() || '',
      excerpt_ar: excerpt_ar?.trim() || '',
      summary_en: Array.isArray(summary_en) ? summary_en : [],
      summary_ar: Array.isArray(summary_ar) ? summary_ar : [],
      sections_en: Array.isArray(sections_en) ? sections_en : [],
      sections_ar: Array.isArray(sections_ar) ? sections_ar : [],
      stat_box: Array.isArray(stat_box) ? stat_box : [],
      quote_en: quote_en?.trim() || null,
      quote_ar: quote_ar?.trim() || null,
      cover_image_url: cover_image_url?.trim() || null,
      featured: typeof featured === 'boolean' ? featured : false,
      is_published: typeof is_published === 'boolean' ? is_published : true,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
      updated_at: new Date().toISOString(),
    }

    const { data: blog, error } = await serviceClient
      .from('blogs')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (original_id && original_id !== slug) {
      await serviceClient.from('blogs').delete().eq('id', original_id)
    }

    if (isNew) {
      await logCmsActivity({
        entityType: 'BLOG',
        entityId: slug,
        actionType: 'CREATED',
        actorId: user.id,
        actorName,
        actorEmail,
        description: `Created new blog article "${title_en}" (${category_en || 'Article'})`,
        metadata: {
          changed_fields: ['Created Article'],
        },
      })
    } else {
      const changes: string[] = []

      if (title_en.trim() !== (existingBlog.title_en || '').trim()) {
        changes.push(`Title ("${title_en}")`)
      }
      if ((category_en?.trim() || '') !== (existingBlog.category_en || '').trim()) {
        changes.push(`Category ("${category_en}")`)
      }
      if ((author_en?.trim() || '') !== (existingBlog.author_en || '').trim()) {
        changes.push(`Author ("${author_en}")`)
      }
      if ((read_time_en?.trim() || '') !== (existingBlog.read_time_en || '').trim()) {
        changes.push(`Read Time ("${read_time_en}")`)
      }
      if ((excerpt_en?.trim() || '') !== (existingBlog.excerpt_en || '').trim()) {
        changes.push(`Excerpt / Teaser`)
      }
      if ((cover_image_url?.trim() || '') !== (existingBlog.cover_image_url || '').trim()) {
        changes.push(`Cover Image`)
      }
      const prevSections = Array.isArray(existingBlog.sections_en) ? existingBlog.sections_en : []
      const currSections = Array.isArray(sections_en) ? sections_en : []
      if (currSections.length !== prevSections.length || JSON.stringify(currSections) !== JSON.stringify(prevSections)) {
        changes.push(`Article Sections (${prevSections.length} -> ${currSections.length} sections)`)
      }
      const prevStats = Array.isArray(existingBlog.stat_box) ? existingBlog.stat_box : []
      const currStats = Array.isArray(stat_box) ? stat_box : []
      if (currStats.length !== prevStats.length || JSON.stringify(currStats) !== JSON.stringify(prevStats)) {
        changes.push(`Stat Boxes (${prevStats.length} -> ${currStats.length})`)
      }
      if ((quote_en?.trim() || '') !== (existingBlog.quote_en || '').trim()) {
        changes.push(`Pull Quote`)
      }

      let actionType: string = 'UPDATED_DETAILS'
      if (changes.some((c) => c.startsWith('Cover Image'))) {
        actionType = 'UPDATED_PHOTOS'
      }

      const summaryStr = changes.length > 0
        ? `Updated ${changes.join(', ')} for article "${title_en}"`
        : `Updated article contents for "${title_en}"`

      await logCmsActivity({
        entityType: 'BLOG',
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

    return NextResponse.json({ success: true, blog })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error saving blog article' }, { status: 500 })
  }
}

