'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  WalletCards,
  Plus,
  Search,
  Download,
  FileText,
  TrendingUp,
  Receipt,
  CheckCircle,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
  Layers,
  ShieldAlert,
  Info,
  Calendar,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  RotateCcw,
  Building2,
  CreditCard,
  Banknote,
  PieChart,
  Repeat,
  LayoutGrid,
  Table as TableIcon,
  Lock,
} from 'lucide-react'
import type { Profile } from '@/types/database'
import { Expense, ExpenseCategory, ExpenseCostCenter, ExpensePaymentMethod, ExpenseStatus, ExpenseSummaryStats } from '@/types/expense'
import { saveExpense, deleteExpense } from '@/lib/expenseService'
import RecordExpenseModal from './RecordExpenseModal'
import FinancialReportModal from './FinancialReportModal'
import Pagination from '@/components/Pagination'

interface Props {
  currentProfile: Profile
  initialExpenses: Expense[]
}

const CATEGORY_COLORS: Record<string, string> = {
  'Office Expenses': '#3B82F6',
  'Fuel & Fleet': '#F59E0B',
  'Payroll & Broker Splits': '#10B981',
  'Portals & Digital Ads': '#8B5CF6',
  'VIP & Investor Hospitality': '#EC4899',
  'Government, REGA & Balady': '#6366F1',
  'Utilities & Telecom': '#14B8A6',
  'IT & Software Tools': '#06B6D4',
  'Legal & Professional': '#F97316',
  'Miscellaneous': '#64748B',
}

const COST_CENTERS: ExpenseCostCenter[] = [
  'Jeddah HQ',
  'Marketing & Lead Gen',
  'Sales & Client Relations',
  'Executive & Investment',
  'Compliance & Legal',
  'General Brokerage',
  'Executive Fleet',
]

export default function ExpensesClient({ currentProfile, initialExpenses }: Props) {
  // Strict Admin Defense
  if (currentProfile?.role !== 'ADMIN') {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
          <Lock size={24} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Restricted Access</h2>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '8px', lineHeight: 1.5 }}>
          The Brokerage Expense Ledger and Financial Analytics are strictly restricted to <strong>ADMIN</strong> roles.
        </p>
        <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#4F46E5',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Return to Dashboard
        </a>
      </div>
    )
  }

  // Master state
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    if (initialExpenses && initialExpenses.length > 0) return initialExpenses
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('asaheeb_crm_expenses_v1')
      if (raw) {
        try {
          return JSON.parse(raw)
        } catch {
          // ignore
        }
      }
    }
    return []
  })

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'analytics' | 'register'>('analytics')

  // Mobile View Mode Switcher for Register: 'table' vs 'cards'
  const [registerViewMode, setRegisterViewMode] = useState<'table' | 'cards'>('table')

  // Analytics Filter States
  const [periodPreset, setPeriodPreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'LAST_6_MONTHS' | 'CUSTOM'>('ALL')
  const [analyticsStartDate, setAnalyticsStartDate] = useState<string>('')
  const [analyticsEndDate, setAnalyticsEndDate] = useState<string>('')
  const [analyticsCostCenter, setAnalyticsCostCenter] = useState<string>('ALL')
  const [analyticsRecurring, setAnalyticsRecurring] = useState<'ALL' | 'RECURRING' | 'ONE_TIME'>('ALL')
  const [selectedBarMonth, setSelectedBarMonth] = useState<string | null>(null)

  // Register Table Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedCostCenter, setSelectedCostCenter] = useState('ALL')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [registerMonthFilter, setRegisterMonthFilter] = useState('ALL')
  const [selectedRecurring, setSelectedRecurring] = useState<'ALL' | 'RECURRING' | 'ONE_TIME'>('ALL')

  // Pagination for Register
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isFinancialReportOpen, setIsFinancialReportOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Reset pagination when register filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory, selectedCostCenter, selectedPaymentMethod, selectedStatus, registerMonthFilter, selectedRecurring])

  // Helper date calculations for analytics presets
  const dateRanges = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    const thisMonthStart = new Date(currentYear, currentMonth, 1)
    const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0)

    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1)
    const lastMonthEnd = new Date(currentYear, currentMonth, 0)

    const last3Start = new Date(currentYear, currentMonth - 2, 1)
    const last6Start = new Date(currentYear, currentMonth - 5, 1)

    return {
      thisMonth: { start: formatDate(thisMonthStart), end: formatDate(thisMonthEnd) },
      lastMonth: { start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd) },
      last3Months: { start: formatDate(last3Start), end: formatDate(thisMonthEnd) },
      last6Months: { start: formatDate(last6Start), end: formatDate(thisMonthEnd) },
    }
  }, [])

  // Filtered dataset for ANALYTICS
  const analyticsExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (analyticsCostCenter !== 'ALL' && item.cost_center !== analyticsCostCenter) return false
      if (analyticsRecurring === 'RECURRING' && !item.is_recurring) return false
      if (analyticsRecurring === 'ONE_TIME' && item.is_recurring) return false

      if (!item.expense_date) return true

      if (periodPreset === 'THIS_MONTH') {
        return item.expense_date >= dateRanges.thisMonth.start && item.expense_date <= dateRanges.thisMonth.end
      }
      if (periodPreset === 'LAST_MONTH') {
        return item.expense_date >= dateRanges.lastMonth.start && item.expense_date <= dateRanges.lastMonth.end
      }
      if (periodPreset === 'LAST_3_MONTHS') {
        return item.expense_date >= dateRanges.last3Months.start && item.expense_date <= dateRanges.last3Months.end
      }
      if (periodPreset === 'LAST_6_MONTHS') {
        return item.expense_date >= dateRanges.last6Months.start && item.expense_date <= dateRanges.last6Months.end
      }
      if (periodPreset === 'CUSTOM') {
        if (analyticsStartDate && item.expense_date < analyticsStartDate) return false
        if (analyticsEndDate && item.expense_date > analyticsEndDate) return false
      }

      return true
    })
  }, [expenses, analyticsCostCenter, analyticsRecurring, periodPreset, analyticsStartDate, analyticsEndDate, dateRanges])

  // Filtered dataset for REGISTER LEDGER TABLE
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false
      if (selectedCostCenter !== 'ALL' && item.cost_center !== selectedCostCenter) return false
      if (selectedPaymentMethod !== 'ALL' && item.payment_method !== selectedPaymentMethod) return false
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false
      if (selectedRecurring === 'RECURRING' && !item.is_recurring) return false
      if (selectedRecurring === 'ONE_TIME' && item.is_recurring) return false
      if (registerMonthFilter !== 'ALL' && item.expense_date && !item.expense_date.startsWith(registerMonthFilter)) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = item.title.toLowerCase().includes(q)
        const matchRef = item.reference_number.toLowerCase().includes(q)
        const matchVendor = item.vendor_payee.toLowerCase().includes(q)
        const matchNotes = item.notes ? item.notes.toLowerCase().includes(q) : false
        if (!matchTitle && !matchRef && !matchVendor && !matchNotes) return false
      }

      return true
    })
  }, [expenses, selectedCategory, selectedCostCenter, selectedPaymentMethod, selectedStatus, selectedRecurring, registerMonthFilter, searchQuery])

  // Active dataset for Top KPI Cards: Always reflects the user's active view!
  // When in Analytics: reflects analytics filters
  // When in Register: reflects register filters
  // When filters are removed: immediately refreshes to full normal figures!
  const activeDataset = useMemo(() => {
    return activeTab === 'analytics' ? analyticsExpenses : filteredExpenses
  }, [activeTab, analyticsExpenses, filteredExpenses])

  const isFiltered = useMemo(() => {
    if (activeTab === 'analytics') {
      return periodPreset !== 'ALL' || analyticsCostCenter !== 'ALL' || analyticsRecurring !== 'ALL' || selectedBarMonth !== null
    } else {
      return (
        searchQuery.trim() !== '' ||
        selectedCategory !== 'ALL' ||
        selectedCostCenter !== 'ALL' ||
        selectedPaymentMethod !== 'ALL' ||
        selectedStatus !== 'ALL' ||
        selectedRecurring !== 'ALL' ||
        registerMonthFilter !== 'ALL'
      )
    }
  }, [
    activeTab,
    periodPreset,
    analyticsCostCenter,
    analyticsRecurring,
    selectedBarMonth,
    searchQuery,
    selectedCategory,
    selectedCostCenter,
    selectedPaymentMethod,
    selectedStatus,
    selectedRecurring,
    registerMonthFilter,
  ])

  // Summary Metrics (Computed dynamically from activeDataset)
  const stats: ExpenseSummaryStats = useMemo(() => {
    const totalSpent = activeDataset.reduce((acc, curr) => acc + curr.amount, 0)
    const totalVat = activeDataset.reduce((acc, curr) => acc + (curr.vat_amount || 0), 0)
    const netSpent = totalSpent - totalVat
    const totalTransactions = activeDataset.length
    const averageTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0
    const pendingCount = activeDataset.filter((e) => e.status === 'Pending Approval').length
    const underReviewCount = activeDataset.filter((e) => e.status === 'Under Review').length
    const recurringMonthlyCommitment = activeDataset
      .filter((e) => e.is_recurring)
      .reduce((acc, curr) => acc + curr.amount, 0)

    const largestExpense = [...activeDataset].sort((a, b) => b.amount - a.amount)[0] || null

    return {
      totalSpent,
      totalVat,
      netSpent,
      totalTransactions,
      averageTransaction,
      pendingCount,
      underReviewCount,
      recurringMonthlyCommitment,
      largestExpense,
    }
  }, [activeDataset])

  // Sliced expenses for current page
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredExpenses.slice(startIndex, startIndex + pageSize)
  }, [filteredExpenses, currentPage, pageSize])

  // Multi-Month Trends (Calculated from analyticsExpenses)
  const monthlyTrends = useMemo(() => {
    const monthsMap: Record<string, { monthKey: string; label: string; total: number; vat: number; net: number; count: number }> = {}

    analyticsExpenses.forEach((e) => {
      if (!e.expense_date) return
      const mKey = e.expense_date.substring(0, 7)
      if (!monthsMap[mKey]) {
        const dateObj = new Date(e.expense_date)
        const label = isNaN(dateObj.getTime())
          ? mKey
          : dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        monthsMap[mKey] = { monthKey: mKey, label, total: 0, vat: 0, net: 0, count: 0 }
      }
      monthsMap[mKey].total += e.amount
      monthsMap[mKey].vat += e.vat_amount || 0
      monthsMap[mKey].net += e.amount - (e.vat_amount || 0)
      monthsMap[mKey].count += 1
    })

    return Object.values(monthsMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }, [analyticsExpenses])

  // Category Spends in analytics view
  const categorySpends = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    analyticsExpenses.forEach((e) => {
      if (!map[e.category]) map[e.category] = { total: 0, count: 0 }
      map[e.category].total += e.amount
      map[e.category].count += 1
    })
    return map
  }, [analyticsExpenses])

  // Departmental / Cost Center Totals in analytics view
  const costCenterTotals = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    analyticsExpenses.forEach((e) => {
      if (!map[e.cost_center]) map[e.cost_center] = { total: 0, count: 0 }
      map[e.cost_center].total += e.amount
      map[e.cost_center].count += 1
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [analyticsExpenses])

  // Payment Method Breakdown in analytics view
  const paymentMethodTotals = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    analyticsExpenses.forEach((e) => {
      if (!map[e.payment_method]) map[e.payment_method] = { total: 0, count: 0 }
      map[e.payment_method].total += e.amount
      map[e.payment_method].count += 1
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [analyticsExpenses])

  // Available unique months list for quick filter dropdown
  const allUniqueMonths = useMemo(() => {
    const set = new Set<string>()
    expenses.forEach((e) => {
      if (e.expense_date) {
        set.add(e.expense_date.substring(0, 7))
      }
    })
    return Array.from(set).sort().reverse()
  }, [expenses])

  // Handlers
  const handleSaveExpense = async (
    expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'> & { id?: string }
  ) => {
    const saved = await saveExpense(expenseData)
    setExpenses((prev) => {
      const idx = prev.findIndex((item) => item.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return
    setDeletingId(id)
    await deleteExpense(id)
    setExpenses((prev) => prev.filter((item) => item.id !== id))
    setDeletingId(null)
  }

  // Quick Drill-Down CTA Handlers (Analytics -> Register)
  const jumpToRegisterWithCategory = (categoryName: string) => {
    setSelectedCategory(categoryName)
    setSelectedCostCenter('ALL')
    setSelectedPaymentMethod('ALL')
    setSelectedStatus('ALL')
    setSelectedRecurring('ALL')
    setRegisterMonthFilter('ALL')
    setSearchQuery('')
    setActiveTab('register')
  }

  const jumpToRegisterWithCostCenter = (costCenterName: string) => {
    setSelectedCostCenter(costCenterName)
    setSelectedCategory('ALL')
    setSelectedPaymentMethod('ALL')
    setSelectedStatus('ALL')
    setSelectedRecurring('ALL')
    setRegisterMonthFilter('ALL')
    setSearchQuery('')
    setActiveTab('register')
  }

  const jumpToRegisterWithMonth = (monthKey: string) => {
    setRegisterMonthFilter(monthKey)
    setSelectedCategory('ALL')
    setSelectedCostCenter('ALL')
    setSelectedPaymentMethod('ALL')
    setSelectedStatus('ALL')
    setSelectedRecurring('ALL')
    setSearchQuery('')
    setActiveTab('register')
  }

  const jumpToRegisterFilteredView = () => {
    if (analyticsCostCenter !== 'ALL') {
      setSelectedCostCenter(analyticsCostCenter)
    }
    if (analyticsRecurring !== 'ALL') {
      setSelectedRecurring(analyticsRecurring)
    }
    setActiveTab('register')
  }

  // Reset all filters in current view
  const resetCurrentViewFilters = () => {
    if (activeTab === 'analytics') {
      setPeriodPreset('ALL')
      setAnalyticsStartDate('')
      setAnalyticsEndDate('')
      setAnalyticsCostCenter('ALL')
      setAnalyticsRecurring('ALL')
      setSelectedBarMonth(null)
    } else {
      setSearchQuery('')
      setSelectedCategory('ALL')
      setSelectedCostCenter('ALL')
      setSelectedPaymentMethod('ALL')
      setSelectedStatus('ALL')
      setSelectedRecurring('ALL')
      setRegisterMonthFilter('ALL')
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Reference',
      'Date',
      'Title',
      'Category',
      'Vendor / Payee',
      'Cost Center',
      'Payment Method',
      'Status',
      'Gross Amount (SAR)',
      '15% VAT (SAR)',
      'Net Amount (SAR)',
      'Is Recurring',
      'Approved By',
      'Notes',
    ]

    const rows = filteredExpenses.map((e) => [
      e.reference_number,
      e.expense_date,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      `"${e.vendor_payee.replace(/"/g, '""')}"`,
      `"${e.cost_center}"`,
      `"${e.payment_method}"`,
      e.status,
      e.amount.toFixed(2),
      (e.vat_amount || 0).toFixed(2),
      (e.amount - (e.vat_amount || 0)).toFixed(2),
      e.is_recurring ? 'YES' : 'NO',
      `"${e.approved_by || ''}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `asaheeb_expenses_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div
      className="expenses-page-wrapper"
      style={{
        padding: '20px 24px',
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Mobile Responsive & Smooth Touch Scrolling CSS */}
      <style>{`
        /* Smooth horizontal scrollbar styling */
        .chart-touch-scroll::-webkit-scrollbar,
        .table-touch-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .chart-touch-scroll::-webkit-scrollbar-track,
        .table-touch-scroll::-webkit-scrollbar-track {
          background: #F1F5F9;
          border-radius: 4px;
        }
        .chart-touch-scroll::-webkit-scrollbar-thumb,
        .table-touch-scroll::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 4px;
        }
        .chart-touch-scroll::-webkit-scrollbar-thumb:hover,
        .table-touch-scroll::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }

        @media (max-width: 768px) {
          .expenses-page-wrapper {
            padding: 12px 10px !important;
            gap: 14px !important;
            overflow-x: hidden !important;
            max-width: 100vw !important;
          }
          .expenses-header-actions {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
          }
          .primary-record-btn {
            grid-column: 1 / -1 !important;
            width: 100% !important;
            justify-content: center !important;
            padding: 10px !important;
          }
          .kpi-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .analytics-period-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .analytics-two-col {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .register-filter-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .register-filter-bar select, .register-filter-bar div {
            width: 100% !important;
            min-width: 100% !important;
          }
        }
      `}</style>

      {/* Top Header & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(79, 70, 229, 0.12)',
                color: '#4F46E5',
              }}
            >
              <WalletCards size={18} />
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Brokerage Expense Tracker
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <Building2 size={12} /> Jeddah HQ
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              SAR (ريال) · 15% ZATCA VAT
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 7px',
                backgroundColor: '#FEF2F2',
                color: '#B91C1C',
                borderRadius: '6px',
                fontSize: '10.5px',
                fontWeight: 800,
              }}
            >
              <Lock size={10} /> ADMIN ACCESS
            </span>
          </div>
          <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Executive accounting ledger, recurring cost governance, and quarterly ZATCA tax refund analytics.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="expenses-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsFinancialReportOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #0F172A',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(15, 23, 42, 0.12)',
            }}
          >
            <FileText size={14} color="#38BDF8" /> Financial Statement
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            className="primary-record-btn"
            onClick={() => {
              setEditingExpense(null)
              setIsRecordModalOpen(true)
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#4F46E5',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
            }}
          >
            <Plus size={15} /> Record Expense
          </button>
        </div>
      </div>

      {/* Dynamic Filter Status Banner (Allows resetting back to normal with 1 click) */}
      {isFiltered && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '12px',
            color: '#1E40AF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700 }}>Active Filter Applied:</span>
            <span>
              Displaying <strong>{stats.totalTransactions}</strong> of <strong>{expenses.length}</strong> disbursements ({activeTab === 'analytics' ? 'Analytics View' : 'Register View'}).
            </span>
          </div>
          <button
            type="button"
            onClick={resetCurrentViewFilters}
            style={{
              padding: '3px 8px',
              borderRadius: '5px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #93C5FD',
              color: '#1D4ED8',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <RotateCcw size={11} /> Reset Filter to Normal
          </button>
        </div>
      )}

      {/* Clean 4 KPI Cards (Dynamic & In-Sync with Active View) */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {/* Card 1: Total Expenditure */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '16px 18px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Expenditure
            </span>
            <span style={{ color: '#4F46E5', padding: '4px', background: '#EEF2FF', borderRadius: '6px' }}>
              <WalletCards size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginLeft: '4px' }}>SAR</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 700, color: '#0F172A' }}>{stats.totalTransactions}</span> disbursements in view
          </div>
        </div>

        {/* Card 2: 15% ZATCA VAT Claimable */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '16px 18px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              15% ZATCA VAT Claimable
            </span>
            <span style={{ color: '#059669', padding: '4px', background: '#ECFDF5', borderRadius: '6px' }}>
              <Receipt size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {stats.totalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginLeft: '4px' }}>SAR</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={12} /> Eligible for quarterly tax refund
          </div>
        </div>

        {/* Card 3: Net Outlay (Excl. VAT) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '16px 18px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Net Outlay (Excl. VAT)
            </span>
            <span style={{ color: '#0284C7', padding: '4px', background: '#F0F9FF', borderRadius: '6px' }}>
              <Banknote size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {stats.netSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginLeft: '4px' }}>SAR</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Avg: <strong style={{ color: '#0F172A' }}>{stats.averageTransaction.toLocaleString('en-US', { maximumFractionDigits: 0 })} SAR</strong> / entry
          </div>
        </div>

        {/* Card 4: Monthly Recurring Commitments */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '16px 18px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recurring Overhead
            </span>
            <span style={{ color: '#D97706', padding: '4px', background: '#FFFBEB', borderRadius: '6px' }}>
              <Clock size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {stats.recurringMonthlyCommitment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginLeft: '4px' }}>SAR</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
            Fixed monthly baseline commitments
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '20px' }}>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '9px 4px',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '2px solid #4F46E5' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'analytics' ? '#4F46E5' : '#64748B',
            fontWeight: activeTab === 'analytics' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <TrendingUp size={15} /> Executive Analytics & Visualizer
        </button>

        <button
          onClick={() => setActiveTab('register')}
          style={{
            padding: '9px 4px',
            border: 'none',
            borderBottom: activeTab === 'register' ? '2px solid #4F46E5' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'register' ? '#4F46E5' : '#64748B',
            fontWeight: activeTab === 'register' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Layers size={15} /> Expense Register & Ledger ({filteredExpenses.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE ANALYTICS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', minWidth: 0 }}>
          {/* Dynamic Period & Cost Center Filter Controls Toolbar */}
          <div
            className="analytics-period-bar"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            {/* Quick Period Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                <Calendar size={13} color="#4F46E5" /> Timeframe:
              </span>

              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'LAST_MONTH', label: 'Last Month' },
                { id: 'LAST_3_MONTHS', label: 'Last 3 Months' },
                { id: 'LAST_6_MONTHS', label: 'Last 6 Months' },
                { id: 'CUSTOM', label: 'Custom Range' },
              ].map((p) => {
                const isActive = periodPreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPeriodPreset(p.id as any)
                      setSelectedBarMonth(null)
                    }}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                      backgroundColor: isActive ? '#EEF2FF' : '#FFFFFF',
                      color: isActive ? '#4338CA' : '#475569',
                      fontSize: '11.5px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Custom Range Date Pickers */}
            {periodPreset === 'CUSTOM' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={analyticsStartDate}
                  onChange={(e) => setAnalyticsStartDate(e.target.value)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '11.5px',
                    color: '#1E293B',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>to</span>
                <input
                  type="date"
                  value={analyticsEndDate}
                  onChange={(e) => setAnalyticsEndDate(e.target.value)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '11.5px',
                    color: '#1E293B',
                  }}
                />
              </div>
            )}

            {/* Department, Recurring Filter & Reset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <select
                value={analyticsCostCenter}
                onChange={(e) => {
                  setAnalyticsCostCenter(e.target.value)
                  setSelectedBarMonth(null)
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '11.5px',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontWeight: 600,
                }}
              >
                <option value="ALL">All Departments</option>
                {COST_CENTERS.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>

              {/* Recurring Filter in Analytics */}
              <select
                value={analyticsRecurring}
                onChange={(e) => setAnalyticsRecurring(e.target.value as any)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '11.5px',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontWeight: 600,
                }}
              >
                <option value="ALL">All Payments</option>
                <option value="RECURRING">↻ Recurring Only</option>
                <option value="ONE_TIME">One-Time Only</option>
              </select>

              {(periodPreset !== 'ALL' || analyticsCostCenter !== 'ALL' || analyticsRecurring !== 'ALL' || selectedBarMonth) && (
                <button
                  type="button"
                  onClick={resetCurrentViewFilters}
                  title="Reset analytics filters"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    color: '#64748B',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}

              {/* Direct CTA: Jump into Ledger */}
              <button
                type="button"
                onClick={jumpToRegisterFilteredView}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #C7D2FE',
                  backgroundColor: '#EEF2FF',
                  color: '#4338CA',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Ledger ({analyticsExpenses.length}) <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* Historical Multi-Month Spend Trajectory & Stacked Graph */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={17} color="#4F46E5" />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Monthly Expenditure Trajectory (SAR)
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
                  Click on any month bar to inspect its exact ledger transactions.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '11.5px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#4F46E5' }} />
                  <span style={{ color: '#475569' }}>Net Spend</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#10B981' }} />
                  <span style={{ color: '#475569' }}>15% VAT</span>
                </div>
              </div>
            </div>

            {monthlyTrends.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94A3B8' }}>
                <Calendar size={28} color="#CBD5E1" style={{ marginBottom: '6px' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No expense disbursements in this selected period</p>
              </div>
            ) : (
              <div>
                {/* Visual swipe hint for mobile screens */}
                <div
                  style={{
                    fontSize: '11px',
                    color: '#6366F1',
                    fontWeight: 600,
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>👉 Swipe chart horizontally to slide through months</span>
                </div>

                {/* Guaranteed Smooth Horizontal Pan/Scroll Container */}
                <div
                  className="chart-touch-scroll"
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x',
                    paddingBottom: '8px',
                  }}
                >
                  {(() => {
                    const maxSpend = Math.max(...monthlyTrends.map((m) => m.total), 1)
                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${monthlyTrends.length}, minmax(75px, 1fr))`,
                          gap: '14px',
                          alignItems: 'flex-end',
                          minHeight: '210px',
                          padding: '12px 4px 6px 4px',
                          borderBottom: '1px solid #E2E8F0',
                          minWidth: monthlyTrends.length > 4 ? `${monthlyTrends.length * 85}px` : '100%',
                        }}
                      >
                        {monthlyTrends.map((m) => {
                          const isSelected = selectedBarMonth === m.monthKey
                          const barHeightPct = Math.max(14, Math.round((m.total / maxSpend) * 100))
                          const vatHeightPct = m.total > 0 ? Math.round((m.vat / m.total) * 100) : 0

                          return (
                            <div
                              key={m.monthKey}
                              onClick={() => setSelectedBarMonth(isSelected ? null : m.monthKey)}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                height: '100%',
                                justifyContent: 'flex-end',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? '#EEF2FF' : 'transparent',
                                transition: 'background-color 0.15s',
                              }}
                              title={`Click to drill down: ${m.label} (${m.total.toLocaleString()} SAR)`}
                            >
                              <div style={{ fontSize: '10.5px', fontWeight: 700, color: isSelected ? '#4338CA' : '#0F172A' }}>
                                {(m.total / 1000).toFixed(1)}k
                              </div>

                              {/* Stacked Bar */}
                              <div
                                style={{
                                  width: '100%',
                                  maxWidth: '44px',
                                  height: `${barHeightPct}%`,
                                  backgroundColor: '#EEF2FF',
                                  border: isSelected ? '2px solid #4338CA' : '1px solid #C7D2FE',
                                  borderRadius: '6px 6px 0 0',
                                  position: 'relative',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-end',
                                  overflow: 'hidden',
                                  boxShadow: isSelected ? '0 0 0 3px rgba(79, 70, 229, 0.25)' : 'none',
                                }}
                              >
                                <div
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: '#4F46E5',
                                  }}
                                />
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    width: '100%',
                                    height: `${vatHeightPct}%`,
                                    backgroundColor: '#10B981',
                                  }}
                                />
                              </div>

                              <div style={{ fontSize: '10.5px', fontWeight: isSelected ? 800 : 600, color: isSelected ? '#4338CA' : '#64748B', whiteSpace: 'nowrap' }}>
                                {m.label}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                {/* Selected Month Interactive Drill-down Banner */}
                {selectedBarMonth && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#EEF2FF',
                      borderRadius: '8px',
                      border: '1px solid #C7D2FE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#312E81', fontWeight: 600 }}>
                      Selected Month: <strong>{monthlyTrends.find((m) => m.monthKey === selectedBarMonth)?.label}</strong> — Total: <strong>{monthlyTrends.find((m) => m.monthKey === selectedBarMonth)?.total.toLocaleString()} SAR</strong> ({monthlyTrends.find((m) => m.monthKey === selectedBarMonth)?.count} entries)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => jumpToRegisterWithMonth(selectedBarMonth)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '5px',
                          backgroundColor: '#4F46E5',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        Filter Ledger to Month <ArrowUpRight size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBarMonth(null)}
                        style={{
                          padding: '3px 6px',
                          borderRadius: '5px',
                          backgroundColor: 'transparent',
                          color: '#64748B',
                          border: 'none',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11.5px', color: '#64748B', flexWrap: 'wrap', gap: '6px' }}>
                  <span>
                    Period Total: <strong>{monthlyTrends.reduce((s, m) => s + m.total, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</strong>
                  </span>
                  <span>
                    Monthly Avg: <strong>{(monthlyTrends.reduce((s, m) => s + m.total, 0) / Math.max(1, monthlyTrends.length)).toLocaleString('en-US', { maximumFractionDigits: 0 })} SAR / month</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Two-Column Analytics Layout: Categories & Cost Centers */}
          <div className="analytics-two-col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', width: '100%', minWidth: 0 }}>
            {/* Left: Category Distribution with Direct Filter CTAs */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Category Spending Breakdown
                  </h3>
                  <p style={{ fontSize: '11.5px', color: '#64748B', margin: '2px 0 0 0' }}>
                    Click &quot;Filter Ledger&quot; on any category to view individual items.
                  </p>
                </div>
              </div>

              {Object.keys(categorySpends).length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748B' }}>
                  <PieChart size={28} color="#CBD5E1" style={{ marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600 }}>No categorized expenses in this period</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(categorySpends)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([cat, info]) => {
                      const pct = stats.totalSpent > 0 ? Math.round((info.total / stats.totalSpent) * 100) : 0
                      const color = CATEGORY_COLORS[cat] || '#64748B'

                      return (
                        <div
                          key={cat}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #F1F5F9',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', flexWrap: 'wrap', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  width: '9px',
                                  height: '9px',
                                  borderRadius: '2px',
                                  backgroundColor: color,
                                }}
                              />
                              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>{cat}</span>
                              <span style={{ fontSize: '10.5px', color: '#64748B' }}>({info.count})</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0F172A' }}>
                                {info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                              </span>
                              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#4F46E5', minWidth: '30px', textAlign: 'right' }}>
                                {pct}%
                              </span>
                              <button
                                type="button"
                                onClick={() => jumpToRegisterWithCategory(cat)}
                                title={`Filter ledger for ${cat}`}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#334155',
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                Filter →
                              </button>
                            </div>
                          </div>

                          <div
                            style={{
                              width: '100%',
                              height: '5px',
                              backgroundColor: '#E2E8F0',
                              borderRadius: '999px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: color,
                                borderRadius: '999px',
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Right: Departmental Cost Centers & High-Value Outlays */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
              {/* Departmental Allocation (Highlighting Jeddah HQ) */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Departmental Cost Centers
                  </h3>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                    Jeddah Headquarters
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {costCenterTotals.map(([cc, info]) => {
                    const isHQ = cc === 'Jeddah HQ'
                    return (
                      <div
                        key={cc}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          backgroundColor: isHQ ? '#F0FDF4' : '#F8FAFC',
                          borderRadius: '6px',
                          border: isHQ ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontWeight: 700, color: isHQ ? '#166534' : '#1E293B' }}>{cc}</span>
                          {isHQ && (
                            <span style={{ fontSize: '9.5px', padding: '1px 4px', borderRadius: '3px', backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 700 }}>
                              HQ
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: '#0F172A' }}>
                            {info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                          </strong>
                          <button
                            type="button"
                            onClick={() => jumpToRegisterWithCostCenter(cc)}
                            title={`Filter ledger for ${cc}`}
                            style={{
                              padding: '2px 5px',
                              borderRadius: '4px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#334155',
                              fontSize: '10px',
                              cursor: 'pointer',
                            }}
                          >
                            Ledger →
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Payment Methods Distribution */}
              {paymentMethodTotals.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    minWidth: 0,
                  }}
                >
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: '0 0 10px 0' }}>
                    Payment Settlement Channels
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {paymentMethodTotals.map(([pm, info]) => {
                      const share = stats.totalSpent > 0 ? Math.round((info.total / stats.totalSpent) * 100) : 0
                      return (
                        <div
                          key={pm}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '11.5px',
                            padding: '4px 0',
                            borderBottom: '1px solid #F1F5F9',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CreditCard size={12} color="#64748B" />
                            <span style={{ fontWeight: 600, color: '#334155' }}>{pm}</span>
                          </div>
                          <div>
                            <strong style={{ color: '#0F172A' }}>{info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</strong>
                            <span style={{ fontSize: '10.5px', color: '#64748B', marginLeft: '5px' }}>({share}%)</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXPENSE REGISTER & LEDGER WITH FULL ADJUSTABLE PAGINATION          */}
      {/* ========================================================================= */}
      {activeTab === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0 }}>
          {/* Register Filter Controls & View Switcher */}
          <div
            className="register-filter-bar"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                }}
              />
              <input
                type="text"
                placeholder="Search by title, reference, vendor, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Recurring Filter (User explicitly requested!) */}
            <select
              value={selectedRecurring}
              onChange={(e) => setSelectedRecurring(e.target.value as any)}
              style={{
                padding: '6px 9px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: selectedRecurring !== 'ALL' ? '#EEF2FF' : '#FFFFFF',
                color: selectedRecurring !== 'ALL' ? '#4338CA' : '#1E293B',
                fontWeight: 600,
              }}
            >
              <option value="ALL">All Schedules</option>
              <option value="RECURRING">↻ Recurring Only</option>
              <option value="ONE_TIME">One-Time Only</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '6px 9px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Categories</option>
              {Object.keys(CATEGORY_COLORS).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Cost Center Filter */}
            <select
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              style={{
                padding: '6px 9px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Cost Centers</option>
              {COST_CENTERS.map((cc) => (
                <option key={cc} value={cc}>
                  {cc}
                </option>
              ))}
            </select>

            {/* Month Filter */}
            <select
              value={registerMonthFilter}
              onChange={(e) => setRegisterMonthFilter(e.target.value)}
              style={{
                padding: '6px 9px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Months</option>
              {allUniqueMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: '6px 9px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Under Review">Under Review</option>
            </select>

            {/* View Mode Switcher (Table vs Mobile Cards) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#F1F5F9', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setRegisterViewMode('table')}
                title="Table View"
                style={{
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: registerViewMode === 'table' ? '#FFFFFF' : 'transparent',
                  color: registerViewMode === 'table' ? '#4F46E5' : '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  boxShadow: registerViewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <TableIcon size={13} /> Table
              </button>
              <button
                type="button"
                onClick={() => setRegisterViewMode('cards')}
                title="Mobile Cards View"
                style={{
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: registerViewMode === 'cards' ? '#FFFFFF' : 'transparent',
                  color: registerViewMode === 'cards' ? '#4F46E5' : '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  boxShadow: registerViewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <LayoutGrid size={13} /> Cards
              </button>
            </div>

            {/* Reset Button */}
            {(searchQuery || selectedCategory !== 'ALL' || selectedCostCenter !== 'ALL' || selectedPaymentMethod !== 'ALL' || selectedStatus !== 'ALL' || selectedRecurring !== 'ALL' || registerMonthFilter !== 'ALL') && (
              <button
                type="button"
                onClick={resetCurrentViewFilters}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#64748B',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <RotateCcw size={11} /> Clear
              </button>
            )}
          </div>

          {/* VIEW 1: TABLE VIEW (With Guaranteed Horizontal Sliding/Scrolling) */}
          {registerViewMode === 'table' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: 0 }}>
              {/* Mobile Table Scroll Helper Hint */}
              <div
                style={{
                  fontSize: '11px',
                  color: '#4F46E5',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '2px 4px',
                }}
              >
                <span>👉 Swipe table horizontally to see all columns</span>
                <span style={{ color: '#64748B', fontWeight: 500 }}>
                  Showing {filteredExpenses.length} disbursements
                </span>
              </div>

              {/* Table Container with Explicit Touch Scrolling and No Clipping */}
              <div
                className="table-touch-scroll"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-x',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '820px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569' }}>Ref / Date</th>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569' }}>Title & Documentation</th>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569' }}>Category</th>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569' }}>Payee & Department</th>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569' }}>Status</th>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                        Gross (SAR)
                      </th>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                        15% VAT
                      </th>
                      <th style={{ padding: '11px 14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
                          <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>No expense records match the active filter criteria.</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#94A3B8' }}>
                            Click <strong>&quot;+ Record Expense&quot;</strong> to record a new transaction or clear filters.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedExpenses.map((exp) => (
                        <tr
                          key={exp.id}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            transition: 'background-color 0.15s',
                          }}
                        >
                          {/* Ref & Date */}
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '11.5px' }}>{exp.reference_number}</div>
                            <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>{exp.expense_date}</div>
                          </td>

                          {/* Title & Documentation */}
                          <td style={{ padding: '11px 14px', maxWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '12.5px' }}>{exp.title}</span>
                              {exp.notes && (
                                <span
                                  title={exp.notes}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: '#EEF2FF',
                                    color: '#4F46E5',
                                    cursor: 'help',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Info size={11} />
                                </span>
                              )}
                            </div>

                            {/* Receipt link */}
                            {exp.receipt_url && (
                              <div style={{ marginTop: '3px' }}>
                                <a
                                  href={exp.receipt_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                    textDecoration: 'none',
                                    fontSize: '10.5px',
                                    fontWeight: 600,
                                    color: '#4F46E5',
                                  }}
                                >
                                  <Receipt size={11} /> View Receipt <ExternalLink size={9} />
                                </a>
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td style={{ padding: '11px 14px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                backgroundColor: '#F1F5F9',
                                color: CATEGORY_COLORS[exp.category] || '#334155',
                              }}
                            >
                              {exp.category}
                            </span>
                            {exp.is_recurring && (
                              <div style={{ fontSize: '10px', color: '#6366F1', fontWeight: 700, marginTop: '2px' }}>
                                ↻ Recurring
                              </div>
                            )}
                          </td>

                          {/* Payee & Department */}
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#1E293B' }}>{exp.vendor_payee}</div>
                            <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '1px' }}>
                              {exp.cost_center} • {exp.payment_method}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '11px 14px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor:
                                  exp.status === 'Paid'
                                    ? '#ECFDF5'
                                    : exp.status === 'Pending Approval'
                                    ? '#FEF3C7'
                                    : '#EFF6FF',
                                color:
                                  exp.status === 'Paid'
                                    ? '#059669'
                                    : exp.status === 'Pending Approval'
                                    ? '#B45309'
                                    : '#1D4ED8',
                              }}
                            >
                              {exp.status}
                            </span>
                          </td>

                          {/* Gross Amount */}
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            {exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                          </td>

                          {/* 15% VAT */}
                          <td style={{ padding: '11px 14px', textAlign: 'right', color: '#64748B', fontSize: '11.5px' }}>
                            {(exp.vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '5px' }}>
                              <button
                                onClick={() => {
                                  setEditingExpense(exp)
                                  setIsRecordModalOpen(true)
                                }}
                                title="Edit Record"
                                style={{
                                  padding: '4px',
                                  borderRadius: '5px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#475569',
                                  cursor: 'pointer',
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                disabled={deletingId === exp.id}
                                title="Delete Record"
                                style={{
                                  padding: '4px',
                                  borderRadius: '5px',
                                  border: '1px solid #FECACA',
                                  backgroundColor: '#FEF2F2',
                                  color: '#DC2626',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: MOBILE CARDS VIEW (100% Native on phones, no horizontal scroll needed) */}
          {registerViewMode === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
              {filteredExpenses.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748B', gridColumn: '1 / -1' }}>
                  No matching disbursements found.
                </div>
              ) : (
                paginatedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
                          {exp.reference_number} • {exp.expense_date}
                        </div>
                        <h4 style={{ margin: '3px 0 0 0', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                          {exp.title}
                        </h4>
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          backgroundColor: exp.status === 'Paid' ? '#ECFDF5' : '#FEF3C7',
                          color: exp.status === 'Paid' ? '#059669' : '#B45309',
                        }}
                      >
                        {exp.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: CATEGORY_COLORS[exp.category] || '#334155', fontWeight: 600 }}>
                        {exp.category}
                      </span>
                      {exp.is_recurring && (
                        <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#EEF2FF', color: '#4F46E5', fontWeight: 700 }}>
                          ↻ Recurring
                        </span>
                      )}
                      <span style={{ color: '#64748B' }}>• {exp.cost_center}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9', marginTop: '4px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                          {exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                          15% VAT: {(exp.vat_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {exp.receipt_url && (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '5px 7px',
                              borderRadius: '5px',
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              color: '#4F46E5',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              textDecoration: 'none',
                            }}
                          >
                            <Receipt size={12} /> Receipt
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setEditingExpense(exp)
                            setIsRecordModalOpen(true)
                          }}
                          style={{
                            padding: '5px 7px',
                            borderRadius: '5px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          style={{
                            padding: '5px 7px',
                            borderRadius: '5px',
                            border: '1px solid #FECACA',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Adjustable Pagination Bar (20, 50, 100, 500) */}
          <div style={{ marginTop: '4px' }}>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredExpenses.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setCurrentPage(1)
              }}
              pageSizeOptions={[20, 50, 100, 500]}
              itemLabel="disbursements"
            />
          </div>
        </div>
      )}

      {/* Record / Edit Expense Modal */}
      <RecordExpenseModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false)
          setEditingExpense(null)
        }}
        onSave={handleSaveExpense}
        initialData={editingExpense}
      />

      {/* Financial Statement Modal */}
      <FinancialReportModal
        isOpen={isFinancialReportOpen}
        onClose={() => setIsFinancialReportOpen(false)}
        expenses={expenses}
        stats={stats}
      />
    </div>
  )
}
