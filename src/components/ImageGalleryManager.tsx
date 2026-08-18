'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  UploadCloud,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Star,
  Link as LinkIcon,
  Loader2,
  Image as ImageIcon,
  Check,
  GripVertical,
  Move,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  MessageSquare,
  Globe,
  ExternalLink,
} from 'lucide-react'
import type { ProjectImage } from '@/types/database'

interface Props {
  images: ProjectImage[]
  onChange: (images: ProjectImage[]) => void
  folder?: string
}

// Utility to clean and extract direct image URL from Google Images, search redirects, etc.
function cleanAndExtractImageUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return ''

  try {
    // If it's a google images redirect URL (e.g. google.com/imgres?imgurl=...)
    if (url.includes('google.') && (url.includes('imgurl=') || url.includes('/imgres'))) {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
      const imgurlParam = parsed.searchParams.get('imgurl')
      if (imgurlParam) {
        return decodeURIComponent(imgurlParam)
      }
    }
  } catch (err) {
    // Regex fallback for google imgurl param
    const match = url.match(/[?&]imgurl=([^&]+)/i)
    if (match && match[1]) {
      return decodeURIComponent(match[1])
    }
  }

  // Handle protocol-relative URL
  if (url.startsWith('//')) {
    url = `https:${url}`
  }

  return url
}

export default function ImageGalleryManager({
  images = [],
  onChange,
  folder = 'asaheeb/projects',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [manualUrl, setManualUrl] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [captionEn, setCaptionEn] = useState('')
  const [captionAr, setCaptionAr] = useState('')

  // Reminder banner state
  const [captionReminder, setCaptionReminder] = useState<{ count: number; index: number } | null>(null)

  // Drag and Drop States
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Keep a live ref to images to prevent stale closure overwrites on batch uploads
  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  }, [images])

  const uploadedBatchRef = useRef<ProjectImage[]>([])

  // Load Cloudinary Upload Widget Script on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).cloudinary) {
      const script = document.createElement('script')
      script.src = 'https://upload-widget.cloudinary.com/global/all.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  // Auto-dismiss reminder after 12 seconds
  useEffect(() => {
    if (captionReminder) {
      const timer = setTimeout(() => setCaptionReminder(null), 12000)
      return () => clearTimeout(timer)
    }
  }, [captionReminder])

  // Central handler when new photos are added
  function handlePhotosAdded(newPhotos: ProjectImage[]) {
    if (!newPhotos || newPhotos.length === 0) return

    const startIndex = imagesRef.current.length
    const updated = [...imagesRef.current, ...newPhotos]
    onChange(updated)

    // Set caption reminder & auto-open caption editor on the first new photo
    setCaptionReminder({ count: newPhotos.length, index: startIndex })
    setEditingIndex(startIndex)
    setCaptionEn(newPhotos[0].captionEn || '')
    setCaptionAr(newPhotos[0].captionAr || '')
  }

  // Open Native Cloudinary Upload Widget with full multi-file batch support
  function openCloudinaryNativeWidget() {
    if (typeof window === 'undefined') return

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'diwqmlpr'
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'asaheeb_preset'

    uploadedBatchRef.current = []

    if (!(window as any).cloudinary) {
      const script = document.createElement('script')
      script.src = 'https://upload-widget.cloudinary.com/global/all.js'
      script.onload = () => openCloudinaryNativeWidget()
      document.body.appendChild(script)
      return
    }

    try {
      const widget = (window as any).cloudinary.createUploadWidget(
        {
          cloudName: cloudName,
          uploadPreset: uploadPreset,
          folder: folder,
          sources: ['local', 'url', 'camera', 'google_drive', 'dropbox', 'unsplash'],
          multiple: true,
          maxFiles: 30,
          clientAllowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'svg'],
          resourceType: 'image',
          theme: 'minimal',
          styles: {
            palette: {
              window: '#FFFFFF',
              windowBorder: '#CBD5E1',
              tabIcon: '#2563EB',
              menuIcons: '#475569',
              textDark: '#0F172A',
              textLight: '#FFFFFF',
              link: '#2563EB',
              action: '#2563EB',
              inactiveTabIcon: '#94A3B8',
              error: '#EF4444',
              inProgress: '#2563EB',
              complete: '#16A34A',
              sourceBg: '#F8FAFC',
            },
          },
        },
        (error: any, result: any) => {
          if (!error && result) {
            if (result.event === 'success') {
              const url = result.info?.secure_url || result.info?.url
              if (url) {
                const newImg: ProjectImage = { url, captionEn: '', captionAr: '' }
                uploadedBatchRef.current.push(newImg)
                // Immediately reflect all items in state
                const nextList = [...imagesRef.current, ...uploadedBatchRef.current]
                onChange(nextList)
              }
            } else if (result.event === 'queues-end' || result.event === 'close') {
              if (uploadedBatchRef.current.length > 0) {
                const batchCount = uploadedBatchRef.current.length
                const targetIdx = imagesRef.current.length
                setCaptionReminder({ count: batchCount, index: targetIdx })
                setEditingIndex(targetIdx)
                uploadedBatchRef.current = []
              }
            }
          }
        }
      )

      widget.open()
    } catch (err: any) {
      console.error('Cloudinary widget error:', err)
      fileInputRef.current?.click()
    }
  }

  // Handle uploading multiple files to Cloudinary via backend endpoint
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploading(true)
    const total = files.length
    const uploadedImages: ProjectImage[] = []

    for (let i = 0; i < total; i++) {
      const file = files[i]
      setUploadProgress(`Uploading ${i + 1} of ${total}: ${file.name}...`)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)

      try {
        const res = await fetch('/api/upload/cloudinary', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (res.ok && data.url) {
          uploadedImages.push({
            url: data.url,
            captionEn: '',
            captionAr: '',
          })
        } else {
          console.error('Failed to upload image:', data.error)
          alert(`Failed to upload ${file.name}:\n${data.error || 'Unknown error'}`)
        }
      } catch (err: any) {
        console.error('Error uploading image:', err)
      }
    }

    if (uploadedImages.length > 0) {
      handlePhotosAdded(uploadedImages)
    }

    setUploading(false)
    setUploadProgress('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Add image by direct or extracted link (supports Google Images link)
  function handleAddManualUrl() {
    const cleanUrl = cleanAndExtractImageUrl(manualUrl)
    if (!cleanUrl) return

    handlePhotosAdded([
      {
        url: cleanUrl,
        captionEn: '',
        captionAr: '',
      },
    ])
    setManualUrl('')
    setShowManualInput(false)
  }

  // Move image up
  function handleMoveUp(index: number) {
    if (index === 0) return
    const updated = [...images]
    const temp = updated[index]
    updated[index] = updated[index - 1]
    updated[index - 1] = temp
    onChange(updated)
  }

  // Move image down
  function handleMoveDown(index: number) {
    if (index === images.length - 1) return
    const updated = [...images]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    onChange(updated)
  }

  // Make cover (move to position 0)
  function handleMakeCover(index: number) {
    if (index === 0) return
    const updated = [...images]
    const [item] = updated.splice(index, 1)
    updated.unshift(item)
    onChange(updated)
  }

  // Delete image
  function handleDelete(index: number) {
    const updated = images.filter((_, i) => i !== index)
    onChange(updated)
    if (editingIndex === index) {
      setEditingIndex(null)
    }
  }

  // Save caption edits
  function handleSaveCaption(index: number) {
    const updated = [...images]
    updated[index] = {
      ...updated[index],
      captionEn: captionEn.trim() || undefined,
      captionAr: captionAr.trim() || undefined,
    }
    onChange(updated)
    setEditingIndex(null)
  }

  // Jump to next missing caption
  function handleJumpToMissingCaption() {
    const nextMissing = images.findIndex((img) => !img.captionEn && !img.captionAr)
    if (nextMissing !== -1) {
      setEditingIndex(nextMissing)
      setCaptionEn(images[nextMissing].captionEn || '')
      setCaptionAr(images[nextMissing].captionAr || '')
    }
  }

  // Drag and Drop Event Handlers
  function onDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index)
    e.dataTransfer.setData('text/plain', index.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index && dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  function onDragEnd() {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  function onDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const updated = [...images]
    const [movedItem] = updated.splice(draggedIndex, 1)
    updated.splice(targetIndex, 0, movedItem)
    onChange(updated)

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const fullyCaptionedCount = images.filter((img) => img.captionEn && img.captionAr).length
  const missingCaptionsCount = images.length - fullyCaptionedCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Upload & Actions Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '12px 16px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Project Photo Gallery ({images.length} {images.length === 1 ? 'image' : 'images'})</span>
            {images.length > 1 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#2563EB',
                  backgroundColor: '#EFF6FF',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Move size={11} />
                Drag to rearrange
              </span>
            )}
            {images.length > 0 && missingCaptionsCount > 0 && (
              <button
                type="button"
                onClick={handleJumpToMissingCaption}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#B45309',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Click to jump to photo missing caption"
              >
                <AlertCircle size={11} />
                <span>{missingCaptionsCount} need captions</span>
              </button>
            )}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
            Upload photos via Cloudinary, direct files, or Google Image URLs. The first image is the cover photo.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          {/* Native Cloudinary Upload Widget Button */}
          <button
            type="button"
            onClick={openCloudinaryNativeWidget}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Open official Cloudinary native upload modal (My Files, URL, Google Drive, Dropbox)"
          >
            <UploadCloud size={14} />
            <span>Cloudinary Uploader</span>
          </button>

          {/* Quick Local File Picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Upload directly from your local computer"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            <span>{uploading ? 'Uploading...' : 'Local Files'}</span>
          </button>

          {/* Add via URL Button */}
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <LinkIcon size={13} />
            <span>Add via URL</span>
          </button>
        </div>
      </div>

      {/* Caption Reminder Banner (Triggered immediately after adding images) */}
      {captionReminder && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1E40AF',
            borderRadius: '8px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            boxShadow: '0 2px 6px rgba(37,99,235,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: '#2563EB', flexShrink: 0 }} />
            <div>
              <strong>{captionReminder.count} {captionReminder.count === 1 ? 'photo' : 'photos'} added!</strong> Remember to add bilingual captions (English &amp; Arabic) below for optimal website display and SEO.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCaptionReminder(null)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11px', padding: '2px 6px', color: '#1E40AF' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Uploading progress notification */}
      {uploading && uploadProgress && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            borderRadius: '6px',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Loader2 size={15} className="animate-spin" />
          <span>{uploadProgress}</span>
        </div>
      )}

      {/* Manual URL Input */}
      {showManualInput && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px 14px',
            backgroundColor: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              handleAddManualUrl()
            }
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Paste image URL (direct image link or Google Search image link)..."
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="form-input"
              style={{ flex: 1, fontSize: '12.5px' }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddManualUrl}
              disabled={!manualUrl.trim()}
              className="btn btn-primary btn-sm"
            >
              Add Image
            </button>
            <button
              type="button"
              onClick={() => {
                setShowManualInput(false)
                setManualUrl('')
              }}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            💡 Supports direct image links (`.jpg`, `.png`, `.webp`, etc.) as well as Google Images links (automatically extracts source URL).
          </span>
        </div>
      )}

      {/* Gallery Cards Grid with Drag & Drop Reordering & Prominent Caption Editing */}
      {images.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '14px',
          }}
        >
          {images.map((img, idx) => {
            const isCover = idx === 0
            const isEditingThis = editingIndex === idx
            const isBeingDragged = draggedIndex === idx
            const isDragTarget = dragOverIndex === idx && draggedIndex !== idx
            const hasCompleteCaption = !!(img.captionEn && img.captionAr)
            const hasPartialCaption = !!(img.captionEn || img.captionAr)

            return (
              <div
                key={`${img.url}-${idx}`}
                draggable={!isEditingThis}
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                onDrop={(e) => onDrop(e, idx)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: isDragTarget
                    ? '2px solid #2563EB'
                    : isCover
                    ? '2px solid #3B82F6'
                    : isEditingThis
                    ? '2px solid #6366F1'
                    : '1px solid #E2E8F0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isBeingDragged
                    ? 'none'
                    : isDragTarget
                    ? '0 0 0 3px rgba(37,99,235,0.25), 0 8px 16px rgba(0,0,0,0.1)'
                    : '0 1px 3px rgba(0,0,0,0.06)',
                  position: 'relative',
                  opacity: isBeingDragged ? 0.35 : 1,
                  transform: isDragTarget ? 'scale(1.02)' : 'scale(1)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
                  cursor: isEditingThis ? 'default' : 'grab',
                }}
              >
                {/* Image Preview & Drag Handle */}
                <div style={{ position: 'relative', width: '100%', height: '140px', backgroundColor: '#0F172A' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.captionEn || `Project Image ${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                    }}
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.opacity = '0.2'
                    }}
                  />

                  {/* Drag Grip Handle Indicator */}
                  <div
                    title="Drag with mouse to arrange"
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '38px',
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      color: '#FFFFFF',
                      borderRadius: '4px',
                      padding: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                    }}
                  >
                    <GripVertical size={14} />
                  </div>

                  {/* Cover Badge / Number */}
                  {isCover ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        backgroundColor: '#1D4ED8',
                        color: '#FFFFFF',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      <Star size={11} fill="#FFFFFF" />
                      <span>COVER PHOTO</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        color: '#FFFFFF',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      #{idx + 1}
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(idx)
                    }}
                    title="Remove image"
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.9)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Card Controls */}
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {/* Reorder, Make Cover, and Edit Caption Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        title="Move Up"
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ padding: '4px' }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === images.length - 1}
                        title="Move Down"
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ padding: '4px' }}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {!isCover && (
                        <button
                          type="button"
                          onClick={() => handleMakeCover(idx)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '11px', color: '#1D4ED8', padding: '2px 6px', fontWeight: 600 }}
                        >
                          Set as Cover
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingIndex(idx)
                          setCaptionEn(img.captionEn || '')
                          setCaptionAr(img.captionAr || '')
                        }}
                        className={`btn ${isEditingThis ? 'btn-primary' : hasCompleteCaption ? 'btn-outline' : 'btn-secondary'} btn-sm`}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          borderColor: !hasPartialCaption ? '#F59E0B' : undefined,
                        }}
                        title="Edit image caption (English & Arabic)"
                      >
                        <span>✏️ Caption</span>
                      </button>
                    </div>
                  </div>

                  {/* Caption Status / Form */}
                  {isEditingThis ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '4px',
                        padding: '8px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSaveCaption(idx)
                        }
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare size={12} style={{ color: '#2563EB' }} />
                        <span>Edit Photo Caption:</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Caption (English, e.g. Living Area)..."
                        value={captionEn}
                        onChange={(e) => setCaptionEn(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '11.5px', padding: '5px 8px' }}
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="الوصف بالعربية (مثال: صالة المعيشة)..."
                        dir="rtl"
                        value={captionAr}
                        onChange={(e) => setCaptionAr(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '11.5px', padding: '5px 8px' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveCaption(idx)}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '11px', padding: '2px 10px', fontWeight: 600 }}
                        >
                          Save Caption
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingIndex(idx)
                        setCaptionEn(img.captionEn || '')
                        setCaptionAr(img.captionAr || '')
                      }}
                      style={{
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        borderTop: '1px dashed #E2E8F0',
                        paddingTop: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                      title="Click to edit caption"
                    >
                      {hasPartialCaption ? (
                        <>
                          {img.captionEn && (
                            <div style={{ color: '#0F172A', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🇬🇧 {img.captionEn}
                            </div>
                          )}
                          {img.captionAr && (
                            <div dir="rtl" style={{ color: '#475569', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🇸🇦 {img.captionAr}
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          style={{
                            color: '#D97706',
                            backgroundColor: '#FEF3C7',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertCircle size={11} />
                          <span>+ Add Caption (Remind)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <div
          onClick={openCloudinaryNativeWidget}
          style={{
            border: '2px dashed #CBD5E1',
            borderRadius: '10px',
            padding: '36px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            backgroundColor: '#F8FAFC',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#EFF6FF',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageIcon size={22} />
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0F172A' }}>
            No images in gallery yet
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'center' }}>
            Click here to open Cloudinary uploader, browse local files, or click "Add via URL"
          </div>
        </div>
      )}
    </div>
  )
}


