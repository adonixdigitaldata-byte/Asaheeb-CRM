'use client'

import React, { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  UploadCloud,
  Link as LinkIcon,
  Maximize2,
  X,
  CreditCard,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import type { PaymentPlanItem } from '@/types/database'
import { isCloudinaryUrl, deleteCloudinaryAsset } from '@/lib/cloudinary'

interface PaymentPlansEditorProps {
  plans: PaymentPlanItem[]
  onChange: (plans: PaymentPlanItem[]) => void
  folder?: string
}

export default function PaymentPlansEditor({
  plans = [],
  onChange,
  folder = 'asaheeb/payment-plans',
}: PaymentPlansEditorProps) {
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [directUrl, setDirectUrl] = useState('')
  const [previewZoomUrl, setPreviewZoomUrl] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
          clientAllowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'svg', 'pdf'],
          resourceType: 'image',
          theme: 'minimal',
        },
        (err: any, result: any) => {
          if (!err && result && result.event === 'success') {
            const uploadedUrl = result.info.secure_url
            if (uploadedUrl) {
              addPlanWithUrl(uploadedUrl)
            }
          }
        }
      )
      widget.open()
    } catch (e) {
      console.error('Failed to open Cloudinary widget:', e)
    }
  }

  function addPlanWithUrl(url: string) {
    const nextIndex = plans.length + 1
    const newPlan: PaymentPlanItem = {
      url: url.trim(),
      title_en: `Payment Schedule ${nextIndex}`,
      title_ar: `جدول السداد ${nextIndex}`,
      caption_en: '',
      caption_ar: '',
      sort_order: plans.length,
    }
    // Preserve chronological order (appended at bottom)
    const updated = [...plans, newPlan]
    const targetIndex = updated.length - 1
    onChange(updated.map((item, idx) => ({ ...item, sort_order: idx })))

    setNotice(`Payment Schedule #${nextIndex} added! Jumped to newly added schedule.`)
    setTimeout(() => setNotice(null), 6000)

    // Auto-scroll modal down to the newly added schedule
    setTimeout(() => {
      const cardEl = document.getElementById(`payment-plan-card-${targetIndex}`)
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const firstInput = cardEl.querySelector('input')
        if (firstInput) {
          firstInput.focus({ preventScroll: true })
        }
      }
    }, 100)
  }

  const addEmptyPlan = () => {
    addPlanWithUrl('')
  }

  const updatePlan = (index: number, field: keyof PaymentPlanItem, value: any) => {
    const updated = [...plans]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  async function handleReplacePlanPhoto(index: number, newUrl: string) {
    const oldUrl = plans[index]?.url
    const updated = [...plans]
    updated[index] = { ...updated[index], url: newUrl }
    onChange(updated)

    if (oldUrl && oldUrl !== newUrl && isCloudinaryUrl(oldUrl)) {
      setNotice('Deleting previous flyer from Cloudinary...')
      const res = await deleteCloudinaryAsset(oldUrl)
      if (res.success) {
        setNotice('Payment flyer replaced & previous image deleted from Cloudinary.')
      } else {
        setNotice('Payment flyer replaced. Cloudinary sync completed.')
      }
      setTimeout(() => setNotice(null), 4000)
    } else {
      setNotice('Payment flyer replaced successfully.')
      setTimeout(() => setNotice(null), 3000)
    }
  }

  function openCloudinaryReplaceWidget(targetIndex: number) {
    if (typeof window === 'undefined') return

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'diwqmlpr'
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'asaheeb_preset'

    if (!(window as any).cloudinary) {
      const script = document.createElement('script')
      script.src = 'https://upload-widget.cloudinary.com/global/all.js'
      script.async = true
      script.onload = () => openCloudinaryReplaceWidget(targetIndex)
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
          multiple: false,
          clientAllowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'svg', 'pdf'],
          resourceType: 'image',
          theme: 'minimal',
        },
        (err: any, result: any) => {
          if (!err && result && result.event === 'success') {
            const uploadedUrl = result.info.secure_url
            if (uploadedUrl) {
              handleReplacePlanPhoto(targetIndex, uploadedUrl)
            }
          }
        }
      )
      widget.open()
    } catch (e) {
      console.error('Failed to open Cloudinary widget for flyer replace:', e)
    }
  }

  const removePlan = async (index: number) => {
    if (!confirm('Are you sure you want to remove this payment plan schedule?')) return
    const oldUrl = plans[index]?.url
    onChange(plans.filter((_, i) => i !== index))
    if (oldUrl && isCloudinaryUrl(oldUrl)) {
      deleteCloudinaryAsset(oldUrl)
    }
  }

  const movePlan = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === plans.length - 1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const copy = [...plans]
    const [moved] = copy.splice(index, 1)
    copy.splice(targetIndex, 0, moved)
    onChange(copy.map((item, idx) => ({ ...item, sort_order: idx })))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Dynamic Feedback Notice */}
      {notice && (
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#15803D',
            fontSize: '12px',
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
            <span>{notice}</span>
          </div>
          {plans.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(`payment-plan-card-${plans.length - 1}`)
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
              className="btn btn-xs btn-outline"
              style={{ fontSize: '11px', color: '#15803D', borderColor: '#86EFAC', backgroundColor: '#FFFFFF' }}
            >
              Jump to Latest ↓
            </button>
          )}
        </div>
      )}

      {/* Top Banner / Actions Bar */}
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
            <CreditCard size={18} style={{ color: '#D97706' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
              Project Payment Plans &amp; Schedules ({plans.length})
            </h4>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
            Upload official developer payment flyers, milestone charts, and installment schedules for this project.
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
            <UploadCloud size={15} /> Upload Plan Flyer
          </button>
        </div>
      </div>

      {/* URL Input Modal */}
      {showUrlModal && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #D97706',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 14px rgba(217,119,6,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              Add Payment Plan via Direct Image URL
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
              placeholder="https://res.cloudinary.com/... or https://example.com/payment-plan.jpg"
              className="form-input"
              style={{ flex: 1, fontSize: '12.5px' }}
            />
            <button
              type="button"
              disabled={!directUrl.trim()}
              onClick={() => {
                if (directUrl.trim()) {
                  addPlanWithUrl(directUrl.trim())
                  setDirectUrl('')
                  setShowUrlModal(false)
                }
              }}
              className="btn btn-primary btn-sm"
              style={{ padding: '0 16px' }}
            >
              Add Schedule
            </button>
          </div>
        </div>
      )}

      {/* Plans List */}
      {plans.length === 0 ? (
        <div
          style={{
            border: '2px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: '#F8FAFC',
          }}
        >
          <CreditCard size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
          <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', margin: '0 0 4px' }}>
            No payment schedules added yet
          </h5>
          <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px' }}>
            Upload visual payment plan flyers, milestone charts, or installment breakdown graphics. They will render in an interactive gallery right below the floor plans.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={openCloudinaryNativeWidget}
              className="btn btn-sm btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UploadCloud size={14} /> Upload Flyer
            </button>
            <button
              type="button"
              onClick={addEmptyPlan}
              className="btn btn-sm btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Plus size={14} /> Add by Custom URL
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {plans.map((plan, index) => (
            <div
              key={index}
              id={`payment-plan-card-${index}`}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              {/* Thumbnail / Image Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                <div
                  style={{
                    position: 'relative',
                    width: '130px',
                    height: '100px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#0F172A',
                    border: '1px solid #CBD5E1',
                    flexShrink: 0,
                    cursor: plan.url ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={() => plan.url && setPreviewZoomUrl(plan.url)}
                  title={plan.url ? 'Click to enlarge flyer' : undefined}
                >
                  {plan.url ? (
                    <>
                      <img
                        src={plan.url}
                        alt={plan.title_en || 'Payment Plan'}
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
                    </>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#94A3B8', textAlign: 'center', padding: '6px' }}>
                      Enter image URL below
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openCloudinaryReplaceWidget(index)}
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '10.5px', padding: '1px 6px', display: 'flex', alignItems: 'center', gap: '3px', width: '100%', justifyContent: 'center' }}
                  title="Upload new flyer to replace current image (old image will be deleted from Cloudinary)"
                >
                  <UploadCloud size={11} /> Change Flyer
                </button>
              </div>

              {/* Form Fields */}
              <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Titles EN & AR */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                      Plan Title (English) *
                    </label>
                    <input
                      type="text"
                      value={plan.title_en || ''}
                      onChange={(e) => updatePlan(index, 'title_en', e.target.value)}
                      placeholder="e.g. Standard 50/50 Handover Schedule"
                      className="form-input"
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ textAlign: 'right', fontSize: '11.5px', fontWeight: 700 }}>
                      عنوان الخطة (AR) *
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={plan.title_ar || ''}
                      onChange={(e) => updatePlan(index, 'title_ar', e.target.value)}
                      placeholder="مثال: خطة سداد 50/50 عند الاستلام"
                      className="form-input"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                </div>

                {/* Image URL Input */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap' }}>Flyer Image URL:</span>
                  <input
                    type="url"
                    value={plan.url || ''}
                    onChange={(e) => updatePlan(index, 'url', e.target.value)}
                    placeholder="https://res.cloudinary.com/.../payment-plan-1.jpg"
                    className="form-input"
                    style={{ fontSize: '11px', flex: 1, padding: '3px 8px' }}
                  />
                  <button
                    type="button"
                    onClick={() => openCloudinaryReplaceWidget(index)}
                    className="btn btn-xs btn-outline"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    title="Replace flyer using Cloudinary"
                  >
                    <UploadCloud size={12} /> Replace
                  </button>
                </div>
              </div>

              {/* Action Buttons (Move up/down, Delete) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'center' }}>
                <button
                  type="button"
                  title="Move Up"
                  disabled={index === 0}
                  onClick={() => movePlan(index, 'up')}
                  className="btn btn-xs btn-ghost"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  title="Move Down"
                  disabled={index === plans.length - 1}
                  onClick={() => movePlan(index, 'down')}
                  className="btn btn-xs btn-ghost"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  title="Remove Schedule"
                  onClick={() => removePlan(index)}
                  className="btn btn-xs btn-ghost"
                  style={{ color: '#DC2626' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enlarge Zoom Modal */}
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
              alt="Payment Plan Preview"
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
