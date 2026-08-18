'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Mail,
  Search,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  X,
  ExternalLink,
  UserX,
  UserCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { NewsletterSubscriber, Profile } from '@/types/database'
import { formatDate } from '@/lib/utils'
import Pagination from '@/components/Pagination'
import ConfirmModal from '@/components/ConfirmModal'
import LogoLoader from '@/components/LogoLoader'

interface Props {
  profile: Profile
}

const PAGE_SIZE = 15

export default function NewsletterClient({ profile }: Props) {
  const supabase = createClient()
  const isAdmin = profile?.role === 'ADMIN'

  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBSCRIBED' | 'UNSUBSCRIBED'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  // Add Subscriber Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newSource, setNewSource] = useState('MANUAL')
  const [savingNew, setSavingNew] = useState(false)

  // Delete state
  const [subscriberToDelete, setSubscriberToDelete] = useState<NewsletterSubscriber | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Loading state for individual subscriber toggle operations
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Toggle Subscriber Status (Subscribed / Unsubscribed)
  async function handleToggleStatus(sub: NewsletterSubscriber) {
    if (togglingId) return // Prevent multiple concurrent clicks

    const currentStatus = (sub.status || 'SUBSCRIBED').toUpperCase()
    const nextStatus = currentStatus === 'SUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED'

    setTogglingId(sub.id)

    try {
      // 1. First try updating via client supabase session
      let updatedData: NewsletterSubscriber | null = null

      const { data: clientData, error: clientError } = await supabase
        .from('newsletter_subscribers')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .match(sub.id ? { id: sub.id } : { email: sub.email })
        .select()

      if (!clientError && clientData && clientData.length > 0) {
        updatedData = clientData[0] as NewsletterSubscriber
      } else {
        // 2. Fallback to API route
        const res = await fetch('/api/newsletter/toggle-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sub.id, email: sub.email, status: nextStatus }),
        })

        const data = await res.json().catch(() => ({}))
        if (res.ok && data.subscriber) {
          updatedData = data.subscriber
        } else {
          throw new Error(data.error || clientError?.message || 'Failed to update subscriber status')
        }
      }

      if (updatedData) {
        setSubscribers((prev) =>
          prev.map((s) => (s.id === sub.id || s.email === sub.email ? { ...s, ...updatedData } : s))
        )
      }
    } catch (err: any) {
      console.error('Failed to toggle subscriber status:', err)
      alert(err.message || 'Failed to update subscriber status. Please try again.')
    } finally {
      setTogglingId(null)
    }
  }

  // Fetch subscribers from Supabase
  const fetchSubscribers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSubscribers(data as NewsletterSubscriber[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchSubscribers()
  }, [fetchSubscribers])

  // Filtered subscribers
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter((sub) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchEmail = sub.email?.toLowerCase().includes(q)
        const matchSource = sub.source?.toLowerCase().includes(q)
        if (!matchEmail && !matchSource) return false
      }

      if (statusFilter !== 'ALL') {
        const currentStatus = (sub.status || 'SUBSCRIBED').toUpperCase()
        if (currentStatus !== statusFilter) return false
      }

      return true
    })
  }, [subscribers, search, statusFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredSubscribers.length / PAGE_SIZE) || 1
  const effectivePage = Math.min(currentPage, totalPages)
  const displayedSubscribers = filteredSubscribers.slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE
  )

  const activeCount = subscribers.filter((s) => (s.status || 'SUBSCRIBED').toUpperCase() === 'SUBSCRIBED').length

  // Export CSV Function
  function exportToCsv() {
    if (filteredSubscribers.length === 0) return

    const headers = ['Email', 'Status', 'Source', 'Subscribed Date']
    const rows = filteredSubscribers.map((sub) => [
      `"${sub.email}"`,
      `"${sub.status || 'SUBSCRIBED'}"`,
      `"${sub.source || 'WEBSITE'}"`,
      `"${new Date(sub.created_at).toLocaleString('en-GB')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    link.setAttribute('href', url)
    link.setAttribute('download', `asaheeb_newsletter_subscribers_${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle Add Subscriber
  async function handleAddSubscriber(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) return

    setSavingNew(true)
    const res = await fetch('/api/newsletter/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim(), source: newSource.trim() || 'MANUAL' }),
    })

    if (res.ok) {
      setNewEmail('')
      setShowAddModal(false)
      fetchSubscribers()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to add subscriber')
    }
    setSavingNew(false)
  }

  // Handle Delete Subscriber
  async function executeDeleteSubscriber() {
    if (!subscriberToDelete) return
    setDeleting(true)

    const res = await fetch('/api/newsletter/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subscriberToDelete.id }),
    })

    if (res.ok) {
      setSubscribers((prev) => prev.filter((s) => s.id !== subscriberToDelete.id))
      setSubscriberToDelete(null)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to delete subscriber')
    }
    setDeleting(false)
  }

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="text-page-title">Newsletter Subscribers</h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid #BFDBFE',
              }}
            >
              {subscribers.length} Total ({activeCount} Active)
            </span>
          </div>
          <p className="text-meta" style={{ marginTop: '2px' }}>
            Manage website email subscribers, track acquisition sources, and export mailing lists
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportToCsv}
            disabled={filteredSubscribers.length === 0}
            className="btn btn-outline btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              color: '#059669',
              borderColor: '#A7F3D0',
              backgroundColor: '#ECFDF5',
              cursor: filteredSubscribers.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredSubscribers.length === 0 ? 0.5 : 1,
            }}
            title="Download CSV mailing list of current subscribers"
          >
            <Download size={14} />
            <span>Export CSV ({filteredSubscribers.length})</span>
          </button>

          <button
            onClick={() => fetchSubscribers()}
            className="btn btn-outline btn-sm"
            title="Refresh Subscribers"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Add Subscriber</span>
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ paddingBottom: '30px' }}>
        {/* Quick Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'ALL' ? '#0F172A' : '#F1F5F9',
              color: statusFilter === 'ALL' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            All ({subscribers.length})
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter('SUBSCRIBED'); setCurrentPage(1); }}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'SUBSCRIBED' ? '#059669' : '#F1F5F9',
              color: statusFilter === 'SUBSCRIBED' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Active ({activeCount})
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter('UNSUBSCRIBED'); setCurrentPage(1); }}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'UNSUBSCRIBED' ? '#DC2626' : '#F1F5F9',
              color: statusFilter === 'UNSUBSCRIBED' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Unsubscribed ({subscribers.length - activeCount})
          </button>
        </div>

        {/* Search Toolbar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search subscribers by email or source (e.g. footer, blog)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="form-input"
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setCurrentPage(1); }}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table View */}
        {loading && subscribers.length === 0 ? (
          <LogoLoader size={44} text="Loading subscribers..." />
        ) : filteredSubscribers.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', width: '100%' }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '780px', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0',
                      color: '#475569',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    <th style={{ padding: '12px 16px', width: '38%' }}>Subscriber Email</th>
                    <th style={{ padding: '12px 14px', width: '18%' }}>Source / Channel</th>
                    <th style={{ padding: '12px 14px', width: '15%' }}>Status</th>
                    <th style={{ padding: '12px 14px', width: '14%' }}>Subscribed Date</th>
                    <th style={{ padding: '12px 16px', width: '15%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedSubscribers.map((sub) => {
                    const isSubscribed = (sub.status || 'SUBSCRIBED').toUpperCase() === 'SUBSCRIBED'
                    const isTogglingThis = togglingId === sub.id

                    return (
                      <tr
                        key={sub.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background-color 0.15s ease',
                          opacity: isTogglingThis ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                        }}
                      >
                        {/* Email */}
                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: '#EFF6FF',
                                color: '#2563EB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Mail size={14} />
                            </div>
                            <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px', wordBreak: 'break-all' }}>
                              {sub.email}
                            </span>
                          </div>
                        </td>

                        {/* Source */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#475569',
                              backgroundColor: '#F1F5F9',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              border: '1px solid #E2E8F0',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sub.source || 'WEBSITE_FOOTER'}
                          </span>
                        </td>

                        {/* Status (Clickable to Toggle) */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            disabled={isTogglingThis}
                            onClick={() => handleToggleStatus(sub)}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: isSubscribed ? '#DCFCE7' : '#FEE2E2',
                              color: isSubscribed ? '#15803D' : '#B91C1C',
                              border: isSubscribed ? '1px solid #BBF7D0' : '1px solid #FECACA',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: isTogglingThis ? 'wait' : 'pointer',
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Click to mark as ${isSubscribed ? 'UNSUBSCRIBED' : 'SUBSCRIBED'}`}
                          >
                            {isTogglingThis ? (
                              <RefreshCw size={11} className="animate-spin" />
                            ) : isSubscribed ? (
                              <CheckCircle size={11} />
                            ) : (
                              <XCircle size={11} />
                            )}
                            <span>{isTogglingThis ? 'Updating...' : sub.status || 'SUBSCRIBED'}</span>
                          </button>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {formatDate(sub.created_at)}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              disabled={isTogglingThis}
                              onClick={() => handleToggleStatus(sub)}
                              className="btn btn-ghost btn-sm"
                              style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                height: '26px',
                                color: isSubscribed ? '#DC2626' : '#059669',
                                backgroundColor: isSubscribed ? '#FEF2F2' : '#ECFDF5',
                                border: isSubscribed ? '1px solid #FEE2E2' : '1px solid #D1FAE5',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: isTogglingThis ? 'wait' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                              title={isSubscribed ? 'Mark as Unsubscribed' : 'Mark as Resubscribed'}
                            >
                              {isTogglingThis ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : isSubscribed ? (
                                <UserX size={12} />
                              ) : (
                                <UserCheck size={12} />
                              )}
                              <span>{isTogglingThis ? 'Saving...' : isSubscribed ? 'Unsubscribe' : 'Resubscribe'}</span>
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                disabled={isTogglingThis}
                                onClick={() => setSubscriberToDelete(sub)}
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ color: '#EF4444', padding: '3px', flexShrink: 0 }}
                                title="Delete Subscriber"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 15-Item Pagination with Smooth Auto-Scroll to Top */}
            <Pagination
              currentPage={effectivePage}
              totalItems={filteredSubscribers.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setCurrentPage(p)}
              itemLabel="subscribers"
            />
          </div>
        ) : (
          /* Empty State */
          <div
            className="card"
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <Mail size={28} style={{ color: '#94A3B8' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>No subscribers found</div>
              <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
                Website visitors who subscribe to the newsletter will appear here automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Subscriber Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '440px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>+ Add Newsletter Subscriber</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn btn-ghost btn-icon btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubscriber} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="subscriber@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Source / Channel</label>
                <input
                  type="text"
                  placeholder="e.g. MANUAL, EVENT, CAMPAIGN"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNew || !newEmail.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {savingNew ? 'Saving...' : 'Add Subscriber'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!subscriberToDelete}
        title="Delete Newsletter Subscriber"
        message={
          <>
            Are you sure you want to remove <strong>"{subscriberToDelete?.email}"</strong> from the newsletter subscribers list?
          </>
        }
        confirmLabel="Delete Subscriber"
        variant="danger"
        loading={deleting}
        onConfirm={executeDeleteSubscriber}
        onCancel={() => setSubscriberToDelete(null)}
      />
    </div>
  )
}
