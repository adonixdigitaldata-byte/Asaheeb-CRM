'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Award,
  Building2,
  Calendar,
  Layers,
  Search,
  TrendingUp,
  User,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  Percent,
  Target,
  Users,
  ChevronRight,
  BarChart3,
  BadgeCheck,
  FileSpreadsheet,
  ArrowUpDown,
  X,
  WalletCards,
  Lock,
  KeyRound,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Project, ProjectCommission } from '@/types/database'
import Pagination from '@/components/Pagination'
import SecurityPinGuard from '@/components/SecurityPinGuard'

interface Props {
  profile: Profile
}

type AdminTab = 'LEADERBOARD' | 'TRANSACTIONS' | 'MY_SALES'
type RoleFilter = 'ALL' | 'AGENT' | 'CHANNEL_PARTNER' | 'SALES_MANAGER'
type SortField = 'volume' | 'units' | 'area' | 'commission' | 'name'

export default function MySalesClient({ profile }: Props) {
  const supabase = createClient()
  const isAdmin = profile.role === 'ADMIN'

  // Admin / Manager Navigation Tabs
  const [adminTab, setAdminTab] = useState<AdminTab>('LEADERBOARD')

  // Team members list for Admin/Manager
  const [teamMembers, setTeamMembers] = useState<Profile[]>([])
  const [commissions, setCommissions] = useState<ProjectCommission[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & State
  const [search, setSearch] = useState('')
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'MONTH' | 'WEEK' | 'CUSTOM'>('ALL')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL')
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('ALL')
  const [sortField, setSortField] = useState<SortField>('volume')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  // Pagination for transactions
  const [currentPage, setCurrentPage] = useState(1)
  const [transactionPageSize, setTransactionPageSize] = useState(15)

  // Pagination for leaderboard
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [leaderboardPageSize, setLeaderboardPageSize] = useState(10)

  // Pagination for personal deals
  const [personalDealsPage, setPersonalDealsPage] = useState(1)
  const [personalDealsPageSize, setPersonalDealsPageSize] = useState(10)

  // Modal State for setting Base Target (X) and Tier Rate (Y%)
  const [targetModalMember, setTargetModalMember] = useState<Profile | null>(null)
  const [targetInputX, setTargetInputX] = useState<string>('')
  const [targetInputY, setTargetInputY] = useState<string>('')
  const [savingTarget, setSavingTarget] = useState(false)
  const [targetSuccessToast, setTargetSuccessToast] = useState<string>('')

  const openSetTargetModal = (member: Profile) => {
    setTargetModalMember(member)
    setTargetInputX(member.commission_threshold_sar ? String(member.commission_threshold_sar) : '')
    setTargetInputY(member.commission_rate_pct ? String(member.commission_rate_pct) : '')
  }

  const handleSaveTargetAndTier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetModalMember) return
    setSavingTarget(true)

    const numX = Number(targetInputX) || 0
    const numY = Number(targetInputY) || 0

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          commission_threshold_sar: numX,
          commission_rate_pct: numY,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetModalMember.id)

      if (error) throw error

      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === targetModalMember.id
            ? { ...m, commission_threshold_sar: numX, commission_rate_pct: numY }
            : m
        )
      )

      setTargetSuccessToast(`Updated commission target for ${targetModalMember.name}!`)
      setTimeout(() => setTargetSuccessToast(''), 3500)
      setTargetModalMember(null)
    } catch (err: any) {
      alert(err?.message || 'Failed to update commission target')
    } finally {
      setSavingTarget(false)
    }
  }

  // Fetch team profiles if admin
  useEffect(() => {
    if (!isAdmin) return
    async function loadTeam() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['AGENT', 'CHANNEL_PARTNER', 'SALES_MANAGER', 'ADMIN'])
        .order('name', { ascending: true })
      if (data) setTeamMembers(data as Profile[])
    }
    loadTeam()
  }, [supabase, isAdmin])

  // Fetch projects & commissions
  const fetchSalesData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Load projects
      const { data: projData } = await supabase
        .from('projects')
        .select('*')
      if (projData) setProjects(projData as Project[])

      // 2. Query commissions
      // For AGENT, CHANNEL_PARTNER & SALES_MANAGER: strictly isolate to their own agent_id
      // For ADMIN: load all commissions
      const endpoint = isAdmin
        ? '/api/projects/commissions'
        : `/api/projects/commissions?agentId=${encodeURIComponent(profile.id)}`

      const commsRes = await fetch(endpoint)
      const commsData = await commsRes.json()
      if (commsData.commissions) {
        setCommissions(commsData.commissions as ProjectCommission[])
      }
    } catch (err) {
      console.error('Error fetching sales:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, profile.id, isAdmin])

  useEffect(() => {
    fetchSalesData()
  }, [fetchSalesData])

  // Time horizon helper
  const isWithinTimeFilter = useCallback((saleDate: string | null) => {
    if (!saleDate) return false
    if (timeFilter === 'ALL') return true
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const currentMonthPrefix = todayStr.slice(0, 7) // YYYY-MM
    if (timeFilter === 'MONTH') return saleDate.startsWith(currentMonthPrefix)

    if (timeFilter === 'WEEK') {
      const dayOfWeek = now.getDay()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - dayOfWeek)
      const weekStartIso = weekStart.toISOString().split('T')[0]
      return saleDate >= weekStartIso
    }

    if (timeFilter === 'CUSTOM') {
      const dateOnly = saleDate.includes('T') ? saleDate.split('T')[0] : saleDate.slice(0, 10)
      if (customStartDate && dateOnly < customStartDate) return false
      if (customEndDate && dateOnly > customEndDate) return false
      return true
    }

    return true
  }, [timeFilter, customStartDate, customEndDate])

  // Time-filtered commissions list
  const timeFilteredCommissions = useMemo(() => {
    return commissions.filter((c) => isWithinTimeFilter(c.sale_date))
  }, [commissions, isWithinTimeFilter])

  // Executive Team Leaderboard Calculation (For Admin Only)
  const leaderboardData = useMemo(() => {
    if (!isAdmin) return []

    // Filter members by role filter
    const membersToInclude = teamMembers.filter((m) => {
      if (roleFilter === 'AGENT') return m.role === 'AGENT'
      if (roleFilter === 'CHANNEL_PARTNER') return m.role === 'CHANNEL_PARTNER'
      if (roleFilter === 'SALES_MANAGER') return m.role === 'SALES_MANAGER'
      return true
    })

    const rows = membersToInclude.map((member) => {
      const memberDeals = timeFilteredCommissions.filter((c) => c.agent_id === member.id)
      const totalUnits = memberDeals.length
      const totalArea = memberDeals.reduce((sum, c) => sum + Number(c.area_sqm || 0), 0)
      const grossVolume = memberDeals.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)

      const thresholdX = Number(member.commission_threshold_sar || 0)
      const rateY = Number(member.commission_rate_pct || 0)

      let netCommission = 0
      let excessVolume = 0

      if (rateY > 0) {
        if (grossVolume > thresholdX) {
          excessVolume = grossVolume - thresholdX
          netCommission = excessVolume * (rateY / 100)
        } else {
          excessVolume = 0
          netCommission = 0
        }
      } else {
        netCommission = grossVolume
      }

      const progressPct = thresholdX > 0 ? Math.min(100, (grossVolume / thresholdX) * 100) : 100

      return {
        member,
        totalUnits,
        totalArea,
        grossVolume,
        thresholdX,
        rateY,
        netCommission,
        excessVolume,
        progressPct,
      }
    })

    // Search filter
    const searchFiltered = rows.filter((r) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        r.member.name.toLowerCase().includes(q) ||
        r.member.email.toLowerCase().includes(q) ||
        r.member.role.toLowerCase().includes(q)
      )
    })

    // Sort
    return searchFiltered.sort((a, b) => {
      let diff = 0
      if (sortField === 'volume') diff = b.grossVolume - a.grossVolume
      else if (sortField === 'units') diff = b.totalUnits - a.totalUnits
      else if (sortField === 'area') diff = b.totalArea - a.totalArea
      else if (sortField === 'commission') diff = b.netCommission - a.netCommission
      else if (sortField === 'name') diff = a.member.name.localeCompare(b.member.name)
      return sortAsc ? -diff : diff
    })
  }, [isAdmin, teamMembers, roleFilter, timeFilteredCommissions, search, sortField, sortAsc])

  // Company-wide Executive Totals (For Admin & Manager Header)
  const executiveTotals = useMemo(() => {
    const totalVolume = timeFilteredCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)
    const totalArea = timeFilteredCommissions.reduce((sum, c) => sum + Number(c.area_sqm || 0), 0)
    const totalUnits = timeFilteredCommissions.length
    
    // Total commissions distributed across all agents
    const totalCommissions = leaderboardData.reduce((sum, r) => sum + r.netCommission, 0)
    // Company Net Revenue retained after agent commissions
    const companyNetRevenue = Math.max(0, totalVolume - totalCommissions)
    
    // Find top selling agent
    const activeLeader = [...leaderboardData].sort((a, b) => b.grossVolume - a.grossVolume)[0]

    return {
      totalVolume,
      totalArea,
      totalUnits,
      totalCommissions,
      companyNetRevenue,
      topPerformer: activeLeader ? activeLeader.member.name : '—',
      topPerformerVolume: activeLeader ? activeLeader.grossVolume : 0,
    }
  }, [timeFilteredCommissions, leaderboardData])

  // All Transactions Filtered (For Transactions Tab)
  const filteredTransactions = useMemo(() => {
    return timeFilteredCommissions.filter((c) => {
      if (selectedProjectFilter !== 'ALL' && c.project_id !== selectedProjectFilter) return false
      if (selectedAgentFilter !== 'ALL' && c.agent_id !== selectedAgentFilter) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        const project = projects.find((p) => p.id === c.project_id)
        const agent = teamMembers.find((m) => m.id === c.agent_id)
        const matchUnit = (c.unit_name || '').toLowerCase().includes(q)
        const matchBuyer = (c.buyer_name || '').toLowerCase().includes(q)
        const matchProject = project ? project.name_en.toLowerCase().includes(q) : false
        const matchAgent = agent ? agent.name.toLowerCase().includes(q) : false
        const matchNotes = (c.notes || '').toLowerCase().includes(q)
        if (!matchUnit && !matchBuyer && !matchProject && !matchAgent && !matchNotes) return false
      }
      return true
    })
  }, [timeFilteredCommissions, selectedProjectFilter, selectedAgentFilter, search, projects, teamMembers])

  // Paginated Leaderboard
  const paginatedLeaderboard = useMemo(() => {
    const start = (leaderboardPage - 1) * leaderboardPageSize
    return leaderboardData.slice(start, start + leaderboardPageSize)
  }, [leaderboardData, leaderboardPage, leaderboardPageSize])

  // Paginated Transactions
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * transactionPageSize
    return filteredTransactions.slice(start, start + transactionPageSize)
  }, [filteredTransactions, currentPage, transactionPageSize])

  // Personal metrics for logged in user (Used in Personal tab & AGENT/CHANNEL_PARTNER/SALES_MANAGER view)
  const myPersonalDeals = useMemo(() => {
    return timeFilteredCommissions.filter((c) => c.agent_id === profile.id)
  }, [timeFilteredCommissions, profile.id])

  const filteredPersonalDeals = useMemo(() => {
    if (!search.trim()) return myPersonalDeals
    const q = search.trim().toLowerCase()
    return myPersonalDeals.filter((deal) => {
      const project = projects.find((p) => p.id === deal.project_id)
      const matchUnit = (deal.unit_name || '').toLowerCase().includes(q)
      const matchBuyer = (deal.buyer_name || '').toLowerCase().includes(q)
      const matchProject = project ? project.name_en.toLowerCase().includes(q) || project.name_ar.toLowerCase().includes(q) : false
      const matchNotes = (deal.notes || '').toLowerCase().includes(q)
      return matchUnit || matchBuyer || matchProject || matchNotes
    })
  }, [myPersonalDeals, search, projects])

  // Paginated Personal Deals
  const paginatedPersonalDeals = useMemo(() => {
    const start = (personalDealsPage - 1) * personalDealsPageSize
    return filteredPersonalDeals.slice(start, start + personalDealsPageSize)
  }, [filteredPersonalDeals, personalDealsPage, personalDealsPageSize])

  const myThresholdX = Number(profile.commission_threshold_sar || 0)
  const myRateY = Number(profile.commission_rate_pct || 0)

  const myMetrics = useMemo(() => {
    const totalUnitsSold = myPersonalDeals.length
    const totalAreaSqm = myPersonalDeals.reduce((sum, c) => sum + Number(c.area_sqm || 0), 0)
    const totalGrossRevenue = myPersonalDeals.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)

    let netCommissionPayout = 0
    let excessVolume = 0

    if (myRateY > 0) {
      if (totalGrossRevenue > myThresholdX) {
        excessVolume = totalGrossRevenue - myThresholdX
        netCommissionPayout = excessVolume * (myRateY / 100)
      } else {
        excessVolume = 0
        netCommissionPayout = 0
      }
    } else {
      netCommissionPayout = totalGrossRevenue
    }

    const progressPct = myThresholdX > 0 ? Math.min(100, (totalGrossRevenue / myThresholdX) * 100) : 100

    return {
      totalUnitsSold,
      totalAreaSqm,
      totalGrossRevenue,
      netCommissionPayout,
      excessVolume,
      progressPct,
    }
  }, [myPersonalDeals, myThresholdX, myRateY])

  // Jump from Leaderboard row to Transactions filtered to that agent
  const handleInspectAgent = (agentId: string) => {
    setSelectedAgentFilter(agentId)
    setAdminTab('TRANSACTIONS')
    setCurrentPage(1)
  }

  return (
    <SecurityPinGuard
      pinType="commissions"
      customColumnName="sales_admin_password"
      profile={profile}
      title="Admin Password — Sales & Commissions"
      subtitle="Confidential executive compensation and commission ledger. Please enter your administrator security password to proceed."
      backUrl="/dashboard"
      backLabel="Back to Dashboard"
      enabled={isAdmin}
    >
      {({ onLock, onChangePin }) => (
        <div className="page-container" style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
          {/* Top Header */}
          <div
            style={{
              padding: '24px 32px',
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor:
                      profile.role === 'CHANNEL_PARTNER'
                        ? '#FEF3C7'
                        : profile.role === 'SALES_MANAGER'
                        ? '#F3E8FF'
                        : isAdmin
                        ? '#EFF6FF'
                        : '#EFF6FF',
                    color:
                      profile.role === 'CHANNEL_PARTNER'
                        ? '#92400E'
                        : profile.role === 'SALES_MANAGER'
                        ? '#7E22CE'
                        : isAdmin
                        ? '#1D4ED8'
                        : '#1D4ED8',
                    border:
                      profile.role === 'CHANNEL_PARTNER'
                        ? '1px solid #FDE68A'
                        : profile.role === 'SALES_MANAGER'
                        ? '1px solid #E9D5FF'
                        : '1px solid #BFDBFE',
                  }}
                >
                  {profile.role === 'CHANNEL_PARTNER'
                    ? 'Channel Partner Portal'
                    : profile.role === 'SALES_MANAGER'
                    ? 'Sales Manager Portal'
                    : isAdmin
                    ? 'Executive Sales & Commissions'
                    : 'Sales Agent Portal'}
                </span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>• {profile.name}</span>
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Award size={20} />
                </div>
                <span>
                  {isAdmin ? 'Sales & Commission Analytics' : 'My Sales & Commission Ledger'}
                </span>
              </h1>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
                {isAdmin
                  ? 'Real-time sales performance, agent leaderboard, target tier thresholds (X), and calculated commissions.'
                  : 'Track closed unit transactions, total square meters sold, base target threshold progress, and your earned commissions.'}
              </p>
            </div>

            {/* Actions: Time Filter & Admin Security PIN Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {isAdmin && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={onChangePin}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '11.5px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Change Executive Commissions PIN"
                  >
                    <KeyRound size={13} style={{ color: '#6366F1' }} />
                    <span>Change PIN</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLock}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '11.5px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Lock Sales & Commissions Tab"
                  >
                    <Lock size={13} style={{ color: '#EF4444' }} />
                    <span>Lock Tab</span>
                  </button>
                </div>
              )}

              {/* Global Time Filter Horizon */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0', gap: '4px' }}>
                  {(
                    [
                      { id: 'ALL', label: 'All Time' },
                      { id: 'MONTH', label: 'This Month' },
                      { id: 'WEEK', label: 'This Week' },
                      { id: 'CUSTOM', label: 'Custom' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTimeFilter(t.id)
                        setCurrentPage(1)
                        setLeaderboardPage(1)
                        setPersonalDealsPage(1)
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: timeFilter === t.id ? 700 : 500,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: timeFilter === t.id ? '#FFFFFF' : 'transparent',
                        color: timeFilter === t.id ? '#065F46' : '#64748B',
                        boxShadow: timeFilter === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Pickers */}
                {timeFilter === 'CUSTOM' && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #10B981',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
                    }}
                  >
                    <Calendar size={14} style={{ color: '#059669', flexShrink: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>From:</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          setCustomStartDate(e.target.value)
                          setCurrentPage(1)
                          setLeaderboardPage(1)
                          setPersonalDealsPage(1)
                        }}
                        style={{
                          height: '26px',
                          fontSize: '11.5px',
                          padding: '1px 6px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          backgroundColor: '#F8FAFC',
                          color: '#0F172A',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>To:</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => {
                          setCustomEndDate(e.target.value)
                          setCurrentPage(1)
                          setLeaderboardPage(1)
                          setPersonalDealsPage(1)
                        }}
                        style={{
                          height: '26px',
                          fontSize: '11.5px',
                          padding: '1px 6px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          backgroundColor: '#F8FAFC',
                          color: '#0F172A',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    {(customStartDate || customEndDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStartDate('')
                          setCustomEndDate('')
                          setCurrentPage(1)
                          setLeaderboardPage(1)
                          setPersonalDealsPage(1)
                        }}
                        title="Clear custom dates"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94A3B8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

      <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* ========================================================================= */}
        {/* ADMIN EXECUTIVE VIEW                                                      */}
        {/* ========================================================================= */}
        {isAdmin ? (
          <div>
            {/* Executive KPI Cards Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '28px',
              }}
            >
              {/* Card 1: Gross Sales Volume */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                  border: '1px solid #86EFAC',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(22, 101, 52, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Sales Generated
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#166534', marginTop: '6px' }}>
                  SAR {executiveTotals.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px', fontWeight: 500 }}>
                  Combined closed deal volume
                </div>
              </div>

              {/* Card 2: Units Sold */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                  border: '1px solid #BFDBFE',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(30, 64, 175, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Units Sold
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E40AF' }}>
                    <Building2 size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#1E40AF', marginTop: '6px' }}>
                  {executiveTotals.totalUnits} Units
                </div>
                <div style={{ fontSize: '12px', color: '#2563EB', marginTop: '2px', fontWeight: 500 }}>
                  Recorded contract closings
                </div>
              </div>

              {/* Card 3: Total Area Sold */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                  border: '1px solid #FCD34D',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(180, 83, 9, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Area Transacted
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78350F' }}>
                    <Layers size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#78350F', marginTop: '6px' }}>
                  {executiveTotals.totalArea.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²
                </div>
                <div style={{ fontSize: '12px', color: '#92400E', marginTop: '2px', fontWeight: 500 }}>
                  {executiveTotals.totalUnits > 0
                    ? `Avg ${(executiveTotals.totalArea / executiveTotals.totalUnits).toFixed(1)} m² per deal`
                    : '0 m² transacted'}
                </div>
              </div>

              {/* Card 4: Total Commission Payouts */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                  border: '1px solid #10B981',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Commission Payouts
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#065F46' }}>
                    <SaudiRiyalIcon size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#065F46', marginTop: '6px' }}>
                  SAR {executiveTotals.totalCommissions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', color: '#059669', marginTop: '2px', fontWeight: 600 }}>
                  Recognized agent &amp; partner payouts
                </div>
              </div>

              {/* Card 5: Company Net Revenue (Right after commission on top) */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                  border: '2px solid #6366F1',
                  borderRadius: '16px',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Company Net Revenue
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#C7D2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3730A3' }}>
                    <WalletCards size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#312E81', marginTop: '6px' }}>
                  SAR {executiveTotals.companyNetRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', color: '#4F46E5', marginTop: '2px', fontWeight: 600 }}>
                  Brokerage margin retained
                </div>
              </div>
            </div>

            {/* Admin Modern Tab Navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '2px solid #E2E8F0',
                marginBottom: '24px',
              }}
            >
              <button
                type="button"
                onClick={() => setAdminTab('LEADERBOARD')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  fontSize: '13.5px',
                  fontWeight: adminTab === 'LEADERBOARD' ? 800 : 600,
                  color: adminTab === 'LEADERBOARD' ? '#059669' : '#64748B',
                  border: 'none',
                  borderBottom: adminTab === 'LEADERBOARD' ? '3px solid #059669' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Users size={16} />
                <span>Team Leaderboard &amp; Commission Table</span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: adminTab === 'LEADERBOARD' ? '#DCFCE7' : '#F1F5F9',
                    color: adminTab === 'LEADERBOARD' ? '#166534' : '#64748B',
                    fontWeight: 700,
                  }}
                >
                  {teamMembers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('TRANSACTIONS')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  fontSize: '13.5px',
                  fontWeight: adminTab === 'TRANSACTIONS' ? 800 : 600,
                  color: adminTab === 'TRANSACTIONS' ? '#059669' : '#64748B',
                  border: 'none',
                  borderBottom: adminTab === 'TRANSACTIONS' ? '3px solid #059669' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.15s ease',
                }}
              >
                <FileSpreadsheet size={16} />
                <span>All Closed Transactions</span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: adminTab === 'TRANSACTIONS' ? '#DCFCE7' : '#F1F5F9',
                    color: adminTab === 'TRANSACTIONS' ? '#166534' : '#64748B',
                    fontWeight: 700,
                  }}
                >
                  {timeFilteredCommissions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAdminTab('MY_SALES')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  fontSize: '13.5px',
                  fontWeight: adminTab === 'MY_SALES' ? 800 : 600,
                  color: adminTab === 'MY_SALES' ? '#059669' : '#64748B',
                  border: 'none',
                  borderBottom: adminTab === 'MY_SALES' ? '3px solid #059669' : '3px solid transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.15s ease',
                }}
              >
                <User size={16} />
                <span>My Personal Deals</span>
                {myPersonalDeals.length > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      backgroundColor: adminTab === 'MY_SALES' ? '#DCFCE7' : '#F1F5F9',
                      color: adminTab === 'MY_SALES' ? '#166534' : '#64748B',
                      fontWeight: 700,
                    }}
                  >
                    {myPersonalDeals.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: TEAM LEADERBOARD & COMMISSION TABLE */}
            {adminTab === 'LEADERBOARD' && (
              <div
                className="card"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  padding: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Table Header Filter Toolbar */}
                <div
                  style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    backgroundColor: '#FAFAFA',
                  }}
                >
                  {/* Left: Role Filter Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Filter Role:
                    </span>
                    {(
                      [
                        { id: 'ALL', label: 'All Roles' },
                        { id: 'AGENT', label: 'Sales Agents' },
                        { id: 'CHANNEL_PARTNER', label: 'Channel Partners' },
                        { id: 'SALES_MANAGER', label: 'Sales Managers' },
                      ] as const
                    ).map((rf) => (
                      <button
                        key={rf.id}
                        type="button"
                        onClick={() => {
                          setRoleFilter(rf.id)
                          setLeaderboardPage(1)
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: roleFilter === rf.id ? 700 : 500,
                          border: roleFilter === rf.id ? '1px solid #10B981' : '1px solid #CBD5E1',
                          backgroundColor: roleFilter === rf.id ? '#ECFDF5' : '#FFFFFF',
                          color: roleFilter === rf.id ? '#065F46' : '#475569',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {rf.label}
                      </button>
                    ))}
                  </div>

                  {/* Right: Search & Sort */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input
                        type="text"
                        placeholder="Search member by name..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value)
                          setLeaderboardPage(1)
                        }}
                        className="form-input"
                        style={{ height: '34px', fontSize: '12.5px', paddingLeft: '32px', width: '220px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Sort:</span>
                      <select
                        value={sortField}
                        onChange={(e) => {
                          setSortField(e.target.value as SortField)
                          setLeaderboardPage(1)
                        }}
                        className="form-select"
                        style={{ height: '34px', fontSize: '12px', fontWeight: 600, paddingRight: '28px' }}
                      >
                        <option value="volume">Highest Sales Volume</option>
                        <option value="commission">Highest Commission</option>
                        <option value="units">Most Units Sold</option>
                        <option value="area">Most Area Sold (m²)</option>
                        <option value="name">Member Name</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setSortAsc(!sortAsc)
                          setLeaderboardPage(1)
                        }}
                        title={sortAsc ? 'Ascending' : 'Descending'}
                        style={{
                          height: '34px',
                          width: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          backgroundColor: '#FFFFFF',
                          cursor: 'pointer',
                          color: '#475569',
                        }}
                      >
                        <ArrowUpDown size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Leaderboard Table Content */}
                {loading ? (
                  <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748B' }}>
                    <Clock size={28} style={{ margin: '0 auto 10px', animation: 'spin 1.5s linear infinite' }} />
                    <div style={{ fontWeight: 600 }}>Calculating team commissions and performance metrics...</div>
                  </div>
                ) : leaderboardData.length === 0 ? (
                  <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748B' }}>
                    <Users size={36} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#334155', margin: '0 0 4px' }}>
                      No matching team members found
                    </h3>
                    <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: 0 }}>
                      Try adjusting your search criteria or role filters above.
                    </p>
                  </div>
                ) : (
                  <div style={{ width: '100%', overflowX: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr
                          style={{
                            backgroundColor: '#F8FAFC',
                            borderBottom: '2px solid #E2E8F0',
                            color: '#475569',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          <th style={{ padding: '10px 6px', textAlign: 'center', width: '38px' }}>#</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: '21%' }}>Team Member &amp; Role</th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', width: '8%' }}>Units Sold</th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', width: '8%' }}>Total Area</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', width: '12%' }}>Gross Volume</th>
                          <th style={{ padding: '10px 6px', textAlign: 'right', width: '11%' }}>Base Target (X)</th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', width: '8%' }}>Tier (Y%)</th>
                          <th style={{ padding: '10px 6px', textAlign: 'left', width: '10%' }}>Target Progress</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', width: '11%' }}>Net Commission</th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', width: '11%' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLeaderboard.map((row, idx) => {
                          const globalIdx = (leaderboardPage - 1) * leaderboardPageSize + idx
                          const isTop3 = globalIdx < 3 && row.grossVolume > 0
                          const rankIcon =
                            globalIdx === 0 && row.grossVolume > 0
                              ? '🥇'
                              : globalIdx === 1 && row.grossVolume > 0
                              ? '🥈'
                              : globalIdx === 2 && row.grossVolume > 0
                              ? '🥉'
                              : `${globalIdx + 1}`

                          const initials = row.member.name
                            ? row.member.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            : 'U'

                          return (
                            <tr
                              key={row.member.id}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: isTop3 ? 'rgba(240, 253, 244, 0.35)' : 'transparent',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC')}
                              onMouseLeave={(e) =>
                                ((e.currentTarget as HTMLElement).style.backgroundColor = isTop3
                                  ? 'rgba(240, 253, 244, 0.35)'
                                  : 'transparent')
                              }
                            >
                              {/* Rank */}
                              <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: isTop3 ? '15px' : '12px', color: '#64748B' }}>
                                {rankIcon}
                              </td>

                              {/* Member & Role */}
                              <td style={{ padding: '10px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      background:
                                        row.member.role === 'CHANNEL_PARTNER'
                                          ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                                          : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                                      color: '#FFFFFF',
                                      fontWeight: 800,
                                      fontSize: '11px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {initials}
                                  </div>
                                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {row.member.name}
                                    </div>
                                    <div style={{ marginTop: '1px' }}>
                                      <span
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          backgroundColor:
                                            row.member.role === 'CHANNEL_PARTNER'
                                              ? '#FEF3C7'
                                              : row.member.role === 'SALES_MANAGER'
                                              ? '#F3E8FF'
                                              : row.member.role === 'ADMIN'
                                              ? '#E2E8F0'
                                              : '#DBEAFE',
                                          color:
                                            row.member.role === 'CHANNEL_PARTNER'
                                              ? '#92400E'
                                              : row.member.role === 'SALES_MANAGER'
                                              ? '#6B21A8'
                                              : row.member.role === 'ADMIN'
                                              ? '#334155'
                                              : '#1E40AF',
                                        }}
                                      >
                                        {row.member.role === 'CHANNEL_PARTNER'
                                          ? 'Partner'
                                          : row.member.role === 'SALES_MANAGER'
                                          ? 'Manager'
                                          : row.member.role === 'ADMIN'
                                          ? 'Admin'
                                          : 'Agent'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Units Sold */}
                              <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    borderRadius: '5px',
                                    backgroundColor: row.totalUnits > 0 ? '#EFF6FF' : '#F1F5F9',
                                    color: row.totalUnits > 0 ? '#1D4ED8' : '#94A3B8',
                                    fontWeight: 700,
                                    fontSize: '11.5px',
                                  }}
                                >
                                  <Building2 size={11} />
                                  {row.totalUnits} {row.totalUnits === 1 ? 'Unit' : 'Units'}
                                </span>
                              </td>

                              {/* Total Area */}
                              <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '5px',
                                    backgroundColor: row.totalArea > 0 ? '#FEF3C7' : '#F8FAFC',
                                    color: row.totalArea > 0 ? '#92400E' : '#94A3B8',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                  }}
                                >
                                  {row.totalArea.toFixed(1)} m²
                                </span>
                              </td>

                              {/* Gross Volume */}
                              <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: '#0F172A', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                SAR {row.grossVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* Base Target Threshold X */}
                              <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => openSetTargetModal(row.member)}
                                  title="Click to configure Base Target X"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'right',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    transition: 'background-color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#EFF6FF')}
                                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                                >
                                  {row.thresholdX > 0 ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                                      <span style={{ color: '#1E40AF', fontWeight: 800, fontSize: '12px' }}>
                                        SAR {row.thresholdX.toLocaleString('en-US')}
                                      </span>
                                      <span style={{ fontSize: '10px', color: '#3B82F6' }}>✎</span>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#0284C7', fontWeight: 700, fontSize: '11px', textDecoration: 'underline' }}>
                                      + Set Target
                                    </span>
                                  )}
                                </button>
                              </td>

                              {/* Tier Rate Y% */}
                              <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => openSetTargetModal(row.member)}
                                  title="Click to configure Tier Rate Y%"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px',
                                  }}
                                >
                                  {row.rateY > 0 ? (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        padding: '2px 6px',
                                        borderRadius: '5px',
                                        backgroundColor: '#ECFDF5',
                                        color: '#047857',
                                        fontWeight: 800,
                                        fontSize: '11.5px',
                                        border: '1px solid #A7F3D0',
                                      }}
                                    >
                                      <span>{row.rateY}%</span>
                                      <span style={{ fontSize: '9px' }}>✎</span>
                                    </span>
                                  ) : (
                                    <span style={{ color: '#059669', fontWeight: 700, fontSize: '11px', textDecoration: 'underline' }}>
                                      + Set %
                                    </span>
                                  )}
                                </button>
                              </td>

                              {/* Target Progress Bar */}
                              <td style={{ padding: '10px 6px' }}>
                                {row.thresholdX > 0 ? (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '3px' }}>
                                      <span style={{ fontWeight: 700, color: row.progressPct >= 100 ? '#059669' : '#D97706' }}>
                                        {row.progressPct >= 100 ? '✓ 100% Met' : `${row.progressPct.toFixed(0)}%`}
                                      </span>
                                    </div>
                                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          width: `${row.progressPct}%`,
                                          height: '100%',
                                          backgroundColor: row.progressPct >= 100 ? '#10B981' : '#F59E0B',
                                          borderRadius: '4px',
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Unrestricted</span>
                                )}
                              </td>

                              {/* Net Commission */}
                              <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    backgroundColor: row.netCommission > 0 ? '#ECFDF5' : '#F8FAFC',
                                    color: row.netCommission > 0 ? '#065F46' : '#94A3B8',
                                    fontWeight: 900,
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  SAR {row.netCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>

                              {/* Action */}
                              <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => openSetTargetModal(row.member)}
                                    className="btn-secondary"
                                    style={{
                                      padding: '4px 7px',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      borderRadius: '5px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      cursor: 'pointer',
                                      backgroundColor: '#EFF6FF',
                                      color: '#1D4ED8',
                                      border: '1px solid #BFDBFE',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Set Base Target & Tier Rate"
                                  >
                                    <Target size={11} color="#1D4ED8" />
                                    <span>Target</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleInspectAgent(row.member.id)}
                                    className="btn-secondary"
                                    style={{
                                      padding: '4px 7px',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      borderRadius: '5px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span>Deals</span>
                                    <ArrowUpRight size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Leaderboard Pagination with Custom Selectable Page Size */}
                {leaderboardData.length > 0 && (
                  <div style={{ borderTop: '1px solid #F1F5F9' }}>
                    <Pagination
                      currentPage={leaderboardPage}
                      totalItems={leaderboardData.length}
                      pageSize={leaderboardPageSize}
                      onPageChange={setLeaderboardPage}
                      onPageSizeChange={(newSize) => {
                        setLeaderboardPageSize(newSize)
                        setLeaderboardPage(1)
                      }}
                      pageSizeOptions={[5, 10, 20, 50, 100]}
                      scrollToTop={false}
                      itemLabel={
                        roleFilter === 'AGENT'
                          ? 'agents'
                          : roleFilter === 'CHANNEL_PARTNER'
                          ? 'partners'
                          : roleFilter === 'SALES_MANAGER'
                          ? 'sales managers'
                          : 'team members'
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ALL CLOSED TRANSACTIONS STREAM */}
            {adminTab === 'TRANSACTIONS' && (
              <div
                className="card"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  padding: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Table Filter Toolbar */}
                <div
                  style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    backgroundColor: '#FAFAFA',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Closed Sales Transactions Ledger
                    </h2>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                      ({filteredTransactions.length} records)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Project Filter */}
                    <select
                      value={selectedProjectFilter}
                      onChange={(e) => {
                        setSelectedProjectFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="form-select"
                      style={{ height: '34px', fontSize: '12px', fontWeight: 600 }}
                    >
                      <option value="ALL">All Projects</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name_en}
                        </option>
                      ))}
                    </select>

                    {/* Agent Filter */}
                    <select
                      value={selectedAgentFilter}
                      onChange={(e) => {
                        setSelectedAgentFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="form-select"
                      style={{ height: '34px', fontSize: '12px', fontWeight: 600 }}
                    >
                      <option value="ALL">All Agents / Partners</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role === 'CHANNEL_PARTNER' ? 'Partner' : m.role})
                        </option>
                      ))}
                    </select>

                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input
                        type="text"
                        placeholder="Search unit, buyer..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="form-input"
                        style={{ height: '34px', fontSize: '12px', paddingLeft: '32px', width: '180px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Table Content */}
                {loading ? (
                  <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748B' }}>
                    <Clock size={28} style={{ margin: '0 auto 10px', animation: 'spin 1.5s linear infinite' }} />
                    <div style={{ fontWeight: 600 }}>Loading transactions...</div>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748B' }}>
                    <Award size={36} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#334155', margin: '0 0 4px' }}>
                      No transactions recorded
                    </h3>
                    <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: 0 }}>
                      Sales recorded via Project details modal will automatically reflect here.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border)', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Sale Date</th>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Project</th>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Unit / Layout</th>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Sold By (Agent)</th>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Purchasing Client</th>
                          <th style={{ padding: '12px 18px', textAlign: 'center' }}>Area (m²)</th>
                          <th style={{ padding: '12px 18px', textAlign: 'right' }}>Deal Commission</th>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((deal, idx) => {
                          const project = projects.find((p) => p.id === deal.project_id)
                          const agent = teamMembers.find((m) => m.id === deal.agent_id)
                          return (
                            <tr
                              key={deal.id}
                              style={{
                                borderBottom: idx === paginatedTransactions.length - 1 ? 'none' : '1px solid #F1F5F9',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                            >
                              <td style={{ padding: '12px 18px', whiteSpace: 'nowrap', color: '#475569', fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Calendar size={13} color="#059669" />
                                  <span>{deal.sale_date || '—'}</span>
                                </div>
                              </td>

                              <td style={{ padding: '12px 18px' }}>
                                <div style={{ fontWeight: 700, color: '#0F172A' }}>{project ? project.name_en : '—'}</div>
                                {project?.city_en && <div style={{ fontSize: '11px', color: '#64748B' }}>{project.city_en}</div>}
                              </td>

                              <td style={{ padding: '12px 18px', fontWeight: 700, color: '#1E40AF' }}>
                                {deal.unit_name}
                              </td>

                              <td style={{ padding: '12px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      backgroundColor: '#EFF6FF',
                                      color: '#1D4ED8',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {agent?.name ? agent.name[0].toUpperCase() : 'A'}
                                  </div>
                                  <span style={{ fontWeight: 600, color: '#334155' }}>
                                    {agent?.name || 'Assigned Agent'}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: '12px 18px', color: '#334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <User size={13} color="#94A3B8" />
                                  <span>{deal.buyer_name || '—'}</span>
                                </div>
                              </td>

                              <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                {deal.area_sqm ? (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#FEF3C7',
                                      color: '#92400E',
                                      fontWeight: 700,
                                      fontSize: '11.5px',
                                    }}
                                  >
                                    {Number(deal.area_sqm).toFixed(0)} m²
                                  </span>
                                ) : (
                                  <span style={{ color: '#CBD5E1' }}>—</span>
                                )}
                              </td>

                              <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#065F46' }}>
                                SAR {Number(deal.commission_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td style={{ padding: '12px 18px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {deal.notes || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {filteredTransactions.length > 0 && (
                  <div style={{ borderTop: '1px solid #F1F5F9' }}>
                    <Pagination
                      currentPage={currentPage}
                      totalItems={filteredTransactions.length}
                      pageSize={transactionPageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(newSize) => {
                        setTransactionPageSize(newSize)
                        setCurrentPage(1)
                      }}
                      pageSizeOptions={[10, 15, 25, 50, 100]}
                      scrollToTop={false}
                      itemLabel="transactions"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MY PERSONAL DEALS (FOR ADMIN / MANAGER) */}
            {adminTab === 'MY_SALES' && (
              <div>
                {/* Personal KPI Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                  }}
                >
                  <div className="card" style={{ padding: '20px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase' }}>My Units Sold</span>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#1E40AF', marginTop: '6px' }}>{myMetrics.totalUnitsSold} Units</div>
                  </div>
                  <div className="card" style={{ padding: '20px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400E', textTransform: 'uppercase' }}>My Total Area</span>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#78350F', marginTop: '6px' }}>{myMetrics.totalAreaSqm.toFixed(1)} m²</div>
                  </div>
                  <div className="card" style={{ padding: '20px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>My Gross Sales</span>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#166534', marginTop: '6px' }}>SAR {myMetrics.totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="card" style={{ padding: '20px', background: '#ECFDF5', border: '2px solid #10B981', borderRadius: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>My Earned Commission</span>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#065F46', marginTop: '6px' }}>SAR {myMetrics.netCommissionPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

                {/* Personal Deals Table */}
                <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', padding: 0 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 800, fontSize: '15px' }}>
                    My Recorded Deals ({myPersonalDeals.length})
                  </div>
                  {myPersonalDeals.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B' }}>
                      <Award size={36} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                      <div style={{ fontWeight: 600 }}>No personal deals recorded for your account</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border)', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Sale Date</th>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Unit / Layout</th>
                          <th style={{ padding: '12px 18px', textAlign: 'left' }}>Buyer</th>
                          <th style={{ padding: '12px 18px', textAlign: 'center' }}>Area (m²)</th>
                          <th style={{ padding: '12px 18px', textAlign: 'right' }}>Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myPersonalDeals.map((deal) => (
                          <tr key={deal.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px 18px', color: '#475569' }}>{deal.sale_date}</td>
                            <td style={{ padding: '12px 18px', fontWeight: 700, color: '#1E40AF' }}>{deal.unit_name}</td>
                            <td style={{ padding: '12px 18px' }}>{deal.buyer_name}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>
                                {Number(deal.area_sqm || 0).toFixed(0)} m²
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#065F46' }}>
                              SAR {Number(deal.commission_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* REGULAR AGENT / CHANNEL PARTNER VIEW (STRICT DATA PRIVACY & ISOLATION)   */
          /* ========================================================================= */
          <div>
            {/* KPI Metric Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {/* Card 1: Units Sold */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                  border: '1px solid #BFDBFE',
                  borderRadius: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Units / Layouts Sold
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E40AF' }}>
                    <Building2 size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#1E40AF', marginTop: '6px' }}>
                  {myMetrics.totalUnitsSold} Units
                </div>
                <div style={{ fontSize: '12px', color: '#2563EB', marginTop: '2px', fontWeight: 500 }}>
                  Recorded closed properties
                </div>
              </div>

              {/* Card 2: Total Area Sold (m²) */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                  border: '1px solid #FCD34D',
                  borderRadius: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Area Sold
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78350F' }}>
                    <Layers size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#78350F', marginTop: '6px' }}>
                  {myMetrics.totalAreaSqm.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²
                </div>
                <div style={{ fontSize: '12px', color: '#92400E', marginTop: '2px', fontWeight: 500 }}>
                  {myMetrics.totalUnitsSold > 0 ? `Avg ${(myMetrics.totalAreaSqm / myMetrics.totalUnitsSold).toFixed(1)} m² per deal` : '0 m² recorded'}
                </div>
              </div>

              {/* Card 3: Gross Volume Generated */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                  border: '1px solid #86EFAC',
                  borderRadius: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Gross Sales Generated
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#166534', marginTop: '6px' }}>
                  SAR {myMetrics.totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px', fontWeight: 500 }}>
                  Total brokerage deal volume
                </div>
              </div>

              {/* Card 4: Net Commission Payout */}
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                  border: '2px solid #10B981',
                  borderRadius: '16px',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    My Commission Payout
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#065F46' }}>
                    <SaudiRiyalIcon size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#065F46', marginTop: '6px' }}>
                  SAR {myMetrics.netCommissionPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', color: '#059669', marginTop: '2px', fontWeight: 600 }}>
                  {myRateY > 0 ? `${myRateY}% share on volume above target` : 'Full recognized commission'}
                </div>
              </div>
            </div>

            {/* Target Progress Bar */}
            {myThresholdX > 0 && (
              <div
                className="card"
                style={{
                  padding: '18px 24px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} color="#059669" />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                      Commission Target Progress (Threshold X: SAR {myThresholdX.toLocaleString('en-US')} · Tier Y: {myRateY}%)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: myMetrics.progressPct >= 100 ? '#059669' : '#D97706' }}>
                    {myMetrics.progressPct >= 100
                      ? `🎉 100% Target Met! Excess Volume: SAR ${myMetrics.excessVolume.toLocaleString('en-US')}`
                      : `${myMetrics.progressPct.toFixed(1)}% Completed (SAR ${(myThresholdX - myMetrics.totalGrossRevenue).toLocaleString('en-US')} to unlock)`}
                  </div>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: '10px',
                    backgroundColor: '#E2E8F0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${myMetrics.progressPct}%`,
                      height: '100%',
                      background:
                        myMetrics.progressPct >= 100
                          ? 'linear-gradient(90deg, #10B981 0%, #059669 100%)'
                          : 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
                      borderRadius: '8px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Personal Deals Table */}
            <div
              className="card"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                overflow: 'hidden',
                padding: 0,
              }}
            >
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Recorded Unit Sales Ledger
                  </h2>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                    ({filteredPersonalDeals.length} record{filteredPersonalDeals.length === 1 ? '' : 's'})
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search unit, buyer, or project..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPersonalDealsPage(1)
                    }}
                    className="form-input"
                    style={{ height: '34px', fontSize: '12.5px', paddingLeft: '32px', width: '220px' }}
                  />
                </div>
              </div>

              {loading ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748B' }}>
                  <Clock size={28} style={{ margin: '0 auto 10px', animation: 'spin 1.5s linear infinite' }} />
                  <div style={{ fontWeight: 600 }}>Loading recorded transactions...</div>
                </div>
              ) : filteredPersonalDeals.length === 0 ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748B' }}>
                  <Award size={36} color="#CBD5E1" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#334155', margin: '0 0 4px' }}>
                    No recorded sales in this timeframe
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: 0 }}>
                    Transactions recorded by Administration or Sales Managers will automatically appear in this ledger.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border)', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 18px', textAlign: 'left' }}>Sale Date</th>
                        <th style={{ padding: '12px 18px', textAlign: 'left' }}>Project</th>
                        <th style={{ padding: '12px 18px', textAlign: 'left' }}>Unit / Layout</th>
                        <th style={{ padding: '12px 18px', textAlign: 'center' }}>Area (m²)</th>
                        <th style={{ padding: '12px 18px', textAlign: 'left' }}>Purchasing Client</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>Deal Commission</th>
                        <th style={{ padding: '12px 18px', textAlign: 'left' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPersonalDeals.map((deal, idx) => {
                        const project = projects.find((p) => p.id === deal.project_id)
                        return (
                          <tr
                            key={deal.id}
                            style={{
                              borderBottom: idx === paginatedPersonalDeals.length - 1 ? 'none' : '1px solid #F1F5F9',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#F8FAFC')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '12px 18px', whiteSpace: 'nowrap', color: '#475569', fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={13} color="#059669" />
                                <span>{deal.sale_date || '—'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 18px' }}>
                              <div style={{ fontWeight: 700, color: '#0F172A' }}>{project ? project.name_en : '—'}</div>
                              {project?.city_en && <div style={{ fontSize: '11px', color: '#64748B' }}>{project.city_en}</div>}
                            </td>
                            <td style={{ padding: '12px 18px', fontWeight: 700, color: '#1E40AF' }}>
                              {deal.unit_name}
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                              {deal.area_sqm ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: '#FEF3C7',
                                    color: '#92400E',
                                    fontWeight: 700,
                                    fontSize: '11.5px',
                                  }}
                                >
                                  {Number(deal.area_sqm).toFixed(0)} m²
                                </span>
                              ) : (
                                <span style={{ color: '#CBD5E1' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 18px', color: '#334155' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={13} color="#94A3B8" />
                                <span>{deal.buyer_name || '—'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#065F46' }}>
                              SAR {Number(deal.commission_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '12px 18px', color: '#64748B' }}>
                              {deal.notes || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Personal Deals Pagination with Custom Selectable Page Size */}
              {filteredPersonalDeals.length > 0 && (
                <div style={{ borderTop: '1px solid #F1F5F9' }}>
                  <Pagination
                    currentPage={personalDealsPage}
                    totalItems={filteredPersonalDeals.length}
                    pageSize={personalDealsPageSize}
                    onPageChange={setPersonalDealsPage}
                    onPageSizeChange={(newSize) => {
                      setPersonalDealsPageSize(newSize)
                      setPersonalDealsPage(1)
                    }}
                    pageSizeOptions={[5, 10, 20, 50, 100]}
                    scrollToTop={false}
                    itemLabel="deals"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: SET TARGET & TIER FORMULA */}
      {targetModalMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setTargetModalMember(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Target size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Set Commission Target &amp; Tier
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Configuring target for <strong>{targetModalMember.name}</strong> ({targetModalMember.role === 'CHANNEL_PARTNER' ? 'Channel Partner' : 'Sales Agent'})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTargetModalMember(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTargetAndTier}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Formula Card Explainer */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    fontSize: '12.5px',
                    color: '#166534',
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: '2px' }}>📐 Commission Calculation Rule:</div>
                  <div>
                    Commission payout = <strong>(Total Deal Volume − Base Target X) × Tier Rate Y%</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px' }}>
                    * If total volume is below Base Target X, payout remains SAR 0.00 until the threshold is unlocked.
                  </div>
                </div>

                {/* Input 1: Base Target (Threshold X in SAR) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                      Base Target Threshold (X)
                    </label>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>In Saudi Riyal (SAR)</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#64748B', fontSize: '12px' }}>
                      SAR
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0 (Commission starts on deal 1)"
                      value={targetInputX}
                      onChange={(e) => setTargetInputX(e.target.value)}
                      className="form-input"
                      style={{ height: '42px', paddingLeft: '48px', fontSize: '14px', fontWeight: 700 }}
                    />
                  </div>
                  {/* Quick Suggestion Chips */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#94A3B8', alignSelf: 'center' }}>Presets:</span>
                    {[
                      { label: 'SAR 0 (Immediate)', val: '0' },
                      { label: 'SAR 50K', val: '50000' },
                      { label: 'SAR 100K', val: '100000' },
                      { label: 'SAR 150K', val: '150000' },
                      { label: 'SAR 200K', val: '200000' },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setTargetInputX(p.val)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: '1px solid #E2E8F0',
                          backgroundColor: targetInputX === p.val ? '#EFF6FF' : '#FFFFFF',
                          color: targetInputX === p.val ? '#1D4ED8' : '#64748B',
                          cursor: 'pointer',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input 2: Commission Tier Rate (Y in %) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                      Commission Tier Share (Y%)
                    </label>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Percentage on excess volume</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.05"
                      placeholder="e.g. 2.50"
                      value={targetInputY}
                      onChange={(e) => setTargetInputY(e.target.value)}
                      className="form-input"
                      style={{ height: '42px', paddingRight: '36px', fontSize: '14px', fontWeight: 700 }}
                    />
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#059669', fontSize: '14px' }}>
                      %
                    </span>
                  </div>
                  {/* Quick Suggestion Chips */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#94A3B8', alignSelf: 'center' }}>Presets:</span>
                    {['1.5', '2.0', '2.5', '3.0', '5.0', '10.0', '15.0', '25.0'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTargetInputY(p)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: '1px solid #E2E8F0',
                          backgroundColor: targetInputY === p ? '#ECFDF5' : '#FFFFFF',
                          color: targetInputY === p ? '#065F46' : '#64748B',
                          cursor: 'pointer',
                        }}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Interactive Calculation Preview */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    💡 Live Simulation (Example on SAR 150,000 Volume):
                  </div>
                  {(() => {
                    const testVol = 150000
                    const tX = Number(targetInputX) || 0
                    const tY = Number(targetInputY) || 0
                    const excess = Math.max(0, testVol - tX)
                    const payout = tY > 0 ? excess * (tY / 100) : testVol
                    return (
                      <div style={{ color: '#475569', lineHeight: 1.5 }}>
                        • Target Threshold (X): <strong>SAR {tX.toLocaleString('en-US')}</strong>
                        <br />
                        • Excess eligible volume: <strong>SAR {excess.toLocaleString('en-US')}</strong>
                        <br />
                        • Net Payout at {tY}%: <strong style={{ color: '#059669', fontSize: '13px' }}>SAR {payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: '#F8FAFC',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTargetModalMember(null)}
                  className="btn btn-outline"
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTarget}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 22px',
                    fontSize: '13px',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  {savingTarget ? 'Saving Target...' : 'Save Target & Tier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {targetSuccessToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: '#065F46',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 700,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle2 size={16} color="#6EE7B7" />
          <span>{targetSuccessToast}</span>
        </div>
      )}
        </div>
      )}
    </SecurityPinGuard>
  )
}
