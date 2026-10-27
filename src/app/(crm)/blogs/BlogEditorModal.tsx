'use client'

import React, { useState, useRef } from 'react'
import {
  X,
  FileText,
  Sparkles,
  BookOpen,
  Plus,
  Trash2,
  Quote,
  TrendingUp,
  Loader2,
  UploadCloud,
  Check,
  ShieldCheck,
  Search,
  Image as ImageIcon,
  Lock,
  CheckCircle2,
  AlertCircle,
  Link2,
} from 'lucide-react'
import type { Blog, BlogSection, BlogStatBox, SeoReviewStatus } from '@/types/database'
import CmsActivityTimeline from '@/components/CmsActivityTimeline'

interface Props {
  blog?: Blog | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type TabType = 'meta' | 'seo' | 'summary' | 'sections' | 'stats' | 'activity'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function BlogEditorModal({
  blog,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const isEdit = !!blog
  const [activeTab, setActiveTab] = useState<TabType>('meta')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit)

  const coverFileRef = useRef<HTMLInputElement>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [newKeywordEn, setNewKeywordEn] = useState('')
  const [newKeywordAr, setNewKeywordAr] = useState('')
  const [previewLang, setPreviewLang] = useState<'en' | 'ar'>('en')

  const [form, setForm] = useState<Partial<Blog>>({
    id: blog?.id || '',
    category: blog?.category || 'guide',
    category_en: blog?.category_en || 'Investment Guide',
    category_ar: blog?.category_ar || 'دليل الاستثمار',
    accent: blog?.accent || '#B8873B',
    date_en: blog?.date_en || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    date_ar: blog?.date_ar || '',
    read_time_en: blog?.read_time_en || '6 min read',
    read_time_ar: blog?.read_time_ar || '٦ دقائق قراءة',
    author_en: blog?.author_en || 'Asaheeb Research',
    author_ar: blog?.author_ar || 'فريق أبحاث أساهيب',
    title_en: blog?.title_en || '',
    title_ar: blog?.title_ar || '',
    excerpt_en: blog?.excerpt_en || '',
    excerpt_ar: blog?.excerpt_ar || '',
    summary_en: blog?.summary_en || [],
    summary_ar: blog?.summary_ar || [],
    sections_en: blog?.sections_en || [],
    sections_ar: blog?.sections_ar || [],
    stat_box: blog?.stat_box || [],
    quote_en: blog?.quote_en || '',
    quote_ar: blog?.quote_ar || '',
    cover_image_url: blog?.cover_image_url || '',
    // SEO & Media fields
    cover_image_alt_en: blog?.cover_image_alt_en || '',
    cover_image_alt_ar: blog?.cover_image_alt_ar || '',
    seo_title_en: blog?.seo_title_en || '',
    seo_title_ar: blog?.seo_title_ar || '',
    meta_description_en: blog?.meta_description_en || '',
    meta_description_ar: blog?.meta_description_ar || '',
    focus_keyword_en: blog?.focus_keyword_en || '',
    focus_keyword_ar: blog?.focus_keyword_ar || '',
    secondary_keywords_en: blog?.secondary_keywords_en || [],
    secondary_keywords_ar: blog?.secondary_keywords_ar || [],
    seo_review_status: blog?.seo_review_status || 'NEEDS_REVIEW',
    seo_reviewed_at: blog?.seo_reviewed_at || null,
    featured: blog ? blog.featured : false,
    is_published: blog ? blog.is_published : true,
    sort_order: blog?.sort_order || 0,
  })

  // Cover image upload via Cloudinary
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCover(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'asaheeb/blogs')

      const res = await fetch('/api/upload/cloudinary', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to upload cover image')
      }
      if (data.url) {
        setForm((prev) => ({ ...prev, cover_image_url: data.url }))
      }
    } catch (err: any) {
      setError(err.message || 'Cover image upload failed. You can also paste an image URL directly.')
    } finally {
      setUploadingCover(false)
      if (coverFileRef.current) coverFileRef.current.value = ''
    }
  }

  // Summary bullets temp input
  const [newSummaryEn, setNewSummaryEn] = useState('')
  const [newSummaryAr, setNewSummaryAr] = useState('')

  // New section temp input
  const [newSecHeadingEn, setNewSecHeadingEn] = useState('')
  const [newSecHeadingAr, setNewSecHeadingAr] = useState('')
  const [newSecBodyEn, setNewSecBodyEn] = useState('')
  const [newSecBodyAr, setNewSecBodyAr] = useState('')
  const [newSecHighlights, setNewSecHighlights] = useState('')

  // Section highlight temp input per section
  const [activeHighlightInputs, setActiveHighlightInputs] = useState<Record<number, string>>({})

  // New stat box temp input
  const [newStatVal, setNewStatVal] = useState('')
  const [newStatLabelEn, setNewStatLabelEn] = useState('')
  const [newStatLabelAr, setNewStatLabelAr] = useState('')

  if (!isOpen) return null

  function handleTitleEnChange(val: string) {
    const updates: Partial<Blog> = { title_en: val }
    if (!slugManuallyEdited && (!isEdit || !form.id)) {
      updates.id = slugify(val)
    }
    setForm((prev) => ({ ...prev, ...updates }))
  }

  function updateSummaryBullet(index: number, valEn: string, valAr: string) {
    const sumEn = [...(form.summary_en || [])]
    const sumAr = [...(form.summary_ar || [])]
    sumEn[index] = valEn
    sumAr[index] = valAr
    setForm({ ...form, summary_en: sumEn, summary_ar: sumAr })
  }

  function addSummaryBullet() {
    if (!newSummaryEn.trim() && !newSummaryAr.trim()) return
    setForm({
      ...form,
      summary_en: newSummaryEn.trim() ? [...(form.summary_en || []), newSummaryEn.trim()] : form.summary_en,
      summary_ar: newSummaryAr.trim() ? [...(form.summary_ar || []), newSummaryAr.trim()] : form.summary_ar,
    })
    setNewSummaryEn('')
    setNewSummaryAr('')
  }

  function removeSummaryBullet(index: number) {
    setForm({
      ...form,
      summary_en: (form.summary_en || []).filter((_, i) => i !== index),
      summary_ar: (form.summary_ar || []).filter((_, i) => i !== index),
    })
  }

  function addSection() {
    if (!newSecHeadingEn.trim() && !newSecHeadingAr.trim()) return
    const highlights = newSecHighlights
      .split('\n')
      .map((h) => h.trim())
      .filter(Boolean)

    const secEn: BlogSection = {
      heading: newSecHeadingEn.trim(),
      body: newSecBodyEn.trim(),
      highlights: highlights.length > 0 ? highlights : undefined,
    }
    const secAr: BlogSection = { heading: newSecHeadingAr.trim(), body: newSecBodyAr.trim() }

    setForm({
      ...form,
      sections_en: [...(form.sections_en || []), secEn],
      sections_ar: [...(form.sections_ar || []), secAr],
    })
    setNewSecHeadingEn('')
    setNewSecHeadingAr('')
    setNewSecBodyEn('')
    setNewSecBodyAr('')
    setNewSecHighlights('')
  }

  function removeSection(index: number) {
    setForm({
      ...form,
      sections_en: (form.sections_en || []).filter((_, i) => i !== index),
      sections_ar: (form.sections_ar || []).filter((_, i) => i !== index),
    })
  }

  function updateSection(index: number, field: 'headingEn' | 'headingAr' | 'bodyEn' | 'bodyAr', value: string) {
    const secEn = [...(form.sections_en || [])]
    const secAr = [...(form.sections_ar || [])]

    if (!secEn[index]) return
    if (!secAr[index]) secAr[index] = { heading: '', body: '' }

    if (field === 'headingEn') secEn[index] = { ...secEn[index], heading: value }
    if (field === 'bodyEn') secEn[index] = { ...secEn[index], body: value }
    if (field === 'headingAr') secAr[index] = { ...secAr[index], heading: value }
    if (field === 'bodyAr') secAr[index] = { ...secAr[index], body: value }

    setForm({ ...form, sections_en: secEn, sections_ar: secAr })
  }

  function addHighlightToSection(secIndex: number, text: string) {
    if (!text.trim()) return
    const sections = [...(form.sections_en || [])]
    if (!sections[secIndex]) return
    const currentHighlights = sections[secIndex].highlights || []
    sections[secIndex] = {
      ...sections[secIndex],
      highlights: [...currentHighlights, text.trim()],
    }
    setForm({ ...form, sections_en: sections })
    setActiveHighlightInputs((prev) => ({ ...prev, [secIndex]: '' }))
  }

  function removeHighlightFromSection(secIndex: number, hlIndex: number) {
    const sections = [...(form.sections_en || [])]
    if (!sections[secIndex]) return
    const currentHighlights = (sections[secIndex].highlights || []).filter((_, i) => i !== hlIndex)
    sections[secIndex] = {
      ...sections[secIndex],
      highlights: currentHighlights.length > 0 ? currentHighlights : undefined,
    }
    setForm({ ...form, sections_en: sections })
  }

  function updateHighlightInSection(secIndex: number, hlIndex: number, text: string) {
    const sections = [...(form.sections_en || [])]
    if (!sections[secIndex] || !sections[secIndex].highlights) return
    const highlights = [...sections[secIndex].highlights!]
    highlights[hlIndex] = text
    sections[secIndex] = { ...sections[secIndex], highlights }
    setForm({ ...form, sections_en: sections })
  }

  function addStatBox() {
    if (!newStatVal.trim()) return
    const stat: BlogStatBox = {
      val: newStatVal.trim(),
      labelEn: newStatLabelEn.trim(),
      labelAr: newStatLabelAr.trim(),
    }
    setForm({
      ...form,
      stat_box: [...(form.stat_box || []), stat],
    })
    setNewStatVal('')
    setNewStatLabelEn('')
    setNewStatLabelAr('')
  }

  function removeStatBox(index: number) {
    setForm({
      ...form,
      stat_box: (form.stat_box || []).filter((_, i) => i !== index),
    })
  }

  function updateStatBox(index: number, field: 'val' | 'labelEn' | 'labelAr', value: string) {
    const stats = [...(form.stat_box || [])]
    if (!stats[index]) return
    stats[index] = { ...stats[index], [field]: value }
    setForm({ ...form, stat_box: stats })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const missing: string[] = []
    if (!form.id?.trim()) missing.push('Article Slug / ID')
    if (!form.title_en?.trim()) missing.push('Article Title (English)')
    if (!form.title_ar?.trim()) missing.push('Article Title (Arabic)')

    if (missing.length > 0) {
      setError(`Missing required field(s): ${missing.join(', ')}. Please fill before saving.`)
      setActiveTab('meta')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/blogs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          original_id: blog?.id || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save blog article')
        setLoading(false)
        return
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Network error saving article.')
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 90 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '920px',
          width: '95vw',
          maxHeight: '90vh',
          borderRadius: '12px',
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 22px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} style={{ color: form.accent || 'var(--accent)' }} />
              <span>{isEdit ? `Edit Article: ${blog.title_en}` : 'Create New Real Estate Article'}</span>
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Publish bilingual market insights, investment guides, and analysis to your main website
            </p>
          </div>

          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 16px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('meta')}
            className={`btn btn-sm ${activeTab === 'meta' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <FileText size={14} />
            <span>1. Identity &amp; Media</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seo')}
            className={`btn btn-sm ${activeTab === 'seo' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              fontSize: '12.5px',
              padding: '5px 12px',
              position: 'relative',
              fontWeight: 700,
            }}
          >
            <Search size={14} style={{ color: activeTab === 'seo' ? '#FFFFFF' : '#D97706' }} />
            <span>2. SEO &amp; Google Preview</span>
            <span
              style={{
                fontSize: '9.5px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor:
                  form.seo_review_status === 'OPTIMIZED'
                    ? '#DCFCE7'
                    : form.seo_review_status === 'IN_PROGRESS'
                    ? '#DBEAFE'
                    : form.seo_review_status === 'NEEDS_UPDATE'
                    ? '#F3E8FF'
                    : '#FEF3C7',
                color:
                  form.seo_review_status === 'OPTIMIZED'
                    ? '#15803D'
                    : form.seo_review_status === 'IN_PROGRESS'
                    ? '#1D4ED8'
                    : form.seo_review_status === 'NEEDS_UPDATE'
                    ? '#7E22CE'
                    : '#B45309',
                fontWeight: 700,
              }}
            >
              {form.seo_review_status === 'OPTIMIZED' ? 'OPTIMIZED' : 'SEO'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`btn btn-sm ${activeTab === 'summary' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <Sparkles size={14} />
            <span>3. Excerpt &amp; Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`btn btn-sm ${activeTab === 'sections' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <BookOpen size={14} />
            <span>4. Article Sections ({(form.sections_en || []).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`btn btn-sm ${activeTab === 'stats' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <TrendingUp size={14} />
            <span>5. Stat Boxes &amp; Quotes</span>
          </button>

          {isEdit && (
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`btn btn-sm ${activeTab === 'activity' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                fontSize: '12.5px',
                padding: '5px 12px',
                color: activeTab === 'activity' ? '#FFFFFF' : '#2563EB',
                backgroundColor: activeTab === 'activity' ? undefined : '#EFF6FF',
              }}
            >
              <ShieldCheck size={14} />
              <span>6. Activity Log</span>
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto' }}>
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            {/* TAB 1: IDENTITY & MEDIA */}
            {activeTab === 'meta' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="form-label">Article Slug / URL Path *</label>
                      {isEdit ? (
                        <span style={{ fontSize: '11px', color: '#B45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Lock size={12} /> Slug Locked
                        </span>
                      ) : (
                        <span style={{ fontSize: '10.5px', color: '#16A34A', fontWeight: 600 }}>
                          Auto-generated
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      disabled={isEdit}
                      value={form.id}
                      onChange={(e) => {
                        setSlugManuallyEdited(true)
                        setForm({ ...form, id: e.target.value })
                      }}
                      placeholder="e.g. capital-appreciation-vs-rental-yield"
                      className="form-input"
                      style={isEdit ? { backgroundColor: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' } : {}}
                    />
                    {isEdit ? (
                      <span style={{ fontSize: '11px', color: '#B45309', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔒 Slug is locked for existing articles to protect Google search rankings and avoid 404 broken links.
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        Unique URL identifier (auto-generated from English title).
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => {
                        const cat = e.target.value
                        let catEn = 'Investment Guide'
                        let catAr = 'دليل الاستثمار'
                        let accent = '#B8873B'
                        if (cat === 'lifestyle') {
                          catEn = 'Lifestyle'
                          catAr = 'أسلوب الحياة'
                          accent = '#10B981'
                        } else if (cat === 'market') {
                          catEn = 'Market Insights'
                          catAr = 'رؤى السوق'
                          accent = '#3B82F6'
                        } else if (cat === 'legal') {
                          catEn = 'Legal & Regulations'
                          catAr = 'القوانين واللوائح'
                          accent = '#7C3AED'
                        }
                        setForm({ ...form, category: cat, category_en: catEn, category_ar: catAr, accent: form.accent || accent })
                      }}
                      className="form-select"
                    >
                      <option value="guide">Guide (Investment / Buying) - دليل الاستثمار</option>
                      <option value="lifestyle">Lifestyle - أسلوب الحياة</option>
                      <option value="market">Market Insights - رؤى السوق</option>
                      <option value="legal">Legal &amp; Regulations - القوانين واللوائح</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Article Title (English) *</label>
                    <input
                      type="text"
                      required
                      value={form.title_en}
                      onChange={(e) => handleTitleEnChange(e.target.value)}
                      placeholder="e.g. Capital Appreciation vs Rental Yield..."
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>عنوان المقال (بالعربية) *</label>
                    <input
                      type="text"
                      required
                      dir="rtl"
                      value={form.title_ar}
                      onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                      placeholder="مثال: نمو رأس المال مقابل عائد الإيجار..."
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Cover Image & Alt Text Accessibility Section */}
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon size={16} style={{ color: form.accent || '#B8873B' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Cover Image &amp; Alt Text (Google Image SEO)</span>
                    </div>
                    {form.cover_image_url && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, cover_image_url: '' })}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#EF4444', fontSize: '11.5px', padding: '2px 8px' }}
                      >
                        <Trash2 size={12} />
                        <span>Remove Image</span>
                      </button>
                    )}
                  </div>

                  {/* Image Preview if available */}
                  {form.cover_image_url ? (
                    <div style={{ position: 'relative', width: '100%', height: '170px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #CBD5E1', backgroundColor: '#0F172A' }}>
                      <img
                        src={form.cover_image_url}
                        alt={form.cover_image_alt_en || form.title_en || 'Article cover'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.75)', color: '#FFFFFF', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Alt: {form.cover_image_alt_en || 'Default fallback to title'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '18px', border: '2px dashed #CBD5E1', borderRadius: '6px', textAlign: 'center', backgroundColor: '#FFFFFF' }}>
                      <UploadCloud size={24} style={{ color: '#94A3B8', margin: '0 auto 6px' }} />
                      <div style={{ fontSize: '12px', color: '#64748B' }}>No cover image set yet. Upload a high-resolution banner image or paste an image URL.</div>
                    </div>
                  )}

                  {/* Upload controls */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="file"
                      ref={coverFileRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleCoverUpload}
                    />
                    <button
                      type="button"
                      disabled={uploadingCover}
                      onClick={() => coverFileRef.current?.click()}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', whiteSpace: 'nowrap' }}
                    >
                      {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      <span>{uploadingCover ? 'Uploading...' : 'Upload Image'}</span>
                    </button>

                    <input
                      type="url"
                      value={form.cover_image_url || ''}
                      onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                      placeholder="Or paste direct image URL (Cloudinary, CDN)..."
                      className="form-input"
                      style={{ fontSize: '12px', height: '36px' }}
                    />
                  </div>

                  {/* Alt Text Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11.5px', color: '#475569' }}>
                        Image Alt Text (English) <span style={{ color: '#94A3B8', fontWeight: 400 }}>— Screen readers &amp; Google Images</span>
                      </label>
                      <input
                        type="text"
                        value={form.cover_image_alt_en || ''}
                        onChange={(e) => setForm({ ...form, cover_image_alt_en: e.target.value })}
                        placeholder={form.title_en || "Descriptive caption for Google Images"}
                        className="form-input"
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11.5px', textAlign: 'right', color: '#475569' }}>
                        النص البديل للصورة (بالعربية) <span style={{ color: '#94A3B8', fontWeight: 400 }}>— لمحركات البحث وقارئات الشاشة</span>
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={form.cover_image_alt_ar || ''}
                        onChange={(e) => setForm({ ...form, cover_image_alt_ar: e.target.value })}
                        placeholder={form.title_ar || "وصف مختصر للصورة لمحركات البحث"}
                        className="form-input"
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Accent Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        value={form.accent || '#B8873B'}
                        onChange={(e) => setForm({ ...form, accent: e.target.value })}
                        style={{ width: '38px', height: '36px', padding: 0, border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                      />
                      <input
                        type="text"
                        value={form.accent || '#B8873B'}
                        onChange={(e) => setForm({ ...form, accent: e.target.value })}
                        className="form-input"
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Read Time (EN)</label>
                    <input
                      type="text"
                      value={form.read_time_en || ''}
                      onChange={(e) => setForm({ ...form, read_time_en: e.target.value })}
                      placeholder="e.g. 6 min read"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Publication Date (EN)</label>
                    <input
                      type="text"
                      value={form.date_en || ''}
                      onChange={(e) => setForm({ ...form, date_en: e.target.value })}
                      placeholder="e.g. August 14, 2026"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Author (EN)</label>
                    <input
                      type="text"
                      value={form.author_en || ''}
                      onChange={(e) => setForm({ ...form, author_en: e.target.value })}
                      placeholder="e.g. Asaheeb Advisory"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.is_published}
                      onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: form.is_published ? '#16A34A' : '#64748B' }}>
                      {form.is_published ? 'Published (Live on Website)' : 'Draft / Unpublished'}
                    </span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: form.featured ? '#D97706' : '#64748B' }}>
                      Featured Article (Top Hero Placement)
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: SEO & GOOGLE PREVIEW */}
            {activeTab === 'seo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* SEO Review Status Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={18} style={{ color: '#F59E0B' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Search Engine Optimization (SEO) Center</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {form.seo_reviewed_at
                          ? `Last certified SEO audit: ${new Date(form.seo_reviewed_at).toLocaleDateString()}`
                          : 'Configure search engine metadata, focus keywords, and preview snippets'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: 600 }}>SEO Review Status:</label>
                    <select
                      value={form.seo_review_status || 'NEEDS_REVIEW'}
                      onChange={(e) => {
                        const nextStatus = e.target.value as SeoReviewStatus
                        setForm({
                          ...form,
                          seo_review_status: nextStatus,
                          seo_reviewed_at: nextStatus === 'OPTIMIZED' ? new Date().toISOString() : form.seo_reviewed_at,
                        })
                      }}
                      className="form-select"
                      style={{
                        fontSize: '12px',
                        padding: '5px 10px',
                        height: '32px',
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                        color:
                          form.seo_review_status === 'OPTIMIZED'
                            ? '#34D399'
                            : form.seo_review_status === 'IN_PROGRESS'
                            ? '#60A5FA'
                            : form.seo_review_status === 'NEEDS_UPDATE'
                            ? '#C084FC'
                            : '#FBBF24',
                        fontWeight: 700,
                      }}
                    >
                      <option value="NEEDS_REVIEW">Needs Review (يحتاج مراجعة)</option>
                      <option value="IN_PROGRESS">In Progress (قيد العمل)</option>
                      <option value="OPTIMIZED">Optimized (معتمد ومُحسن)</option>
                      <option value="NEEDS_UPDATE">Needs Update (بحاجة لتحديث)</option>
                    </select>
                  </div>
                </div>

                {/* Google Search Live Snippet Preview */}
                <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '16px', backgroundColor: '#FFFFFF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Google Search Snippet Simulator
                      </span>
                      <span style={{ fontSize: '10px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        Live
                      </span>
                    </div>

                    {/* Language Preview Switcher */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setPreviewLang('en')}
                        className={`btn btn-sm ${previewLang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                      >
                        English Snippet
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewLang('ar')}
                        className={`btn btn-sm ${previewLang === 'ar' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                      >
                        معاينة بالعربية
                      </button>
                    </div>
                  </div>

                  {/* The Google Card */}
                  <div
                    dir={previewLang === 'ar' ? 'rtl' : 'ltr'}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      fontFamily: 'arial, sans-serif',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#202124' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#B8873B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: '11px' }}>
                        A
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#202124', fontWeight: 500 }}>
                          {previewLang === 'ar' ? 'أساهيب العقارية' : 'Asaheeb Real Estate'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#4d5156', lineHeight: 1.2 }}>
                          https://www.asaheebrealestate.com › blog › {form.id || 'article-slug'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '6px' }}>
                      <div style={{ fontSize: '18px', color: '#1a0dab', fontWeight: 400, textDecoration: 'none', lineHeight: 1.3, cursor: 'pointer' }}>
                        {previewLang === 'ar'
                          ? `${form.seo_title_ar || form.title_ar || 'عنوان المقال'} | أساهيب العقارية`
                          : `${form.seo_title_en || form.title_en || 'Article Title'} | Asaheeb Real Estate`}
                      </div>
                      <div style={{ fontSize: '13px', color: '#4d5156', marginTop: '4px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {previewLang === 'ar'
                          ? (form.meta_description_ar || form.excerpt_ar || 'ملخص المقال سيظهر هنا في محرك بحث جوجل للإجابة المباشرة عن استفسار الباحث...')
                          : (form.meta_description_en || form.excerpt_en || 'Article meta description will appear here as the Google snippet description answering the search query directly...')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time SEO Readiness Checklist */}
                <div style={{ padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} style={{ color: '#10B981' }} />
                    <span>Editorial SEO Readiness Checklist</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: (form.seo_title_en?.length || 0) > 0 && (form.seo_title_en?.length || 0) <= 65 ? '#15803D' : '#D97706' }}>
                      <span>{(form.seo_title_en?.length || 0) > 0 && (form.seo_title_en?.length || 0) <= 65 ? '✓' : '○'}</span>
                      <span>SEO Title Tag ({form.seo_title_en?.length || 0}/60 chars)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: (form.meta_description_en?.length || 0) >= 80 && (form.meta_description_en?.length || 0) <= 165 ? '#15803D' : '#D97706' }}>
                      <span>{(form.meta_description_en?.length || 0) >= 80 && (form.meta_description_en?.length || 0) <= 165 ? '✓' : '○'}</span>
                      <span>Meta Description ({form.meta_description_en?.length || 0}/160 chars)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: form.focus_keyword_en?.trim() ? '#15803D' : '#94A3B8' }}>
                      <span>{form.focus_keyword_en?.trim() ? '✓' : '○'}</span>
                      <span>Focus Keyword Defined</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: form.cover_image_url ? '#15803D' : '#94A3B8' }}>
                      <span>{form.cover_image_url ? '✓' : '○'}</span>
                      <span>Cover Image Provided</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: form.cover_image_alt_en?.trim() ? '#15803D' : '#94A3B8' }}>
                      <span>{form.cover_image_alt_en?.trim() ? '✓' : '○'}</span>
                      <span>Image Alt Text Provided</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: JSON.stringify(form.sections_en || []).includes('[') ? '#15803D' : '#94A3B8' }}>
                      <span>{JSON.stringify(form.sections_en || []).includes('[') ? '✓' : '○'}</span>
                      <span>Internal Links in Content</span>
                    </div>
                  </div>
                </div>

                {/* Bilingual Controls Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                  {/* English SEO Controls */}
                  <div style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🇬🇧</span>
                        <span>English Search Settings</span>
                      </h4>
                      <span style={{ fontSize: '10px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        Google EN
                      </span>
                    </div>

                    {/* SEO Title EN */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <label className="form-label" style={{ fontSize: '11.5px', margin: 0 }}>SEO Title Tag</label>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: (form.seo_title_en?.length || 0) > 60 ? '#D97706' : '#64748B' }}>
                          {form.seo_title_en?.length || 0} / 60 chars
                        </span>
                      </div>
                      <input
                        type="text"
                        value={form.seo_title_en || ''}
                        onChange={(e) => setForm({ ...form, seo_title_en: e.target.value })}
                        placeholder={form.title_en || "Custom title displayed on Google search results"}
                        className="form-input"
                        style={{ fontSize: '12.5px' }}
                      />
                      <span style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                        Overrides H1 title in Google snippet. Recommended: 50–60 characters.
                      </span>
                    </div>

                    {/* Meta Description EN */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <label className="form-label" style={{ fontSize: '11.5px', margin: 0 }}>Meta Description</label>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: (form.meta_description_en?.length || 0) > 160 ? '#D97706' : '#64748B' }}>
                          {form.meta_description_en?.length || 0} / 160 chars
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={form.meta_description_en || ''}
                        onChange={(e) => setForm({ ...form, meta_description_en: e.target.value })}
                        placeholder={form.excerpt_en || "Concise answer answering searcher intent..."}
                        className="form-textarea"
                        style={{ fontSize: '12.5px', lineHeight: 1.4 }}
                      />
                      <span style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                        Snippet description on Google results. Recommended: 120–160 characters.
                      </span>
                    </div>

                    {/* Focus Keyword EN */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11.5px' }}>Primary Focus Keyword</label>
                      <input
                        type="text"
                        value={form.focus_keyword_en || ''}
                        onChange={(e) => setForm({ ...form, focus_keyword_en: e.target.value })}
                        placeholder="e.g. Can a non-Saudi without an Iqama buy property in Saudi Arabia"
                        className="form-input"
                        style={{ fontSize: '12.5px' }}
                      />
                    </div>

                    {/* Secondary Keywords EN */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11.5px' }}>
                        Secondary Supporting Keywords ({(form.secondary_keywords_en || []).length})
                      </label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                        <input
                          type="text"
                          value={newKeywordEn}
                          onChange={(e) => setNewKeywordEn(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (newKeywordEn.trim()) {
                                setForm({
                                  ...form,
                                  secondary_keywords_en: [...(form.secondary_keywords_en || []), newKeywordEn.trim()]
                                })
                                setNewKeywordEn('')
                              }
                            }
                          }}
                          placeholder="Type keyword and click Add..."
                          className="form-input"
                          style={{ fontSize: '12px', height: '32px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newKeywordEn.trim()) {
                              setForm({
                                ...form,
                                secondary_keywords_en: [...(form.secondary_keywords_en || []), newKeywordEn.trim()]
                              })
                              setNewKeywordEn('')
                            }
                          }}
                          className="btn btn-outline btn-sm"
                          style={{ height: '32px' }}
                        >
                          Add
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(form.secondary_keywords_en || []).map((kw, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid #BFDBFE'
                            }}
                          >
                            <span>{kw}</span>
                            <X
                              size={11}
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  secondary_keywords_en: (form.secondary_keywords_en || []).filter((_, idx) => idx !== i)
                                })
                              }
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Arabic SEO Controls */}
                  <div dir="rtl" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🇸🇦</span>
                        <span>إعدادات البحث لمحرك جوجل (بالعربية)</span>
                      </h4>
                      <span style={{ fontSize: '10px', backgroundColor: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        Google AR
                      </span>
                    </div>

                    {/* SEO Title AR */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <label className="form-label" style={{ fontSize: '11.5px', margin: 0, textAlign: 'right' }}>عنوان السيو (SEO Title)</label>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: (form.seo_title_ar?.length || 0) > 60 ? '#D97706' : '#64748B' }}>
                          {form.seo_title_ar?.length || 0} / 60 حرف
                        </span>
                      </div>
                      <input
                        type="text"
                        dir="rtl"
                        value={form.seo_title_ar || ''}
                        onChange={(e) => setForm({ ...form, seo_title_ar: e.target.value })}
                        placeholder={form.title_ar || "عنوان المقال المخصص للظهور في نتائج البحث"}
                        className="form-input"
                        style={{ fontSize: '12.5px' }}
                      />
                      <span style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px', textAlign: 'right', display: 'block' }}>
                        يستبدل العنوان الرئيسي في نتائج جوجل. المثالي: 50–60 حرف.
                      </span>
                    </div>

                    {/* Meta Description AR */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <label className="form-label" style={{ fontSize: '11.5px', margin: 0, textAlign: 'right' }}>وصف الميتا (Meta Description)</label>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: (form.meta_description_ar?.length || 0) > 160 ? '#D97706' : '#64748B' }}>
                          {form.meta_description_ar?.length || 0} / 160 حرف
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        dir="rtl"
                        value={form.meta_description_ar || ''}
                        onChange={(e) => setForm({ ...form, meta_description_ar: e.target.value })}
                        placeholder={form.excerpt_ar || "وصف مختصر يجيب عن تساؤل الباحث في جوجل..."}
                        className="form-textarea"
                        style={{ fontSize: '12.5px', lineHeight: 1.4 }}
                      />
                      <span style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px', textAlign: 'right', display: 'block' }}>
                        الوصف المعروض تحت الرابط في جوجل. المثالي: 120–160 حرف.
                      </span>
                    </div>

                    {/* Focus Keyword AR */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11.5px', textAlign: 'right' }}>الكلمة المفتاحية المستهدفة</label>
                      <input
                        type="text"
                        dir="rtl"
                        value={form.focus_keyword_ar || ''}
                        onChange={(e) => setForm({ ...form, focus_keyword_ar: e.target.value })}
                        placeholder="مثال: شروط تملك غير السعوديين للعقار بدون إقامة"
                        className="form-input"
                        style={{ fontSize: '12.5px' }}
                      />
                    </div>

                    {/* Secondary Keywords AR */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11.5px', textAlign: 'right' }}>
                        الكلمات المفتاحية الثانوية ({(form.secondary_keywords_ar || []).length})
                      </label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                        <input
                          type="text"
                          dir="rtl"
                          value={newKeywordAr}
                          onChange={(e) => setNewKeywordAr(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (newKeywordAr.trim()) {
                                setForm({
                                  ...form,
                                  secondary_keywords_ar: [...(form.secondary_keywords_ar || []), newKeywordAr.trim()]
                                })
                                setNewKeywordAr('')
                              }
                            }
                          }}
                          placeholder="اكتب الكلمة واضغط إضافة..."
                          className="form-input"
                          style={{ fontSize: '12px', height: '32px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newKeywordAr.trim()) {
                              setForm({
                                ...form,
                                secondary_keywords_ar: [...(form.secondary_keywords_ar || []), newKeywordAr.trim()]
                              })
                              setNewKeywordAr('')
                            }
                          }}
                          className="btn btn-outline btn-sm"
                          style={{ height: '32px' }}
                        >
                          إضافة
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(form.secondary_keywords_ar || []).map((kw, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid #FDE68A'
                            }}
                          >
                            <span>{kw}</span>
                            <X
                              size={11}
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  secondary_keywords_ar: (form.secondary_keywords_ar || []).filter((_, idx) => idx !== i)
                                })
                              }
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EXCERPT & SUMMARY BULLETS */}
            {activeTab === 'summary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Article Excerpt / Card Description (English)</label>
                  <textarea
                    rows={3}
                    value={form.excerpt_en || ''}
                    onChange={(e) => setForm({ ...form, excerpt_en: e.target.value })}
                    placeholder="Short summary displayed on article listing cards..."
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ textAlign: 'right' }}>موجز المقال (بالعربية)</label>
                  <textarea
                    rows={3}
                    dir="rtl"
                    value={form.excerpt_ar || ''}
                    onChange={(e) => setForm({ ...form, excerpt_ar: e.target.value })}
                    placeholder="موجز قصير يظهر في بطاقات قائمة المقالات..."
                    className="form-textarea"
                  />
                </div>

                {/* Executive Summary Bullets Builder */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <label className="form-label" style={{ marginBottom: '8px' }}>
                    Executive Summary Bullets ({(form.summary_en || []).length} items)
                  </label>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Key takeaway (EN)"
                      value={newSummaryEn}
                      onChange={(e) => setNewSummaryEn(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="الخلاصة التنفيذية (AR)"
                      value={newSummaryAr}
                      onChange={(e) => setNewSummaryAr(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={addSummaryBullet}
                      className="btn btn-outline btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(form.summary_en || []).map((sumEn, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr auto',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '6px 10px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                        }}
                      >
                        <input
                          type="text"
                          value={sumEn}
                          onChange={(e) => updateSummaryBullet(idx, e.target.value, form.summary_ar?.[idx] || '')}
                          className="form-input"
                          style={{ fontSize: '12.5px', height: '32px' }}
                          placeholder="Key takeaway (EN)"
                        />
                        <input
                          type="text"
                          dir="rtl"
                          value={form.summary_ar?.[idx] || ''}
                          onChange={(e) => updateSummaryBullet(idx, sumEn, e.target.value)}
                          className="form-input"
                          style={{ fontSize: '12.5px', height: '32px' }}
                          placeholder="الخلاصة التنفيذية (AR)"
                        />
                        <button
                          type="button"
                          onClick={() => removeSummaryBullet(idx)}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: '#EF4444', padding: '4px' }}
                          title="Delete bullet"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ARTICLE SECTIONS BUILDER (FULLY EDITABLE) */}
            {activeTab === 'sections' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Existing Sections */}
                {(form.sections_en || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(form.sections_en || []).map((secEn, idx) => {
                      const secAr = form.sections_ar?.[idx]
                      const highlights = secEn.highlights || []
                      const currentInputVal = activeHighlightInputs[idx] || ''

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '16px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* Header bar */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Section #{idx + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSection(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#EF4444', padding: '3px' }}
                              title="Delete this section"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Editable Headings */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                                Section Heading (English)
                              </label>
                              <input
                                type="text"
                                value={secEn.heading}
                                onChange={(e) => updateSection(idx, 'headingEn', e.target.value)}
                                className="form-input"
                                style={{ fontSize: '13px', fontWeight: 700 }}
                                placeholder="Section Heading (English)"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px', textAlign: 'right' }}>
                                عنوان القسم (بالعربية)
                              </label>
                              <input
                                type="text"
                                dir="rtl"
                                value={secAr?.heading || ''}
                                onChange={(e) => updateSection(idx, 'headingAr', e.target.value)}
                                className="form-input"
                                style={{ fontSize: '13px', fontWeight: 700 }}
                                placeholder="عنوان القسم (بالعربية)"
                              />
                            </div>
                          </div>

                          {/* Editable Body Text */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                                Body Text (English)
                              </label>
                              <textarea
                                rows={3}
                                value={secEn.body}
                                onChange={(e) => updateSection(idx, 'bodyEn', e.target.value)}
                                className="form-textarea"
                                style={{ fontSize: '12.5px', lineHeight: 1.5 }}
                                placeholder="Body text (English)..."
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px', textAlign: 'right' }}>
                                محتوى القسم (بالعربية)
                              </label>
                              <textarea
                                rows={3}
                                dir="rtl"
                                value={secAr?.body || ''}
                                onChange={(e) => updateSection(idx, 'bodyAr', e.target.value)}
                                className="form-textarea"
                                style={{ fontSize: '12.5px', lineHeight: 1.5 }}
                                placeholder="محتوى القسم (بالعربية)..."
                              />
                            </div>
                          </div>

                          {/* Contextual Internal Link Helper Bar */}
                          <div style={{ padding: '8px 12px', backgroundColor: '#EFF6FF', borderRadius: '6px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#1E40AF', fontWeight: 600 }}>
                              <Link2 size={13} />
                              <span>Internal Link Shortcuts (SEO):</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const link = ` [Can foreigners buy property in Saudi Arabia without an Iqama?](/blog/can-foreigners-buy-property-in-saudi-arabia-2026)`
                                  updateSection(idx, 'bodyEn', (secEn.body || '') + link)
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', padding: '2px 8px', height: '24px', backgroundColor: '#FFFFFF', border: '1px solid #93C5FD', color: '#1D4ED8' }}
                                title="Insert link to Foreign Ownership Pillar Guide in English body"
                              >
                                + Foreign Ownership (EN)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const link = ` [شروط تملك غير السعوديين للعقار بدون إقامة](/blog/can-foreigners-buy-property-in-saudi-arabia-2026)`
                                  updateSection(idx, 'bodyAr', (secAr?.body || '') + link)
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', padding: '2px 8px', height: '24px', backgroundColor: '#FFFFFF', border: '1px solid #93C5FD', color: '#1D4ED8' }}
                                title="Insert link to Foreign Ownership Pillar Guide in Arabic body"
                              >
                                + تملك الأجانب (AR)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const link = ` [Explore Asaheeb Exclusive Properties](/properties)`
                                  updateSection(idx, 'bodyEn', (secEn.body || '') + link)
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', padding: '2px 8px', height: '24px', backgroundColor: '#FFFFFF', border: '1px solid #93C5FD', color: '#1D4ED8' }}
                                title="Insert link to Properties catalog"
                              >
                                + Properties
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const link = ` [Contact Asaheeb Advisory](/contact)`
                                  updateSection(idx, 'bodyEn', (secEn.body || '') + link)
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', padding: '2px 8px', height: '24px', backgroundColor: '#FFFFFF', border: '1px solid #93C5FD', color: '#1D4ED8' }}
                                title="Insert link to Contact Advisory"
                              >
                                + Contact
                              </button>
                            </div>
                          </div>

                          {/* Section Highlights / Key Bullets Callout Box */}
                          <div
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>◈ Section Key Highlights ({highlights.length})</span>
                            </div>

                            {/* Render & Edit Highlights */}
                            {highlights.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {highlights.map((hl, hIdx) => (
                                  <div
                                    key={hIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      backgroundColor: '#FFFBEB',
                                      border: '1px solid #FDE68A',
                                      borderRadius: '4px',
                                      padding: '3px 8px',
                                    }}
                                  >
                                    <span style={{ color: '#D97706', fontWeight: 700, fontSize: '12px' }}>◈</span>
                                    <input
                                      type="text"
                                      value={hl}
                                      onChange={(e) => updateHighlightInSection(idx, hIdx, e.target.value)}
                                      className="form-input"
                                      style={{
                                        fontSize: '12px',
                                        height: '28px',
                                        backgroundColor: '#FFFFFF',
                                        flex: 1,
                                        borderColor: '#FDE68A',
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeHighlightFromSection(idx, hIdx)}
                                      className="btn btn-ghost btn-icon btn-sm"
                                      style={{ padding: '2px', color: '#EF4444', height: '24px', width: '24px' }}
                                      title="Remove this bullet"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                                No sectional highlights added yet. Add one below:
                              </span>
                            )}

                            {/* Add Highlight to Existing Section */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                              <input
                                type="text"
                                placeholder="Add key takeaway highlight bullet (◈)..."
                                value={currentInputVal}
                                onChange={(e) =>
                                  setActiveHighlightInputs((prev) => ({
                                    ...prev,
                                    [idx]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    addHighlightToSection(idx, currentInputVal)
                                  }
                                }}
                                className="form-input"
                                style={{ fontSize: '11.5px', height: '28px', flex: 1 }}
                              />
                              <button
                                type="button"
                                onClick={() => addHighlightToSection(idx, currentInputVal)}
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: '11px', height: '28px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Plus size={12} />
                                <span>Add Bullet</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add New Section Card */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    + Add Article Section
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Section Heading (English)"
                      value={newSecHeadingEn}
                      onChange={(e) => setNewSecHeadingEn(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="عنوان القسم (بالعربية)"
                      value={newSecHeadingAr}
                      onChange={(e) => setNewSecHeadingAr(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <textarea
                      rows={3}
                      placeholder="Section body text (English)..."
                      value={newSecBodyEn}
                      onChange={(e) => setNewSecBodyEn(e.target.value)}
                      className="form-textarea"
                    />
                    <textarea
                      rows={3}
                      dir="rtl"
                      placeholder="محتوى القسم (بالعربية)..."
                      value={newSecBodyAr}
                      onChange={(e) => setNewSecBodyAr(e.target.value)}
                      className="form-textarea"
                    />
                  </div>

                  {/* Section Highlights for New Section */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11.5px', color: '#B45309', fontWeight: 600 }}>
                      ◈ Key Takeaway Highlights (Optional — Enter one bullet point per line)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Riyadh North Corridors: Prime areas for commercial expansion&#10;Vision 2030 Giga-Projects: Exponential growth"
                      value={newSecHighlights}
                      onChange={(e) => setNewSecHighlights(e.target.value)}
                      className="form-textarea"
                      style={{ fontSize: '12px', backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addSection}
                    className="btn btn-outline btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <Plus size={14} />
                    <span>Append Section</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: STAT BOXES & QUOTES (FULLY EDITABLE) */}
            {activeTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Stat Boxes Manager */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                    Key Metric Stat Boxes ({(form.stat_box || []).length})
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr auto', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Value (e.g. 12–16%)"
                      value={newStatVal}
                      onChange={(e) => setNewStatVal(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Label (EN) e.g. Villa Appreciation"
                      value={newStatLabelEn}
                      onChange={(e) => setNewStatLabelEn(e.target.value)}
                      className="form-input"
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="التسمية (AR) مثال: نمو الفلل"
                      value={newStatLabelAr}
                      onChange={(e) => setNewStatLabelAr(e.target.value)}
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={addStatBox}
                      className="btn btn-outline btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(form.stat_box || []).map((st, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '120px 1fr 1fr auto',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '6px 10px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                        }}
                      >
                        <input
                          type="text"
                          value={st.val}
                          onChange={(e) => updateStatBox(idx, 'val', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '13px', fontWeight: 800, color: '#10B981', height: '32px' }}
                          placeholder="Value (e.g. 8.5–11%)"
                        />
                        <input
                          type="text"
                          value={st.labelEn}
                          onChange={(e) => updateStatBox(idx, 'labelEn', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '12.5px', height: '32px' }}
                          placeholder="Label (EN)"
                        />
                        <input
                          type="text"
                          dir="rtl"
                          value={st.labelAr}
                          onChange={(e) => updateStatBox(idx, 'labelAr', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '12.5px', height: '32px' }}
                          placeholder="التسمية (AR)"
                        />
                        <button
                          type="button"
                          onClick={() => removeStatBox(idx)}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: '#EF4444', padding: '4px' }}
                          title="Delete Stat Box"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pull Quote */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <Quote size={15} style={{ color: form.accent || '#B8873B' }} />
                    <span>Pull Quote Callout</span>
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Quote (English)</label>
                      <textarea
                        rows={3}
                        value={form.quote_en || ''}
                        onChange={(e) => setForm({ ...form, quote_en: e.target.value })}
                        placeholder="Inspiring key quote or expert insight..."
                        className="form-textarea"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ textAlign: 'right' }}>الاقتباس (بالعربية)</label>
                      <textarea
                        rows={3}
                        dir="rtl"
                        value={form.quote_ar || ''}
                        onChange={(e) => setForm({ ...form, quote_ar: e.target.value })}
                        placeholder="اقتباس رئيسي أو مقولة خبير..."
                        className="form-textarea"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ACTIVITY LOG */}
            {activeTab === 'activity' && blog && (
              <CmsActivityTimeline
                entityType="BLOG"
                entityId={blog.id}
                entityTitle={blog.title_en}
              />
            )}
          </div>

          {/* Footer Actions */}
          <div className="modal-footer" style={{ padding: '14px 24px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{loading ? 'Saving Article...' : isEdit ? 'Save Changes' : 'Publish Article'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
