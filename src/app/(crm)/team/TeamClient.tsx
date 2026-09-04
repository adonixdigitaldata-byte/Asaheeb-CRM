'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Profile, UserRole, WorkStatus } from '@/types/database'
import { formatTimeAgo } from '@/lib/utils'
import {
  UserPlus, Search, Shield, User, Briefcase, Phone, Mail,
  CheckCircle2, AlertCircle, Edit3, Trash2, ChevronRight, Activity,
  RotateCcw, Link as LinkIcon, Sparkles, ChevronLeft, CalendarClock
} from 'lucide-react'
import DocumentExpiryTrackerModal from '@/components/team/DocumentExpiryTrackerModal'

interface EnrichedMember extends Profile {
  last_sign_in_at?: string | null
  is_confirmed?: boolean
  wonLeads?: number
  conversionRate?: number
  completedFollowups?: number
  salaryProfile?: { base_salary: number; currency: string } | null
}


interface Props {
  members: EnrichedMember[]
  currentProfile: Profile
}

const SPECIALIZATIONS = [
  { key: 'Luxury Properties', label: 'Luxury Properties & Villas' },
  { key: 'Off-Plan Sales', label: 'Off-Plan & New Launches' },
  { key: 'Commercial', label: 'Commercial & Retail Real Estate' },
  { key: 'Residential', label: 'Residential Sales & Leasing' },
  { key: 'Real Estate Investment', label: 'Real Estate Investment & Advisory' },
  { key: 'Marketing & Media', label: 'Marketing, Media & Ads' },
  { key: 'Operations', label: 'Operations & Management' },
  { key: 'General', label: 'General / Sales' },
  { key: 'CUSTOM', label: 'Custom / Other...' },
]

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)', // Royal Navy - Blue
  'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', // Indigo - Purple
  'linear-gradient(135deg, #059669 0%, #10B981 100%)', // Emerald - Green
  'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', // Amber - Orange
  'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)', // Sky - Cyan
  'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', // Purple - Violet
  'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', // Orange
  'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)', // Teal
]

function getAvatarBackground(name: string, role?: string): string {
  if (role === 'ADMIN') return 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[index]
}

const PAGE_SIZE = 15

export default function TeamClient({ members: initialMembers, currentProfile }: Props) {
  const [members, setMembers] = useState<EnrichedMember[]>(initialMembers)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showExpiryTracker, setShowExpiryTracker] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('AGENT')
  const [inviteSpecialization, setInviteSpecialization] = useState('Luxury Properties')
  const [inviteCustomSpec, setInviteCustomSpec] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  // Edit Modal
  const [editingMember, setEditingMember] = useState<EnrichedMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('AGENT')
  const [editSpecialization, setEditSpecialization] = useState('')
  const [editWorkStatus, setEditWorkStatus] = useState<WorkStatus>('AVAILABLE')
  const [editPhone, setEditPhone] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editLoading, setEditLoading] = useState(false)

  // Delete Modal
  const [deletingMember, setDeletingMember] = useState<EnrichedMember | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Actions loading state
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)

  // Feedback Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' } | null>(null)

  function showToast(message: string, type: 'success' | 'danger' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const isAdmin = currentProfile.role === 'ADMIN'

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false
      if (statusFilter !== 'ALL' && (m.work_status || 'AVAILABLE') !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = m.name?.toLowerCase().includes(q)
        const matchEmail = m.email?.toLowerCase().includes(q)
        const matchSpec = m.specialization?.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchSpec) return false
      }
      return true
    })
  }, [members, roleFilter, statusFilter, search])

  // Pagination
  const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE) || 1
  const safeCurrentPage = Math.min(currentPage, totalPages) || 1
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + PAGE_SIZE)


  // Handlers
  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim()) return
    setInviteLoading(true)

    const finalSpec = inviteSpecialization === 'CUSTOM' ? inviteCustomSpec : inviteSpecialization

    try {
      const res = await fetch('/api/agents/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          phone: invitePhone.trim() || undefined,
          role: inviteRole,
          specialization: finalSpec,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to add member')

      showToast(`Invitation email sent to ${inviteEmail}!`, 'success')
      setShowInviteModal(false)
      setInviteName('')
      setInviteEmail('')
      setInvitePhone('')
      setInviteCustomSpec('')

      if (result.userId) {
        const newMember: EnrichedMember = {
          id: result.userId,
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          phone: invitePhone.trim() || null,
          role: inviteRole,
          specialization: finalSpec,
          work_status: 'AVAILABLE',
          is_active: true,
          avatar_url: null,
          total_leads_assigned: 0,
          open_leads_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          last_sign_in_at: null,
          is_confirmed: false,
          wonLeads: 0,
          conversionRate: 0,
          completedFollowups: 0,
        }
        setMembers([newMember, ...members])
      } else {
        window.location.reload()
      }
    } catch (err: any) {
      showToast(err.message, 'danger')
    } finally {
      setInviteLoading(false)
    }
  }

  function openEditModal(m: EnrichedMember) {
    setEditingMember(m)
    setEditName(m.name)
    setEditRole(m.role)
    setEditSpecialization(m.specialization || '')
    setEditWorkStatus(m.work_status || 'AVAILABLE')
    setEditPhone(m.phone || '')
    setEditIsActive(m.is_active !== false)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMember) return
    setEditLoading(true)

    try {
      const res = await fetch('/api/agents/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingMember.id,
          name: editName.trim(),
          role: editRole,
          specialization: editSpecialization.trim(),
          work_status: editWorkStatus,
          phone: editPhone.trim(),
          is_active: editIsActive,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update member')

      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                name: editName.trim(),
                role: editRole,
                specialization: editSpecialization.trim(),
                work_status: editWorkStatus,
                phone: editPhone.trim(),
                is_active: editIsActive,
              }
            : m
        )
      )
      showToast('Staff profile updated successfully!', 'success')
      setEditingMember(null)
    } catch (err: any) {
      showToast(err.message, 'danger')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleSendResetLink(member: EnrichedMember) {
    setActionInProgressId(member.id)
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
      if (!res.ok) throw new Error(data.error || 'Failed to send reset link')
      showToast(`Password setup & reset link sent to ${member.email}!`, 'success')
    } catch (err: any) {
      showToast(err.message, 'danger')
    } finally {
      setActionInProgressId(null)
    }
  }

  async function handleToggleActive(member: EnrichedMember) {
    const newActive = member.is_active === false ? true : false
    setActionInProgressId(member.id)
    try {
      const res = await fetch('/api/agents/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.id,
          is_active: newActive,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update account status')
      }
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_active: newActive } : m)))
      showToast(`Account ${newActive ? 'activated' : 'deactivated'} successfully!`, 'success')
    } catch (err: any) {
      showToast(err.message, 'danger')
    } finally {
      setActionInProgressId(null)
    }
  }

  async function confirmDelete() {
    if (!deletingMember) return
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/agents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deletingMember.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete member')
      setMembers((prev) => prev.filter((m) => m.id !== deletingMember.id))
      showToast(`Team member "${deletingMember.name}" deleted successfully`, 'success')
      setDeletingMember(null)
    } catch (err: any) {
      showToast(err.message, 'danger')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            background: toast.type === 'danger' ? '#DC2626' : '#16A34A',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {toast.type === 'danger' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Team &amp; Technical Staff</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Manage team members, roles (Admins, Sales Managers, Sales Agents, Technical Staff), and specializations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowExpiryTracker(true)}
            className="btn btn-outline"
            style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff' }}
            title="View company-wide document expiration deadlines"
          >
            <CalendarClock size={15} style={{ color: '#D97706' }} /> Expiry Tracker
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn btn-primary"
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <UserPlus size={15} /> Invite Team Member
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Search & Filter Toolbar */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search team members by name, email, or specialization..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 36, height: 38 }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="select"
              style={{ height: 38, minWidth: 140 }}
            >
              <option value="ALL">All Roles ({members.length})</option>
              <option value="ADMIN">Admins</option>
              <option value="SALES_MANAGER">Sales Managers</option>
              <option value="AGENT">Sales Agents</option>
              <option value="EMPLOYEE">Technical Staff</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select"
              style={{ height: 38, minWidth: 150 }}
            >
              <option value="ALL">All Work Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="BUSY">Busy</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
        </div>

        {/* Team Directory Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table" style={{ width: '100%', minWidth: '850px', tableLayout: 'fixed', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ width: '25%', padding: '8px 10px', fontSize: '11px' }}>Team Member</th>
                  <th style={{ width: '11%', padding: '8px 10px', fontSize: '11px' }}>Role</th>
                  <th style={{ width: '15%', padding: '8px 10px', fontSize: '11px' }}>Specialization</th>
                  <th style={{ width: '13%', padding: '8px 10px', fontSize: '11px' }}>Account Status</th>
                  <th style={{ width: '11%', padding: '8px 10px', fontSize: '11px' }}>Last Active</th>
                  <th style={{ width: '25%', padding: '8px 10px', fontSize: '11px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
                      No team members found matching your search.
                    </td>
                  </tr>
                ) : (
                  paginatedMembers.map((member) => {
                    const roleBadgeClass =
                      member.role === 'ADMIN' ? 'badge-admin' :
                      member.role === 'SALES_MANAGER' ? 'badge-admin' : 'badge-agent'

                    const roleDisplay =
                      member.role === 'ADMIN' ? 'Admin' :
                      member.role === 'SALES_MANAGER' ? 'Sales Manager' :
                      member.role === 'AGENT' ? 'Sales Agent' : 'Technical'

                    const statusClass =
                      member.work_status === 'BUSY' ? 'badge-warning' :
                      member.work_status === 'ON_LEAVE' ? 'badge-secondary' : 'badge-active'

                    const lastActiveDisplay = !member.last_sign_in_at
                      ? 'Never logged in'
                      : member.last_seen_at
                      ? formatTimeAgo(member.last_seen_at)
                      : 'Recently'

                    const isActing = actionInProgressId === member.id
                    const avatarBg = getAvatarBackground(member.name, member.role)
                    const isProtectedAdmin = member.email === 'probabilix.ai@gmail.com' || member.role === 'ADMIN' || member.id === currentProfile.id

                    return (
                      <tr key={member.id} style={{ opacity: member.is_active === false ? 0.65 : 1 }}>
                        {/* Member Column */}
                        <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: avatarBg,
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 12,
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                {member.name ? member.name.substring(0, 2).toUpperCase() : 'AS'}
                              </div>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <Link
                                href={`/team/${member.id}`}
                                style={{
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {member.name}
                              </Link>
                              <div 
                                style={{ 
                                  fontSize: '11px', 
                                  color: 'var(--text-secondary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={member.email}
                              >
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td style={{ padding: '8px 10px' }}>
                          <span className={`badge ${roleBadgeClass}`} style={{ fontSize: '11px' }}>
                            {roleDisplay}
                          </span>
                        </td>

                        {/* Specialization Column */}
                        <td style={{ padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span 
                            style={{ fontSize: '12.5px', fontWeight: 500, color: member.specialization ? '#1E3A8A' : 'var(--text-secondary)' }}
                            title={member.specialization || 'General Real Estate'}
                          >
                            {member.specialization || 'General Real Estate'}
                          </span>
                        </td>

                        {/* Account Status Column */}
                        <td style={{ padding: '8px 10px' }}>
                          {member.is_active === false ? (
                            <span className="badge badge-danger" style={{ fontSize: '11px' }}>
                              Inactive
                            </span>
                          ) : !member.last_sign_in_at ? (
                            <span className="badge badge-warning" style={{ fontSize: '11px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                              Pending Invite
                            </span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: '11px' }}>
                              Active
                            </span>
                          )}
                        </td>

                        {/* Last Active Column */}
                        <td style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lastActiveDisplay}>
                          {lastActiveDisplay}
                        </td>

                        {/* Actions Column */}
                        <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {isAdmin && (
                              <button
                                onClick={() => handleSendResetLink(member)}
                                disabled={isActing}
                                className="btn btn-outline btn-xs"
                                style={{ fontSize: '11px', padding: '2px 6px', fontWeight: 600 }}
                                title="Send invitation / password reset link via Resend"
                              >
                                Reset Link
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => openEditModal(member)}
                                disabled={isActing}
                                className="btn btn-outline btn-xs"
                                style={{ fontSize: '11px', padding: '2px 6px', fontWeight: 600 }}
                                title="Edit Profile"
                              >
                                Edit
                              </button>
                            )}

                            {isAdmin && !isProtectedAdmin && (
                              <button
                                onClick={() => handleToggleActive(member)}
                                disabled={isActing}
                                className="btn btn-outline btn-xs"
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  color: member.is_active !== false ? '#DC2626' : '#16A34A',
                                  borderColor: member.is_active !== false ? '#FCA5A5' : '#86EFAC',
                                  background: member.is_active !== false ? '#FEF2F2' : '#F0FDF4',
                                  fontWeight: 600
                                }}
                              >
                                {member.is_active !== false ? 'Deactivate' : 'Activate'}
                              </button>
                            )}

                            {isAdmin && !isProtectedAdmin && (
                              <button
                                onClick={() => setDeletingMember(member)}
                                disabled={isActing}
                                className="btn btn-outline btn-xs"
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  color: '#DC2626',
                                  borderColor: '#FCA5A5',
                                  background: '#FEF2F2',
                                  fontWeight: 600
                                }}
                              >
                                Delete
                              </button>
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

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}>
              <div>
                Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(startIndex + PAGE_SIZE, filteredMembers.length)}</strong> of <strong>{filteredMembers.length}</strong> members
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <ChevronLeft size={13} /> Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  disabled={safeCurrentPage >= totalPages}
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

      {/* MODAL: INVITE TEAM MEMBER */}
      {showInviteModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInviteModal(false)
          }}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500 }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Invite New Team Member</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteMember}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  An official Asaheeb CRM invitation email with password set-up link will be delivered via Resend.
                </p>

                <div className="form-group">
                  <label className="form-label">
                    Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmed Al-Otaibi"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email Address <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ahmed@asaheeb.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+966 50 123 4567"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="select"
                    style={{ width: '100%', height: 38 }}
                  >
                    <option value="AGENT">Sales Agent</option>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="EMPLOYEE">Technical / Operations</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Specialization / Focus Area</label>
                  <select
                    value={inviteSpecialization}
                    onChange={(e) => setInviteSpecialization(e.target.value)}
                    className="select"
                    style={{ width: '100%', height: 38 }}
                  >
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {inviteSpecialization === 'CUSTOM' && (
                  <div className="form-group">
                    <label className="form-label">Custom Specialization Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Legal & Contracts Advisory"
                      value={inviteCustomSpec}
                      onChange={(e) => setInviteCustomSpec(e.target.value)}
                      className="form-input"
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="btn btn-primary"
                  style={{ fontWeight: 600 }}
                >
                  {inviteLoading ? 'Sending Invite...' : 'Send Invitation Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TEAM MEMBER */}
      {editingMember && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingMember(null)
          }}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500 }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Edit Staff Profile</h3>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="select"
                    style={{ width: '100%', height: 38 }}
                  >
                    <option value="AGENT">Sales Agent</option>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="EMPLOYEE">Technical / Operations</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input
                    type="text"
                    value={editSpecialization}
                    onChange={(e) => setEditSpecialization(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Luxury Properties & Villas"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Work Status</label>
                  <select
                    value={editWorkStatus}
                    onChange={(e) => setEditWorkStatus(e.target.value as WorkStatus)}
                    className="select"
                    style={{ width: '100%', height: 38 }}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="BUSY">Busy</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                    />
                    Active Account (Can log in and receive assigned leads)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="btn btn-primary"
                  style={{ fontWeight: 600 }}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingMember && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeletingMember(null)
          }}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440 }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} /> Delete Staff Member
              </h3>
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>{deletingMember.name}</strong> ({deletingMember.email})?
              All associated leads will be unassigned and user authentication credentials will be deleted.
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={confirmDelete}
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', fontWeight: 600 }}
              >
                {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Document Expiry Tracker Modal */}
      <DocumentExpiryTrackerModal
        isOpen={showExpiryTracker}
        onClose={() => setShowExpiryTracker(false)}
      />
    </div>
  )
}
