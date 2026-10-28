'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  FileDown,
  Image as ImageIcon,
  MapPin,
  ExternalLink,
  Sparkles,
  Layers,
  Database,
  Loader2,
  CheckCircle,
  Building2,
  Tag,
  FolderOpen,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Globe,
  TrendingUp,
  Award,
  BarChart3,
  Info,
  ShieldCheck,
  Flame,
  Clock,
  Calendar,
  Bot,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import { createClient } from '@/lib/supabase/client'
import type { Project, Profile, ProjectCommission } from '@/types/database'
import ProjectEditorModal from './ProjectEditorModal'
import ProjectCommissionsModal from './ProjectCommissionsModal'
import ConfirmModal from '@/components/ConfirmModal'
import LogoLoader from '@/components/LogoLoader'
import OrderSlotManagerModal from '@/components/OrderSlotManagerModal'
import Pagination from '@/components/Pagination'
import CmsActivityTimeline from '@/components/CmsActivityTimeline'

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://asaheebrealestate.com'
const PAGE_SIZE = 15

interface Props {
  profile: Profile
}

export default function ProjectsClient({ profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = true // Granted to all roles

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)

  // Filters & Sorting States
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [ownershipFilter, setOwnershipFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [offerFilter, setOfferFilter] = useState<'ALL' | 'ACTIVE_OFFER'>('ALL')
  const [aiFilter, setAiFilter] = useState<'ALL' | 'AI_ENABLED' | 'AI_DISABLED'>('ALL')
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'price_asc' | 'price_desc' | 'photos'>('default')

  // Modal States
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [commissioningProject, setCommissioningProject] = useState<Project | null>(null)
  const [activityProject, setActivityProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reorderModalOpen, setReorderModalOpen] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true })

    if (!error && data) {
      setProjects(data as Project[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Toggle publish status
  async function handleTogglePublish(project: Project) {
    const nextStatus = !project.is_published

    // Optimistic local update
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, is_published: nextStatus } : p))
    )

    await fetch('/api/projects/toggle-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, is_published: nextStatus }),
    })
  }

  // Move project up/down and persist sort_order to database
  async function handleMoveProject(project: Project, direction: 'up' | 'down') {
    const currentIndex = projects.findIndex((p) => p.id === project.id)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= projects.length) return

    const reordered = [...projects]
    const temp = reordered[currentIndex]
    reordered[currentIndex] = reordered[targetIndex]
    reordered[targetIndex] = temp

    // Re-assign sort_orders
    const itemsToSave = reordered.map((p, idx) => ({
      id: p.id,
      sort_order: idx + 1,
    }))

    // Optimistic local state update
    setProjects(reordered.map((p, idx) => ({ ...p, sort_order: idx + 1 })))

    // Save to database
    try {
      await fetch('/api/projects/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSave }),
      })
    } catch (err) {
      console.error('Failed to save project order:', err)
    }
  }

  // Delete project execution
  async function executeDeleteProject() {
    if (!projectToDelete) return
    setDeleting(true)

    const res = await fetch('/api/projects/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: projectToDelete.id }),
    })

    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id))
      setProjectToDelete(null)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to delete project')
    }
    setDeleting(false)
  }

  // Cities and Stages dynamic lists
  const cities = useMemo(() => Array.from(new Set(projects.map((p) => p.city_en).filter((c): c is string => Boolean(c)))), [projects])
  const stages = useMemo(() => Array.from(new Set(projects.map((p) => p.status_en).filter((s): s is string => Boolean(s)))), [projects])

  // Filter and sort logic
  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
      const projType = p.type_en || 'Apartments'

      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = p.name_en?.toLowerCase().includes(q) || p.name_ar?.toLowerCase().includes(q)
        const matchCity = p.city_en?.toLowerCase().includes(q) || p.city_ar?.toLowerCase().includes(q)
        const matchDistrict = p.district_en?.toLowerCase().includes(q) || p.district_ar?.toLowerCase().includes(q)
        const matchDev = p.developer_en?.toLowerCase().includes(q) || p.developer_ar?.toLowerCase().includes(q)
        const matchType = projType.toLowerCase().includes(q) || p.type_ar?.toLowerCase().includes(q)
        const matchId = p.id?.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchDistrict && !matchDev && !matchType && !matchId) return false
      }

      if (cityFilter !== 'ALL' && p.city_en !== cityFilter) return false

      if (typeFilter !== 'ALL') {
        if (typeFilter === 'Apartments' && projType !== 'Apartments' && projType !== 'Apartment') return false
        if (typeFilter === 'Villas' && projType !== 'Villas' && projType !== 'Villa') return false
        if (typeFilter === 'Commercial Buildings' && !projType.includes('Commercial')) return false
        if (typeFilter === 'Residential Buildings' && !projType.includes('Residential') && projType !== 'Apartments') return false
        if (typeFilter === 'Land' && projType !== 'Land') return false
      }

      if (statusFilter === 'PUBLISHED' && !p.is_published) return false
      if (statusFilter === 'DRAFT' && p.is_published) return false

      if (stageFilter !== 'ALL' && p.status_en !== stageFilter) return false

      if (ownershipFilter !== 'ALL') {
        const pOwnership = p.foreign_eligibility || 'ELIGIBLE'
        if (pOwnership !== ownershipFilter) return false
      }

      if (aiFilter === 'AI_ENABLED' && !p.ai_agent_enabled) return false
      if (aiFilter === 'AI_DISABLED' && p.ai_agent_enabled) return false

      if (offerFilter === 'ACTIVE_OFFER') {
        const isOfferActive = p.discount_offer?.is_active
        if (!isOfferActive) return false
        if (p.discount_offer?.valid_until) {
          const isExpired = new Date(p.discount_offer.valid_until).getTime() < Date.now()
          if (isExpired) return false
        }
      }

      return true
    })

    // Sorting
    if (sortBy === 'name') {
      result.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''))
    } else if (sortBy === 'photos') {
      result.sort((a, b) => (b.images?.length || 0) - (a.images?.length || 0))
    }

    return result
  }, [projects, search, cityFilter, typeFilter, ownershipFilter, statusFilter, stageFilter, offerFilter, sortBy])

  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1
  const effectivePage = Math.min(currentPage, totalPages)
  const displayedProjects = filteredProjects.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)

  const publishedCount = projects.filter((p) => p.is_published).length
  const draftCount = projects.length - publishedCount
  const activeOffersCount = projects.filter((p) => {
    if (!p.discount_offer?.is_active) return false
    if (p.discount_offer?.valid_until) {
      return new Date(p.discount_offer.valid_until).getTime() >= Date.now()
    }
    return true
  }).length

  const hasActiveFilters =
    search.trim() !== '' ||
    cityFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    ownershipFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    stageFilter !== 'ALL' ||
    offerFilter !== 'ALL' ||
    sortBy !== 'default'

  function resetFilters() {
    setSearch('')
    setCityFilter('ALL')
    setTypeFilter('ALL')
    setOwnershipFilter('ALL')
    setStatusFilter('ALL')
    setStageFilter('ALL')
    setOfferFilter('ALL')
    setSortBy('default')
    setCurrentPage(1)
  }

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="text-page-title">Projects CMS</h1>
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
              {projects.length} Total
            </span>
          </div>
          <p className="text-meta" style={{ marginTop: '2px' }}>
            Manage property developments, pricing, brochure documents, and Cloudinary galleries
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={`${WEBSITE_URL}/projects`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#2563EB',
              borderColor: '#BFDBFE',
              backgroundColor: '#EFF6FF',
              fontWeight: 600,
            }}
            title="Open Projects Page on Public Website"
          >
            <Globe size={13} />
            <span>View Live Website</span>
            <ExternalLink size={12} />
          </a>

          <button
            onClick={() => fetchProjects()}
            className="btn btn-outline btn-sm"
            title="Refresh Projects"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Commission Hub / Performance CTA */}
          {profile?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => router.push('/projects/commissions')}
              className="btn btn-outline btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                color: '#065F46',
                borderColor: '#A7F3D0',
                backgroundColor: '#ECFDF5',
              }}
              title="Open full Project Commissions Performance Hub page"
            >
              <BarChart3 size={14} style={{ color: '#059669' }} />
              <span>Commission Hub</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setReorderModalOpen(true)}
              className="btn btn-outline btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                color: '#B45309',
                borderColor: '#FDE68A',
                backgroundColor: '#FFFBEB',
              }}
              title="Search and assign top priority display slots (1-10)"
            >
              <Sparkles size={13} style={{ color: '#D97706' }} />
              <span>Manage Display Order</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Add Project</span>
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ paddingBottom: '30px' }}>


        {/* Quick Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCityFilter('ALL'); }}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'ALL' && cityFilter === 'ALL' ? '#0F172A' : '#F1F5F9',
              color: statusFilter === 'ALL' && cityFilter === 'ALL' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            All ({projects.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'PUBLISHED' ? 'ALL' : 'PUBLISHED')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'PUBLISHED' ? '#DCFCE7' : '#F1F5F9',
              color: statusFilter === 'PUBLISHED' ? '#15803D' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            ● Published ({publishedCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'DRAFT' ? '#FEF3C7' : '#F1F5F9',
              color: statusFilter === 'DRAFT' ? '#B45309' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            ○ Drafts ({draftCount})
          </button>

          <button
            type="button"
            onClick={() => setAiFilter(aiFilter === 'AI_ENABLED' ? 'ALL' : 'AI_ENABLED')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: aiFilter === 'AI_ENABLED' ? '#7C3AED' : '#F5F3FF',
              color: aiFilter === 'AI_ENABLED' ? '#FFFFFF' : '#6D28D9',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Bot size={13} />
            <span>✨ AI Active ({projects.filter((p) => p.ai_agent_enabled).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setOfferFilter(offerFilter === 'ACTIVE_OFFER' ? 'ALL' : 'ACTIVE_OFFER')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              border: offerFilter === 'ACTIVE_OFFER' ? '1px solid #EA580C' : '1px solid #FED7AA',
              cursor: 'pointer',
              backgroundColor: offerFilter === 'ACTIVE_OFFER' ? '#EA580C' : '#FFF7ED',
              color: offerFilter === 'ACTIVE_OFFER' ? '#FFFFFF' : '#C2410C',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Filter projects with active discounts and promotional countdowns"
          >
            <Flame size={12} />
            <span>Active Offers ({activeOffersCount})</span>
          </button>

          {cities.slice(0, 4).map((city) => {
            const count = projects.filter((p) => p.city_en === city).length
            const isSelected = cityFilter === city
            return (
              <button
                key={city}
                type="button"
                onClick={() => setCityFilter(isSelected ? 'ALL' : city)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#EFF6FF' : '#F1F5F9',
                  color: isSelected ? '#1D4ED8' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                📍 {city} ({count})
              </button>
            )
          })}
        </div>

        {/* Filter Toolbar */}
        <div
          className="card"
          style={{
            padding: '12px 14px',
            marginBottom: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, developer, district, city..."
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '12.5px', height: '36px' }}
            />
          </div>

          {/* City Filter */}
          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="form-select"
              style={{ fontSize: '12px', height: '36px', width: '100%' }}
            >
              <option value="ALL">All Cities ({projects.length})</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city} ({projects.filter((p) => p.city_en === city).length})
                </option>
              ))}
            </select>
          </div>

          {/* Property Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-select"
              style={{ fontSize: '12px', height: '36px', width: '100%' }}
            >
              <option value="ALL">All Property Types</option>
              <option value="Apartments">Apartments (شقق سكنية)</option>
              <option value="Villas">Villas (فلل سكنية)</option>
              <option value="Commercial Buildings">Commercial Buildings (مباني تجارية)</option>
              <option value="Residential Buildings">Residential Buildings (عمائر سكنية)</option>
              <option value="Land">Land (أراضي)</option>
            </select>
          </div>

          {/* Ownership Filter (Freehold, Leasehold, etc.) */}
          <div>
            <select
              value={ownershipFilter}
              onChange={(e) => {
                setOwnershipFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="form-select"
              style={{ fontSize: '12px', height: '36px', width: '100%' }}
            >
              <option value="ALL">All Ownership Types</option>
              <option value="ELIGIBLE">🌍 Freehold (تملك حر 100%)</option>
              <option value="LEASEHOLD">📑 Leasehold (حق انتفاع)</option>
              <option value="ELIGIBLE_MUSLIMS_ONLY">🕋 Muslims Only (Holy Cities)</option>
              <option value="REQUIRES_PREMIUM_RESIDENCY">👑 Requires Premium Residency</option>
              <option value="NOT_ELIGIBLE">🚫 Saudi Nationals Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ fontSize: '12px', height: '36px', width: '100%' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published Live Only</option>
              <option value="DRAFT">Drafts Only</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="form-select"
              style={{ fontSize: '12px', height: '36px', width: '100%' }}
            >
              <option value="ALL">All Stages</option>
              {stages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Control */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="form-select"
              style={{ fontSize: '12px', height: '36px', width: '100%' }}
            >
              <option value="default">Sort: Default Order</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="photos">Sort: Most Photos</option>
            </select>
          </div>

          {/* Reset Filters CTA */}
          {hasActiveFilters && (
            <div>
              <button
                type="button"
                onClick={resetFilters}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '11.5px',
                  color: '#EF4444',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '36px',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <X size={13} />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>

        {/* Projects Data Table */}
        {loading && projects.length === 0 ? (
          <LogoLoader size={44} text="Loading property projects..." />
        ) : displayedProjects.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '1060px', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
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
                    <th style={{ padding: '12px 14px', width: '22%' }}>Project &amp; Code</th>
                    <th style={{ padding: '12px 12px', width: '16%' }}>Location &amp; Dev</th>
                    <th style={{ padding: '12px 12px', width: '15%' }}>Specs &amp; Price</th>
                    <th style={{ padding: '12px 12px', width: '16%' }}>Brokerage Commission</th>
                    <th style={{ padding: '12px 6px', width: '6%', textAlign: 'center' }}>Media</th>
                    <th style={{ padding: '12px 14px', width: '25%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                {displayedProjects.map((project, idx) => {
                  const imageCount = (project.images || []).length
                  const hasBrochure = !!project.brochure_url
                  const projectRank = projects.findIndex((p) => p.id === project.id) + 1

                  return (
                    <tr
                      key={project.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      {/* Project Name (EN/AR) & Slug */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              backgroundColor: projectRank <= 3 ? '#FEF3C7' : '#F1F5F9',
                              color: projectRank <= 3 ? '#92400E' : '#64748B',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              minWidth: '24px',
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                            title={`Display Priority Slot #${projectRank}`}
                          >
                            #{projectRank}
                          </span>

                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '6px',
                              backgroundColor: project.is_published ? '#EFF6FF' : '#F1F5F9',
                              color: project.is_published ? '#2563EB' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Building size={15} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: '#0F172A',
                                fontSize: '13px',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              onClick={() => setEditingProject(project)}
                              title="Click to edit project details and photos"
                            >
                              {project.name_en}
                            </div>
                            <div
                              style={{
                                fontSize: '11.5px',
                                color: '#64748B',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              dir="rtl"
                            >
                              {project.name_ar}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Location & Developer */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0F172A', fontWeight: 600, fontSize: '12px' }}>
                          <MapPin size={12} style={{ color: '#D97706', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {project.district_en}, {project.city_en}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {project.developer_en || '—'}
                        </div>
                      </td>

                      {/* Specs & Starting Price */}
                      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {project.status_en && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 600,
                                color: '#0369A1',
                                backgroundColor: '#E0F2FE',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {project.status_en}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: project.is_published ? '#DCFCE7' : '#F1F5F9',
                              color: project.is_published ? '#15803D' : '#64748B',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {project.is_published ? 'LIVE' : 'DRAFT'}
                          </span>
                        </div>

                        {/* AI Property Advisor Quick Toggle & Foreign Ownership Status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              const newStatus = !project.ai_agent_enabled
                              setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, ai_agent_enabled: newStatus } : p)))
                              try {
                                await fetch('/api/projects/toggle-ai', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: project.id, ai_agent_enabled: newStatus }),
                                })
                              } catch (err) {
                                console.error('Failed to toggle AI agent:', err)
                                fetchProjects()
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '9999px',
                              border: project.ai_agent_enabled ? '1px solid #C4B5FD' : '1px solid #E2E8F0',
                              backgroundColor: project.ai_agent_enabled ? '#F5F3FF' : '#F8FAFC',
                              color: project.ai_agent_enabled ? '#7C3AED' : '#94A3B8',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: project.ai_agent_enabled ? '0 1px 3px rgba(124, 58, 237, 0.15)' : 'none',
                            }}
                            title={project.ai_agent_enabled ? 'AI Property Advisor Active. Click to pause.' : 'AI Property Advisor Inactive. Click to turn on.'}
                          >
                            <Bot size={11} style={{ color: project.ai_agent_enabled ? '#7C3AED' : '#94A3B8' }} />
                            <span>{project.ai_agent_enabled ? '✨ AI Active' : 'AI Off'}</span>
                          </button>

                          {project.foreign_eligibility === 'ELIGIBLE' && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#047857',
                                backgroundColor: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                              title="100% Freehold Eligible for Foreigners & Expats"
                            >
                              🌍 Freehold
                            </span>
                          )}

                          {project.foreign_eligibility === 'LEASEHOLD' && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#B45309',
                                backgroundColor: '#FEF3C7',
                                border: '1px solid #FDE68A',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                              title="Leasehold / Usufruct Rights (حق انتفاع / إيجار طويل الأجل)"
                            >
                              📑 Leasehold
                            </span>
                          )}

                          {project.foreign_eligibility === 'ELIGIBLE_MUSLIMS_ONLY' && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#0369A1',
                                backgroundColor: '#E0F2FE',
                                border: '1px solid #BAE6FD',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                              title="Holy Sanctuary Boundaries (Muslim Freehold / Usufruct Rights)"
                            >
                              🕋 Muslims Only
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, color: '#16A34A', fontSize: '12px', marginTop: '2px' }}>
                          {project.discount_offer?.is_active && project.discount_offer?.discounted_price_en ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '11px', fontWeight: 500 }}>
                                {project.discount_offer.original_price_en || project.starting_price_en}
                              </span>
                              <span style={{ color: '#EA580C', fontWeight: 800, fontSize: '12.5px' }}>
                                {project.discount_offer.discounted_price_en}
                              </span>
                            </div>
                          ) : (
                            project.starting_price_en || 'On inquiry'
                          )}
                        </div>

                        {/* Active Promotional Offer Tag */}
                        {project.discount_offer?.is_active && (() => {
                          const validUntil = project.discount_offer.valid_until
                          const isExpired = validUntil ? new Date(validUntil).getTime() < Date.now() : false
                          const daysLeft = validUntil
                            ? Math.ceil((new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                            : null

                          return (
                            <div style={{ marginTop: '4px' }}>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  backgroundColor: isExpired ? '#F1F5F9' : '#FFF7ED',
                                  color: isExpired ? '#64748B' : '#EA580C',
                                  border: isExpired ? '1px solid #E2E8F0' : '1px solid #FDBA74',
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                }}
                                title={
                                  project.discount_offer.applies_to === 'SPECIFIC_UNITS' && project.discount_offer.applicable_units_en
                                    ? `Offer on: ${project.discount_offer.applicable_units_en}`
                                    : 'Offer on all units'
                                }
                              >
                                <Flame size={10} style={{ color: isExpired ? '#94A3B8' : '#F97316' }} />
                                <span>{isExpired ? 'EXPIRED OFFER' : project.discount_offer.discount_badge_en || 'SPECIAL OFFER'}</span>
                              </div>

                              {!isExpired && daysLeft !== null && daysLeft >= 0 && (
                                <div style={{ fontSize: '10px', color: daysLeft <= 3 ? '#DC2626' : '#C2410C', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <Clock size={9} />
                                  <span>{daysLeft === 0 ? 'Expires today!' : `${daysLeft}d left`}</span>
                                </div>
                              )}

                              {project.discount_offer.applies_to === 'SPECIFIC_UNITS' && project.discount_offer.applicable_units_en && (
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: '#7C2D12',
                                    fontWeight: 500,
                                    marginTop: '1px',
                                    maxWidth: '140px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={`Applicable to: ${project.discount_offer.applicable_units_en}`}
                                >
                                  🎯 {project.discount_offer.applicable_units_en}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>

                      {/* Brokerage Commission & Notes */}
                      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
                        {project.expected_commission_en ? (
                          <div>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#ECFDF5',
                                color: '#047857',
                                border: '1px solid #A7F3D0',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                              }}
                              title="Brokerage commission / payout rate"
                            >
                              <SaudiRiyalIcon size={12} style={{ color: '#059669', flexShrink: 0 }} />
                              <span>{project.expected_commission_en}</span>
                            </div>

                            {(project.commission_notes_en || project.commission_notes_ar) && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#64748B',
                                  marginTop: '3px',
                                  lineHeight: '1.3',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '3px',
                                }}
                                title={project.commission_notes_en || project.commission_notes_ar || ''}
                              >
                                <Info size={11} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                  }}
                                >
                                  {project.commission_notes_en || project.commission_notes_ar}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                            Rate on request
                          </div>
                        )}
                      </td>

                      {/* Media (Photos counter & Brochure) */}
                      <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: imageCount > 0 ? '#2563EB' : '#94A3B8',
                              backgroundColor: imageCount > 0 ? '#EFF6FF' : '#F8FAFC',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <ImageIcon size={11} />
                            <span>{imageCount}</span>
                          </span>

                          {hasBrochure && (
                            <a
                              href={project.brochure_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '10.5px',
                                color: '#0284C7',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                textDecoration: 'none',
                              }}
                              title="Open PDF Brochure"
                            >
                              <FileDown size={11} />
                              <span>PDF</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Actions CTAs */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          {isAdmin && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', marginRight: '2px' }}>
                              <button
                                type="button"
                                onClick={() => handleMoveProject(project, 'up')}
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ padding: '2px', color: '#64748B' }}
                                title="Move Up"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveProject(project, 'down')}
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ padding: '2px', color: '#64748B' }}
                                title="Move Down"
                              >
                                <ArrowDown size={13} />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setEditingProject(project)}
                            className="btn btn-primary btn-sm"
                            style={{
                              fontSize: '11.5px',
                              padding: '3px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Edit2 size={11} />
                            <span>Manage</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActivityProject(project)}
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{ color: '#475569', padding: '3px' }}
                            title="View Project Activity History & Audit Log"
                          >
                            <ShieldCheck size={14} />
                          </button>

                          {Boolean(profile) && (
                            <button
                              type="button"
                              onClick={() => setCommissioningProject(project)}
                              className="btn btn-outline btn-sm"
                              style={{
                                fontSize: '11.5px',
                                padding: '3px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderColor: '#10B981',
                                color: '#059669',
                                backgroundColor: '#ECFDF5',
                                fontWeight: 600,
                              }}
                              title="Record & View Unit Sales Commissions"
                            >
                              <SaudiRiyalIcon size={11} />
                              <span>Sales</span>
                            </button>
                          )}


                          {project.is_published && (
                            <a
                              href={`${WEBSITE_URL}/projects/${project.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#0284C7', padding: '3px' }}
                              title="View Live Project on Website"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setProjectToDelete(project)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#EF4444', padding: '3px' }}
                              title="Delete Project"
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

          {/* Configurable Pagination Bar */}
          <Pagination
            currentPage={effectivePage}
            totalItems={filteredProjects.length}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => setPageSize(s)}
            pageSizeOptions={[10, 20, 50, 100]}
            itemLabel="projects"
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
            <Building size={28} style={{ color: '#94A3B8' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>No projects match your filters</div>
              <button
                type="button"
                onClick={resetFilters}
                className="btn btn-outline btn-sm"
                style={{ marginTop: '8px', fontSize: '12px' }}
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reorder Slots Priority Modal */}
      {reorderModalOpen && (
        <OrderSlotManagerModal
          isOpen={reorderModalOpen}
          title="Manage Project Display Order & Priority Slots"
          subtitle="Search any project to assign to top slots (1 to 10) or move any project to the top."
          items={projects.map((p) => ({
            id: p.id,
            title: p.name_en,
            subtitle: `${p.district_en}, ${p.city_en}`,
            sort_order: p.sort_order,
          }))}
          onClose={() => setReorderModalOpen(false)}
          onSave={async (reorderedItems) => {
            const res = await fetch('/api/projects/reorder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: reorderedItems }),
            })
            if (res.ok) {
              fetchProjects()
            }
          }}
        />
      )}

      {/* Project Editor Modal (Create or Edit with full 6 tabs including photo gallery) */}
      {(isCreatingNew || editingProject) && (
        <ProjectEditorModal
          project={editingProject}
          isOpen={isCreatingNew || !!editingProject}
          onClose={() => {
            setIsCreatingNew(false)
            setEditingProject(null)
          }}
          onSuccess={() => {
            setIsCreatingNew(false)
            setEditingProject(null)
            fetchProjects()
          }}
        />
      )}

      {/* Delete Project Confirmation Modal */}
      <ConfirmModal
        isOpen={!!projectToDelete}
        title="Delete Property Project"
        message={
          <>
            Are you sure you want to delete <strong>"{projectToDelete?.name_en}"</strong>? This will remove the project from the database.
          </>
        }
        confirmLabel="Delete Project"
        variant="danger"
        loading={deleting}
        onConfirm={executeDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />

      {/* Project Commissions Configurator Modal (Admin Only) */}
      {commissioningProject && (
        <ProjectCommissionsModal
          project={commissioningProject}
          profile={profile}
          onClose={() => {
            setCommissioningProject(null)
            fetchProjects()
          }}
        />
      )}

      {/* Project Activity History Modal */}
      {activityProject && (
        <div className="modal-overlay" style={{ zIndex: 95 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '680px',
              width: '95vw',
              maxHeight: '85vh',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} style={{ color: '#2563EB' }} />
                  <span>Activity History: {activityProject.name_en}</span>
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  Audit log of all edits, photo modifications, and commission updates made to this project
                </p>
              </div>
              <button onClick={() => setActivityProject(null)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
              <CmsActivityTimeline
                entityType="PROJECT"
                entityId={activityProject.id}
                entityTitle={activityProject.name_en}
              />
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setActivityProject(null)}
                className="btn btn-outline btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

