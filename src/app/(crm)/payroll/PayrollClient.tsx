'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, EmployeeSalaryProfile, Payslip, PayslipCurrency, PayslipStatus, PayslipLineItem } from '@/types/database'
import {
  formatCurrencyAmount,
  getMonthName,
  MONTH_NAMES,
  getFinancialYear,
  calculateSalarySplitFromGross,
  getDefaultStatutoryDeductions,
  convertCurrency,
} from '@/lib/payroll-utils'
import PayslipDocument from '@/components/payroll/PayslipDocument'
import {
  Lock, Unlock, ShieldCheck, DollarSign, Calendar, Users, FileText,
  Plus, Edit3, Trash2, Printer, Eye, CheckCircle2, AlertCircle,
  Search, RefreshCw, ChevronRight, Settings, Building2, Briefcase, Landmark
} from 'lucide-react'

interface Props {
  currentProfile: Profile
  teamMembers: Profile[]
  salaryProfiles: EmployeeSalaryProfile[]
  initialPayslips: Payslip[]
  initialSalaryHistory: any[]
}

const PIN_STORAGE_KEY = 'asaheeb_payroll_pin'
const UNLOCKED_STORAGE_KEY = 'asaheeb_payroll_unlocked'

export default function PayrollClient({
  currentProfile,
  teamMembers,
  salaryProfiles: initSalaryProfiles,
  initialPayslips,
  initialSalaryHistory
}: Props) {
  const supabase = createClient()

  // Security PIN state
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [storedPin, setStoredPin] = useState(currentProfile.payroll_pin || '1234')
  const [showChangePin, setShowChangePin] = useState(false)
  const [newPin, setNewPin] = useState('')

  // Payroll Data state
  const [salaryProfiles, setSalaryProfiles] = useState<EmployeeSalaryProfile[]>(initSalaryProfiles)
  const [payslips, setPayslips] = useState<Payslip[]>(initialPayslips)
  const [allSalaryHistories, setAllSalaryHistories] = useState<any[]>(initialSalaryHistory)
  const [activeTab, setActiveTab] = useState<'payslips' | 'salary_profiles'>('payslips')

  // Filter state
  const [selectedFY, setSelectedFY] = useState<string>('ALL')
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [showInactiveProfiles, setShowInactiveProfiles] = useState(false)

  // Active Team Members filter
  const activeTeamMembers = useMemo(() => {
    return teamMembers.filter((m) => m.is_active !== false)
  }, [teamMembers])

  const inactiveTeamMembers = useMemo(() => {
    return teamMembers.filter((m) => m.is_active === false)
  }, [teamMembers])

  // Salary profile lookup
  const salaryMap = useMemo(() => {
    return new Map(salaryProfiles.map((s) => [s.profile_id, s]))
  }, [salaryProfiles])

  // Generation Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genMonth, setGenMonth] = useState<number>(new Date().getMonth() + 1)
  const [genYear, setGenYear] = useState<number>(new Date().getFullYear())
  const [genMode, setGenMode] = useState<'CURRENT_MONTH' | 'BACKFILL_FROM_JOINING'>('CURRENT_MONTH')
  const [genTargetMode, setGenTargetMode] = useState<'ALL' | 'CUSTOM'>('ALL')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  function openGenerateModal() {
    setSelectedMemberIds(new Set(activeTeamMembers.map((m) => m.id)))
    setGenTargetMode('ALL')
    setShowGenerateModal(true)
  }

  function toggleMemberSelection(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllMembers() {
    setSelectedMemberIds(new Set(activeTeamMembers.map((m) => m.id)))
  }

  function clearAllMembers() {
    setSelectedMemberIds(new Set())
  }

  // Salary Profile Edit Modal state
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [profCurrency, setProfCurrency] = useState<PayslipCurrency>('SAR')
  const [profBaseSalary, setProfBaseSalary] = useState<number>(0)
  const [profGrossPackage, setProfGrossPackage] = useState<number>(0)
  const [profJoiningDate, setProfJoiningDate] = useState<string>('2025-12-01')
  const [profDesignation, setProfDesignation] = useState<string>('')
  const [profDepartment, setProfDepartment] = useState<string>('Real Estate Operations')
  const [profEmpCode, setProfEmpCode] = useState<string>('')
  const [profBankName, setProfBankName] = useState<string>('')
  const [profAccNo, setProfAccNo] = useState<string>('')
  const [profIfscIban, setProfIfscIban] = useState<string>('')
  const [profPanIqama, setProfPanIqama] = useState<string>('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Salary History & Tabs states
  const [modalActiveTab, setModalActiveTab] = useState<'profile' | 'history' | 'payslips'>('profile')
  const [salaryHistory, setSalaryHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [histId, setHistId] = useState<string | null>(null)
  const [histBaseSalary, setHistBaseSalary] = useState<string>('')
  const [histCurrency, setHistCurrency] = useState<PayslipCurrency>('SAR')
  const [histStartDate, setHistStartDate] = useState<string>('')
  const [histEndDate, setHistEndDate] = useState<string>('')
  const [savingHistoryItem, setSavingHistoryItem] = useState(false)

  // Payslip Selection state for Bulk Delete
  const [selectedPayslipIds, setSelectedPayslipIds] = useState<Set<string>>(new Set())
  const [deletingBulk, setDeletingBulk] = useState(false)

  // Payslip Edit / View Modal state
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null)
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null)
  const [editEarnings, setEditEarnings] = useState<PayslipLineItem[]>([])
  const [editDeductions, setEditDeductions] = useState<PayslipLineItem[]>([])
  const [editWorkingDays, setEditWorkingDays] = useState(30)
  const [editPaidDays, setEditPaidDays] = useState(30)
  const [editLopDays, setEditLopDays] = useState(0)
  const [editStatus, setEditStatus] = useState<PayslipStatus>('PAID')
  const [editNotes, setEditNotes] = useState('')
  const [editPeriodStartDate, setEditPeriodStartDate] = useState('')
  const [editPeriodEndDate, setEditPeriodEndDate] = useState('')
  const [editPaymentDate, setEditPaymentDate] = useState('')
  const [savingPayslip, setSavingPayslip] = useState(false)

  // Custom Notifications / Confirm Modal States
  const [toastFeedback, setToastFeedback] = useState<{ message: string; type: 'success' | 'danger' | 'warning' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  function showToast(message: string, type: 'success' | 'danger' | 'warning' = 'success') {
    setToastFeedback({ message, type })
  }

  // Clear toast after timeout
  useEffect(() => {
    if (toastFeedback) {
      const timer = setTimeout(() => setToastFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toastFeedback])

  useEffect(() => {
    const feedback = sessionStorage.getItem('payroll_toast_feedback')
    if (feedback) {
      try {
        const parsed = JSON.parse(feedback)
        setToastFeedback(parsed)
      } catch (e) {
        console.error(e)
      }
      sessionStorage.removeItem('payroll_toast_feedback')
    }
  }, [])

  // Selection helpers
  function toggleSelectPayslip(id: string) {
    setSelectedPayslipIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllPayslips() {
    if (selectedPayslipIds.size === filteredPayslips.length && filteredPayslips.length > 0) {
      setSelectedPayslipIds(new Set())
    } else {
      setSelectedPayslipIds(new Set(filteredPayslips.map((p) => p.id)))
    }
  }

  // Bulk Delete Payslips
  async function handleBulkDeletePayslips() {
    if (selectedPayslipIds.size === 0) return
    const count = selectedPayslipIds.size

    setConfirmModal({
      title: 'Confirm Bulk Deletion',
      message: `Are you sure you want to permanently delete ${count} selected payslip${count > 1 ? 's' : ''}? This action cannot be undone.`,
      onConfirm: async () => {
        setDeletingBulk(true)
        try {
          const idsArray = Array.from(selectedPayslipIds)
          const res = await fetch('/api/payroll/payslips', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsArray }),
          })
          const result = await res.json()
          if (!res.ok) throw new Error(result.error || 'Failed to delete payslips')

          setPayslips((prev) => prev.filter((p) => !selectedPayslipIds.has(p.id)))
          setSelectedPayslipIds(new Set())
          showToast(`Successfully deleted ${count} payslips.`, 'success')
        } catch (err: any) {
          showToast(err.message || 'Error deleting selected payslips', 'danger')
        } finally {
          setDeletingBulk(false)
        }
      }
    })
  }

  // Load PIN from database profile (and fallback to local storage)
  useEffect(() => {
    const savedPin = currentProfile.payroll_pin || localStorage.getItem(PIN_STORAGE_KEY) || localStorage.getItem('adonix_payroll_pin') || '1234'
    setStoredPin(savedPin)
    const unlocked = sessionStorage.getItem(UNLOCKED_STORAGE_KEY) === 'true' || sessionStorage.getItem('adonix_payroll_unlocked') === 'true'
    if (unlocked) setIsUnlocked(true)
  }, [currentProfile])

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (pinInput.trim() === storedPin) {
      setIsUnlocked(true)
      sessionStorage.setItem(UNLOCKED_STORAGE_KEY, 'true')
      setPinError('')
      setPinInput('')
    } else {
      setPinError('Incorrect PIN. (Default is 1234)')
    }
  }

  function handleLock() {
    setIsUnlocked(false)
    sessionStorage.removeItem(UNLOCKED_STORAGE_KEY)
  }

  async function handleSaveNewPin(e: React.FormEvent) {
    e.preventDefault()
    if (!newPin.trim() || newPin.length < 4) {
      showToast('PIN must be at least 4 digits', 'warning')
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ payroll_pin: newPin.trim() })
        .eq('id', currentProfile.id)

      if (error) throw error

      localStorage.setItem(PIN_STORAGE_KEY, newPin.trim())
      setStoredPin(newPin.trim())
      currentProfile.payroll_pin = newPin.trim()
      
      setShowChangePin(false)
      setNewPin('')
      showToast('Security PIN updated successfully!', 'success')
    } catch (err: any) {
      console.error(err)
      showToast('Failed to save PIN: ' + err.message, 'danger')
    }
  }

  // Extract unique Financial Years
  const availableFYs = useMemo(() => {
    const fys = Array.from(new Set(payslips.map((p) => p.financial_year).filter(Boolean)))
    if (!fys.includes('FY 2026-2027')) fys.unshift('FY 2026-2027')
    if (!fys.includes('FY 2025-2026')) fys.unshift('FY 2025-2026')
    return Array.from(new Set(fys)).sort().reverse()
  }, [payslips])

  // Filtered Payslips
  const filteredPayslips = useMemo(() => {
    return payslips.filter((p) => {
      if (selectedFY !== 'ALL' && p.financial_year !== selectedFY) return false
      if (selectedMonth !== 'ALL' && p.month.toString() !== selectedMonth) return false
      if (selectedCurrency !== 'ALL' && p.currency !== selectedCurrency) return false
      if (search.trim()) {
        const query = search.toLowerCase()
        const empName = p.employee?.name?.toLowerCase() || ''
        const empCode = p.employee_code?.toLowerCase() || ''
        if (!empName.includes(query) && !empCode.includes(query)) return false
      }
      return true
    })
  }, [payslips, selectedFY, selectedMonth, selectedCurrency, search])

  // Saudi-focused Metrics
  const metrics = useMemo(() => {
    let sarDisbursed = 0
    let totalPaid = 0

    filteredPayslips.forEach((p) => {
      if (p.status === 'PAID') {
        sarDisbursed += convertCurrency(Number(p.net_pay) || 0, p.currency || 'SAR', 'SAR')
        totalPaid++
      }
    })

    let monthlySalaryCommitment = 0
    activeTeamMembers.forEach((member) => {
      const sp = salaryMap.get(member.id)
      if (sp?.base_salary) {
        monthlySalaryCommitment += convertCurrency(Number(sp.base_salary), sp.currency || 'SAR', 'SAR')
      }
    })

    return {
      sarDisbursed,
      monthlySalaryCommitment,
      totalCount: filteredPayslips.length,
      totalPaid,
      activeMembers: activeTeamMembers.length,
      inactiveMembers: inactiveTeamMembers.length,
    }
  }, [filteredPayslips, activeTeamMembers, inactiveTeamMembers, salaryMap])

  // Fetch Salary History
  async function fetchSalaryHistory(employeeId: string) {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/payroll/salary-history?employeeId=${employeeId}`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to fetch salary history')
      const historyList = result.data || []
      setSalaryHistory(historyList)
      setAllSalaryHistories((prev) => {
        const filtered = prev.filter((item) => item.profile_id !== employeeId)
        return [...filtered, ...historyList]
      })

      // Inherit active period values if one exists
      const todayStr = new Date().toISOString().split('T')[0]
      const active = historyList.find((item: any) => {
        const start = item.start_date
        const end = item.end_date
        return start <= todayStr && (!end || end >= todayStr)
      })
      if (active) {
        setProfCurrency(active.currency)
        setProfGrossPackage(Number(active.base_salary))
        setProfBaseSalary(calculateSalarySplitFromGross(Number(active.base_salary)).basic)
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading salary history', 'danger')
    } finally {
      setLoadingHistory(false)
    }
  }

  // Redirect to registry for viewing/editing payslip
  function redirectToRegistry(p: Payslip, action: 'view' | 'edit') {
    if (!editingProfile) return
    setSearch(editingProfile.name)
    setActiveTab('payslips')
    setEditingProfile(null)

    if (action === 'view') {
      setViewingPayslip(p)
    } else if (action === 'edit') {
      setEditingPayslip(p)
      setEditEarnings(p.earnings_breakdown || [])
      setEditDeductions(p.deductions_breakdown || [])
      setEditWorkingDays(p.working_days || 30)
      setEditPaidDays(p.paid_days || 30)
      setEditLopDays(p.lop_days || 0)
      setEditStatus(p.status)
      setEditNotes(p.notes || '')
      setEditPeriodStartDate(p.period_start_date || '')
      setEditPeriodEndDate(p.period_end_date || '')
      setEditPaymentDate(p.payment_date || '')
    }
  }

  // Open Salary Profile Edit modal
  function openEditProfile(member: Profile) {
    const sp = salaryMap.get(member.id)
    const base = sp?.base_salary ? Number(sp.base_salary) : 0
    setEditingProfile(member)
    setProfCurrency(sp?.currency || 'SAR')
    setProfBaseSalary(calculateSalarySplitFromGross(base).basic)
    setProfGrossPackage(base)
    setProfJoiningDate(sp?.joining_date || '2025-12-01')
    const defaultDesignation =
      member.role === 'SALES_MANAGER' ? 'Sales Manager' :
      member.role === 'AGENT' ? 'Sales Agent' :
      member.role === 'ADMIN' ? 'Administrator' :
      member.role === 'EMPLOYEE' ? 'Technical Staff' : 'Specialist';
    setProfDesignation(sp?.designation || defaultDesignation)
    setProfDepartment(sp?.department || 'Sales & Leasing')
    const initials = member.name ? member.name.slice(0, 2).toUpperCase() : 'AS'
    const idSnippet = member.id ? member.id.slice(0, 4).toUpperCase() : '001'
    setProfEmpCode(sp?.employee_code || `ASH-${initials}-${idSnippet}`)
    setProfBankName(sp?.bank_name || '')
    setProfAccNo(sp?.account_number || '')
    setProfIfscIban(sp?.ifsc_or_iban || '')
    setProfPanIqama(sp?.pan_or_iqama || '')

    // History inputs reset
    setModalActiveTab('profile')
    setHistId(null)
    setHistBaseSalary('')
    setHistCurrency(sp?.currency || 'SAR')
    setHistStartDate('')
    setHistEndDate('')

    // Fetch history
    fetchSalaryHistory(member.id)
  }

  // Save Salary History Period
  async function handleSaveHistoryItem(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProfile) return
    if (!histStartDate || !histBaseSalary) {
      showToast('Start date and salary package are required', 'warning')
      return
    }
    setSavingHistoryItem(true)
    try {
      const url = '/api/payroll/salary-history'
      const method = histId ? 'PUT' : 'POST'
      const payload = {
        id: histId,
        profile_id: editingProfile.id,
        base_salary: Number(histBaseSalary),
        currency: histCurrency,
        start_date: histStartDate,
        end_date: histEndDate || null,
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to save salary period')

      showToast('Salary period saved successfully.', 'success')
      setHistId(null)
      setHistBaseSalary('')
      setHistStartDate('')
      setHistEndDate('')
      fetchSalaryHistory(editingProfile.id)
    } catch (err: any) {
      showToast(err.message || 'Error saving salary period', 'danger')
    } finally {
      setSavingHistoryItem(false)
    }
  }

  // Delete Salary History Period
  async function handleDeleteHistoryItem(id: string) {
    if (!editingProfile) return
    if (!confirm('Are you sure you want to delete this salary period?')) return
    try {
      const res = await fetch(`/api/payroll/salary-history?id=${id}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to delete salary period')

      showToast('Salary period deleted.', 'success')
      fetchSalaryHistory(editingProfile.id)
    } catch (err: any) {
      showToast(err.message || 'Error deleting salary period', 'danger')
    }
  }

  // Save Salary Profile
  async function handleSaveSalaryProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProfile) return
    setSavingProfile(true)
    try {
      const gross = profGrossPackage || profBaseSalary || 0
      const split = calculateSalarySplitFromGross(gross)

      const res = await fetch('/api/payroll/salary-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: editingProfile.id,
          currency: profCurrency,
          base_salary: gross,
          joining_date: profJoiningDate,
          designation: profDesignation,
          department: profDepartment,
          employee_code: profEmpCode,
          bank_name: profBankName,
          account_number: profAccNo,
          ifsc_or_iban: profIfscIban,
          pan_or_iqama: profPanIqama,
          default_allowances: [
            { id: 'hra', name: 'House Rent Allowance (HRA)', amount: split.hra },
            { id: 'special', name: 'Special Allowance', amount: split.specialAllowance },
          ],
          default_deductions: getDefaultStatutoryDeductions(profCurrency),
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to save salary profile')

      setSalaryProfiles((prev) => {
        const filtered = prev.filter((s) => s.profile_id !== editingProfile.id)
        return [...filtered, result.data]
      })
      setEditingProfile(null)
      showToast('Salary profile saved successfully.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error saving salary profile', 'danger')
    } finally {
      setSavingProfile(false)
    }
  }

  // Trigger Batch / Monthly Generation
  async function handleGenerateMonthly(e: React.FormEvent) {
    e.preventDefault()

    if (genTargetMode === 'CUSTOM' && selectedMemberIds.size === 0) {
      showToast('Please select at least one team member.', 'warning')
      return
    }

    const targetEmployeeIds = genTargetMode === 'CUSTOM' ? Array.from(selectedMemberIds) : null

    setGenerating(true)
    try {
      const res = await fetch('/api/payroll/generate-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: genMonth,
          year: genYear,
          mode: genMode,
          employeeIds: targetEmployeeIds,
          overwriteExisting: false,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to generate payslips')

      const refreshRes = await fetch('/api/payroll/payslips')
      if (refreshRes.ok) {
        const refreshResult = await refreshRes.json()
        setPayslips(refreshResult.data || [])
      }

      if (result.generatedCount === 0) {
        if (result.skippedAlreadyExists > 0 && result.skippedPriorToJoining > 0) {
          showToast('Selected period has existing payslips or is prior to joining date. 0 new payslips generated.', 'warning')
        } else if (result.skippedAlreadyExists > 0) {
          showToast('Payslip already exists for the selected period. 0 new payslips generated.', 'warning')
        } else if (result.skippedPriorToJoining > 0) {
          showToast('Selected period is prior to joining date. 0 new payslips generated.', 'warning')
        } else {
          showToast('No new payslips were generated for this period.', 'warning')
        }
      } else {
        showToast(`Successfully generated ${result.generatedCount} payslips!`, 'success')
      }
      setShowGenerateModal(false)
    } catch (err: any) {
      showToast(err.message || 'Error generating payslips', 'danger')
    } finally {
      setGenerating(false)
    }
  }

  // Open Payslip Edit Drawer
  function openEditPayslip(p: Payslip) {
    setEditingPayslip(p)
    setEditEarnings(p.earnings_breakdown || [{ id: 'basic', name: 'Basic Salary', amount: p.base_salary }])
    setEditDeductions(p.deductions_breakdown || [])
    setEditWorkingDays(p.working_days || 30)
    setEditPaidDays(p.paid_days || 30)
    setEditLopDays(p.lop_days || 0)
    setEditStatus(p.status)
    setEditNotes(p.notes || '')
    setEditPeriodStartDate(p.period_start_date || '')
    setEditPeriodEndDate(p.period_end_date || '')
    setEditPaymentDate(p.payment_date || '')
  }

  // Add line item to earnings or deductions
  function addEarningsItem() {
    setEditEarnings([...editEarnings, { id: `earn_${Date.now()}`, name: 'Bonus / Incentive', amount: 0 }])
  }
  function addDeductionsItem() {
    setEditDeductions([...editDeductions, { id: `ded_${Date.now()}`, name: 'Leave / Advance Deduction', amount: 0 }])
  }

  // Save Payslip Changes
  async function handleSavePayslipChanges(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPayslip) return
    setSavingPayslip(true)
    try {
      const res = await fetch('/api/payroll/payslips', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPayslip.id,
          currency: editingPayslip.currency,
          base_salary: editingPayslip.base_salary,
          earnings_breakdown: editEarnings,
          deductions_breakdown: editDeductions,
          working_days: editWorkingDays,
          paid_days: editPaidDays,
          lop_days: editLopDays,
          status: editStatus,
          notes: editNotes,
          period_start_date: editPeriodStartDate || null,
          period_end_date: editPeriodEndDate || null,
          payment_date: editPaymentDate || null,
          designation: editingPayslip.designation,
          department: editingPayslip.department,
          employee_code: editingPayslip.employee_code,
          bank_name: editingPayslip.bank_name,
          account_number: editingPayslip.account_number,
          ifsc_or_iban: editingPayslip.ifsc_or_iban,
          pan_or_iqama: editingPayslip.pan_or_iqama,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update payslip')

      setPayslips(payslips.map((p) => (p.id === editingPayslip.id ? result.data : p)))
      setEditingPayslip(null)
      showToast('Payslip changes saved successfully.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error updating payslip', 'danger')
    } finally {
      setSavingPayslip(false)
    }
  }

  // Delete Payslip
  async function handleDeletePayslip(id: string) {
    setConfirmModal({
      title: 'Delete Payslip',
      message: 'Are you sure you want to delete this payslip? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/payroll/payslips?id=${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete payslip')
          setPayslips(payslips.filter((p) => p.id !== id))
          showToast('Payslip deleted successfully.', 'success')
        } catch (err: any) {
          showToast(err.message || 'Error deleting payslip', 'danger')
        }
      }
    })
  }

  // -------------------------------------------------------------
  // PIN LOCK SCREEN
  // -------------------------------------------------------------
  if (!isUnlocked) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}>
        <div className="card" style={{
          maxWidth: 420,
          width: '100%',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
          border: '1px solid var(--border)',
          borderRadius: 16,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(30, 58, 138, 0.3)',
          }}>
            <Lock size={26} />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Asaheeb Payroll Vault
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
            Enter your admin PIN to access confidential salary structures, payroll runs, and payslips.
          </p>

          <form onSubmit={handleUnlock}>
            <div style={{ marginBottom: 16 }}>
              <input
                type="password"
                maxLength={8}
                autoFocus
                className="form-input"
                placeholder="Enter 4-digit PIN..."
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                style={{
                  textAlign: 'center',
                  fontSize: 22,
                  letterSpacing: '0.3em',
                  fontWeight: 700,
                  height: 48,
                }}
              />
              {pinError && (
                <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8, fontWeight: 500 }}>
                  {pinError}
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 44, fontSize: 14, fontWeight: 600 }}>
              <Unlock size={16} /> Unlock Payroll Dashboard
            </button>
          </form>

          <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-tertiary)' }}>
            Protected by Asaheeb Security • Default PIN is <strong>1234</strong>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // DETAILED EMPLOYEE PROFILE VIEW (ASAHEEB REAL ESTATE THEME)
  // -------------------------------------------------------------
  if (editingProfile) {
    return (
      <div className="page-body no-print" style={{ width: '100%', maxWidth: 1280, margin: '24px auto', padding: '0 24px' }}>
        {/* Back navigation header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 16
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditingProfile(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-page-title" style={{ margin: 0, fontSize: 20, color: '#1E3A8A' }}>
                Payroll Profile: {editingProfile.name}
              </h1>
              {editingProfile.is_active === false && (
                <span className="badge badge-danger" style={{ fontSize: 11 }}>
                  Deactivated Account
                </span>
              )}
            </div>
            <p className="text-meta" style={{ margin: '6px 0 0 2px' }}>
              Email: <strong>{editingProfile.email}</strong> · Role: <strong>{editingProfile.role}</strong> · Default Joining Date: <strong>{profJoiningDate}</strong>
            </p>
          </div>
        </div>

        {/* Member Lifetime Financial Analytics Summary */}
        {(() => {
          const empPayslips = payslips.filter((p) => p.employee_id === editingProfile.id)
          const paidPayslips = empPayslips.filter((p) => p.status === 'PAID')
          const profileCurrency = profCurrency || 'SAR'

          let totalPaidConverted = 0
          let totalGrossConverted = 0
          let totalDeductionsConverted = 0

          paidPayslips.forEach((p) => {
            const slipCurrency = p.currency || 'SAR'
            const netPay = Number(p.net_pay) || 0
            totalPaidConverted += convertCurrency(netPay, slipCurrency, profileCurrency)
          })

          empPayslips.forEach((p) => {
            const slipCurrency = p.currency || 'SAR'
            const gross = Number(p.gross_earnings) || 0
            const deductions = Number(p.total_deductions) || 0
            totalGrossConverted += convertCurrency(gross, slipCurrency, profileCurrency)
            totalDeductionsConverted += convertCurrency(deductions, slipCurrency, profileCurrency)
          })

          const avgNet = empPayslips.length > 0 ? (totalGrossConverted - totalDeductionsConverted) / empPayslips.length : profBaseSalary

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}>
              {/* Total Net Paid */}
              <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Net Paid (Disbursed)
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1E3A8A', marginTop: 4 }}>
                  {formatCurrencyAmount(totalPaidConverted, profileCurrency)}
                </div>
                <div style={{ fontSize: 11.5, color: '#1E40AF', marginTop: 2 }}>
                  Across {paidPayslips.length} paid payslips
                </div>
              </div>

              {/* Total Cumulative Gross */}
              <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Gross Billed
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#15803D', marginTop: 4 }}>
                  {formatCurrencyAmount(totalGrossConverted, profileCurrency)}
                </div>
                <div style={{ fontSize: 11.5, color: '#166534', marginTop: 2 }}>
                  Across {empPayslips.length} periods
                </div>
              </div>

              {/* Total Deductions */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Deductions
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: totalDeductionsConverted > 0 ? 'var(--danger)' : 'var(--text-primary)', marginTop: 4 }}>
                  {formatCurrencyAmount(totalDeductionsConverted, profileCurrency)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Taxes, statutory &amp; custom
                </div>
              </div>

              {/* Average Monthly Net */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Average Net Salary
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1E3A8A', marginTop: 4 }}>
                  {formatCurrencyAmount(avgNet, profileCurrency)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Per cycle in {profileCurrency}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Tabbed Panel */}
        <div className="card" style={{ padding: 0, minHeight: 560, display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
          {/* TAB SELECTOR */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            padding: '0 20px',
            gap: 16,
            background: '#F8FAFC',
          }}>
            <button
              type="button"
              onClick={() => setModalActiveTab('profile')}
              style={{
                padding: '14px 8px',
                border: 'none',
                borderBottom: modalActiveTab === 'profile' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
                background: 'none',
                fontSize: 13.5,
                fontWeight: modalActiveTab === 'profile' ? 700 : 500,
                color: modalActiveTab === 'profile' ? '#1E3A8A' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Profile &amp; Banking
            </button>
            <button
              type="button"
              onClick={() => setModalActiveTab('history')}
              style={{
                padding: '14px 8px',
                border: 'none',
                borderBottom: modalActiveTab === 'history' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
                background: 'none',
                fontSize: 13.5,
                fontWeight: modalActiveTab === 'history' ? 700 : 500,
                color: modalActiveTab === 'history' ? '#1E3A8A' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Salary Period History
            </button>
            <button
              type="button"
              onClick={() => setModalActiveTab('payslips')}
              style={{
                padding: '14px 8px',
                border: 'none',
                borderBottom: modalActiveTab === 'payslips' ? '2.5px solid #1E3A8A' : '2.5px solid transparent',
                background: 'none',
                fontSize: 13.5,
                fontWeight: modalActiveTab === 'payslips' ? 700 : 500,
                color: modalActiveTab === 'payslips' ? '#1E3A8A' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Generated Payslips
            </button>
          </div>

          {/* TAB 1: PROFILE & BANKING SETTINGS */}
          {modalActiveTab === 'profile' && (
            <form onSubmit={handleSaveSalaryProfile} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              {loadingHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, minHeight: 300, color: 'var(--text-tertiary)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Loading active salary profile...</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, flexGrow: 1 }}>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {/* Currency */}
                      <div className="form-group" style={{ flex: '1 1 140px' }}>
                        <label className="form-label">Currency</label>
                        <select
                          className="select"
                          value={profCurrency}
                          onChange={(e) => setProfCurrency(e.target.value as PayslipCurrency)}
                          style={{ height: 38, width: '100%' }}
                        >
                          <option value="SAR">SAR (﷼) - Saudi Arabia</option>
                          <option value="USD">USD ($) - International</option>
                          <option value="INR">INR (₹) - India</option>
                        </select>
                      </div>

                      {/* Total Monthly Package */}
                      <div className="form-group" style={{ flex: '1 1 180px' }}>
                        <label className="form-label">Total Monthly Package (Gross/Net) *</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="e.g. 5000"
                          value={profGrossPackage || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0
                            setProfGrossPackage(val)
                            setProfBaseSalary(calculateSalarySplitFromGross(val).basic)
                          }}
                          required
                          style={{ height: 38 }}
                        />
                      </div>

                      {/* Joining Date */}
                      <div className="form-group" style={{ flex: '1 1 180px' }}>
                        <label className="form-label">Joining Date *</label>
                        <input
                          type="date"
                          className="form-input"
                          value={profJoiningDate}
                          onChange={(e) => setProfJoiningDate(e.target.value)}
                          required
                          style={{ height: 38 }}
                        />
                      </div>
                    </div>

                    {/* Basic Salary info banner */}
                    {(() => {
                      const currentTotal = profGrossPackage || 0
                      const splitObj = calculateSalarySplitFromGross(currentTotal)
                      return (
                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 14, borderRadius: 8, fontSize: 12 }}>
                          <div style={{ fontWeight: 700, color: '#1E3A8A', marginBottom: 6 }}>Realistic Salary Split Details:</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 3 }}>
                            <span>Basic Wage (80%):</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrencyAmount(splitObj.basic, profCurrency)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 3 }}>
                            <span>HRA (16%):</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrencyAmount(splitObj.hra, profCurrency)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 3 }}>
                            <span>Special Allowance (4%):</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrencyAmount(splitObj.specialAllowance, profCurrency)}</span>
                          </div>
                          <div style={{ borderTop: '1px dashed #CBD5E1', marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontWeight: 700 }}>
                            <span>Total Gross Pay = Net Pay (0 Deductions):</span>
                            <span>{formatCurrencyAmount(currentTotal, profCurrency)}</span>
                          </div>
                        </div>
                      )
                    })()}

                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {/* Designation */}
                      <div className="form-group" style={{ flex: '1 1 220px' }}>
                        <label className="form-label">Designation</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Sales Agent, Sales Manager"
                          value={profDesignation}
                          onChange={(e) => setProfDesignation(e.target.value)}
                          style={{ height: 38 }}
                        />
                      </div>

                      {/* Department */}
                      <div className="form-group" style={{ flex: '1 1 180px' }}>
                        <label className="form-label">Department</label>
                        <input
                          className="form-input"
                          placeholder="Sales & Leasing, Operations"
                          value={profDepartment}
                          onChange={(e) => setProfDepartment(e.target.value)}
                          style={{ height: 38 }}
                        />
                      </div>

                      {/* Employee Code */}
                      <div className="form-group" style={{ flex: '1 1 140px' }}>
                        <label className="form-label">Employee Code</label>
                        <input
                          className="form-input"
                          placeholder="e.g. ASH-001"
                          value={profEmpCode}
                          onChange={(e) => setProfEmpCode(e.target.value)}
                          style={{ height: 38 }}
                        />
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A', marginBottom: 12 }}>
                        Disbursement &amp; Tax Info
                      </div>

                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 180px' }}>
                          <label className="form-label">Bank Name</label>
                          <input
                            className="form-input"
                            placeholder="Al Rajhi, SNB, Riyad Bank, etc."
                            value={profBankName}
                            onChange={(e) => setProfBankName(e.target.value)}
                            style={{ height: 38 }}
                          />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 200px' }}>
                          <label className="form-label">Account Number</label>
                          <input
                            className="form-input"
                            placeholder="Bank Account Number"
                            value={profAccNo}
                            onChange={(e) => setProfAccNo(e.target.value)}
                            style={{ height: 38 }}
                          />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 180px' }}>
                          <label className="form-label">IBAN</label>
                          <input
                            className="form-input"
                            placeholder="SA1234..."
                            value={profIfscIban}
                            onChange={(e) => setProfIfscIban(e.target.value)}
                            style={{ height: 38 }}
                          />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 180px' }}>
                          <label className="form-label">Iqama / National ID</label>
                          <input
                            className="form-input"
                            placeholder="1012345678"
                            value={profPanIqama}
                            onChange={(e) => setProfPanIqama(e.target.value)}
                            style={{ height: 38 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingProfile(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ fontWeight: 600 }}>
                      {savingProfile ? 'Saving...' : 'Save Salary Profile'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* TAB 2: SALARY PERIOD HISTORY */}
          {modalActiveTab === 'history' && (
            <div style={{ padding: 24, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <form onSubmit={handleSaveHistoryItem} style={{
                background: '#F8FAFC',
                padding: 16,
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                marginBottom: 20,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12, color: '#1E3A8A' }}>
                  {histId ? 'Edit Salary Period' : 'Add New Salary Period'}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {/* Currency */}
                  <div className="form-group" style={{ flex: '1 1 120px' }}>
                    <label className="form-label">Currency</label>
                    <select
                      className="select"
                      value={histCurrency}
                      onChange={(e) => setHistCurrency(e.target.value as PayslipCurrency)}
                      style={{ height: 38 }}
                    >
                      <option value="SAR">SAR (﷼)</option>
                      <option value="USD">USD ($)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>

                  {/* Gross Base Salary */}
                  <div className="form-group" style={{ flex: '1 1 150px' }}>
                    <label className="form-label">Base Salary Package</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 5000"
                      value={histBaseSalary}
                      onChange={(e) => setHistBaseSalary(e.target.value)}
                      required
                      style={{ height: 38 }}
                    />
                  </div>

                  {/* Start Date */}
                  <div className="form-group" style={{ flex: '1 1 140px' }}>
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={histStartDate}
                      onChange={(e) => setHistStartDate(e.target.value)}
                      required
                      style={{ height: 38 }}
                    />
                  </div>

                  {/* End Date */}
                  <div className="form-group" style={{ flex: '1 1 140px' }}>
                    <label className="form-label">End Date (Optional)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={histEndDate}
                      onChange={(e) => setHistEndDate(e.target.value)}
                      style={{ height: 38 }}
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={savingHistoryItem} style={{ height: 38 }}>
                      {savingHistoryItem ? 'Saving...' : histId ? 'Update' : 'Add Period'}
                    </button>
                    {histId && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ height: 38 }}
                        onClick={() => {
                          setHistId(null)
                          setHistBaseSalary('')
                          setHistStartDate('')
                          setHistEndDate('')
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {/* Salary Periods List */}
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, color: '#1E3A8A' }}>
                Salary Revision Timeline
              </div>

              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#64748B' }}>Loading salary timeline...</div>
              ) : salaryHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, background: '#F8FAFC', border: '1px dashed #CBD5E1', color: '#64748B', borderRadius: 8 }}>
                  No salary intervals defined yet. All generated payslips will use the default base package.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Base Salary</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryHistory.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 700, color: '#1E3A8A' }}>
                            {formatCurrencyAmount(item.base_salary, item.currency)}
                          </td>
                          <td>
                            {new Date(item.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td>
                            {item.end_date ? (
                              new Date(item.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: 10 }}>Active</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              style={{ marginRight: 8 }}
                              onClick={() => {
                                setHistId(item.id)
                                setHistBaseSalary(String(item.base_salary))
                                setHistCurrency(item.currency)
                                setHistStartDate(item.start_date)
                                setHistEndDate(item.end_date || '')
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDeleteHistoryItem(item.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GENERATED PAYSLIPS HISTORY */}
          {modalActiveTab === 'payslips' && (() => {
            const empPayslips = payslips
              .filter((p) => p.employee_id === editingProfile.id)
              .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year
                return b.month - a.month
              })

            return (
              <div style={{ padding: 24, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12, color: '#1E3A8A' }}>
                  Generated Payslip History ({empPayslips.length})
                </div>

                {empPayslips.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, background: '#F8FAFC', border: '1px dashed #CBD5E1', color: '#64748B', borderRadius: 8 }}>
                    No payslips generated for this employee yet.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th style={{ textAlign: 'right' }}>Gross Pay</th>
                          <th style={{ textAlign: 'right' }}>Deductions</th>
                          <th style={{ textAlign: 'right' }}>Net Pay</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empPayslips.map((p) => {
                          const monthStr = getMonthName(p.month)
                          return (
                            <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => redirectToRegistry(p, 'view')}>
                              <td style={{ fontWeight: 600 }}>
                                {monthStr} {p.year}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {formatCurrencyAmount(p.gross_earnings, p.currency)}
                              </td>
                              <td style={{ textAlign: 'right', color: p.total_deductions > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                                {p.total_deductions > 0 ? `- ${formatCurrencyAmount(p.total_deductions, p.currency)}` : '0.00'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: '#1E3A8A' }}>
                                {formatCurrencyAmount(p.net_pay, p.currency)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${p.status === 'PAID' ? 'badge-success' : 'badge-secondary'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ marginRight: 6 }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    redirectToRegistry(p, 'view')
                                  }}
                                  title="View Payslip"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ marginRight: 6 }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    redirectToRegistry(p, 'edit')
                                  }}
                                  title="Edit Details"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(`Are you sure you want to delete the payslip for ${monthStr} ${p.year}?`)) {
                                      handleDeletePayslip(p.id)
                                    }
                                  }}
                                  title="Delete Payslip"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // UNLOCKED DASHBOARD VIEW (ASAHEEB REAL ESTATE)
  // -------------------------------------------------------------
  return (
    <>
      <div className="page-body no-print" style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Top Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="text-page-title" style={{ margin: 0 }}>
                Executive Payroll &amp; Payslips
              </h1>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} /> Vault Unlocked
              </span>
            </div>
            <p className="text-meta" style={{ marginTop: 2 }}>
              Multi-currency payroll, automated monthly runs, zero-deduction compliance, and custom salary management.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowChangePin(true)}
              title="Change Security PIN"
            >
              <Settings size={14} /> Change PIN
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openGenerateModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} /> Run / Backfill Payroll
            </button>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleLock}
              title="Lock Vault"
              style={{ color: 'var(--danger)', borderColor: 'var(--border)' }}
            >
              <Lock size={14} /> Lock
            </button>
          </div>
        </div>

        {/* METRIC CARDS (SAUDI REAL ESTATE FOCUS) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}>
          {/* Saudi Payroll Disbursed */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
              <span>🇸🇦</span> Saudi Payroll (SAR)
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1E3A8A', marginTop: 4 }}>
              {formatCurrencyAmount(metrics.sarDisbursed, 'SAR')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Total net pay across filtered SAR records
            </div>
          </div>

          {/* Active Monthly Salary Commitment */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
              <Landmark size={14} /> Active Commitment (SAR)
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
              {formatCurrencyAmount(metrics.monthlySalaryCommitment, 'SAR')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Monthly allocation for active staff
            </div>
          </div>

          {/* Team Members Count */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
              <Users size={14} /> Total Staff &amp; Agents
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {metrics.activeMembers} Members
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Configurable salary profiles on file
            </div>
          </div>

          {/* Payslips Count */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
              <FileText size={14} /> Generated Payslips
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4F46E5', marginTop: 4 }}>
              {metrics.totalCount} Total
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {metrics.totalPaid} marked as Paid
            </div>
          </div>
        </div>

        {/* MAIN TABS NAVIGATION WITH SLEEK ASAHEEB STYLING */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setActiveTab('payslips')}
            style={{
              padding: '9px 16px',
              borderRadius: 'var(--radius)',
              fontWeight: 700,
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: activeTab === 'payslips' ? '1px solid #1E3A8A' : '1px solid var(--border)',
              cursor: 'pointer',
              background: activeTab === 'payslips' ? '#1E3A8A' : 'var(--card-bg)',
              color: activeTab === 'payslips' ? '#FFFFFF' : 'var(--text-primary)',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={14} />
            Payslips Registry ({filteredPayslips.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('salary_profiles')}
            style={{
              padding: '9px 16px',
              borderRadius: 'var(--radius)',
              fontWeight: 700,
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: activeTab === 'salary_profiles' ? '1px solid #1E3A8A' : '1px solid var(--border)',
              cursor: 'pointer',
              background: activeTab === 'salary_profiles' ? '#1E3A8A' : 'var(--card-bg)',
              color: activeTab === 'salary_profiles' ? '#FFFFFF' : 'var(--text-primary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={14} />
            Team Salary Profiles ({activeTeamMembers.length})
          </button>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* TAB 1: PAYSLIPS REGISTRY */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'payslips' && (
          <div>
            {/* Filters Bar */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ flex: '1 1 220px', position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    className="form-input"
                    placeholder="Search by employee name, code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: 34, height: 38 }}
                  />
                </div>

                {/* Financial Year Filter */}
                <div style={{ flex: '0 0 auto' }}>
                  <select
                    className="select"
                    value={selectedFY}
                    onChange={(e) => setSelectedFY(e.target.value)}
                    style={{ minWidth: 140, height: 38 }}
                  >
                    <option value="ALL">All Financial Years</option>
                    {availableFYs.map((fy) => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>

                {/* Month Filter */}
                <div style={{ flex: '0 0 auto' }}>
                  <select
                    className="select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ minWidth: 130, height: 38 }}
                  >
                    <option value="ALL">All Months</option>
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={(idx + 1).toString()}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* Currency Filter */}
                <div style={{ flex: '0 0 auto' }}>
                  <select
                    className="select"
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    style={{ minWidth: 120, height: 38 }}
                  >
                    <option value="ALL">All Currencies</option>
                    <option value="SAR">SAR (﷼)</option>
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bulk Selection Action Bar */}
            {selectedPayslipIds.size > 0 && (
              <div style={{
                background: '#1E3A8A',
                color: '#ffffff',
                padding: '12px 18px',
                borderRadius: 'var(--radius)',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    {selectedPayslipIds.size} payslip{selectedPayslipIds.size > 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPayslipIds(new Set())}
                    style={{ background: 'none', border: 'none', color: '#93C5FD', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12 }}
                  >
                    Deselect all
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleBulkDeletePayslips}
                    disabled={deletingBulk}
                    className="btn btn-sm"
                    style={{ background: '#DC2626', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  >
                    <Trash2 size={14} />
                    {deletingBulk ? 'Deleting...' : `Delete Selected (${selectedPayslipIds.size})`}
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="table-responsive" style={{ overflowX: 'hidden', width: '100%' }}>
                <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '4%', textAlign: 'center', paddingLeft: 0 }}>
                        <input
                          type="checkbox"
                          checked={filteredPayslips.length > 0 && selectedPayslipIds.size === filteredPayslips.length}
                          onChange={toggleSelectAllPayslips}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                          title="Select All"
                        />
                      </th>
                      <th style={{ width: '22%' }}>Employee</th>
                      <th style={{ width: '14%', textAlign: 'center' }}>Period / FY</th>
                      <th style={{ width: '11%', textAlign: 'right' }}>Gross Pay</th>
                      <th style={{ width: '11%', textAlign: 'right' }}>Deductions</th>
                      <th style={{ width: '11%', textAlign: 'right' }}>Net Pay</th>
                      <th style={{ width: '11%', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '16%', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayslips.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                           No payslips found matching your filters. Click <strong>"Run / Backfill Payroll"</strong> to generate.
                        </td>
                      </tr>
                    ) : (
                      filteredPayslips.map((p) => {
                        const monthName = getMonthName(p.month)
                        const isSelected = selectedPayslipIds.has(p.id)

                        return (
                          <tr
                            key={p.id}
                            style={{
                              background: isSelected ? 'var(--accent-light)' : undefined,
                              cursor: 'pointer',
                            }}
                            onClick={() => setViewingPayslip(p)}
                          >
                            {/* Checkbox */}
                            <td style={{ textAlign: 'center', paddingLeft: 0 }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectPayslip(p.id)}
                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                              />
                            </td>

                            {/* Employee */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: '50%',
                                  background: '#1E3A8A',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}>
                                  {p.employee?.name?.slice(0, 2).toUpperCase() || 'AS'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.employee?.name ?? 'Employee'}>
                                    {p.employee?.name ?? 'Employee'}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.employee_code || p.designation || 'Staff'}>
                                    {p.employee_code || p.designation || 'Staff'} • {p.currency}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Period */}
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {monthName} {p.year}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                {p.financial_year}
                              </div>
                            </td>

                            {/* Gross Pay */}
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>
                              {formatCurrencyAmount(p.gross_earnings, p.currency)}
                            </td>

                            {/* Deductions */}
                            <td style={{ textAlign: 'right', color: p.total_deductions > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                              {p.total_deductions > 0 ? `- ${formatCurrencyAmount(p.total_deductions, p.currency)}` : '0.00'}
                            </td>

                            {/* Net Pay */}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#1E3A8A', fontSize: 14 }}>
                              {formatCurrencyAmount(p.net_pay, p.currency)}
                            </td>

                            {/* Status */}
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${p.status === 'PAID' ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: 11 }}>
                                {p.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => setViewingPayslip(p)}
                                  title="View & Print Payslip"
                                  style={{ padding: '3px 8px' }}
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => openEditPayslip(p)}
                                  title="Edit Line Items / Salary"
                                  style={{ padding: '3px 8px' }}
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => handleDeletePayslip(p.id)}
                                  title="Delete Payslip"
                                  style={{ padding: '3px 8px', color: 'var(--danger)' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 2: TEAM SALARY PROFILES */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'salary_profiles' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Header Bar */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  Configured Salary Profiles
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Showing <strong>{(showInactiveProfiles ? teamMembers : activeTeamMembers).length}</strong> members ({activeTeamMembers.length} active{inactiveTeamMembers.length > 0 ? `, ${inactiveTeamMembers.length} deactivated` : ''})
                </div>
              </div>

              {inactiveTeamMembers.length > 0 && (
                <button
                  type="button"
                  className={`btn btn-xs ${showInactiveProfiles ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setShowInactiveProfiles(!showInactiveProfiles)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>{showInactiveProfiles ? '✓ Showing Deactivated' : 'Show Deactivated Staff'}</span>
                  <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                    {inactiveTeamMembers.length}
                  </span>
                </button>
              )}
            </div>

            <div className="table-responsive" style={{ overflowX: 'hidden', width: '100%' }}>
              <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Team Member</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Role</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>Joining Date</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>Currency</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Base Salary</th>
                    <th style={{ width: '18%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(showInactiveProfiles ? teamMembers : activeTeamMembers).map((member) => {
                    const sp = salaryMap.get(member.id)
                    const joiningDate = sp?.joining_date || '2025-12-01'
                    const isMemberActive = member.is_active !== false

                    const todayStr = new Date().toISOString().split('T')[0]
                    const active = allSalaryHistories.find((h) => {
                      return h.profile_id === member.id && h.start_date <= todayStr && (!h.end_date || h.end_date >= todayStr)
                    })
                    const currency = active ? active.currency : (sp?.currency || 'SAR')
                    const baseSalary = active ? Number(active.base_salary) : (sp?.base_salary ? Number(sp.base_salary) : 0)

                    return (
                      <tr
                        key={member.id}
                        style={{
                          cursor: 'pointer',
                          opacity: isMemberActive ? 1 : 0.65,
                        }}
                        onClick={() => openEditProfile(member)}
                      >
                        {/* Name */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: '#1E3A8A',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: isMemberActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={member.name}>
                                {member.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={member.email}>
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-secondary" style={{ fontSize: 11 }}>
                            {member.role === 'ADMIN' ? 'ADMIN' :
                             member.role === 'SALES_MANAGER' ? 'SALES MANAGER' :
                             member.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'SALES AGENT'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ textAlign: 'center' }}>
                          {isMemberActive ? (
                            <span className="badge badge-success" style={{ fontSize: 11 }}>
                              Active
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ fontSize: 11 }}>
                              Deactivated
                            </span>
                          )}
                        </td>

                        {/* Joining Date */}
                        <td style={{ textAlign: 'center', fontSize: 13 }}>
                          {joiningDate}
                        </td>

                        {/* Currency */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-secondary" style={{ fontSize: 11, fontWeight: 700 }}>
                            {currency}
                          </span>
                        </td>

                        {/* Base Salary */}
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#1E3A8A' }}>
                          {baseSalary > 0 ? formatCurrencyAmount(baseSalary, currency) : (
                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 12 }}>Not set</span>
                          )}
                        </td>

                        {/* Action */}
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => openEditProfile(member)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Edit3 size={12} /> Configure Salary
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* MODAL 1: RUN / BACKFILL PAYROLL */}
      {/* ----------------------------------------------------------- */}
      {showGenerateModal && (
        <div className="modal-backdrop" onClick={() => setShowGenerateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '100%' }}>
            <div className="modal-header">
              <span className="modal-title">Run / Backfill Payroll</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowGenerateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleGenerateMonthly}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  Automatically computes earnings with <strong>zero default deductions</strong>. Existing customized payslips will not be overwritten.
                </div>

                {/* Mode */}
                <div className="form-group">
                  <label className="form-label">Generation Mode</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="genMode"
                        value="CURRENT_MONTH"
                        checked={genMode === 'CURRENT_MONTH'}
                        onChange={() => setGenMode('CURRENT_MONTH')}
                      />
                      Single Target Month
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="genMode"
                        value="BACKFILL_FROM_JOINING"
                        checked={genMode === 'BACKFILL_FROM_JOINING'}
                        onChange={() => setGenMode('BACKFILL_FROM_JOINING')}
                      />
                      Backfill All Months from Joining Date
                    </label>
                  </div>
                </div>

                {/* Target Month & Year */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Month</label>
                    <select
                      className="select"
                      value={genMonth}
                      onChange={(e) => setGenMonth(Number(e.target.value))}
                      style={{ width: '100%', height: 38 }}
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx + 1}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input
                      type="number"
                      className="form-input"
                      value={genYear}
                      onChange={(e) => setGenYear(Number(e.target.value))}
                      min={2020}
                      max={2035}
                      style={{ width: '100%', height: 38 }}
                    />
                  </div>
                </div>

                {/* Team Member Selection */}
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Target Team Members</label>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="genTargetMode"
                          checked={genTargetMode === 'ALL'}
                          onChange={() => {
                            setGenTargetMode('ALL')
                            selectAllMembers()
                          }}
                        />
                        All Active ({activeTeamMembers.length})
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="genTargetMode"
                          checked={genTargetMode === 'CUSTOM'}
                          onChange={() => setGenTargetMode('CUSTOM')}
                        />
                        Select Specific ({selectedMemberIds.size})
                      </label>
                    </div>
                  </div>

                  {genTargetMode === 'CUSTOM' ? (
                    <div style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: 10,
                      background: '#F8FAFC',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: 8,
                        marginBottom: 8,
                        borderBottom: '1px solid var(--border)',
                        fontSize: 12,
                      }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          <strong>{selectedMemberIds.size}</strong> of {activeTeamMembers.length} selected
                        </span>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button
                            type="button"
                            onClick={selectAllMembers}
                            className="btn btn-ghost btn-xs"
                            style={{ padding: 0, color: 'var(--accent)', fontWeight: 600 }}
                          >
                            Select All
                          </button>
                          <span style={{ color: 'var(--border)' }}>|</span>
                          <button
                            type="button"
                            onClick={clearAllMembers}
                            className="btn btn-ghost btn-xs"
                            style={{ padding: 0, color: 'var(--danger)', fontWeight: 600 }}
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {activeTeamMembers.map((m) => {
                          const isSelected = selectedMemberIds.has(m.id)
                          return (
                            <label
                              key={m.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: isSelected ? '#FFFFFF' : 'transparent',
                                border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleMemberSelection(m.id)}
                                  style={{ cursor: 'pointer', width: 15, height: 15 }}
                                />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: 'var(--text-primary)' }}>
                                    {m.name}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    {m.email}
                                  </div>
                                </div>
                              </div>
                              <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                                {m.specialization || m.role}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px', background: '#F8FAFC', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      Generating for all <strong>{activeTeamMembers.length} active team members</strong>.
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowGenerateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={generating} style={{ fontWeight: 600 }}>
                  {generating ? 'Generating...' : genMode === 'BACKFILL_FROM_JOINING' ? 'Backfill All Historical Payslips' : 'Generate Monthly Payslips'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL 3: EDIT PAYSLIP LINE ITEMS & DYNAMIC SALARY */}
      {/* ----------------------------------------------------------- */}
      {editingPayslip && (
        <div className="modal-backdrop" onClick={() => setEditingPayslip(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">
                  Edit Payslip: {editingPayslip.employee?.name}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {getMonthName(editingPayslip.month)} {editingPayslip.year} ({editingPayslip.currency})
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingPayslip(null)}>✕</button>
            </div>

            <form onSubmit={handleSavePayslipChanges}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Working Days & Status */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius)' }}>
                  <div className="form-group">
                    <label className="form-label">Working Days</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editWorkingDays}
                      onChange={(e) => setEditWorkingDays(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Paid Days</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editPaidDays}
                      onChange={(e) => setEditPaidDays(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Loss of Pay (LOP)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editLopDays}
                      onChange={(e) => setEditLopDays(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="select"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as PayslipStatus)}
                      style={{ height: 38 }}
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </div>
                </div>

                {/* Salary Period & Payment Date */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius)' }}>
                  <div className="form-group">
                    <label className="form-label">Salary Period Start</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editPeriodStartDate}
                      onChange={(e) => setEditPeriodStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary Period End</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editPeriodEndDate}
                      onChange={(e) => setEditPeriodEndDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editPaymentDate}
                      onChange={(e) => setEditPaymentDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Earnings Line Items */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                      Earnings Line Items
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => {
                          const currentGross = editEarnings.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
                          const split = calculateSalarySplitFromGross(currentGross || editingPayslip.base_salary)
                          setEditEarnings([
                            { id: 'basic', name: 'Basic Salary', amount: split.basic },
                            { id: 'hra', name: 'House Rent Allowance (HRA)', amount: split.hra },
                            { id: 'special', name: 'Special Allowance', amount: split.specialAllowance },
                          ])
                        }}
                      >
                        ⚡ Apply 80/16/4 Split
                      </button>
                      <button type="button" className="btn btn-outline btn-xs" onClick={addEarningsItem}>
                        <Plus size={12} /> Add Item / Bonus
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editEarnings.map((item, idx) => (
                      <div key={item.id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          placeholder="e.g. Basic Salary, Incentive, Bonus"
                          value={item.name}
                          onChange={(e) => {
                            const updated = [...editEarnings]
                            updated[idx].name = e.target.value
                            setEditEarnings(updated)
                          }}
                          style={{ flex: 2 }}
                        />
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={(e) => {
                            const updated = [...editEarnings]
                            updated[idx].amount = Number(e.target.value) || 0
                            setEditEarnings(updated)
                          }}
                          style={{ flex: 1 }}
                        />
                        {editEarnings.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setEditEarnings(editEarnings.filter((_, i) => i !== idx))}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deductions Line Items */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                      Deductions Line Items (Default: 0)
                    </label>
                    <button type="button" className="btn btn-outline btn-xs" onClick={addDeductionsItem}>
                      <Plus size={12} /> Add Custom Deduction
                    </button>
                  </div>

                  {editDeductions.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '6px 0' }}>
                      No deductions applied (Zero deduction policy).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {editDeductions.map((item, idx) => (
                        <div key={item.id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="form-input"
                            placeholder="e.g. Unpaid Leave, Salary Advance"
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...editDeductions]
                              updated[idx].name = e.target.value
                              setEditDeductions(updated)
                            }}
                            style={{ flex: 2 }}
                          />
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Amount"
                            value={item.amount}
                            onChange={(e) => {
                              const updated = [...editDeductions]
                              updated[idx].amount = Number(e.target.value) || 0
                              setEditDeductions(updated)
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setEditDeductions(editDeductions.filter((_, i) => i !== idx))}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Notes / Remarks</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Performance remarks or payment notes..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>

                {/* Live Computed Summary */}
                {(() => {
                  const gross = editEarnings.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
                  const ded = editDeductions.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
                  const net = Math.max(0, gross - ded)
                  return (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#F8FAFC',
                      padding: 14,
                      borderRadius: 'var(--radius)',
                      fontWeight: 700,
                    }}>
                      <span>Net Calculated Payout:</span>
                      <span style={{ fontSize: 18, color: '#1E3A8A' }}>
                        {formatCurrencyAmount(net, editingPayslip.currency)}
                      </span>
                    </div>
                  )
                })()}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditingPayslip(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPayslip} style={{ fontWeight: 600 }}>
                  {savingPayslip ? 'Saving...' : 'Save Payslip Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL 4: CHANGE SECURITY PIN */}
      {/* ----------------------------------------------------------- */}
      {showChangePin && (
        <div className="modal-backdrop" onClick={() => setShowChangePin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Update Vault PIN</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowChangePin(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveNewPin}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New 4-Digit Security PIN</label>
                  <input
                    type="password"
                    maxLength={8}
                    className="form-input"
                    placeholder="e.g. 5678"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowChangePin(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Save New PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL 5: PAYSLIP DOCUMENT VIEWER & PRINT */}
      {/* ----------------------------------------------------------- */}
      {viewingPayslip && (
        <PayslipDocument
          payslip={viewingPayslip}
          onClose={() => setViewingPayslip(null)}
        />
      )}

      {/* Floating Action Toast Notification Feedback */}
      {toastFeedback && (
        <div className="no-print" style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 99999,
          background: toastFeedback.type === 'danger' ? '#EF4444' : toastFeedback.type === 'warning' ? '#F59E0B' : '#10B981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.25)',
          fontSize: 13.5,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {toastFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastFeedback.message}</span>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: '100%' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={18} /> {confirmModal.title}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {confirmModal.message}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', fontWeight: 600 }}
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal(null)
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
