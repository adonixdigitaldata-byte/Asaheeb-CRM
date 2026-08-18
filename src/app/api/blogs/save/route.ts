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
      return NextResponse.json({ error: 'Only administrators can manage blog articles' }, { status: 403 })
    }

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

    const serviceClient = await createServiceClient()
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

    return NextResponse.json({ success: true, blog })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error saving blog article' }, { status: 500 })
  }
}
