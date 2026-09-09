'use client'

import React, { useState, useRef } from 'react'
import {
  X,
  Megaphone,
  Sparkles,
  Link as LinkIcon,
  Eye,
  Check,
  AlertCircle,
  Loader2,
  Globe,
  ArrowRight,
  Clock,
  Layers,
  UploadCloud,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import type { MarketingPopup } from '@/types/database'

interface Props {
  popup?: MarketingPopup | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function PopupEditorModal({ popup, isOpen, onClose, onSuccess }: Props) {
  const isEdit = !!popup
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewLang, setPreviewLang] = useState<'en' | 'ar'>('en')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<Partial<MarketingPopup>>({
    id: popup?.id || '',
    is_active: popup?.is_active ?? true,
    title_en: popup?.title_en || '',
    title_ar: popup?.title_ar || '',
    subtitle_en: popup?.subtitle_en || '',
    subtitle_ar: popup?.subtitle_ar || '',
    badge_en: popup?.badge_en || 'EXCLUSIVE PRE-LAUNCH',
    badge_ar: popup?.badge_ar || 'إطلاق حصري مبكر',
    image_url: popup?.image_url || '',
    target_url: popup?.target_url || '/new-launches/fairmont-residences-rua-al-madinah',
    cta_text_en: popup?.cta_text_en || 'Explore Priority Access',
    cta_text_ar: popup?.cta_text_ar || 'استكشف أولوية الحجز',
    sort_order: popup?.sort_order ?? 1,
    frequency: popup?.frequency || 'ONCE_PER_SESSION',
  })

  if (!isOpen) return null

  const handleTitleEnChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      title_en: val,
      id: !isEdit && !prev.id ? slugify(val) : prev.id,
    }))
  }

  // Handle direct image file upload to Cloudinary via internal API
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'asaheeb/popups')

      const res = await fetch('/api/upload/cloudinary', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to upload image')
      }

      if (data.url) {
        setForm((prev) => ({ ...prev, image_url: data.url }))
      }
    } catch (err: any) {
      setError(err.message || 'Image upload failed. You can also paste an image URL directly.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.id?.trim()) {
      setError('Campaign ID / Slug is required.')
      return
    }
    if (!form.title_en?.trim() || !form.title_ar?.trim()) {
      setError('Please provide title in both English and Arabic.')
      return
    }
    if (!form.image_url?.trim()) {
      setError('Please provide a banner image URL or upload an image.')
      return
    }
    if (!form.target_url?.trim()) {
      setError('Target URL is required.')
      return
    }

    setLoading(true)

    try {
      const payload = {
        ...form,
        original_id: popup?.id,
      }

      const res = await fetch('/api/marketing-popups/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save marketing popup')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.')
    } finally {
      setLoading(false)
    }
  }

  // Live preview data
  const currentBadge = previewLang === 'ar' ? (form.badge_ar || form.badge_en) : (form.badge_en || form.badge_ar)
  const currentTitle = previewLang === 'ar' ? (form.title_ar || form.title_en) : (form.title_en || form.title_ar)
  const currentSubtitle = previewLang === 'ar' ? (form.subtitle_ar || form.subtitle_en) : (form.subtitle_en || form.subtitle_ar)
  const currentCta = previewLang === 'ar' ? (form.cta_text_ar || form.cta_text_en) : (form.cta_text_en || form.cta_text_ar)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Megaphone size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {isEdit ? 'Edit Marketing Pop-up Ad' : 'Create New Marketing Pop-up Ad'}
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Manage full-screen website campaign pop-ups, promotional banners, and hero ads
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            style={{
              border: 'none',
              background: '#F1F5F9',
              color: '#64748B',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: '12px 24px',
              backgroundColor: '#FEF2F2',
              borderBottom: '1px solid #FCA5A5',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#B91C1C',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Body Split View */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left Form Panel */}
          <form
            onSubmit={handleSubmit}
            id="popup-form"
            style={{
              flex: '1 1 58%',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              borderRight: '1px solid #E2E8F0',
            }}
          >
            {/* Status & Priority Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                padding: '16px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  CAMPAIGN STATUS
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: '#16A34A', cursor: 'pointer' }}
                  />
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: form.is_active ? '#15803D' : '#64748B',
                    }}
                  >
                    {form.is_active ? '🟢 Active on Live Website' : '⚪ Inactive / Hidden'}
                  </span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  PRIORITY ORDER (SORT)
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={form.sort_order ?? 1}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: parseInt(e.target.value) || 1 }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748B' }}>1 = Highest display priority</span>
              </div>
            </div>

            {/* Campaign ID / Slug */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                UNIQUE CAMPAIGN SLUG / ID <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.id || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, id: slugify(e.target.value) }))}
                placeholder="e.g. fairmont-residences-rua-al-madinah-launch"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              />
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Unique system ID stored in session to prevent repeat popups.
              </span>
            </div>

            {/* English & Arabic Titles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  TITLE (ENGLISH) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title_en || ''}
                  onChange={(e) => handleTitleEnChange(e.target.value)}
                  placeholder="Fairmont Residences Rua Al Madinah"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textAlign: 'right' }}>
                  العنوان (عربي) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  dir="rtl"
                  value={form.title_ar || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, title_ar: e.target.value }))}
                  placeholder="فيرمونت ريزيدنسز رؤى المدينة"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontFamily: 'var(--font-arabic, inherit)',
                  }}
                />
              </div>
            </div>

            {/* English & Arabic Subtitles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  SUBTITLE / KEY USP (ENGLISH)
                </label>
                <textarea
                  rows={2}
                  value={form.subtitle_en || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, subtitle_en: e.target.value }))}
                  placeholder="Directly adjacent to The Prophet's Mosque • 120 Limited Luxury Branded Residences"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textAlign: 'right' }}>
                  الوصف المختصر (عربي)
                </label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={form.subtitle_ar || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, subtitle_ar: e.target.value }))}
                  placeholder="بجوار المسجد النبوي الشريف مباشرة • ١٢٠ وحدة سكنية فندقية فاخرة"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    resize: 'vertical',
                    fontFamily: 'var(--font-arabic, inherit)',
                  }}
                />
              </div>
            </div>

            {/* Badge Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  BADGE TEXT (ENGLISH)
                </label>
                <input
                  type="text"
                  value={form.badge_en || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, badge_en: e.target.value }))}
                  placeholder="EXCLUSIVE PRE-LAUNCH"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textAlign: 'right' }}>
                  شارة العرض (عربي)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={form.badge_ar || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, badge_ar: e.target.value }))}
                  placeholder="إطلاق حصري مبكر"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontFamily: 'var(--font-arabic, inherit)',
                  }}
                />
              </div>
            </div>

            {/* Banner Image URL & Direct Upload */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: 0 }}>
                  POP-UP BANNER IMAGE <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {uploadingImage ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                  <span>{uploadingImage ? 'Uploading...' : 'Upload New Image'}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              <input
                type="url"
                required
                value={form.image_url || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://res.cloudinary.com/diwqmlpr/image/upload/.../banner.jpg"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                }}
              />
              <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                Recommended resolution: 1200x800px or 16:9 / 4:3 high-resolution render.
              </span>
            </div>

            {/* Target URL & CTA Buttons */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                CLICK DESTINATION URL <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  required
                  value={form.target_url || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, target_url: e.target.value }))}
                  placeholder="/new-launches/fairmont-residences-rua-al-madinah"
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, target_url: '/new-launches/fairmont-residences-rua-al-madinah' }))}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Fairmont Launch
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, target_url: '/projects' }))}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  All Projects
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, target_url: '/contact' }))}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Contact Form
                </button>
              </div>
            </div>

            {/* CTA Button Text Bilingual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  BUTTON TEXT (ENGLISH)
                </label>
                <input
                  type="text"
                  value={form.cta_text_en || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, cta_text_en: e.target.value }))}
                  placeholder="Explore Priority Access"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textAlign: 'right' }}>
                  نص الزر (عربي)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={form.cta_text_ar || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, cta_text_ar: e.target.value }))}
                  placeholder="استكشف أولوية الحجز"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontFamily: 'var(--font-arabic, inherit)',
                  }}
                />
              </div>
            </div>

            {/* Display Frequency */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                DISPLAY FREQUENCY
              </label>
              <select
                value={form.frequency || 'ONCE_PER_SESSION'}
                onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ONCE_PER_SESSION">Once Per Session (Recommended — Never interrupts browsing)</option>
                <option value="ONCE_PER_DAY">Once Per Day (Daily prompt)</option>
                <option value="ALWAYS">Always on Every Page Load</option>
              </select>
            </div>
          </form>

          {/* Right Live Preview Panel */}
          <div
            style={{
              flex: '1 1 42%',
              backgroundColor: '#0F172A',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8', fontSize: '13px', fontWeight: 600 }}>
                <Eye size={16} />
                <span>Live Interactive Preview</span>
              </div>

              {/* Language Switcher */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#1E293B',
                  borderRadius: '6px',
                  padding: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setPreviewLang('en')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: previewLang === 'en' ? '#4F46E5' : 'transparent',
                    color: previewLang === 'en' ? '#FFFFFF' : '#94A3B8',
                  }}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLang('ar')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: previewLang === 'ar' ? '#4F46E5' : 'transparent',
                    color: previewLang === 'ar' ? '#FFFFFF' : '#94A3B8',
                  }}
                >
                  عربي
                </button>
              </div>
            </div>

            {/* Popup Card Simulation */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                dir={previewLang === 'ar' ? 'rtl' : 'ltr'}
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  backgroundColor: '#000000',
                  borderRadius: '16px',
                  border: '1px solid rgba(212, 175, 55, 0.35)',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 175, 55, 0.15)',
                  overflow: 'hidden',
                  position: 'relative',
                  fontFamily: previewLang === 'ar' ? 'var(--font-arabic, sans-serif)' : 'inherit',
                }}
              >
                {/* Fake Close Button */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    [previewLang === 'ar' ? 'left' : 'right']: '12px',
                    zIndex: 10,
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                >
                  ✕
                </div>

                {/* Banner Image Preview */}
                <div
                  style={{
                    width: '100%',
                    height: '180px',
                    position: 'relative',
                    backgroundColor: '#1E293B',
                    backgroundImage: form.image_url ? `url(${form.image_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '12px',
                  }}
                >
                  {/* Badge */}
                  {currentBadge && (
                    <div
                      style={{
                        backgroundColor: 'rgba(212, 175, 55, 0.95)',
                        color: '#000000',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      }}
                    >
                      {currentBadge}
                    </div>
                  )}

                  {!form.image_url && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748B',
                        fontSize: '12px',
                        gap: '6px',
                      }}
                    >
                      <Layers size={24} />
                      <span>No image provided</span>
                    </div>
                  )}
                </div>

                {/* Content Details */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      margin: 0,
                      lineHeight: 1.25,
                    }}
                  >
                    {currentTitle || 'Campaign Title'}
                  </h3>

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {currentSubtitle || 'Campaign subtitle or highlighted value proposition.'}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: '#C5A059',
                        color: '#000000',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{currentCta || 'Explore Priority Access'}</span>
                      <ArrowRight size={13} style={{ transform: previewLang === 'ar' ? 'rotate(180deg)' : 'none' }} />
                    </div>

                    <div
                      style={{
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#94A3B8',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'center',
                      }}
                    >
                      {previewLang === 'ar' ? 'إغلاق' : 'Dismiss'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#64748B', textAlign: 'center' }}>
              Pop-up will appear centered with darkened blur backdrop on visitor arrival.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="popup-form"
            disabled={loading || uploadingImage}
            style={{
              padding: '9px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#4F46E5',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>{isEdit ? 'Save Changes' : 'Publish Pop-up'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
