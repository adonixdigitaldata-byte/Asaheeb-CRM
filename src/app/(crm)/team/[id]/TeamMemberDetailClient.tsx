'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Profile, Lead, LeadStage, LeadFollowup, LeadActivity, EmployeeSalaryProfile, Payslip, CompanyAsset, EmployeeDocument, EmployeeCustomRecord } from '@/types/database'
import { formatCurrencyAmount, getMonthName } from '@/lib/payroll-utils'
import { formatTimeAgo } from '@/lib/utils'
import {
  ArrowLeft, Users, Phone, Mail, Calendar,
  FileText, Clock, CheckCircle2, ChevronRight, ChevronLeft,
  Eye, Printer, Shield, Activity, AlertCircle, History, GitCommit,
  Laptop, Smartphone, CreditCard, Package, FolderArchive
} from 'lucide-react'
import EmployeeDocumentsTab from '@/components/team/EmployeeDocumentsTab'

interface Props {
  member: Profile
  currentProfile: Profile
  leads: any[]
  stages: LeadStage[]
  followups: any[]
  activities: any[]
  salaryProfile: EmployeeSalaryProfile | null
  salaryHistory: any[]
  payslips: Payslip[]
  assignedAssets?: CompanyAsset[]
  initialDocuments?: EmployeeDocument[]
  initialCustomRecords?: EmployeeCustomRecord[]
}


const PAGE_SIZE = 10

function renderActivityDescription(act: any) {
  const meta = act.metadata || {}
  const leadName = act.lead?.name || 'Lead'
  const leadId = act.lead_id || meta?.lead_id

  const leadLink = leadId ? (
    <Link
      href={`/leads/${leadId}`}
      style={{ color: '#1E3A8A', fontWeight: 600, textDecoration: 'underline' }}
    >
      {leadName}
    </Link>
  ) : (
    <strong>{leadName}</strong>
  )

  switch (act.activity_type) {
    case 'LEAD_CREATED':
      return <span>Created lead — {leadLink}</span>
    case 'STAGE_CHANGE':
      return (
        <span>
          Stage: <strong>{meta?.from_stage || 'Previous'}</strong> → <strong>{meta?.to_stage || 'New'}</strong> — {leadLink}
        </span>
      )
    case 'ASSIGNED':
      return <span>Assigned lead — {leadLink}</span>
    case 'NOTE_ADDED':
      return (
        <span>
          Added note {meta?.note_preview ? `"${meta.note_preview}"` : ''} — {leadLink}
        </span>
      )
    case 'FOLLOWUP_SCHEDULED':
      return <span>Scheduled follow-up — {leadLink}</span>
    case 'FOLLOWUP_COMPLETED':
      return <span>Completed follow-up — {leadLink}</span>
    case 'QUOTE_SENT':
      return <span>Sent quotation {meta?.quote_number ? `#${meta.quote_number}` : ''} — {leadLink}</span>
    case 'INVOICE_SENT':
      return <span>Sent invoice {meta?.invoice_number ? `#${meta.invoice_number}` : ''} — {leadLink}</span>
    default:
      return <span>{act.activity_type?.replace(/_/g, ' ')} — {leadLink}</span>
  }
}

export default function TeamMemberDetailClient({
  member,
  currentProfile,
  leads,
  stages,
  followups,
  activities,
  salaryProfile,
  salaryHistory,
  payslips,
  assignedAssets = [],
  initialDocuments = [],
  initialCustomRecords = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<'leads' | 'followups' | 'activities' | 'assets' | 'documents'>('leads')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)

  // Pagination states for each tab
  const [leadsPage, setLeadsPage] = useState(1)
  const [followupsPage, setFollowupsPage] = useState(1)
  const [activitiesPage, setActivitiesPage] = useState(1)

  const isAdmin = currentProfile.role === 'ADMIN'

  async function handleResendInvite() {
    if (!member.email) return
    setSendingInvite(true)
    setInviteStatus(null)

    try {
      const res = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: member.email,
          name: member.name,
          role: member.role,
          specialization: member.specialization,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send invite email')

      setInviteStatus('Invitation / Reset email sent successfully!')
      setTimeout(() => setInviteStatus(null), 4000)
    } catch (err: any) {
      setInviteStatus(`Error: ${err.message}`)
      setTimeout(() => setInviteStatus(null), 5000)
    } finally {
      setSendingInvite(false)
    }
  }

  // Calculations
  const wonLeadsCount = useMemo(() => {
    return leads.filter((l) => l.stage?.key === 'won').length
  }, [leads])

  const conversionRate = leads.length > 0 ? Math.round((wonLeadsCount / leads.length) * 100) : 0
  const completedFollowupsCount = followups.filter((f) => f.is_completed).length

  const stageDistribution = useMemo(() => {
    return stages.map((stage) => {
      const count = leads.filter((l) => l.stage_id === stage.id || l.stage?.key === stage.key).length
      const percentage = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0
      return {
        ...stage,
        count,
        percentage,
      }
    })
  }, [leads, stages])

  // Paginated Slices
  const paginatedLeads = useMemo(() => {
    const start = (leadsPage - 1) * PAGE_SIZE
    return leads.slice(start, start + PAGE_SIZE)
  }, [leads, leadsPage])
  const totalLeadsPages = Math.ceil(leads.length / PAGE_SIZE) || 1

  const paginatedFollowups = useMemo(() => {
    const start = (followupsPage - 1) * PAGE_SIZE
    return followups.slice(start, start + PAGE_SIZE)
  }, [followups, followupsPage])
  const totalFollowupsPages = Math.ceil(followups.length / PAGE_SIZE) || 1

  const paginatedActivities = useMemo(() => {
    const start = (activitiesPage - 1) * PAGE_SIZE
    return activities.slice(start, start + PAGE_SIZE)
  }, [activities, activitiesPage])
  const totalActivitiesPages = Math.ceil(activities.length / PAGE_SIZE) || 1

// Pagination Footer Component
  function renderPaginationFooter(
    currentPage: number,
    totalPages: number,
    totalItems: number,
    setPage: (fn: (p: number) => number) => void
  ) {
    if (totalItems === 0) return null
    const start = (currentPage - 1) * PAGE_SIZE + 1
    const end = Math.min(currentPage * PAGE_SIZE, totalItems)

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderTop: '1px solid var(--border)',
        fontSize: 13,
        color: 'var(--text-secondary)',
        background: '#FAFBFD',
      }}>
        <div>
          Showing <strong>{start}</strong> to <strong>{end}</strong> of <strong>{totalItems}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <ChevronLeft size={13} /> Previous
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            Page {currentPage} of {totalPages}
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

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/team"
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <h1 className="text-page-title" style={{ margin: 0 }}>
              {member.name}
            </h1>
            <p className="text-meta" style={{ marginTop: 2 }}>
              {member.specialization || 'Real Estate Specialist'} · {member.email}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              onClick={handleResendInvite}
              disabled={sendingInvite}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Send an email invitation / password setup link via Resend"
            >
              <Mail size={13} />
              {sendingInvite ? 'Sending email...' : 'Send Setup Link / Invite'}
            </button>
          )}

          <span className={`badge ${member.role === 'ADMIN' ? 'badge-admin' : 'badge-agent'}`}>
            {member.role === 'SALES_MANAGER' ? 'SALES MANAGER' : member.role}
          </span>
          <span className={`badge ${member.work_status === 'BUSY' ? 'badge-warning' : 'badge-active'}`}>
            {member.work_status || 'AVAILABLE'}
          </span>
        </div>
      </div>

      {inviteStatus && (
        <div
          style={{
            margin: '12px 20px 0 20px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 500,
            background: inviteStatus.startsWith('Error') ? 'var(--danger-light)' : 'var(--success-light)',
            color: inviteStatus.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${inviteStatus.startsWith('Error') ? 'var(--danger)' : 'var(--success)'}`,
          }}
        >
          {inviteStatus}
        </div>
      )}

      <div className="page-body">
        {/* Staff Header Profile Card */}
        <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 22,
                  boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)',
                }}
              >
                {member.name ? member.name.substring(0, 2).toUpperCase() : 'AS'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {member.name}
                  </h1>
                  <span className={`badge ${member.role === 'ADMIN' ? 'badge-admin' : 'badge-agent'}`}>
                    {member.role === 'SALES_MANAGER' ? 'SALES MANAGER' : member.role}
                  </span>
                  <span className={`badge ${member.work_status === 'BUSY' ? 'badge-warning' : 'badge-active'}`}>
                    {member.work_status || 'AVAILABLE'}
                  </span>
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A', marginTop: 4 }}>
                  {member.specialization || 'Real Estate Specialist'}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={14} /> {member.email}
                  </div>
                  {member.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={14} /> {member.phone}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> Joined {new Date(member.created_at).toLocaleDateString()}
                  </div>
                  {(salaryProfile?.pan_or_iqama || member.iqama_no || salaryProfile?.iqama_expiry_date || member.iqama_expiry_date) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Shield size={14} style={{ color: '#0284C7' }} />
                      <span>Iqama / ID: <strong>{salaryProfile?.pan_or_iqama || member.iqama_no || 'Recorded'}</strong></span>
                      {(() => {
                        const exp = salaryProfile?.iqama_expiry_date || member.iqama_expiry_date
                        if (!exp) return null
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const expDate = new Date(exp)
                        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        if (diffDays < 0) {
                          return (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '1px 6px', borderRadius: 4, border: '1px solid #FECACA' }}>
                              🔴 Expired ({exp})
                            </span>
                          )
                        }
                        if (diffDays <= 30) {
                          return (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', backgroundColor: '#FFFBEB', padding: '1px 6px', borderRadius: 4, border: '1px solid #FDE68A' }}>
                              ⚠️ Expires in {diffDays}d ({exp})
                            </span>
                          )
                        }
                        return (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', backgroundColor: '#F0FDF4', padding: '1px 6px', borderRadius: 4, border: '1px solid #BBF7D0' }}>
                            ✓ Valid until {exp}
                          </span>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Leads Assigned
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {leads.length}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              In pipeline &amp; archive
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Won Deals
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
              {wonLeadsCount}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Successfully closed
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Conversion Rate
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1E3A8A', marginTop: 4 }}>
              {conversionRate}%
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Deal closing efficiency
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Follow-ups Completed
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {completedFollowupsCount}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Out of {followups.length} scheduled
            </div>
          </div>
        </div>

        {/* Lead Funnel Distribution Section */}
        <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#1E3A8A' }}>
              <Activity size={18} style={{ color: '#3B82F6' }} /> Lead funnel distribution
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {leads.length} assigned leads
            </span>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {stageDistribution.map((item) => {
              const barColor = item.color_hex || '#3B82F6';
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Stage Label */}
                  <div style={{ width: 140, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.label}
                  </div>

                  {/* Progress Bar Container */}
                  <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        width: `${item.percentage}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 4,
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    />
                  </div>

                  {/* Count & Percentage */}
                  <div style={{ width: 80, textAlign: 'right', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.count}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 500, minWidth: 36 }}>{item.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs: Leads, Follow-ups, Activities, Compensation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            marginBottom: 20,
            gap: 20,
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('leads')}
            style={{
              padding: '10px 4px',
              fontSize: 14,
              fontWeight: 700,
              color: activeTab === 'leads' ? '#1E3A8A' : 'var(--text-secondary)',
              borderBottom: activeTab === 'leads' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <Users size={16} /> Assigned leads ({leads.length})
          </button>

          <button
            onClick={() => setActiveTab('followups')}
            style={{
              padding: '10px 4px',
              fontSize: 14,
              fontWeight: 700,
              color: activeTab === 'followups' ? '#1E3A8A' : 'var(--text-secondary)',
              borderBottom: activeTab === 'followups' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <Clock size={16} /> Follow-ups ({followups.length})
          </button>

          <button
            onClick={() => setActiveTab('activities')}
            style={{
              padding: '10px 4px',
              fontSize: 14,
              fontWeight: 700,
              color: activeTab === 'activities' ? '#1E3A8A' : 'var(--text-secondary)',
              borderBottom: activeTab === 'activities' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <Activity size={16} /> Activity log ({activities.length})
          </button>

          <button
            onClick={() => setActiveTab('assets')}
            style={{
              padding: '10px 4px',
              fontSize: 14,
              fontWeight: 700,
              color: activeTab === 'assets' ? '#1E3A8A' : 'var(--text-secondary)',
              borderBottom: activeTab === 'assets' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <Laptop size={16} /> Possessed Assets ({assignedAssets.length})
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            style={{
              padding: '10px 4px',
              fontSize: 14,
              fontWeight: 700,
              color: activeTab === 'documents' ? '#1E3A8A' : 'var(--text-secondary)',
              borderBottom: activeTab === 'documents' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <FolderArchive size={16} /> Documents &amp; Records ({initialDocuments.length})
          </button>
        </div>


        {/* TAB 1: ASSIGNED LEADS */}
        {activeTab === 'leads' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client / Lead Name</th>
                    <th>Source</th>
                    <th>Stage</th>
                    <th>Contact</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                        No leads currently assigned to this member.
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{lead.name}</div>
                          {lead.potential_value && (
                            <div style={{ fontSize: 11.5, color: '#10B981', fontWeight: 600 }}>
                              SAR {lead.potential_value.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-source">{lead.source || 'MANUAL'}</span>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: `${lead.stage?.color_hex || '#64748B'}20`,
                              color: lead.stage?.color_hex || '#64748B',
                              fontWeight: 700,
                            }}
                          >
                            {lead.stage?.label || 'New'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {lead.phone || lead.email || '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {new Date(lead.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link href={`/leads/${lead.id}`} className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }}>
                            View Lead <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {renderPaginationFooter(leadsPage, totalLeadsPages, leads.length, setLeadsPage)}
          </div>
        )}

        {/* TAB 2: SCHEDULED FOLLOW-UPS */}
        {activeTab === 'followups' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lead Name</th>
                    <th>Scheduled At</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                        No scheduled follow-ups recorded yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedFollowups.map((fu) => (
                      <tr key={fu.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {fu.lead?.name || 'Lead'}
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {new Date(fu.scheduled_at).toLocaleString()}
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 280 }}>
                          {fu.note || '—'}
                        </td>
                        <td>
                          {fu.is_completed ? (
                            <span className="badge badge-success">Completed</span>
                          ) : (
                            <span className="badge badge-warning">Pending</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {fu.lead_id && (
                            <Link href={`/leads/${fu.lead_id}`} className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }}>
                              Open Lead <ChevronRight size={12} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {renderPaginationFooter(followupsPage, totalFollowupsPages, followups.length, setFollowupsPage)}
          </div>
        )}

        {/* TAB 3: ACTIVITY LOG (MATCHING SCREENSHOT 2 TIMELINE) */}
        {activeTab === 'activities' && (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
                No recorded activities for this member yet.
              </div>
            ) : (
              <div style={{ padding: '24px 24px 8px 24px' }}>
                <div style={{ position: 'relative' }}>
                  {/* Vertical Timeline Guide */}
                  <div style={{
                    position: 'absolute',
                    top: 14,
                    bottom: 14,
                    left: 17,
                    width: 2,
                    background: '#E2E8F0',
                    zIndex: 1,
                  }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {paginatedActivities.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 16,
                          position: 'relative',
                          zIndex: 2,
                        }}
                      >
                        {/* Timeline Node Icon */}
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#F1F5F9',
                          border: '2px solid #CBD5E1',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Activity size={15} />
                        </div>

                        {/* Timeline Body */}
                        <div style={{ flex: 1, paddingTop: 4 }}>
                          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                            {renderActivityDescription(act)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {formatTimeAgo(act.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {renderPaginationFooter(activitiesPage, totalActivitiesPages, activities.length, setActivitiesPage)}
          </div>
        )}

        {/* TAB 4: POSSESSED ASSETS */}
        {activeTab === 'assets' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Company Equipment in Possession
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Hardware, devices, SIM cards, and keys currently allocated to {member.name}.
                </p>
              </div>
              <Link href="/assets" className="btn btn-outline btn-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Laptop size={13} /> Manage in Assets Directory
              </Link>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset Tag & Item</th>
                    <th>Model / Specs</th>
                    <th>Serial / SIM Number</th>
                    <th>Condition</th>
                    <th>Assigned Date</th>
                    <th>Handover Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedAssets.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <Package size={32} style={{ color: 'var(--text-tertiary)' }} />
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>No Company Assets Assigned</div>
                          <div style={{ fontSize: '12px' }}>This employee currently holds no company laptops, mobile phones, or SIM cards.</div>
                          <Link href="/assets" className="btn btn-primary btn-xs" style={{ marginTop: '8px' }}>
                            Go to Company Assets
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    assignedAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{asset.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: 'var(--surface-sunken)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                              {asset.asset_tag}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>• {asset.category}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: 600 }}>{asset.model_number || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {asset.serial_number && (
                              <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                <strong>S/N:</strong> {asset.serial_number}
                              </span>
                            )}
                            {asset.sim_number && (
                              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#2563EB' }}>
                                <strong>SIM:</strong> {asset.sim_number} {asset.sim_carrier ? `(${asset.sim_carrier})` : ''}
                              </span>
                            )}
                            {!asset.serial_number && !asset.sim_number && '—'}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color:
                                asset.condition === 'NEW' || asset.condition === 'EXCELLENT'
                                  ? '#059669'
                                  : asset.condition === 'GOOD'
                                  ? '#2563EB'
                                  : asset.condition === 'FAIR'
                                  ? '#D97706'
                                  : '#DC2626',
                            }}
                          >
                            {asset.condition || 'GOOD'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {asset.assigned_at ? new Date(asset.assigned_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                          {asset.assignment_notes || asset.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: EMPLOYEE DOCUMENTS & CUSTOM RECORDS */}
        {activeTab === 'documents' && (
          <EmployeeDocumentsTab
            member={member}
            isAdmin={isAdmin}
            initialDocuments={initialDocuments}
            initialCustomRecords={initialCustomRecords}
          />
        )}
      </div>
    </div>
  )
}

