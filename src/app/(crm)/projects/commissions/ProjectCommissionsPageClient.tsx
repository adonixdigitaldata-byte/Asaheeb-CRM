'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Award,
  TrendingUp,
  Search,
  Filter,
  MapPin,
  Calendar,
  User,
  Info,
  ExternalLink,
  Plus,
  RefreshCw,
  Building,
  FileText,
  Edit2,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Download
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import { createClient } from '@/lib/supabase/client'
import type { Project, Profile, ProjectCommission } from '@/types/database'
import ProjectCommissionsModal from '../ProjectCommissionsModal'
import ProjectEditorModal from '../ProjectEditorModal'
import Pagination from '@/components/Pagination'
import LogoLoader from '@/components/LogoLoader'

interface Props {
  profile: Profile
}

export default function ProjectCommissionsPageClient({ profile }: Props) {
  const supabase = createClient()

  const [projects, setProjects] = useState<Project[]>([])
  const [commissions, setCommissions] = useState<ProjectCommission[]>([])
  const [loading, setLoading] = useState(true)

  // Active Tab
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'transactions'>('leaderboard')

  // Leaderboard Filter & Pagination States
  const [searchProject, setSearchProject] = useState('')
  const [salesFilter, setSalesFilter] = useState<'all' | 'with_sales' | 'no_sales'>('all')
  const [cityFilter, setCityFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'earned_desc' | 'units_desc' | 'name_asc'>('earned_desc')
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [leaderboardPageSize, setLeaderboardPageSize] = useState(10)

  // Transactions Filter & Pagination States
  const [searchTransaction, setSearchTransaction] = useState('')
  const [transactionProjectFilter, setTransactionProjectFilter] = useState('ALL')
  const [transactionPage, setTransactionPage] = useState(1)
  const [transactionPageSize, setTransactionPageSize] = useState(10)

  // Sub-modal states
  const [commissioningProject, setCommissioningProject] = useState<Project | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Fetch all projects and commissions
  const fetchData = useCallback(async () => {
    if (profile?.role !== 'ADMIN') return
    setLoading(true)
    try {
      const [projectsRes, commsRes] = await Promise.all([
        supabase.from('projects').select('*').order('sort_order', { ascending: true }),
        supabase.from('project_commissions').select('*').order('sale_date', { ascending: false }),
      ])

      if (projectsRes.data) {
        setProjects(projectsRes.data as Project[])
      }
      if (commsRes.data) {
        setCommissions(commsRes.data as ProjectCommission[])
      }
    } catch (err) {
      console.error('Error loading commissions page data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, profile?.role])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Project Aggregates
  const projectAggregates = useMemo(() => {
    const commsByProject: Record<string, ProjectCommission[]> = {}
    commissions.forEach((c) => {
      if (!commsByProject[c.project_id]) commsByProject[c.project_id] = []
      commsByProject[c.project_id].push(c)
    })

    const totalPortfolioEarned = commissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)

    return projects.map((project) => {
      const projectComms = commsByProject[project.id] || []
      const totalEarned = projectComms.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)
      const unitsSold = projectComms.length
      const percentOfTotal = totalPortfolioEarned > 0 ? (totalEarned / totalPortfolioEarned) * 100 : 0
      const lastSaleDate = projectComms.length > 0
        ? projectComms.map((c) => c.sale_date).sort().reverse()[0]
        : null

      return {
        project,
        commissions: projectComms,
        totalEarned,
        unitsSold,
        percentOfTotal,
        lastSaleDate,
      }
    })
  }, [projects, commissions])

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalEarned = commissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)
    const totalUnitsSold = commissions.length
    const projectsWithSales = projectAggregates.filter((p) => p.unitsSold > 0)
    
    // Top revenue project
    const sortedByEarned = [...projectAggregates].sort((a, b) => b.totalEarned - a.totalEarned)
    const topProject = sortedByEarned.length > 0 && sortedByEarned[0].totalEarned > 0 ? sortedByEarned[0] : null
    const avgPerDeal = totalUnitsSold > 0 ? totalEarned / totalUnitsSold : 0

    return {
      totalEarned,
      totalUnitsSold,
      projectsWithSalesCount: projectsWithSales.length,
      topProject,
      avgPerDeal,
    }
  }, [commissions, projectAggregates])

  // Unique cities for filter
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>()
    projects.forEach((p) => {
      if (p.city_en) cities.add(p.city_en)
    })
    return Array.from(cities).sort()
  }, [projects])

  // Filtered & Sorted Leaderboard List
  const filteredLeaderboard = useMemo(() => {
    return projectAggregates
      .filter((item) => {
        const p = item.project
        if (searchProject.trim()) {
          const q = searchProject.toLowerCase()
          const matchesName = (p.name_en || '').toLowerCase().includes(q) || (p.name_ar || '').toLowerCase().includes(q)
          const matchesDev = (p.developer_en || '').toLowerCase().includes(q) || (p.developer_ar || '').toLowerCase().includes(q)
          const matchesCity = (p.city_en || '').toLowerCase().includes(q) || (p.district_en || '').toLowerCase().includes(q)
          const matchesTerms = (p.expected_commission_en || '').toLowerCase().includes(q) || (p.commission_notes_en || '').toLowerCase().includes(q)
          if (!matchesName && !matchesDev && !matchesCity && !matchesTerms) return false
        }

        if (salesFilter === 'with_sales' && item.unitsSold === 0) return false
        if (salesFilter === 'no_sales' && item.unitsSold > 0) return false

        if (cityFilter !== 'ALL' && p.city_en !== cityFilter) return false

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'earned_desc') {
          if (b.totalEarned !== a.totalEarned) return b.totalEarned - a.totalEarned
          return b.unitsSold - a.unitsSold
        }
        if (sortBy === 'units_desc') {
          if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold
          return b.totalEarned - a.totalEarned
        }
        if (sortBy === 'name_asc') {
          return a.project.name_en.localeCompare(b.project.name_en)
        }
        return 0
      })
  }, [projectAggregates, searchProject, salesFilter, cityFilter, sortBy])

  // Paginated Leaderboard
  const paginatedLeaderboard = useMemo(() => {
    const start = (leaderboardPage - 1) * leaderboardPageSize
    return filteredLeaderboard.slice(start, start + leaderboardPageSize)
  }, [filteredLeaderboard, leaderboardPage, leaderboardPageSize])

  // Filtered & Paginated Transactions
  const filteredTransactions = useMemo(() => {
    return commissions
      .filter((c) => {
        const matchedProject = projects.find((p) => p.id === c.project_id)

        if (transactionProjectFilter !== 'ALL' && c.project_id !== transactionProjectFilter) {
          return false
        }

        if (searchTransaction.trim()) {
          const q = searchTransaction.toLowerCase()
          const matchesUnit = (c.unit_name || '').toLowerCase().includes(q)
          const matchesBuyer = (c.buyer_name || '').toLowerCase().includes(q)
          const matchesAgent = (c.agent_name || '').toLowerCase().includes(q)
          const matchesNotes = (c.notes || '').toLowerCase().includes(q)
          const matchesProject = matchedProject
            ? matchedProject.name_en.toLowerCase().includes(q) || matchedProject.name_ar.toLowerCase().includes(q)
            : false

          if (!matchesUnit && !matchesBuyer && !matchesAgent && !matchesNotes && !matchesProject) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => new Date(b.sale_date || 0).getTime() - new Date(a.sale_date || 0).getTime())
  }, [commissions, projects, transactionProjectFilter, searchTransaction])

  const paginatedTransactions = useMemo(() => {
    const start = (transactionPage - 1) * transactionPageSize
    return filteredTransactions.slice(start, start + transactionPageSize)
  }, [filteredTransactions, transactionPage, transactionPageSize])

  if (profile?.role !== 'ADMIN') {
    return (
      <div className="page-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '36px 24px', textAlign: 'center', border: '1px solid #FECACA', backgroundColor: '#FEF2F2' }}>
          <ShieldCheck size={48} style={{ color: '#DC2626', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#991B1B', margin: '0 0 6px 0' }}>
            Administrator Access Required
          </h2>
          <p style={{ fontSize: '13px', color: '#7F1D1D', margin: '0 0 18px 0', lineHeight: '1.5' }}>
            The Project Commissions Performance Hub and brokerage payout data are strictly restricted to system administrators.
          </p>
          <Link
            href="/projects"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} />
            <span>Return to Projects CMS</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main, #F8FAFC)' }}>
      {/* Top Breadcrumb & Actions Bar */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '20px 24px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid var(--border, #E2E8F0)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link
              href="/projects"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#2563EB',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} />
              <span>Projects CMS</span>
            </Link>
            <span style={{ color: '#94A3B8' }}>/</span>
            <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 500 }}>
              Commissions &amp; Sales Performance
            </span>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SaudiRiyalIcon size={20} />
            </div>
            <span>Project Commissions Performance Hub</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Individual project earnings breakdown, brokerage agreement terms &amp; notes, and complete unit sales transaction ledger
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchData}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Refresh Commission Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link href="/projects" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            Back to Projects CMS
          </Link>
        </div>
      </div>

      <div className="page-body" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* KPI Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {/* Card 1: Total Commissions */}
          <div
            className="card"
            style={{
              padding: '18px 20px',
              background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
              border: '1px solid #A7F3D0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Project Commission
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#065F46' }}>
                <SaudiRiyalIcon size={17} />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#065F46', marginTop: '6px' }}>
              SAR {summaryMetrics.totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '12px', color: '#059669', marginTop: '3px', fontWeight: 500 }}>
              Across {summaryMetrics.totalUnitsSold} recorded layout / unit sale{summaryMetrics.totalUnitsSold === 1 ? '' : 's'}
            </div>
          </div>

          {/* Card 2: Units Sold */}
          <div
            className="card"
            style={{
              padding: '18px 20px',
              background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
              border: '1px solid #BFDBFE',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Units / Layouts Sold
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E40AF' }}>
                <Building2 size={17} />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#1E40AF', marginTop: '6px' }}>
              {summaryMetrics.totalUnitsSold} Sold
            </div>
            <div style={{ fontSize: '12px', color: '#2563EB', marginTop: '3px', fontWeight: 500 }}>
              {summaryMetrics.projectsWithSalesCount} of {projects.length} managed project developments have closed deals
            </div>
          </div>

          {/* Card 3: Top Revenue Project */}
          <div
            className="card"
            style={{
              padding: '18px 20px',
              background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
              border: '1px solid #FDE68A',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                #1 Top Revenue Project
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#92400E' }}>
                <Award size={17} />
              </div>
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#92400E',
                marginTop: '6px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={summaryMetrics.topProject ? summaryMetrics.topProject.project.name_en : 'None'}
            >
              {summaryMetrics.topProject ? summaryMetrics.topProject.project.name_en : 'No sales recorded yet'}
            </div>
            <div style={{ fontSize: '12px', color: '#B45309', marginTop: '3px', fontWeight: 500 }}>
              {summaryMetrics.topProject && summaryMetrics.topProject.totalEarned > 0
                ? `SAR ${summaryMetrics.topProject.totalEarned.toLocaleString('en-US')} (${summaryMetrics.topProject.unitsSold} units)`
                : 'Awaiting first project sale'}
            </div>
          </div>

          {/* Card 4: Avg Commission per Deal */}
          <div
            className="card"
            style={{
              padding: '18px 20px',
              background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
              border: '1px solid #E9D5FF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Avg Commission / Sale
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B21A8' }}>
                <TrendingUp size={17} />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#6B21A8', marginTop: '6px' }}>
              SAR {summaryMetrics.avgPerDeal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '12px', color: '#7E22CE', marginTop: '3px', fontWeight: 500 }}>
              Average broker yield per closed deal
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: activeTab === 'leaderboard' ? '#0F172A' : '#FFFFFF',
              color: activeTab === 'leaderboard' ? '#FFFFFF' : '#475569',
              boxShadow: activeTab === 'leaderboard' ? '0 2px 6px rgba(15,23,42,0.15)' : 'none',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: activeTab === 'leaderboard' ? '#0F172A' : '#E2E8F0',
              transition: 'all 0.15s ease',
            }}
          >
            <Award size={16} />
            <span>Project Revenue Leaderboard ({projects.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: activeTab === 'transactions' ? '#0F172A' : '#FFFFFF',
              color: activeTab === 'transactions' ? '#FFFFFF' : '#475569',
              boxShadow: activeTab === 'transactions' ? '0 2px 6px rgba(15,23,42,0.15)' : 'none',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: activeTab === 'transactions' ? '#0F172A' : '#E2E8F0',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={16} />
            <span>All Sales Transactions Log ({commissions.length})</span>
          </button>
        </div>

        {/* TAB 1: PROJECT REVENUE LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                backgroundColor: '#FFFFFF',
                padding: '14px 18px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
              }}
            >
              {/* Search */}
              <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94A3B8' }} />
                <input
                  type="text"
                  value={searchProject}
                  onChange={(e) => {
                    setSearchProject(e.target.value)
                    setLeaderboardPage(1)
                  }}
                  placeholder="Search by project name, developer, brokerage terms..."
                  className="form-input"
                  style={{ fontSize: '13px', paddingLeft: '34px', height: '36px', width: '100%' }}
                />
              </div>

              {/* Status Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSalesFilter('all')
                    setLeaderboardPage(1)
                  }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: salesFilter === 'all' ? '#0F172A' : '#CBD5E1',
                    backgroundColor: salesFilter === 'all' ? '#0F172A' : '#FFFFFF',
                    color: salesFilter === 'all' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  All Projects ({projects.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSalesFilter('with_sales')
                    setLeaderboardPage(1)
                  }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: salesFilter === 'with_sales' ? '#059669' : '#CBD5E1',
                    backgroundColor: salesFilter === 'with_sales' ? '#ECFDF5' : '#FFFFFF',
                    color: salesFilter === 'with_sales' ? '#047857' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  With Sales ({summaryMetrics.projectsWithSalesCount})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSalesFilter('no_sales')
                    setLeaderboardPage(1)
                  }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: salesFilter === 'no_sales' ? '#64748B' : '#CBD5E1',
                    backgroundColor: salesFilter === 'no_sales' ? '#F1F5F9' : '#FFFFFF',
                    color: salesFilter === 'no_sales' ? '#0F172A' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  No Sales ({projects.length - summaryMetrics.projectsWithSalesCount})
                </button>
              </div>

              {/* City Filter */}
              <select
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value)
                  setLeaderboardPage(1)
                }}
                className="form-select"
                style={{ fontSize: '12.5px', height: '36px', width: 'auto', minWidth: '140px' }}
              >
                <option value="ALL">All Cities ({uniqueCities.length})</option>
                {uniqueCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Sort Order */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="form-select"
                style={{ fontSize: '12.5px', height: '36px', width: 'auto', minWidth: '190px', fontWeight: 600 }}
              >
                <option value="earned_desc">Sort: Highest Earned (SAR)</option>
                <option value="units_desc">Sort: Most Units Sold</option>
                <option value="name_asc">Sort: Project Name (A-Z)</option>
              </select>
            </div>

            {/* Leaderboard Table */}
            {loading && projects.length === 0 ? (
              <LogoLoader size={44} text="Loading project commission performance..." />
            ) : filteredLeaderboard.length === 0 ? (
              <div
                style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px dashed #CBD5E1',
                  color: '#64748B',
                }}
              >
                <Building2 size={36} style={{ margin: '0 auto 10px', color: '#94A3B8' }} />
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>No projects match your filter</div>
                <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                  Try adjusting your search query or reset filters.
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '960px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderBottom: '1px solid #E2E8F0',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        <th style={{ padding: '14px', width: '70px', textAlign: 'center' }}>Rank</th>
                        <th style={{ padding: '14px', width: '28%' }}>Project &amp; Location</th>
                        <th style={{ padding: '14px', width: '24%' }}>Brokerage Terms &amp; Agreement Notes</th>
                        <th style={{ padding: '14px', width: '12%', textAlign: 'center' }}>Units Sold</th>
                        <th style={{ padding: '14px', width: '18%', textAlign: 'right' }}>Total Commission Earned</th>
                        <th style={{ padding: '14px', width: '14%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLeaderboard.map((item, idx) => {
                        const p = item.project
                        const overallRank = (leaderboardPage - 1) * leaderboardPageSize + idx + 1
                        const isTop3 = overallRank <= 3 && item.totalEarned > 0

                        return (
                          <tr
                            key={p.id}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: isTop3 && overallRank === 1 ? '#FFFDF5' : 'transparent',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              ;(e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC'
                            }}
                            onMouseLeave={(e) => {
                              ;(e.currentTarget as HTMLElement).style.backgroundColor =
                                isTop3 && overallRank === 1 ? '#FFFDF5' : 'transparent'
                            }}
                          >
                            {/* Rank */}
                            <td style={{ padding: '14px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '8px',
                                  fontSize: '12.5px',
                                  fontWeight: 800,
                                  backgroundColor:
                                    overallRank === 1 && item.totalEarned > 0
                                      ? '#FEF3C7'
                                      : overallRank === 2 && item.totalEarned > 0
                                      ? '#E2E8F0'
                                      : overallRank === 3 && item.totalEarned > 0
                                      ? '#FFEDD5'
                                      : '#F1F5F9',
                                  color:
                                    overallRank === 1 && item.totalEarned > 0
                                      ? '#B45309'
                                      : overallRank === 2 && item.totalEarned > 0
                                      ? '#475569'
                                      : overallRank === 3 && item.totalEarned > 0
                                      ? '#C2410C'
                                      : '#64748B',
                                  border: isTop3 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                                }}
                                title={`Rank #${overallRank}`}
                              >
                                {overallRank === 1 && item.totalEarned > 0 ? '👑' : `#${overallRank}`}
                              </span>
                            </td>

                            {/* Project & Location */}
                            <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: item.unitsSold > 0 ? '#ECFDF5' : '#F1F5F9',
                                    color: item.unitsSold > 0 ? '#059669' : '#64748B',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Building size={18} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      color: '#0F172A',
                                      fontSize: '13.5px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => setEditingProject(p)}
                                    title="Click to edit project"
                                  >
                                    {p.name_en}
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
                                    {p.name_ar}
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '11px',
                                      color: '#64748B',
                                      marginTop: '2px',
                                    }}
                                  >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#D97706', fontWeight: 600 }}>
                                      <MapPin size={10} />
                                      {p.city_en}
                                    </span>
                                    {p.developer_en && <span>• {p.developer_en}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Brokerage Terms & Agreement Notes */}
                            <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {p.expected_commission_en ? (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: '#ECFDF5',
                                      color: '#047857',
                                      border: '1px solid #A7F3D0',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      width: 'fit-content',
                                    }}
                                    title="Agreed brokerage commission payout rate"
                                  >
                                    <SaudiRiyalIcon size={11} style={{ color: '#059669' }} />
                                    <span>{p.expected_commission_en}</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic' }}>
                                    Rate on request
                                  </span>
                                )}

                                {/* Notes with high visibility & hover tooltip */}
                                {(p.commission_notes_en || p.commission_notes_ar) ? (
                                  <div
                                    style={{
                                      fontSize: '11.5px',
                                      color: '#1E293B',
                                      backgroundColor: '#FFFBEB',
                                      border: '1px solid #FDE68A',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      lineHeight: '1.35',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '5px',
                                      cursor: 'help',
                                    }}
                                    title={`Brokerage Agreement Memo:\n${p.commission_notes_en || ''}\n${p.commission_notes_ar || ''}`}
                                  >
                                    <Info size={12} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 600, color: '#92400E', fontSize: '10.5px' }}>
                                        Brokerage Agreement Notes:
                                      </div>
                                      <div style={{ color: '#78350F', fontSize: '11px', marginTop: '1px' }}>
                                        {p.commission_notes_en || p.commission_notes_ar}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#CBD5E1' }}>No special notes recorded</span>
                                )}
                              </div>
                            </td>

                            {/* Units Sold */}
                            <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'center' }}>
                              {item.unitsSold > 0 ? (
                                <div>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '3px 9px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      backgroundColor: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #BFDBFE',
                                    }}
                                  >
                                    <Building2 size={12} />
                                    {item.unitsSold} Sold
                                  </span>
                                  {item.lastSaleDate && (
                                    <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '3px' }}>
                                      Last: {item.lastSaleDate}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#94A3B8' }}>0 Sold</span>
                              )}
                            </td>

                            {/* Total Commission Earned */}
                            <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'right' }}>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: item.totalEarned > 0 ? '#059669' : '#64748B' }}>
                                SAR {item.totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {item.totalEarned > 0 && (
                                <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                                  {item.percentOfTotal.toFixed(1)}% of total
                                </div>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={() => setCommissioningProject(p)}
                                  className="btn btn-sm"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: '#059669',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                  title="Open and record sales for this project"
                                >
                                  <SaudiRiyalIcon size={12} />
                                  <span>Sales ({item.unitsSold})</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditingProject(p)}
                                  className="btn btn-ghost btn-icon btn-sm"
                                  style={{ padding: '5px', color: '#64748B' }}
                                  title="Edit project details"
                                >
                                  <Edit2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Leaderboard Pagination */}
                <Pagination
                  currentPage={leaderboardPage}
                  totalItems={filteredLeaderboard.length}
                  pageSize={leaderboardPageSize}
                  onPageChange={setLeaderboardPage}
                  onPageSizeChange={setLeaderboardPageSize}
                  pageSizeOptions={[10, 20, 50]}
                  itemLabel="projects"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ALL SALES TRANSACTIONS LOG */}
        {activeTab === 'transactions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                backgroundColor: '#FFFFFF',
                padding: '14px 18px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
              }}
            >
              {/* Search */}
              <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94A3B8' }} />
                <input
                  type="text"
                  value={searchTransaction}
                  onChange={(e) => {
                    setSearchTransaction(e.target.value)
                    setTransactionPage(1)
                  }}
                  placeholder="Search by buyer name, unit, agent, notes, or project..."
                  className="form-input"
                  style={{ fontSize: '13px', paddingLeft: '34px', height: '36px', width: '100%' }}
                />
              </div>

              {/* Project Filter */}
              <select
                value={transactionProjectFilter}
                onChange={(e) => {
                  setTransactionProjectFilter(e.target.value)
                  setTransactionPage(1)
                }}
                className="form-select"
                style={{ fontSize: '12.5px', height: '36px', width: 'auto', minWidth: '240px' }}
              >
                <option value="ALL">All Projects ({projects.length})</option>
                {projects.map((p) => {
                  const count = commissions.filter((c) => c.project_id === p.id).length
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name_en} ({count} sale{count === 1 ? '' : 's'})
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Transactions Table */}
            {filteredTransactions.length === 0 ? (
              <div
                style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px dashed #CBD5E1',
                  color: '#64748B',
                }}
              >
                <FileText size={36} style={{ margin: '0 auto 10px', color: '#94A3B8' }} />
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>No sales transactions found</div>
                <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                  {commissions.length === 0
                    ? 'No project unit sales have been recorded yet. Click "Sales" on any project in the Leaderboard tab to record a closed deal.'
                    : 'Try adjusting your search query or project filter.'}
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '940px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderBottom: '1px solid #E2E8F0',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        <th style={{ padding: '14px', width: '110px' }}>Sale Date</th>
                        <th style={{ padding: '14px', width: '22%' }}>Project Development</th>
                        <th style={{ padding: '14px', width: '18%' }}>Unit / Layout &amp; Buyer</th>
                        <th style={{ padding: '14px', width: '15%' }}>Agent / Broker</th>
                        <th style={{ padding: '14px', width: '20%' }}>Transaction Notes</th>
                        <th style={{ padding: '14px', width: '15%', textAlign: 'right' }}>Commission Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTransactions.map((c) => {
                        const matchedProject = projects.find((p) => p.id === c.project_id)

                        return (
                          <tr
                            key={c.id}
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
                            {/* Date */}
                            <td style={{ padding: '14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '12px', fontWeight: 600 }}>
                                <Calendar size={12} style={{ color: '#059669' }} />
                                <span>{c.sale_date || '—'}</span>
                              </div>
                            </td>

                            {/* Project */}
                            <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                              {matchedProject ? (
                                <div>
                                  <div
                                    onClick={() => setCommissioningProject(matchedProject)}
                                    style={{
                                      fontWeight: 700,
                                      color: '#0F172A',
                                      fontSize: '13px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                    title="Click to open project sales modal"
                                  >
                                    <span>{matchedProject.name_en}</span>
                                    <ExternalLink size={11} style={{ color: '#2563EB' }} />
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                                    {matchedProject.city_en}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: '#94A3B8' }}>Project {c.project_id}</span>
                              )}
                            </td>

                            {/* Unit & Buyer */}
                            <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                              <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '12.5px' }}>
                                {c.unit_name || 'Unit Deal'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                <User size={10} />
                                <span>{c.buyer_name || 'Buyer on record'}</span>
                              </div>
                            </td>

                            {/* Agent */}
                            <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  color: '#0F172A',
                                  backgroundColor: '#F1F5F9',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  display: 'inline-block',
                                }}
                              >
                                {c.agent_name || 'Company Deal'}
                              </span>
                            </td>

                            {/* Notes */}
                            <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                              {c.notes ? (
                                <div
                                  style={{
                                    fontSize: '11.5px',
                                    color: '#475569',
                                    backgroundColor: '#F8FAFC',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #E2E8F0',
                                    lineHeight: '1.35',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '4px',
                                  }}
                                  title={c.notes}
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
                                    {c.notes}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#CBD5E1' }}>—</span>
                              )}
                            </td>

                            {/* Commission Amount */}
                            <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'right' }}>
                              <div style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                                SAR {Number(c.commission_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Transactions Pagination */}
                <Pagination
                  currentPage={transactionPage}
                  totalItems={filteredTransactions.length}
                  pageSize={transactionPageSize}
                  onPageChange={setTransactionPage}
                  onPageSizeChange={setTransactionPageSize}
                  pageSizeOptions={[10, 20, 50]}
                  itemLabel="sales records"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Commissions Configurator Modal */}
      {commissioningProject && (
        <ProjectCommissionsModal
          project={commissioningProject}
          profile={profile}
          onClose={() => {
            setCommissioningProject(null)
            fetchData()
          }}
        />
      )}

      {/* Project Editor Modal */}
      {editingProject && (
        <ProjectEditorModal
          project={editingProject}
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          onSuccess={() => {
            setEditingProject(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
