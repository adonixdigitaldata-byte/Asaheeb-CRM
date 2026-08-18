'use client'

import React, { useState } from 'react'
import {
  X,
  Building,
  MapPin,
  DollarSign,
  FileText,
  Video,
  FileDown,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Check,
  Pencil,
} from 'lucide-react'
import type { Project, ProjectImage, Landmark, Amenity } from '@/types/database'
import ImageGalleryManager from '@/components/ImageGalleryManager'

interface Props {
  project?: Project | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type TabType = 'basic' | 'specs' | 'content' | 'amenities' | 'brochure' | 'gallery'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function ProjectEditorModal({
  project,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const isEdit = !!project
  const [activeTab, setActiveTab] = useState<TabType>('basic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit)

  const [form, setForm] = useState<Partial<Project>>({
    id: project?.id || '',
    name_en: project?.name_en || '',
    name_ar: project?.name_ar || '',
    developer_en: project?.developer_en || '',
    developer_ar: project?.developer_ar || '',
    city_en: project?.city_en || 'Riyadh',
    city_ar: project?.city_ar || 'الرياض',
    district_en: project?.district_en || '',
    district_ar: project?.district_ar || '',
    starting_price_en: project?.starting_price_en || '',
    starting_price_ar: project?.starting_price_ar || '',
    price_range_en: project?.price_range_en || '',
    price_range_ar: project?.price_range_ar || '',
    size_en: project?.size_en || '',
    size_ar: project?.size_ar || '',
    type_en: project?.type_en || '',
    type_ar: project?.type_ar || '',
    status_en: project?.status_en || 'Off-Plan',
    status_ar: project?.status_ar || 'على المخطط',
    expected_delivery_en: project?.expected_delivery_en || '',
    expected_delivery_ar: project?.expected_delivery_ar || '',
    units_count_en: project?.units_count_en || '',
    units_count_ar: project?.units_count_ar || '',
    floors_en: project?.floors_en || '',
    floors_ar: project?.floors_ar || '',
    overview_en: project?.overview_en || '',
    overview_ar: project?.overview_ar || '',
    highlights_en: project?.highlights_en || [],
    highlights_ar: project?.highlights_ar || [],
    images: project?.images || [],
    video_url: project?.video_url || '',
    map_embed_url: project?.map_embed_url || '',
    google_maps_url: project?.google_maps_url || '',
    landmarks: project?.landmarks || [],
    amenities: project?.amenities || [],
    brochure_url: project?.brochure_url || '',
    brochure_size_en: project?.brochure_size_en || '',
    brochure_size_ar: project?.brochure_size_ar || '',
    is_published: project ? project.is_published : true,
    sort_order: project?.sort_order || 0,
  })

  // Dynamic Landmark items
  const [newLandmark, setNewLandmark] = useState<Landmark>({ nameEn: '', nameAr: '', distEn: '', distAr: '' })
  const [editingLandmarkIndex, setEditingLandmarkIndex] = useState<number | null>(null)
  const [editLandmark, setEditLandmark] = useState<Landmark>({ nameEn: '', nameAr: '', distEn: '', distAr: '' })

  // Dynamic Amenity items
  const [newAmenity, setNewAmenity] = useState<Amenity>({ badge: '✨', titleEn: '', titleAr: '', descEn: '', descAr: '' })
  const [editingAmenityIndex, setEditingAmenityIndex] = useState<number | null>(null)
  const [editAmenity, setEditAmenity] = useState<Amenity>({ badge: '✨', titleEn: '', titleAr: '', descEn: '', descAr: '' })

  // Highlights input temporary state
  const [newHighlightEn, setNewHighlightEn] = useState('')
  const [newHighlightAr, setNewHighlightAr] = useState('')
  const [editingHighlightIndex, setEditingHighlightIndex] = useState<number | null>(null)
  const [editHighlightEn, setEditHighlightEn] = useState('')
  const [editHighlightAr, setEditHighlightAr] = useState('')

  if (!isOpen) return null

  function handleNameEnChange(val: string) {
    const updates: Partial<Project> = { name_en: val }
    if (!slugManuallyEdited && (!isEdit || !form.id)) {
      updates.id = slugify(val)
    }
    setForm((prev) => ({ ...prev, ...updates }))
  }

  function addLandmark() {
    if (!newLandmark.nameEn.trim()) return
    setForm({
      ...form,
      landmarks: [...(form.landmarks || []), { ...newLandmark }],
    })
    setNewLandmark({ nameEn: '', nameAr: '', distEn: '', distAr: '' })
  }

  function startEditLandmark(index: number) {
    const item = (form.landmarks || [])[index]
    if (!item) return
    setEditingLandmarkIndex(index)
    setEditLandmark({ ...item })
  }

  function saveEditLandmark() {
    if (editingLandmarkIndex === null || !editLandmark.nameEn.trim()) return
    const updated = [...(form.landmarks || [])]
    updated[editingLandmarkIndex] = { ...editLandmark }
    setForm({
      ...form,
      landmarks: updated,
    })
    setEditingLandmarkIndex(null)
    setEditLandmark({ nameEn: '', nameAr: '', distEn: '', distAr: '' })
  }

  function cancelEditLandmark() {
    setEditingLandmarkIndex(null)
    setEditLandmark({ nameEn: '', nameAr: '', distEn: '', distAr: '' })
  }

  function removeLandmark(index: number) {
    if (editingLandmarkIndex === index) {
      setEditingLandmarkIndex(null)
    } else if (editingLandmarkIndex !== null && editingLandmarkIndex > index) {
      setEditingLandmarkIndex(editingLandmarkIndex - 1)
    }
    setForm({
      ...form,
      landmarks: (form.landmarks || []).filter((_, i) => i !== index),
    })
  }

  function addAmenity() {
    if (!newAmenity.titleEn.trim()) return
    setForm({
      ...form,
      amenities: [...(form.amenities || []), { ...newAmenity }],
    })
    setNewAmenity({ badge: '✨', titleEn: '', titleAr: '', descEn: '', descAr: '' })
  }

  function startEditAmenity(index: number) {
    const item = (form.amenities || [])[index]
    if (!item) return
    setEditingAmenityIndex(index)
    setEditAmenity({ ...item })
  }

  function saveEditAmenity() {
    if (editingAmenityIndex === null || !editAmenity.titleEn.trim()) return
    const updated = [...(form.amenities || [])]
    updated[editingAmenityIndex] = { ...editAmenity }
    setForm({
      ...form,
      amenities: updated,
    })
    setEditingAmenityIndex(null)
    setEditAmenity({ badge: '✨', titleEn: '', titleAr: '', descEn: '', descAr: '' })
  }

  function cancelEditAmenity() {
    setEditingAmenityIndex(null)
    setEditAmenity({ badge: '✨', titleEn: '', titleAr: '', descEn: '', descAr: '' })
  }

  function removeAmenity(index: number) {
    if (editingAmenityIndex === index) {
      setEditingAmenityIndex(null)
    } else if (editingAmenityIndex !== null && editingAmenityIndex > index) {
      setEditingAmenityIndex(editingAmenityIndex - 1)
    }
    setForm({
      ...form,
      amenities: (form.amenities || []).filter((_, i) => i !== index),
    })
  }

  function addHighlight() {
    if (!newHighlightEn.trim() && !newHighlightAr.trim()) return
    setForm({
      ...form,
      highlights_en: newHighlightEn.trim() ? [...(form.highlights_en || []), newHighlightEn.trim()] : form.highlights_en,
      highlights_ar: newHighlightAr.trim() ? [...(form.highlights_ar || []), newHighlightAr.trim()] : form.highlights_ar,
    })
    setNewHighlightEn('')
    setNewHighlightAr('')
  }

  function startEditHighlight(index: number) {
    setEditingHighlightIndex(index)
    setEditHighlightEn(form.highlights_en?.[index] || '')
    setEditHighlightAr(form.highlights_ar?.[index] || '')
  }

  function saveEditHighlight() {
    if (editingHighlightIndex === null) return
    const updatedEn = [...(form.highlights_en || [])]
    const updatedAr = [...(form.highlights_ar || [])]
    updatedEn[editingHighlightIndex] = editHighlightEn.trim()
    updatedAr[editingHighlightIndex] = editHighlightAr.trim()

    setForm({
      ...form,
      highlights_en: updatedEn,
      highlights_ar: updatedAr,
    })
    setEditingHighlightIndex(null)
    setEditHighlightEn('')
    setEditHighlightAr('')
  }

  function cancelEditHighlight() {
    setEditingHighlightIndex(null)
    setEditHighlightEn('')
    setEditHighlightAr('')
  }

  function removeHighlight(index: number) {
    if (editingHighlightIndex === index) {
      setEditingHighlightIndex(null)
    } else if (editingHighlightIndex !== null && editingHighlightIndex > index) {
      setEditingHighlightIndex(editingHighlightIndex - 1)
    }
    setForm({
      ...form,
      highlights_en: (form.highlights_en || []).filter((_, i) => i !== index),
      highlights_ar: (form.highlights_ar || []).filter((_, i) => i !== index),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const missing: string[] = []
    if (!form.id?.trim()) missing.push('Project Slug / ID')
    if (!form.name_en?.trim()) missing.push('Project Name (English)')
    if (!form.name_ar?.trim()) missing.push('Project Name (Arabic)')
    if (!form.city_en?.trim()) missing.push('City (English)')
    if (!form.district_en?.trim()) missing.push('District (English)')

    if (missing.length > 0) {
      setError(`Missing required field(s): ${missing.join(', ')}. Please fill in all required fields.`)
      setActiveTab('basic')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          original_id: project?.id || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save project')
        setLoading(false)
        return
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Network error saving project.')
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
              <Building size={20} style={{ color: 'var(--accent)' }} />
              <span>{isEdit ? `Edit Project: ${project.name_en}` : 'Create New Property Project'}</span>
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Configure bilingual project details, brochure downloads, and Cloudinary photo gallery
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
            onClick={() => setActiveTab('basic')}
            className={`btn btn-sm ${activeTab === 'basic' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <Building size={14} />
            <span>1. Basic &amp; Location</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`btn btn-sm ${activeTab === 'specs' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <DollarSign size={14} />
            <span>2. Pricing &amp; Specs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`btn btn-sm ${activeTab === 'content' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <FileText size={14} />
            <span>3. Overview &amp; Highlights</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('amenities')}
            className={`btn btn-sm ${activeTab === 'amenities' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <Sparkles size={14} />
            <span>4. Amenities &amp; Landmarks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('brochure')}
            className={`btn btn-sm ${activeTab === 'brochure' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <FileDown size={14} />
            <span>5. Brochure &amp; Video</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`btn btn-sm ${activeTab === 'gallery' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <ImageIcon size={14} />
            <span>6. Photos ({(form.images || []).length})</span>
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

            {/* TAB 1: BASIC & LOCATION */}
            {activeTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  {/* Project ID / Slug */}
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="form-label">Project Slug / ID *</label>
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
                      placeholder="e.g. suhail-compound, itlala-towers"
                      className="form-input"
                    />
                    <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                      Unique URL identifier used across website &amp; CRM (auto-generated from English name).
                    </span>
                  </div>

                  {/* Publish Status Toggle */}
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label className="form-label">Publication Status</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
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
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Project Name (English) *</label>
                    <input
                      type="text"
                      required
                      value={form.name_en}
                      onChange={(e) => handleNameEnChange(e.target.value)}
                      placeholder="e.g. Suhail Compound"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>اسم المشروع (بالعربية) *</label>
                    <input
                      type="text"
                      required
                      dir="rtl"
                      value={form.name_ar}
                      onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                      placeholder="مثال: مجمع سهيل السكني"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Developer (English)</label>
                    <input
                      type="text"
                      value={form.developer_en || ''}
                      onChange={(e) => setForm({ ...form, developer_en: e.target.value })}
                      placeholder="e.g. Suhail Developments"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>المطور العقاري (بالعربية)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={form.developer_ar || ''}
                      onChange={(e) => setForm({ ...form, developer_ar: e.target.value })}
                      placeholder="مثال: شركة سهيل للتطوير العقاري"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">City (EN) *</label>
                    <input
                      type="text"
                      required
                      value={form.city_en}
                      onChange={(e) => setForm({ ...form, city_en: e.target.value })}
                      placeholder="e.g. Riyadh"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>المدينة (AR) *</label>
                    <input
                      type="text"
                      required
                      dir="rtl"
                      value={form.city_ar}
                      onChange={(e) => setForm({ ...form, city_ar: e.target.value })}
                      placeholder="مثال: الرياض"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">District (EN) *</label>
                    <input
                      type="text"
                      required
                      value={form.district_en}
                      onChange={(e) => setForm({ ...form, district_en: e.target.value })}
                      placeholder="e.g. Al Narjis"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>الحي / المنطقة (AR) *</label>
                    <input
                      type="text"
                      required
                      dir="rtl"
                      value={form.district_ar}
                      onChange={(e) => setForm({ ...form, district_ar: e.target.value })}
                      placeholder="مثال: حي النرجس"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Map Links */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '6px' }}>
                  <div className="form-group">
                    <label className="form-label">Google Maps Embed URL (iframe src)</label>
                    <input
                      type="url"
                      value={form.map_embed_url || ''}
                      onChange={(e) => setForm({ ...form, map_embed_url: e.target.value })}
                      placeholder="https://www.google.com/maps/embed?pb=..."
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Direct Google Maps Link</label>
                    <input
                      type="url"
                      value={form.google_maps_url || ''}
                      onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
                      placeholder="https://maps.app.goo.gl/..."
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PRICING & SPECS */}
            {activeTab === 'specs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Starting Price Display (EN)</label>
                    <input
                      type="text"
                      value={form.starting_price_en || ''}
                      onChange={(e) => setForm({ ...form, starting_price_en: e.target.value })}
                      placeholder="e.g. from SAR 600K"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>السعر المبدئي (AR)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={form.starting_price_ar || ''}
                      onChange={(e) => setForm({ ...form, starting_price_ar: e.target.value })}
                      placeholder="مثال: ابتداءً من ٦٠٠ ألف ر.س"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Price Range (EN)</label>
                    <input
                      type="text"
                      value={form.price_range_en || ''}
                      onChange={(e) => setForm({ ...form, price_range_en: e.target.value })}
                      placeholder="e.g. SAR 600K – 850K"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>نطاق الأسعار (AR)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={form.price_range_ar || ''}
                      onChange={(e) => setForm({ ...form, price_range_ar: e.target.value })}
                      placeholder="مثال: ٦٠٠ ألف – ٨٥٠ ألف ر.س"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Property Sizes (EN)</label>
                    <input
                      type="text"
                      value={form.size_en || ''}
                      onChange={(e) => setForm({ ...form, size_en: e.target.value })}
                      placeholder="e.g. 150 - 320 sqm (3 - 4 Beds)"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>المساحات (AR)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={form.size_ar || ''}
                      onChange={(e) => setForm({ ...form, size_ar: e.target.value })}
                      placeholder="مثال: ١٥٠ - ٣٢٠ م² (٣ - ٤ غرف نوم)"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Property Type (EN)</label>
                    <input
                      type="text"
                      value={form.type_en || ''}
                      onChange={(e) => setForm({ ...form, type_en: e.target.value })}
                      placeholder="e.g. Luxury Residential Compound"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>نوع العقار (AR)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={form.type_ar || ''}
                      onChange={(e) => setForm({ ...form, type_ar: e.target.value })}
                      placeholder="مثال: مجمع سكني فاخر"
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Project Status (EN)</label>
                    <input
                      type="text"
                      value={form.status_en || ''}
                      onChange={(e) => setForm({ ...form, status_en: e.target.value })}
                      placeholder="e.g. Off-Plan / Ready"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Delivery Date (EN)</label>
                    <input
                      type="text"
                      value={form.expected_delivery_en || ''}
                      onChange={(e) => setForm({ ...form, expected_delivery_en: e.target.value })}
                      placeholder="e.g. Q4 2026"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Units Count (EN)</label>
                    <input
                      type="text"
                      value={form.units_count_en || ''}
                      onChange={(e) => setForm({ ...form, units_count_en: e.target.value })}
                      placeholder="e.g. 48 Luxury Units"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: OVERVIEW & HIGHLIGHTS */}
            {activeTab === 'content' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Project Overview (English)</label>
                  <textarea
                    rows={4}
                    value={form.overview_en || ''}
                    onChange={(e) => setForm({ ...form, overview_en: e.target.value })}
                    placeholder="Comprehensive description of the masterplan, architectural design, lifestyle, and investment potential..."
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ textAlign: 'right' }}>نبذة عن المشروع (بالعربية)</label>
                  <textarea
                    rows={4}
                    dir="rtl"
                    value={form.overview_ar || ''}
                    onChange={(e) => setForm({ ...form, overview_ar: e.target.value })}
                    placeholder="وصف شامل للمشروع والموقع والمزايا المعمارية ونمط الحياة..."
                    className="form-textarea"
                  />
                </div>

                {/* Highlights List Builder */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <label className="form-label" style={{ marginBottom: '8px' }}>
                    Bullet Highlights ({ (form.highlights_en || []).length } items)
                  </label>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Highlight in English (e.g. Private Pools &amp; Landscaped Courtyards)"
                      value={newHighlightEn}
                      onChange={(e) => setNewHighlightEn(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="الميزة بالعربية"
                      value={newHighlightAr}
                      onChange={(e) => setNewHighlightAr(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={addHighlight}
                      className="btn btn-outline btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Highlights Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(form.highlights_en || []).map((hEn, idx) => {
                      const isEditing = editingHighlightIndex === idx
                      if (isEditing) {
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              backgroundColor: '#EFF6FF',
                              border: '1px solid #93C5FD',
                              borderRadius: '6px',
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Highlight in English"
                              value={editHighlightEn}
                              onChange={(e) => setEditHighlightEn(e.target.value)}
                              className="form-input"
                              style={{ flex: 1, backgroundColor: '#FFFFFF' }}
                              autoFocus
                            />
                            <input
                              type="text"
                              dir="rtl"
                              placeholder="الميزة بالعربية"
                              value={editHighlightAr}
                              onChange={(e) => setEditHighlightAr(e.target.value)}
                              className="form-input"
                              style={{ flex: 1, backgroundColor: '#FFFFFF' }}
                            />
                            <button
                              type="button"
                              onClick={saveEditHighlight}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '6px 10px' }}
                              title="Save highlight"
                            >
                              <Check size={14} />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditHighlight}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 8px' }}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#0F172A' }}>• {hEn}</span>
                            {form.highlights_ar?.[idx] && (
                              <span style={{ color: '#64748B' }}>({form.highlights_ar[idx]})</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => startEditHighlight(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#0284C7' }}
                              title="Edit highlight"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeHighlight(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#EF4444' }}
                              title="Delete highlight"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AMENITIES & LANDMARKS */}
            {activeTab === 'amenities' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Amenities Builder */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                    Project Amenities &amp; Facilities ({(form.amenities || []).length})
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr auto', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Icon"
                      value={newAmenity.badge}
                      onChange={(e) => setNewAmenity({ ...newAmenity, badge: e.target.value })}
                      className="form-input"
                      title="Emoji or icon badge e.g. 🏊‍♂️, 🅿️, 🏋️"
                    />
                    <input
                      type="text"
                      placeholder="Title (EN)"
                      value={newAmenity.titleEn}
                      onChange={(e) => setNewAmenity({ ...newAmenity, titleEn: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="العنوان (AR)"
                      value={newAmenity.titleAr}
                      onChange={(e) => setNewAmenity({ ...newAmenity, titleAr: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Description (EN)"
                      value={newAmenity.descEn}
                      onChange={(e) => setNewAmenity({ ...newAmenity, descEn: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="الوصف (AR)"
                      value={newAmenity.descAr}
                      onChange={(e) => setNewAmenity({ ...newAmenity, descAr: e.target.value })}
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={addAmenity}
                      className="btn btn-outline btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(form.amenities || []).map((am, idx) => {
                      const isEditing = editingAmenityIndex === idx
                      if (isEditing) {
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '60px 1fr 1fr 1fr 1fr auto auto',
                              gap: '8px',
                              alignItems: 'center',
                              padding: '8px 10px',
                              backgroundColor: '#EFF6FF',
                              border: '1px solid #93C5FD',
                              borderRadius: '6px',
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Icon"
                              value={editAmenity.badge}
                              onChange={(e) => setEditAmenity({ ...editAmenity, badge: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                              title="Emoji or icon badge"
                            />
                            <input
                              type="text"
                              placeholder="Title (EN)"
                              value={editAmenity.titleEn}
                              onChange={(e) => setEditAmenity({ ...editAmenity, titleEn: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              dir="rtl"
                              placeholder="العنوان (AR)"
                              value={editAmenity.titleAr}
                              onChange={(e) => setEditAmenity({ ...editAmenity, titleAr: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              placeholder="Description (EN)"
                              value={editAmenity.descEn}
                              onChange={(e) => setEditAmenity({ ...editAmenity, descEn: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              dir="rtl"
                              placeholder="الوصف (AR)"
                              value={editAmenity.descAr}
                              onChange={(e) => setEditAmenity({ ...editAmenity, descAr: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <button
                              type="button"
                              onClick={saveEditAmenity}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '6px 10px' }}
                              title="Save amenity"
                            >
                              <Check size={14} />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditAmenity}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 8px' }}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '18px', flexShrink: 0 }}>{am.badge}</span>
                            <span style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap' }}>{am.titleEn}</span>
                            <span style={{ color: '#64748B', whiteSpace: 'nowrap' }}>({am.titleAr})</span>
                            <span style={{ fontSize: '11.5px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {am.descEn}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => startEditAmenity(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#0284C7' }}
                              title="Edit amenity"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAmenity(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#EF4444' }}
                              title="Delete amenity"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Landmarks Builder */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                    Nearby Landmarks &amp; Distances ({(form.landmarks || []).length})
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px auto', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Landmark (EN) e.g. Kingdom Centre"
                      value={newLandmark.nameEn}
                      onChange={(e) => setNewLandmark({ ...newLandmark, nameEn: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="المعلم (AR) مثال: برج المملكة"
                      value={newLandmark.nameAr}
                      onChange={(e) => setNewLandmark({ ...newLandmark, nameAr: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Distance (EN)"
                      value={newLandmark.distEn}
                      onChange={(e) => setNewLandmark({ ...newLandmark, distEn: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="المسافة (AR)"
                      value={newLandmark.distAr}
                      onChange={(e) => setNewLandmark({ ...newLandmark, distAr: e.target.value })}
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={addLandmark}
                      className="btn btn-outline btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(form.landmarks || []).map((lm, idx) => {
                      const isEditing = editingLandmarkIndex === idx
                      if (isEditing) {
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 120px 120px auto auto',
                              gap: '8px',
                              alignItems: 'center',
                              padding: '8px 10px',
                              backgroundColor: '#EFF6FF',
                              border: '1px solid #93C5FD',
                              borderRadius: '6px',
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Landmark (EN)"
                              value={editLandmark.nameEn}
                              onChange={(e) => setEditLandmark({ ...editLandmark, nameEn: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              dir="rtl"
                              placeholder="المعلم (AR)"
                              value={editLandmark.nameAr}
                              onChange={(e) => setEditLandmark({ ...editLandmark, nameAr: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              placeholder="Distance (EN)"
                              value={editLandmark.distEn}
                              onChange={(e) => setEditLandmark({ ...editLandmark, distEn: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              dir="rtl"
                              placeholder="المسافة (AR)"
                              value={editLandmark.distAr}
                              onChange={(e) => setEditLandmark({ ...editLandmark, distAr: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <button
                              type="button"
                              onClick={saveEditLandmark}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '6px 10px' }}
                              title="Save landmark"
                            >
                              <Check size={14} />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditLandmark}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 8px' }}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <span style={{ fontWeight: 600, color: '#0F172A' }}>{lm.nameEn}</span>
                            <span style={{ color: '#64748B' }}>({lm.nameAr})</span>
                            <span style={{ fontSize: '12px', color: '#0284C7', fontWeight: 600 }}>• {lm.distEn}</span>
                            {lm.distAr && <span style={{ fontSize: '12px', color: '#64748B' }}>({lm.distAr})</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => startEditLandmark(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#0284C7' }}
                              title="Edit landmark"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLandmark(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#EF4444' }}
                              title="Delete landmark"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: BROCHURE & VIDEO */}
            {activeTab === 'brochure' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '16px', backgroundColor: '#F8FAFC' }}>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <FileDown size={16} style={{ color: '#0284C7' }} />
                    <span>Project Brochure Download Links</span>
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                    Provide direct download links (PDF link, Google Drive direct link, or Cloudinary file) for website visitors to download brochures.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Direct Brochure URL (PDF / File Link)</label>
                    <input
                      type="url"
                      value={form.brochure_url || ''}
                      onChange={(e) => setForm({ ...form, brochure_url: e.target.value })}
                      placeholder="https://.../Suhail-Compound-Brochure.pdf"
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                    <div className="form-group">
                      <label className="form-label">Brochure Size Label (EN)</label>
                      <input
                        type="text"
                        value={form.brochure_size_en || ''}
                        onChange={(e) => setForm({ ...form, brochure_size_en: e.target.value })}
                        placeholder="e.g. 4.2 MB PDF"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ textAlign: 'right' }}>حجم الملف (AR)</label>
                      <input
                        type="text"
                        dir="rtl"
                        value={form.brochure_size_ar || ''}
                        onChange={(e) => setForm({ ...form, brochure_size_ar: e.target.value })}
                        placeholder="مثال: ٤.٢ ميجابايت PDF"
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', backgroundColor: '#F8FAFC' }}>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Video size={16} style={{ color: '#D97706' }} />
                    <span>Project Showcase Video</span>
                  </h4>

                  <div className="form-group">
                    <label className="form-label">Video URL (YouTube Embed or Direct Video)</label>
                    <input
                      type="url"
                      value={form.video_url || ''}
                      onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                      placeholder="https://www.youtube.com/embed/... or https://.../video.mp4"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: PHOTO GALLERY */}
            {activeTab === 'gallery' && (
              <ImageGalleryManager
                images={form.images || []}
                onChange={(updatedImages) => setForm({ ...form, images: updatedImages })}
                folder="asaheeb/projects"
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
              <span>{loading ? 'Saving Project...' : isEdit ? 'Save Changes' : 'Create Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
