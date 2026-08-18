'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  DollarSign,
  FolderOpen,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Globe,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Project, Profile } from '@/types/database'
import ProjectEditorModal from './ProjectEditorModal'
import ConfirmModal from '@/components/ConfirmModal'
import LogoLoader from '@/components/LogoLoader'
import OrderSlotManagerModal from '@/components/OrderSlotManagerModal'
import Pagination from '@/components/Pagination'

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://asaheebrealestate.com'
const PAGE_SIZE = 15

interface Props {
  profile: Profile
}

export default function ProjectsClient({ profile }: Props) {
  const supabase = createClient()
  const isAdmin = profile?.role === 'ADMIN'

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // Filters & Sorting States
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'price_asc' | 'price_desc' | 'photos'>('default')

  // Modal States
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
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
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = p.name_en?.toLowerCase().includes(q) || p.name_ar?.toLowerCase().includes(q)
        const matchCity = p.city_en?.toLowerCase().includes(q) || p.city_ar?.toLowerCase().includes(q)
        const matchDistrict = p.district_en?.toLowerCase().includes(q) || p.district_ar?.toLowerCase().includes(q)
        const matchDev = p.developer_en?.toLowerCase().includes(q) || p.developer_ar?.toLowerCase().includes(q)
        const matchId = p.id?.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchDistrict && !matchDev && !matchId) return false
      }

      if (cityFilter !== 'ALL' && p.city_en !== cityFilter) return false

      if (statusFilter === 'PUBLISHED' && !p.is_published) return false
      if (statusFilter === 'DRAFT' && p.is_published) return false

      if (stageFilter !== 'ALL' && p.status_en !== stageFilter) return false

      return true
    })

    // Sorting
    if (sortBy === 'name') {
      result.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''))
    } else if (sortBy === 'photos') {
      result.sort((a, b) => (b.images?.length || 0) - (a.images?.length || 0))
    }

    return result
  }, [projects, search, cityFilter, statusFilter, stageFilter, sortBy])

  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE) || 1
  const effectivePage = Math.min(currentPage, totalPages)
  const displayedProjects = filteredProjects.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)

  const publishedCount = projects.filter((p) => p.is_published).length
  const draftCount = projects.length - publishedCount
  const hasActiveFilters = search.trim() !== '' || cityFilter !== 'ALL' || statusFilter !== 'ALL' || stageFilter !== 'ALL' || sortBy !== 'default'

  function resetFilters() {
    setSearch('')
    setCityFilter('ALL')
    setStatusFilter('ALL')
    setStageFilter('ALL')
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

          {isAdmin && (
            <button
              type="button"
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

        {/* Clean, Non-Overflowing Fixed Table */}
        {loading && projects.length === 0 ? (
          <LogoLoader size={44} text="Loading property projects..." />
        ) : filteredProjects.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', width: '100%' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
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
                  <th style={{ padding: '12px 14px', width: '32%' }}>Project &amp; Code</th>
                  <th style={{ padding: '12px 14px', width: '22%' }}>Location &amp; Dev</th>
                  <th style={{ padding: '12px 14px', width: '18%' }}>Specs &amp; Price</th>
                  <th style={{ padding: '12px 10px', width: '8%', textAlign: 'center' }}>Media</th>
                  <th style={{ padding: '12px 16px', width: '20%', textAlign: 'right' }}>Actions</th>
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
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
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
                        <div style={{ fontWeight: 700, color: '#16A34A', fontSize: '12px', marginTop: '2px' }}>
                          {project.starting_price_en || 'On inquiry'}
                        </div>
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

            {/* 15-Item Pagination with Smooth Auto-Scroll to Top */}
            <Pagination
              currentPage={effectivePage}
              totalItems={filteredProjects.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setCurrentPage(p)}
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
    </div>
  )
}

