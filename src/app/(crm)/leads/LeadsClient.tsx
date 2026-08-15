'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutList,
  Columns3,
  Plus,
  Search,
  RefreshCw,
  X,
} from 'lucide-react'
import LeadsTable from './LeadsTable'
import KanbanBoard from './KanbanBoard'
import AddLeadModal from './AddLeadModal'
import LogoLoader from '@/components/LogoLoader'
import type { Lead, LeadStage, Profile, AdCampaign, Project } from '@/types/database'

interface Props {
  profile: Profile
  stages: LeadStage[]
  campaigns: AdCampaign[]
  agents: { id: string; name: string }[]
  projects: Project[]
  initialSearchParams: { [key: string]: string | undefined }
}

export default function LeadsClient({
  profile,
  stages,
  campaigns,
  agents,
  projects,
  initialSearchParams,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [view, setView] = useState<'table' | 'kanban'>('kanban')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(
    initialSearchParams?.action === 'new' || initialSearchParams?.new === 'true'
  )

  useEffect(() => {
    if (initialSearchParams?.action === 'new' || initialSearchParams?.new === 'true') {
      setShowAddModal(true)
    }
  }, [initialSearchParams])

  // Filters
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('ALL')
  const [agentFilter, setAgentFilter] = useState<string>('ALL')
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')

  const isAdmin = profile?.role === 'ADMIN'

  // Fetch leads from Supabase
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('leads')
      .select(`
        *,
        stage:lead_stages(*),
        assigned_agent:profiles(id, name, email),
        campaign:ad_campaigns(id, name),
        property:projects(id, name_en, name_ar)
      `)
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      query = query.eq('assigned_agent_id', profile.id)
    }

    const { data, error } = await query

    if (!error && data) {
      setLeads(data as Lead[])
    }
    setLoading(false)
  }, [supabase, isAdmin, profile?.id])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchesName = lead.name?.toLowerCase().includes(q)
      const matchesPhone = lead.phone?.toLowerCase().includes(q)
      const matchesEmail = lead.email?.toLowerCase().includes(q)
      const matchesCity = lead.city?.toLowerCase().includes(q)
      if (!matchesName && !matchesPhone && !matchesEmail && !matchesCity) return false
    }

    if (stageFilter !== 'ALL' && lead.stage_id !== stageFilter) return false

    if (agentFilter !== 'ALL') {
      if (agentFilter === 'UNASSIGNED') {
        if (lead.assigned_agent_id) return false
      } else {
        if (lead.assigned_agent_id !== agentFilter) return false
      }
    }

    if (sourceFilter !== 'ALL' && lead.source !== sourceFilter) return false

    return true
  })

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Leads</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} in pipeline
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: '#F1F5F9',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '2px',
          }}>
            <button
              onClick={() => setView('kanban')}
              className={`btn btn-sm ${view === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px' }}
            >
              <Columns3 size={14} />
              <span>Board</span>
            </button>
            <button
              onClick={() => setView('table')}
              className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px' }}
            >
              <LayoutList size={14} />
              <span>List</span>
            </button>
          </div>

          <button
            onClick={() => fetchLeads()}
            className="btn btn-outline btn-sm"
            title="Refresh Leads"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} />
            <span>Add lead</span>
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filter Bar */}
        <div className="card mb-6" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads by name, phone, city..."
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: 13 }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="form-select"
            style={{ width: 'auto', fontSize: 12.5 }}
          >
            <option value="ALL">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Agent Filter (Admin only) */}
          {isAdmin && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="form-select"
              style={{ width: 'auto', fontSize: 12.5 }}
            >
              <option value="ALL">All agents</option>
              <option value="UNASSIGNED">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="form-select"
            style={{ width: 'auto', fontSize: 12.5 }}
          >
            <option value="ALL">All sources</option>
            <option value="MANUAL">Manual</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="META_ADS">Meta Ads</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SNAPCHAT">Snapchat</option>
            <option value="WEBSITE_FORM">Website Form</option>
            <option value="PROPERTY_INQUIRY">Property Inquiry</option>
          </select>
        </div>

        {/* Board or Table or Loading */}
        {loading && leads.length === 0 ? (
          <LogoLoader size={44} text="Loading leads pipeline..." />
        ) : view === 'kanban' ? (
          <KanbanBoard
            leads={filteredLeads}
            stages={stages}
            profile={profile}
            onLeadMoved={fetchLeads}
          />
        ) : (
          <LeadsTable
            leads={filteredLeads}
            stages={stages}
            agents={agents}
            isAdmin={isAdmin}
            onRefresh={fetchLeads}
          />
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          stages={stages}
          agents={agents}
          projects={projects}
          campaigns={campaigns}
          currentUserId={profile.id}
          userRole={profile.role}
          onClose={() => {
            setShowAddModal(false)
            if (initialSearchParams?.action || initialSearchParams?.new) {
              router.replace('/leads')
            }
          }}
          onSuccess={() => {
            setShowAddModal(false)
            if (initialSearchParams?.action || initialSearchParams?.new) {
              router.replace('/leads')
            }
            fetchLeads()
          }}
        />
      )}
    </div>
  )
}
