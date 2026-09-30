'use client'

import React, { useState } from 'react'
import {
  X,
  Phone,
  MessageCircle,
  Building2,
  Calendar,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Send,
  User,
  Landmark,
  Check,
  Copy,
  FileText,
  Pencil,
  Trash2,
} from 'lucide-react'
import { formatCurrency, formatDate, formatTimeAgo } from '@/lib/utils'
import type { MortgageLead, MortgageLeadNote, Profile } from '@/types/database'

interface Props {
  lead: MortgageLead | null
  profile: Profile
  onClose: () => void
  onUpdateStatus: (leadId: string, newStatus: string) => Promise<void>
  onAddNote: (leadId: string, noteText: string) => Promise<void>
  onEditNote: (leadId: string, noteId: string, newText: string) => Promise<void>
  onDeleteNote: (leadId: string, noteId: string) => Promise<void>
}

export const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; desc: string }
> = {
  new: {
    label: 'New Lead',
    bg: '#E0F2FE',
    text: '#0369A1',
    desc: 'Uncontacted calculation from website',
  },
  contacted: {
    label: 'Contacted',
    bg: '#FEF3C7',
    text: '#B45309',
    desc: 'Advisor initiated first dialogue',
  },
  closed: {
    label: 'Closed / Won',
    bg: '#CCFBF1',
    text: '#0F766E',
    desc: 'Mortgage issued and deal closed',
  },
  bank_submitted: {
    label: 'Bank Application Submitted',
    bg: '#EEF2FF',
    text: '#4338CA',
    desc: 'Dossier sent to partner bank officer',
  },
  pre_approved: {
    label: 'Pre-Approved',
    bg: '#DCFCE7',
    text: '#15803D',
    desc: 'Initial bank financial clearance secured',
  },
  disbursed: {
    label: 'Disbursed',
    bg: '#CCFBF1',
    text: '#0F766E',
    desc: 'Mortgage issued and funds disbursed',
  },
  lost: {
    label: 'Lost / Ineligible',
    bg: '#FFE4E6',
    text: '#BE123C',
    desc: 'High DTI, declined or non-responsive',
  },
}

export function parseNotes(rawNotes: string | null | undefined): MortgageLeadNote[] {
  if (!rawNotes) return []
  try {
    const parsed = JSON.parse(rawNotes)
    if (Array.isArray(parsed)) {
      return parsed.map((n, idx) => ({
        ...n,
        id: n.id || `note-${idx}`,
      }))
    }
  } catch {
    // If stored as plain string, wrap as single entry
  }
  return [
    {
      id: 'legacy-1',
      text: rawNotes,
      created_at: new Date().toISOString(),
      author_name: 'Advisor Note',
    },
  ]
}

export default function MortgageLeadDrawer({
  lead,
  profile,
  onClose,
  onUpdateStatus,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: Props) {
  const [newNote, setNewNote] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [copiedWA, setCopiedWA] = useState(false)

  // Edit note states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  if (!lead) return null

  const phone = lead.phone || lead.phone_number || ''
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  const bankName = lead.bank_name || lead.bank_name_en || lead.bank_slug || 'Selected Bank'
  const totalPayable = lead.total_payable ?? lead.total_payable_value ?? 0
  const hasRedf = lead.has_redf_support ?? lead.redf_supported

  // DTI (Debt-to-Income) calculation
  const income = lead.monthly_income ? Number(lead.monthly_income) : null
  const obligations = lead.monthly_obligations ? Number(lead.monthly_obligations) : null
  const dtiRatio = income && obligations && income > 0 ? (obligations / income) * 100 : null
  const netCapacity = income && obligations ? income - obligations : null

  // WhatsApp Preformatted message
  const waGreetingAr = `السلام عليكم ورحمة الله،
أهلاً بك أخي/أختي ${lead.full_name}،
معك مستشارك التمويلي من شركة أصهب العقارية بخصوص طلب التمويل العقاري لبنك (${bankName}):

• سعر العقار: ${formatCurrency(lead.property_price)}
• الدفعة الأولى: ${formatCurrency(lead.down_payment_amount)} (${lead.down_payment_pct}%)
• مدة التمويل: ${lead.loan_period_years} سنة
• القسط التقديري: ${formatCurrency(lead.monthly_instalment)} شهرياً

يسعدنا مساعدتك في بدء إجراءات التقديم ومتابعة طلبك مع البنك. متى يناسبك التواصل؟`

  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waGreetingAr)}`

  const notesList = parseNotes(lead.notes)

  const currentStatusConfig = STATUS_CONFIG[lead.status] || {
    label: lead.status || 'New',
    bg: '#F4F4F5',
    text: '#3F3F46',
    desc: '',
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === lead.status) return
    setStatusLoading(true)
    try {
      await onUpdateStatus(lead.id, newStatus)
    } finally {
      setStatusLoading(false)
    }
  }

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim() || submittingNote) return
    setSubmittingNote(true)
    try {
      await onAddNote(lead.id, newNote.trim())
      setNewNote('')
    } finally {
      setSubmittingNote(false)
    }
  }

  const handleSaveEdit = async (noteId: string) => {
    if (!editNoteText.trim()) return
    setActionLoadingId(noteId)
    try {
      await onEditNote(lead.id, noteId, editNoteText.trim())
      setEditingNoteId(null)
      setEditNoteText('')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      setActionLoadingId(noteId)
      try {
        await onDeleteNote(lead.id, noteId)
      } finally {
        setActionLoadingId(null)
      }
    }
  }

  const handleCopyWA = () => {
    navigator.clipboard.writeText(waGreetingAr)
    setCopiedWA(true)
    setTimeout(() => setCopiedWA(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fade-in 0.15s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: '#FAFBFD',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                backgroundColor: '#EFF6FF',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Landmark size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {lead.full_name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{phone || 'No phone'}</span>
                <span>•</span>
                <span>{formatDate(lead.created_at)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              borderRadius: 6,
            }}
            title="Close Drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
            <select
              disabled={statusLoading}
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 6,
                border: `1px solid ${currentStatusConfig.bg}`,
                backgroundColor: currentStatusConfig.bg,
                color: currentStatusConfig.text,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key} style={{ backgroundColor: '#FFFFFF', color: '#18181B' }}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {phone && (
              <>
                <a
                  href={`tel:${cleanPhone}`}
                  className="btn btn-outline btn-sm"
                  style={{ gap: 5 }}
                >
                  <Phone size={13} style={{ color: '#16A34A' }} />
                  <span>Call</span>
                </a>

                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ backgroundColor: '#16A34A', borderColor: '#16A34A', gap: 6 }}
                >
                  <MessageCircle size={14} />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyWA}
                  className="btn btn-outline btn-sm"
                  title="Copy WhatsApp greeting"
                  style={{ padding: '6px' }}
                >
                  {copiedWA ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Key Metric Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Property Price
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {formatCurrency(lead.property_price)}
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Down Payment
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {formatCurrency(lead.down_payment_amount)}{' '}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  ({lead.down_payment_pct}%)
                </span>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', borderLeft: '3px solid #16A34A', backgroundColor: '#F0FDF4' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>
                Monthly Instalment
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>
                {formatCurrency(lead.monthly_instalment)}
                <span style={{ fontSize: 11, fontWeight: 500, color: '#16A34A' }}>/mo</span>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Tenure & Rate
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {lead.loan_period_years} Yrs
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginLeft: 6 }}>
                  @{lead.applied_rate_pct}%
                </span>
              </div>
            </div>
          </div>

          {/* Bank Package Breakdown */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Bank Deal Breakdown</span>
              </div>
              <span className="badge" style={{ backgroundColor: '#EFF6FF', color: 'var(--accent)', fontWeight: 800, fontSize: 11 }}>
                {bankName}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 12.5 }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Principal Loan Amount:</span>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontSize: 14 }}>
                  {formatCurrency(lead.total_loan_amount ?? (lead.property_price - lead.down_payment_amount))}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Total Payable (Principal + Profit):</span>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontSize: 14 }}>
                  {formatCurrency(totalPayable)}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Calculated Profit %:</span>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {lead.bank_profit_percentage ? `${Number(lead.bank_profit_percentage).toFixed(1)}%` : '—'}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Ingestion Source:</span>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {lead.source || 'Website Mortgage Calculator'}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Profile & SAMA Affordability */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} style={{ color: '#16A34A' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Applicant Financial Profile</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge" style={{ backgroundColor: lead.is_citizen ? '#DCFCE7' : '#F3E8FF', color: lead.is_citizen ? '#15803D' : '#7E22CE', fontWeight: 700 }}>
                  {lead.is_citizen ? 'Saudi Citizen' : 'Expat Resident'}
                </span>
                {lead.is_first_home !== null && lead.is_first_home !== undefined && (
                  <span className="badge" style={{ backgroundColor: '#F4F4F5', color: '#52525B', fontWeight: 600 }}>
                    {lead.is_first_home ? 'First Home' : 'Secondary'}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12 }}>
              <div style={{ padding: '10px 12px', backgroundColor: '#FAFAFA', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monthly Salary:</span>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 3, fontSize: 13 }}>
                  {income ? formatCurrency(income) : 'Not Disclosed'}
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#FAFAFA', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Existing Debt:</span>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 3, fontSize: 13 }}>
                  {obligations !== null ? formatCurrency(obligations) : 'None / Not Disclosed'}
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#FAFAFA', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>REDF / Sakani:</span>
                <div style={{ fontWeight: 700, color: hasRedf ? '#16A34A' : '#71717A', marginTop: 3, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasRedf ? <CheckCircle2 size={13} /> : null}
                  <span>{hasRedf ? 'Eligible' : 'No Subsidy'}</span>
                </div>
              </div>
            </div>

            {/* DTI Analytical Callout */}
            {dtiRatio !== null ? (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  backgroundColor: dtiRatio <= 33.33 ? '#F0FDF4' : dtiRatio <= 45 ? '#FFFBEB' : '#FEF2F2',
                  border: `1px solid ${dtiRatio <= 33.33 ? '#BBF7D0' : dtiRatio <= 45 ? '#FDE68A' : '#FECACA'}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <AlertCircle
                  size={16}
                  style={{
                    color: dtiRatio <= 33.33 ? '#16A34A' : dtiRatio <= 45 ? '#D97706' : '#DC2626',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    Debt-To-Income (DTI): {dtiRatio.toFixed(1)}% —{' '}
                    <span style={{ color: dtiRatio <= 33.33 ? '#16A34A' : dtiRatio <= 45 ? '#D97706' : '#DC2626' }}>
                      {dtiRatio <= 33.33
                        ? 'Within Standard SAMA Limit (≤33.3%)'
                        : dtiRatio <= 45
                        ? 'Extended SAMA Bracket (≤45%)'
                        : 'Exceeds Standard SAMA Threshold (>45%)'}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Remaining Monthly Discretionary Income: <strong>{formatCurrency(netCapacity)}</strong>.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 12px', backgroundColor: '#FAFAFA', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                Salary and debt details were not fully entered by the applicant during calculation. Advisor should qualify on initial call.
              </div>
            )}
          </div>

          {/* Internal Notes Thread */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Internal Notes Log ({notesList.length})
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Staff update thread</span>
            </div>

            {/* Notes List with Edit & Delete */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
              {notesList.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '10px 0' }}>
                  No internal notes logged yet. Add the first update below.
                </div>
              ) : (
                notesList.map((n, idx) => (
                  <div
                    key={n.id || idx}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#FAFAFA',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 12.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={12} style={{ color: 'var(--accent)' }} />
                        {n.author_name || 'Staff Advisor'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{n.created_at ? formatTimeAgo(n.created_at) : 'Recently'}</span>
                        
                        {/* Edit Button */}
                        <button
                          type="button"
                          disabled={actionLoadingId === n.id}
                          onClick={() => {
                            setEditingNoteId(n.id)
                            setEditNoteText(n.text)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Edit note"
                        >
                          <Pencil size={12} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          disabled={actionLoadingId === n.id}
                          onClick={() => handleDelete(n.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#DC2626',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Delete note"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Inline Edit Mode */}
                    {editingNoteId === n.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        <textarea
                          rows={2}
                          value={editNoteText}
                          onChange={(e) => setEditNoteText(e.target.value)}
                          className="form-textarea"
                          style={{ fontSize: 12, resize: 'none', padding: '8px' }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null)
                              setEditNoteText('')
                            }}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === n.id || !editNoteText.trim()}
                            onClick={() => handleSaveEdit(n.id)}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '3px 10px', fontSize: 11 }}
                          >
                            {actionLoadingId === n.id ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-primary)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                        {n.text}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Note Input */}
            <form onSubmit={handleAddNoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
              <textarea
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log bank communication, documentation status, or follow-up note..."
                className="form-textarea"
                style={{ resize: 'none' }}
              />

              {/* Quick Templates */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Quick:
                </span>
                {[
                  'Called applicant, no answer',
                  'Sent calculation via WhatsApp',
                  'Requested salary cert & payslips',
                  'Forwarded to bank loan officer',
                  'Pre-approval granted',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setNewNote((prev) => (prev ? `${prev} • ${tpl}` : tpl))}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 6,
                      backgroundColor: '#F4F4F5',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    +{tpl}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
                  type="submit"
                  disabled={!newNote.trim() || submittingNote}
                  className="btn btn-primary btn-sm"
                  style={{ gap: 6 }}
                >
                  <Send size={13} />
                  <span>{submittingNote ? 'Saving...' : 'Add Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
