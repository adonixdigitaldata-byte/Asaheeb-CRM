'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Clock,
  MapPin,
  Calendar,
  Users,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  Filter,
  Plus,
  Compass,
  Search,
  ExternalLink,
  UserCheck,
  Eye,
  Briefcase,
  TrendingDown,
  TrendingUp,
  Activity,
  Award,
  Scan,
  Banknote,
  Edit3,
  AlertCircle,
  Check,
  X,
  Trash2,
} from 'lucide-react'
import {
  CompanyLocation,
  AttendanceLog,
  LeaveBalance,
  LeaveRequest,
  RosterEmployee,
  CompanyWorkPolicy,
  MonthlyWorkHoursAudit,
} from '@/types/attendance'
import {
  fetchOfficeLocation,
  fetchTodayAttendance,
  fetchUserAttendanceHistory,
  fetchAdminDailyRoster,
  fetchPendingExceptions,
  fetchLeaveBalances,
  fetchUserLeaveRequests,
  fetchAllLeaveRequests,
  reviewLeaveRequest,
  fetchCompanyWorkPolicy,
  DEFAULT_WORK_POLICY,
  fetchMonthlyWorkHoursAudit,
  regularizeAttendanceLog,
  calculateExpectedHoursInMonth,
  fetchUserSalaryProfile,
  parseRegularizationRequestNotes,
  quickApproveRegularization,
  rejectRegularizationRequest,
  deleteAttendanceLog,
  formatTo24HourTime,
  formatDisplayTime,
} from '@/lib/attendanceService'
import { formatDistance } from '@/lib/geoUtils'
import PunchModal from '@/components/attendance/PunchModal'
import OfficeSettingsModal from '@/components/attendance/OfficeSettingsModal'
import LeaveRequestModal from '@/components/attendance/LeaveRequestModal'
import ExceptionReviewModal from '@/components/attendance/ExceptionReviewModal'
import EmployeeAttendanceDetailModal from '@/components/attendance/EmployeeAttendanceDetailModal'
import WorkPolicyModal from '@/components/attendance/WorkPolicyModal'
import RegularizeAttendanceModal from '@/components/attendance/RegularizeAttendanceModal'
import FaceEnrollmentModal from '@/components/attendance/FaceEnrollmentModal'
import BiometricManagementModal from '@/components/attendance/BiometricManagementModal'
import TestBiometricModal from '@/components/attendance/TestBiometricModal'
import Pagination from '@/components/Pagination'
import ConfirmModal from '@/components/ConfirmModal'
import { getEmployeeFaceEnrollment } from '@/lib/biometricEngine'
import type { Profile } from '@/types/database'

interface AttendanceClientProps {
  profile: Profile | null
}

export default function AttendanceClient({ profile }: AttendanceClientProps) {
  const role = profile?.role || 'AGENT'
  const isAdmin = role === 'ADMIN'
  const isManager = role === 'SALES_MANAGER'
  const canManage = isAdmin || isManager
  const userId = profile?.id || 'guest-user'

  // Tab State
  type TabType = 'ROSTER' | 'EXCEPTIONS' | 'REGULARIZATIONS' | 'LEAVES' | 'HOURS_AUDIT' | 'MY_LOGS' | 'MY_LEAVES'
  const [activeTab, setActiveTab] = useState<TabType>(canManage ? 'ROSTER' : 'MY_LOGS')
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -260 : 260,
        behavior: 'smooth',
      })
    }
  }

  // Core Data States
  const [office, setOffice] = useState<CompanyLocation>({
    id: 'default-jeddah',
    name: 'Jeddah Headquarters',
    address: 'Al-Andalus District, Prince Mohammed Bin Abdulaziz St, Jeddah',
    latitude: 21.5433,
    longitude: 39.1728,
    radius_meters: 150,
    is_active: true,
  })
  const [workPolicy, setWorkPolicy] = useState<CompanyWorkPolicy>(DEFAULT_WORK_POLICY)
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null)
  const [myHistory, setMyHistory] = useState<AttendanceLog[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance>({
    id: 'bal-1',
    user_id: userId,
    year: new Date().getFullYear(),
    annual_leave_total: 21,
    annual_leave_used: 0,
    sick_leave_total: 30,
    sick_leave_used: 0,
    unpaid_leave_used: 0,
    emergency_leave_used: 0,
  })
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([])
  const [adminRoster, setAdminRoster] = useState<RosterEmployee[]>([])
  const [pendingExceptions, setPendingExceptions] = useState<AttendanceLog[]>([])
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([])

  // Monthly Hours & Deficit Audit State
  const currentMonthStr = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const [selectedAuditMonth, setSelectedAuditMonth] = useState<string>(currentMonthStr)
  const [monthlyAuditList, setMonthlyAuditList] = useState<MonthlyWorkHoursAudit[]>([])
  const [auditExpectedDays, setAuditExpectedDays] = useState<number>(22)
  const [auditExpectedHours, setAuditExpectedHours] = useState<number>(176)
  const [auditExpectedToDateHours, setAuditExpectedToDateHours] = useState<number>(80)
  const [auditElapsedDays, setAuditElapsedDays] = useState<number>(10)
  const [auditLoading, setAuditLoading] = useState(false)
  const [mySalary, setMySalary] = useState<{ base_salary: number; currency: string; joining_date?: string | null } | null>(null)

  // Regularization Modal State
  const [regularizeModalOpen, setRegularizeModalOpen] = useState(false)
  const [regularizeLog, setRegularizeLog] = useState<AttendanceLog | null>(null)
  const [regularizeEmployeeName, setRegularizeEmployeeName] = useState('')

  // Initial Page Loading Spinner state
  const [pageInitialLoading, setPageInitialLoading] = useState(true)

  // Live Clock & Active Duration
  const [currentTime, setCurrentTime] = useState<string>('')
  const [activeWorkDuration, setActiveWorkDuration] = useState<string>('00h 00m')

  // Modals
  const [punchModalOpen, setPunchModalOpen] = useState(false)
  const [punchType, setPunchType] = useState<'IN' | 'OUT'>('IN')
  const [officeModalOpen, setOfficeModalOpen] = useState(false)
  const [workPolicyModalOpen, setWorkPolicyModalOpen] = useState(false)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false)
  const [selectedException, setSelectedException] = useState<AttendanceLog | null>(null)
  const [selectedExceptionType, setSelectedExceptionType] = useState<'IN' | 'OUT'>('IN')

  // Employee Detail Modal
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<RosterEmployee | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // Biometric Face ID Status & Modals
  const [hasFaceId, setHasFaceId] = useState<boolean>(false)
  const [faceEnrolledAt, setFaceEnrolledAt] = useState<string | null>(null)
  const [faceSnapshotUrl, setFaceSnapshotUrl] = useState<string | null>(null)
  const [biometricHubOpen, setBiometricHubOpen] = useState<boolean>(false)
  const [testScannerOpen, setTestScannerOpen] = useState<boolean>(false)
  const [faceEnrollModalOpen, setFaceEnrollModalOpen] = useState<boolean>(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'HQ' | 'REMOTE' | 'LEAVE' | 'ABSENT' | 'FLAGGED'>('ALL')
  const [exceptionsFilter, setExceptionsFilter] = useState<'ALL' | 'ACTION_NEEDED' | 'FLAGGED' | 'APPROVED'>('ACTION_NEEDED')
  const [regularizationsFilter, setRegularizationsFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [regularizeFeedbackMsg, setRegularizeFeedbackMsg] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null)
  const [isProcessingRegularizeId, setIsProcessingRegularizeId] = useState<string | null>(null)

  // In-app Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean
    record: AttendanceLog | null
    isDedicatedReq: boolean
  }>({
    isOpen: false,
    record: null,
    isDedicatedReq: false,
  })

  // Pagination states for all tables
  const [rosterPage, setRosterPage] = useState(1)
  const [rosterPageSize, setRosterPageSize] = useState(10)

  const [exceptionsPage, setExceptionsPage] = useState(1)
  const [exceptionsPageSize, setExceptionsPageSize] = useState(10)

  const [regularizationsPage, setRegularizationsPage] = useState(1)
  const [regularizationsPageSize, setRegularizationsPageSize] = useState(10)

  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize, setAuditPageSize] = useState(10)

  const [leavesPage, setLeavesPage] = useState(1)
  const [leavesPageSize, setLeavesPageSize] = useState(10)

  const [myHistoryPage, setMyHistoryPage] = useState(1)
  const [myHistoryPageSize, setMyHistoryPageSize] = useState(10)

  const [myLeavesPage, setMyLeavesPage] = useState(1)
  const [myLeavesPageSize, setMyLeavesPageSize] = useState(10)

  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const todayHoliday = useMemo(() => {
    return (workPolicy.official_holidays || []).find((h) => h.date === todayDateStr)
  }, [workPolicy.official_holidays, todayDateStr])

  // Reset pagination on filter or query change
  useEffect(() => {
    setRosterPage(1)
  }, [searchQuery, rosterFilter])

  useEffect(() => {
    setExceptionsPage(1)
  }, [exceptionsFilter])

  useEffect(() => {
    setRegularizationsPage(1)
  }, [regularizationsFilter])

  useEffect(() => {
    setAuditPage(1)
  }, [selectedAuditMonth])

  // Initial Load
  useEffect(() => {
    loadInitialData()
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [userId])

  // Recalculate Active Work Duration
  useEffect(() => {
    if (todayLog?.punch_in_at) {
      const updateDuration = () => {
        const inMs = new Date(todayLog.punch_in_at!).getTime()
        const endMs = todayLog.punch_out_at ? new Date(todayLog.punch_out_at).getTime() : Date.now()
        const totalMinutes = Math.max(0, Math.floor((endMs - inMs) / 60000))
        const hrs = Math.floor(totalMinutes / 60)
        const mins = totalMinutes % 60
        setActiveWorkDuration(
          `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`
        )
      }
      updateDuration()
      const interval = setInterval(updateDuration, 30000)
      return () => clearInterval(interval)
    } else {
      setActiveWorkDuration('00h 00m')
    }
  }, [todayLog])

  // Trigger monthly audit reload when month changes
  useEffect(() => {
    if (canManage && activeTab === 'HOURS_AUDIT') {
      loadMonthlyAudit(selectedAuditMonth)
    }
  }, [selectedAuditMonth, activeTab, canManage])

  // Live auto-refresh when attendance or policy updates occur
  useEffect(() => {
    const handleAttendanceUpdated = () => {
      loadInitialData()
      if (canManage) {
        loadMonthlyAudit(selectedAuditMonth)
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('asaheeb_attendance_updated', handleAttendanceUpdated)
      return () => {
        window.removeEventListener('asaheeb_attendance_updated', handleAttendanceUpdated)
      }
    }
  }, [canManage, selectedAuditMonth])

  // Personal Monthly Work Hours, Punctuality, Deficit & Pay Cut Statistics (aligned with Monthly Deficit Audit)
  const myMonthlyStats = useMemo(() => {
    let totalWorkedMinutes = 0
    let currentMonthWorkedMinutes = 0
    let lateDaysCount = 0
    let totalLateMinutes = 0
    let overtimeMinutes = 0

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentDay = now.getDate()
    const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
    const todayDateStr = now.toISOString().split('T')[0]

    // Check if user has personalized schedule or tracking exemption (identical to audit page)
    const empSchedule = workPolicy.custom_employee_schedules?.[userId]
    const isExempt =
      (workPolicy.exempt_employee_ids || []).includes(userId) ||
      Boolean(empSchedule?.is_exempt_from_tracking)

    const empShiftStart = empSchedule?.shift_start_time || workPolicy.shift_start_time || '08:00'
    const empGrace = empSchedule?.grace_period_mins ?? workPolicy.grace_period_mins ?? 15
    const empDailyHours = empSchedule?.daily_expected_hours ?? workPolicy.daily_expected_hours ?? 8
    const empWorkDays = empSchedule?.work_days || workPolicy.work_days || ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'SATURDAY']
    const empCustomDayHours = empSchedule?.custom_day_hours || workPolicy.custom_day_hours
    const empCustomDaySchedules = empSchedule?.custom_day_schedules || workPolicy.custom_day_schedules

    // Determine employee's effective tracking start date (tracking_start_date or employee joining_date, whichever is later)
    const effectiveStartDate = (() => {
      const dates: string[] = []
      if (workPolicy.tracking_start_date) dates.push(workPolicy.tracking_start_date)
      if (mySalary?.joining_date) dates.push(mySalary.joining_date)
      if (dates.length === 0) return null
      return dates.sort().pop() || null
    })()

    // Calculate Month-to-Date (MTD) elapsed expected hours considering effectiveStartDate (identical to audit page)
    const {
      count: totalExpectedDays,
      totalHours: totalExpectedHours,
      elapsedCount: mtdExpectedDays,
      elapsedHours: mtdExpectedHours,
    } = calculateExpectedHoursInMonth(
      currentYear,
      currentMonth,
      empWorkDays,
      empDailyHours,
      empCustomDayHours,
      workPolicy.official_holidays,
      undefined,
      effectiveStartDate
    )

    const [shiftH, shiftM] = empShiftStart.split(':').map(Number)
    const shiftHour = isNaN(shiftH) ? 8 : shiftH
    const shiftMinute = isNaN(shiftM) ? 0 : shiftM
    const graceMinutes = empGrace
    const shiftStartCutoffMinutes = shiftHour * 60 + shiftMinute + graceMinutes

    for (const log of myHistory) {
      // Determine expected hours configured for this specific day
      let dayExpectedHours = empDailyHours
      if (log.date) {
        const d = new Date(log.date + 'T00:00:00')
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
        if (empCustomDayHours && empCustomDayHours[dayName] !== undefined) {
          dayExpectedHours = empCustomDayHours[dayName]
        }
      }
      const dayExpectedMinutes = dayExpectedHours * 60

      let worked = log.total_working_minutes || 0
      // Fallback for unclosed shifts
      if (log.punch_in_at && !log.punch_out_at) {
        if (log.date < todayDateStr) {
          // If employee forgot to punch out on past date, calculate duration up to 17:00 EOD
          const inDate = new Date(log.punch_in_at)
          const inMinutes = inDate.getHours() * 60 + inDate.getMinutes()
          const endMinutes = 17 * 60
          worked = Math.max(0, endMinutes - inMinutes)
        } else if (log.date === todayDateStr && worked === 0) {
          worked = Math.max(1, Math.round((Date.now() - new Date(log.punch_in_at).getTime()) / (1000 * 60)))
        }
      }

      totalWorkedMinutes += worked

      const isCurrentMonth = log.date && log.date.startsWith(currentMonthStr)
      if (isCurrentMonth) {
        currentMonthWorkedMinutes += worked
      }

      // Calculate punctuality from punch_in_at considering custom day schedules
      if (log.punch_in_at && log.date) {
        const punchDate = new Date(log.punch_in_at)
        const dObj = new Date(log.date + 'T00:00:00')
        const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
        const daySched = empCustomDaySchedules?.[dayName]
        const dayShiftStart = daySched?.startTime || empShiftStart

        const [sH, sM] = dayShiftStart.split(':').map(Number)
        const validShiftH = isNaN(sH) ? shiftHour : sH
        const validShiftM = isNaN(sM) ? shiftMinute : sM
        const cutoffMinutes = validShiftH * 60 + validShiftM + empGrace

        const punchMins = punchDate.getHours() * 60 + punchDate.getMinutes()
        if (punchMins > cutoffMinutes) {
          lateDaysCount++
          totalLateMinutes += punchMins - (validShiftH * 60 + validShiftM)
        }
      }

      // Daily flexible workday: If employee worked their configured hours, duration covers expected time -> 0 deficit!
      if (worked > dayExpectedMinutes) {
        overtimeMinutes += (worked - dayExpectedMinutes)
      }
    }

    const totalWorkedHours = (totalWorkedMinutes / 60).toFixed(1)
    const currentMonthWorkedHours = currentMonthWorkedMinutes / 60
    const overtimeHours = (overtimeMinutes / 60).toFixed(1)

    // Approved leave hours for this user in current month up to today (strictly elapsed days, active tracking only!)
    let mtdApprovedLeaveDays = 0
    let mtdApprovedLeaveHours = 0
    let totalApprovedLeaveDaysInMonth = 0

    const holidays = (workPolicy.official_holidays || []).map((h: any) => typeof h === 'string' ? h : h.date)
    const approvedLeaves = myLeaveRequests.filter((r) => r.status === 'APPROVED')

    for (let day = 1; day <= currentDay; day++) {
      const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      const d = new Date(dateStr + 'T00:00:00')
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
      const isWorkDay = empWorkDays.includes(dayName) && !holidays.includes(dateStr)
      const isAfterTrackingStart = !effectiveStartDate || dateStr >= effectiveStartDate

      if (isWorkDay) {
        const isCovered = approvedLeaves.some((r) => r.start_date <= dateStr && r.end_date >= dateStr)
        if (isCovered) {
          if (isAfterTrackingStart) {
            mtdApprovedLeaveDays++
            let dayH = empDailyHours
            if (empCustomDayHours && empCustomDayHours[dayName] !== undefined) {
              dayH = empCustomDayHours[dayName]
            }
            mtdApprovedLeaveHours += dayH
          }
        }
      }
    }

    for (const r of approvedLeaves) {
      if ((r.start_date && r.start_date.startsWith(currentMonthStr)) || (r.end_date && r.end_date.startsWith(currentMonthStr))) {
        totalApprovedLeaveDaysInMonth += r.total_days || 0
      }
    }

    // Deficit strictly for Month-To-Date (elapsed days only, no future deficit!)
    // If user is exempt or current day is prior to effective tracking start date, deficit is strictly 0!
    const isPastTrackingStart = !effectiveStartDate || todayDateStr >= effectiveStartDate
    const mtdDeficitHours = (isExempt || !isPastTrackingStart)
      ? 0
      : Math.max(
          0,
          Math.round((mtdExpectedHours - currentMonthWorkedHours - mtdApprovedLeaveHours) * 10) / 10
        )

    // Pay cut calculation strictly based on employee's real base salary (no random fallback!)
    const hasSalaryProfile = Boolean(mySalary && mySalary.base_salary > 0)
    const baseSalary = hasSalaryProfile ? mySalary!.base_salary : 0
    const hourlyRate = (baseSalary > 0 && totalExpectedHours > 0)
      ? Math.round((baseSalary / totalExpectedHours) * 100) / 100
      : 0
    const estimatedPayCut = (!isExempt && isPastTrackingStart && hourlyRate > 0 && mtdDeficitHours > 0)
      ? Math.round(mtdDeficitHours * hourlyRate)
      : 0
    const currency = mySalary?.currency || 'SAR'

    const pendingLeaveCount = myLeaveRequests.filter((r) => r.status === 'PENDING').length

    return {
      totalWorkedHours,
      totalWorkedMinutes,
      currentMonthWorkedHours: currentMonthWorkedHours.toFixed(1),
      lateDaysCount,
      totalLateMinutes,
      deficitHours: mtdDeficitHours.toFixed(1),
      mtdDeficitHours,
      mtdExpectedHours: (isExempt || !isPastTrackingStart) ? 0 : mtdExpectedHours,
      mtdExpectedDays: (isExempt || !isPastTrackingStart) ? 0 : mtdExpectedDays,
      totalExpectedHours,
      totalExpectedDays,
      hasSalaryProfile,
      baseSalary,
      hourlyRate,
      estimatedPayCut,
      currency,
      overtimeHours,
      approvedLeaveDays: mtdApprovedLeaveDays,
      approvedLeaveHours: mtdApprovedLeaveHours.toFixed(1),
      totalApprovedLeaveDaysInMonth,
      pendingLeaveCount,
      shiftStartCutoffMinutes,
      shiftHour,
      shiftMinute,
      graceMinutes,
      expectedMinutesPerDay: empDailyHours * 60,
      defaultDayHours: empDailyHours,
      isExempt,
      effectiveStartDate,
    }
  }, [myHistory, workPolicy, myLeaveRequests, mySalary, userId])

  async function loadInitialData() {
    try {
      if (userId && userId !== 'guest-user') {
        getEmployeeFaceEnrollment(userId).then((res) => {
          setHasFaceId(Boolean(res.descriptor && res.descriptor.length === 128))
          setFaceEnrolledAt(res.enrolled_at || null)
          setFaceSnapshotUrl(res.snapshot_url || null)
        })
        fetchUserSalaryProfile(userId).then(setMySalary)
      }

      const todayStr = new Date().toISOString().split('T')[0]

      const promises: [
        Promise<CompanyLocation>,
        Promise<CompanyWorkPolicy>,
        Promise<AttendanceLog | null>,
        Promise<AttendanceLog[]>,
        Promise<LeaveBalance>,
        Promise<LeaveRequest[]>,
        Promise<RosterEmployee[]> | Promise<never[]>,
        Promise<AttendanceLog[]> | Promise<never[]>,
        Promise<LeaveRequest[]> | Promise<never[]>
      ] = [
          fetchOfficeLocation(),
          fetchCompanyWorkPolicy(),
          fetchTodayAttendance(userId),
          fetchUserAttendanceHistory(userId),
          fetchLeaveBalances(userId),
          fetchUserLeaveRequests(userId),
          canManage ? fetchAdminDailyRoster(todayStr) : Promise.resolve([]),
          canManage ? fetchPendingExceptions() : Promise.resolve([]),
          canManage ? fetchAllLeaveRequests() : Promise.resolve([]),
        ]

      const [loc, pol, tLog, hist, bal, userReqs, roster, ex, allLeaves] = await Promise.all(promises)

      if (loc) setOffice(loc)
      if (pol) setWorkPolicy(pol)
      if (tLog !== undefined) setTodayLog(tLog)
      if (hist) setMyHistory(hist)
      if (bal) setLeaveBalances(bal)
      if (userReqs) setMyLeaveRequests(userReqs)

      if (canManage) {
        if (roster) setAdminRoster(roster)
        if (ex) setPendingExceptions(ex)
        if (allLeaves) setAllLeaveRequests(allLeaves)
        loadMonthlyAudit(selectedAuditMonth)
      }
    } catch (e) {
      console.error('Error loading attendance data:', e)
    } finally {
      setPageInitialLoading(false)
    }
  }

  async function loadMonthlyAudit(monthStr: string) {
    setAuditLoading(true)
    try {
      const res = await fetchMonthlyWorkHoursAudit(monthStr)
      setMonthlyAuditList(res.auditList)
      setAuditExpectedDays(res.expectedWorkingDays)
      setAuditExpectedHours(res.expectedHoursPerEmployee)
      setAuditExpectedToDateHours(res.expectedToDateHours)
      setAuditElapsedDays(res.elapsedWorkingDays)
    } catch (e) {
      console.error(e)
    } finally {
      setAuditLoading(false)
    }
  }

  function handleOpenRegularize(log?: AttendanceLog | null, empName?: string) {
    setRegularizeLog(log || null)
    setRegularizeEmployeeName(empName || '')
    setRegularizeModalOpen(true)
  }

  async function handleQuickApproveRegularization(log: AttendanceLog) {
    if (!log) return
    setIsProcessingRegularizeId(log.id)
    try {
      const res = await quickApproveRegularization(log, userId)
      if (res) {
        setRegularizeFeedbackMsg({
          id: log.id,
          type: 'success',
          message: `Approved shift regularization for ${log.employee_name || 'employee'}!`,
        })
        // Optimistically update pendingExceptions so UI transitions immediately
        setPendingExceptions((prev) =>
          prev.map((item) =>
            item.id === log.id
              ? {
                ...item,
                ...res,
                punch_in_status: 'APPROVED',
                punch_out_status: 'APPROVED',
                review_notes: res.review_notes || 'Regularized by Admin',
              }
              : item
          )
        )
      }
      await loadInitialData()
    } catch (e) {
      console.error('Error approving regularization:', e)
      setRegularizeFeedbackMsg({
        id: log.id,
        type: 'error',
        message: 'Could not complete approval. Please check your connection and try again.',
      })
    } finally {
      setIsProcessingRegularizeId(null)
      setTimeout(() => setRegularizeFeedbackMsg(null), 4000)
    }
  }

  async function handleRejectRegularization(log: AttendanceLog) {
    const defaultReason = 'Requested hours not verified'
    const promptReason = window.prompt(
      'Enter reason for rejecting regularization request (or Cancel to abort):',
      defaultReason
    )
    if (promptReason === null) return // user cancelled
    setIsProcessingRegularizeId(log.id)
    try {
      const ok = await rejectRegularizationRequest(log.id, promptReason, userId, log.user_id, log.date)
      if (ok) {
        setRegularizeFeedbackMsg({
          id: log.id,
          type: 'success',
          message: `Regularization request rejected for ${log.employee_name || 'employee'}.`,
        })
        setPendingExceptions((prev) =>
          prev.map((item) =>
            item.id === log.id
              ? {
                ...item,
                punch_in_status: 'FLAGGED',
                punch_out_status: 'FLAGGED',
                review_notes: `REJECTED REGULARIZATION: ${promptReason}`,
              }
              : item
          )
        )
      }
      await loadInitialData()
    } catch (e) {
      console.error('Error rejecting regularization:', e)
    } finally {
      setIsProcessingRegularizeId(null)
      setTimeout(() => setRegularizeFeedbackMsg(null), 4000)
    }
  }

  function handleAdminDeleteRecord(log: AttendanceLog, isDedicatedReq: boolean = false) {
    setDeleteConfirmModal({
      isOpen: true,
      record: log,
      isDedicatedReq,
    })
  }

  async function confirmAdminDeleteRecord() {
    const { record, isDedicatedReq } = deleteConfirmModal
    if (!record) return

    setIsProcessingRegularizeId(record.id)
    try {
      const ok = await deleteAttendanceLog({
        logId: record.id,
        userId: record.user_id,
        date: record.date,
        isDedicatedRequest: isDedicatedReq,
      })

      if (ok) {
        setRegularizeFeedbackMsg({
          id: record.id,
          type: 'success',
          message: `Record successfully deleted for ${record.employee_name || 'employee'}.`,
        })
        // Optimistically clean state immediately across pending exceptions and roster
        setPendingExceptions((prev) =>
          prev.filter((item) => item.id !== record.id && !(item.user_id === record.user_id && item.date === record.date))
        )
        setAdminRoster((prev) =>
          prev.map((emp) => {
            if (emp.profile_id === record.user_id && (emp.today_log?.id === record.id || emp.today_log?.date === record.date)) {
              return { ...emp, today_log: null, attendance_status: 'ABSENT' }
            }
            return emp
          })
        )
        setDeleteConfirmModal({ isOpen: false, record: null, isDedicatedReq: false })
        await loadInitialData()
      } else {
        setRegularizeFeedbackMsg({
          id: record.id,
          type: 'error',
          message: 'Could not delete record from server. Please try again.',
        })
      }
    } catch (e) {
      console.error('Error deleting record:', e)
      setRegularizeFeedbackMsg({
        id: record.id,
        type: 'error',
        message: 'Could not delete record. Please check server logs and try again.',
      })
    } finally {
      setIsProcessingRegularizeId(null)
      setDeleteConfirmModal({ isOpen: false, record: null, isDedicatedReq: false })
      setTimeout(() => setRegularizeFeedbackMsg(null), 4000)
    }
  }

  function handleOpenPunch() {
    if (!todayLog?.punch_in_at) {
      setPunchType('IN')
      setPunchModalOpen(true)
    } else if (!todayLog?.punch_out_at) {
      setPunchType('OUT')
      setPunchModalOpen(true)
    } else {
      // Already punched in and punched out for today
      return
    }
  }

  async function handleLeaveApproval(requestId: string, status: 'APPROVED' | 'REJECTED') {
    await reviewLeaveRequest(
      requestId,
      status,
      status === 'APPROVED' ? 'Approved by admin' : 'Rejected',
      userId
    )
    loadInitialData()
  }

  // Export Personal CSV
  function handleExportCsv() {
    const rows = [
      ['Date', 'Employee', 'Punch In', 'Punch In Status', 'Punch Out', 'Punch Out Status', 'Total Minutes', 'Working Hours'],
      ...myHistory.map((l) => [
        l.date,
        profile?.name || 'Staff Member',
        l.punch_in_at ? new Date(l.punch_in_at).toLocaleTimeString() : 'N/A',
        l.punch_in_status,
        l.punch_out_at ? new Date(l.punch_out_at).toLocaleTimeString() : 'N/A',
        l.punch_out_status || 'N/A',
        l.total_working_minutes.toString(),
        `${(l.total_working_minutes / 60).toFixed(1)} hrs`,
      ]),
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `asaheeb_attendance_${new Date().toISOString().slice(0, 7)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export Monthly Audit CSV
  function handleExportMonthlyAuditCsv() {
    const rows = [
      ['Employee Name', 'Role', 'Email', 'Month', 'Expected Business Days', 'Expected Hours', 'Actual Worked Hours', 'Approved Leave Hours', 'Cumulative Non-Working (Deficit) Hours', 'Late Days', 'Absent Days', 'Adherence Rate %'],
      ...monthlyAuditList.map((a) => [
        a.employee_name,
        a.employee_role,
        a.employee_email,
        a.month,
        a.expected_working_days.toString(),
        a.expected_total_hours.toString(),
        a.actual_worked_hours.toString(),
        a.approved_leave_hours.toString(),
        a.non_working_hours.toString(),
        a.days_late.toString(),
        a.days_absent.toString(),
        `${a.attendance_adherence_percent}%`,
      ]),
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `asaheeb_monthly_hours_deficit_${selectedAuditMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Roster Filter counts
  const countHq = adminRoster.filter((r) => r.live_status === 'PRESENT_HQ').length
  const countRemote = adminRoster.filter((r) => r.live_status === 'PRESENT_REMOTE').length
  const countLeave = adminRoster.filter((r) => r.live_status === 'ON_LEAVE').length
  const countAbsent = adminRoster.filter((r) => r.live_status === 'NOT_PUNCHED').length
  const countFlagged = adminRoster.filter((r) => r.live_status === 'FLAGGED').length

  const filteredRoster = adminRoster.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (rosterFilter === 'HQ') return r.live_status === 'PRESENT_HQ'
    if (rosterFilter === 'REMOTE') return r.live_status === 'PRESENT_REMOTE'
    if (rosterFilter === 'LEAVE') return r.live_status === 'ON_LEAVE'
    if (rosterFilter === 'ABSENT') return r.live_status === 'NOT_PUNCHED'
    if (rosterFilter === 'FLAGGED') return r.live_status === 'FLAGGED'
    return true
  })

  // ==========================================
  // SEPARATE LIST 1: PUNCH APPROVALS (REMOTE / GEOFENCE / FLAGGED)
  // ==========================================
  const punchApprovalList = useMemo(() => {
    return pendingExceptions.filter((item) => {
      const parsed = parseRegularizationRequestNotes(item.review_notes)
      const hasRegNote =
        item.review_notes &&
        (item.review_notes.includes('REGULARIZATION') ||
          item.review_notes.includes('Regularized:') ||
          item.review_notes.includes('REJECTED REGULARIZATION'))
      return !parsed.isRegularization && !hasRegNote
    })
  }, [pendingExceptions])

  const filteredPunchApprovals = useMemo(() => {
    return punchApprovalList.filter((item) => {
      const isFlagged = item.punch_in_status === 'FLAGGED' || item.punch_out_status === 'FLAGGED'
      const isPending =
        item.punch_in_status === 'PENDING_REVIEW' || item.punch_out_status === 'PENDING_REVIEW'
      const isApproved =
        item.punch_in_status === 'APPROVED' && (!item.punch_out_status || item.punch_out_status === 'APPROVED')

      if (exceptionsFilter === 'ACTION_NEEDED') return isFlagged || isPending
      if (exceptionsFilter === 'FLAGGED') return isFlagged
      if (exceptionsFilter === 'APPROVED') return isApproved
      return true
    })
  }, [punchApprovalList, exceptionsFilter])

  const countPunchActionNeeded = useMemo(() => {
    return punchApprovalList.filter(
      (e) =>
        e.punch_in_status === 'FLAGGED' ||
        e.punch_in_status === 'PENDING_REVIEW' ||
        e.punch_out_status === 'FLAGGED' ||
        e.punch_out_status === 'PENDING_REVIEW'
    ).length
  }, [punchApprovalList])

  const countPunchFlagged = useMemo(() => {
    return punchApprovalList.filter(
      (e) => e.punch_in_status === 'FLAGGED' || e.punch_out_status === 'FLAGGED'
    ).length
  }, [punchApprovalList])

  const countPunchApproved = useMemo(() => {
    return punchApprovalList.filter(
      (e) => e.punch_in_status === 'APPROVED' && (!e.punch_out_status || e.punch_out_status === 'APPROVED')
    ).length
  }, [punchApprovalList])

  // ==========================================
  // SEPARATE LIST 2: SHIFT REGULARIZATION REQUESTS
  // ==========================================
  const allRegularizations = useMemo(() => {
    return pendingExceptions.filter((item) => {
      const parsed = parseRegularizationRequestNotes(item.review_notes)
      const hasRegNote =
        item.review_notes &&
        (item.review_notes.includes('REGULARIZATION') ||
          item.review_notes.includes('Regularized:') ||
          item.review_notes.includes('REJECTED REGULARIZATION'))
      return parsed.isRegularization || hasRegNote
    })
  }, [pendingExceptions])

  const filteredRegularizations = useMemo(() => {
    return allRegularizations.filter((item) => {
      const isApproved =
        item.punch_in_status === 'APPROVED' &&
        (item.punch_out_status === 'APPROVED' || !item.punch_out_status) &&
        item.review_notes?.includes('Regularized:')
      const isRejected =
        item.punch_in_status === 'FLAGGED' || item.review_notes?.includes('REJECTED REGULARIZATION')
      const isPending = !isApproved && !isRejected

      if (regularizationsFilter === 'PENDING') return isPending
      if (regularizationsFilter === 'APPROVED') return isApproved
      if (regularizationsFilter === 'REJECTED') return isRejected
      return true
    })
  }, [allRegularizations, regularizationsFilter])

  const countRegPending = useMemo(() => {
    return allRegularizations.filter((e) => {
      const isApproved =
        e.punch_in_status === 'APPROVED' &&
        (e.punch_out_status === 'APPROVED' || !e.punch_out_status) &&
        e.review_notes?.includes('Regularized:')
      const isRejected =
        e.punch_in_status === 'FLAGGED' || e.review_notes?.includes('REJECTED REGULARIZATION')
      return !isApproved && !isRejected
    }).length
  }, [allRegularizations])

  const countRegApproved = useMemo(() => {
    return allRegularizations.filter(
      (e) =>
        e.punch_in_status === 'APPROVED' &&
        (e.punch_out_status === 'APPROVED' || !e.punch_out_status) &&
        e.review_notes?.includes('Regularized:')
    ).length
  }, [allRegularizations])

  const countRegRejected = useMemo(() => {
    return allRegularizations.filter(
      (e) => e.punch_in_status === 'FLAGGED' || e.review_notes?.includes('REJECTED REGULARIZATION')
    ).length
  }, [allRegularizations])

  // Sliced paginated arrays for clean page navigation
  const paginatedRoster = useMemo(() => {
    const start = (rosterPage - 1) * rosterPageSize
    return filteredRoster.slice(start, start + rosterPageSize)
  }, [filteredRoster, rosterPage, rosterPageSize])

  const paginatedPunchApprovals = useMemo(() => {
    const start = (exceptionsPage - 1) * exceptionsPageSize
    return filteredPunchApprovals.slice(start, start + exceptionsPageSize)
  }, [filteredPunchApprovals, exceptionsPage, exceptionsPageSize])

  const paginatedRegularizations = useMemo(() => {
    const start = (regularizationsPage - 1) * regularizationsPageSize
    return filteredRegularizations.slice(start, start + regularizationsPageSize)
  }, [filteredRegularizations, regularizationsPage, regularizationsPageSize])

  const paginatedAudit = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize
    return monthlyAuditList.slice(start, start + auditPageSize)
  }, [monthlyAuditList, auditPage, auditPageSize])

  const paginatedLeaves = useMemo(() => {
    const start = (leavesPage - 1) * leavesPageSize
    return allLeaveRequests.slice(start, start + leavesPageSize)
  }, [allLeaveRequests, leavesPage, leavesPageSize])

  const paginatedMyHistory = useMemo(() => {
    const start = (myHistoryPage - 1) * myHistoryPageSize
    return myHistory.slice(start, start + myHistoryPageSize)
  }, [myHistory, myHistoryPage, myHistoryPageSize])

  const paginatedMyLeaves = useMemo(() => {
    const start = (myLeavesPage - 1) * myLeavesPageSize
    return myLeaveRequests.slice(start, start + myLeavesPageSize)
  }, [myLeaveRequests, myLeavesPage, myLeavesPageSize])

  // Cumulative Audit Totals
  const nonExemptAudits = useMemo(() => monthlyAuditList.filter((c) => !c.is_exempt), [monthlyAuditList])
  const totalActualCompanyHours = Math.round(monthlyAuditList.reduce((acc, c) => acc + c.actual_worked_hours, 0) * 10) / 10
  const totalCompanyNonWorkingHours = Math.round(nonExemptAudits.reduce((acc, c) => acc + (c.month_to_date_deficit ?? c.non_working_hours), 0) * 10) / 10
  const totalCompanyLeaveHours = Math.round(monthlyAuditList.reduce((acc, c) => acc + c.approved_leave_hours, 0) * 10) / 10
  const totalCompanyPayCuts = Math.round(nonExemptAudits.reduce((acc, c) => acc + (c.estimated_pay_cut || 0), 0))
  const averageCompanyAdherence = nonExemptAudits.length > 0
    ? Math.round(nonExemptAudits.reduce((acc, c) => acc + c.attendance_adherence_percent, 0) / nonExemptAudits.length)
    : 100

  const remainingAnnualLeave = Math.max(
    0,
    leaveBalances.annual_leave_total - leaveBalances.annual_leave_used
  )

  const isFlaggedToday = Boolean(todayLog?.punch_in_status === 'FLAGGED' || todayLog?.punch_out_status === 'FLAGGED')
  const hasPunchedIn = Boolean(todayLog?.punch_in_at)
  const hasPunchedOut = Boolean(todayLog?.punch_out_at)
  const isPunchedIn = Boolean(hasPunchedIn && !hasPunchedOut)
  const isPunchedOut = Boolean(hasPunchedIn && hasPunchedOut)

  if (pageInitialLoading) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            border: '4px solid #E2E8F0',
            borderTopColor: '#2563EB',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
          Loading Workforce &amp; Attendance Data...
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minHeight: '100%' }}>
      {/* 1. Standard CRM Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                letterSpacing: '0.04em',
              }}
            >
              Enterprise Geofence &amp; Time Clock
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>• {office.name}</span>
          </div>
          <h1 className="text-page-title">Attendance &amp; Workforce Tracking</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            GPS geofence &amp; automated device telemetry verification, working hours audit, and annual leave management.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Digital Clock Pill */}
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Clock size={15} style={{ color: '#2563EB' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {currentTime || '--:--:--'}
            </span>
          </div>

          {/* Admin Work Policy Config */}
          {isAdmin && (
            <button
              onClick={() => setWorkPolicyModalOpen(true)}
              className="btn btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                backgroundColor: '#FFFFFF',
              }}
              title="Configure company working days, daily hours, grace period, and quotas"
            >
              <Briefcase size={15} style={{ color: '#2563EB' }} /> Work Policy ({workPolicy.daily_expected_hours}h/day)
            </button>
          )}

          {/* Admin Office Location Button */}
          {isAdmin && (
            <button
              onClick={() => setOfficeModalOpen(true)}
              className="btn btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                backgroundColor: '#FFFFFF',
              }}
              title="Configure office coordinates and geofence tolerance radius"
            >
              <Compass size={15} style={{ color: '#7C3AED' }} /> Office Geofence ({office.radius_meters}m)
            </button>
          )}

          {/* Request Leave CTA */}
          <button
            onClick={() => setLeaveModalOpen(true)}
            className="btn btn-outline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
            }}
          >
            <Plus size={15} style={{ color: '#059669' }} /> Request Leave
          </button>

        </div>
      </div>

      <div className="page-body">
        {/* ======================================================= */}
        {/* 2. PERSONAL HERO WORKDAY PUNCH CARD (FULL WIDTH) */}
        {/* ======================================================= */}
        <div
          className="card"
          style={{
            padding: '20px 24px',
            marginBottom: 20,
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {todayHoliday && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                marginBottom: '20px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                color: '#FDE68A',
              }}
            >
              <span style={{ fontSize: '22px' }}>🎉</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#FEF08A' }}>
                  Official Company Holiday: {todayHoliday.name}
                </div>
                <div style={{ fontSize: '12px', color: '#FDE68A', opacity: 0.9, marginTop: '2px' }}>
                  Standard business hours and punch expectations are waived today. Zero absence or deficit hours will be logged.
                </div>
              </div>
            </div>
          )}
          <div
            className="attendance-hero-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              alignItems: 'center',
            }}
          >
            {/* Status & Work Timer */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backgroundColor: isFlaggedToday
                      ? 'rgba(239, 68, 68, 0.3)'
                      : isPunchedIn
                        ? 'rgba(34, 197, 94, 0.2)'
                        : isPunchedOut
                          ? 'rgba(148, 163, 184, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                    color: isFlaggedToday ? '#FCA5A5' : isPunchedIn ? '#4ADE80' : isPunchedOut ? '#CBD5E1' : '#F87171',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: isFlaggedToday ? '#EF4444' : isPunchedIn ? '#22C55E' : isPunchedOut ? '#94A3B8' : '#EF4444',
                    }}
                  />
                  {isFlaggedToday
                    ? isPunchedIn
                      ? '🚩 Flagged • Shift in Progress'
                      : isPunchedOut
                        ? '🚩 Flagged • Pending Adjustment'
                        : '🚩 Punch Flagged by Admin'
                    : isPunchedIn
                      ? 'Active Workday'
                      : isPunchedOut
                        ? 'Workday Completed'
                        : 'Not Punched In Today'}
                </span>

                {todayLog?.punch_in_distance_m != null && (
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                    {todayLog.punch_in_distance_m <= office.radius_meters
                      ? '🟢 Inside Jeddah HQ'
                      : `🟡 Remote (${formatDistance(todayLog.punch_in_distance_m)})`}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
                {isFlaggedToday ? '00h 00m (Flagged)' : activeWorkDuration}
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>
                {isFlaggedToday
                  ? `Notice: ${todayLog?.review_notes || 'Attendance record flagged • Use Adjust Hours to regularize'}`
                  : todayLog?.punch_in_at
                    ? `Punched in at ${new Date(todayLog.punch_in_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                    : 'Ready to punch in with GPS Geofence & Device Telemetry'}
              </div>
            </div>

            {/* Tactile Punch Action CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  if (isFlaggedToday && isPunchedOut) {
                    setRegularizeLog(todayLog)
                    setRegularizeEmployeeName(profile?.name || 'Staff Member')
                    setRegularizeModalOpen(true)
                  } else {
                    handleOpenPunch()
                  }
                }}
                disabled={isPunchedOut && !isFlaggedToday}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  backgroundColor: isFlaggedToday
                    ? isPunchedIn
                      ? '#DC2626'
                      : '#991B1B'
                    : isPunchedIn
                      ? '#DC2626'
                      : isPunchedOut
                        ? '#475569'
                        : '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: isPunchedOut && !isFlaggedToday ? 'not-allowed' : 'pointer',
                  opacity: isPunchedOut && !isFlaggedToday ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: isFlaggedToday
                    ? isPunchedIn
                      ? '0 4px 16px rgba(220, 38, 38, 0.4)'
                      : 'none'
                    : isPunchedIn
                      ? '0 4px 16px rgba(220, 38, 38, 0.4)'
                      : isPunchedOut
                        ? 'none'
                        : '0 4px 16px rgba(22, 163, 74, 0.4)',
                  transition: 'transform 0.1s ease',
                }}
                onMouseDown={(e) => {
                  if (!isPunchedOut || isFlaggedToday) e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onMouseUp={(e) => {
                  if (!isPunchedOut || isFlaggedToday) e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {isPunchedOut && !isFlaggedToday ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
                {isFlaggedToday
                  ? isPunchedIn
                    ? 'Punch Out (Shift Flagged • Capture Time)'
                    : 'Shift Flagged • Adjust Work Hours'
                  : isPunchedIn
                    ? 'Punch Out & Confirm'
                    : isPunchedOut
                      ? 'Day Completed (Punched Out)'
                      : 'Punch In (GPS + Device Telemetry)'}
              </button>
              <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                {isFlaggedToday
                  ? isPunchedIn
                    ? 'Shift is flagged. Punch out when leaving to record departure time, then adjust hours.'
                    : 'Shift is flagged. Click above to adjust or regularize approved shift hours.'
                  : isPunchedOut
                    ? 'Attendance successfully recorded for today'
                    : `Verified against ${office.name} (${office.radius_meters}m geofence perimeter)`}
              </div>

              {/* Hardware Telemetry Pill & Action links */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginTop: '4px',
                  fontSize: '11.5px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    color: '#38BDF8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={13} /> GPS &amp; Hardware Telemetry Verified
                </span>
                {isFlaggedToday && (
                  <>
                    <span style={{ color: '#475569' }}>·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRegularizeLog(todayLog)
                        setRegularizeEmployeeName(profile?.name || 'Staff Member')
                        setRegularizeModalOpen(true)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#FDE047',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Edit3 size={12} /> Adjust Work Hours
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Leave Quota Card */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Annual Paid Leaves Quota
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#38BDF8', marginTop: '2px' }}>
                  {remainingAnnualLeave} / {leaveBalances.annual_leave_total} Days
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  {leaveBalances.sick_leave_total - leaveBalances.sick_leave_used} Sick days remaining
                </div>
              </div>

              <button
                onClick={() => setLeaveModalOpen(true)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={14} /> Request
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 3. EXECUTIVE KPI CARDS */}
        {/* ======================================================= */}
        {canManage && (
          <div
            className="attendance-kpi-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '14px',
              marginBottom: 20,
            }}
          >
            {/* Card 1: Total Staff */}
            <div
              className="card"
              onClick={() => {
                setActiveTab('ROSTER')
                setRosterFilter('ALL')
              }}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderColor: rosterFilter === 'ALL' && activeTab === 'ROSTER' ? '#2563EB' : 'var(--border)',
                boxShadow: rosterFilter === 'ALL' && activeTab === 'ROSTER' ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>All Staff Members</span>
                <Users size={16} color="#64748B" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {adminRoster.length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>Company Directory</div>
            </div>

            {/* Card 2: Present at HQ */}
            <div
              className="card"
              onClick={() => {
                setActiveTab('ROSTER')
                setRosterFilter('HQ')
              }}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderColor: rosterFilter === 'HQ' && activeTab === 'ROSTER' ? '#16A34A' : 'var(--border)',
                boxShadow: rosterFilter === 'HQ' && activeTab === 'ROSTER' ? '0 0 0 2px rgba(22, 163, 74, 0.2)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#15803D', fontWeight: 600 }}>In Office (Jeddah HQ)</span>
                <Building size={16} color="#16A34A" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16A34A', marginTop: 4 }}>
                {countHq}
              </div>
              <div style={{ fontSize: '11px', color: '#15803D', marginTop: 2 }}>Geofence Verified 🟢</div>
            </div>

            {/* Card 3: Remote / Field */}
            <div
              className="card"
              onClick={() => {
                setActiveTab('ROSTER')
                setRosterFilter('REMOTE')
              }}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderColor: rosterFilter === 'REMOTE' && activeTab === 'ROSTER' ? '#D97706' : 'var(--border)',
                boxShadow: rosterFilter === 'REMOTE' && activeTab === 'ROSTER' ? '0 0 0 2px rgba(217, 119, 6, 0.2)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#B45309', fontWeight: 600 }}>Remote / Field Work</span>
                <MapPin size={16} color="#D97706" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                {countRemote}
              </div>
              <div style={{ fontSize: '11px', color: '#B45309', marginTop: 2 }}>Outside Geofence 🟡</div>
            </div>

            {/* Card 4: On Approved Leave */}
            <div
              className="card"
              onClick={() => {
                setActiveTab('ROSTER')
                setRosterFilter('LEAVE')
              }}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderColor: rosterFilter === 'LEAVE' && activeTab === 'ROSTER' ? '#0284C7' : 'var(--border)',
                boxShadow: rosterFilter === 'LEAVE' && activeTab === 'ROSTER' ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#0369A1', fontWeight: 600 }}>On Approved Leave</span>
                <Calendar size={16} color="#0284C7" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284C7', marginTop: 4 }}>
                {countLeave}
              </div>
              <div style={{ fontSize: '11px', color: '#0369A1', marginTop: 2 }}>Scheduled Leave 🔵</div>
            </div>

            {/* Card 5: Not Punched */}
            <div
              className="card"
              onClick={() => {
                setActiveTab('ROSTER')
                setRosterFilter('ABSENT')
              }}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderColor: rosterFilter === 'ABSENT' && activeTab === 'ROSTER' ? '#64748B' : 'var(--border)',
                boxShadow: rosterFilter === 'ABSENT' && activeTab === 'ROSTER' ? '0 0 0 2px rgba(100, 116, 139, 0.2)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Not Punched In</span>
                <Clock size={16} color="#94A3B8" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: 4 }}>
                {countAbsent}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>Pending Punch ⚪</div>
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* 4. TABS NAVIGATION TOOLBAR (HORIZONTAL SCROLLING) */}
        {/* ======================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 20,
            width: '100%',
          }}
          className="attendance-tabs-toolbar"
        >
          <div className="attendance-tabs-strip-container" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            {/* Scroll Left Button */}
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="btn btn-outline"
              style={{
                padding: '6px 8px',
                minWidth: '32px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                borderColor: '#CBD5E1',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
              }}
              title="Scroll tabs left"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Horizontal Scrollable Tabs Strip */}
            <div
              ref={tabsContainerRef}
              onWheel={(e) => {
                if (e.deltaY !== 0 && tabsContainerRef.current) {
                  tabsContainerRef.current.scrollLeft += e.deltaY * 1.5
                }
              }}
              className="attendance-tabs-scroll"
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'nowrap',
                alignItems: 'center',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                WebkitOverflowScrolling: 'touch',
                padding: '4px 2px',
                flex: 1,
                minWidth: 0,
                scrollbarWidth: 'thin',
              }}
            >
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ROSTER')}
                    className={activeTab === 'ROSTER' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Users size={15} /> Live Daily Roster ({adminRoster.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('EXCEPTIONS')}
                    className={activeTab === 'EXCEPTIONS' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      backgroundColor: activeTab === 'EXCEPTIONS' ? '#D97706' : '#FFFFFF',
                      borderColor: activeTab === 'EXCEPTIONS' ? '#D97706' : 'var(--border)',
                      color: activeTab === 'EXCEPTIONS' ? '#FFFFFF' : 'var(--text-primary)',
                    }}
                  >
                    <AlertTriangle size={15} /> Punch Approvals ({punchApprovalList.length})
                    {countPunchActionNeeded > 0 && (
                      <span
                        style={{
                          backgroundColor: '#DC2626',
                          color: '#FFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                        }}
                        title={`${countPunchActionNeeded} remote punches need review`}
                      >
                        {countPunchActionNeeded}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('REGULARIZATIONS')}
                    className={activeTab === 'REGULARIZATIONS' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      backgroundColor: activeTab === 'REGULARIZATIONS' ? '#7C3AED' : '#FFFFFF',
                      borderColor: activeTab === 'REGULARIZATIONS' ? '#7C3AED' : 'var(--border)',
                      color: activeTab === 'REGULARIZATIONS' ? '#FFFFFF' : 'var(--text-primary)',
                    }}
                  >
                    <FileSpreadsheet size={15} /> Regularization Requests ({allRegularizations.length})
                    {countRegPending > 0 && (
                      <span
                        style={{
                          backgroundColor: '#F59E0B',
                          color: '#FFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                        title={`${countRegPending} shift regularizations pending approval`}
                      >
                        ⏳ {countRegPending}
                      </span>
                    )}
                  </button>

                  {/* 4TH TAB: MONTHLY HOURS & DEFICIT AUDIT */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('HOURS_AUDIT')}
                    className={activeTab === 'HOURS_AUDIT' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      backgroundColor: activeTab === 'HOURS_AUDIT' ? '#4338CA' : '#FFFFFF',
                      borderColor: activeTab === 'HOURS_AUDIT' ? '#4338CA' : 'var(--border)',
                      color: activeTab === 'HOURS_AUDIT' ? '#FFFFFF' : 'var(--text-primary)',
                    }}
                  >
                    <TrendingDown size={15} /> Monthly Hours &amp; Deficit Audit
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('LEAVES')}
                    className={activeTab === 'LEAVES' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      borderRadius: '10px',
                      transition: 'all 0.15s ease',
                      backgroundColor: activeTab === 'LEAVES' ? '#059669' : '#FFFFFF',
                      borderColor: activeTab === 'LEAVES' ? '#059669' : 'var(--border)',
                      color: activeTab === 'LEAVES' ? '#FFFFFF' : 'var(--text-primary)',
                    }}
                  >
                    <Calendar size={15} /> Leave Management
                    {allLeaveRequests.filter((r) => r.status === 'PENDING').length > 0 && (
                      <span
                        style={{
                          backgroundColor: '#10B981',
                          color: '#FFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                        }}
                      >
                        {allLeaveRequests.filter((r) => r.status === 'PENDING').length}
                      </span>
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('MY_LOGS')}
                className={activeTab === 'MY_LOGS' ? 'btn btn-primary' : 'btn btn-outline'}
                style={{
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  borderRadius: '10px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Clock size={15} /> My Attendance &amp; Timesheet
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MY_LEAVES')}
                className={activeTab === 'MY_LEAVES' ? 'btn btn-primary' : 'btn btn-outline'}
                style={{
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  borderRadius: '10px',
                  transition: 'all 0.15s ease',
                  backgroundColor: activeTab === 'MY_LEAVES' ? '#059669' : '#FFFFFF',
                  borderColor: activeTab === 'MY_LEAVES' ? '#059669' : 'var(--border)',
                  color: activeTab === 'MY_LEAVES' ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                <Calendar size={15} /> My Leaves &amp; Requests ({myLeaveRequests.length})
                {myMonthlyStats.pendingLeaveCount > 0 && (
                  <span
                    style={{
                      backgroundColor: '#F59E0B',
                      color: '#FFF',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '999px',
                    }}
                  >
                    {myMonthlyStats.pendingLeaveCount} Pending
                  </span>
                )}
              </button>
            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="btn btn-outline"
              style={{
                padding: '6px 8px',
                minWidth: '32px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                borderColor: '#CBD5E1',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
              }}
              title="Scroll tabs right"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="attendance-tabs-export-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeTab === 'HOURS_AUDIT' ? (
              <button
                onClick={handleExportMonthlyAuditCsv}
                className="btn btn-outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  background: '#FFFFFF',
                }}
              >
                <Download size={14} /> Export Deficit Audit (CSV)
              </button>
            ) : (
              <button
                onClick={handleExportCsv}
                className="btn btn-outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  background: '#FFFFFF',
                }}
              >
                <Download size={14} /> Export Timesheets (CSV)
              </button>
            )}
          </div>
        </div>

        {/* ======================================================= */}
        {/* TAB 1: LIVE DAILY ROSTER TABLE (FULL WIDTH) */}
        {/* ======================================================= */}
        {activeTab === 'ROSTER' && canManage && (
          <div>
            {/* Search Bar Toolbar */}
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
                    placeholder="Search staff by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: 36, height: 38 }}
                  />
                </div>

                <select
                  value={rosterFilter}
                  onChange={(e) => setRosterFilter(e.target.value as any)}
                  className="select"
                  style={{ height: 38, minWidth: 170 }}
                >
                  <option value="ALL">All Statuses ({adminRoster.length})</option>
                  <option value="HQ">🟢 In Office (Jeddah HQ)</option>
                  <option value="REMOTE">🟡 Remote / Field Work</option>
                  <option value="LEAVE">🔵 On Approved Leave</option>
                  <option value="ABSENT">⚪ Not Punched In</option>
                </select>
              </div>
            </div>

            {/* Main Roster Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive-wrapper" style={{ width: '100%' }}>
                <table className="table" style={{ width: '100%', tableLayout: 'auto', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Employee
                      </th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Role
                      </th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Login Time (In)
                      </th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Logout Time (Out)
                      </th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Working Hours
                      </th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        Attendance Status &amp; Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
                          No staff members found matching your search.
                        </td>
                      </tr>
                    ) : (
                      paginatedRoster.map((emp) => {
                        const inTime = emp.today_log?.punch_in_at
                          ? new Date(emp.today_log.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '-'
                        const outTime = emp.today_log?.punch_out_at
                          ? new Date(emp.today_log.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '-'
                        const hrs = Math.floor(emp.active_minutes / 60)
                        const mins = emp.active_minutes % 60

                        const statusColors = {
                          PRESENT_HQ: { bg: '#DCFCE7', text: '#15803D', label: '🟢 In Office (HQ)' },
                          PRESENT_REMOTE: { bg: '#FEF08A', text: '#854D0E', label: '🟡 Remote / Field' },
                          ON_LEAVE: { bg: '#E0F2FE', text: '#0369A1', label: '🔵 On Leave' },
                          FLAGGED: { bg: '#FEE2E2', text: '#DC2626', label: '🚩 Flagged Shift' },
                          NOT_PUNCHED: todayHoliday
                            ? { bg: '#FEF3C7', text: '#B45309', label: `🎉 Holiday (${todayHoliday.name})` }
                            : { bg: '#F1F5F9', text: '#475569', label: '⚪ Not Punched' },
                        }[emp.live_status] || { bg: '#F1F5F9', text: '#475569', label: '⚪ Not Punched' }

                        return (
                          <tr
                            key={emp.profile_id}
                            onClick={() => {
                              setSelectedEmployeeForDetail(emp)
                              setDetailModalOpen(true)
                            }}
                            style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                            className="table-row-hover"
                          >
                            {/* Employee Info */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                                    color: '#FFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {emp.name.charAt(0)}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {emp.name}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {emp.email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Role */}
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  backgroundColor: '#EEF2FF',
                                  color: '#4F46E5',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {emp.role}
                              </span>
                            </td>

                            {/* Punch In */}
                            <td style={{ padding: '12px 14px', color: inTime !== '-' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: inTime !== '-' ? 600 : 400 }}>
                              {inTime}
                            </td>

                            {/* Punch Out */}
                            <td style={{ padding: '12px 14px', color: outTime !== '-' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: outTime !== '-' ? 600 : 400 }}>
                              {outTime}
                            </td>

                            {/* Working Hours */}
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontWeight: 700, color: emp.active_minutes > 0 ? '#0284C7' : 'var(--text-tertiary)' }}>
                                {hrs}h {mins}m
                              </span>
                            </td>

                            {/* Status & Action */}
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    backgroundColor: statusColors.bg,
                                    color: statusColors.text,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {statusColors.label}
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedEmployeeForDetail(emp)
                                    setDetailModalOpen(true)
                                  }}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    background: '#FFFFFF',
                                  }}
                                  title="View employee attendance history and leave status"
                                >
                                  <Eye size={12} /> View History
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
              <Pagination
                currentPage={rosterPage}
                totalItems={filteredRoster.length}
                pageSize={rosterPageSize}
                onPageChange={setRosterPage}
                onPageSizeChange={setRosterPageSize}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="staff members"
              />
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* NEW TAB 2: MONTHLY HOURS & NON-WORKING DEFICIT AUDIT */}
        {/* ======================================================= */}
        {activeTab === 'HOURS_AUDIT' && canManage && (
          <div>
            {/* Month & Policy Selector Bar */}
            <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Select Audit Month:
                  </label>
                  <input
                    type="month"
                    value={selectedAuditMonth}
                    onChange={(e) => setSelectedAuditMonth(e.target.value)}
                    className="form-input"
                    style={{ height: 38, width: 170, fontSize: '13px', fontWeight: 600 }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>
                      Policy Target:{' '}
                      {workPolicy.custom_day_hours && Object.keys(workPolicy.custom_day_hours).length > 0 ? (
                        <>
                          <strong>{auditExpectedDays} business days</strong> (custom day schedule){' = '}
                          <strong style={{ color: '#2563EB' }}>{auditExpectedHours} hours expected per employee</strong>
                        </>
                      ) : (
                        <>
                          <strong>{auditExpectedDays} business days</strong> × <strong>{workPolicy.daily_expected_hours}h</strong> ={' '}
                          <strong style={{ color: '#2563EB' }}>{auditExpectedHours} hours expected per employee</strong>
                        </>
                      )}
                    </span>

                    {workPolicy.tracking_start_date && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '20px',
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                          border: '1px solid #86EFAC',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title={`Live attendance tracking officially begins on ${workPolicy.tracking_start_date}. Past days are grace days (0h deficit).`}
                      >
                        🚀 Go-Live Date: {workPolicy.tracking_start_date}
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setWorkPolicyModalOpen(true)}
                      className="btn btn-outline"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        borderColor: '#BFDBFE',
                      }}
                      title="Configure official working days, shift hours, grace period, and leave quotas"
                    >
                      <Briefcase size={14} /> Configure Work Policy ({workPolicy.daily_expected_hours}h/day)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Audit Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '14px',
                marginBottom: 20,
              }}
            >
              {/* Expected Hours Card */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Expected Monthly Target
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                  {auditExpectedHours}h <span style={{ fontSize: 13, fontWeight: 500, color: '#64748B' }}>/ staff</span>
                </div>
                <div style={{ fontSize: '11px', color: '#2563EB', marginTop: 2, fontWeight: 600 }}>
                  Expected to Date: {auditExpectedToDateHours}h ({auditElapsedDays} days elapsed)
                </div>
              </div>

              {/* Total Active Worked Hours */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#15803D' }}>
                  Total Active Hours Worked
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#16A34A', marginTop: 4 }}>
                  {totalActualCompanyHours}h
                </div>
                <div style={{ fontSize: '11px', color: '#15803D', marginTop: 2 }}>
                  Company-wide logged work time
                </div>
              </div>

              {/* Cumulative Non-Working / Shortfall Hours */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: totalCompanyNonWorkingHours > 0 ? '#FFFBEB' : '#FFFFFF',
                  borderColor: totalCompanyNonWorkingHours > 0 ? '#FCD34D' : 'var(--border)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#B45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingDown size={14} /> Cumulative Deficit to Date
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                  {totalCompanyNonWorkingHours > 0 ? `-${totalCompanyNonWorkingHours}h` : '0.0h'}
                </div>
                <div style={{ fontSize: '11px', color: '#B45309', marginTop: 2 }}>
                  Month-to-Date shortfall across company
                </div>
              </div>

              {/* Total Company Estimated Pay Cuts */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: totalCompanyPayCuts > 0 ? '#FEF2F2' : '#FFFFFF',
                  borderColor: totalCompanyPayCuts > 0 ? '#FECACA' : 'var(--border)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: totalCompanyPayCuts > 0 ? '#991B1B' : '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Banknote size={14} /> Total Estimated Pay Cuts
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: totalCompanyPayCuts > 0 ? '#DC2626' : '#15803D', marginTop: 4 }}>
                  {totalCompanyPayCuts > 0 ? `-${totalCompanyPayCuts.toLocaleString()} SAR` : '0 SAR'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: 2 }}>
                  Based on salary profile hourly rates
                </div>
              </div>

              {/* Company Adherence % */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0369A1' }}>
                  Shift Adherence Rate
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284C7', marginTop: 4 }}>
                  {averageCompanyAdherence}%
                </div>
                <div style={{ fontSize: '11px', color: '#0369A1', marginTop: 2 }}>
                  {totalCompanyLeaveHours}h Approved Leave included
                </div>
              </div>
            </div>

            {/* Detailed Monthly Audit Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
                <table className="table" style={{ width: '100%', minWidth: '100%', fontSize: '12.5px', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Staff Member
                      </th>
                      <th style={{ padding: '10px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Expected Hours
                      </th>
                      <th style={{ padding: '10px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Actual Worked
                      </th>
                      <th style={{ padding: '10px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Approved Leave
                      </th>
                      <th style={{ padding: '10px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Deficit to Date
                      </th>
                      <th style={{ padding: '10px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Est. Pay Cut
                      </th>
                      <th style={{ padding: '10px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Late Days
                      </th>
                      <th style={{ padding: '10px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Adherence
                      </th>
                      <th style={{ padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAuditList.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          No attendance records found for the selected month ({selectedAuditMonth}).
                        </td>
                      </tr>
                    ) : (
                      paginatedAudit.map((aud) => {
                        const isExempt = Boolean(aud.is_exempt)
                        const mtdDeficit = isExempt ? 0 : (aud.month_to_date_deficit ?? aud.non_working_hours)
                        const hasDeficit = !isExempt && mtdDeficit > 0
                        return (
                          <tr key={aud.employee_id}>
                            {/* Employee */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{aud.employee_name}</span>
                                {isExempt && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      backgroundColor: '#F1F5F9',
                                      color: '#475569',
                                      border: '1px solid #CBD5E1',
                                    }}
                                  >
                                    🛡️ Exempt
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {aud.employee_role} • {aud.employee_email}
                              </div>
                            </td>

                            {/* Expected */}
                            <td style={{ padding: '12px 14px' }}>
                              {isExempt ? (
                                <div>
                                  <div style={{ fontWeight: 700, color: '#64748B' }}>0h (Exempt)</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No hours required</div>
                                </div>
                              ) : (
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {aud.expected_to_date_hours ?? aud.expected_total_hours}h
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    To date ({aud.expected_total_hours}h full mo)
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Actual Worked */}
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#16A34A' }}>
                              {aud.actual_worked_hours}h
                            </td>

                            {/* Approved Leave */}
                            <td style={{ padding: '12px 14px', color: aud.approved_leave_hours > 0 ? '#0284C7' : 'var(--text-tertiary)' }}>
                              {aud.approved_leave_hours > 0 ? `${aud.approved_leave_hours}h` : '-'}
                            </td>

                            {/* Non-Working Hours (Deficit) */}
                            <td style={{ padding: '12px 14px' }}>
                              {isExempt ? (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    backgroundColor: '#F1F5F9',
                                    color: '#475569',
                                    border: '1px solid #E2E8F0',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <ShieldCheck size={12} /> 0h (Exempt)
                                </span>
                              ) : hasDeficit ? (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    backgroundColor: '#FEF3C7',
                                    color: '#B45309',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <TrendingDown size={12} /> -{mtdDeficit}h MTD
                                </span>
                              ) : (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    backgroundColor: '#DCFCE7',
                                    color: '#15803D',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <CheckCircle2 size={12} /> 0h (Target Met)
                                </span>
                              )}
                            </td>

                            {/* Estimated Pay Cut */}
                            <td style={{ padding: '12px 14px' }}>
                              {isExempt ? (
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>
                                  0 {aud.currency || 'SAR'}
                                </span>
                              ) : (aud.estimated_pay_cut || 0) > 0 ? (
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    backgroundColor: '#FEE2E2',
                                    color: '#DC2626',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Banknote size={12} /> -{(aud.estimated_pay_cut || 0).toLocaleString()} {aud.currency || 'SAR'}
                                </span>
                              ) : (aud.hourly_rate === 0 && hasDeficit) ? (
                                <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>
                                  ⚠️ Salary Not Set
                                </span>
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>
                                  0 {aud.currency || 'SAR'}
                                </span>
                              )}
                            </td>

                            {/* Late Days */}
                            <td style={{ padding: '12px 14px', color: isExempt ? 'var(--text-tertiary)' : aud.days_late > 0 ? '#DC2626' : 'var(--text-tertiary)', fontWeight: !isExempt && aud.days_late > 0 ? 600 : 400 }}>
                              {isExempt ? 'Exempt' : aud.days_late > 0 ? `${aud.days_late} Days Late` : 'None'}
                            </td>

                            {/* Adherence Rate */}
                            <td style={{ padding: '12px 14px' }}>
                              {isExempt ? (
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B' }}>
                                  -- (Exempt)
                                </span>
                              ) : (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                                  <span style={{ fontWeight: 700, color: aud.attendance_adherence_percent >= 90 ? '#16A34A' : '#D97706' }}>
                                    {aud.attendance_adherence_percent}%
                                  </span>
                                  <div style={{ width: 70, height: 4, backgroundColor: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${aud.attendance_adherence_percent}%`,
                                        height: '100%',
                                        backgroundColor: aud.attendance_adherence_percent >= 90 ? '#16A34A' : '#D97706',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matchingEmp = adminRoster.find((r) => r.profile_id === aud.employee_id) || {
                                      profile_id: aud.employee_id,
                                      name: aud.employee_name,
                                      email: aud.employee_email,
                                      role: aud.employee_role,
                                      avatar_url: null,
                                      status: 'HQ',
                                      punch_in_at: null,
                                      punch_out_at: null,
                                      total_working_minutes: 0,
                                      punch_in_distance_m: null,
                                      punch_out_distance_m: null,
                                      punch_in_photo_url: null,
                                      punch_out_photo_url: null,
                                    }
                                    setSelectedEmployeeForDetail(matchingEmp as RosterEmployee)
                                    setDetailModalOpen(true)
                                  }}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    color: '#2563EB',
                                    borderColor: '#BFDBFE',
                                    backgroundColor: '#EFF6FF',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title="Inspect full monthly logs, timesheets, and face verification for this employee"
                                >
                                  <Eye size={12} /> View Full Logs
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRegularize(null, aud.employee_name)}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title="Adjust or regularize shifts for this staff member"
                                >
                                  <Edit3 size={12} /> Adjust
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

              <Pagination
                currentPage={auditPage}
                totalItems={monthlyAuditList.length}
                pageSize={auditPageSize}
                onPageChange={setAuditPage}
                onPageSizeChange={setAuditPageSize}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="employees"
              />
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* TAB 2: PUNCH APPROVALS & GEOFENCE EXCEPTIONS (REMOTE/FLAGGED ONLY) */}
        {/* ======================================================= */}
        {activeTab === 'EXCEPTIONS' && canManage && (
          <div>
            {/* Filter Toolbar for Remote & Flagged Punches */}
            <div
              className="card"
              style={{
                padding: '12px 18px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                backgroundColor: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setExceptionsFilter('ALL')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: exceptionsFilter === 'ALL' ? '#D97706' : '#E2E8F0',
                    backgroundColor: exceptionsFilter === 'ALL' ? '#FFFBEB' : '#FFFFFF',
                    color: exceptionsFilter === 'ALL' ? '#B45309' : '#64748B',
                  }}
                >
                  All Punches ({punchApprovalList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setExceptionsFilter('ACTION_NEEDED')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: exceptionsFilter === 'ACTION_NEEDED' ? '#DC2626' : '#E2E8F0',
                    backgroundColor: exceptionsFilter === 'ACTION_NEEDED' ? '#FEF2F2' : '#FFFFFF',
                    color: exceptionsFilter === 'ACTION_NEEDED' ? '#DC2626' : '#64748B',
                  }}
                >
                  ⚡ Action Required ({countPunchActionNeeded})
                </button>

                <button
                  type="button"
                  onClick={() => setExceptionsFilter('FLAGGED')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: exceptionsFilter === 'FLAGGED' ? '#DC2626' : '#E2E8F0',
                    backgroundColor: exceptionsFilter === 'FLAGGED' ? '#FEE2E2' : '#FFFFFF',
                    color: exceptionsFilter === 'FLAGGED' ? '#991B1B' : '#64748B',
                  }}
                >
                  🚩 Flagged ({countPunchFlagged})
                </button>

                <button
                  type="button"
                  onClick={() => setExceptionsFilter('APPROVED')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: exceptionsFilter === 'APPROVED' ? '#16A34A' : '#E2E8F0',
                    backgroundColor: exceptionsFilter === 'APPROVED' ? '#DCFCE7' : '#FFFFFF',
                    color: exceptionsFilter === 'APPROVED' ? '#15803D' : '#64748B',
                  }}
                >
                  ✅ Approved Remote ({countPunchApproved})
                </button>
              </div>

              <div style={{ fontSize: 12, color: '#64748B' }}>
                Showing <strong>{filteredPunchApprovals.length}</strong> remote / flagged punches
              </div>
            </div>

            {/* Exceptions Cards / Empty State */}
            {filteredPunchApprovals.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <CheckCircle2 size={40} color="#16A34A" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {punchApprovalList.length === 0
                    ? 'All Clear! No Remote or Flagged Punches Recorded'
                    : 'No punches match the selected filter'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {punchApprovalList.length === 0
                    ? 'All punches recorded outside Jeddah HQ have been reviewed and approved.'
                    : 'Try switching filters to view other exceptions or approved punches.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                {paginatedPunchApprovals.map((item) => {
                  const isFlagged = item.punch_in_status === 'FLAGGED' || item.punch_out_status === 'FLAGGED'
                  const isPending =
                    item.punch_in_status === 'PENDING_REVIEW' || item.punch_out_status === 'PENDING_REVIEW'

                  const borderColor = isFlagged ? '#DC2626' : isPending ? '#D97706' : '#16A34A'
                  const inDistance = item.punch_in_distance_m || 0
                  const outDistance = item.punch_out_distance_m || 0

                  return (
                    <div
                      key={item.id}
                      className="card"
                      style={{
                        padding: '18px 22px',
                        borderLeft: `5px solid ${borderColor}`,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      {/* Top Header: Employee Info, Date & Status Badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                          borderBottom: '1px solid #F1F5F9',
                          paddingBottom: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              backgroundColor: '#EFF6FF',
                              color: '#2563EB',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 14,
                              overflow: 'hidden',
                            }}
                          >
                            {item.employee_avatar ? (
                              <img
                                src={item.employee_avatar}
                                alt={item.employee_name || 'Staff'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              (item.employee_name || 'S').charAt(0)
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.employee_name || 'Staff Member'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {item.employee_role || 'AGENT'} • {item.employee_email || ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                            📅 {item.date}
                          </span>

                          {isFlagged ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 6,
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FCA5A5',
                              }}
                            >
                              🚩 FLAGGED PUNCH
                            </span>
                          ) : isPending ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 6,
                                backgroundColor: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #FCD34D',
                              }}
                            >
                              ⏳ PENDING REVIEW
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: 6,
                                backgroundColor: '#DCFCE7',
                                color: '#16A34A',
                                border: '1px solid #86EFAC',
                              }}
                            >
                              ✅ APPROVED REMOTE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Punch Details Row */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: 14,
                        }}
                      >
                        {/* Punch In Details */}
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            display: 'flex',
                            gap: 12,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                Punch In ({item.punch_in_at ? new Date(item.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'})
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor:
                                    item.punch_in_status === 'FLAGGED'
                                      ? '#FEE2E2'
                                      : item.punch_in_status === 'APPROVED'
                                        ? '#DCFCE7'
                                        : '#FEF3C7',
                                  color:
                                    item.punch_in_status === 'FLAGGED'
                                      ? '#DC2626'
                                      : item.punch_in_status === 'APPROVED'
                                        ? '#15803D'
                                        : '#B45309',
                                }}
                              >
                                {item.punch_in_status || 'PENDING'}
                              </span>
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                              📍 <strong>{formatDistance(inDistance)}</strong> from HQ • Reason:{' '}
                              <strong>{item.punch_in_reason || 'Field Work'}</strong>
                            </div>

                            {item.punch_in_explanation && (
                              <div style={{ fontSize: 11.5, color: '#475569', fontStyle: 'italic', marginTop: 2 }}>
                                &ldquo;{item.punch_in_explanation}&rdquo;
                              </div>
                            )}

                            {item.punch_in_device_info && (
                              <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                                💻 {item.punch_in_device_info.deviceName || item.punch_in_device_info.os} · {item.punch_in_device_info.browser}
                                {item.punch_in_ip ? ` • 🌐 ${item.punch_in_ip}` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Punch Out Details (if recorded) */}
                        {item.punch_out_at && (
                          <div
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              display: 'flex',
                              gap: 12,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  Punch Out ({new Date(item.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    backgroundColor:
                                      item.punch_out_status === 'FLAGGED'
                                        ? '#FEE2E2'
                                        : item.punch_out_status === 'APPROVED'
                                          ? '#DCFCE7'
                                          : '#FEF3C7',
                                    color:
                                      item.punch_out_status === 'FLAGGED'
                                        ? '#DC2626'
                                        : item.punch_out_status === 'APPROVED'
                                          ? '#15803D'
                                          : '#B45309',
                                  }}
                                >
                                  {item.punch_out_status || 'PENDING'}
                                </span>
                              </div>

                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                                📍 <strong>{formatDistance(outDistance)}</strong> from HQ • Worked:{' '}
                                <strong>{Math.floor(item.total_working_minutes / 60)}h {item.total_working_minutes % 60}m</strong>
                              </div>

                              {item.punch_out_reason && (
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                  Reason: <strong>{item.punch_out_reason}</strong>
                                </div>
                              )}

                              {item.punch_out_device_info && (
                                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                                  💻 {item.punch_out_device_info.deviceName || item.punch_out_device_info.os} · {item.punch_out_device_info.browser}
                                  {item.punch_out_ip ? ` • 🌐 ${item.punch_out_ip}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Review Notes & Inspect Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 10,
                          paddingTop: 4,
                        }}
                      >
                        <div>
                          {item.review_notes ? (
                            <div style={{ fontSize: 12, color: '#475569' }}>
                              📝 <strong>Review Note:</strong> &ldquo;{item.review_notes}&rdquo;{' '}
                              {item.reviewed_at && (
                                <span style={{ color: '#94A3B8' }}>
                                  ({new Date(item.reviewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                              No review notes recorded yet.
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedException(item)
                              setSelectedExceptionType('IN')
                              setExceptionModalOpen(true)
                            }}
                            className="btn btn-outline"
                            style={{
                              padding: '6px 14px',
                              fontSize: 12,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            Inspect Punch In Proof <ChevronRight size={13} />
                          </button>

                          {item.punch_out_at && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedException(item)
                                setSelectedExceptionType('OUT')
                                setExceptionModalOpen(true)
                              }}
                              className="btn btn-outline"
                              style={{
                                padding: '6px 14px',
                                fontSize: 12,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              Inspect Punch Out Proof <ChevronRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Pagination for Punch Approvals */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <Pagination
                    currentPage={exceptionsPage}
                    totalItems={filteredPunchApprovals.length}
                    pageSize={exceptionsPageSize}
                    onPageChange={setExceptionsPage}
                    onPageSizeChange={setExceptionsPageSize}
                    pageSizeOptions={[10, 25, 50]}
                    itemLabel="remote / flagged punches"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================= */}
        {/* TAB 3: SHIFT REGULARIZATION REQUESTS (DEDICATED QUEUE) */}
        {/* ======================================================= */}
        {activeTab === 'REGULARIZATIONS' && canManage && (
          <div>
            {/* Feedback Banner */}
            {regularizeFeedbackMsg && (
              <div
                style={{
                  padding: '12px 18px',
                  marginBottom: 16,
                  borderRadius: 10,
                  backgroundColor: regularizeFeedbackMsg.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${regularizeFeedbackMsg.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
                  color: regularizeFeedbackMsg.type === 'success' ? '#15803D' : '#991B1B',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span>{regularizeFeedbackMsg.type === 'success' ? '✅' : '⚠️'}</span>
                <span>{regularizeFeedbackMsg.message}</span>
              </div>
            )}

            {/* Filter Toolbar for Regularization Requests */}
            <div
              className="card"
              style={{
                padding: '12px 18px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                backgroundColor: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setRegularizationsFilter('PENDING')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: regularizationsFilter === 'PENDING' ? '#7C3AED' : '#E2E8F0',
                    backgroundColor: regularizationsFilter === 'PENDING' ? '#F5F3FF' : '#FFFFFF',
                    color: regularizationsFilter === 'PENDING' ? '#6D28D9' : '#64748B',
                  }}
                >
                  ⏳ Pending Review ({countRegPending})
                </button>

                <button
                  type="button"
                  onClick={() => setRegularizationsFilter('ALL')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: regularizationsFilter === 'ALL' ? '#7C3AED' : '#E2E8F0',
                    backgroundColor: regularizationsFilter === 'ALL' ? '#F5F3FF' : '#FFFFFF',
                    color: regularizationsFilter === 'ALL' ? '#6D28D9' : '#64748B',
                  }}
                >
                  All Requests ({allRegularizations.length})
                </button>

                <button
                  type="button"
                  onClick={() => setRegularizationsFilter('APPROVED')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: regularizationsFilter === 'APPROVED' ? '#16A34A' : '#E2E8F0',
                    backgroundColor: regularizationsFilter === 'APPROVED' ? '#DCFCE7' : '#FFFFFF',
                    color: regularizationsFilter === 'APPROVED' ? '#15803D' : '#64748B',
                  }}
                >
                  ✅ Approved &amp; Regularized ({countRegApproved})
                </button>

                <button
                  type="button"
                  onClick={() => setRegularizationsFilter('REJECTED')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: regularizationsFilter === 'REJECTED' ? '#DC2626' : '#E2E8F0',
                    backgroundColor: regularizationsFilter === 'REJECTED' ? '#FEE2E2' : '#FFFFFF',
                    color: regularizationsFilter === 'REJECTED' ? '#991B1B' : '#64748B',
                  }}
                >
                  ❌ Rejected ({countRegRejected})
                </button>
              </div>

              <div style={{ fontSize: 12, color: '#64748B' }}>
                Showing <strong>{filteredRegularizations.length}</strong> shift regularization requests
              </div>
            </div>

            {/* Regularization Cards / Empty State */}
            {filteredRegularizations.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <CheckCircle2 size={40} color="#16A34A" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {allRegularizations.length === 0
                    ? 'All Clear! No Shift Regularization Requests'
                    : 'No requests match the selected filter'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {allRegularizations.length === 0
                    ? 'Employees have not submitted any pending shift regularizations.'
                    : 'Try switching filters to view approved or rejected requests.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                {paginatedRegularizations.map((item) => {
                  const regDetails = parseRegularizationRequestNotes(item.review_notes)
                  const isApproved =
                    item.punch_in_status === 'APPROVED' &&
                    (item.punch_out_status === 'APPROVED' || !item.punch_out_status) &&
                    Boolean(item.review_notes?.includes('Regularized:'))
                  const isRejected =
                    item.punch_in_status === 'FLAGGED' || Boolean(item.review_notes?.includes('REJECTED REGULARIZATION'))
                  const isPending = !isApproved && !isRejected

                  const borderColor = isApproved ? '#16A34A' : isRejected ? '#DC2626' : '#7C3AED'

                  return (
                    <div
                      key={item.id}
                      className="card"
                      style={{
                        padding: '20px 24px',
                        borderLeft: `5px solid ${borderColor}`,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      {/* Header: Employee Info & Status */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                          borderBottom: '1px solid #F1F5F9',
                          paddingBottom: 14,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
                              color: '#FFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 15,
                              flexShrink: 0,
                            }}
                          >
                            {(item.employee_name || 'E').charAt(0)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                {item.employee_name || 'Employee'}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  backgroundColor: '#F3E8FF',
                                  color: '#7C3AED',
                                }}
                              >
                                {item.employee_role || 'AGENT'}
                              </span>
                              {item.employee_email && (
                                <span style={{ fontSize: 12, color: '#64748B' }}>
                                  {item.employee_email}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Calendar size={13} color="#64748B" />
                              <span>Shift Date: <strong>{item.date}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isApproved ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 12px',
                                borderRadius: 6,
                                backgroundColor: '#DCFCE7',
                                color: '#16A34A',
                                border: '1px solid #86EFAC',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Check size={13} /> APPROVED &amp; REGULARIZED
                            </span>
                          ) : isRejected ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 12px',
                                borderRadius: 6,
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FCA5A5',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <X size={13} /> REJECTED
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 12px',
                                borderRadius: 6,
                                backgroundColor: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #FCD34D',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Clock size={13} /> PENDING REVIEW
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Requested Shift Adjustment Details Box */}
                      <div
                        style={{
                          padding: '16px 20px',
                          borderRadius: 10,
                          backgroundColor: '#FAF5FF',
                          border: '1px solid #E9D5FF',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={17} color="#7C3AED" />
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#581C87' }}>
                              Requested Shift Adjustment:
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#6D28D9' }}>
                            Requested:{' '}
                            <span style={{ color: '#15803D' }}>
                              {regDetails.requestedIn ||
                                (item.punch_in_at
                                  ? formatDisplayTime(item.punch_in_at)
                                  : '09:00 AM')}
                            </span>{' '}
                            ➔{' '}
                            <span style={{ color: '#15803D' }}>
                              {regDetails.requestedOut ||
                                (item.punch_out_at
                                  ? formatDisplayTime(item.punch_out_at)
                                  : '05:00 PM')}
                            </span>
                            {regDetails.requestedDurationHours && (
                              <span style={{ marginLeft: 8, color: '#581C87', backgroundColor: '#F3E8FF', padding: '2px 8px', borderRadius: 4 }}>
                                Duration: {regDetails.requestedDurationHours}
                              </span>
                            )}
                          </div>
                        </div>

                        {regDetails.reason && (
                          <div
                            style={{
                              fontSize: 13,
                              color: '#4C1D95',
                              backgroundColor: '#FFFFFF',
                              padding: '10px 14px',
                              borderRadius: 8,
                              border: '1px solid #F3E8FF',
                            }}
                          >
                            <strong>Employee Reason:</strong> &ldquo;{regDetails.reason}&rdquo;
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            color: '#6B7280',
                            flexWrap: 'wrap',
                            gap: 8,
                            paddingTop: 6,
                            borderTop: '1px dashed #E9D5FF',
                          }}
                        >
                          <span>
                            Raw Recorded Punches:{' '}
                            <strong>
                              In: {item.punch_in_at ? formatDisplayTime(item.punch_in_at) : 'None'}
                            </strong>{' '}
                            |{' '}
                            <strong>
                              Out: {item.punch_out_at ? formatDisplayTime(item.punch_out_at) : 'None'}
                            </strong>
                          </span>
                          <span>
                            Standard Workday Policy: <strong>{workPolicy.daily_expected_hours}h</strong>
                          </span>
                        </div>
                      </div>

                      {/* Footer Actions / Review Notes */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 200 }}>
                          {item.review_notes && (
                            <div style={{ fontSize: 12, color: '#475569' }}>
                              📝 <strong>Audit Notes:</strong> &ldquo;{item.review_notes}&rdquo;{' '}
                              {item.reviewed_at && (
                                <span style={{ color: '#94A3B8' }}>
                                  ({new Date(item.reviewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleQuickApproveRegularization(item)}
                                disabled={isProcessingRegularizeId === item.id}
                                className="btn btn-primary"
                                style={{
                                  padding: '7px 16px',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  backgroundColor: '#16A34A',
                                  borderColor: '#16A34A',
                                  color: '#FFFFFF',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                                title="1-click approve requested shift regularization"
                              >
                                <Check size={14} /> {isProcessingRegularizeId === item.id ? 'Approving...' : 'Quick Approve'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenRegularize(item, item.employee_name)}
                                className="btn btn-outline"
                                style={{
                                  padding: '7px 16px',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  backgroundColor: '#FFFFFF',
                                  borderColor: '#7C3AED',
                                  color: '#7C3AED',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                                title="Review and adjust times before confirming"
                              >
                                <Edit3 size={14} /> Review &amp; Adjust
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRejectRegularization(item)}
                                disabled={isProcessingRegularizeId === item.id}
                                className="btn btn-outline"
                                style={{
                                  padding: '7px 14px',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  backgroundColor: '#FFFFFF',
                                  borderColor: '#DC2626',
                                  color: '#DC2626',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                title="Decline this regularization request"
                              >
                                <X size={14} /> Reject
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <span style={{ fontSize: 12.5, color: '#16A34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={14} /> Shift regularized &amp; updated in timesheets
                            </span>
                          )}

                          {isRejected && (
                            <span style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <X size={14} /> Request declined
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Pagination for Regularizations */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <Pagination
                    currentPage={regularizationsPage}
                    totalItems={filteredRegularizations.length}
                    pageSize={regularizationsPageSize}
                    onPageChange={setRegularizationsPage}
                    onPageSizeChange={setRegularizationsPageSize}
                    pageSizeOptions={[10, 25, 50]}
                    itemLabel="regularization requests"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================= */}
        {/* TAB 4: LEAVE MANAGEMENT QUEUE */}
        {/* ======================================================= */}
        {activeTab === 'LEAVES' && canManage && (
          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
                <table className="table" style={{ width: '100%', minWidth: '750px', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Staff Member
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Leave Category
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Dates &amp; Duration
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Reason
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Approval Status
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLeaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          No leave requests filed yet.
                        </td>
                      </tr>
                    ) : (
                      paginatedLeaves.map((req) => (
                        <tr key={req.id}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {req.employee_name || 'Staff Member'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                backgroundColor: req.leave_type === 'ANNUAL' ? '#E0F2FE' : '#ECFDF5',
                                color: req.leave_type === 'ANNUAL' ? '#0369A1' : '#047857',
                              }}
                            >
                              {req.leave_type} LEAVE
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>
                            {req.start_date} to {req.end_date} (<strong>{req.total_days} days</strong>)
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.reason || '-'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                backgroundColor:
                                  req.status === 'APPROVED' ? '#DCFCE7' : req.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                                color:
                                  req.status === 'APPROVED' ? '#15803D' : req.status === 'REJECTED' ? '#B91C1C' : '#B45309',
                              }}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            {req.status === 'PENDING' ? (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  onClick={() => handleLeaveApproval(req.id, 'REJECTED')}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    borderColor: '#FCA5A5',
                                    color: '#DC2626',
                                    backgroundColor: '#FEF2F2',
                                  }}
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleLeaveApproval(req.id, 'APPROVED')}
                                  className="btn btn-primary"
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: 12,
                                    backgroundColor: '#16A34A',
                                    borderColor: '#16A34A',
                                  }}
                                >
                                  Approve &amp; Deduct
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Processed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={leavesPage}
                totalItems={allLeaveRequests.length}
                pageSize={leavesPageSize}
                onPageChange={setLeavesPage}
                onPageSizeChange={setLeavesPageSize}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="leave requests"
              />
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* TAB 5: MY ATTENDANCE & HISTORY */}
        {/* ======================================================= */}
        {activeTab === 'MY_LOGS' && (
          <div>
            {/* Personal Work Hours & Punctuality Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '18px',
              }}
            >
              {/* Worked Hours */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Total Worked Hours</span>
                  <Clock size={16} color="#2563EB" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
                  {myMonthlyStats.totalWorkedHours} hrs
                </div>
                <div style={{ fontSize: '11.5px', color: '#16A34A', marginTop: '3px', fontWeight: 600 }}>
                  🟢 Actual logged time on shift
                </div>
              </div>

              {/* Late Arrivals */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Late Arrivals</span>
                  <AlertTriangle size={16} color={myMonthlyStats.lateDaysCount > 0 ? '#D97706' : '#16A34A'} />
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: myMonthlyStats.lateDaysCount > 0 ? '#D97706' : '#15803D',
                    marginTop: '6px',
                  }}
                >
                  {myMonthlyStats.lateDaysCount} {myMonthlyStats.lateDaysCount === 1 ? 'Day' : 'Days'} Late
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  {myMonthlyStats.totalLateMinutes > 0
                    ? `${myMonthlyStats.totalLateMinutes}m total past ${workPolicy.shift_start_time || '09:00'} (+${myMonthlyStats.graceMinutes}m grace)`
                    : '✓ Perfect on-time record'}
                </div>
              </div>

              {/* Non-Working Deficit Hours & Pay Cut */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: Number(myMonthlyStats.deficitHours) > 0 ? '#FEF2F2' : '#FFFFFF',
                  borderRadius: '12px',
                  border: Number(myMonthlyStats.deficitHours) > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: Number(myMonthlyStats.deficitHours) > 0 ? '#991B1B' : '#64748B' }}>
                    Not In Office (MTD Deficit)
                  </span>
                  <TrendingDown size={16} color={Number(myMonthlyStats.deficitHours) > 0 ? '#DC2626' : '#16A34A'} />
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: Number(myMonthlyStats.deficitHours) > 0 ? '#DC2626' : '#15803D',
                    marginTop: '6px',
                  }}
                >
                  {Number(myMonthlyStats.deficitHours) > 0 ? `-${myMonthlyStats.deficitHours} hrs` : '0.0 hrs'}
                </div>
                <div style={{ fontSize: '11.5px', marginTop: '4px', fontWeight: 600 }}>
                  {Number(myMonthlyStats.deficitHours) > 0 ? (
                    myMonthlyStats.hasSalaryProfile ? (
                      <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Banknote size={13} /> Est. Pay Cut: -{myMonthlyStats.estimatedPayCut.toLocaleString()} {myMonthlyStats.currency}
                      </span>
                    ) : (
                      <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={13} /> Pay Cut: Salary Profile Not Configured
                      </span>
                    )
                  ) : myMonthlyStats.isExempt ? (
                    <span style={{ color: '#16A34A' }}>
                      ✓ 0 SAR Pay Cut • Tracking Exempt
                    </span>
                  ) : (myMonthlyStats.effectiveStartDate && todayDateStr < myMonthlyStats.effectiveStartDate) ? (
                    <span style={{ color: '#16A34A' }}>
                      ✓ 0 SAR Pay Cut • Go-Live on {myMonthlyStats.effectiveStartDate}
                    </span>
                  ) : (
                    <span style={{ color: '#16A34A' }}>
                      ✓ 0 SAR Pay Cut • Shift Target Met to Date
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                  {myMonthlyStats.isExempt ? (
                    'Exempt from attendance tracking'
                  ) : (myMonthlyStats.effectiveStartDate && todayDateStr < myMonthlyStats.effectiveStartDate) ? (
                    `Tracking begins ${myMonthlyStats.effectiveStartDate} (Grace period active)`
                  ) : (
                    `Expected MTD: ${myMonthlyStats.mtdExpectedHours}h (${myMonthlyStats.mtdExpectedDays} working days passed)`
                  )}
                </div>
              </div>

              {/* Approved Leaves */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Approved Leaves</span>
                  <Calendar size={16} color="#0284C7" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284C7', marginTop: '6px' }}>
                  {myMonthlyStats.approvedLeaveDays} Days
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  {myMonthlyStats.approvedLeaveHours} hrs MTD approved time off
                  {myMonthlyStats.totalApprovedLeaveDaysInMonth > myMonthlyStats.approvedLeaveDays && (
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginTop: '1px' }}>
                      ({myMonthlyStats.totalApprovedLeaveDaysInMonth} days approved for full month)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    My Monthly Attendance Register ({myHistory.length} Days)
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Past 60 days login history, shift adherence, and working hours
                  </p>
                </div>

                <button
                  onClick={handleExportCsv}
                  className="btn btn-outline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    padding: '6px 12px',
                  }}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="table-responsive-wrapper attendance-desktop-only" style={{ overflowX: 'auto', width: '100%' }}>
                <table className="table" style={{ width: '100%', minWidth: '820px', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Date
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Punch In (Login)
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Punctuality
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Punch Out (Logout)
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Total Duration
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Shift Balance &amp; Regularization
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>
                        Verification Location
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {myHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          No punches logged yet. Clock in today using the button above!
                        </td>
                      </tr>
                    ) : (
                      paginatedMyHistory.map((item) => {
                        const inTime = formatDisplayTime(item.punch_in_at)
                        const outTime = formatDisplayTime(item.punch_out_at)
                        const isUnclosedPast = !item.punch_out_at && item.date < new Date().toISOString().split('T')[0]
                        const isAutoClosed = Boolean(item.is_auto_closed) || isUnclosedPast
                        let workingMinutes = item.total_working_minutes || 0
                        if (isUnclosedPast && workingMinutes === 0 && item.punch_in_at) {
                          const inDate = new Date(item.punch_in_at)
                          const inMin = inDate.getHours() * 60 + inDate.getMinutes()
                          const endMin = 17 * 60
                          workingMinutes = Math.max(0, endMin - inMin)
                        }
                        const hrs = (workingMinutes / 60).toFixed(1)
                        const isHq = item.punch_in_status === 'APPROVED'

                        // Punctuality check
                        let punctualityBadge = <span style={{ color: '#94A3B8' }}>--</span>
                        if (item.punch_in_at) {
                          const inDate = new Date(item.punch_in_at)
                          const inMin = inDate.getHours() * 60 + inDate.getMinutes()
                          const isLate = inMin > myMonthlyStats.shiftStartCutoffMinutes
                          const lateMins = isLate ? inMin - (myMonthlyStats.shiftHour * 60 + myMonthlyStats.shiftMinute) : 0

                          punctualityBadge = isLate ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: '#FEF3C7',
                                color: '#B45309',
                              }}
                            >
                              🟡 Late (+{lateMins}m)
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: '#DCFCE7',
                                color: '#15803D',
                              }}
                            >
                              🟢 On-Time
                            </span>
                          )
                        }

                        // Determine expected hours configured for this specific day
                        let dayExpectedH = workPolicy.daily_expected_hours || 8
                        if (item.date) {
                          const d = new Date(item.date + 'T00:00:00')
                          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
                          if (workPolicy.custom_day_hours && workPolicy.custom_day_hours[dayName] !== undefined) {
                            dayExpectedH = workPolicy.custom_day_hours[dayName]
                          }
                        }
                        const dayExpectedM = dayExpectedH * 60
                        const diff = workingMinutes - dayExpectedM
                        const deficitH = (Math.abs(diff) / 60).toFixed(1)

                        // Regularization Request details & status
                        const regDetails = parseRegularizationRequestNotes(item.review_notes)
                        const isRegApproved =
                          (item.punch_in_status === 'APPROVED' || item.punch_out_status === 'APPROVED') &&
                          Boolean(item.review_notes?.includes('Regularized:'))
                        const isRegRejected =
                          Boolean(item.review_notes?.includes('REJECTED REGULARIZATION')) ||
                          Boolean(item.review_notes?.includes('REJECTED'))
                        const isRegPending =
                          !isRegApproved &&
                          !isRegRejected &&
                          (item.punch_out_status === 'PENDING_REVIEW' ||
                            item.punch_in_status === 'PENDING_REVIEW' ||
                            regDetails.isRegularization)

                        // Shift Balance & Regularize Options
                        let shiftBalance = <span style={{ color: '#94A3B8' }}>--</span>
                        if (isRegPending) {
                          shiftBalance = (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: '220px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {isAutoClosed && (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      backgroundColor: '#FEF3C7',
                                      color: '#B45309',
                                    }}
                                  >
                                    ⚠️ Auto-Closed
                                  </span>
                                )}
                                {diff < 0 ? (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>
                                    -{deficitH}h Deficit ({hrs}h / {dayExpectedH}h)
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>
                                    ✓ Recorded {hrs}h
                                  </span>
                                )}
                              </div>

                              <div
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  backgroundColor: '#FAF5FF',
                                  border: '1px solid #E9D5FF',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                  fontSize: 11.5,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                  <span style={{ fontWeight: 700, color: '#7C3AED', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} /> Pending Review (1 active)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRegularize(item, canManage ? '' : (profile?.name || ''))}
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: '#2563EB',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      padding: 0,
                                    }}
                                  >
                                    Edit Submitted Request
                                  </button>
                                </div>
                                <div style={{ color: '#581C87', fontWeight: 600 }}>
                                  Submitted:{' '}
                                  <strong style={{ color: '#15803D' }}>{regDetails.requestedIn || inTime}</strong> ➔{' '}
                                  <strong style={{ color: '#15803D' }}>{regDetails.requestedOut || outTime}</strong>
                                  {regDetails.requestedDurationHours && (
                                    <span style={{ marginLeft: 6, color: '#7C3AED', fontWeight: 700 }}>
                                      ({regDetails.requestedDurationHours})
                                    </span>
                                  )}
                                </div>
                                {regDetails.reason && (
                                  <div style={{ color: '#6B7280', fontSize: 11, fontStyle: 'italic', wordBreak: 'break-word' }}>
                                    Reason: &ldquo;{regDetails.reason}&rdquo;
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        } else if (isRegApproved) {
                          shiftBalance = (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16A34A' }}>
                                ✓ Met Shift ({hrs}h / {dayExpectedH}h)
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  backgroundColor: '#DCFCE7',
                                  color: '#15803D',
                                  border: '1px solid #86EFAC',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  width: 'fit-content',
                                }}
                              >
                                <Check size={12} /> Regularized &amp; Approved
                              </span>
                            </div>
                          )
                        } else if (isRegRejected) {
                          shiftBalance = (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {diff < 0 && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>
                                  -{deficitH}h Deficit
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  backgroundColor: '#FEE2E2',
                                  color: '#DC2626',
                                  border: '1px solid #FCA5A5',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  width: 'fit-content',
                                }}
                              >
                                <X size={12} /> Regularization Declined
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenRegularize(item, canManage ? '' : (profile?.name || ''))}
                                style={{
                                  fontSize: 11,
                                  color: '#2563EB',
                                  textDecoration: 'underline',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  padding: 0,
                                  fontWeight: 600,
                                }}
                              >
                                Submit Revised Request
                              </button>
                            </div>
                          )
                        } else if (isAutoClosed) {
                          shiftBalance = (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  backgroundColor: '#FEF3C7',
                                  color: '#B45309',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  width: 'fit-content',
                                }}
                              >
                                ⚠️ Auto-Closed (17:00 EOD)
                              </span>
                              {diff < 0 && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>
                                  -{deficitH}h Deficit
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenRegularize(item, canManage ? '' : (profile?.name || ''))}
                                style={{
                                  fontSize: 11,
                                  color: '#2563EB',
                                  textDecoration: 'underline',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  padding: 0,
                                  fontWeight: 600,
                                }}
                              >
                                {canManage ? 'Regularize / Edit Punch' : 'Request Regularization'}
                              </button>
                            </div>
                          )
                        } else if (item.punch_out_at) {
                          const isGraceDay = Boolean(myMonthlyStats.effectiveStartDate && item.date && item.date < myMonthlyStats.effectiveStartDate)
                          shiftBalance = isGraceDay ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>
                                🟢 Grace Day (0h Deficit)
                              </span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>
                                {hrs}h logged • Prior to go-live
                              </span>
                            </div>
                          ) : myMonthlyStats.isExempt ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>
                                🟢 Tracking Exempt
                              </span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>
                                {hrs}h logged
                              </span>
                            </div>
                          ) : diff < 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                                -{(Math.abs(diff) / 60).toFixed(1)}h Deficit
                              </span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>
                                {hrs}h / {dayExpectedH}h shift
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenRegularize(item, canManage ? '' : (profile?.name || ''))}
                                style={{
                                  fontSize: 11,
                                  color: '#2563EB',
                                  textDecoration: 'underline',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  padding: 0,
                                  fontWeight: 600,
                                }}
                              >
                                {canManage ? 'Adjust' : 'Request Adjustment'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>
                                ✓ Met Shift (0h Deficit)
                              </span>
                              <span style={{ fontSize: 11, color: '#64748B' }}>
                                {hrs}h / {dayExpectedH}h shift
                              </span>
                            </div>
                          )
                        } else if (item.punch_in_at) {
                          shiftBalance = (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB' }}>
                              🟢 Active Shift ({hrs}h)
                            </span>
                          )
                        }

                        return (
                          <tr key={item.id}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.date}
                            </td>
                            <td style={{ padding: '12px 14px', color: inTime !== '--:--' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: inTime !== '--:--' ? 600 : 400 }}>
                              {inTime}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {punctualityBadge}
                            </td>
                            <td style={{ padding: '12px 14px', color: outTime !== '--:--' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: outTime !== '--:--' ? 600 : 400 }}>
                              {outTime}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284C7' }}>
                              {hrs} hrs ({workingMinutes}m)
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {shiftBalance}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  backgroundColor: isHq ? '#DCFCE7' : '#FEF3C7',
                                  color: isHq ? '#15803D' : '#B45309',
                                }}
                              >
                                {isHq ? '🟢 Jeddah HQ' : '🟡 Remote / Field'}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (Phones & Small Viewports) */}
              <div className="attendance-mobile-only" style={{ padding: '12px 14px' }}>
                {myHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                    No punches logged yet. Clock in today using the button above!
                  </div>
                ) : (
                  paginatedMyHistory.map((item) => {
                    const inTime = formatDisplayTime(item.punch_in_at)
                    const outTime = formatDisplayTime(item.punch_out_at)
                    const isUnclosedPast = !item.punch_out_at && item.date < new Date().toISOString().split('T')[0]
                    const isAutoClosed = Boolean(item.is_auto_closed) || isUnclosedPast
                    let workingMinutes = item.total_working_minutes || 0
                    if (isUnclosedPast && workingMinutes === 0 && item.punch_in_at) {
                      const inDate = new Date(item.punch_in_at)
                      const inMin = inDate.getHours() * 60 + inDate.getMinutes()
                      const endMin = 17 * 60
                      workingMinutes = Math.max(0, endMin - inMin)
                    }
                    const hrs = (workingMinutes / 60).toFixed(1)
                    const isHq = item.punch_in_status === 'APPROVED'

                    // Punctuality check
                    let punctualityBadge = null
                    if (item.punch_in_at) {
                      const inDate = new Date(item.punch_in_at)
                      const inMin = inDate.getHours() * 60 + inDate.getMinutes()
                      const isLate = inMin > myMonthlyStats.shiftStartCutoffMinutes
                      const lateMins = isLate ? inMin - (myMonthlyStats.shiftHour * 60 + myMonthlyStats.shiftMinute) : 0

                      punctualityBadge = isLate ? (
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                          }}
                        >
                          🟡 Late (+{lateMins}m)
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                          }}
                        >
                          🟢 On-Time
                        </span>
                      )
                    }

                    // Determine expected hours configured for this specific day
                    let dayExpectedH = workPolicy.daily_expected_hours || 8
                    if (item.date) {
                      const d = new Date(item.date + 'T00:00:00')
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
                      if (workPolicy.custom_day_hours && workPolicy.custom_day_hours[dayName] !== undefined) {
                        dayExpectedH = workPolicy.custom_day_hours[dayName]
                      }
                    }
                    const dayExpectedM = dayExpectedH * 60
                    const diff = workingMinutes - dayExpectedM
                    const deficitH = (Math.abs(diff) / 60).toFixed(1)

                    // Regularization Request details & status
                    const regDetails = parseRegularizationRequestNotes(item.review_notes)
                    const isRegApproved =
                      (item.punch_in_status === 'APPROVED' || item.punch_out_status === 'APPROVED') &&
                      Boolean(item.review_notes?.includes('Regularized:'))
                    const isRegRejected =
                      Boolean(item.review_notes?.includes('REJECTED REGULARIZATION')) ||
                      Boolean(item.review_notes?.includes('REJECTED'))
                    const isRegPending =
                      !isRegApproved &&
                      !isRegRejected &&
                      (item.punch_out_status === 'PENDING_REVIEW' ||
                        item.punch_in_status === 'PENDING_REVIEW' ||
                        regDetails.isRegularization)

                    return (
                      <div
                        key={item.id}
                        className="attendance-mobile-card"
                        style={{
                          borderLeft: `4px solid ${isRegPending ? '#7C3AED' : isRegApproved ? '#16A34A' : diff < 0 ? '#DC2626' : '#2563EB'
                            }`,
                        }}
                      >
                        {/* Top: Date + Location + Punctuality */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={14} color="#64748B" />
                            {item.date}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: isHq ? '#DCFCE7' : '#FEF3C7',
                                color: isHq ? '#15803D' : '#B45309',
                              }}
                            >
                              {isHq ? '🟢 HQ' : '🟡 Remote'}
                            </span>
                            {punctualityBadge}
                          </div>
                        </div>

                        {/* Punch In / Out Times Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 8,
                            padding: '10px 12px',
                            borderRadius: 8,
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                              Punch In
                            </div>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: inTime !== '--:--' ? '#0F172A' : '#94A3B8', marginTop: 1 }}>
                              {inTime}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                              Punch Out
                            </div>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: outTime !== '--:--' ? '#0F172A' : '#94A3B8', marginTop: 1 }}>
                              {outTime}
                            </div>
                          </div>
                        </div>

                        {/* Total Duration & Status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0284C7' }}>
                            Worked: {hrs} hrs ({workingMinutes}m)
                          </div>
                          {(() => {
                            const isGraceDay = Boolean(myMonthlyStats.effectiveStartDate && item.date && item.date < myMonthlyStats.effectiveStartDate)
                            if (isGraceDay) {
                              return (
                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#16A34A' }}>
                                  🟢 Grace Day (0h Deficit)
                                </span>
                              )
                            }
                            if (myMonthlyStats.isExempt) {
                              return (
                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#16A34A' }}>
                                  🟢 Tracking Exempt
                                </span>
                              )
                            }
                            if (diff < 0) {
                              return (
                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#DC2626' }}>
                                  -{deficitH}h Deficit ({dayExpectedH}h shift)
                                </span>
                              )
                            }
                            return (
                              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#16A34A' }}>
                                ✓ Met Shift ({dayExpectedH}h)
                              </span>
                            )
                          })()}
                        </div>

                        {/* Regularization Action / Status Section */}
                        {isRegPending ? (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              backgroundColor: '#FAF5FF',
                              border: '1px solid #E9D5FF',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              fontSize: 11.5,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ fontWeight: 700, color: '#7C3AED', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} /> Pending Review
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenRegularize(item, canManage ? '' : (profile?.name || ''))}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#2563EB',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  padding: 0,
                                }}
                              >
                                Edit Request
                              </button>
                            </div>
                            <div style={{ color: '#581C87', fontWeight: 600 }}>
                              Req: <strong style={{ color: '#15803D' }}>{regDetails.requestedIn || inTime}</strong> ➔{' '}
                              <strong style={{ color: '#15803D' }}>{regDetails.requestedOut || outTime}</strong>
                            </div>
                          </div>
                        ) : isRegApproved ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                backgroundColor: '#DCFCE7',
                                color: '#15803D',
                                border: '1px solid #86EFAC',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Check size={12} /> Regularized &amp; Approved
                            </span>
                          </div>
                        ) : isRegRejected ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FCA5A5',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <X size={12} /> Declined
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenRegularize(item, canManage ? '' : (profile?.name || ''))}
                              style={{
                                fontSize: 11.5,
                                color: '#2563EB',
                                textDecoration: 'underline',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              Submit Revised
                            </button>
                          </div>
                        ) : isAutoClosed || (item.punch_out_at && diff < 0) ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 4, borderTop: '1px dashed #E2E8F0' }}>
                            <span style={{ fontSize: 11, color: '#64748B' }}>
                              {isAutoClosed ? '⚠️ Auto-Closed' : 'Deficit hours'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenRegularize(item, canManage ? '' : (profile?.name || ''))}
                              className="btn btn-outline btn-sm"
                              style={{
                                fontSize: 11.5,
                                padding: '4px 10px',
                                color: '#2563EB',
                                borderColor: '#BFDBFE',
                                backgroundColor: '#EFF6FF',
                                fontWeight: 600,
                              }}
                            >
                              Request Regularization
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>

              <Pagination
                currentPage={myHistoryPage}
                totalItems={myHistory.length}
                pageSize={myHistoryPageSize}
                onPageChange={setMyHistoryPage}
                onPageSizeChange={setMyHistoryPageSize}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="punches logged"
              />
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* TAB 6: MY LEAVE REQUESTS & BALANCE (FOR EMPLOYEES & ALL) */}
        {/* ======================================================= */}
        {activeTab === 'MY_LEAVES' && (
          <div>
            {/* Quota Cards */}
            <div
              className="attendance-kpi-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
                marginBottom: '18px',
              }}
            >
              {/* Annual Paid Leave */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0369A1' }}>Annual Paid Leave</span>
                  <Calendar size={16} color="#0284C7" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284C7', marginTop: '6px' }}>
                  {remainingAnnualLeave} / {leaveBalances.annual_leave_total} Days
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  {leaveBalances.annual_leave_used} days taken this year
                </div>
              </div>

              {/* Sick Leave */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>Sick Leave</span>
                  <Award size={16} color="#059669" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
                  {leaveBalances.sick_leave_total - leaveBalances.sick_leave_used} / {leaveBalances.sick_leave_total} Days
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  {leaveBalances.sick_leave_used} days claimed
                </div>
              </div>

              {/* Emergency Leave */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#B45309' }}>Emergency Leave</span>
                  <AlertTriangle size={16} color="#D97706" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '6px' }}>
                  {leaveBalances.emergency_leave_used} Days
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  Emergency excused days used
                </div>
              </div>

              {/* Unpaid Leave */}
              <div
                className="card"
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Unpaid Leave</span>
                  <Clock size={16} color="#64748B" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#475569', marginTop: '6px' }}>
                  {leaveBalances.unpaid_leave_used} Days
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  Unpaid absence days logged
                </div>
              </div>
            </div>

            {/* My Leave Applications & Approval History */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    My Leave Applications &amp; History ({myLeaveRequests.length})
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Track all requested, approved, and pending time-off applications
                  </p>
                </div>

                <button
                  onClick={() => setLeaveModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 700,
                  }}
                >
                  <Plus size={15} /> Request Leave
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="table-responsive-wrapper attendance-desktop-only" style={{ overflowX: 'auto', width: '100%' }}>
                <table className="table" style={{ width: '100%', minWidth: '760px', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Leave Type
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Date Range &amp; Duration
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Reason / Purpose
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Requested On
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Approval Status
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>
                        Management Feedback
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          <Calendar size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                          You have not submitted any leave applications yet.
                          <div style={{ marginTop: '8px' }}>
                            <button
                              onClick={() => setLeaveModalOpen(true)}
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: '12px' }}
                            >
                              Apply for Annual or Sick Leave
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedMyLeaves.map((req) => (
                        <tr key={req.id}>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                backgroundColor:
                                  req.leave_type === 'ANNUAL'
                                    ? '#E0F2FE'
                                    : req.leave_type === 'SICK'
                                      ? '#ECFDF5'
                                      : req.leave_type === 'EMERGENCY'
                                        ? '#FEF3C7'
                                        : '#F1F5F9',
                                color:
                                  req.leave_type === 'ANNUAL'
                                    ? '#0369A1'
                                    : req.leave_type === 'SICK'
                                      ? '#047857'
                                      : req.leave_type === 'EMERGENCY'
                                        ? '#B45309'
                                        : '#475569',
                              }}
                            >
                              {req.leave_type} LEAVE
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {req.start_date} to {req.end_date} (<strong>{req.total_days} {req.total_days === 1 ? 'day' : 'days'}</strong>)
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', maxWidth: 220 }}>
                            {req.reason || '-'}
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-tertiary)', fontSize: 12 }}>
                            {new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor:
                                  req.status === 'APPROVED' ? '#DCFCE7' : req.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                                color:
                                  req.status === 'APPROVED' ? '#15803D' : req.status === 'REJECTED' ? '#B91C1C' : '#B45309',
                              }}
                            >
                              {req.status === 'APPROVED' ? '🟢 APPROVED' : req.status === 'REJECTED' ? '🔴 REJECTED' : '🟡 PENDING APPROVAL'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {req.admin_notes || (req.status === 'APPROVED' ? 'Approved by Admin' : req.status === 'PENDING' ? 'Awaiting Review' : '-')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Leaves Card View (Phones & Small Viewports) */}
              <div className="attendance-mobile-only" style={{ padding: '12px 14px' }}>
                {myLeaveRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                    <Calendar size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                    You have not submitted any leave applications yet.
                  </div>
                ) : (
                  paginatedMyLeaves.map((req) => (
                    <div
                      key={req.id}
                      className="attendance-mobile-card"
                      style={{
                        borderLeft: `4px solid ${req.status === 'APPROVED' ? '#16A34A' : req.status === 'REJECTED' ? '#DC2626' : '#F59E0B'
                          }`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 4,
                            backgroundColor:
                              req.leave_type === 'ANNUAL'
                                ? '#E0F2FE'
                                : req.leave_type === 'SICK'
                                  ? '#ECFDF5'
                                  : req.leave_type === 'EMERGENCY'
                                    ? '#FEF3C7'
                                    : '#F1F5F9',
                            color:
                              req.leave_type === 'ANNUAL'
                                ? '#0369A1'
                                : req.leave_type === 'SICK'
                                  ? '#047857'
                                  : req.leave_type === 'EMERGENCY'
                                    ? '#B45309'
                                    : '#475569',
                          }}
                        >
                          {req.leave_type} LEAVE
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 4,
                            backgroundColor:
                              req.status === 'APPROVED' ? '#DCFCE7' : req.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                            color:
                              req.status === 'APPROVED' ? '#15803D' : req.status === 'REJECTED' ? '#B91C1C' : '#B45309',
                          }}
                        >
                          {req.status === 'APPROVED' ? '🟢 APPROVED' : req.status === 'REJECTED' ? '🔴 REJECTED' : '🟡 PENDING'}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {req.start_date} ➔ {req.end_date}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: 2 }}>
                          Total Duration: <strong>{req.total_days} {req.total_days === 1 ? 'day' : 'days'}</strong>
                        </div>
                      </div>

                      {req.reason && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: 6 }}>
                          &ldquo;{req.reason}&rdquo;
                        </div>
                      )}

                      {req.admin_notes && (
                        <div style={{ fontSize: '11.5px', color: '#475569', borderTop: '1px dashed #E2E8F0', paddingTop: 6 }}>
                          <strong>Note:</strong> {req.admin_notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <Pagination
                currentPage={myLeavesPage}
                totalItems={myLeaveRequests.length}
                pageSize={myLeavesPageSize}
                onPageChange={setMyLeavesPage}
                onPageSizeChange={setMyLeavesPageSize}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="leave requests"
              />
            </div>
          </div>
        )}
      </div>

      {/* ======================================================= */}
      {/* 5. MODALS */}
      {/* ======================================================= */}
      <PunchModal
        isOpen={punchModalOpen}
        onClose={() => setPunchModalOpen(false)}
        userId={userId}
        userName={profile?.name || 'Employee'}
        userAvatar={profile?.avatar_url || null}
        punchType={punchType}
        office={office}
        onSuccess={loadInitialData}
      />

      <OfficeSettingsModal
        isOpen={officeModalOpen}
        onClose={() => setOfficeModalOpen(false)}
        currentOffice={office}
        onUpdated={(newLoc) => {
          setOffice(newLoc)
          loadInitialData()
        }}
      />

      <WorkPolicyModal
        isOpen={workPolicyModalOpen}
        onClose={() => setWorkPolicyModalOpen(false)}
        currentPolicy={workPolicy}
        onUpdated={(newPol) => {
          setWorkPolicy(newPol)
          loadInitialData()
          if (canManage) {
            loadMonthlyAudit(selectedAuditMonth)
          }
        }}
      />

      <RegularizeAttendanceModal
        isOpen={regularizeModalOpen}
        onClose={() => {
          setRegularizeModalOpen(false)
          setRegularizeLog(null)
          setRegularizeEmployeeName('')
        }}
        log={regularizeLog}
        employeeName={regularizeEmployeeName || profile?.name || 'Employee'}
        adminId={userId}
        expectedHours={workPolicy.daily_expected_hours || 8}
        isRequestMode={!canManage}
        onSuccess={() => {
          loadInitialData()
          if (canManage) {
            loadMonthlyAudit(selectedAuditMonth)
          }
        }}
      />

      <LeaveRequestModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        userId={userId}
        balances={leaveBalances}
        onSubmitted={loadInitialData}
      />

      <ExceptionReviewModal
        isOpen={exceptionModalOpen}
        onClose={() => setExceptionModalOpen(false)}
        log={selectedException}
        punchType={selectedExceptionType}
        adminId={userId}
        onReviewed={loadInitialData}
        onOpenAdjustHours={(log) => {
          setRegularizeLog(log)
          const emp = adminRoster.find((r) => r.profile_id === log.user_id)
          setRegularizeEmployeeName(emp?.name || log.employee_name || '')
          setRegularizeModalOpen(true)
        }}
      />

      {/* Detailed Employee Attendance Inspector Modal */}
      <EmployeeAttendanceDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedEmployeeForDetail(null)
        }}
        employee={selectedEmployeeForDetail}
        adminId={userId}
      />

      {/* Custom In-App Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        variant="danger"
        title={
          deleteConfirmModal.isDedicatedReq
            ? 'Delete Regularization Request'
            : 'Delete Punch / Attendance Record'
        }
        message={
          deleteConfirmModal.record ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
                Are you sure you want to permanently delete this {deleteConfirmModal.isDedicatedReq ? 'regularization request' : 'shift & punch record'} for{' '}
                <strong style={{ color: '#0F172A', fontWeight: 700 }}>
                  {deleteConfirmModal.record.employee_name || 'this employee'}
                </strong>{' '}
                on <strong style={{ color: '#0F172A', fontWeight: 700 }}>{deleteConfirmModal.record.date}</strong>?
              </p>
              {(deleteConfirmModal.record.review_notes || (deleteConfirmModal.record as any).reason) && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    color: '#991B1B',
                  }}
                >
                  <strong>Note:</strong> {deleteConfirmModal.record.review_notes || (deleteConfirmModal.record as any).reason}
                </div>
              )}
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                ⚠️ This action cannot be undone. The record will be permanently deleted from daily rosters, timesheet history, and deficit audits.
              </p>
            </div>
          ) : (
            'Are you sure you want to permanently delete this record?'
          )
        }
        confirmLabel="Yes, Delete Permanently"
        cancelLabel="Cancel"
        loading={isProcessingRegularizeId === deleteConfirmModal.record?.id}
        onConfirm={confirmAdminDeleteRecord}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, record: null, isDedicatedReq: false })}
      />
    </div>
  )
}
