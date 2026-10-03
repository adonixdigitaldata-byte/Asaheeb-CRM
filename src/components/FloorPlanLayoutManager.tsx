'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  UploadCloud,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit3,
  Layers,
  Check,
  X,
  Maximize2,
  Tag,
  Home,
  CheckCircle2,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  FileText,
} from 'lucide-react'
import type { FloorPlanLayout } from '@/types/database'

export const LAYOUT_CATEGORIES = [
  { id: 'studio', labelEn: 'Studio', labelAr: 'استوديو' },
  { id: '1_bed', labelEn: '1 Bedroom', labelAr: 'غرفة نوم واحدة' },
  { id: '2_bed', labelEn: '2 Bedrooms', labelAr: 'غرفتا نوم' },
  { id: '3_bed', labelEn: '3 Bedrooms', labelAr: '٣ غرف نوم' },
  { id: '4_bed', labelEn: '4+ Bedrooms', labelAr: '٤+ غرف نوم' },
  { id: 'duplex', labelEn: 'Duplex', labelAr: 'دوبلكس' },
  { id: 'penthouse', labelEn: 'Penthouse', labelAr: 'بنتهاوس' },
  { id: 'villa', labelEn: 'Villa / Townhouse', labelAr: 'فيلا / تاون هاوس' },
] as const

const FEATURE_PRESETS = [
  { en: 'Private Terrace', ar: 'تراس خاص' },
  { en: 'Open Kitchen', ar: 'مطبخ مفتوح' },
  { en: "Maid's Room", ar: 'غرفة خادمة' },
  { en: 'Powder Room', ar: 'دورة مياه ضيوف' },
  { en: 'Walk-in Closet', ar: 'خزانة ملابس مدمجة' },
  { en: 'Panoramic View', ar: 'إطلالة بانورامية' },
  { en: 'Smart Home Automation', ar: 'نظام منزل ذكي' },
  { en: 'Storage Room', ar: 'مستودع' },
  { en: 'Balcony', ar: 'شرفة' },
]

interface Props {
  layouts: FloorPlanLayout[]
  onChange: (layouts: FloorPlanLayout[]) => void
  folder?: string
}

export default function FloorPlanLayoutManager({
  layouts = [],
  onChange,
  folder = 'asaheeb/floorplans',
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FloorPlanLayout | null>(null)
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [directUrl, setDirectUrl] = useState('')
  const [newFeatureEn, setNewFeatureEn] = useState('')
  const [newFeatureAr, setNewFeatureAr] = useState('')
  const [previewZoomUrl, setPreviewZoomUrl] = useState<string | null>(null)

  // Ensure Cloudinary script is loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).cloudinary) {
      const script = document.createElement('script')
      script.src = 'https://upload-widget.cloudinary.com/global/all.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  function openCloudinaryNativeWidget() {
    if (typeof window === 'undefined') return

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'diwqmlpr'
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'asaheeb_preset'

    if (!(window as any).cloudinary) {
      const script = document.createElement('script')
      script.src = 'https://upload-widget.cloudinary.com/global/all.js'
      script.async = true
      script.onload = () => openCloudinaryNativeWidget()
      document.body.appendChild(script)
      return
    }

    try {
      const widget = (window as any).cloudinary.createUploadWidget(
        {
          cloudName,
          uploadPreset,
          folder,
          sources: ['local', 'url', 'camera', 'google_drive', 'dropbox'],
          multiple: true,
          clientAllowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'svg'],
          resourceType: 'image',
          theme: 'minimal',
        },
        (err: any, result: any) => {
          if (!err && result && result.event === 'success') {
            const uploadedUrl = result.info.secure_url
            if (uploadedUrl) {
              handleAddNewPlan(uploadedUrl)
            }
          }
        }
      )
      widget.open()
    } catch (e) {
      console.error('Failed to open Cloudinary widget:', e)
    }
  }

  function handleAddNewPlan(url: string) {
    const defaultIndex = layouts.length + 1
    const newPlan: FloorPlanLayout = {
      url: url.trim(),
      model_en: `Model ${defaultIndex}`,
      model_ar: `نموذج ${defaultIndex}`,
      category: '2_bed',
      category_en: '2 Bedrooms',
      category_ar: 'غرفتا نوم',
      area_sqm: 110,
      bedrooms: 2,
      bathrooms: 2,
      features_en: ['Open Kitchen', 'Private Terrace'],
      features_ar: ['مطبخ مفتوح', 'تراس خاص'],
      payment_plan_en: '',
      payment_plan_ar: '',
      sort_order: defaultIndex,
      captionEn: `Model ${defaultIndex} · 2 Bedrooms — 110 m²`,
      captionAr: `نموذج ${defaultIndex} · غرفتا نوم — ١١٠ م²`,
    }

    const updated = [...layouts, newPlan]
    onChange(updated)

    // Automatically open editor on the newly added plan
    setEditingIndex(updated.length - 1)
    setEditForm(newPlan)
  }

  function handleStartEdit(index: number) {
    setEditingIndex(index)
    const item = layouts[index]
    const legacyCapEn = item.captionEn || (item as any).caption_en || (item as any).description_en || ''
    const legacyCapAr = item.captionAr || (item as any).caption_ar || (item as any).description_ar || ''

    // Ensure category is explicitly resolved from existing fields if missing or generic 'layout'
    let resolvedCat = item.category
    if (!resolvedCat || resolvedCat === 'layout') {
      if (item.category_en && item.category_en.toLowerCase() !== 'layout') {
        const found = LAYOUT_CATEGORIES.find((c) => c.labelEn.toLowerCase() === item.category_en?.toLowerCase())
        if (found) resolvedCat = found.id
      }
      if (!resolvedCat && item.bedrooms) {
        if (item.bedrooms === 1) resolvedCat = '1_bed'
        else if (item.bedrooms === 2) resolvedCat = '2_bed'
        else if (item.bedrooms === 3) resolvedCat = '3_bed'
        else if (item.bedrooms === 4) resolvedCat = '4_bed'
      }
      if (!resolvedCat) {
        if (/2\s*bed/i.test(legacyCapEn)) resolvedCat = '2_bed'
        else if (/1\s*bed/i.test(legacyCapEn)) resolvedCat = '1_bed'
        else if (/3\s*bed/i.test(legacyCapEn)) resolvedCat = '3_bed'
        else if (/studio/i.test(legacyCapEn)) resolvedCat = 'studio'
        else resolvedCat = '2_bed'
      }
    }
    const catObj = LAYOUT_CATEGORIES.find((c) => c.id === resolvedCat)

    setEditForm({
      ...item,
      category: resolvedCat,
      category_en: catObj?.labelEn || item.category_en || '2 Bedrooms',
      category_ar: catObj?.labelAr || item.category_ar || 'غرفتا نوم',
      captionEn: legacyCapEn,
      captionAr: legacyCapAr,
      description_en: item.description_en || legacyCapEn,
      description_ar: item.description_ar || legacyCapAr,
      features_en: Array.isArray(item.features_en) ? [...item.features_en] : [],
      features_ar: Array.isArray(item.features_ar) ? [...item.features_ar] : [],
    })
  }

  function handleSaveEdit() {
    if (editingIndex === null || !editForm) return

    // Auto-sync legacy caption if not explicitly entered
    const selectedCatId = editForm.category || '2_bed'
    const cat = LAYOUT_CATEGORIES.find((c) => c.id === selectedCatId)
    const catEn = cat?.labelEn || '2 Bedrooms'
    const catAr = cat?.labelAr || 'غرفتا نوم'

    const areaText = editForm.area_sqm ? ` — ${editForm.area_sqm} m²` : ''
    const areaTextAr = editForm.area_sqm ? ` — ${editForm.area_sqm} م²` : ''
    const bedsText = editForm.bedrooms ? ` · ${editForm.bedrooms} Beds` : ''
    const bedsTextAr = editForm.bedrooms ? ` · ${editForm.bedrooms} غرف` : ''

    const syncedCaptionEn = `${editForm.model_en || catEn}${areaText}${bedsText}`
    const syncedCaptionAr = `${editForm.model_ar || catAr}${areaTextAr}${bedsTextAr}`

    const finalCapEn = editForm.captionEn !== undefined ? editForm.captionEn.trim() : syncedCaptionEn
    const finalCapAr = editForm.captionAr !== undefined ? editForm.captionAr.trim() : syncedCaptionAr

    const finalized: FloorPlanLayout = {
      ...editForm,
      category: editForm.category || selectedCatId,
      category_en: catEn,
      category_ar: catAr,
      captionEn: finalCapEn,
      captionAr: finalCapAr,
      description_en: finalCapEn,
      description_ar: finalCapAr,
    }

    const updated = [...layouts]
    updated[editingIndex] = finalized
    onChange(updated)

    setEditingIndex(null)
    setEditForm(null)
  }

  function handleCancelEdit() {
    setEditingIndex(null)
    setEditForm(null)
  }

  function handleDelete(index: number) {
    if (!confirm('Are you sure you want to remove this floor plan layout?')) return
    const updated = layouts.filter((_, i) => i !== index)
    onChange(updated)
    if (editingIndex === index) {
      setEditingIndex(null)
      setEditForm(null)
    }
  }

  function handleMove(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= layouts.length) return

    const updated = [...layouts]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    onChange(updated)
  }

  function handleAddFeatureTag(en: string, ar?: string) {
    if (!editForm) return
    const currentEn = editForm.features_en || []
    const currentAr = editForm.features_ar || []

    if (currentEn.includes(en)) return

    setEditForm({
      ...editForm,
      features_en: [...currentEn, en],
      features_ar: ar ? [...currentAr, ar] : currentAr,
    })
  }

  function handleRemoveFeatureTag(index: number) {
    if (!editForm) return
    const nextEn = [...(editForm.features_en || [])]
    const nextAr = [...(editForm.features_ar || [])]
    nextEn.splice(index, 1)
    if (nextAr.length > index) nextAr.splice(index, 1)

    setEditForm({
      ...editForm,
      features_en: nextEn,
      features_ar: nextAr,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header & Actions Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '14px 18px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: '#2563EB' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
              Architectural Floor Plans &amp; Unit Layouts ({layouts.length})
            </h4>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
            Configure blueprint diagrams, model names, room specs, area in m², and layout-specific payment terms.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowUrlModal(true)}
            className="btn btn-sm btn-ghost"
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <LinkIcon size={14} /> Add by Image URL
          </button>

          <button
            type="button"
            onClick={openCloudinaryNativeWidget}
            className="btn btn-sm btn-primary"
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UploadCloud size={15} /> Upload Blueprint
          </button>
        </div>
      </div>

      {/* URL Input Modal */}
      {showUrlModal && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #3B82F6',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 14px rgba(37,99,235,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              Add Floor Plan via Direct Image URL
            </span>
            <button
              type="button"
              onClick={() => setShowUrlModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="https://res.cloudinary.com/... or https://example.com/plan.png"
              className="form-input"
              style={{ flex: 1, fontSize: '12.5px' }}
            />
            <button
              type="button"
              disabled={!directUrl.trim()}
              onClick={() => {
                if (directUrl.trim()) {
                  handleAddNewPlan(directUrl.trim())
                  setDirectUrl('')
                  setShowUrlModal(false)
                }
              }}
              className="btn btn-primary btn-sm"
              style={{ padding: '0 16px' }}
            >
              Add Layout
            </button>
          </div>
        </div>
      )}

      {/* Layout List */}
      {layouts.length === 0 ? (
        <div
          style={{
            border: '2px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: '#F8FAFC',
          }}
        >
          <Layers size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
          <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: '0 0 4px' }}>
            No floor plans added yet
          </h5>
          <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px' }}>
            Upload blueprint drawings or architectural layouts. Each plan will have its own tab, specs, and payment plan breakdown on the public website.
          </p>
          <button
            type="button"
            onClick={openCloudinaryNativeWidget}
            className="btn btn-sm btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <UploadCloud size={14} /> Upload First Blueprint
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {layouts.map((item, index) => {
            const isEditing = editingIndex === index
            const categoryObj = LAYOUT_CATEGORIES.find((c) => c.id === item.category)
            const catBadge = categoryObj?.labelEn || item.category_en || item.category || 'Layout'

            return (
              <div
                key={index}
                style={{
                  background: isEditing ? '#F8FAFC' : '#FFFFFF',
                  border: isEditing ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '14px',
                  boxShadow: isEditing ? '0 4px 16px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s ease',
                }}
              >
                {!isEditing ? (
                  // CARD VIEW
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Thumbnail */}
                    <div
                      style={{
                        position: 'relative',
                        width: '110px',
                        height: '85px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#0F172A',
                        border: '1px solid #CBD5E1',
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      onClick={() => setPreviewZoomUrl(item.url)}
                      title="Click to enlarge blueprint"
                    >
                      <img
                        src={item.url}
                        alt={item.model_en || 'Floor plan'}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#F8FAFC' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Maximize2 size={11} />
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            border: '1px solid #BFDBFE',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          {catBadge}
                        </span>

                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                          {item.model_en || `Layout #${index + 1}`}
                        </span>

                        {item.model_ar && (
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }} dir="rtl">
                            ({item.model_ar})
                          </span>
                        )}

                        {item.starting_price && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#15803D',
                              backgroundColor: '#DCFCE7',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {item.starting_price}
                          </span>
                        )}
                      </div>

                      {/* Specs pills */}
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#475569', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {item.area_sqm ? (
                          <span style={{ fontWeight: 600, background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px' }}>
                            📏 {item.area_sqm} m²
                          </span>
                        ) : null}
                        {item.bedrooms ? (
                          <span style={{ fontWeight: 600, background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px' }}>
                            🛏️ {item.bedrooms} Bed{item.bedrooms > 1 ? 's' : ''}
                          </span>
                        ) : null}
                        {item.bathrooms ? (
                          <span style={{ fontWeight: 600, background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px' }}>
                            🚿 {item.bathrooms} Bath{item.bathrooms > 1 ? 's' : ''}
                          </span>
                        ) : null}
                      </div>

                      {/* Feature tags */}
                      {Array.isArray(item.features_en) && item.features_en.length > 0 && (
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {item.features_en.map((f, fi) => (
                            <span
                              key={fi}
                              style={{
                                fontSize: '11px',
                                color: '#334155',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              • {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Description / Caption text preview */}
                      {(item.captionEn || (item as any).description_en) && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748B',
                            marginTop: '6px',
                            lineHeight: '1.4',
                            backgroundColor: '#F8FAFC',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px dashed #CBD5E1',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#334155' }}>Description: </span>
                          <span>{item.captionEn || (item as any).description_en}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        className="btn btn-xs btn-ghost"
                        title="Move Up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={index === layouts.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        className="btn btn-xs btn-ghost"
                        title="Move Down"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(index)}
                        className="btn btn-xs btn-outline btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={13} /> Edit Specs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        className="btn btn-xs btn-ghost"
                        style={{ color: '#DC2626' }}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  // INLINE SPECS EDITOR
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Edit3 size={15} style={{ color: '#2563EB' }} />
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A' }}>
                          Editing Layout Specs (#{index + 1})
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="btn btn-xs btn-ghost"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="btn btn-xs btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={13} /> Done Editing
                        </button>
                      </div>
                    </div>

                    {editForm && (
                      <>
                        {/* 1. Model Name & Category */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                              Layout / Model Name (EN) *
                            </label>
                            <input
                              type="text"
                              value={editForm.model_en || ''}
                              onChange={(e) => setEditForm({ ...editForm, model_en: e.target.value })}
                              placeholder="e.g. Model 2A"
                              className="form-input"
                              style={{ fontSize: '12px' }}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ textAlign: 'right', fontSize: '11.5px', fontWeight: 700 }}>
                              اسم النموذج (AR)
                            </label>
                            <input
                              type="text"
                              dir="rtl"
                              value={editForm.model_ar || ''}
                              onChange={(e) => setEditForm({ ...editForm, model_ar: e.target.value })}
                              placeholder="مثال: نموذج 2A"
                              className="form-input"
                              style={{ fontSize: '12px' }}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                              Unit Filter Category *
                            </label>
                            <select
                              value={editForm.category || '2_bed'}
                              onChange={(e) => {
                                const val = e.target.value
                                const cat = LAYOUT_CATEGORIES.find((c) => c.id === val)
                                setEditForm({
                                  ...editForm,
                                  category: val,
                                  category_en: cat?.labelEn,
                                  category_ar: cat?.labelAr,
                                })
                              }}
                              className="form-input"
                              style={{ fontSize: '12px' }}
                            >
                              {LAYOUT_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.labelEn} ({c.labelAr})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* 2. Specs: Area, Beds, Baths, Starting Price */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '10px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                              Net Area (m²)
                            </label>
                            <input
                              type="number"
                              value={editForm.area_sqm || ''}
                              onChange={(e) => setEditForm({ ...editForm, area_sqm: e.target.value ? Number(e.target.value) : null })}
                              placeholder="e.g. 114"
                              className="form-input"
                              style={{ fontSize: '12px' }}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                              Bedrooms
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={editForm.bedrooms || ''}
                              onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value ? Number(e.target.value) : null })}
                              placeholder="e.g. 2"
                              className="form-input"
                              style={{ fontSize: '12px' }}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                              Bathrooms
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={editForm.bathrooms || ''}
                              onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value ? Number(e.target.value) : null })}
                              placeholder="e.g. 2.5"
                              className="form-input"
                              style={{ fontSize: '12px' }}
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                              Starting Price (Optional)
                            </label>
                            <input
                              type="text"
                              value={editForm.starting_price || ''}
                              onChange={(e) => setEditForm({ ...editForm, starting_price: e.target.value })}
                              placeholder="e.g. SAR 1,250,000"
                              className="form-input"
                              style={{ fontSize: '12px' }}
                            />
                          </div>
                        </div>

                        {/* 3. Features Tags */}
                        <div>
                          <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                            Layout Key Features (Pill Tags)
                          </label>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {(editForm.features_en || []).map((feat, fi) => (
                              <span
                                key={fi}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11.5px',
                                  backgroundColor: '#EFF6FF',
                                  color: '#1E40AF',
                                  border: '1px solid #BFDBFE',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                {feat}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFeatureTag(fi)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1E40AF' }}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>

                          {/* Quick Preset Buttons */}
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Quick add:</span>
                            {FEATURE_PRESETS.map((p, pi) => (
                              <button
                                key={pi}
                                type="button"
                                onClick={() => handleAddFeatureTag(p.en, p.ar)}
                                style={{
                                  fontSize: '10.5px',
                                  background: '#F1F5F9',
                                  border: '1px solid #CBD5E1',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                              >
                                + {p.en}
                              </button>
                            ))}
                          </div>

                          {/* Custom Feature Input */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              value={newFeatureEn}
                              onChange={(e) => setNewFeatureEn(e.target.value)}
                              placeholder="Add custom feature (EN)..."
                              className="form-input"
                              style={{ flex: 1, fontSize: '11.5px', padding: '4px 8px' }}
                            />
                            <input
                              type="text"
                              dir="rtl"
                              value={newFeatureAr}
                              onChange={(e) => setNewFeatureAr(e.target.value)}
                              placeholder="إضافة ميزة مخصصة (AR)..."
                              className="form-input"
                              style={{ flex: 1, fontSize: '11.5px', padding: '4px 8px' }}
                            />
                            <button
                              type="button"
                              disabled={!newFeatureEn.trim()}
                              onClick={() => {
                                if (newFeatureEn.trim()) {
                                  handleAddFeatureTag(newFeatureEn.trim(), newFeatureAr.trim() || undefined)
                                  setNewFeatureEn('')
                                  setNewFeatureAr('')
                                }
                              }}
                              className="btn btn-xs btn-outline"
                            >
                              Add Tag
                            </button>
                          </div>
                        </div>

                        {/* 4. Detailed Description / Caption */}
                        <div
                          style={{
                            background: '#F8FAFC',
                            border: '1.5px solid #E2E8F0',
                            borderRadius: '8px',
                            padding: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileText size={14} style={{ color: '#2563EB' }} />
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                                Layout Detailed Description / Caption
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#1E40AF', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: '4px' }}>
                                Shown on main website layout card
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const cat = LAYOUT_CATEGORIES.find((c) => c.id === editForm.category)
                                const catName = cat?.labelEn || 'Layout'
                                const parts = []
                                if (editForm.model_en) parts.push(editForm.model_en)
                                if (editForm.bedrooms) parts.push(`${editForm.bedrooms} bedrooms`)
                                if (editForm.bathrooms) parts.push(`${editForm.bathrooms} bathrooms`)
                                if (editForm.area_sqm) parts.push(`${editForm.area_sqm} m²`)
                                if (editForm.starting_price) parts.push(editForm.starting_price)
                                const genEn = parts.length > 0 ? parts.join(', ') : `${catName}`

                                const partsAr = []
                                if (editForm.model_ar) partsAr.push(editForm.model_ar)
                                if (editForm.bedrooms) partsAr.push(`${editForm.bedrooms} غرف نوم`)
                                if (editForm.bathrooms) partsAr.push(`${editForm.bathrooms} حمامات`)
                                if (editForm.area_sqm) partsAr.push(`${editForm.area_sqm} م²`)
                                if (editForm.starting_price) partsAr.push(editForm.starting_price)
                                const genAr = partsAr.length > 0 ? partsAr.join('، ') : (cat?.labelAr || 'نموذج')

                                setEditForm({
                                  ...editForm,
                                  captionEn: genEn,
                                  captionAr: genAr,
                                  description_en: genEn,
                                  description_ar: genAr,
                                })
                              }}
                              className="btn btn-xs btn-ghost"
                              style={{ fontSize: '11px', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Sparkles size={12} /> Auto-Generate from Specs
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                                Description / Caption (EN)
                              </label>
                              <textarea
                                rows={2}
                                value={editForm.captionEn || ''}
                                onChange={(e) => setEditForm({ ...editForm, captionEn: e.target.value, description_en: e.target.value })}
                                placeholder="e.g. Model A1: 2 bedrooms + majlis, 3 bathrooms, 111.48 m², overlooking garden. SAR 390K"
                                className="form-input"
                                style={{ fontSize: '11.5px', backgroundColor: '#FFFFFF' }}
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ textAlign: 'right', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                                الوصف والتفاصيل (AR)
                              </label>
                              <textarea
                                rows={2}
                                dir="rtl"
                                value={editForm.captionAr || ''}
                                onChange={(e) => setEditForm({ ...editForm, captionAr: e.target.value, description_ar: e.target.value })}
                                placeholder="مثال: نموذج A1: غرفتا نوم + مجلس، ٣ حمامات، ١١١.٤٨ م²، إطلالة على الحديقة..."
                                className="form-input"
                                style={{ fontSize: '11.5px', backgroundColor: '#FFFFFF' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Blueprint Image URL modifier */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap' }}>Blueprint URL:</span>
                          <input
                            type="text"
                            value={editForm.url || ''}
                            onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                            className="form-input"
                            style={{ fontSize: '11px', flex: 1, padding: '3px 8px' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Blueprint Image Zoom Modal */}
      {previewZoomUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setPreviewZoomUrl(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setPreviewZoomUrl(null)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer',
                  color: '#334155',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={previewZoomUrl}
              alt="Blueprint Preview"
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
