'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Star,
  Layers,
  Database,
  Loader2,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  X,
  FileText,
  ExternalLink,
  Globe,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Blog, Profile } from '@/types/database'
import BlogEditorModal from './BlogEditorModal'
import ConfirmModal from '@/components/ConfirmModal'
import LogoLoader from '@/components/LogoLoader'
import OrderSlotManagerModal from '@/components/OrderSlotManagerModal'
import Pagination from '@/components/Pagination'

const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://asaheebrealestate.com'
const PAGE_SIZE = 15

interface Props {
  profile: Profile
}

export default function BlogsClient({ profile }: Props) {
  const supabase = createClient()
  const isAdmin = profile?.role === 'ADMIN'

  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Modal States
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [blogToDelete, setBlogToDelete] = useState<Blog | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reorderModalOpen, setReorderModalOpen] = useState(false)

  const fetchBlogs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .order('sort_order', { ascending: true })

    if (!error && data) {
      setBlogs(data as Blog[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchBlogs()
  }, [fetchBlogs])

  // Toggle publish status
  async function handleTogglePublish(blog: Blog) {
    const nextStatus = !blog.is_published

    setBlogs((prev) =>
      prev.map((b) => (b.id === blog.id ? { ...b, is_published: nextStatus } : b))
    )

    await fetch('/api/blogs/toggle-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: blog.id, is_published: nextStatus }),
    })
  }

  // Toggle featured status (Enforcing single featured blog pinned to slot #1)
  async function handleToggleFeatured(blog: Blog) {
    const nextStatus = !blog.featured

    if (nextStatus) {
      // 1. Move targeted blog to position 0 (Slot #1)
      // 2. Set featured = true on targeted blog, false on all others
      // 3. Update sort_order to 1 for this blog, and 2, 3, 4... for the rest
      const remaining = blogs.filter((b) => b.id !== blog.id)
      const reordered = [
        { ...blog, featured: true, sort_order: 1 },
        ...remaining.map((b, idx) => ({ ...b, featured: false, sort_order: idx + 2 })),
      ]
      setBlogs(reordered)

      await fetch('/api/blogs/toggle-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: blog.id, featured: true }),
      })
    } else {
      setBlogs((prev) =>
        prev.map((b) => (b.id === blog.id ? { ...b, featured: false } : b))
      )

      await fetch('/api/blogs/toggle-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: blog.id, featured: false }),
      })
    }
  }

  // Move blog up/down and persist sort_order to database
  async function handleMoveBlog(blog: Blog, direction: 'up' | 'down') {
    const currentIndex = blogs.findIndex((b) => b.id === blog.id)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= blogs.length) return

    // If blog at index 0 is featured, prevent unfeatured blogs from displacing it from slot #1
    if (targetIndex === 0 && blogs[0].featured && !blog.featured) {
      alert('The Featured article is pinned to Slot #1. To place this article at the top, mark it as Featured.')
      return
    }

    const reordered = [...blogs]
    const temp = reordered[currentIndex]
    reordered[currentIndex] = reordered[targetIndex]
    reordered[targetIndex] = temp

    const itemsToSave = reordered.map((b, idx) => ({
      id: b.id,
      sort_order: idx + 1,
    }))

    // Optimistic local update
    setBlogs(reordered.map((b, idx) => ({ ...b, sort_order: idx + 1 })))

    try {
      await fetch('/api/blogs/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSave }),
      })
    } catch (err) {
      console.error('Failed to save blog order:', err)
    }
  }

  // Delete blog execution
  async function executeDeleteBlog() {
    if (!blogToDelete) return
    setDeleting(true)

    const res = await fetch('/api/blogs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: blogToDelete.id }),
    })

    if (res.ok) {
      setBlogs((prev) => prev.filter((b) => b.id !== blogToDelete.id))
      setBlogToDelete(null)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to delete blog article')
    }
    setDeleting(false)
  }

  // Categories list
  const categories = useMemo(() => Array.from(new Set(blogs.map((b) => b.category).filter(Boolean))), [blogs])

  const filteredBlogs = useMemo(() => {
    return blogs.filter((b) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTitle = b.title_en?.toLowerCase().includes(q) || b.title_ar?.toLowerCase().includes(q)
        const matchExcerpt = b.excerpt_en?.toLowerCase().includes(q) || b.excerpt_ar?.toLowerCase().includes(q)
        const matchCat = b.category_en?.toLowerCase().includes(q) || b.category_ar?.toLowerCase().includes(q)
        if (!matchTitle && !matchExcerpt && !matchCat) return false
      }

      if (categoryFilter !== 'ALL' && b.category !== categoryFilter) return false

      if (statusFilter === 'PUBLISHED' && !b.is_published) return false
      if (statusFilter === 'DRAFT' && b.is_published) return false
      if (statusFilter === 'FEATURED' && !b.featured) return false

      return true
    })
  }, [blogs, search, categoryFilter, statusFilter])

  const totalPages = Math.ceil(filteredBlogs.length / PAGE_SIZE) || 1
  const effectivePage = Math.min(currentPage, totalPages)
  const displayedBlogs = filteredBlogs.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)

  const publishedCount = blogs.filter((b) => b.is_published).length
  const featuredCount = blogs.filter((b) => b.featured).length
  const hasActiveFilters = search.trim() !== '' || categoryFilter !== 'ALL' || statusFilter !== 'ALL'

  function resetFilters() {
    setSearch('')
    setCategoryFilter('ALL')
    setStatusFilter('ALL')
    setCurrentPage(1)
  }

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="text-page-title">Blog Articles CMS</h1>
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
              {blogs.length} Total ({publishedCount} Published)
            </span>
          </div>
          <p className="text-meta" style={{ marginTop: '2px' }}>
            Publish bilingual real estate guides, market intelligence, and investment articles to your website
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={`${WEBSITE_URL}/blog`}
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
            title="Open Blog on Public Website"
          >
            <Globe size={13} />
            <span>View Live Website</span>
            <ExternalLink size={12} />
          </a>

          <button
            onClick={() => fetchBlogs()}
            className="btn btn-outline btn-sm"
            title="Refresh Blogs"
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
              <span>Create New Article</span>
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ paddingBottom: '30px' }}>
        {/* Quick Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCategoryFilter('ALL'); }}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'ALL' && categoryFilter === 'ALL' ? '#0F172A' : '#F1F5F9',
              color: statusFilter === 'ALL' && categoryFilter === 'ALL' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            All ({blogs.length})
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
            onClick={() => setStatusFilter(statusFilter === 'FEATURED' ? 'ALL' : 'FEATURED')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'FEATURED' ? '#FEF3C7' : '#F1F5F9',
              color: statusFilter === 'FEATURED' ? '#B45309' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            ★ Featured ({featuredCount})
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'guide' ? 'ALL' : 'guide')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: categoryFilter === 'guide' ? '#EFF6FF' : '#F1F5F9',
              color: categoryFilter === 'guide' ? '#1D4ED8' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Investment Guides ({blogs.filter(b => b.category === 'guide').length})
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'market' ? 'ALL' : 'market')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: categoryFilter === 'market' ? '#FEF3C7' : '#F1F5F9',
              color: categoryFilter === 'market' ? '#B45309' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Market Insights ({blogs.filter(b => b.category === 'market').length})
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'lifestyle' ? 'ALL' : 'lifestyle')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: categoryFilter === 'lifestyle' ? '#ECFDF5' : '#F1F5F9',
              color: categoryFilter === 'lifestyle' ? '#047857' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Lifestyle ({blogs.filter(b => b.category === 'lifestyle').length})
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'legal' ? 'ALL' : 'legal')}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: categoryFilter === 'legal' ? '#F3E8FF' : '#F1F5F9',
              color: categoryFilter === 'legal' ? '#7C3AED' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Legal &amp; Regulations ({blogs.filter(b => b.category === 'legal').length})
          </button>
        </div>

        {/* Filter Toolbar */}
        <div
          className="card"
          style={{
            padding: '12px 14px',
            marginBottom: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
              placeholder="Search articles by title, topic..."
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '12.5px', height: '36px' }}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select"
              style={{ fontSize: '12px', height: '36px', width: '100%' }}
            >
              <option value="ALL">All Categories ({blogs.length})</option>
              <option value="guide">Investment Guides</option>
              <option value="market">Market Insights</option>
              <option value="lifestyle">Lifestyle</option>
              <option value="legal">Legal &amp; Regulations</option>
              {categories.filter(c => !['guide', 'market', 'lifestyle', 'legal'].includes(c)).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
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
              <option value="FEATURED">Featured Only</option>
              <option value="DRAFT">Drafts Only</option>
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

        {/* Clean Fixed Table View (Matching Projects CMS) */}
        {loading && blogs.length === 0 ? (
          <LogoLoader size={44} text="Loading articles..." />
        ) : filteredBlogs.length > 0 ? (
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
                  <th style={{ padding: '12px 14px', width: '40%' }}>Article Title &amp; Topic</th>
                  <th style={{ padding: '12px 14px', width: '22%' }}>Author &amp; Read Time</th>
                  <th style={{ padding: '12px 12px', width: '11%' }}>Status &amp; Placement</th>
                  <th style={{ padding: '12px 6px', width: '5%', textAlign: 'center' }}>Blocks</th>
                  <th style={{ padding: '12px 16px', width: '22%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedBlogs.map((blog) => {
                  const sectionsCount = (blog.sections_en || []).length
                  const blogRank = blogs.findIndex((b) => b.id === blog.id) + 1

                  return (
                    <tr
                      key={blog.id}
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
                      {/* Title & Category */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              backgroundColor: blogRank <= 3 ? '#FEF3C7' : '#F1F5F9',
                              color: blogRank <= 3 ? '#92400E' : '#64748B',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              minWidth: '24px',
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                            title={`Display Priority Slot #${blogRank}`}
                          >
                            #{blogRank}
                          </span>

                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '6px',
                              backgroundColor: `${blog.accent || '#B8873B'}18`,
                              color: blog.accent || '#B8873B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <BookOpen size={15} />
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
                              onClick={() => setEditingBlog(blog)}
                              title="Click to edit article"
                            >
                              {blog.title_en}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#64748B',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: blog.accent || '#B8873B',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {blog.category_en || blog.category}
                              </span>
                              <span>•</span>
                              <span dir="rtl">{blog.title_ar}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Author & Read Time */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ color: '#0F172A', fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {blog.author_en || 'Asaheeb Research'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                          {blog.read_time_en} • {blog.date_en}
                        </div>
                      </td>

                      {/* Status & Featured */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: blog.is_published ? '#DCFCE7' : '#F1F5F9',
                              color: blog.is_published ? '#15803D' : '#64748B',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {blog.is_published ? 'LIVE' : 'DRAFT'}
                          </span>

                          {blog.featured && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#B45309',
                                backgroundColor: '#FEF3C7',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <Star size={9} fill="#B45309" />
                              <span>FEATURED</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sections Count */}
                      <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#475569',
                            backgroundColor: '#F1F5F9',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <FileText size={10} />
                          <span>{sectionsCount}</span>
                        </span>
                      </td>

                      {/* Actions CTAs */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          {isAdmin && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', marginRight: '2px' }}>
                              <button
                                type="button"
                                onClick={() => handleMoveBlog(blog, 'up')}
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ padding: '2px', color: '#64748B' }}
                                title="Move Up"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveBlog(blog, 'down')}
                                className="btn btn-ghost btn-icon btn-sm"
                                style={{ padding: '2px', color: '#64748B' }}
                                title="Move Down"
                              >
                                <ArrowDown size={13} />
                              </button>
                            </div>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleFeatured(blog)}
                              className="btn btn-sm"
                              title={blog.featured ? "Featured on Homepage (Click to Unfeature)" : "Click to mark as Featured"}
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: blog.featured ? '#F59E0B' : '#F8FAFC',
                                color: blog.featured ? '#FFFFFF' : '#64748B',
                                border: blog.featured ? '1px solid #D97706' : '1px solid #CBD5E1',
                                boxShadow: blog.featured ? '0 2px 4px rgba(245,158,11,0.35)' : 'none',
                                padding: '2px 7px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              <Star size={11} fill={blog.featured ? '#FFFFFF' : 'none'} />
                              <span>{blog.featured ? 'Featured' : 'Feature'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setEditingBlog(blog)}
                            className="btn btn-primary btn-sm"
                            style={{
                              fontSize: '11px',
                              padding: '2px 7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Edit2 size={11} />
                            <span>Edit</span>
                          </button>

                          {blog.is_published && (
                            <a
                              href={`${WEBSITE_URL}/blog/${blog.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#0284C7', padding: '2px' }}
                              title="View Live Article on Website"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setBlogToDelete(blog)}
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: '#EF4444', padding: '2px' }}
                              title="Delete Article"
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
              totalItems={filteredBlogs.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setCurrentPage(p)}
              itemLabel="articles"
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
            <BookOpen size={28} style={{ color: '#94A3B8' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                No blog articles found
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                {blogs.length === 0
                  ? 'Your blogs table in the database is currently empty. Click "+ Create New Article" to create your first article.'
                  : 'No articles match your search criteria.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reorder Slots Priority Modal */}
      {reorderModalOpen && (
        <OrderSlotManagerModal
          isOpen={reorderModalOpen}
          title="Manage Blog Display Order & Priority Slots"
          subtitle="Search any article to assign to top slots (1 to 10) or move any article to the top."
          items={blogs.map((b) => ({
            id: b.id,
            title: b.title_en,
            subtitle: b.category_en || b.category,
            sort_order: b.sort_order,
          }))}
          onClose={() => setReorderModalOpen(false)}
          onSave={async (reorderedItems) => {
            const res = await fetch('/api/blogs/reorder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: reorderedItems }),
            })
            if (res.ok) {
              fetchBlogs()
            }
          }}
        />
      )}

      {/* Blog Editor Modal */}
      {(isCreatingNew || editingBlog) && (
        <BlogEditorModal
          blog={editingBlog}
          isOpen={isCreatingNew || !!editingBlog}
          onClose={() => {
            setIsCreatingNew(false)
            setEditingBlog(null)
          }}
          onSuccess={() => {
            setIsCreatingNew(false)
            setEditingBlog(null)
            fetchBlogs()
          }}
        />
      )}

      {/* Delete Blog Confirmation Modal */}
      <ConfirmModal
        isOpen={!!blogToDelete}
        title="Delete Blog Article"
        message={
          <>
            Are you sure you want to delete <strong>"{blogToDelete?.title_en}"</strong>? This will permanently remove the article from the database and the website.
          </>
        }
        confirmLabel="Delete Article"
        variant="danger"
        loading={deleting}
        onConfirm={executeDeleteBlog}
        onCancel={() => setBlogToDelete(null)}
      />
    </div>
  )
}


