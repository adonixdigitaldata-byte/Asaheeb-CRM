'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ExternalLink,
  Eye,
  X,
  Loader2,
  Filter,
  Shield,
  Briefcase,
  GraduationCap,
  FileCheck,
  HeartPulse,
  Folder,
  ChevronLeft,
  ChevronRight,
  User,
  RefreshCw,
  Copy,
  Check,
  Link2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DocumentCategory } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface ExpiringDocItem {
  id: string
  profile_id: string
  title: string
  category: DocumentCategory
  custom_category_name?: string | null
  document_number?: string | null
  issue_date?: string | null
  expiry_date: string
  file_url: string
  file_path?: string | null
  file_name?: string | null
  file_type?: string | null
  source_type: string
  download_url?: string
  diffDays: number
  status: 'EXPIRED' | 'EXPIRING_30' | 'EXPIRING_90' | 'VALID'
  profile?: {
    id: string
    name: string
    email: string
    role?: string
  } | null
}

const CATEGORY_MAP: Record<
  DocumentCategory,
  { label: string; icon: any; color: string; bg: string }
> = {
  PASSPORT: { label: 'Passport', icon: Shield, color: '#0284C7', bg: '#E0F2FE' },
  IQAMA_ID: { label: 'National ID / Iqama', icon: Shield, color: '#0F766E', bg: '#CCFBF1' },
  DRIVING_LICENSE: { label: 'Driving License', icon: Shield, color: '#6366F1', bg: '#EEF2FF' },
  EXPERIENCE_CERT: { label: 'Experience Certificate', icon: Briefcase, color: '#8B5CF6', bg: '#F5F3FF' },
  DEGREE_CERT: { label: 'Educational Degree', icon: GraduationCap, color: '#D97706', bg: '#FEF3C7' },
  EMPLOYMENT_CONTRACT: { label: 'Employment Contract', icon: FileCheck, color: '#16A34A', bg: '#DCFCE7' },
  INSURANCE: { label: 'Medical Insurance', icon: HeartPulse, color: '#EC4899', bg: '#FCE7F3' },
  OTHER: { label: 'Custom Document', icon: Folder, color: '#64748B', bg: '#F1F5F9' },
}

const PAGE_SIZE = 6

export default function DocumentExpiryTrackerModal({ isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<ExpiringDocItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Filters & Pagination
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXPIRED' | 'EXPIRING_30' | 'EXPIRING_90' | 'VALID'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  // Previewer
  const [previewDoc, setPreviewDoc] = useState<ExpiringDocItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Fetch documents directly from server endpoint with authenticated signed URLs
  async function fetchExpiringDocuments() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/team/expiries')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load document expiries')
      setDocuments(data.documents || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load document expiries')
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    if (isOpen) {
      fetchExpiringDocuments()
    }
  }, [isOpen])

  // Counts
  const counts = useMemo(() => {
    let expired = 0
    let expiring30 = 0
    let expiring90 = 0
    let valid = 0

    documents.forEach((d) => {
      if (d.status === 'EXPIRED') expired++
      else if (d.status === 'EXPIRING_30') expiring30++
      else if (d.status === 'EXPIRING_90') expiring90++
      else valid++
    })

    return {
      total: documents.length,
      expired,
      expiring30,
      expiring90,
      valid,
    }
  }, [documents])

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Tab filter
      if (activeTab === 'EXPIRED' && doc.status !== 'EXPIRED') return false
      if (activeTab === 'EXPIRING_30' && doc.status !== 'EXPIRING_30') return false
      if (activeTab === 'EXPIRING_90' && doc.status !== 'EXPIRING_90' && doc.status !== 'EXPIRING_30') return false
      if (activeTab === 'VALID' && doc.status !== 'VALID') return false

      // Category filter
      if (categoryFilter !== 'ALL' && doc.category !== categoryFilter) return false

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTitle = doc.title?.toLowerCase().includes(q)
        const matchName = doc.profile?.name?.toLowerCase().includes(q)
        const matchEmail = doc.profile?.email?.toLowerCase().includes(q)
        const matchNum = doc.document_number?.toLowerCase().includes(q)
        return matchTitle || matchName || matchEmail || matchNum
      }

      return true
    })
  }, [documents, activeTab, categoryFilter, search])

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE) || 1
  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredDocuments.slice(start, start + PAGE_SIZE)
  }, [filteredDocuments, currentPage])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FAFBFD',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarClock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Staff Document Expiry &amp; Compliance Tracker
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Direct overview of all employee passports, Iqamas, contracts, and certificates with upcoming expiration dates.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={fetchExpiringDocuments}
              className="btn btn-outline btn-xs"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Refresh expiries"
              disabled={loading}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div
              onClick={() => {
                setActiveTab('ALL')
                setCurrentPage(1)
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: `1.5px solid ${activeTab === 'ALL' ? '#1E3A8A' : 'var(--border)'}`,
                background: activeTab === 'ALL' ? '#EFF6FF' : '#FAFBFD',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                All Document Expiries
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1E3A8A', marginTop: 2 }}>
                {counts.total}
              </div>
            </div>

            <div
              onClick={() => {
                setActiveTab('EXPIRED')
                setCurrentPage(1)
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: `1.5px solid ${activeTab === 'EXPIRED' ? '#DC2626' : counts.expired > 0 ? '#FECACA' : 'var(--border)'}`,
                background: activeTab === 'EXPIRED' ? '#FEF2F2' : '#FFFDFD',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
                🔴 Expired Documents
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', marginTop: 2 }}>
                {counts.expired}
              </div>
            </div>

            <div
              onClick={() => {
                setActiveTab('EXPIRING_30')
                setCurrentPage(1)
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: `1.5px solid ${activeTab === 'EXPIRING_30' ? '#D97706' : counts.expiring30 > 0 ? '#FDE68A' : 'var(--border)'}`,
                background: activeTab === 'EXPIRING_30' ? '#FFFBEB' : '#FAFBFD',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                ⚠️ Next 30 Days
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#D97706', marginTop: 2 }}>
                {counts.expiring30}
              </div>
            </div>

            <div
              onClick={() => {
                setActiveTab('EXPIRING_90')
                setCurrentPage(1)
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: `1.5px solid ${activeTab === 'EXPIRING_90' ? '#B45309' : 'var(--border)'}`,
                background: activeTab === 'EXPIRING_90' ? '#FFFBEB' : '#FAFBFD',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>
                📅 Next 90 Days
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#B45309', marginTop: 2 }}>
                {counts.expiring90}
              </div>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                className="input input-sm"
                placeholder="Search by staff name, document title, or #..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                style={{ paddingLeft: 30, fontSize: 12.5 }}
              />
            </div>

            <select
              className="input input-sm"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setCurrentPage(1)
              }}
              style={{ minWidth: 150, fontSize: 12.5 }}
            >
              <option value="ALL">All Document Types</option>
              <option value="PASSPORT">Passports</option>
              <option value="IQAMA_ID">National ID / Iqama</option>
              <option value="DRIVING_LICENSE">Driving Licenses</option>
              <option value="EMPLOYMENT_CONTRACT">Contracts</option>
              <option value="EXPERIENCE_CERT">Experience Certs</option>
              <option value="INSURANCE">Insurance</option>
              <option value="OTHER">Custom Docs</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px', color: '#1E3A8A' }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Fetching document deadlines from Supabase...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '16px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', fontSize: 13, border: '1px solid #FECACA' }}>
              {error}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={36} style={{ color: '#10B981', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>No Matching Expiries Found</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {search || activeTab !== 'ALL' || categoryFilter !== 'ALL'
                  ? 'No documents match your current filter settings.'
                  : 'All staff documents are currently up to date!'}
              </div>
            </div>
          ) : (
            <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <table className="table" style={{ width: '100%', tableLayout: 'auto' }}>
                <thead style={{ background: '#F8FAFC' }}>
                  <tr>
                    <th style={{ width: 190 }}>Staff Member</th>
                    <th style={{ minWidth: 200 }}>Document &amp; Category</th>
                    <th style={{ width: 130 }}>Reference #</th>
                    <th style={{ width: 190 }}>Expiry Status</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDocuments.map((doc) => {
                    const cat = CATEGORY_MAP[doc.category] || CATEGORY_MAP.OTHER
                    const CatIcon = cat.icon
                    const isExpired = doc.status === 'EXPIRED'
                    const isExpiring30 = doc.status === 'EXPIRING_30'
                    const isExpiring90 = doc.status === 'EXPIRING_90'
                    const effectiveUrl = doc.download_url || doc.file_url

                    return (
                      <tr key={doc.id}>
                        {/* Staff Member */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: '#EFF6FF',
                                color: '#1E3A8A',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {doc.profile?.name ? doc.profile.name.substring(0, 2).toUpperCase() : 'ST'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <Link
                                href={`/team/${doc.profile_id}`}
                                onClick={onClose}
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.profile?.name || 'Staff Member'}
                              </Link>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.profile?.email || '—'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Document Title & Category */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                background: cat.bg,
                                color: cat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <CatIcon size={14} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                                {doc.title}
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: cat.color, background: cat.bg, padding: '1px 5px', borderRadius: 3 }}>
                                {doc.custom_category_name || cat.label}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Document Reference # */}
                        <td>
                          {doc.document_number ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  background: 'var(--surface-sunken)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {doc.document_number}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(doc.document_number!, doc.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)' }}
                                title="Copy number"
                              >
                                {copiedId === doc.id ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5 }}>—</span>
                          )}
                        </td>

                        {/* Expiry Status Badge */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {isExpired ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: '#DC2626',
                                  background: '#FEF2F2',
                                  border: '1px solid #FECACA',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  width: 'fit-content',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                🔴 Expired ({Math.abs(doc.diffDays)}d ago)
                              </span>
                            ) : isExpiring30 ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: '#D97706',
                                  background: '#FFFBEB',
                                  border: '1px solid #FDE68A',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  width: 'fit-content',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ⚠️ Expires in {doc.diffDays} day{doc.diffDays === 1 ? '' : 's'}
                              </span>
                            ) : isExpiring90 ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#B45309',
                                  background: '#FEF3C7',
                                  border: '1px solid #FCD34D',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  width: 'fit-content',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                📅 In ~{Math.ceil(doc.diffDays / 30)} months
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#166534',
                                  background: '#F0FDF4',
                                  border: '1px solid #BBF7D0',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  width: 'fit-content',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ✅ Valid until {doc.expiry_date}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Expiry: <strong>{doc.expiry_date}</strong>
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="btn btn-outline btn-xs"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Preview document"
                            >
                              <Eye size={12} /> View
                            </button>
                            <Link
                              href={`/team/${doc.profile_id}`}
                              onClick={onClose}
                              className="btn btn-primary btn-xs"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Open Employee Profile"
                            >
                              Profile →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {filteredDocuments.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: 6,
                background: '#FAFBFD',
                border: '1px solid var(--border)',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Showing <strong>{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
                <strong>{Math.min(currentPage * PAGE_SIZE, filteredDocuments.length)}</strong> of{' '}
                <strong>{filteredDocuments.length}</strong> items
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* In-App Document Preview Modal */}
      {previewDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 900,
              height: '82vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FAFBFD',
              }}
            >
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{previewDoc.title}</h4>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  {previewDoc.profile?.name} · Expiry: {previewDoc.expiry_date}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={previewDoc.download_url || previewDoc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-xs"
                >
                  <ExternalLink size={12} /> Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, background: '#F1F5F9', overflow: 'hidden' }}>
              {previewDoc.source_type === 'GOOGLE_DRIVE' || previewDoc.file_url?.includes('drive.google.com') ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: 14,
                    padding: 24,
                    textAlign: 'center',
                  }}
                >
                  <Link2 size={44} style={{ color: '#2563EB' }} />
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Google Drive Document</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 440 }}>
                    This document is stored on Google Drive. Click below to view the file securely.
                  </div>
                  <a
                    href={previewDoc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                  >
                    <ExternalLink size={14} /> Open in Google Drive
                  </a>
                </div>
              ) : previewDoc.file_type?.includes('pdf') || previewDoc.file_name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.download_url || previewDoc.file_url}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={previewDoc.title}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20 }}>
                  <img
                    src={previewDoc.download_url || previewDoc.file_url}
                    alt={previewDoc.title}
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
