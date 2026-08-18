'use client'

import React, { useState } from 'react'
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
} from 'lucide-react'
import type { Blog, BlogSection, BlogStatBox } from '@/types/database'

interface Props {
  blog?: Blog | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type TabType = 'meta' | 'summary' | 'sections' | 'stats'

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
    featured: blog ? blog.featured : false,
    is_published: blog ? blog.is_published : true,
    sort_order: blog?.sort_order || 0,
  })

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
            <span>1. Identity &amp; Titles</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`btn btn-sm ${activeTab === 'summary' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <Sparkles size={14} />
            <span>2. Excerpt &amp; Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`btn btn-sm ${activeTab === 'sections' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <BookOpen size={14} />
            <span>3. Article Sections ({(form.sections_en || []).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`btn btn-sm ${activeTab === 'stats' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <TrendingUp size={14} />
            <span>4. Stat Boxes &amp; Quotes</span>
          </button>
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

            {/* TAB 1: IDENTITY & TITLES */}
            {activeTab === 'meta' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="form-label">Article Slug / ID *</label>
                      {isEdit && (
                        <span style={{ fontSize: '10.5px', color: '#6366F1', fontWeight: 600 }}>
                          ✏️ Editable Slug
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={form.id}
                      onChange={(e) => {
                        setSlugManuallyEdited(true)
                        setForm({ ...form, id: e.target.value })
                      }}
                      placeholder="e.g. capital-appreciation-vs-rental-yield"
                      className="form-input"
                    />
                    <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                      Unique URL identifier (auto-generated from English title).
                    </span>
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
