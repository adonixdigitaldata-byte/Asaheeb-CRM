'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  User,
  Image as ImageIcon,
  Edit3,
  PlusCircle,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import type { CmsActivity } from '@/types/database'

interface Props {
  entityType: 'PROJECT' | 'BLOG'
  entityId: string
  entityTitle?: string
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function getActionMeta(actionType: string) {
  switch (actionType) {
    case 'CREATED':
      return {
        icon: PlusCircle,
        label: 'Created',
        bg: '#ECFDF5',
        color: '#059669',
        border: '#A7F3D0',
      }
    case 'UPDATED_PHOTOS':
      return {
        icon: ImageIcon,
        label: 'Photos Updated',
        bg: '#EFF6FF',
        color: '#2563EB',
        border: '#BFDBFE',
      }
    case 'UPDATED_COMMISSION':
      return {
        icon: SaudiRiyalIcon,
        label: 'Commission Changed',
        bg: '#F0FDF4',
        color: '#16A34A',
        border: '#BBF7D0',
      }
    case 'COMMISSION_RECORDED':
      return {
        icon: SaudiRiyalIcon,
        label: 'Unit Sale Recorded',
        bg: '#FAF5FF',
        color: '#7E22CE',
        border: '#E9D5FF',
      }
    case 'PUBLISHED':
      return {
        icon: Eye,
        label: 'Published Live',
        bg: '#F0FDF4',
        color: '#15803D',
        border: '#86EFAC',
      }
    case 'UNPUBLISHED':
      return {
        icon: EyeOff,
        label: 'Moved to Draft',
        bg: '#F8FAFC',
        color: '#64748B',
        border: '#CBD5E1',
      }
    case 'DELETED':
      return {
        icon: Trash2,
        label: 'Deleted',
        bg: '#FEF2F2',
        color: '#DC2626',
        border: '#FECACA',
      }
    default:
      return {
        icon: Edit3,
        label: 'Details Edited',
        bg: '#F0F9FF',
        color: '#0284C7',
        border: '#BAE6FD',
      }
  }
}

export default function CmsActivityTimeline({ entityType, entityId, entityTitle }: Props) {
  const [activities, setActivities] = useState<CmsActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)

  const fetchActivities = useCallback(async () => {
    if (!entityId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities?entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`)
      if (!res.ok) {
        throw new Error('Failed to fetch activity history')
      }
      const data = await res.json()
      setActivities(data.activities || [])
      setCurrentPage(1)
    } catch (err: any) {
      setError(err.message || 'Error loading activities')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const totalPages = Math.ceil(activities.length / pageSize) || 1
  const effectivePage = Math.min(currentPage, totalPages)
  const pagedActivities = activities.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} style={{ color: '#2563EB' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
            Audit Trail &amp; Activity Log
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#E2E8F0',
              color: '#475569',
              padding: '1px 6px',
              borderRadius: '10px',
            }}
          >
            {activities.length} {activities.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activities.length > 10 && (
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="form-select"
              style={{ fontSize: '11px', padding: '2px 6px', height: '26px' }}
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
          )}

          <button
            type="button"
            onClick={fetchActivities}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            style={{
              fontSize: '11.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#64748B',
              padding: '3px 8px',
            }}
            title="Refresh activity logs"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Timeline List */}
      {loading && activities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748B' }}>
          <Clock size={24} style={{ margin: '0 auto 8px', animation: 'spin 1.5s linear infinite' }} />
          <div style={{ fontSize: '13px' }}>Loading audit history...</div>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '12.5px' }}>
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '8px',
            border: '1px dashed #CBD5E1',
            color: '#64748B',
          }}
        >
          <Clock size={28} style={{ color: '#94A3B8', margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>No activity records logged yet</div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '3px' }}>
            Edits to photos, titles, pricing, commissions, and publish status will be automatically tracked here with user attribution.
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '16px', marginTop: '4px' }}>
          {/* Vertical Connecting Line */}
          <div
            style={{
              position: 'absolute',
              left: '7px',
              top: '12px',
              bottom: '12px',
              width: '2px',
              backgroundColor: '#E2E8F0',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {pagedActivities.map((act) => {
              const meta = getActionMeta(act.action_type)
              const ActionIcon = meta.icon
              const initial = (act.actor_name || 'U').charAt(0).toUpperCase()

              return (
                <div
                  key={act.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  {/* Timeline Dot Icon */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-20px',
                      top: '2px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      border: `2px solid ${meta.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>

                  {/* Activity Card */}
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Action Badge */}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`,
                            padding: '1px 7px',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ActionIcon size={11} />
                          <span>{meta.label}</span>
                        </span>

                        {/* Actor Name */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: '#1E3A8A',
                              color: '#FFFFFF',
                              fontSize: '10px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {initial}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>
                            {act.actor_name}
                          </span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <span
                        style={{ fontSize: '11px', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        title={new Date(act.created_at).toLocaleString()}
                      >
                        <Clock size={11} />
                        <span>{formatRelativeTime(act.created_at)}</span>
                      </span>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.45', wordBreak: 'break-word' }}>
                      {act.description}
                    </div>

                    {/* Optional Changed Fields Tags */}
                    {act.metadata?.changed_fields && Array.isArray(act.metadata.changed_fields) && act.metadata.changed_fields.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                        {act.metadata.changed_fields.map((fieldStr: string, fIdx: number) => (
                          <span
                            key={fIdx}
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#F1F5F9',
                              color: '#334155',
                              border: '1px solid #CBD5E1',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            ✏️ {fieldStr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #E2E8F0',
                fontSize: '12px',
                color: '#64748B',
              }}
            >
              <span>
                Showing {((effectivePage - 1) * pageSize) + 1}–{Math.min(effectivePage * pageSize, activities.length)} of {activities.length} events
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  disabled={effectivePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '11.5px', padding: '2px 8px' }}
                >
                  Previous
                </button>
                <span style={{ fontWeight: 700, color: '#0F172A', padding: '0 4px' }}>
                  Page {effectivePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={effectivePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '11.5px', padding: '2px 8px' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
