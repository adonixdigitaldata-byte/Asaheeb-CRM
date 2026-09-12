'use client'

import React, { useState } from 'react'
import {
  X,
  Building,
  FileText,
  Video,
  FileDown,
  Sparkles,
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Check,
  Pencil,
  Layout,
  CreditCard,
  ArrowUp,
  ArrowDown,
  Star,
  ShieldCheck,
  Tag,
  Flame,
  Clock,
  Calendar,
  Percent,
  MapPin,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Sliders,
  Search,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import type { Project, ProjectVideo, Landmark, Amenity, ProjectDiscountOffer } from '@/types/database'
import ImageGalleryManager from '@/components/ImageGalleryManager'
import CmsActivityTimeline from '@/components/CmsActivityTimeline'
import InteractiveMapPicker from '@/components/InteractiveMapPicker'

interface Props {
  project?: Project | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type TabType = 'basic' | 'specs' | 'content' | 'amenities' | 'brochure' | 'floorplans' | 'gallery' | 'activity'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizePropertyType(typeStr?: string | null): string {
  if (!typeStr) return 'Apartments'
  const t = typeStr.trim().toLowerCase()
  if (t === 'apartments' || t === 'apartment' || t.includes('apartment')) return 'Apartments'
  if (t === 'villas' || t === 'villa' || t.includes('villa')) return 'Villas'
  if (t === 'commercial buildings' || t === 'commercial building' || t.includes('commercial')) return 'Commercial Buildings'
  if (t === 'residential buildings' || t === 'residential building' || t.includes('residential')) return 'Residential Buildings'
  if (t === 'land' || t === 'lands' || t.includes('land') || t.includes('أراض')) return 'Land'
  return typeStr
}

function getCoordinatesFromEmbedUrl(url?: string | null): { lat: string; lng: string } | null {
  if (!url) return null
  const pbLat = url.match(/!3d(-?\d+\.\d+)/)
  const pbLng = url.match(/!2d(-?\d+\.\d+)/)
  if (pbLat && pbLng) {
    return { lat: pbLat[1], lng: pbLng[1] }
  }
  const qCoords = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (qCoords) {
    return { lat: qCoords[1], lng: qCoords[2] }
  }
  const atCoords = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atCoords) {
    return { lat: atCoords[1], lng: atCoords[2] }
  }
  return null
}

function getZoomFromEmbedUrl(url?: string | null): number {
  if (!url) return 17
  const zMatch = url.match(/[?&]z=(\d+)/)
  if (zMatch) return parseInt(zMatch[1], 10)
  return 17
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

  // Derive initial video_items if project has legacy video_url but no video_items
  const initialVideos: ProjectVideo[] = project?.video_items?.length
    ? project.video_items
    : project?.video_url
    ? [{ url: project.video_url, titleEn: 'Showcase Video', titleAr: 'فيديو المشروع' }]
    : []

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
    payment_terms_en: project?.payment_terms_en || 'Cash + Installment Available',
    payment_terms_ar: project?.payment_terms_ar || 'كاش + أقساط متاحة',
    size_en: project?.size_en || '',
    size_ar: project?.size_ar || '',
    type_en: project?.type_en || 'Apartments',
    type_ar: project?.type_ar || 'شقق سكنية',
    status_en: project?.status_en || (project?.type_en === 'Land' ? 'Ready for Development' : 'Off-Plan'),
    status_ar: project?.status_ar || (project?.type_en === 'Land' ? 'جاهز للتطوير' : 'على المخطط'),
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
    floor_plans: project?.floor_plans || [],
    expected_commission_en: project?.expected_commission_en || '',
    expected_commission_ar: project?.expected_commission_ar || '',
    commission_notes_en: project?.commission_notes_en || '',
    commission_notes_ar: project?.commission_notes_ar || '',
    discount_offer: project?.discount_offer || {
      is_active: false,
      title_en: '',
      title_ar: '',
      discount_type: 'PERCENTAGE',
      discount_value: null,
      discount_badge_en: 'LIMITED TIME OFFER',
      discount_badge_ar: 'عرض لفترة محدودة',
      applies_to: 'ALL_UNITS',
      applicable_units_en: '',
      applicable_units_ar: '',
      original_price_en: '',
      original_price_ar: '',
      discounted_price_en: '',
      discounted_price_ar: '',
      valid_until: '',
      show_countdown: true,
      terms_note_en: '',
      terms_note_ar: '',
    },
    video_url: project?.video_url || '',
    video_items: initialVideos,
    map_embed_url: project?.map_embed_url || '',
    google_maps_url: project?.google_maps_url || '',
    landmarks: project?.landmarks || [],
    amenities: project?.amenities || [],
    brochure_url: project?.brochure_url || project?.brochure_url_en || '',
    brochure_url_en: project?.brochure_url_en || project?.brochure_url || '',
    brochure_url_ar: project?.brochure_url_ar || '',
    brochure_size_en: project?.brochure_size_en || '',
    brochure_size_ar: project?.brochure_size_ar || '',
    is_published: project ? project.is_published : true,
    sort_order: project?.sort_order || 0,
  })

  // Dynamic Video items state
  const [newVideo, setNewVideo] = useState<ProjectVideo>({ url: '', titleEn: '', titleAr: '' })
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null)
  const [editVideo, setEditVideo] = useState<ProjectVideo>({ url: '', titleEn: '', titleAr: '' })

  // Dynamic Landmark items
  const [newLandmark, setNewLandmark] = useState<Landmark>({ nameEn: '', nameAr: '', distEn: '', distAr: '' })
  const [editingLandmarkIndex, setEditingLandmarkIndex] = useState<number | null>(null)
  const [editLandmark, setEditLandmark] = useState<Landmark>({ nameEn: '', nameAr: '', distEn: '', distAr: '' })

  // Dynamic Amenity items
  const [newAmenity, setNewAmenity] = useState<Amenity>({ badge: '', titleEn: '', titleAr: '', descEn: '', descAr: '' })
  const [editingAmenityIndex, setEditingAmenityIndex] = useState<number | null>(null)
  const [editAmenity, setEditAmenity] = useState<Amenity>({ badge: '', titleEn: '', titleAr: '', descEn: '', descAr: '' })

  // Highlights input temporary state
  const [newHighlightEn, setNewHighlightEn] = useState('')
  const [newHighlightAr, setNewHighlightAr] = useState('')
  const [editingHighlightIndex, setEditingHighlightIndex] = useState<number | null>(null)
  const [editHighlightEn, setEditHighlightEn] = useState('')
  const [editHighlightAr, setEditHighlightAr] = useState('')

  // Interactive Map Adjustment State
  const [mapInputMode, setMapInputMode] = useState<'embed' | 'picker'>('embed')
  const [showCoordAdjuster, setShowCoordAdjuster] = useState(false)
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [customLat, setCustomLat] = useState('')
  const [customLng, setCustomLng] = useState('')

  if (!isOpen) return null

  function handleNameEnChange(val: string) {
    const updates: Partial<Project> = { name_en: val }
    if (!slugManuallyEdited && (!isEdit || !form.id)) {
      updates.id = slugify(val)
    }
    setForm((prev) => ({ ...prev, ...updates }))
  }

  // Video Management Functions
  function addVideo() {
    if (!newVideo.url.trim()) return
    const updatedVideos = [...(form.video_items || []), { ...newVideo, url: newVideo.url.trim() }]
    setForm({
      ...form,
      video_items: updatedVideos,
      video_url: updatedVideos[0]?.url || '',
    })
    setNewVideo({ url: '', titleEn: '', titleAr: '' })
  }

  function startEditVideo(index: number) {
    const item = (form.video_items || [])[index]
    if (!item) return
    setEditingVideoIndex(index)
    setEditVideo({ ...item })
  }

  function saveEditVideo() {
    if (editingVideoIndex === null || !editVideo.url.trim()) return
    const updated = [...(form.video_items || [])]
    updated[editingVideoIndex] = { ...editVideo, url: editVideo.url.trim() }
    setForm({
      ...form,
      video_items: updated,
      video_url: updated[0]?.url || '',
    })
    setEditingVideoIndex(null)
    setEditVideo({ url: '', titleEn: '', titleAr: '' })
  }

  function cancelEditVideo() {
    setEditingVideoIndex(null)
    setEditVideo({ url: '', titleEn: '', titleAr: '' })
  }

  function removeVideo(index: number) {
    if (editingVideoIndex === index) {
      setEditingVideoIndex(null)
    } else if (editingVideoIndex !== null && editingVideoIndex > index) {
      setEditingVideoIndex(editingVideoIndex - 1)
    }
    const updated = (form.video_items || []).filter((_, i) => i !== index)
    setForm({
      ...form,
      video_items: updated,
      video_url: updated[0]?.url || '',
    })
  }

  function moveVideoUp(index: number) {
    if (index <= 0 || !form.video_items) return
    const updated = [...form.video_items]
    const temp = updated[index]
    updated[index] = updated[index - 1]
    updated[index - 1] = temp
    setForm({
      ...form,
      video_items: updated,
      video_url: updated[0]?.url || '',
    })
  }

  function moveVideoDown(index: number) {
    if (!form.video_items || index >= form.video_items.length - 1) return
    const updated = [...form.video_items]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    setForm({
      ...form,
      video_items: updated,
      video_url: updated[0]?.url || '',
    })
  }

  function makeVideoPrimary(index: number) {
    if (index === 0 || !form.video_items) return
    const updated = [...form.video_items]
    const [selected] = updated.splice(index, 1)
    updated.unshift(selected)
    setForm({
      ...form,
      video_items: updated,
      video_url: updated[0]?.url || '',
    })
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
      amenities: [...(form.amenities || []), { ...newAmenity, badge: '' }],
    })
    setNewAmenity({ badge: '', titleEn: '', titleAr: '', descEn: '', descAr: '' })
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
          className="modal-tabs-scroll"
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
            <SaudiRiyalIcon size={14} />
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
            onClick={() => setActiveTab('floorplans')}
            className={`btn btn-sm ${activeTab === 'floorplans' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <Layout size={14} />
            <span>6. Floor Plans ({(form.floor_plans || []).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`btn btn-sm ${activeTab === 'gallery' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12.5px', padding: '5px 12px' }}
          >
            <ImageIcon size={14} />
            <span>7. Photos ({(form.images || []).length})</span>
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
              <span>8. Activity Log</span>
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

                {/* Map Section */}
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Mode Selector Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 0, fontSize: '13px' }}>
                        Project Location on Map
                      </label>
                      <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>
                        Paste Google Maps embed code, or switch to drag the pin with your cursor.
                      </span>
                    </div>
                    <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setMapInputMode('embed')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: mapInputMode === 'embed' ? '#FFFFFF' : 'transparent',
                          color: mapInputMode === 'embed' ? '#0F172A' : '#64748B',
                          boxShadow: mapInputMode === 'embed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        📋 Paste Google Embed Link
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapInputMode('picker')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: mapInputMode === 'picker' ? '#FFFFFF' : 'transparent',
                          color: mapInputMode === 'picker' ? '#0F172A' : '#64748B',
                          boxShadow: mapInputMode === 'picker' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <MapPin size={13} color="#D97706" />
                        🎯 Drag Pin with Cursor
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: Paste Google Embed Link (First) */}
                  {mapInputMode === 'embed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Google Maps Embed URL (or paste iframe snippet)</label>
                        <input
                          type="text"
                          value={form.map_embed_url || ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const iframeMatch = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                            if (iframeMatch && iframeMatch[1]) {
                              setForm((prev) => ({ ...prev, map_embed_url: iframeMatch[1] }));
                              return;
                            }
                            const coordsMatch = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || raw.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                            if (coordsMatch && !raw.includes('/maps/embed')) {
                              const lat = coordsMatch[1];
                              const lng = coordsMatch[2];
                              setForm((prev) => ({
                                ...prev,
                                map_embed_url: `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=17&output=embed`,
                                google_maps_url: prev.google_maps_url || raw.trim(),
                              }));
                              return;
                            }
                            setForm((prev) => ({ ...prev, map_embed_url: raw }));
                          }}
                          placeholder="Paste iframe HTML from Google Maps, or https://www.google.com/maps/embed?pb=..."
                          className="form-input"
                        />
                        {form.map_embed_url && (form.map_embed_url.includes('maps.app.goo.gl') || (form.map_embed_url.includes('google.com/maps') && !form.map_embed_url.includes('/maps/embed') && !form.map_embed_url.includes('output=embed'))) && (
                          <div style={{
                            marginTop: '8px',
                            padding: '10px 12px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#D97706',
                          }}>
                            ⚠️ Google Share Link Detected. Switch to &quot;🎯 Drag Pin with Cursor&quot; above, or paste the iframe code from Google Maps &quot;Embed a map&quot; tab.
                          </div>
                        )}
                      </div>

                      {/* Google Map Iframe Preview */}
                      {form.map_embed_url && (form.map_embed_url.includes('/maps/embed') || form.map_embed_url.includes('output=embed')) && (
                        <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden' }}>
                          <iframe
                            src={form.map_embed_url}
                            width="100%"
                            height="240"
                            style={{ border: 0, display: 'block' }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: Interactive Pin Picker (Second) */}
                  {mapInputMode === 'picker' && (() => {
                    const parsed = getCoordinatesFromEmbedUrl(form.map_embed_url);
                    const initLat = parsed ? parseFloat(parsed.lat) : 21.534639;
                    const initLng = parsed ? parseFloat(parsed.lng) : 39.176639;

                    return (
                      <InteractiveMapPicker
                        latitude={initLat}
                        longitude={initLng}
                        districtName={form.district_en}
                        cityName={form.city_en}
                        onLocationChange={(lat, lng) => {
                          const embed = `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=17&output=embed`;
                          const share = `https://maps.google.com/maps?q=${lat},${lng}`;
                          setForm((prev) => ({
                            ...prev,
                            map_embed_url: embed,
                            google_maps_url: share,
                          }));
                        }}
                      />
                    );
                  })()}
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

                {/* Brokerage Commission & Agency Terms */}
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '8px',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <SaudiRiyalIcon size={16} style={{ color: '#15803D' }} />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#14532D' }}>
                      Agency &amp; Sales Commission Structure
                    </span>
                    <span style={{ fontSize: '11px', color: '#166534', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Sales Agent Guidance
                    </span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: '#166534', marginBottom: '12px', lineHeight: '1.4' }}>
                    Configure the project brokerage payout and specific deal limits. This is displayed to sales agents to help them prioritize focus based on project commission rates.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#14532D' }}>
                        Expected Commission / Payout (EN)
                      </label>
                      <input
                        type="text"
                        value={form.expected_commission_en || ''}
                        onChange={(e) => setForm({ ...form, expected_commission_en: e.target.value })}
                        placeholder="e.g. SAR 10,000 / Deal or 2.5%"
                        className="form-input"
                        style={{ backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#14532D' }}>
                        نسبة / مبلغ عمولة الوساطة (AR)
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={form.expected_commission_ar || ''}
                        onChange={(e) => setForm({ ...form, expected_commission_ar: e.target.value })}
                        placeholder="مثال: ١٠,٠٠٠ ر.س لكل صفقة أو ٢.٥٪"
                        className="form-input"
                        style={{ backgroundColor: '#FFFFFF' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#14532D' }}>
                        Commission Notes &amp; Limits (EN)
                      </label>
                      <textarea
                        rows={2}
                        value={form.commission_notes_en || ''}
                        onChange={(e) => setForm({ ...form, commission_notes_en: e.target.value })}
                        placeholder="e.g. 10% for penthouses, 5% for 1BR/2BR; SAR 50,000 max cap; individual unit payout differs based on layout."
                        className="form-input"
                        style={{ backgroundColor: '#FFFFFF', fontSize: '12px' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#14532D' }}>
                        ملاحظات وشروط العمولة والحدود (AR)
                      </label>
                      <textarea
                        rows={2}
                        dir="rtl"
                        value={form.commission_notes_ar || ''}
                        onChange={(e) => setForm({ ...form, commission_notes_ar: e.target.value })}
                        placeholder="مثال: ١٠٪ للشقق العلوية، ٥٪ للغرفة الواحدة، الحد الأقصى ٥٠ ألف ريال."
                        className="form-input"
                        style={{ backgroundColor: '#FFFFFF', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* PROMOTIONAL DISCOUNTS & SPECIAL OFFERS SECTION */}
                <div
                  style={{
                    background: form.discount_offer?.is_active
                      ? 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)'
                      : '#F8FAFC',
                    border: form.discount_offer?.is_active
                      ? '1.5px solid #FDBA74'
                      : '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '16px 18px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: form.discount_offer?.is_active ? '#EA580C' : '#94A3B8',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Flame size={16} />
                      </div>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: form.discount_offer?.is_active ? '#9A3412' : '#334155' }}>
                          Promotional Discounts &amp; Limited-Time Offers
                        </span>
                        <div style={{ fontSize: '11px', color: form.discount_offer?.is_active ? '#C2410C' : '#64748B' }}>
                          Showcase discounts on specific unit types or whole project with countdown urgency on website
                        </div>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        backgroundColor: form.discount_offer?.is_active ? '#FFEDD5' : '#FFFFFF',
                        border: form.discount_offer?.is_active ? '1.5px solid #EA580C' : '1px solid #CBD5E1',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!form.discount_offer?.is_active}
                        onChange={(e) => {
                          const isActive = e.target.checked
                          setForm({
                            ...form,
                            discount_offer: {
                              ...(form.discount_offer || {
                                title_en: '',
                                title_ar: '',
                                discount_type: 'PERCENTAGE',
                                applies_to: 'ALL_UNITS',
                                show_countdown: true,
                              }),
                              is_active: isActive,
                              discount_badge_en: form.discount_offer?.discount_badge_en || 'LIMITED TIME OFFER',
                              discount_badge_ar: form.discount_offer?.discount_badge_ar || 'عرض لفترة محدودة',
                            },
                          })
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#EA580C' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: form.discount_offer?.is_active ? '#9A3412' : '#64748B' }}>
                        {form.discount_offer?.is_active ? '🔥 Discount Offer Active' : 'Enable Discount Offer'}
                      </span>
                    </label>
                  </div>

                  {form.discount_offer?.is_active && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                      {/* Live Enthusiasm Preview Banner */}
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                          color: '#FFFFFF',
                          padding: '14px 16px',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              backgroundColor: '#EA580C',
                              color: '#FFFFFF',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Flame size={12} />
                            {form.discount_offer.discount_badge_en || 'EXCLUSIVE OFFER'}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                              {form.discount_offer.title_en || 'Special Limited-Time Promotional Discount'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#CBD5E1' }}>
                              {form.discount_offer.applies_to === 'SPECIFIC_UNITS' && form.discount_offer.applicable_units_en
                                ? `Valid on: ${form.discount_offer.applicable_units_en}`
                                : 'Valid across all project layouts'}
                            </div>
                          </div>
                        </div>

                        {form.discount_offer.valid_until && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#334155',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              color: '#FED7AA',
                            }}
                          >
                            <Clock size={13} style={{ color: '#FB923C' }} />
                            <span>
                              Expires:{' '}
                              {new Date(form.discount_offer.valid_until).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Offer Titles */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#9A3412' }}>
                            Offer Title / Headline (English) *
                          </label>
                          <input
                            type="text"
                            value={form.discount_offer.title_en || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: { ...form.discount_offer!, title_en: e.target.value },
                              })
                            }
                            placeholder="e.g. Early Bird 5% Discount or National Day Special Offer"
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF' }}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#9A3412' }}>
                            عنوان العرض والخصم (بالعربية) *
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={form.discount_offer.title_ar || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: { ...form.discount_offer!, title_ar: e.target.value },
                              })
                            }
                            placeholder="مثال: خصم 5% للحجز المبكر أو عرض اليوم الوطني الحصري"
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF' }}
                          />
                        </div>
                      </div>

                      {/* Discount Badges */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#9A3412' }}>
                            Marketing Badge / Tag (EN)
                          </label>
                          <input
                            type="text"
                            value={form.discount_offer.discount_badge_en || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: { ...form.discount_offer!, discount_badge_en: e.target.value },
                              })
                            }
                            placeholder="e.g. 5% OFF, SAR 50K DISCOUNT, LIMITED TIME"
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF' }}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#9A3412' }}>
                            شارة العرض التسويقية (AR)
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={form.discount_offer.discount_badge_ar || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: { ...form.discount_offer!, discount_badge_ar: e.target.value },
                              })
                            }
                            placeholder="مثال: خصم ٥٪، خصم ٥٠,٠٠٠ ر.س، لفترة محدودة"
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF' }}
                          />
                        </div>
                      </div>

                      {/* Discount Calculation Type & Unit Applicability */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#9A3412' }}>
                            Discount Type &amp; Value
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                              className="form-select"
                              style={{ width: '55%', backgroundColor: '#FFFFFF', fontSize: '12px' }}
                              value={form.discount_offer.discount_type}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  discount_offer: {
                                    ...form.discount_offer!,
                                    discount_type: e.target.value as any,
                                  },
                                })
                              }
                            >
                              <option value="PERCENTAGE">Percentage (% Off)</option>
                              <option value="FIXED_AMOUNT">Fixed SAR Discount</option>
                              <option value="CUSTOM_TEXT">Custom Package Offer</option>
                            </select>

                            <input
                              type="number"
                              value={form.discount_offer.discount_value ?? ''}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  discount_offer: {
                                    ...form.discount_offer!,
                                    discount_value: e.target.value ? Number(e.target.value) : null,
                                  },
                                })
                              }
                              placeholder={
                                form.discount_offer.discount_type === 'PERCENTAGE'
                                  ? 'e.g. 5 (%)'
                                  : form.discount_offer.discount_type === 'FIXED_AMOUNT'
                                  ? 'e.g. 50000 (SAR)'
                                  : 'Optional value'
                              }
                              className="form-input"
                              style={{ width: '45%', backgroundColor: '#FFFFFF' }}
                            />
                          </div>
                        </div>

                        {/* Unit Applicability Selector */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#9A3412' }}>
                            Applicability (Targeted Apartments / Layouts) *
                          </label>
                          <select
                            className="form-select"
                            style={{ backgroundColor: '#FFFFFF', fontSize: '12px' }}
                            value={form.discount_offer.applies_to}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: {
                                  ...form.discount_offer!,
                                  applies_to: e.target.value as any,
                                },
                              })
                            }
                          >
                            <option value="ALL_UNITS">All Apartments / Entire Project (الكل)</option>
                            <option value="SPECIFIC_UNITS">Specific Unit Types Only (شقق / نماذج محددة فقط)</option>
                          </select>
                        </div>
                      </div>

                      {/* If Specific Units Selected */}
                      {form.discount_offer.applies_to === 'SPECIFIC_UNITS' && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                            backgroundColor: '#FFFFFF',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px dashed #F97316',
                          }}
                        >
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700, color: '#C2410C' }}>
                              Eligible Unit Types (EN) *
                            </label>
                            <input
                              type="text"
                              value={form.discount_offer.applicable_units_en || ''}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  discount_offer: {
                                    ...form.discount_offer!,
                                    applicable_units_en: e.target.value,
                                  },
                                })
                              }
                              placeholder="e.g. 3-Bedroom Apartments &amp; Penthouses Only"
                              className="form-input"
                              style={{ backgroundColor: '#FFF7ED' }}
                            />
                            <span style={{ fontSize: '10.5px', color: '#9A3412', marginTop: '2px' }}>
                              Clarifies to buyers exactly which apartment models receive this discount.
                            </span>
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ textAlign: 'right', fontSize: '11.5px', fontWeight: 700, color: '#C2410C' }}>
                              النماذج والشقق المؤهلة للخصم (AR) *
                            </label>
                            <input
                              type="text"
                              dir="rtl"
                              value={form.discount_offer.applicable_units_ar || ''}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  discount_offer: {
                                    ...form.discount_offer!,
                                    applicable_units_ar: e.target.value,
                                  },
                                })
                              }
                              placeholder="مثال: شقق ٣ غرف نوم والبنتهاوس فقط"
                              className="form-input"
                              style={{ backgroundColor: '#FFF7ED' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Original vs Discounted Pricing Display (Optional strike-through) */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11.5px', color: '#78350F' }}>
                            Original Starting Price (Before Discount Display - EN)
                          </label>
                          <input
                            type="text"
                            value={form.discount_offer.original_price_en || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: {
                                  ...form.discount_offer!,
                                  original_price_en: e.target.value,
                                },
                              })
                            }
                            placeholder="e.g. SAR 750,000"
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF' }}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11.5px', color: '#78350F', fontWeight: 700 }}>
                            Discounted Price (Promotional Starting Price - EN)
                          </label>
                          <input
                            type="text"
                            value={form.discount_offer.discounted_price_en || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: {
                                  ...form.discount_offer!,
                                  discounted_price_en: e.target.value,
                                },
                              })
                            }
                            placeholder="e.g. SAR 699,000 (Special Deal)"
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#F97316', fontWeight: 700 }}
                          />
                        </div>
                      </div>

                      {/* Validity Date & Countdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: '#9A3412', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} style={{ color: '#EA580C' }} />
                            <span>Valid Until / Expiration Date (ISO Date)</span>
                          </label>
                          <input
                            type="date"
                            value={
                              form.discount_offer.valid_until
                                ? form.discount_offer.valid_until.split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: {
                                  ...form.discount_offer!,
                                  valid_until: e.target.value ? new Date(e.target.value).toISOString() : '',
                                },
                              })
                            }
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF' }}
                          />
                          <span style={{ fontSize: '10.5px', color: '#9A3412', marginTop: '2px' }}>
                            Offer will automatically show countdown urgency and expire once date is reached.
                          </span>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#9A3412' }}>
                            Countdown Timer &amp; Urgency
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                            <input
                              type="checkbox"
                              checked={form.discount_offer.show_countdown ?? true}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  discount_offer: {
                                    ...form.discount_offer!,
                                    show_countdown: e.target.checked,
                                  },
                                })
                              }
                              style={{ width: '16px', height: '16px', accentColor: '#EA580C' }}
                            />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#7C2D12' }}>
                              Show Live Countdown Timer on Public Website
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Offer Terms & Exclusivity Note */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11.5px', color: '#9A3412' }}>
                            Offer Terms / Urgency Note (EN)
                          </label>
                          <input
                            type="text"
                            value={form.discount_offer.terms_note_en || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: {
                                  ...form.discount_offer!,
                                  terms_note_en: e.target.value,
                                },
                              })
                            }
                            placeholder="e.g. Valid on first 5 signed reservations this month only."
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF', fontSize: '12px' }}
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ textAlign: 'right', fontSize: '11.5px', color: '#9A3412' }}>
                            شروط العرض والرمز التسويقي (AR)
                          </label>
                          <input
                            type="text"
                            dir="rtl"
                            value={form.discount_offer.terms_note_ar || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                discount_offer: {
                                  ...form.discount_offer!,
                                  terms_note_ar: e.target.value,
                                },
                              })
                            }
                            placeholder="مثال: يسري على أول ٥ حجوزات مؤكدة فقط هذا الشهر."
                            className="form-input"
                            style={{ backgroundColor: '#FFFFFF', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Terms / Options */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={13} style={{ color: '#2563EB' }} />
                      <span>Payment Terms / Method</span>
                    </label>
                    <select
                      className="form-input"
                      value={
                        form.payment_terms_en === 'Cash Only'
                          ? 'Cash Only'
                          : form.payment_terms_en === 'Installment Available'
                          ? 'Installment Available'
                          : 'Cash + Installment Available'
                      }
                      onChange={(e) => {
                        const val = e.target.value
                        let arVal = 'كاش + أقساط متاحة'
                        if (val === 'Cash Only') arVal = 'كاش فقط'
                        else if (val === 'Installment Available') arVal = 'أقساط متاحة'
                        setForm({ ...form, payment_terms_en: val, payment_terms_ar: arVal })
                      }}
                    >
                      <option value="Cash + Installment Available">Cash + Installment Available (كاش + أقساط متاحة)</option>
                      <option value="Cash Only">Cash Only (كاش فقط)</option>
                      <option value="Installment Available">Installment Available (أقساط متاحة)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>طريقة الدفع (بالعربية)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={form.payment_terms_ar || ''}
                      onChange={(e) => setForm({ ...form, payment_terms_ar: e.target.value })}
                      placeholder="مثال: كاش + أقساط متاحة"
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

                {/* Predefined Standard Property Types */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Property Type (Standard Category) *
                    </label>
                    <select
                      className="form-input"
                      value={
                        ['Apartments', 'Villas', 'Commercial Buildings', 'Residential Buildings', 'Land'].includes(normalizePropertyType(form.type_en))
                          ? normalizePropertyType(form.type_en)
                          : form.type_en
                          ? 'CUSTOM'
                          : 'Apartments'
                      }
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'Apartments') {
                          setForm({
                            ...form,
                            type_en: 'Apartments',
                            type_ar: 'شقق سكنية',
                            status_en: form.status_en === 'Ready for Development' ? 'Off-Plan' : form.status_en,
                            status_ar: form.status_ar === 'جاهز للتطوير' ? 'على المخطط' : form.status_ar,
                          })
                        } else if (val === 'Villas') {
                          setForm({
                            ...form,
                            type_en: 'Villas',
                            type_ar: 'فلل سكنية',
                            status_en: form.status_en === 'Ready for Development' ? 'Off-Plan' : form.status_en,
                            status_ar: form.status_ar === 'جاهز للتطوير' ? 'على المخطط' : form.status_ar,
                          })
                        } else if (val === 'Commercial Buildings') {
                          setForm({
                            ...form,
                            type_en: 'Commercial Buildings',
                            type_ar: 'مباني تجارية',
                            status_en: form.status_en === 'Ready for Development' ? 'Off-Plan' : form.status_en,
                            status_ar: form.status_ar === 'جاهز للتطوير' ? 'على المخطط' : form.status_ar,
                          })
                        } else if (val === 'Residential Buildings') {
                          setForm({
                            ...form,
                            type_en: 'Residential Buildings',
                            type_ar: 'عمائر سكنية',
                            status_en: form.status_en === 'Ready for Development' ? 'Off-Plan' : form.status_en,
                            status_ar: form.status_ar === 'جاهز للتطوير' ? 'على المخطط' : form.status_ar,
                          })
                        } else if (val === 'Land') {
                          setForm({
                            ...form,
                            type_en: 'Land',
                            type_ar: 'أراضي',
                            status_en: 'Ready for Development',
                            status_ar: 'جاهز للتطوير',
                          })
                        } else if (val === 'CUSTOM') {
                          setForm({ ...form, type_en: '', type_ar: '' })
                        }
                      }}
                    >
                      <option value="Apartments">Apartments (شقق سكنية)</option>
                      <option value="Villas">Villas (فلل سكنية)</option>
                      <option value="Commercial Buildings">Commercial Buildings (مباني تجارية)</option>
                      <option value="Residential Buildings">Residential Buildings (عمائر سكنية)</option>
                      <option value="Land">Land (أراضي)</option>
                      <option value="CUSTOM">Custom / Other Category...</option>
                    </select>
                    <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Standardized category used for website filters and marketing tags.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right', fontWeight: 700 }}>نوع العقار (بالعربية) *</label>
                    <input
                      type="text"
                      dir="rtl"
                      required
                      value={form.type_ar || 'شقق سكنية'}
                      onChange={(e) => setForm({ ...form, type_ar: e.target.value })}
                      placeholder="مثال: شقق سكنية / فلل / أراضي"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* If custom selected */}
                {!['Apartments', 'Villas', 'Commercial Buildings', 'Residential Buildings', 'Land'].includes(form.type_en || '') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Custom Property Type (EN)</label>
                      <input
                        type="text"
                        value={form.type_en || ''}
                        onChange={(e) => setForm({ ...form, type_en: e.target.value })}
                        placeholder="e.g. Mixed-Use Waterfront"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ textAlign: 'right' }}>نوع العقار المخصص (AR)</label>
                      <input
                        type="text"
                        dir="rtl"
                        value={form.type_ar || ''}
                        onChange={(e) => setForm({ ...form, type_ar: e.target.value })}
                        placeholder="مثال: مشروع متعدد الاستخدامات"
                        className="form-input"
                      />
                    </div>
                  </div>
                )}

                {/* Project Status & Expected Delivery (Adapts automatically if Property Type is Land) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">
                      {form.type_en === 'Land' ? 'Land Development Status (EN) *' : 'Project Status (EN) *'}
                    </label>
                    {form.type_en === 'Land' ? (
                      <select
                        className="form-input"
                        value={
                          form.status_en === 'Off-Plan / Subdivided' || form.status_en === 'Off-Plan'
                            ? 'Off-Plan / Subdivided'
                            : form.status_en === 'Raw Land / Zoned'
                            ? 'Raw Land / Zoned'
                            : form.status_en === 'Under Development'
                            ? 'Under Development'
                            : form.status_en === 'Sold Out'
                            ? 'Sold Out'
                            : 'Ready for Development'
                        }
                        onChange={(e) => {
                          const val = e.target.value
                          let arVal = 'جاهز للتطوير'
                          if (val === 'Off-Plan / Subdivided') arVal = 'مخطط معتمد / على المخطط'
                          else if (val === 'Raw Land / Zoned') arVal = 'أرض خام معتمدة'
                          else if (val === 'Under Development') arVal = 'قيد التطوير والتجهيز'
                          else if (val === 'Sold Out') arVal = 'تم البيع بالكامل'
                          setForm({ ...form, status_en: val, status_ar: arVal })
                        }}
                      >
                        <option value="Ready for Development">Ready for Development (جاهز للتطوير)</option>
                        <option value="Off-Plan / Subdivided">Off-Plan / Subdivided (مخطط معتمد / على المخطط)</option>
                        <option value="Raw Land / Zoned">Raw Land / Zoned (أرض خام معتمدة)</option>
                        <option value="Under Development">Under Development (قيد التطوير والتجهيز)</option>
                        <option value="Sold Out">Sold Out (تم البيع بالكامل)</option>
                      </select>
                    ) : (
                      <select
                        className="form-input"
                        value={
                          form.status_en === 'Under Construction'
                            ? 'Under Construction'
                            : form.status_en === 'Ready to Move' || form.status_en === 'Ready'
                            ? 'Ready to Move'
                            : form.status_en === 'Completed'
                            ? 'Completed'
                            : form.status_en === 'Sold Out'
                            ? 'Sold Out'
                            : 'Off-Plan'
                        }
                        onChange={(e) => {
                          const val = e.target.value
                          let arVal = 'على المخطط'
                          if (val === 'Under Construction') arVal = 'تحت الإنشاء'
                          else if (val === 'Ready to Move') arVal = 'جاهز للسكن'
                          else if (val === 'Completed') arVal = 'مكتمل'
                          else if (val === 'Sold Out') arVal = 'تم البيع بالكامل'
                          setForm({ ...form, status_en: val, status_ar: arVal })
                        }}
                      >
                        <option value="Off-Plan">Off-Plan (على المخطط)</option>
                        <option value="Under Construction">Under Construction (تحت الإنشاء)</option>
                        <option value="Ready to Move">Ready to Move (جاهز للسكن)</option>
                        <option value="Completed">Completed (مكتمل)</option>
                        <option value="Sold Out">Sold Out (تم البيع بالكامل)</option>
                      </select>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'right' }}>
                      {form.type_en === 'Land' ? 'حالة الأرض / المخطط (AR) *' : 'حالة المشروع (بالعربية) *'}
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={form.status_ar || (form.type_en === 'Land' ? 'جاهز للتطوير' : 'على المخطط')}
                      onChange={(e) => setForm({ ...form, status_ar: e.target.value })}
                      placeholder="مثال: جاهز للتطوير / على المخطط / جاهز للسكن"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Delivery / Handover Date</label>
                    <input
                      type="text"
                      value={form.expected_delivery_en || ''}
                      onChange={(e) => setForm({ ...form, expected_delivery_en: e.target.value })}
                      placeholder={form.type_en === 'Land' ? 'e.g. Ready / تسليم فوري' : 'e.g. Q4 2026 / جاهز للتسليم'}
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '8px', marginBottom: '12px' }}>
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
                              gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto',
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">English Brochure URL (PDF / File Link)</label>
                      <input
                        type="url"
                        value={form.brochure_url_en || form.brochure_url || ''}
                        onChange={(e) => setForm({ ...form, brochure_url_en: e.target.value, brochure_url: e.target.value })}
                        placeholder="https://.../Suhail-Compound-EN.pdf"
                        className="form-input"
                      />
                      <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        Used for English website visitors (fallback for Arabic if Arabic is not provided).
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ textAlign: 'right' }}>رابط كتيب المشروع بالعربية (PDF / ملف)</label>
                      <input
                        type="url"
                        dir="ltr"
                        value={form.brochure_url_ar || ''}
                        onChange={(e) => setForm({ ...form, brochure_url_ar: e.target.value })}
                        placeholder="https://.../Suhail-Compound-AR.pdf"
                        className="form-input"
                      />
                      <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', display: 'block', textAlign: 'right' }}>
                        يُستخدم لزوار الموقع باللغة العربية (اختياري).
                      </span>
                    </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Video size={16} style={{ color: '#D97706' }} />
                      <span>Project Showcase Videos ({(form.video_items || []).length})</span>
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      Add multiple YouTube embed links, Vimeo links, or direct MP4 URLs.
                    </span>
                  </div>

                  {/* Add Video Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="url"
                      placeholder="Video URL (e.g. https://www.youtube.com/embed/...)"
                      value={newVideo.url}
                      onChange={(e) => setNewVideo({ ...newVideo, url: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      placeholder="Title (EN) e.g. Virtual Tour"
                      value={newVideo.titleEn || ''}
                      onChange={(e) => setNewVideo({ ...newVideo, titleEn: e.target.value })}
                      className="form-input"
                    />
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="العنوان (AR) مثال: جولة افتراضية"
                      value={newVideo.titleAr || ''}
                      onChange={(e) => setNewVideo({ ...newVideo, titleAr: e.target.value })}
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={addVideo}
                      className="btn btn-outline btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Plus size={14} />
                      <span>Add Video</span>
                    </button>
                  </div>

                  {/* Video Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(form.video_items || []).length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', border: '1px dashed #CBD5E1', borderRadius: '6px' }}>
                        No videos added yet. Enter a YouTube embed or video link above to add.
                      </div>
                    )}
                    {(form.video_items || []).map((vid, idx) => {
                      const isEditing = editingVideoIndex === idx
                      if (isEditing) {
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '2fr 1fr 1fr auto auto',
                              gap: '8px',
                              alignItems: 'center',
                              padding: '8px 10px',
                              backgroundColor: '#EFF6FF',
                              border: '1px solid #93C5FD',
                              borderRadius: '6px',
                            }}
                          >
                            <input
                              type="url"
                              placeholder="Video URL"
                              value={editVideo.url}
                              onChange={(e) => setEditVideo({ ...editVideo, url: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              placeholder="Title (EN)"
                              value={editVideo.titleEn || ''}
                              onChange={(e) => setEditVideo({ ...editVideo, titleEn: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <input
                              type="text"
                              dir="rtl"
                              placeholder="العنوان (AR)"
                              value={editVideo.titleAr || ''}
                              onChange={(e) => setEditVideo({ ...editVideo, titleAr: e.target.value })}
                              className="form-input"
                              style={{ backgroundColor: '#FFFFFF' }}
                            />
                            <button
                              type="button"
                              onClick={saveEditVideo}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '6px 10px' }}
                              title="Save video"
                            >
                              <Check size={14} />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditVideo}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 8px' }}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      }

                      const isFirst = idx === 0
                      const isLast = idx === (form.video_items || []).length - 1

                      return (
                        <div
                          key={`${vid.url}-${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '8px 12px',
                            backgroundColor: isFirst ? '#F0FDF4' : '#FFFFFF',
                            border: `1px solid ${isFirst ? '#86EFAC' : '#E2E8F0'}`,
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            transition: 'background-color 0.15s ease, border-color 0.15s ease',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: isFirst ? '#15803D' : '#2563EB', backgroundColor: isFirst ? '#DCFCE7' : '#EFF6FF', border: `1px solid ${isFirst ? '#BBF7D0' : '#DBEAFE'}`, padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>
                              {isFirst ? '⭐ 1st / Primary' : `#${idx + 1}`}
                            </span>
                            {vid.titleEn && (
                              <span style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {vid.titleEn}
                              </span>
                            )}
                            {vid.titleAr && (
                              <span style={{ color: '#64748B', whiteSpace: 'nowrap', flexShrink: 0 }}>({vid.titleAr})</span>
                            )}
                            <span
                              style={{
                                fontSize: '11.5px',
                                color: '#64748B',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0,
                                display: 'block',
                              }}
                              title={vid.url}
                            >
                              {vid.url}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {isFirst ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '28px',
                                  color: '#F59E0B',
                                }}
                                title="Featured Primary Video"
                              >
                                <Star size={15} fill="#F59E0B" stroke="#D97706" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => makeVideoPrimary(idx)}
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ color: '#94A3B8' }}
                                title="Click to set as 1st / Featured Video"
                              >
                                <Star size={14} fill="none" stroke="#94A3B8" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => moveVideoUp(idx)}
                              disabled={isFirst}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: isFirst ? '#CBD5E1' : '#475569' }}
                              title="Move Up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveVideoDown(idx)}
                              disabled={isLast}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: isLast ? '#CBD5E1' : '#475569' }}
                              title="Move Down"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditVideo(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#0284C7' }}
                              title="Edit video"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVideo(idx)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#EF4444' }}
                              title="Delete video"
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

            {/* TAB 6: FLOOR PLANS */}
            {activeTab === 'floorplans' && (
              <ImageGalleryManager
                images={form.floor_plans || []}
                onChange={(updatedFloorPlans) => setForm({ ...form, floor_plans: updatedFloorPlans })}
                folder="asaheeb/floorplans"
                title={`Floor Plans & Layout Diagrams (${(form.floor_plans || []).length} ${(form.floor_plans || []).length === 1 ? 'diagram' : 'diagrams'})`}
                description="Upload architectural layouts and floor plan drawings (PNG, JPG, WebP, SVG). If you have PDF blueprints, convert pages to images and upload here."
              />
            )}

            {/* TAB 7: PHOTO GALLERY */}
            {activeTab === 'gallery' && (
              <ImageGalleryManager
                images={form.images || []}
                onChange={(updatedImages) => setForm({ ...form, images: updatedImages })}
                folder="asaheeb/projects"
              />
            )}

            {/* TAB 8: ACTIVITY LOG */}
            {activeTab === 'activity' && project && (
              <CmsActivityTimeline
                entityType="PROJECT"
                entityId={project.id}
                entityTitle={project.name_en}
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
