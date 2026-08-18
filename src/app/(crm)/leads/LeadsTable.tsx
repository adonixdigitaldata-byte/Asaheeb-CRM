'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Phone,
  Mail,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react'
import type { Lead, LeadStage } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/utils'
import ConfirmModal from '@/components/ConfirmModal'
import Pagination from '@/components/Pagination'

interface Props {
  leads: Lead[]
  stages: LeadStage[]
  agents: { id: string; name: string }[]
  isAdmin: boolean
  onRefresh: () => void
}

const PAGE_SIZE = 15

export default function LeadsTable({
  leads,
  stages,
  agents,
  isAdmin,
  onRefresh,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAgentId, setBulkAgentId] = useState<string>('')
  const [loadingAction, setLoadingAction] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<{ id: string; name: string } | null>(null)

  // Sliced leads for pagination
  const totalPages = Math.ceil(leads.length / PAGE_SIZE) || 1
  const effectivePage = Math.min(currentPage, totalPages)
  const displayedLeads = leads.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)

  const allSelected = displayedLeads.length > 0 && displayedLeads.every((l) => selectedIds.includes(l.id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !displayedLeads.some((l) => l.id === id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...displayedLeads.map((l) => l.id)])))
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  async function handleBulkAssign() {
    if (!bulkAgentId || selectedIds.length === 0) return
    setLoadingAction(true)

    const res = await fetch('/api/leads/bulk-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadIds: selectedIds,
        agentId: bulkAgentId,
      }),
    })

    if (res.ok) {
      setSelectedIds([])
      onRefresh()
    }
    setLoadingAction(false)
  }

  async function executeBulkDelete() {
    if (selectedIds.length === 0) return
    setLoadingAction(true)

    const res = await fetch('/api/leads/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: selectedIds }),
    })

    if (res.ok) {
      setSelectedIds([])
      setShowBulkDeleteModal(false)
      onRefresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to delete selected leads')
    }
    setLoadingAction(false)
  }

  async function executeSingleDelete() {
    if (!leadToDelete) return
    const deletedId = leadToDelete.id
    setLoadingAction(true)

    const res = await fetch('/api/leads/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: deletedId }),
    })

    if (res.ok) {
      setSelectedIds((prev) => prev.filter((id) => id !== deletedId))
      setLeadToDelete(null)
      onRefresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to delete lead')
    }
    setLoadingAction(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Bulk Actions Bar */}
      {isAdmin && selectedIds.length > 0 && (
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A' }}>
            {selectedIds.length} lead{selectedIds.length > 1 ? 's' : ''} selected
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={bulkAgentId}
              onChange={(e) => setBulkAgentId(e.target.value)}
              className="form-select"
              style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5 }}
            >
              <option value="">Select Agent to Assign</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleBulkAssign}
              disabled={!bulkAgentId || loadingAction}
              className="btn btn-primary btn-sm"
            >
              Assign Selected
            </button>

            <button
              onClick={() => setShowBulkDeleteModal(true)}
              disabled={loadingAction}
              className="btn btn-danger btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              title="Delete all selected leads"
            >
              <Trash2 size={13} />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="table-container">
        <table className="crm-table">
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width: 36, textAlign: 'center' }}>
                  <button
                    onClick={toggleSelectAll}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}
                  >
                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
              )}
              <th>Lead Name</th>
              <th>City</th>
              <th>Contact Info</th>
              <th>Stage</th>
              <th>Source</th>
              <th>Property</th>
              <th>Value</th>
              <th>Assigned Agent</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {displayedLeads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id)
              return (
                <tr key={lead.id} style={{ backgroundColor: isSelected ? '#EFF6FF' : undefined }}>
                  {isAdmin && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => toggleSelectOne(lead.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? '#1D4ED8' : '#94A3B8', display: 'flex', alignItems: 'center' }}
                      >
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </td>
                  )}

                  <td>
                    <Link
                      href={`/leads/${lead.id}`}
                      style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', textDecoration: 'none', display: 'block' }}
                      className="hover:text-blue-700 hover:underline"
                    >
                      {lead.name || 'Unnamed Lead'}
                    </Link>
                  </td>

                  <td>
                    {lead.city ? (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                        {lead.city}
                      </span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 12.5 }}>—</span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
                      {lead.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0F172A', fontWeight: 500 }}>
                          <Phone size={12} style={{ color: '#64748B' }} />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748B' }}>
                          <Mail size={12} style={{ color: '#94A3B8' }} />
                          <span>{lead.email}</span>
                        </div>
                      )}
                      {!lead.phone && !lead.email && <span style={{ color: '#94A3B8' }}>—</span>}
                    </div>
                  </td>

                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${lead.stage?.color_hex || '#3B82F6'}15`,
                        color: lead.stage?.color_hex || '#3B82F6',
                        border: `1px solid ${lead.stage?.color_hex || '#3B82F6'}30`,
                      }}
                    >
                      {lead.stage?.label || '—'}
                    </span>
                  </td>

                  <td>
                    <span className="badge badge-source">
                      {lead.source}
                    </span>
                  </td>

                  <td>
                    {lead.property ? (
                      <span style={{ fontSize: 12.5, color: '#D97706', fontWeight: 600 }}>
                        {lead.property.name_en}
                      </span>
                    ) : lead.interest ? (
                      <span style={{ fontSize: 12.5, color: '#D97706', fontWeight: 500 }}>
                        {lead.interest}
                      </span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 12.5 }}>—</span>
                    )}
                  </td>

                  <td>
                    <span style={{ fontWeight: 700, color: lead.potential_value ? '#10B981' : '#94A3B8', fontSize: 13 }}>
                      {formatCurrency(lead.potential_value)}
                    </span>
                  </td>

                  <td>
                    {lead.assigned_agent ? (
                      <span style={{ fontSize: 12.5, color: '#1D4ED8', fontWeight: 600 }}>
                        {lead.assigned_agent.name}
                      </span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 12.5 }}>Unassigned</span>
                    )}
                  </td>

                  <td style={{ fontSize: 12, color: '#64748B' }}>
                    {formatDate(lead.created_at)}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="btn btn-ghost btn-sm"
                        title="View Details"
                        style={{ color: '#0F172A' }}
                      >
                        <ChevronRight size={16} />
                      </Link>

                      {isAdmin && (
                        <button
                          onClick={() => setLeadToDelete({ id: lead.id, name: lead.name || 'Unnamed Lead' })}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#EF4444' }}
                          title="Delete Lead"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {leads.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 11 : 10}
                  style={{ textAlign: 'center', padding: '36px 0', color: '#94A3B8', fontSize: 13 }}
                >
                  No leads found matching current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 15-Item Pagination with Smooth Auto-Scroll to Top */}
        <Pagination
          currentPage={effectivePage}
          totalItems={leads.length}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => setCurrentPage(p)}
          itemLabel="leads"
        />
      </div>

      {/* On-page Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteModal}
        title={`Delete ${selectedIds.length} Selected Lead${selectedIds.length > 1 ? 's' : ''}`}
        message={
          <>
            Are you sure you want to permanently delete <strong>{selectedIds.length}</strong> selected lead{selectedIds.length > 1 ? 's' : ''}? This will also delete all associated follow-ups, notes, and activity history. This action cannot be undone.
          </>
        }
        confirmLabel={`Delete ${selectedIds.length} Lead${selectedIds.length > 1 ? 's' : ''}`}
        variant="danger"
        loading={loadingAction}
        onConfirm={executeBulkDelete}
        onCancel={() => setShowBulkDeleteModal(false)}
      />

      {/* On-page Single Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!leadToDelete}
        title="Delete Lead"
        message={
          <>
            Are you sure you want to permanently delete <strong>"{leadToDelete?.name}"</strong>? All associated notes, activities, and follow-ups will be removed. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Lead"
        variant="danger"
        loading={loadingAction}
        onConfirm={executeSingleDelete}
        onCancel={() => setLeadToDelete(null)}
      />
    </div>
  )
}
