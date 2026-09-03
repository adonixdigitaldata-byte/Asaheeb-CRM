'use client'

import React, { useState, useMemo } from 'react'
import {
  FileText,
  Upload,
  Link2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Download,
  Eye,
  Plus,
  Shield,
  Briefcase,
  GraduationCap,
  FileCheck,
  HeartPulse,
  Folder,
  X,
  Loader2,
  Building,
  User,
  Phone,
  Sparkles,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Search,
  Copy,
  Check,
  Filter,
  Paperclip,
} from 'lucide-react'
import type {
  EmployeeDocument,
  EmployeeCustomRecord,
  Profile,
  DocumentCategory,
  DocumentSourceType,
  CustomRecordType,
} from '@/types/database'

interface Props {
  member: Profile
  isAdmin: boolean
  initialDocuments: EmployeeDocument[]
  initialCustomRecords: EmployeeCustomRecord[]
}

const CATEGORY_MAP: Record<
  DocumentCategory,
  { label: string; icon: any; color: string; bg: string; group: 'id' | 'exp' | 'legal' | 'health' | 'other' }
> = {
  PASSPORT: { label: 'Passport', icon: Shield, color: '#0284C7', bg: '#E0F2FE', group: 'id' },
  IQAMA_ID: { label: 'National ID / Iqama', icon: Shield, color: '#0F766E', bg: '#CCFBF1', group: 'id' },
  DRIVING_LICENSE: { label: 'Driving License', icon: Shield, color: '#6366F1', bg: '#EEF2FF', group: 'id' },
  EXPERIENCE_CERT: { label: 'Experience Certificate', icon: Briefcase, color: '#8B5CF6', bg: '#F5F3FF', group: 'exp' },
  DEGREE_CERT: { label: 'Educational Degree', icon: GraduationCap, color: '#D97706', bg: '#FEF3C7', group: 'exp' },
  EMPLOYMENT_CONTRACT: { label: 'Employment Contract', icon: FileCheck, color: '#16A34A', bg: '#DCFCE7', group: 'legal' },
  INSURANCE: { label: 'Medical Insurance', icon: HeartPulse, color: '#EC4899', bg: '#FCE7F3', group: 'health' },
  OTHER: { label: 'Custom Document', icon: Folder, color: '#64748B', bg: '#F1F5F9', group: 'other' },
}

const DOCS_PER_PAGE = 6
const EXP_PER_PAGE = 4
const CUSTOM_PER_PAGE = 6

export default function EmployeeDocumentsTab({
  member,
  isAdmin,
  initialDocuments = [],
  initialCustomRecords = [],
}: Props) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>(initialDocuments)
  const [customRecords, setCustomRecords] = useState<EmployeeCustomRecord[]>(initialCustomRecords)

  // Filters & Search
  const [docSearch, setDocSearch] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')

  // Pagination states
  const [docsPage, setDocsPage] = useState(1)
  const [expPage, setExpPage] = useState(1)
  const [customPage, setCustomPage] = useState(1)

  // Modals for Creation
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isExperienceModalOpen, setIsExperienceModalOpen] = useState(false)
  const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null)

  // Modals for Editing
  const [editingDoc, setEditingDoc] = useState<EmployeeDocument | null>(null)
  const [editingExp, setEditingExp] = useState<EmployeeCustomRecord | null>(null)
  const [editingCf, setEditingCf] = useState<EmployeeCustomRecord | null>(null)

  // Upload modal form state
  const [docCategory, setDocCategory] = useState<DocumentCategory>('PASSPORT')
  const [docCustomCategory, setDocCustomCategory] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [docSourceType, setDocSourceType] = useState<DocumentSourceType>('UPLOAD')
  const [docIssueDate, setDocIssueDate] = useState('')
  const [docExpiryDate, setDocExpiryDate] = useState('')
  const [docNotes, setDocNotes] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docLinkUrl, setDocLinkUrl] = useState('')
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)

  // Experience modal form state
  const [expCompany, setExpCompany] = useState('')
  const [expRole, setExpRole] = useState('')
  const [expLocation, setExpLocation] = useState('')
  const [expStartDate, setExpStartDate] = useState('')
  const [expEndDate, setExpEndDate] = useState('')
  const [expIsCurrent, setExpIsCurrent] = useState(false)
  const [expSummary, setExpSummary] = useState('')
  const [expLinkedDocIds, setExpLinkedDocIds] = useState<string[]>([])
  const [isSubmittingExp, setIsSubmittingExp] = useState(false)

  // Custom Field modal form state
  const [cfType, setCfType] = useState<CustomRecordType>('CUSTOM_FIELD')
  const [cfTitle, setCfTitle] = useState('')
  const [cfValue, setCfValue] = useState('')
  const [cfExtra, setCfExtra] = useState('')
  const [isSubmittingCf, setIsSubmittingCf] = useState(false)

  // Action feedback & Copy
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function showNotice(text: string, type: 'success' | 'error' = 'success') {
    setActionNotice({ text, type })
    setTimeout(() => setActionNotice(null), 4000)
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Calculate Expiry Status
  function getExpiryStatus(expiryDateStr?: string | null) {
    if (!expiryDateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expDate = new Date(expiryDateStr)
    const diffTime = expDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { status: 'EXPIRED', label: `Expired (${expiryDateStr})`, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
    }
    if (diffDays <= 30) {
      return { status: 'EXPIRING_SOON', label: `Expires in ${diffDays}d (${expiryDateStr})`, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' }
    }
    if (diffDays <= 90) {
      return { status: 'WARNING', label: `Expires in ~${Math.ceil(diffDays / 30)} mo (${expiryDateStr})`, color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' }
    }
    return { status: 'VALID', label: `Valid until ${expiryDateStr}`, color: '#166534', bg: '#F0FDF4', border: '#BBF7D0' }
  }

  // Summary counts
  const summaryCounts = useMemo(() => {
    let expired = 0
    let expiringSoon = 0
    documents.forEach((d) => {
      const st = getExpiryStatus(d.expiry_date)
      if (st?.status === 'EXPIRED') expired++
      if (st?.status === 'EXPIRING_SOON') expiringSoon++
    })
    return {
      total: documents.length,
      expired,
      expiringSoon,
      experiences: customRecords.filter((r) => r.record_type === 'EXPERIENCE').length,
    }
  }, [documents, customRecords])

  // Filtered & Searched documents
  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && d.category !== selectedCategoryFilter) {
        return false
      }
      // Search
      if (docSearch.trim()) {
        const q = docSearch.toLowerCase()
        const matchTitle = d.title?.toLowerCase().includes(q)
        const matchNum = d.document_number?.toLowerCase().includes(q)
        const matchFile = d.file_name?.toLowerCase().includes(q)
        const matchNotes = d.notes?.toLowerCase().includes(q)
        return matchTitle || matchNum || matchFile || matchNotes
      }
      return true
    })
  }, [documents, selectedCategoryFilter, docSearch])

  // Pagination Slices
  const totalDocsPages = Math.ceil(filteredDocs.length / DOCS_PER_PAGE) || 1
  const paginatedDocs = useMemo(() => {
    const start = (docsPage - 1) * DOCS_PER_PAGE
    return filteredDocs.slice(start, start + DOCS_PER_PAGE)
  }, [filteredDocs, docsPage])

  const experienceRecords = useMemo(() => {
    return customRecords.filter((r) => r.record_type === 'EXPERIENCE')
  }, [customRecords])

  const totalExpPages = Math.ceil(experienceRecords.length / EXP_PER_PAGE) || 1
  const paginatedExp = useMemo(() => {
    const start = (expPage - 1) * EXP_PER_PAGE
    return experienceRecords.slice(start, start + EXP_PER_PAGE)
  }, [experienceRecords, expPage])

  const otherCustomRecords = useMemo(() => {
    return customRecords.filter((r) => r.record_type !== 'EXPERIENCE')
  }, [customRecords])

  const totalCustomPages = Math.ceil(otherCustomRecords.length / CUSTOM_PER_PAGE) || 1
  const paginatedCustom = useMemo(() => {
    const start = (customPage - 1) * CUSTOM_PER_PAGE
    return otherCustomRecords.slice(start, start + CUSTOM_PER_PAGE)
  }, [otherCustomRecords, customPage])

  // Pagination Component
  function renderPagination(
    currentPage: number,
    totalPages: number,
    totalItems: number,
    pageSize: number,
    setPage: React.Dispatch<React.SetStateAction<number>>
  ) {
    if (totalItems <= pageSize) return null
    const start = (currentPage - 1) * pageSize + 1
    const end = Math.min(currentPage * pageSize, totalItems)

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          background: '#FAFBFD',
        }}
      >
        <div>
          Showing <strong>{start}</strong> to <strong>{end}</strong> of <strong>{totalItems}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    )
  }

  // Handle Document Upload / Link Submit
  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault()
    setDocError(null)

    if (!docTitle.trim()) {
      setDocError('Please enter a document title.')
      return
    }

    if (docSourceType === 'UPLOAD' && !docFile) {
      setDocError('Please select a file to upload (PDF, PNG, JPG).')
      return
    }

    if (docSourceType !== 'UPLOAD' && !docLinkUrl.trim()) {
      setDocError('Please enter the Google Drive / external file link.')
      return
    }

    setIsSubmittingDoc(true)

    try {
      const formData = new FormData()
      formData.append('category', docCategory)
      if (docCategory === 'OTHER' && docCustomCategory) {
        formData.append('custom_category_name', docCustomCategory)
      }
      formData.append('title', docTitle)
      if (docNumber) formData.append('document_number', docNumber)
      formData.append('source_type', docSourceType)
      if (docIssueDate) formData.append('issue_date', docIssueDate)
      if (docExpiryDate) formData.append('expiry_date', docExpiryDate)
      if (docNotes) formData.append('notes', docNotes)

      if (docSourceType === 'UPLOAD' && docFile) {
        formData.append('file', docFile)
      } else {
        formData.append('link_url', docLinkUrl.trim())
      }

      const res = await fetch(`/api/team/${member.id}/documents`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save document')

      setDocuments((prev) => [data.document, ...prev])
      setIsUploadModalOpen(false)
      showNotice('Document saved successfully!')

      // Reset form
      setDocTitle('')
      setDocNumber('')
      setDocIssueDate('')
      setDocExpiryDate('')
      setDocNotes('')
      setDocFile(null)
      setDocLinkUrl('')
    } catch (err: any) {
      setDocError(err.message || 'Error saving document')
    } finally {
      setIsSubmittingDoc(false)
    }
  }

  // Handle Edit Document Submit
  async function handleUpdateDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!editingDoc) return
    setIsSubmittingDoc(true)

    try {
      const res = await fetch(`/api/team/${member.id}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId: editingDoc.id,
          title: editingDoc.title,
          category: editingDoc.category,
          custom_category_name: editingDoc.custom_category_name,
          document_number: editingDoc.document_number,
          issue_date: editingDoc.issue_date,
          expiry_date: editingDoc.expiry_date,
          notes: editingDoc.notes,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update document')

      setDocuments((prev) =>
        prev.map((d) => (d.id === editingDoc.id ? { ...d, ...data.document } : d))
      )
      setEditingDoc(null)
      showNotice('Document updated successfully!')
    } catch (err: any) {
      showNotice(err.message || 'Error updating document', 'error')
    } finally {
      setIsSubmittingDoc(false)
    }
  }

  // Handle Document Delete
  async function handleDeleteDocument(docId: string) {
    if (!confirm('Are you sure you want to remove this document record?')) return

    try {
      const res = await fetch(`/api/team/${member.id}/documents?docId=${docId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete document')
      }

      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      showNotice('Document removed.')
    } catch (err: any) {
      showNotice(err.message || 'Error deleting document', 'error')
    }
  }

  // Handle Add Experience Record
  async function handleCreateExperience(e: React.FormEvent) {
    e.preventDefault()
    if (!expCompany.trim() || !expRole.trim()) return

    setIsSubmittingExp(true)
    try {
      const res = await fetch(`/api/team/${member.id}/custom-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_type: 'EXPERIENCE',
          title: `${expRole} at ${expCompany}`,
          data: {
            company: expCompany,
            role: expRole,
            location: expLocation,
            start_date: expStartDate,
            end_date: expIsCurrent ? 'Present' : expEndDate,
            is_current: expIsCurrent,
            summary: expSummary,
            linked_doc_ids: expLinkedDocIds,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add experience')

      setCustomRecords((prev) => [data.record, ...prev])
      setIsExperienceModalOpen(false)
      showNotice('Prior experience added successfully!')

      // Reset form
      setExpCompany('')
      setExpRole('')
      setExpLocation('')
      setExpStartDate('')
      setExpEndDate('')
      setExpIsCurrent(false)
      setExpSummary('')
      setExpLinkedDocIds([])
    } catch (err: any) {
      showNotice(err.message || 'Error saving experience', 'error')
    } finally {
      setIsSubmittingExp(false)
    }
  }

  // Handle Update Experience Record
  async function handleUpdateExperience(e: React.FormEvent) {
    e.preventDefault()
    if (!editingExp) return
    const d = editingExp.data || {}

    setIsSubmittingExp(true)
    try {
      const res = await fetch(`/api/team/${member.id}/custom-records`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: editingExp.id,
          title: `${d.role} at ${d.company}`,
          data: {
            ...d,
            linked_doc_ids: d.linked_doc_ids || [],
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update experience')

      setCustomRecords((prev) =>
        prev.map((r) => (r.id === editingExp.id ? data.record : r))
      )
      setEditingExp(null)
      showNotice('Experience updated successfully!')
    } catch (err: any) {
      showNotice(err.message || 'Error updating experience', 'error')
    } finally {
      setIsSubmittingExp(false)
    }
  }

  // Handle Add Custom Field
  async function handleCreateCustomField(e: React.FormEvent) {
    e.preventDefault()
    if (!cfTitle.trim() || !cfValue.trim()) return

    setIsSubmittingCf(true)
    try {
      const res = await fetch(`/api/team/${member.id}/custom-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_type: cfType,
          title: cfTitle,
          data: {
            label: cfTitle,
            value: cfValue,
            extra: cfExtra || null,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add record')

      setCustomRecords((prev) => [data.record, ...prev])
      setIsCustomFieldModalOpen(false)
      showNotice('Custom field added successfully!')

      // Reset form
      setCfTitle('')
      setCfValue('')
      setCfExtra('')
    } catch (err: any) {
      showNotice(err.message || 'Error saving custom field', 'error')
    } finally {
      setIsSubmittingCf(false)
    }
  }

  // Handle Update Custom Field
  async function handleUpdateCustomField(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCf) return
    const d = editingCf.data || {}

    setIsSubmittingCf(true)
    try {
      const res = await fetch(`/api/team/${member.id}/custom-records`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: editingCf.id,
          title: editingCf.title,
          data: d,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update field')

      setCustomRecords((prev) =>
        prev.map((r) => (r.id === editingCf.id ? data.record : r))
      )
      setEditingCf(null)
      showNotice('Custom field updated successfully!')
    } catch (err: any) {
      showNotice(err.message || 'Error updating field', 'error')
    } finally {
      setIsSubmittingCf(false)
    }
  }

  // Handle Delete Custom Record
  async function handleDeleteRecord(recordId: string) {
    if (!confirm('Are you sure you want to remove this record?')) return
    try {
      const res = await fetch(`/api/team/${member.id}/custom-records?recordId=${recordId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete record')
      }
      setCustomRecords((prev) => prev.filter((r) => r.id !== recordId))
      showNotice('Record deleted.')
    } catch (err: any) {
      showNotice(err.message || 'Error deleting record', 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Toast Notice */}
      {actionNotice && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            background: actionNotice.type === 'error' ? 'var(--danger-light)' : 'var(--success-light)',
            color: actionNotice.type === 'error' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${actionNotice.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {actionNotice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {actionNotice.text}
        </div>
      )}

      {/* Top Overview Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Documents
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
            {summaryCounts.total}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Passports, contracts &amp; certificates
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Expiring Soon (&lt; 30d)
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: summaryCounts.expiringSoon > 0 ? '#D97706' : '#10B981',
              marginTop: 4,
            }}
          >
            {summaryCounts.expiringSoon}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Passports, Iqamas or Licenses
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Expired Documents
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: summaryCounts.expired > 0 ? '#DC2626' : '#10B981',
              marginTop: 4,
            }}
          >
            {summaryCounts.expired}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Requires immediate renewal
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Prior Work History
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E3A8A', marginTop: 4 }}>
            {summaryCounts.experiences}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Past documented employers
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: DOCUMENT VAULT & FILES TABLE */}
      {/* ============================================================ */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Header with Search, Filter & Actions */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Folder size={18} style={{ color: '#1E3A8A' }} /> Document Vault &amp; Attachments
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Passports, work certificates, relieving letters, payslips, and Google Drive links.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                className="input input-sm"
                placeholder="Search documents..."
                value={docSearch}
                onChange={(e) => {
                  setDocSearch(e.target.value)
                  setDocsPage(1)
                }}
                style={{ paddingLeft: 30, fontSize: 12.5 }}
              />
            </div>

            {/* Category Dropdown Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={13} style={{ color: 'var(--text-secondary)' }} />
              <select
                className="input input-sm"
                value={selectedCategoryFilter}
                onChange={(e) => {
                  setSelectedCategoryFilter(e.target.value)
                  setDocsPage(1)
                }}
                style={{ fontSize: 12.5, fontWeight: 600, minWidth: 140 }}
              >
                <option value="ALL">All Categories</option>
                <option value="PASSPORT">Passports</option>
                <option value="IQAMA_ID">National ID / Iqama</option>
                <option value="EXPERIENCE_CERT">Experience Certificates</option>
                <option value="DEGREE_CERT">Educational Degrees</option>
                <option value="EMPLOYMENT_CONTRACT">Contracts &amp; NDAs</option>
                <option value="DRIVING_LICENSE">Driving Licenses</option>
                <option value="INSURANCE">Medical Insurance</option>
                <option value="OTHER">Custom / Other</option>
              </select>
            </div>

            {/* Upload Button */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setDocTitle('')
                  setDocNumber('')
                  setDocFile(null)
                  setDocLinkUrl('')
                  setDocError(null)
                  setIsUploadModalOpen(true)
                }}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> Upload / Link
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {filteredDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
            <Folder size={36} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No Documents Found</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              {docSearch || selectedCategoryFilter !== 'ALL'
                ? 'No documents match your search or category filter.'
                : 'No documents have been uploaded or linked for this employee yet.'}
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>Document &amp; File</th>
                  <th style={{ width: 140 }}>Reference #</th>
                  <th style={{ width: 130 }}>Storage</th>
                  <th style={{ width: 170 }}>Validity &amp; Expiry</th>
                  <th style={{ minWidth: 150 }}>Notes</th>
                  <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDocs.map((doc) => {
                  const catInfo = CATEGORY_MAP[doc.category] || CATEGORY_MAP.OTHER
                  const CatIcon = catInfo.icon
                  const expiryInfo = getExpiryStatus(doc.expiry_date)
                  const isDrive = doc.source_type === 'GOOGLE_DRIVE' || doc.file_url?.includes('drive.google.com')
                  const effectiveUrl = (doc as any).download_url || doc.file_url

                  return (
                    <tr key={doc.id}>
                      {/* Document Title & File Details */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: catInfo.bg,
                              color: catInfo.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            <CatIcon size={18} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13.5, overflowWrap: 'anywhere' }}>
                              {doc.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: catInfo.color,
                                  background: catInfo.bg,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.custom_category_name || catInfo.label}
                              </span>
                              {doc.file_name && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-tertiary)',
                                    maxWidth: 180,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={doc.file_name}
                                >
                                  • {doc.file_name}
                                </span>
                              )}
                              {doc.file_size_bytes && (
                                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                                  ({(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Reference / ID Number */}
                      <td>
                        {doc.document_number ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                background: 'var(--surface-sunken)',
                                padding: '2px 7px',
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                                maxWidth: 120,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={doc.document_number}
                            >
                              {doc.document_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(doc.document_number!, doc.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)' }}
                              title="Copy number"
                            >
                              {copiedId === doc.id ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Source / Storage */}
                      <td>
                        {isDrive ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#2563EB',
                              background: '#EFF6FF',
                              padding: '2px 7px',
                              borderRadius: 12,
                              border: '1px solid #BFDBFE',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Link2 size={11} /> Google Drive
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#059669',
                              background: '#ECFDF5',
                              padding: '2px 7px',
                              borderRadius: 12,
                              border: '1px solid #A7F3D0',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Shield size={11} /> Cloud Storage
                          </span>
                        )}
                      </td>

                      {/* Validity & Expiry */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {expiryInfo ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: expiryInfo.color,
                                background: expiryInfo.bg,
                                border: `1px solid ${expiryInfo.border}`,
                                padding: '1px 6px',
                                borderRadius: 4,
                                width: 'fit-content',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {expiryInfo.label}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>No expiry date</span>
                          )}
                          {doc.issue_date && (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Issued: {doc.issue_date}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Notes with word wrap */}
                      <td>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            maxWidth: 220,
                          }}
                        >
                          {doc.notes || '—'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {/* Preview Modal */}
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="btn btn-outline btn-xs"
                            title="Preview Document"
                            style={{ padding: '4px 6px' }}
                          >
                            <Eye size={12} />
                          </button>

                          {/* Direct Download or Link */}
                          <a
                            href={effectiveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-xs"
                            title={isDrive ? 'Open Google Drive link' : 'Download file'}
                            style={{ padding: '4px 6px' }}
                          >
                            {isDrive ? <ExternalLink size={12} /> : <Download size={12} />}
                          </a>

                          {/* Edit Details */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setEditingDoc({ ...doc })}
                              className="btn btn-outline btn-xs"
                              title="Edit Document Details"
                              style={{ padding: '4px 6px' }}
                            >
                              <Edit2 size={12} />
                            </button>
                          )}

                          {/* Delete */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="btn btn-outline btn-xs"
                              title="Delete document"
                              style={{ padding: '4px 6px', color: 'var(--danger)' }}
                            >
                              <Trash2 size={12} />
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
        )}

        {/* Documents Table Pagination */}
        {renderPagination(docsPage, totalDocsPages, filteredDocs.length, DOCS_PER_PAGE, setDocsPage)}
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: PRIOR WORK EXPERIENCE */}
      {/* ============================================================ */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={18} style={{ color: '#8B5CF6' }} /> Previous Work Experience
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Documented track record with linked certificates, relieving letters, and previous payslips.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setExpCompany('')
                setExpRole('')
                setExpLocation('')
                setExpStartDate('')
                setExpEndDate('')
                setExpIsCurrent(false)
                setExpSummary('')
                setExpLinkedDocIds([])
                setIsExperienceModalOpen(true)
              }}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={13} /> Add Work Experience
            </button>
          )}
        </div>

        {experienceRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)' }}>
            <Briefcase size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 6 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>No previous work history added</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Click &quot;Add Work Experience&quot; to log prior real estate or corporate experience and attach verification proofs.
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {paginatedExp.map((exp) => {
              const d = exp.data || {}
              const linkedIds: string[] = d.linked_doc_ids || []
              const linkedDocs = documents.filter((doc) => linkedIds.includes(doc.id))

              return (
                <div
                  key={exp.id}
                  style={{
                    padding: '16px 18px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: '#FAFBFD',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: '#EDE9FE',
                        color: '#7C3AED',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontWeight: 700,
                      }}
                    >
                      <Building size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                          {d.role || exp.title}
                        </span>
                        {d.is_current && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: 4 }}>
                            CURRENT
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A', marginTop: 2, overflowWrap: 'anywhere' }}>
                        {d.company} {d.location ? `· ${d.location}` : ''}
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={13} />
                        <span>
                          {d.start_date || 'N/A'} — {d.end_date || 'Present'}
                        </span>
                      </div>

                      {d.summary && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--text-primary)',
                            marginTop: 8,
                            lineHeight: 1.5,
                            background: '#fff',
                            padding: '10px 14px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {d.summary}
                        </div>
                      )}

                      {/* Attached / Linked Documents Section */}
                      {linkedDocs.length > 0 && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Paperclip size={13} style={{ color: '#0F766E' }} /> Attached Documents &amp; Proofs ({linkedDocs.length})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {linkedDocs.map((ld) => {
                              const cat = CATEGORY_MAP[ld.category] || CATEGORY_MAP.OTHER
                              const isDrive = ld.source_type === 'GOOGLE_DRIVE' || ld.file_url?.includes('drive.google.com')
                              const effectiveUrl = (ld as any).download_url || ld.file_url

                              return (
                                <div
                                  key={ld.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: '#fff',
                                    border: '1px solid var(--border)',
                                    borderRadius: 6,
                                    padding: '3px 8px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                  }}
                                >
                                  <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, padding: '1px 5px', borderRadius: 3 }}>
                                    {cat.label}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: 'var(--text-primary)',
                                      maxWidth: 160,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={ld.title}
                                  >
                                    {ld.title}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc(ld)}
                                    className="btn btn-outline btn-xs"
                                    style={{ padding: '2px 5px', border: 'none', background: '#F1F5F9', color: '#1E3A8A' }}
                                    title="Preview in CRM"
                                  >
                                    <Eye size={11} />
                                  </button>
                                  <a
                                    href={effectiveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline btn-xs"
                                    style={{ padding: '2px 5px', border: 'none', background: '#F1F5F9', color: 'var(--text-secondary)' }}
                                    title={isDrive ? 'Open Google Drive link' : 'Download document'}
                                  >
                                    {isDrive ? <ExternalLink size={11} /> : <Download size={11} />}
                                  </a>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingExp({
                            ...exp,
                            data: {
                              company: d.company || '',
                              role: d.role || '',
                              location: d.location || '',
                              start_date: d.start_date || '',
                              end_date: d.end_date || '',
                              is_current: !!d.is_current,
                              summary: d.summary || '',
                              linked_doc_ids: d.linked_doc_ids || [],
                            },
                          })
                        }
                        className="btn btn-outline btn-xs"
                        title="Edit Experience & Linked Documents"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(exp.id)}
                        className="btn btn-outline btn-xs"
                        style={{ color: 'var(--danger)', padding: '4px 6px' }}
                        title="Remove experience"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Experience Pagination */}
        {renderPagination(expPage, totalExpPages, experienceRecords.length, EXP_PER_PAGE, setExpPage)}
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: CUSTOM EMPLOYEE FIELDS */}
      {/* ============================================================ */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} style={{ color: '#F59E0B' }} /> Custom Employee Fields &amp; Info
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Arbitrary metadata like Emergency Contacts, Blood Group, Home Country Address, or Special Tags.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCustomFieldModalOpen(true)}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={13} /> Add Custom Field
            </button>
          )}
        </div>

        {otherCustomRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
            <User size={30} style={{ color: 'var(--text-tertiary)', marginBottom: 6 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>No custom fields recorded</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Add emergency contacts, blood group, home country data, or custom notes.
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '18px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {paginatedCustom.map((r) => {
              const d = r.data || {}
              const isEmergency = r.record_type === 'EMERGENCY_CONTACT'
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: isEmergency ? '#FFFDF5' : '#FAFBFD',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minWidth: 0,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isEmergency ? '#D97706' : 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {r.title}
                      </div>

                      {isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingCf({
                                ...r,
                                title: r.title,
                                data: {
                                  label: d.label || r.title,
                                  value: d.value || '',
                                  extra: d.extra || '',
                                },
                              })
                            }
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-secondary)' }}
                            title="Edit field"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(r.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--danger)' }}
                            title="Delete field"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Value with proper word wrapping */}
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginTop: 6,
                        lineHeight: 1.4,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {d.value || '—'}
                    </div>

                    {/* Extra details (phone, relation, etc.) */}
                    {d.extra && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {isEmergency && <Phone size={12} style={{ flexShrink: 0 }} />} {d.extra}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Custom Fields Pagination */}
        {renderPagination(customPage, totalCustomPages, otherCustomRecords.length, CUSTOM_PER_PAGE, setCustomPage)}
      </div>

      {/* ============================================================ */}
      {/* MODAL: ADD DOCUMENT */}
      {/* ============================================================ */}
      {isUploadModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Add Employee Document
                </h3>
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  For {member.name} ({member.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {docError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 16,
                  border: '1px solid #FECACA',
                }}
              >
                {docError}
              </div>
            )}

            <form onSubmit={handleCreateDocument} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Storage Method Toggle */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Storage Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setDocSourceType('UPLOAD')}
                    style={{
                      padding: '10px',
                      borderRadius: 8,
                      border: `2px solid ${docSourceType === 'UPLOAD' ? '#1E3A8A' : 'var(--border)'}`,
                      background: docSourceType === 'UPLOAD' ? '#EFF6FF' : '#fff',
                      color: docSourceType === 'UPLOAD' ? '#1E3A8A' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={16} /> Direct File Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocSourceType('GOOGLE_DRIVE')}
                    style={{
                      padding: '10px',
                      borderRadius: 8,
                      border: `2px solid ${docSourceType === 'GOOGLE_DRIVE' ? '#1E3A8A' : 'var(--border)'}`,
                      background: docSourceType === 'GOOGLE_DRIVE' ? '#EFF6FF' : '#fff',
                      color: docSourceType === 'GOOGLE_DRIVE' ? '#1E3A8A' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <Link2 size={16} /> Google Drive / Web Link
                  </button>
                </div>
              </div>

              {/* Document Category */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Document Type *
                </label>
                <select
                  className="input"
                  value={docCategory}
                  onChange={(e) => {
                    const val = e.target.value as DocumentCategory
                    setDocCategory(val)
                    if (!docTitle) {
                      setDocTitle(`${CATEGORY_MAP[val]?.label || 'Document'} - ${member.name}`)
                    }
                  }}
                  required
                >
                  <option value="PASSPORT">🛂 Passport</option>
                  <option value="IQAMA_ID">🪪 National ID / Iqama</option>
                  <option value="EXPERIENCE_CERT">📜 Previous Experience Certificate</option>
                  <option value="DEGREE_CERT">🎓 Educational Degree / Certificate</option>
                  <option value="EMPLOYMENT_CONTRACT">💼 Employment Contract / Offer Letter</option>
                  <option value="DRIVING_LICENSE">🚗 Driving License</option>
                  <option value="INSURANCE">🏥 Medical / Health Insurance</option>
                  <option value="OTHER">📁 Custom / Other Document (Relieving, Payslip, etc.)</option>
                </select>
              </div>

              {docCategory === 'OTHER' && (
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Custom Category Label
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Relieving Letter, Past Payslips, Visa Stamp"
                    value={docCustomCategory}
                    onChange={(e) => setDocCustomCategory(e.target.value)}
                  />
                </div>
              )}

              {/* Title & Document Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Document Title *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Relieving Letter - Emaar"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Document / ID Number
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. A93819202"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* File Input OR Google Drive Link */}
              {docSourceType === 'UPLOAD' ? (
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Select File (PDF, PNG, JPG) *
                  </label>
                  <div
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 8,
                      padding: '24px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      cursor: 'pointer',
                    }}
                    onClick={() => document.getElementById('doc-file-input')?.click()}
                  >
                    <Upload size={28} style={{ color: '#64748B', marginBottom: 8 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {docFile ? docFile.name : 'Click to select or drag and drop document'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {docFile ? `${(docFile.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF, JPG, PNG, DOCX (Max 50MB)'}
                    </div>
                    <input
                      id="doc-file-input"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) setDocFile(e.target.files[0])
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Google Drive / Cloud Share Link *
                  </label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://drive.google.com/file/d/... or OneDrive link"
                    value={docLinkUrl}
                    onChange={(e) => setDocLinkUrl(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={docIssueDate}
                    onChange={(e) => setDocIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Expiry Date (for alerts)
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={docExpiryDate}
                    onChange={(e) => setDocExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Notes &amp; Remarks
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Optional verification remarks..."
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isSubmittingDoc}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingDoc}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isSubmittingDoc && <Loader2 size={14} className="animate-spin" />}
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT DOCUMENT */}
      {/* ============================================================ */}
      {editingDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: 520,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Edit Document Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateDocument} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Document Category
                </label>
                <select
                  className="input"
                  value={editingDoc.category}
                  onChange={(e) => setEditingDoc({ ...editingDoc, category: e.target.value as DocumentCategory })}
                  required
                >
                  <option value="PASSPORT">Passport</option>
                  <option value="IQAMA_ID">National ID / Iqama</option>
                  <option value="EXPERIENCE_CERT">Experience Certificate</option>
                  <option value="DEGREE_CERT">Educational Degree</option>
                  <option value="EMPLOYMENT_CONTRACT">Employment Contract</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                  <option value="INSURANCE">Medical Insurance</option>
                  <option value="OTHER">Custom Document</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Document Title *
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingDoc.title}
                  onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Document / Reference Number
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingDoc.document_number || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, document_number: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={editingDoc.issue_date || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, issue_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={editingDoc.expiry_date || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, expiry_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Notes &amp; Remarks
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={editingDoc.notes || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingDoc(null)}
                  disabled={isSubmittingDoc}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingDoc}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isSubmittingDoc && <Loader2 size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD PRIOR WORK EXPERIENCE (WITH LINKED DOCUMENTS) */}
      {/* ============================================================ */}
      {isExperienceModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Add Previous Work Experience
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Log past company details and link verification documents (certificates, payslips, relieving letters).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExperienceModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateExperience} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. EMAAR Properties / Dar Al Arkan"
                  value={expCompany}
                  onChange={(e) => setExpCompany(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Designation / Job Role *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Senior Sales Agent"
                    value={expRole}
                    onChange={(e) => setExpRole(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Location / City
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Riyadh, KSA"
                    value={expLocation}
                    onChange={(e) => setExpLocation(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Start Date
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Jan 2021"
                    value={expStartDate}
                    onChange={(e) => setExpStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    End Date
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Dec 2023"
                    value={expEndDate}
                    disabled={expIsCurrent}
                    onChange={(e) => setExpEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Responsibilities &amp; Summary
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Summary of responsibilities or portfolio handled..."
                  value={expSummary}
                  onChange={(e) => setExpSummary(e.target.value)}
                />
              </div>

              {/* Document Linking Section */}
              <div style={{ background: '#FAFBFD', padding: '14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Paperclip size={14} style={{ color: '#0F766E' }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Link Attached Documents &amp; Proofs
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                  Select any certificates, relieving letters, contracts, or past payslips uploaded in the Document Vault:
                </p>

                {documents.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '6px 0' }}>
                    No documents uploaded in vault yet. You can upload documents in the Vault above and link them anytime!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                    {documents.map((doc) => {
                      const isChecked = expLinkedDocIds.includes(doc.id)
                      const cat = CATEGORY_MAP[doc.category] || CATEGORY_MAP.OTHER

                      return (
                        <label
                          key={doc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: isChecked ? '#EFF6FF' : '#fff',
                            border: `1px solid ${isChecked ? '#93C5FD' : 'var(--border)'}`,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExpLinkedDocIds([...expLinkedDocIds, doc.id])
                              } else {
                                setExpLinkedDocIds(expLinkedDocIds.filter((id) => id !== doc.id))
                              }
                            }}
                          />
                          <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, padding: '1px 5px', borderRadius: 3 }}>
                            {cat.label}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </span>
                          {doc.document_number && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                              #{doc.document_number}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsExperienceModalOpen(false)}
                  disabled={isSubmittingExp}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingExp}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isSubmittingExp && <Loader2 size={14} className="animate-spin" />}
                  Save Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT PRIOR WORK EXPERIENCE (WITH LINKED DOCUMENTS) */}
      {/* ============================================================ */}
      {editingExp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Edit Work Experience &amp; Documents
              </h3>
              <button
                type="button"
                onClick={() => setEditingExp(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateExperience} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingExp.data?.company || ''}
                  onChange={(e) =>
                    setEditingExp({
                      ...editingExp,
                      data: { ...editingExp.data, company: e.target.value },
                    })
                  }
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Designation / Job Role *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editingExp.data?.role || ''}
                    onChange={(e) =>
                      setEditingExp({
                        ...editingExp,
                        data: { ...editingExp.data, role: e.target.value },
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Location / City
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editingExp.data?.location || ''}
                    onChange={(e) =>
                      setEditingExp({
                        ...editingExp,
                        data: { ...editingExp.data, location: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    Start Date
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editingExp.data?.start_date || ''}
                    onChange={(e) =>
                      setEditingExp({
                        ...editingExp,
                        data: { ...editingExp.data, start_date: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    End Date
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editingExp.data?.end_date || ''}
                    onChange={(e) =>
                      setEditingExp({
                        ...editingExp,
                        data: { ...editingExp.data, end_date: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Responsibilities &amp; Summary
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={editingExp.data?.summary || ''}
                  onChange={(e) =>
                    setEditingExp({
                      ...editingExp,
                      data: { ...editingExp.data, summary: e.target.value },
                    })
                  }
                />
              </div>

              {/* Linked Documents in Edit Modal */}
              <div style={{ background: '#FAFBFD', padding: '14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Paperclip size={14} style={{ color: '#0F766E' }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Linked Attached Documents &amp; Proofs
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                  Select documents linked to this employment (certificates, relieving letters, payslips):
                </p>

                {documents.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '6px 0' }}>
                    No documents in vault yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                    {documents.map((doc) => {
                      const currentLinked: string[] = editingExp.data?.linked_doc_ids || []
                      const isChecked = currentLinked.includes(doc.id)
                      const cat = CATEGORY_MAP[doc.category] || CATEGORY_MAP.OTHER

                      return (
                        <label
                          key={doc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: isChecked ? '#EFF6FF' : '#fff',
                            border: `1px solid ${isChecked ? '#93C5FD' : 'var(--border)'}`,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...currentLinked, doc.id]
                                : currentLinked.filter((id) => id !== doc.id)
                              setEditingExp({
                                ...editingExp,
                                data: { ...editingExp.data, linked_doc_ids: next },
                              })
                            }}
                          />
                          <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, padding: '1px 5px', borderRadius: 3 }}>
                            {cat.label}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </span>
                          {doc.document_number && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                              #{doc.document_number}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingExp(null)}
                  disabled={isSubmittingExp}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingExp}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isSubmittingExp && <Loader2 size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD CUSTOM FIELD */}
      {/* ============================================================ */}
      {isCustomFieldModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Add Custom Employee Field
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomFieldModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomField} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Field Type
                </label>
                <select
                  className="input"
                  value={cfType}
                  onChange={(e) => setCfType(e.target.value as CustomRecordType)}
                >
                  <option value="CUSTOM_FIELD">Custom Attribute (Key &amp; Value)</option>
                  <option value="EMERGENCY_CONTACT">Emergency Contact</option>
                  <option value="OTHER">General Note / Tag</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  {cfType === 'EMERGENCY_CONTACT' ? 'Contact Name & Relation *' : 'Field Name / Title *'}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={cfType === 'EMERGENCY_CONTACT' ? 'e.g. Tariq (Brother)' : 'e.g. Blood Group, GOSI No, Home Address'}
                  value={cfTitle}
                  onChange={(e) => setCfTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  {cfType === 'EMERGENCY_CONTACT' ? 'Phone Number *' : 'Field Value *'}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={cfType === 'EMERGENCY_CONTACT' ? '+966 50 123 4567' : 'e.g. O+, 2910391, Riyadh Olaya'}
                  value={cfValue}
                  onChange={(e) => setCfValue(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Primary contact in case of emergency"
                  value={cfExtra}
                  onChange={(e) => setCfExtra(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsCustomFieldModalOpen(false)}
                  disabled={isSubmittingCf}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingCf}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isSubmittingCf && <Loader2 size={14} className="animate-spin" />}
                  Save Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT CUSTOM FIELD */}
      {/* ============================================================ */}
      {editingCf && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Edit Custom Field
              </h3>
              <button
                type="button"
                onClick={() => setEditingCf(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomField} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Field Name / Title *
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingCf.title}
                  onChange={(e) => setEditingCf({ ...editingCf, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Field Value *
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={editingCf.data?.value || ''}
                  onChange={(e) =>
                    setEditingCf({
                      ...editingCf,
                      data: { ...editingCf.data, value: e.target.value },
                    })
                  }
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingCf.data?.extra || ''}
                  onChange={(e) =>
                    setEditingCf({
                      ...editingCf,
                      data: { ...editingCf.data, extra: e.target.value },
                    })
                  }
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingCf(null)}
                  disabled={isSubmittingCf}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingCf}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {isSubmittingCf && <Loader2 size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: DOCUMENT PREVIEW */}
      {/* ============================================================ */}
      {previewDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 900,
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FAFBFD',
              }}
            >
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {previewDoc.title}
                </h4>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {previewDoc.document_number ? `ID: ${previewDoc.document_number} · ` : ''}
                  {previewDoc.file_name}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={(previewDoc as any).download_url || previewDoc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <ExternalLink size={13} /> Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div style={{ flex: 1, background: '#F1F5F9', overflow: 'hidden', position: 'relative' }}>
              {previewDoc.file_type?.includes('pdf') || previewDoc.file_name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={(previewDoc as any).download_url || previewDoc.file_url}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={previewDoc.title}
                />
              ) : previewDoc.source_type === 'GOOGLE_DRIVE' || previewDoc.file_url?.includes('drive.google.com') ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: 16,
                    padding: 24,
                    textAlign: 'center',
                  }}
                >
                  <Link2 size={48} style={{ color: '#2563EB' }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Google Drive Cloud Document
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460 }}>
                    This document is stored on Google Drive. Click below to open and review it securely in Google Drive.
                  </div>
                  <a
                    href={previewDoc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
                  >
                    <ExternalLink size={16} /> Open Document in Google Drive
                  </a>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    padding: 20,
                    overflow: 'auto',
                  }}
                >
                  <img
                    src={(previewDoc as any).download_url || previewDoc.file_url}
                    alt={previewDoc.title}
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }}
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
