'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Megaphone,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Layers,
  CheckCircle,
  Clock,
  Filter,
  X,
  ArrowRight,
  Globe,
  Check,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MarketingPopup, Profile } from '@/types/database'
import PopupEditorModal from './PopupEditorModal'
import ConfirmModal from '@/components/ConfirmModal'
import LogoLoader from '@/components/LogoLoader'

interface Props {
  profile: Profile
}

export default function MarketingPopupsClient({ profile }: Props) {
  const supabase = createClient()
  const [popups, setPopups] = useState<MarketingPopup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Modals
  const [editingPopup, setEditingPopup] = useState<MarketingPopup | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [popupToDelete, setPopupToDelete] = useState<MarketingPopup | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPopups = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('marketing_popups')
        .select('*')
        .order('sort_order', { ascending: true })

      if (!error && data) {
        setPopups(data as MarketingPopup[])
      }
    } catch (err) {
      console.error('Failed to fetch marketing popups:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchPopups()
  }, [fetchPopups])

  // Toggle popup status
  const handleToggleStatus = async (popup: MarketingPopup) => {
    if (togglingId) return
    setTogglingId(popup.id)

    const nextState = !popup.is_active

    try {
      // Optimistic update
      setPopups((prev) =>
        prev.map((p) => (p.id === popup.id ? { ...p, is_active: nextState } : p))
      )

      const res = await fetch('/api/marketing-popups/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: popup.id, is_active: nextState }),
      })

      if (!res.ok) {
        throw new Error('Failed to toggle status')
      }
    } catch (err) {
      console.error(err)
      // Revert on failure
      fetchPopups()
    } finally {
      setTogglingId(null)
    }
  }

  // Delete popup
  const handleDelete = async () => {
    if (!popupToDelete) return
    setDeleting(true)

    try {
      const res = await fetch('/api/marketing-popups/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: popupToDelete.id }),
      })

      if (!res.ok) throw new Error('Failed to delete')

      setPopups((prev) => prev.filter((p) => p.id !== popupToDelete.id))
      setPopupToDelete(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  // Filtered Popups
  const filteredPopups = useMemo(() => {
    return popups.filter((p) => {
      const matchSearch =
        !search.trim() ||
        p.title_en.toLowerCase().includes(search.toLowerCase()) ||
        p.title_ar.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase())

      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? p.is_active
          : !p.is_active

      return matchSearch && matchStatus
    })
  }, [popups, search, statusFilter])

  const activeCount = useMemo(() => popups.filter((p) => p.is_active).length, [popups])

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
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
            <h1 className="text-page-title" style={{ margin: 0 }}>
              Marketing Pop-ups & Ads
            </h1>
          </div>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>
            Control website launch pop-ups, campaign hero overlays, and priority visitor promotions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchPopups}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsCreatingNew(true)}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>New Campaign Pop-up</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #4F46E5' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
            Total Campaigns
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
            {popups.length}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #16A34A' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
            Live On Website
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
            {activeCount}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #D97706' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
            Inactive / Drafts
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {popups.length - activeCount}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Search campaigns by title, slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: statusFilter === tab ? '#FFFFFF' : 'transparent',
                color: statusFilter === tab ? '#0F172A' : '#64748B',
                boxShadow: statusFilter === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab === 'ALL' ? 'All Pop-ups' : tab === 'ACTIVE' ? '🟢 Active Only' : '⚪ Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* Popups List / Grid */}
      {loading ? (
        <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center' }}>
          <LogoLoader text="Loading marketing campaigns..." />
        </div>
      ) : filteredPopups.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
            }}
          >
            <Megaphone size={24} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', margin: 0 }}>
            No Marketing Pop-ups Found
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '400px', margin: 0 }}>
            {search || statusFilter !== 'ALL'
              ? 'Try changing your search keywords or filter status.'
              : 'Create your first campaign pop-up to engage website visitors with priority launches.'}
          </p>
          <button
            onClick={() => setIsCreatingNew(true)}
            className="btn btn-primary btn-sm"
            style={{ marginTop: '8px' }}
          >
            <Plus size={14} />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredPopups.map((popup) => (
            <div
              key={popup.id}
              className="card"
              style={{
                borderRadius: '14px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: popup.is_active ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Banner Image Preview Container */}
              <div
                style={{
                  height: '170px',
                  position: 'relative',
                  backgroundColor: '#0F172A',
                  backgroundImage: `url(${popup.image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Priority Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: popup.is_active ? 'rgba(22, 163, 74, 0.9)' : 'rgba(100, 116, 139, 0.9)',
                      color: '#FFFFFF',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {popup.is_active ? 'LIVE ACTIVE' : 'INACTIVE'}
                  </span>

                  {popup.badge_en && (
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(212, 175, 55, 0.95)',
                        color: '#000000',
                      }}
                    >
                      {popup.badge_en}
                    </span>
                  )}
                </div>

                {/* Priority Order Pill */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    color: '#FFFFFF',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  Priority #{popup.sort_order ?? 1}
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace', marginBottom: '2px' }}>
                    {popup.id}
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                    {popup.title_en}
                  </h3>
                  <div style={{ fontSize: '13px', color: '#64748B', fontFamily: 'var(--font-arabic, sans-serif)', marginTop: '2px' }}>
                    {popup.title_ar}
                  </div>
                </div>

                {popup.subtitle_en && (
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                    {popup.subtitle_en}
                  </p>
                )}

                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ExternalLink size={13} style={{ color: '#64748B', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {popup.target_url}
                  </span>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Active Toggle Switch */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={popup.is_active}
                      onChange={() => handleToggleStatus(popup)}
                      disabled={togglingId === popup.id}
                      style={{ width: '16px', height: '16px', accentColor: '#16A34A', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: popup.is_active ? '#15803D' : '#64748B' }}>
                      {popup.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </label>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => setEditingPopup(popup)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      title="Edit Campaign"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setPopupToDelete(popup)}
                      style={{
                        border: '1px solid #FCA5A5',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Delete Campaign"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal for Create / Edit */}
      {(isCreatingNew || editingPopup) && (
        <PopupEditorModal
          isOpen={isCreatingNew || !!editingPopup}
          popup={editingPopup}
          onClose={() => {
            setIsCreatingNew(false)
            setEditingPopup(null)
          }}
          onSuccess={() => {
            fetchPopups()
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {popupToDelete && (
        <ConfirmModal
          isOpen={!!popupToDelete}
          title="Delete Marketing Pop-up Ad"
          message={`Are you sure you want to delete campaign "${popupToDelete.title_en}"? This will remove the pop-up immediately from the website.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete Pop-up'}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setPopupToDelete(null)}
        />
      )}
    </div>
  )
}
