'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  Download,
  Calendar,
  Phone,
  Landmark,
  Building2,
  TrendingUp,
  RefreshCw,
  MessageCircle,
  Eye,
  Users,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatTimeAgo } from '@/lib/utils'
import type { MortgageLead, Profile } from '@/types/database'
import MortgageLeadDrawer, { STATUS_CONFIG, parseNotes } from './MortgageLeadDrawer'
import Pagination from '@/components/Pagination'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'

interface Props {
  profile: Profile
}

const BANKS_LIST = [
  { slug: 'emirates-nbd', name: 'Emirates NBD' },
  { slug: 'al-rajhi', name: 'Al Rajhi' },
  { slug: 'snb', name: 'SNB (AlAhli)' },
  { slug: 'riyad-bank', name: 'Riyad Bank' },
  { slug: 'bsf', name: 'BSF (Banque Saudi Fransi)' },
  { slug: 'sab', name: 'SAB (Saudi Awwal Bank)' },
  { slug: 'al-jazira', name: 'Bank AlJazira' },
  { slug: 'fab', name: 'FAB' },
  { slug: 'shl', name: 'SHL' },
  { slug: 'dar-al-tamleek', name: 'Dar Al Tamleek' },
]

export default function MortgageLeadsClient({ profile }: Props) {
  const supabase = createClient()
  const canManage = profile.role === 'ADMIN' || profile.role === 'SALES_MANAGER'

  const [leads, setLeads] = useState<MortgageLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<MortgageLead | null>(null)
  const [exporting, setExporting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [constraintAlert, setConstraintAlert] = useState<string | null>(null)
  const [copiedSql, setCopiedSql] = useState(false)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Selection & Bulk Delete State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Single Delete State
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<MortgageLead | null>(null)
  const [singleDeleting, setSingleDeleting] = useState(false)

  // Edit Lead Modal State
  const [editingLead, setEditingLead] = useState<MortgageLead | null>(null)
  const [editForm, setEditForm] = useState<{
    full_name: string
    phone: string
    status: string
    bank_name: string
    property_price: number | string
    down_payment_amount: number | string
    loan_period_years: number | string
  }>({
    full_name: '',
    phone: '',
    status: 'new',
    bank_name: '',
    property_price: '',
    down_payment_amount: '',
    loan_period_years: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Filters State
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [citizenFilter, setCitizenFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('ALL')

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mortgage_leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching mortgage leads:', error.message || error)
      } else if (data) {
        setLeads(data as MortgageLead[])
      }
    } catch (err: any) {
      console.error('Error fetching mortgage leads:', err?.message || err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Update Status handler with friendly constraint error capture
  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    setUpdatingId(leadId)
    const previousLead = leads.find((l) => l.id === leadId)
    const oldStatus = previousLead?.status || 'new'

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    )
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null))
    }

    try {
      const res = await fetch('/api/mortgage-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        console.error('Status update error:', result.error)
        // Revert optimistic update
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: oldStatus } : l))
        )
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead((prev) => (prev ? { ...prev, status: oldStatus } : null))
        }

        const errMsg = result.error || 'Update failed'
        if (
          errMsg.includes('violates check constraint') ||
          errMsg.includes('mortgage_leads_status_check')
        ) {
          setConstraintAlert(
            `Database constraint notice: In your Supabase project (open in your browser tab), open the SQL Editor and run this one-line command to allow all 6 pipeline statuses:
ALTER TABLE public.mortgage_leads DROP CONSTRAINT IF EXISTS mortgage_leads_status_check;`
          )
        } else {
          alert(`Status update failed: ${errMsg}`)
        }
      }
    } catch (err: any) {
      console.error('Error updating status:', err?.message || err)
      fetchLeads()
    } finally {
      setUpdatingId(null)
    }
  }

  // Add Note handler
  const handleAddNote = async (leadId: string, noteText: string) => {
    const targetLead = leads.find((l) => l.id === leadId)
    if (!targetLead) return

    const currentNotes = parseNotes(targetLead.notes)
    const newEntry = {
      id: crypto.randomUUID(),
      text: noteText,
      created_at: new Date().toISOString(),
      author_name: profile.name || 'Mortgage Advisor',
      author_id: profile.id,
    }
    const updatedNotesList = [newEntry, ...currentNotes]
    const updatedNotesJson = JSON.stringify(updatedNotesList)

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes: updatedNotesJson } : l))
    )
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, notes: updatedNotesJson } : null))
    }

    try {
      const res = await fetch('/api/mortgage-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, notes: updatedNotesJson }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        console.error('Error saving note:', result.error)
        fetchLeads()
      }
    } catch (err: any) {
      console.error('Error saving note:', err?.message || err)
      fetchLeads()
    }
  }

  // Edit Note handler
  const handleEditNote = async (leadId: string, noteId: string, updatedText: string) => {
    const targetLead = leads.find((l) => l.id === leadId)
    if (!targetLead) return

    const currentNotes = parseNotes(targetLead.notes)
    const updatedNotesList = currentNotes.map((n) =>
      n.id === noteId ? { ...n, text: updatedText, updated_at: new Date().toISOString() } : n
    )
    const updatedNotesJson = JSON.stringify(updatedNotesList)

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes: updatedNotesJson } : l))
    )
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, notes: updatedNotesJson } : null))
    }

    try {
      const res = await fetch('/api/mortgage-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, notes: updatedNotesJson }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        console.error('Error updating note:', result.error)
        fetchLeads()
      }
    } catch (err: any) {
      console.error('Error updating note:', err?.message || err)
      fetchLeads()
    }
  }

  // Delete Note handler
  const handleDeleteNote = async (leadId: string, noteId: string) => {
    const targetLead = leads.find((l) => l.id === leadId)
    if (!targetLead) return

    const currentNotes = parseNotes(targetLead.notes)
    const updatedNotesList = currentNotes.filter((n) => n.id !== noteId)
    const updatedNotesJson = updatedNotesList.length > 0 ? JSON.stringify(updatedNotesList) : null

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes: updatedNotesJson } : l))
    )
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, notes: updatedNotesJson } : null))
    }

    try {
      const res = await fetch('/api/mortgage-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, notes: updatedNotesJson }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        console.error('Error deleting note:', result.error)
        fetchLeads()
      }
    } catch (err: any) {
      console.error('Error deleting note:', err?.message || err)
      fetchLeads()
    }
  }

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const nameMatch = lead.full_name?.toLowerCase().includes(q)
        const phone = lead.phone || lead.phone_number || ''
        const phoneMatch = phone.toLowerCase().includes(q)
        const bankName = lead.bank_name || lead.bank_name_en || lead.bank_slug || ''
        const bankMatch = bankName.toLowerCase().includes(q)
        if (!nameMatch && !phoneMatch && !bankMatch) return false
      }

      if (bankFilter !== 'ALL') {
        const leadSlug = lead.bank_slug?.toLowerCase()
        const filterSlug = bankFilter.toLowerCase()
        if (leadSlug !== filterSlug) return false
      }

      if (statusFilter !== 'ALL') {
        if (lead.status !== statusFilter) return false
      }

      if (citizenFilter !== 'ALL') {
        const isCitizenExpected = citizenFilter === 'CITIZEN'
        if (lead.is_citizen !== isCitizenExpected) return false
      }

      if (dateFilter !== 'ALL' && lead.created_at) {
        const createdAt = new Date(lead.created_at)
        const now = new Date()
        if (dateFilter === 'TODAY') {
          const isToday =
            createdAt.getDate() === now.getDate() &&
            createdAt.getMonth() === now.getMonth() &&
            createdAt.getFullYear() === now.getFullYear()
          if (!isToday) return false
        } else if (dateFilter === 'THIS_WEEK') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (createdAt < sevenDaysAgo) return false
        } else if (dateFilter === 'THIS_MONTH') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (createdAt < thirtyDaysAgo) return false
        }
      }

      return true
    })
  }, [leads, search, bankFilter, statusFilter, citizenFilter, dateFilter])

  // Reset pagination and selection on filter change
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
  }, [search, bankFilter, statusFilter, citizenFilter, dateFilter])

  // Paginated leads slice
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLeads.slice(start, start + pageSize)
  }, [filteredLeads, currentPage, pageSize])

  // Selection helpers
  const allOnPageSelected =
    paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.includes(l.id))

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const pageIds = new Set(paginatedLeads.map((l) => l.id))
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)))
    } else {
      const newIds = new Set([...selectedIds, ...paginatedLeads.map((l) => l.id)])
      setSelectedIds(Array.from(newIds))
    }
  }

  const toggleSelectLead = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${selectedIds.length} selected mortgage lead(s)?`
    )
    if (!confirmed) return

    setBulkDeleting(true)
    try {
      const res = await fetch('/api/mortgage-leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        alert(`Bulk delete failed: ${result.error || 'Server error'}`)
        return
      }

      setLeads((prev) => prev.filter((l) => !selectedIds.includes(l.id)))
      if (selectedLead && selectedIds.includes(selectedLead.id)) {
        setSelectedLead(null)
      }
      setSelectedIds([])
    } catch (err: any) {
      console.error('Error during bulk delete:', err?.message || err)
      alert('An unexpected error occurred during bulk delete.')
    } finally {
      setBulkDeleting(false)
    }
  }

  // Single Delete
  const handleDeleteSingle = async () => {
    if (!deleteConfirmLead) return
    setSingleDeleting(true)
    try {
      const res = await fetch('/api/mortgage-leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirmLead.id }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        alert(`Delete failed: ${result.error || 'Server error'}`)
        return
      }

      setLeads((prev) => prev.filter((l) => l.id !== deleteConfirmLead.id))
      if (selectedLead?.id === deleteConfirmLead.id) {
        setSelectedLead(null)
      }
      setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirmLead.id))
      setDeleteConfirmLead(null)
    } catch (err: any) {
      console.error('Error deleting lead:', err?.message || err)
      alert('An unexpected error occurred while deleting the lead.')
    } finally {
      setSingleDeleting(false)
    }
  }

  // Open Edit Modal
  const openEditModal = (lead: MortgageLead) => {
    setEditingLead(lead)
    setEditForm({
      full_name: lead.full_name || '',
      phone: lead.phone || lead.phone_number || '',
      status: lead.status || 'new',
      bank_name: lead.bank_name || lead.bank_name_en || lead.bank_slug || '',
      property_price: lead.property_price ?? '',
      down_payment_amount: lead.down_payment_amount ?? '',
      loan_period_years: lead.loan_period_years ?? '',
    })
  }

  // Save Edit Lead
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLead) return
    setSavingEdit(true)
    try {
      const updates = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        status: editForm.status,
        bank_name: editForm.bank_name.trim(),
        property_price: Number(editForm.property_price) || 0,
        down_payment_amount: Number(editForm.down_payment_amount) || 0,
        loan_period_years: Number(editForm.loan_period_years) || 0,
      }

      const res = await fetch('/api/mortgage-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingLead.id, ...updates }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        alert(`Failed to save edits: ${result.error || 'Server error'}`)
        return
      }

      setLeads((prev) =>
        prev.map((l) => (l.id === editingLead.id ? { ...l, ...updates } : l))
      )
      if (selectedLead?.id === editingLead.id) {
        setSelectedLead((prev) => (prev ? { ...prev, ...updates } : null))
      }
      setEditingLead(null)
    } catch (err: any) {
      console.error('Error saving lead edits:', err?.message || err)
      alert('An unexpected error occurred while saving.')
    } finally {
      setSavingEdit(false)
    }
  }

  // KPIs
  const stats = useMemo(() => {
    const totalCount = leads.length
    const newCount = leads.filter((l) => l.status === 'new').length
    const totalLoanVolume = leads.reduce((sum, l) => {
      const loanAmount = l.total_loan_amount ?? (l.property_price - l.down_payment_amount)
      return sum + (Number(loanAmount) || 0)
    }, 0)
    const avgInstalment =
      leads.length > 0
        ? leads.reduce((sum, l) => sum + (Number(l.monthly_instalment) || 0), 0) / leads.length
        : 0

    return { totalCount, newCount, totalLoanVolume, avgInstalment }
  }, [leads])

  // CSV Export
  const handleExportCSV = () => {
    setExporting(true)
    try {
      const headers = [
        'Submission Date',
        'Applicant Name',
        'Phone Number',
        'Bank Name',
        'Bank Slug',
        'Property Price (SAR)',
        'Down Payment (SAR)',
        'Down Payment %',
        'Tenure (Years)',
        'Applied Rate % APR',
        'Monthly Instalment (SAR)',
        'Total Loan Amount (SAR)',
        'Total Payable (SAR)',
        'Monthly Income (SAR)',
        'Monthly Obligations (SAR)',
        'Saudi Citizen',
        'First Home Buyer',
        'REDF Sakani Support',
        'Status',
        'Source',
      ]

      const rows = filteredLeads.map((lead) => {
        const phone = lead.phone || lead.phone_number || ''
        const bankName = lead.bank_name || lead.bank_name_en || lead.bank_slug || ''
        const totalLoan = lead.total_loan_amount ?? (lead.property_price - lead.down_payment_amount)
        const totalPayable = lead.total_payable ?? lead.total_payable_value ?? 0
        const hasRedf = lead.has_redf_support ?? lead.redf_supported

        return [
          lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : '',
          `"${(lead.full_name || '').replace(/"/g, '""')}"`,
          `"${phone}"`,
          `"${bankName}"`,
          lead.bank_slug || '',
          lead.property_price || 0,
          lead.down_payment_amount || 0,
          lead.down_payment_pct || 0,
          lead.loan_period_years || 0,
          lead.applied_rate_pct || 0,
          lead.monthly_instalment || 0,
          totalLoan || 0,
          totalPayable || 0,
          lead.monthly_income || '',
          lead.monthly_obligations || '',
          lead.is_citizen ? 'Yes' : 'No',
          lead.is_first_home !== null && lead.is_first_home !== undefined ? (lead.is_first_home ? 'Yes' : 'No') : '',
          hasRedf !== null && hasRedf !== undefined ? (hasRedf ? 'Yes' : 'No') : '',
          lead.status || 'new',
          lead.source || '',
        ].join(',')
      })

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `mortgage_leads_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    bankFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    citizenFilter !== 'ALL' ||
    dateFilter !== 'ALL'

  const clearFilters = () => {
    setSearch('')
    setBankFilter('ALL')
    setStatusFilter('ALL')
    setCitizenFilter('ALL')
    setDateFilter('ALL')
  }

  const sqlFix = 'ALTER TABLE public.mortgage_leads DROP CONSTRAINT IF EXISTS mortgage_leads_status_check;'

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Constraint Alert Notice */}
      {constraintAlert && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle size={18} style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, color: '#92400E' }}>
                Database Status Constraint Notice
              </div>
              <div style={{ color: '#78350F', marginTop: 4, lineHeight: 1.4 }}>
                Your Supabase table has a constraint restricting statuses to <code>(&apos;new&apos;, &apos;contacted&apos;, &apos;closed&apos;)</code>.
                To unlock all 6 custom stages, copy and run this in your open Supabase tab (SQL Editor):
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  backgroundColor: '#FEF3C7',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#92400E',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: 'fit-content',
                }}
              >
                <span>{sqlFix}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sqlFix)
                    setCopiedSql(true)
                    setTimeout(() => setCopiedSql(false), 2000)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#B45309',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConstraintAlert(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', padding: 4 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: '#EFF6FF',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Landmark size={20} />
            </div>
            <div>
              <h1 className="text-page-title" style={{ margin: 0 }}>Mortgage Leads Pipeline</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Review and manage high-intent user loan calculation estimates from the public website
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="btn btn-outline btn-sm"
            title="Refresh Leads"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting || filteredLeads.length === 0}
            className="btn btn-primary btn-sm"
          >
            <Download size={14} />
            <span>{exporting ? 'Exporting...' : 'Export to CSV'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        {/* Total Inquiries */}
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Inquiries
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {stats.totalCount}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              From website calculator
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F4F4F5', color: '#71717A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
        </div>

        {/* New Leads */}
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid #0284C7' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              New Leads
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#0284C7' }}>
                {stats.newCount}
              </span>
              {stats.newCount > 0 && (
                <span className="badge" style={{ backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: 10.5, fontWeight: 700 }}>
                  Awaiting Call
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Uncontacted applications
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0F9FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={22} />
          </div>
        </div>

        {/* Requested Financing Volume */}
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid #16A34A' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Loan Volume Sought
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>
              {formatCurrency(stats.totalLoanVolume)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Total financing pipeline
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SaudiRiyalIcon size={22} color="#16A34A" />
          </div>
        </div>

        {/* Average Monthly Payment */}
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avg. Monthly Instalment
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {formatCurrency(stats.avgInstalment)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>/mo</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Average buyer instalment
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F4F4F5', color: '#71717A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, or bank..."
              className="form-input"
              style={{ paddingLeft: 34 }}
            />
          </div>

          {/* Bank Filter */}
          <div>
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="form-select"
            >
              <option value="ALL">All Banks</option>
              {BANKS_LIST.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Citizenship Filter */}
          <div>
            <select
              value={citizenFilter}
              onChange={(e) => setCitizenFilter(e.target.value)}
              className="form-select"
            >
              <option value="ALL">All Nationalities</option>
              <option value="CITIZEN">Saudi Citizens Only</option>
              <option value="EXPAT">Expat Residents Only</option>
            </select>
          </div>
        </div>

        {/* Date Filter & Clear Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: 4 }}>
              Timeframe:
            </span>
            {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setDateFilter(period)}
                className={`btn btn-sm ${dateFilter === period ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '3px 10px', fontSize: 11.5 }}
              >
                {period === 'ALL'
                  ? 'All Time'
                  : period === 'TODAY'
                  ? 'Today'
                  : period === 'THIS_WEEK'
                  ? 'Last 7 Days'
                  : 'Last 30 Days'}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {canManage && selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            color: '#991B1B',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {selectedIds.length} lead{selectedIds.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="btn btn-outline btn-sm"
              style={{ fontSize: 12, backgroundColor: '#FFFFFF' }}
            >
              Deselect All
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={handleBulkDelete}
              className="btn btn-danger btn-sm"
              style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 size={13} />
              <span>{bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Leads Table Container */}
      <div className="table-container" style={{ width: '100%', overflowX: 'hidden' }}>
        <table className="crm-table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            {canManage && <col style={{ width: 36 }} />}
            <col style={{ width: 95 }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: 105 }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 125 }} />
            <col style={{ width: 135 }} />
          </colgroup>
          <thead>
            <tr>
              {canManage && (
                <th style={{ padding: '10px 4px', width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--accent)' }}
                    title={allOnPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                  />
                </th>
              )}
              <th style={{ padding: '10px 8px' }}>Date</th>
              <th style={{ padding: '10px 8px' }}>Applicant</th>
              <th style={{ padding: '10px 8px' }}>Selected Bank</th>
              <th style={{ padding: '10px 8px' }}>Property Price</th>
              <th style={{ padding: '10px 8px' }}>Financing Terms</th>
              <th style={{ padding: '10px 8px' }}>Monthly Instalment</th>
              <th style={{ padding: '10px 8px' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', width: 135 }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                    <RefreshCw size={20} className="spin" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Loading mortgage inquiries...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    <Landmark size={30} style={{ color: '#CBD5E1', marginBottom: 4 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      No matching mortgage leads found
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {hasActiveFilters
                        ? 'Try clearing or changing your search filters above.'
                        : 'New inquiries submitted via the website calculator will appear here automatically.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedLeads.map((lead) => {
                const phone = lead.phone || lead.phone_number || ''
                const bankName = lead.bank_name || lead.bank_name_en || lead.bank_slug || 'Bank'
                const statusConf = STATUS_CONFIG[lead.status] || {
                  label: lead.status || 'New',
                  bg: '#F4F4F5',
                  text: '#3F3F46',
                  desc: '',
                }
                const isUpdating = updatingId === lead.id

                return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Checkbox */}
                    {canManage && (
                      <td
                        style={{ padding: '10px 4px', textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--accent)' }}
                        />
                      </td>
                    )}

                    {/* Date */}
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatDate(lead.created_at)}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1, whiteSpace: 'nowrap' }}>
                        {formatTimeAgo(lead.created_at)}
                      </div>
                    </td>

                    {/* Applicant */}
                    <td style={{ padding: '10px 8px', overflow: 'hidden' }}>
                      <div
                        style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        title={lead.full_name}
                      >
                        {lead.full_name}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {phone}
                      </div>
                    </td>

                    {/* Bank */}
                    <td style={{ padding: '10px 8px', overflow: 'hidden' }}>
                      <div
                        style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12.5, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        title={bankName}
                      >
                        {bankName}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                        {lead.applied_rate_pct}% APR
                      </div>
                    </td>

                    {/* Property Value */}
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 13 }}>
                        {formatCurrency(lead.property_price)}
                      </span>
                    </td>

                    {/* Financing Details */}
                    <td style={{ padding: '10px 8px', overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                        Down: {formatCurrency(lead.down_payment_amount)}{' '}
                        <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 400 }}>
                          ({lead.down_payment_pct}%)
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1, whiteSpace: 'nowrap' }}>
                        Term: {lead.loan_period_years} Years
                      </div>
                    </td>

                    {/* Monthly Instalment */}
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 800, color: '#16A34A', fontSize: 13 }}>
                        {formatCurrency(lead.monthly_instalment)}
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)' }}>/mo</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {lead.is_citizen ? 'Saudi Citizen' : 'Expat'}
                      </div>
                    </td>

                    {/* Status Select */}
                    <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                        <select
                          disabled={isUpdating}
                          value={lead.status}
                          onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                          style={{
                            padding: '3px 18px 3px 6px',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 6,
                            border: `1px solid ${statusConf.bg}`,
                            backgroundColor: statusConf.bg,
                            color: statusConf.text,
                            cursor: 'pointer',
                            outline: 'none',
                            width: '100%',
                            maxWidth: 118,
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <option key={key} value={key} style={{ backgroundColor: '#FFFFFF', color: '#18181B' }}>
                              {config.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td style={{ padding: '10px 6px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        {phone && (
                          <a
                            href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                            style={{
                              width: 28,
                              height: 28,
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#16A34A',
                              borderColor: '#BBF7D0',
                              backgroundColor: '#F0FDF4',
                              borderRadius: 6,
                            }}
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle size={13} />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedLead(lead)}
                          className="btn btn-outline btn-sm"
                          style={{
                            width: 28,
                            height: 28,
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                          }}
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>

                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(lead)}
                              className="btn btn-outline btn-sm"
                              style={{
                                width: 28,
                                height: 28,
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 6,
                              }}
                              title="Edit lead details"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmLead(lead)}
                              className="btn btn-outline btn-sm"
                              style={{
                                width: 28,
                                height: 28,
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#DC2626',
                                borderColor: '#FECACA',
                                backgroundColor: '#FEF2F2',
                                borderRadius: 6,
                              }}
                              title="Delete lead"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Component */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredLeads.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize)
          setCurrentPage(1)
        }}
        pageSizeOptions={[15, 25, 50, 100]}
        itemLabel="leads"
      />

      {/* Slide-out Detail Drawer */}
      <MortgageLeadDrawer
        lead={selectedLead}
        profile={profile}
        onClose={() => setSelectedLead(null)}
        onUpdateStatus={handleUpdateStatus}
        onAddNote={handleAddNote}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
      />

      {/* Edit Lead Modal */}
      {editingLead && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingLead(null)
          }}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540 }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Edit Mortgage Lead</h3>
              <button
                type="button"
                onClick={() => setEditingLead(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                    Applicant Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Abdullah Al-Otaibi"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="form-input"
                    placeholder="e.g. +966 50 123 4567"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                      Pipeline Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="form-select"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                      Selected Bank
                    </label>
                    <input
                      type="text"
                      value={editForm.bank_name}
                      onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                      className="form-input"
                      placeholder="e.g. Emirates NBD, Al Rajhi"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                      Property Price (SAR)
                    </label>
                    <input
                      type="number"
                      value={editForm.property_price}
                      onChange={(e) => setEditForm({ ...editForm, property_price: e.target.value })}
                      className="form-input"
                      placeholder="2000000"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                      Down Payment (SAR)
                    </label>
                    <input
                      type="number"
                      value={editForm.down_payment_amount}
                      onChange={(e) => setEditForm({ ...editForm, down_payment_amount: e.target.value })}
                      className="form-input"
                      placeholder="200000"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                      Tenure (Years)
                    </label>
                    <input
                      type="number"
                      value={editForm.loan_period_years}
                      onChange={(e) => setEditForm({ ...editForm, loan_period_years: e.target.value })}
                      className="form-input"
                      placeholder="25"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px' }}>
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="btn btn-outline btn-sm"
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-primary btn-sm"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Lead Confirmation Modal */}
      {deleteConfirmLead && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmLead(null)
          }}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440 }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#DC2626' }}>Delete Mortgage Lead</h3>
              <button
                type="button"
                onClick={() => setDeleteConfirmLead(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>
                Are you sure you want to permanently delete the mortgage lead for{' '}
                <strong>{deleteConfirmLead.full_name}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                This will remove the lead record, financing calculations, and all attached notes. This action cannot be undone.
              </p>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmLead(null)}
                className="btn btn-outline btn-sm"
                disabled={singleDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSingle}
                disabled={singleDeleting}
                className="btn btn-danger btn-sm"
              >
                {singleDeleting ? 'Deleting...' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
