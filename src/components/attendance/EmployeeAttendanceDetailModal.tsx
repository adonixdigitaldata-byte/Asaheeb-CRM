'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  User,
  Clock,
  Calendar,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  TrendingDown,
  TrendingUp,
  Banknote,
  Edit3,
  Trash2,
  Loader2,
} from 'lucide-react'
import { AttendanceLog, LeaveBalance, LeaveRequest, RosterEmployee, CompanyWorkPolicy, EmployeeShiftSchedule } from '@/types/attendance'
import {
  fetchUserAttendanceHistory,
  fetchLeaveBalances,
  fetchUserLeaveRequests,
  fetchCompanyWorkPolicy,
  saveEmployeeCustomSchedule,
  updateEmployeeLeaveBalance,
  deleteAttendanceLog,
  toggleEmployeeTrackingExemption,
  fetchUserSalaryProfile,
  calculateExpectedHoursInMonth,
  getEmployeeShiftEnd,
  getLocalDateString,
} from '@/lib/attendanceService'
import { formatDistance, getGoogleMapsUrl } from '@/lib/geoUtils'
import RegularizeAttendanceModal from '@/components/attendance/RegularizeAttendanceModal'
import ConfirmModal from '@/components/ConfirmModal'
import DeviceAuditModal from '@/components/attendance/DeviceAuditModal'

interface EmployeeAttendanceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  employee: RosterEmployee | null
  adminId: string
}

const ALL_DAYS = [
  { key: 'SUNDAY', label: 'Sunday' },
  { key: 'MONDAY', label: 'Monday' },
  { key: 'TUESDAY', label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY', label: 'Friday' },
  { key: 'SATURDAY', label: 'Saturday' },
]

export default function EmployeeAttendanceDetailModal({
  isOpen,
  onClose,
  employee,
  adminId,
}: EmployeeAttendanceDetailModalProps) {
  const [history, setHistory] = useState<AttendanceLog[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [policy, setPolicy] = useState<CompanyWorkPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [regularizeLog, setRegularizeLog] = useState<AttendanceLog | null>(null)
  const [regularizeModalOpen, setRegularizeModalOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Tracking Exemption state
  const [isTrackingExempt, setIsTrackingExempt] = useState(false)
  const [isTogglingExemption, setIsTogglingExemption] = useState(false)

  // Leave editing state
  const [isEditingLeave, setIsEditingLeave] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    annual_total: 21,
    annual_used: 0,
    sick_total: 30,
    sick_used: 0,
    unpaid_used: 0,
    emergency_used: 0,
  })
  const [isSavingLeave, setIsSavingLeave] = useState(false)
  const [leaveSaveSuccess, setLeaveSaveSuccess] = useState(false)

  // Schedule editing state
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)
  const [useCustomSchedule, setUseCustomSchedule] = useState(false)
  const [enableEmpCustomDays, setEnableEmpCustomDays] = useState(false)
  const [empCustomDayHours, setEmpCustomDayHours] = useState<Record<string, number>>({})
  const [empCustomDaySchedules, setEmpCustomDaySchedules] = useState<Record<string, { startTime: string; endTime: string; hours: number }>>({})
  const [scheduleForm, setScheduleForm] = useState({
    shift_start_time: '09:00',
    shift_end_time: '17:00',
    daily_expected_hours: 8.0,
    grace_period_mins: 15,
  })
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [scheduleSaveSuccess, setScheduleSaveSuccess] = useState(false)

  // In-app Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean
    record: AttendanceLog | null
  }>({
    isOpen: false,
    record: null,
  })
  const [selectedDetailMonth, setSelectedDetailMonth] = useState<string>(() => new Date().toISOString().slice(0, 7))
  const [historyViewMode, setHistoryViewMode] = useState<'SELECTED_MONTH' | 'PAST_60_DAYS'>('SELECTED_MONTH')
  const [salaryProfile, setSalaryProfile] = useState<{ base_salary: number; currency: string; joining_date?: string | null } | null>(null)
  const [isDeletingRecord, setIsDeletingRecord] = useState(false)
  const [auditModalLog, setAuditModalLog] = useState<AttendanceLog | null>(null)

  useEffect(() => {
    if (isOpen && employee) {
      loadEmployeeData(employee.profile_id)
    }
  }, [isOpen, employee])

  async function loadEmployeeData(id: string) {
    setLoading(true)
    try {
      const [bal, reqs, pol, sal] = await Promise.all([
        fetchLeaveBalances(id),
        fetchUserLeaveRequests(id),
        fetchCompanyWorkPolicy(),
        fetchUserSalaryProfile(id),
      ])
      if (bal) setLeaveBalances(bal)
      if (reqs) setLeaveRequests(reqs)
      if (pol) setPolicy(pol)
      if (sal) setSalaryProfile(sal)

      // Pass company policy so unclosed shifts are auto-closed at individual employee shift end times!
      const hist = await fetchUserAttendanceHistory(id, pol || undefined)
      if (hist) setHistory(hist)

      if (bal) {
        setLeaveForm({
          annual_total: bal.annual_leave_total ?? 21,
          annual_used: bal.annual_leave_used ?? 0,
          sick_total: bal.sick_leave_total ?? 30,
          sick_used: bal.sick_leave_used ?? 0,
          unpaid_used: bal.unpaid_leave_used ?? 0,
          emergency_used: bal.emergency_leave_used ?? 0,
        })
      }

      if (pol) {
        const empSched = pol.custom_employee_schedules?.[id]
        const isExempt =
          (pol.exempt_employee_ids || []).includes(id) ||
          Boolean(empSched?.is_exempt_from_tracking)
        setIsTrackingExempt(isExempt)

        if (empSched) {
          setUseCustomSchedule(true)
          setScheduleForm({
            shift_start_time: empSched.shift_start_time || pol.shift_start_time?.slice(0, 5) || '09:00',
            shift_end_time: empSched.shift_end_time || pol.shift_end_time?.slice(0, 5) || '17:00',
            daily_expected_hours: empSched.daily_expected_hours || pol.daily_expected_hours || 8.0,
            grace_period_mins: empSched.grace_period_mins ?? pol.grace_period_mins ?? 15,
          })
          const dayHrs = empSched.custom_day_hours || {}
          const dayScheds = empSched.custom_day_schedules || {}
          setEmpCustomDayHours(dayHrs)
          setEmpCustomDaySchedules(dayScheds)
          setEnableEmpCustomDays(Object.keys(dayHrs).length > 0 || Object.keys(dayScheds).length > 0)
        } else {
          setUseCustomSchedule(false)
          setEnableEmpCustomDays(false)
          setEmpCustomDayHours({})
          setEmpCustomDaySchedules({})
          setScheduleForm({
            shift_start_time: pol.shift_start_time?.slice(0, 5) || '09:00',
            shift_end_time: pol.shift_end_time?.slice(0, 5) || '17:00',
            daily_expected_hours: pol.daily_expected_hours || 8.0,
            grace_period_mins: pol.grace_period_mins ?? 15,
          })
        }
      }
    } catch (err) {
      console.error('Error loading employee details:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleExemption(newExemptVal: boolean) {
    if (!employee) return
    setIsTogglingExemption(true)
    try {
      const updated = await toggleEmployeeTrackingExemption(employee.profile_id, newExemptVal)
      setPolicy(updated)
      setIsTrackingExempt(newExemptVal)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('asaheeb_attendance_updated'))
      }
    } catch (err) {
      console.error('Failed to toggle tracking exemption:', err)
    } finally {
      setIsTogglingExemption(false)
    }
  }

  async function handleConfirmDeleteLog() {
    const { record } = deleteConfirmModal
    if (!record || !employee) return

    setIsDeletingRecord(true)
    try {
      const ok = await deleteAttendanceLog({
        logId: record.id,
        userId: record.user_id || employee.profile_id,
        date: record.date,
      })

      if (ok) {
        setHistory((prev) => prev.filter((l) => l.id !== record.id && l.date !== record.date))
        setDeleteConfirmModal({ isOpen: false, record: null })
        // Reload fresh data
        loadEmployeeData(employee.profile_id)
      }
    } catch (err) {
      console.error('Failed to delete attendance log:', err)
    } finally {
      setIsDeletingRecord(false)
      setDeleteConfirmModal({ isOpen: false, record: null })
    }
  }

  function computeHours(start: string, end: string): number {
    if (!start || !end) return 8.0
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 8.0
    let diffMinutes = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))
    if (diffMinutes < 0) diffMinutes += 24 * 60
    return Math.round((diffMinutes / 60) * 10) / 10
  }

  function handleMainShiftTimingChange(field: 'start' | 'end', val: string) {
    const newStart = field === 'start' ? val : scheduleForm.shift_start_time
    const newEnd = field === 'end' ? val : scheduleForm.shift_end_time
    const autoHours = computeHours(newStart, newEnd)
    setScheduleForm((prev) => ({
      ...prev,
      shift_start_time: newStart,
      shift_end_time: newEnd,
      daily_expected_hours: autoHours,
    }))
  }

  function handleEmpDayHoursChange(dayKey: string, hours: number) {
    setEmpCustomDayHours((prev) => ({
      ...prev,
      [dayKey]: hours,
    }))
    setEmpCustomDaySchedules((prev) => {
      const existing = prev[dayKey] || {
        startTime: scheduleForm.shift_start_time,
        endTime: scheduleForm.shift_end_time,
        hours,
      }
      return {
        ...prev,
        [dayKey]: {
          ...existing,
          hours,
        },
      }
    })
  }

  function handleEmpDayTimingChange(dayKey: string, field: 'start' | 'end', val: string) {
    const existing = empCustomDaySchedules[dayKey] || {
      startTime: scheduleForm.shift_start_time,
      endTime: scheduleForm.shift_end_time,
      hours: empCustomDayHours[dayKey] ?? scheduleForm.daily_expected_hours,
    }
    const newStart = field === 'start' ? val : existing.startTime
    const newEnd = field === 'end' ? val : existing.endTime
    const autoHours = computeHours(newStart, newEnd)

    setEmpCustomDaySchedules((prev) => ({
      ...prev,
      [dayKey]: {
        startTime: newStart,
        endTime: newEnd,
        hours: autoHours,
      },
    }))

    setEmpCustomDayHours((prev) => ({
      ...prev,
      [dayKey]: autoHours,
    }))
  }

  async function handleSaveLeaveBalances() {
    if (!employee) return
    setIsSavingLeave(true)
    try {
      const updated = await updateEmployeeLeaveBalance(employee.profile_id, {
        annual_leave_total: Number(leaveForm.annual_total),
        annual_leave_used: Number(leaveForm.annual_used),
        sick_leave_total: Number(leaveForm.sick_total),
        sick_leave_used: Number(leaveForm.sick_used),
        unpaid_leave_used: Number(leaveForm.unpaid_used),
        emergency_leave_used: Number(leaveForm.emergency_used),
      })
      setLeaveBalances(updated)
      setLeaveSaveSuccess(true)
      setTimeout(() => {
        setLeaveSaveSuccess(false)
        setIsEditingLeave(false)
      }, 1200)
    } catch (err) {
      console.error('Failed to update leave balance:', err)
    } finally {
      setIsSavingLeave(false)
    }
  }

  async function handleSaveSchedule() {
    if (!employee) return
    setIsSavingSchedule(true)
    try {
      const schedulePayload: EmployeeShiftSchedule | null = useCustomSchedule
        ? {
            shift_start_time: scheduleForm.shift_start_time,
            shift_end_time: scheduleForm.shift_end_time,
            daily_expected_hours: Number(scheduleForm.daily_expected_hours),
            grace_period_mins: Number(scheduleForm.grace_period_mins),
            custom_day_hours: enableEmpCustomDays ? empCustomDayHours : undefined,
            custom_day_schedules: enableEmpCustomDays ? empCustomDaySchedules : undefined,
            is_exempt_from_tracking: isTrackingExempt,
          }
        : null

      const updatedPol = await saveEmployeeCustomSchedule(employee.profile_id, schedulePayload)
      setPolicy(updatedPol)
      setScheduleSaveSuccess(true)
      setTimeout(() => {
        setScheduleSaveSuccess(false)
        setIsEditingSchedule(false)
      }, 1200)
    } catch (err) {
      console.error('Failed to update employee schedule:', err)
    } finally {
      setIsSavingSchedule(false)
    }
  }

  // Lock background window / body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const origHtmlOverflow = document.documentElement.style.overflow
      const origBodyOverflow = document.body.style.overflow
      const origHtmlOverscroll = document.documentElement.style.overscrollBehavior
      const origBodyOverscroll = document.body.style.overscrollBehavior

      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overscrollBehavior = 'none'
      document.body.style.overscrollBehavior = 'none'

      return () => {
        document.documentElement.style.overflow = origHtmlOverflow
        document.body.style.overflow = origBodyOverflow
        document.documentElement.style.overscrollBehavior = origHtmlOverscroll
        document.body.style.overscrollBehavior = origBodyOverscroll
      }
    }
  }, [isOpen])



  if (!isOpen || !employee) return null

  const todayLog = employee.today_log
  const remainingAnnual = leaveBalances
    ? Math.max(0, leaveBalances.annual_leave_total - leaveBalances.annual_leave_used)
    : 21

  // Month calculation & deficit analysis for selectedDetailMonth
  const [detailYearStr, detailMonthStr] = selectedDetailMonth.split('-')
  const detailYear = parseInt(detailYearStr, 10) || new Date().getFullYear()
  const detailMonth = parseInt(detailMonthStr, 10) || (new Date().getMonth() + 1)
  const isCurrentMonth = detailYear === new Date().getFullYear() && detailMonth === (new Date().getMonth() + 1)
  const isPastMonth = new Date().getFullYear() > detailYear || (new Date().getFullYear() === detailYear && (new Date().getMonth() + 1) > detailMonth)

  const empSchedule = policy?.custom_employee_schedules?.[employee.profile_id]
  const isExempt = (policy?.exempt_employee_ids || []).includes(employee.profile_id) || Boolean(empSchedule?.is_exempt_from_tracking)

  const empShiftStart = empSchedule?.shift_start_time || policy?.shift_start_time || '09:00'
  const empShiftEnd = empSchedule?.shift_end_time || policy?.shift_end_time || '17:00'
  const empGrace = empSchedule?.grace_period_mins ?? policy?.grace_period_mins ?? 15
  const empDailyHours = empSchedule?.daily_expected_hours ?? policy?.daily_expected_hours ?? 8.0
  const empWorkDays = empSchedule?.work_days || policy?.work_days || ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']
  const effectiveCustomDayHours = empSchedule?.custom_day_hours || policy?.custom_day_hours
  const effectiveCustomDaySchedules = empSchedule?.custom_day_schedules || policy?.custom_day_schedules

  const effectiveStartDate = (() => {
    const dates: string[] = []
    if (policy?.tracking_start_date && !isPastMonth) {
      dates.push(policy.tracking_start_date)
    } else if (policy?.tracking_start_date && isPastMonth && policy.tracking_start_date.startsWith(`${detailYear}-${detailMonthStr}`)) {
      dates.push(policy.tracking_start_date)
    }
    if (salaryProfile?.joining_date) dates.push(salaryProfile.joining_date)
    if (dates.length === 0) return null
    return dates.sort().pop() || null
  })()

  const todayStr = getLocalDateString()
  const todayStaffLog = history.find((l) => l.date === todayStr)
  const isShiftDoneToday = Boolean(todayStaffLog?.punch_out_at)

  const monthCalc = calculateExpectedHoursInMonth(
    detailYear,
    detailMonth,
    empWorkDays,
    empDailyHours,
    effectiveCustomDayHours,
    policy?.official_holidays,
    undefined,
    effectiveStartDate,
    empShiftEnd,
    isShiftDoneToday
  )

  // Logs for selected detail month (strictly filtering by effectiveStartDate for actual worked hours)
  const monthLogs = history.filter((h) => h.date && h.date.startsWith(selectedDetailMonth))
  const validMonthLogs = monthLogs.filter((h) => !effectiveStartDate || h.date >= effectiveStartDate)

  const monthActiveMinutes = validMonthLogs.reduce((acc, h) => {
    if (h.punch_in_status === 'FLAGGED' || h.punch_out_status === 'FLAGGED') return acc
    return acc + (h.total_working_minutes || 0)
  }, 0)
  const monthActiveHours = (monthActiveMinutes / 60).toFixed(1)

  // Approved leave hours elapsed for this employee in selected month
  let elapsedLeaveHours = 0
  let elapsedLeaveDays = 0
  ;(leaveRequests || []).filter((r) => r.status === 'APPROVED').forEach((l) => {
    const start = new Date(l.start_date + 'T00:00:00')
    const end = new Date(l.end_date + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dYear = d.getFullYear()
      const dMonth = d.getMonth() + 1
      const dDay = d.getDate()
      const dDateStr = `${dYear}-${dMonth.toString().padStart(2, '0')}-${dDay.toString().padStart(2, '0')}`

      if (dYear === detailYear && dMonth === detailMonth) {
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
        const isWorkDay = empWorkDays.includes(dayName)
        const isHoliday = (policy?.official_holidays || []).some((h) => h.date === dDateStr)
        const isAfterStart = !effectiveStartDate || dDateStr >= effectiveStartDate

        if (isWorkDay && !isHoliday && (isPastMonth || dDateStr <= todayStr) && isAfterStart) {
          const dayHrs = (effectiveCustomDayHours && effectiveCustomDayHours[dayName] !== undefined)
            ? effectiveCustomDayHours[dayName]
            : empDailyHours
          if (dayHrs > 0) {
            elapsedLeaveDays++
            elapsedLeaveHours += dayHrs
          }
        }
      }
    }
  })
  const monthLeaveHours = (Math.round(elapsedLeaveHours * 10) / 10).toFixed(1)

  const expHours = monthCalc.totalHours
  const expToDate = monthCalc.elapsedHours
  const workedHrsNum = parseFloat(monthActiveHours)
  const leaveHrsNum = parseFloat(monthLeaveHours)

  const monthDeficit = isExempt
    ? 0
    : Math.max(0, Math.round((expToDate - workedHrsNum - leaveHrsNum) * 10) / 10)

  const baseSalary = salaryProfile?.base_salary || 0
  const currency = salaryProfile?.currency || 'SAR'
  const hourlyRate = (expHours > 0 && baseSalary > 0)
    ? Math.round((baseSalary / expHours) * 100) / 100
    : 0
  const estimatedPayCut = (hourlyRate > 0 && monthDeficit > 0)
    ? Math.round(monthDeficit * hourlyRate * 10) / 10
    : 0

  // Late days in selected month
  let daysLate = 0
  validMonthLogs.forEach((l) => {
    if (l.punch_in_at && l.date) {
      const punchDate = new Date(l.punch_in_at)
      const dObj = new Date(l.date + 'T00:00:00')
      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
      const daySched = effectiveCustomDaySchedules?.[dayName]
      const dayShiftStart = daySched?.startTime || empShiftStart

      const [sH, sM] = dayShiftStart.split(':').map(Number)
      const validH = isNaN(sH) ? 9 : sH
      const validM = isNaN(sM) ? 0 : sM
      const cutoffMinutes = validH * 60 + validM + empGrace

      const punchMins = punchDate.getHours() * 60 + punchDate.getMinutes()
      if (punchMins > cutoffMinutes) daysLate++
    }
  })

  // Generate unified daily timesheet for selected month including Absent and Leave days
  const unifiedDailyRecords = (() => {
    const recordsMap = new Map<string, AttendanceLog>()
    history.forEach((l) => {
      recordsMap.set(l.date, l)
    })

    const daysInMonth = new Date(detailYear, detailMonth, 0).getDate()
    const result: (AttendanceLog & { isAbsent?: boolean; isLeave?: boolean; leaveReason?: string })[] = []

    const holidaySet = new Set((policy?.official_holidays || []).map((h) => h.date))
    const approvedLeaves = (leaveRequests || []).filter((r) => r.status === 'APPROVED')
    const maxDay = isCurrentMonth ? Math.min(daysInMonth, new Date().getDate()) : daysInMonth

    for (let day = 1; day <= maxDay; day++) {
      const dateStr = `${detailYear}-${detailMonthStr}-${day.toString().padStart(2, '0')}`
      const d = new Date(detailYear, detailMonth - 1, day)
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
      const isWorkDay = empWorkDays.includes(dayName)
      const isHoliday = holidaySet.has(dateStr)
      const isAfterStart = !effectiveStartDate || dateStr >= effectiveStartDate

      const existing = recordsMap.get(dateStr)
      if (existing) {
        result.push(existing)
        continue
      }

      const matchingLeave = approvedLeaves.find((l) => dateStr >= l.start_date && dateStr <= l.end_date)
      if (matchingLeave) {
        result.push({
          id: `leave-${employee.profile_id}-${dateStr}`,
          user_id: employee.profile_id,
          date: dateStr,
          punch_in_at: null,
          punch_out_at: null,
          total_working_minutes: 0,
          punch_in_status: 'APPROVED',
          punch_out_status: 'APPROVED',
          review_notes: `🔵 Approved Leave: ${matchingLeave.leave_type} (${matchingLeave.reason || 'Leave granted'})`,
          created_at: dateStr,
          updated_at: dateStr,
          isLeave: true,
          leaveReason: `${matchingLeave.leave_type} Leave`,
        } as any)
        continue
      }

      if (isWorkDay && !isHoliday && isAfterStart) {
        const dayExpectedHrs = (effectiveCustomDayHours && effectiveCustomDayHours[dayName] !== undefined)
          ? effectiveCustomDayHours[dayName]
          : empDailyHours

        // If employee has 0 scheduled hours for this day (off-day / rest day), do NOT generate an absent record!
        if (dayExpectedHrs <= 0) {
          continue
        }

        const isToday = dateStr === todayStr
        const { endMinutes } = getEmployeeShiftEnd(employee.profile_id, dateStr, policy)
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
        const isShiftOver = isToday ? nowMinutes >= endMinutes : true

        if (!isToday || isShiftOver) {
          result.push({
            id: `absent-${employee.profile_id}-${dateStr}`,
            user_id: employee.profile_id,
            date: dateStr,
            punch_in_at: null,
            punch_out_at: null,
            total_working_minutes: 0,
            punch_in_status: 'FLAGGED',
            punch_out_status: 'FLAGGED',
            review_notes: '🔴 Absent (No punch recorded)',
            created_at: dateStr,
            updated_at: dateStr,
            isAbsent: true,
            expected_hours: dayExpectedHrs,
          } as any)
        }
      }
    }

    return result.sort((a, b) => b.date.localeCompare(a.date))
  })()

  const daysWithPunches = new Set(validMonthLogs.map((l) => l.date)).size
  const daysAbsent = isExempt ? 0 : unifiedDailyRecords.filter((r) => r.isAbsent).length
  const adherencePercent = expToDate > 0 ? Math.min(100, Math.round(((workedHrsNum + leaveHrsNum) / expToDate) * 100)) : 100

  const displayedLogs = historyViewMode === 'SELECTED_MONTH' ? unifiedDailyRecords : history

  function handleExportEmployeeCsv() {
    const rows = [
      [
        'Date',
        'Employee',
        'Punch In',
        'Punch In Status',
        'Punch In Device',
        'Punch In IP',
        'Punch Out',
        'Punch Out Status',
        'Punch Out Device',
        'Punch Out IP',
        'Duration Minutes',
        'Working Hours',
      ],
      ...displayedLogs.map((l: any) => {
        const inDev = l.punch_in_device_info
          ? `${l.punch_in_device_info.deviceName || l.punch_in_device_info.os || ''} (${l.punch_in_device_info.browser || ''})`.trim()
          : 'N/A'
        const outDev = l.punch_out_device_info
          ? `${l.punch_out_device_info.deviceName || l.punch_out_device_info.os || ''} (${l.punch_out_device_info.browser || ''})`.trim()
          : 'N/A'

        const statusStr = l.isAbsent ? 'ABSENT' : l.isLeave ? 'APPROVED_LEAVE' : (l.punch_in_status || 'N/A')

        return [
          l.date,
          employee?.name || '',
          l.punch_in_at ? new Date(l.punch_in_at).toLocaleTimeString() : l.isAbsent ? 'Absent (No punch)' : l.isLeave ? 'On Leave' : 'N/A',
          statusStr,
          inDev,
          l.punch_in_ip || 'N/A',
          l.punch_out_at ? new Date(l.punch_out_at).toLocaleTimeString() : 'N/A',
          l.punch_out_status || (l.isAbsent ? 'ABSENT' : l.isLeave ? 'LEAVE' : 'N/A'),
          outDev,
          l.punch_out_ip || 'N/A',
          (l.total_working_minutes || 0).toString(),
          `${((l.total_working_minutes || 0) / 60).toFixed(1)} hrs`,
        ]
      }),
    ]
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows
        .map((e) =>
          e
            .map((val) => `"${String(val).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const empName = employee?.name || 'employee'
    link.setAttribute('download', `${empName.replace(/\s+/g, '_')}_attendance.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handleNonScrollableWheel(e: React.WheelEvent) {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += e.deltaY
    }
  }

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        className="modal-box"
        style={{
          maxWidth: '1100px',
          width: '95%',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 100000,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          onWheel={handleNonScrollableWheel}
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 700,
              }}
            >
              {employee.name.charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {employee.name}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                  }}
                >
                  {employee.role}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '3px 0 0 0' }}>
                {employee.email} • Work Status:{' '}
                <strong style={{ color: '#0F172A' }}>{employee.work_status}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleExportEmployeeCsv}
              className="btn btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '6px 12px',
                background: '#FFFFFF',
                borderColor: '#CBD5E1',
                color: '#334155',
              }}
            >
              <Download size={14} /> Export Timesheet
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: '#E2E8F0',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div
          ref={scrollContainerRef}
          style={{
            padding: '24px',
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 140px)',
            flex: '1 1 auto',
            minHeight: 0,
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            {/* Today's Status */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                Today's Presence
              </div>
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor:
                      employee.live_status === 'PRESENT_HQ'
                        ? '#DCFCE7'
                        : employee.live_status === 'PRESENT_REMOTE'
                        ? '#FEF08A'
                        : employee.live_status === 'ON_LEAVE'
                        ? '#E0F2FE'
                        : '#F1F5F9',
                    color:
                      employee.live_status === 'PRESENT_HQ'
                        ? '#15803D'
                        : employee.live_status === 'PRESENT_REMOTE'
                        ? '#854D0E'
                        : employee.live_status === 'ON_LEAVE'
                        ? '#0369A1'
                        : '#475569',
                  }}
                >
                  {employee.live_status === 'PRESENT_HQ'
                    ? '🟢 In Office (HQ)'
                    : employee.live_status === 'PRESENT_REMOTE'
                    ? '🟡 Remote / Field'
                    : employee.live_status === 'ON_LEAVE'
                    ? '🔵 On Leave'
                    : '⚪ Not Punched In'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                Clock In:{' '}
                <strong>
                  {todayLog?.punch_in_at
                    ? new Date(todayLog.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </strong>{' '}
                • Clock Out:{' '}
                <strong>
                  {todayLog?.punch_out_at
                    ? new Date(todayLog.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </strong>
              </div>
            </div>

            {/* Work Duration */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                Today's Work Duration
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                {Math.floor(employee.active_minutes / 60)}h {employee.active_minutes % 60}m
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                {todayLog?.punch_out_at ? 'Day completed' : 'Currently active on duty'}
              </div>
            </div>

            {/* This Month's Active Hours */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#4F46E5', textTransform: 'uppercase' }}>
                This Month's Active Hours
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#4338CA', marginTop: '4px' }}>
                {monthActiveHours} hrs
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                {validMonthLogs.length} active work shifts logged
              </div>
            </div>

            {/* Leave Balance Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                    Annual Paid Leave
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingLeave(!isEditingLeave)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4F46E5',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isEditingLeave ? '#EEF2FF' : 'transparent',
                    }}
                  >
                    <Edit3 size={12} /> {isEditingLeave ? 'Close' : 'Adjust Quotas'}
                  </button>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>
                  {remainingAnnual} / {leaveBalances?.annual_leave_total || 21} Days
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  {leaveBalances?.sick_leave_total ? leaveBalances.sick_leave_total - leaveBalances.sick_leave_used : 30} Sick
                  days remaining
                </div>
              </div>
            </div>

            {/* Individual Shift Schedule Overview Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: useCustomSchedule ? '#F0FDF4' : '#F8FAFC',
                border: `1px solid ${useCustomSchedule ? '#86EFAC' : '#E2E8F0'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: useCustomSchedule ? '#166534' : '#4338CA', textTransform: 'uppercase' }}>
                    {useCustomSchedule ? '👤 Custom Shift Schedule' : '🏢 Company Default Schedule'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingSchedule(!isEditingSchedule)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4F46E5',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isEditingSchedule ? '#EEF2FF' : 'transparent',
                    }}
                  >
                    <Edit3 size={12} /> {isEditingSchedule ? 'Close' : 'Edit Timing'}
                  </button>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} color="#4F46E5" />
                  {scheduleForm.shift_start_time} – {scheduleForm.shift_end_time} ({scheduleForm.daily_expected_hours}h)
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Late threshold: Shift + {scheduleForm.grace_period_mins}m grace period
                </div>
              </div>
            </div>

            {/* Attendance Tracking & Deficit Exemption Card */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: isTrackingExempt ? '#FEF2F2' : '#F0FDF4',
                border: `1px solid ${isTrackingExempt ? '#FECACA' : '#BBF7D0'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: isTrackingExempt ? '#991B1B' : '#166534', textTransform: 'uppercase' }}>
                    Tracking Status
                  </div>
                  <button
                    type="button"
                    disabled={isTogglingExemption}
                    onClick={() => handleToggleExemption(!isTrackingExempt)}
                    style={{
                      background: isTrackingExempt ? '#DC2626' : '#FFFFFF',
                      border: `1px solid ${isTrackingExempt ? '#DC2626' : '#CBD5E1'}`,
                      color: isTrackingExempt ? '#FFFFFF' : '#334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: isTogglingExemption ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    {isTogglingExemption ? 'Updating...' : isTrackingExempt ? 'Re-enable Tracking' : 'Exempt from Tracking'}
                  </button>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: isTrackingExempt ? '#B91C1C' : '#15803D', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isTrackingExempt ? '🛡️ Tracking Exempt' : '🟢 Active Tracking'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  {isTrackingExempt
                    ? '0h deficit & 0 SAR deduction in monthly audit'
                    : 'Tracked according to shift hours & timesheets'}
                </div>
              </div>
            </div>
          </div>

          {/* Inline Edit Panel: Adjust Leave Quotas & Balances */}
          {isEditingLeave && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: '#F0F9FF',
                border: '1px solid #BAE6FD',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0369A1', margin: 0 }}>
                    Adjust Leave Quotas &amp; Balances for {employee.name}
                  </h4>
                  <p style={{ fontSize: '11px', color: '#0284C7', margin: '2px 0 0 0' }}>
                    Update this employee's annual leave entitlement, sick leave, and used days directly.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Annual Quota (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={leaveForm.annual_total}
                    onChange={(e) => setLeaveForm({ ...leaveForm, annual_total: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Annual Used (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={leaveForm.annual_used}
                    onChange={(e) => setLeaveForm({ ...leaveForm, annual_used: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Sick Quota (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={leaveForm.sick_total}
                    onChange={(e) => setLeaveForm({ ...leaveForm, sick_total: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Sick Used (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={leaveForm.sick_used}
                    onChange={(e) => setLeaveForm({ ...leaveForm, sick_used: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Emergency Used
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={leaveForm.emergency_used}
                    onChange={(e) => setLeaveForm({ ...leaveForm, emergency_used: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Unpaid Used
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={leaveForm.unpaid_used}
                    onChange={(e) => setLeaveForm({ ...leaveForm, unpaid_used: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditingLeave(false)}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLeaveBalances}
                  disabled={isSavingLeave || leaveSaveSuccess}
                  className="btn btn-primary"
                  style={{
                    padding: '6px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isSavingLeave ? 'Saving...' : leaveSaveSuccess ? '✓ Saved!' : 'Save Leave Balances'}
                </button>
              </div>
            </div>
          )}

          {/* Inline Edit Panel: Configure Employee Shift Schedule */}
          {isEditingSchedule && (
            <div
              style={{
                padding: '20px 22px',
                borderRadius: '16px',
                background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
                border: '1.5px solid #C7D2FE',
                boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#1E1B4B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} color="#4F46E5" /> Individual Working Hours &amp; Shift Schedule
                  </h4>
                  <p style={{ fontSize: '12px', color: '#6366F1', margin: '3px 0 0 0' }}>
                    Personalize shift hours for <strong>{employee.name}</strong>. Late thresholds and deficits will calculate automatically.
                  </p>
                </div>
              </div>

              {/* Segmented Mode Selector */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                <div
                  onClick={() => {
                    setUseCustomSchedule(false)
                    if (policy) {
                      setScheduleForm({
                        shift_start_time: policy.shift_start_time?.slice(0, 5) || '09:00',
                        shift_end_time: policy.shift_end_time?.slice(0, 5) || '17:00',
                        daily_expected_hours: policy.daily_expected_hours || 8.0,
                        grace_period_mins: policy.grace_period_mins ?? 15,
                      })
                    }
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: !useCustomSchedule ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                    border: `1.5px solid ${!useCustomSchedule ? '#4F46E5' : '#E2E8F0'}`,
                    boxShadow: !useCustomSchedule ? '0 2px 8px rgba(79, 70, 229, 0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `2px solid ${!useCustomSchedule ? '#4F46E5' : '#CBD5E1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {!useCustomSchedule && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4F46E5' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: !useCustomSchedule ? '#4338CA' : '#475569' }}>
                        🏢 Company Standard Policy
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {policy?.shift_start_time?.slice(0, 5) || '09:00'} – {policy?.shift_end_time?.slice(0, 5) || '17:00'} ({policy?.daily_expected_hours || 8}h/day)
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setUseCustomSchedule(true)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: useCustomSchedule ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                    border: `1.5px solid ${useCustomSchedule ? '#4F46E5' : '#E2E8F0'}`,
                    boxShadow: useCustomSchedule ? '0 2px 8px rgba(79, 70, 229, 0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `2px solid ${useCustomSchedule ? '#4F46E5' : '#CBD5E1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {useCustomSchedule && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4F46E5' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: useCustomSchedule ? '#4338CA' : '#475569' }}>
                        👤 Personalized Custom Shift
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        Custom daily start/end &amp; individual timings
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {useCustomSchedule && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #E0E7FF',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                    Base Shift Configuration (Auto-calculates Hours)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Shift Start Time
                      </label>
                      <input
                        type="time"
                        value={scheduleForm.shift_start_time}
                        onChange={(e) => handleMainShiftTimingChange('start', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid #CBD5E1',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0F172A',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Shift End Time
                      </label>
                      <input
                        type="time"
                        value={scheduleForm.shift_end_time}
                        onChange={(e) => handleMainShiftTimingChange('end', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid #CBD5E1',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0F172A',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Expected Hours / Day
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="24"
                          value={scheduleForm.daily_expected_hours}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, daily_expected_hours: Number(e.target.value) })}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1.5px solid #818CF8',
                            fontSize: '13px',
                            fontWeight: 800,
                            color: '#4338CA',
                            backgroundColor: '#EEF2FF',
                          }}
                        />
                        <span style={{ position: 'absolute', right: '10px', top: '8px', fontSize: '11px', fontWeight: 700, color: '#6366F1' }}>
                          hrs
                        </span>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Grace Period (Mins)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={scheduleForm.grace_period_mins}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, grace_period_mins: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid #CBD5E1',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0F172A',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>
                  </div>

                  {/* Day-to-Day Custom Hours for this Employee */}
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed #E2E8F0' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#1E1B4B',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enableEmpCustomDays}
                        onChange={(e) => setEnableEmpCustomDays(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#4F46E5', cursor: 'pointer' }}
                      />
                      <span>✨ Set different hours for specific days for {employee.name} (e.g. 7 hours on Saturday)</span>
                    </label>

                    {enableEmpCustomDays && (
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        {ALL_DAYS.filter((d) => (policy?.work_days || ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'SATURDAY']).includes(d.key)).map((d) => {
                          const daySchedule = empCustomDaySchedules[d.key]
                          const dayStartTime = daySchedule?.startTime || scheduleForm.shift_start_time
                          const dayEndTime = daySchedule?.endTime || scheduleForm.shift_end_time
                          const currentHours =
                            empCustomDayHours[d.key] !== undefined && empCustomDayHours[d.key] !== null
                              ? empCustomDayHours[d.key]
                              : scheduleForm.daily_expected_hours

                          const isCustom = Boolean(
                            (empCustomDayHours[d.key] !== undefined && empCustomDayHours[d.key] !== scheduleForm.daily_expected_hours) ||
                            (daySchedule && (daySchedule.startTime !== scheduleForm.shift_start_time || daySchedule.endTime !== scheduleForm.shift_end_time))
                          )

                          return (
                            <div
                              key={d.key}
                              style={{
                                padding: '12px 14px',
                                borderRadius: '10px',
                                backgroundColor: isCustom ? '#EEF2FF' : '#F8FAFC',
                                border: `1.5px solid ${isCustom ? '#6366F1' : '#E2E8F0'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                  {d.label}
                                </span>
                                {isCustom ? (
                                  <span style={{ fontSize: '10px', backgroundColor: '#4F46E5', color: '#FFFFFF', fontWeight: 700, padding: '2px 7px', borderRadius: '999px' }}>
                                    {currentHours}h Shift
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                                    Standard ({scheduleForm.daily_expected_hours}h)
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '8px', alignItems: 'center' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={dayStartTime}
                                    onChange={(e) => handleEmpDayTimingChange(d.key, 'start', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #CBD5E1',
                                      fontSize: '12px',
                                      backgroundColor: '#FFFFFF',
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={dayEndTime}
                                    onChange={(e) => handleEmpDayTimingChange(d.key, 'end', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #CBD5E1',
                                      fontSize: '12px',
                                      backgroundColor: '#FFFFFF',
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                                    Hours
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    max="24"
                                    value={currentHours}
                                    onChange={(e) => handleEmpDayHoursChange(d.key, parseFloat(e.target.value) || 0)}
                                    style={{
                                      width: '100%',
                                      padding: '5px 6px',
                                      borderRadius: '6px',
                                      border: `1.5px solid ${isCustom ? '#4F46E5' : '#CBD5E1'}`,
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      textAlign: 'center',
                                      backgroundColor: isCustom ? '#FFFFFF' : '#FFFFFF',
                                      color: isCustom ? '#4338CA' : '#0F172A',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditingSchedule(false)}
                  className="btn btn-outline"
                  style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={isSavingSchedule || scheduleSaveSuccess}
                  className="btn btn-primary"
                  style={{
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#4F46E5',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                  }}
                >
                  {isSavingSchedule ? 'Saving...' : scheduleSaveSuccess ? '✓ Schedule Saved!' : 'Save Shift Schedule'}
                </button>
              </div>
            </div>
          )}

          {/* Today's Verification Evidence (if punched) */}
          {todayLog && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: '0 0 12px 0' }}>
                Today's Verification &amp; GPS Snapshot
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Punch In Details */}
                {todayLog.punch_in_at && (
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        Punch In at{' '}
                        {new Date(todayLog.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: todayLog.punch_in_status === 'APPROVED' ? '#DCFCE7' : todayLog.punch_in_status === 'FLAGGED' ? '#FEE2E2' : '#FEF3C7',
                          color: todayLog.punch_in_status === 'APPROVED' ? '#15803D' : todayLog.punch_in_status === 'FLAGGED' ? '#DC2626' : '#B45309',
                        }}
                      >
                        {todayLog.punch_in_status || 'PENDING'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      📍 {formatDistance(todayLog.punch_in_distance_m || 0)} from Jeddah HQ
                    </div>
                    {todayLog.punch_in_reason && (
                      <div style={{ fontSize: '12px', color: '#D97706', marginTop: '3px' }}>
                        Reason: {todayLog.punch_in_reason}
                      </div>
                    )}
                    {todayLog.punch_in_device_info && (
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                        💻 {todayLog.punch_in_device_info.deviceName || todayLog.punch_in_device_info.os} · {todayLog.punch_in_device_info.browser}
                      </div>
                    )}
                    {todayLog.punch_in_ip && (
                      <div style={{ fontSize: '11px', color: '#7C3AED', marginTop: '2px' }}>
                        🌐 IP: {todayLog.punch_in_ip}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {todayLog.punch_in_lat && todayLog.punch_in_lng && (
                        <a
                          href={getGoogleMapsUrl(todayLog.punch_in_lat, todayLog.punch_in_lng)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '11px',
                            color: '#2563EB',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          View Map <ExternalLink size={10} />
                        </a>
                      )}
                      {(todayLog.punch_in_device_info || todayLog.punch_in_ip) && (
                        <button
                          type="button"
                          onClick={() => setAuditModalLog(todayLog)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#4F46E5',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <ShieldCheck size={12} /> Audit Hardware Specs
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Punch Out Details */}
                {todayLog.punch_out_at && (
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        Punch Out at{' '}
                        {new Date(todayLog.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: todayLog.punch_out_status === 'APPROVED' ? '#DCFCE7' : todayLog.punch_out_status === 'FLAGGED' ? '#FEE2E2' : '#FEF3C7',
                          color: todayLog.punch_out_status === 'APPROVED' ? '#15803D' : todayLog.punch_out_status === 'FLAGGED' ? '#DC2626' : '#B45309',
                        }}
                      >
                        {todayLog.punch_out_status || 'PENDING'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      📍 {formatDistance(todayLog.punch_out_distance_m || 0)} from Jeddah HQ
                    </div>
                    {todayLog.punch_out_reason && (
                      <div style={{ fontSize: '12px', color: '#D97706', marginTop: '3px' }}>
                        Reason: {todayLog.punch_out_reason}
                      </div>
                    )}
                    {todayLog.punch_out_device_info && (
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                        💻 {todayLog.punch_out_device_info.deviceName || todayLog.punch_out_device_info.os} · {todayLog.punch_out_device_info.browser}
                      </div>
                    )}
                    {todayLog.punch_out_ip && (
                      <div style={{ fontSize: '11px', color: '#7C3AED', marginTop: '2px' }}>
                        🌐 IP: {todayLog.punch_out_ip}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {todayLog.punch_out_lat && todayLog.punch_out_lng && (
                        <a
                          href={getGoogleMapsUrl(todayLog.punch_out_lat, todayLog.punch_out_lng)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '11px',
                            color: '#2563EB',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          View Map <ExternalLink size={10} />
                        </a>
                      )}
                      {(todayLog.punch_out_device_info || todayLog.punch_out_ip) && (
                        <button
                          type="button"
                          onClick={() => setAuditModalLog(todayLog)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#4F46E5',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <ShieldCheck size={12} /> Audit Hardware Specs
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Monthly Work Hours & Deficit Analysis Card (Issue 3) */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* Header with Month Selector & Quick Navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    Monthly Work Hours &amp; Deficit Analysis
                  </h4>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Historical performance &amp; payroll deduction analysis per employee
                  </div>
                </div>
              </div>

              {/* Month Picker with Prev / Next month buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginRight: '4px' }}>
                  Select Month:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const [y, m] = selectedDetailMonth.split('-').map(Number)
                    const prevD = new Date(y, m - 2, 1)
                    setSelectedDetailMonth(`${prevD.getFullYear()}-${(prevD.getMonth() + 1).toString().padStart(2, '0')}`)
                  }}
                  title="Previous Month"
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                <input
                  type="month"
                  value={selectedDetailMonth}
                  onChange={(e) => setSelectedDetailMonth(e.target.value)}
                  style={{
                    height: '34px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC',
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    const [y, m] = selectedDetailMonth.split('-').map(Number)
                    const nextD = new Date(y, m, 1)
                    setSelectedDetailMonth(`${nextD.getFullYear()}-${(nextD.getMonth() + 1).toString().padStart(2, '0')}`)
                  }}
                  title="Next Month"
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
                marginTop: '14px',
              }}
            >
              {/* Expected Hours */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Expected Hours
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                  {expToDate}h
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  {isExempt ? 'Exempt from target' : `To date (${expHours}h full month)`}
                </div>
              </div>

              {/* Actual Worked */}
              <div style={{ backgroundColor: '#F0FDF4', padding: '12px 14px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>
                  Actual Logged
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
                  {monthActiveHours}h
                </div>
                <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                  {daysWithPunches} active logged shifts
                </div>
              </div>

              {/* Approved Leave */}
              <div style={{ backgroundColor: '#F0F9FF', padding: '12px 14px', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0369A1', textTransform: 'uppercase' }}>
                  Approved Leave
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>
                  {monthLeaveHours}h
                </div>
                <div style={{ fontSize: '11px', color: '#0369A1', marginTop: '2px' }}>
                  {elapsedLeaveDays} paid leave days
                </div>
              </div>

              {/* Deficit to Date */}
              <div
                style={{
                  backgroundColor: monthDeficit > 0 ? '#FFFBEB' : '#F0FDF4',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${monthDeficit > 0 ? '#FCD34D' : '#BBF7D0'}`,
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: monthDeficit > 0 ? '#B45309' : '#166534', textTransform: 'uppercase' }}>
                  Month Deficit
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: monthDeficit > 0 ? '#D97706' : '#15803D', marginTop: '4px' }}>
                  {isExempt ? '0h (Exempt)' : monthDeficit > 0 ? `-${monthDeficit}h` : '0h (Target Met)'}
                </div>
                <div style={{ fontSize: '11px', color: monthDeficit > 0 ? '#B45309' : '#166534', marginTop: '2px' }}>
                  {monthDeficit > 0 ? 'Shortfall hours to date' : 'Shift target satisfied'}
                </div>
              </div>

              {/* Estimated Pay Cut */}
              <div
                style={{
                  backgroundColor: estimatedPayCut > 0 ? '#FEF2F2' : '#F8FAFC',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${estimatedPayCut > 0 ? '#FECACA' : '#E2E8F0'}`,
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: estimatedPayCut > 0 ? '#991B1B' : '#64748B', textTransform: 'uppercase' }}>
                  Estimated Pay Cut
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: estimatedPayCut > 0 ? '#DC2626' : '#15803D', marginTop: '4px' }}>
                  {isExempt ? `0 ${currency}` : estimatedPayCut > 0 ? `-${estimatedPayCut} ${currency}` : `0 ${currency}`}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  {hourlyRate > 0 ? `@ ${hourlyRate} ${currency}/hr rate` : 'Salary rate not set'}
                </div>
              </div>

              {/* Attendance Breakdown */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Shift Adherence
                </div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: adherencePercent >= 90 ? '#16A34A' : '#D97706', marginTop: '4px' }}>
                  {isExempt ? '100%' : `${adherencePercent}%`}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  {daysWithPunches} Present · {daysLate} Late · <span style={{ color: daysAbsent > 0 ? '#DC2626' : '#64748B', fontWeight: daysAbsent > 0 ? 700 : 400 }}>{daysAbsent} Absent</span>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Timesheets Table */}
          <div
            style={{
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Attendance &amp; Login History ({displayedLogs.length} Records)
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                  {historyViewMode === 'SELECTED_MONTH' ? `Showing daily breakdown for ${selectedDetailMonth} (including Absent & Leave days)` : 'Showing logged punches across past 60 days'}
                </span>
              </div>

              {/* Toggle: Selected Month vs Past 60 Days */}
              <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('SELECTED_MONTH')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    border: 'none',
                    backgroundColor: historyViewMode === 'SELECTED_MONTH' ? '#4F46E5' : '#FFFFFF',
                    color: historyViewMode === 'SELECTED_MONTH' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  📅 {selectedDetailMonth} Daily Logs
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('PAST_60_DAYS')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    border: 'none',
                    borderLeft: '1px solid #CBD5E1',
                    backgroundColor: historyViewMode === 'PAST_60_DAYS' ? '#4F46E5' : '#FFFFFF',
                    color: historyViewMode === 'PAST_60_DAYS' ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  🕒 Past 60 Days (Punches Only)
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Login (In)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Logout (Out)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Working Hours</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Location Verification</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', fontWeight: 600 }}>Photo &amp; Regularization Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && displayedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#6366F1' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                          <Loader2 size={18} className="animate-spin" /> Loading attendance timesheets...
                        </div>
                      </td>
                    </tr>
                  ) : displayedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                        No attendance records found for this period.
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map((log: any) => {
                      // 1. RENDER ABSENT DAYS (Issue 2)
                      if (log.isAbsent) {
                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid #FEE2E2', backgroundColor: '#FEF2F2' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#991B1B', verticalAlign: 'top' }}>
                              {log.date}
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 700, color: '#DC2626' }}>
                                🔴 Absent (No punch recorded)
                              </div>
                              <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '2px' }}>
                                Scheduled work shift missed
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#94A3B8', verticalAlign: 'top' }}>
                              -
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 700, color: '#DC2626' }}>
                                0.0 hrs (0m)
                              </div>
                              <div style={{ fontSize: '10.5px', color: '#B91C1C', fontWeight: 600, marginTop: '2px' }}>
                                Deficit: -{log.expected_hours !== undefined ? log.expected_hours : 8}h
                              </div>
                              <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', border: '1px solid #FECACA' }}>
                                🔴 Absent / Not Logged In
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: '#FEE2E2',
                                  color: '#DC2626',
                                  border: '1px solid #FECACA',
                                }}
                              >
                                🔴 No Activity
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'top' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setRegularizeLog({
                                    ...log,
                                    employee_name: employee.name,
                                  })
                                  setRegularizeModalOpen(true)
                                }}
                                style={{
                                  border: '1px solid #FCA5A5',
                                  background: '#FFFFFF',
                                  color: '#DC2626',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Adjust or regularize this missed shift"
                              >
                                <Edit3 size={12} /> Adjust
                              </button>
                            </td>
                          </tr>
                        )
                      }

                      // 2. RENDER APPROVED LEAVES
                      if (log.isLeave) {
                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid #E0F2FE', backgroundColor: '#F0F9FF' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0369A1', verticalAlign: 'top' }}>
                              {log.date}
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 700, color: '#0284C7' }}>
                                🔵 Approved Leave
                              </div>
                              <div style={{ fontSize: '11px', color: '#0369A1', marginTop: '2px' }}>
                                {log.leaveReason || 'Authorized leave credited'}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#94A3B8', verticalAlign: 'top' }}>
                              -
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 700, color: '#0284C7' }}>
                                0.0 hrs
                              </div>
                              <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, backgroundColor: '#E0F2FE', color: '#0369A1', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', border: '1px solid #BAE6FD' }}>
                                🔵 Paid / Approved Leave
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: '#E0F2FE',
                                  color: '#0369A1',
                                  border: '1px solid #BAE6FD',
                                }}
                              >
                                🔵 On Leave
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'top' }}>
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                                Approved Leave
                              </span>
                            </td>
                          </tr>
                        )
                      }

                      // 3. RENDER REAL PUNCH LOGS (WITH INDIVIDUAL AUTO-CLOSE BADGE)
                      const inTime = log.punch_in_at
                        ? new Date(log.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '-'
                      const outTime = log.punch_out_at
                        ? new Date(log.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '-'
                      const hrs = ((log.total_working_minutes || 0) / 60).toFixed(1)
                      const isHq = log.punch_in_status === 'APPROVED'

                      const inDev = log.punch_in_device_info
                      const inIp = log.punch_in_ip || log.punch_in_network_info?.ip
                      const outDev = log.punch_out_device_info
                      const outIp = log.punch_out_ip || log.punch_out_network_info?.ip

                      const hasDiscrepancy = Boolean(
                        log.punch_in_at &&
                        log.punch_out_at &&
                        ((inDev && outDev && (inDev.deviceType !== outDev.deviceType || inDev.os !== outDev.os)) ||
                          (inIp && outIp && inIp !== 'N/A' && outIp !== 'N/A' && inIp !== outIp))
                      )

                      const isRegApproved = Boolean(log.review_notes?.includes('Regularized:'))
                      const isRegRejected = Boolean(log.review_notes?.includes('REJECTED REGULARIZATION')) || Boolean(log.review_notes?.includes('REJECTED'))
                      const isRegPending = Boolean(log.review_notes?.includes('REGULARIZATION REQUEST'))

                      // Extract auto-close label if present (e.g. ⚠️ Auto-Closed (21:30 EOD))
                      const autoCloseLabel = log.review_notes && log.review_notes.includes('Auto-Closed')
                        ? (log.review_notes.match(/⚠️ Auto-Closed \([^)]+\)/)?.[0] || '⚠️ Auto-Closed')
                        : '⚠️ Auto-Closed'

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A', verticalAlign: 'top' }}>{log.date}</td>
                          <td style={{ padding: '10px 14px', color: '#334155', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{inTime}</div>
                            {(inDev || (inIp && inIp !== 'N/A')) ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAuditModalLog(log)
                                }}
                                title="Click to view full hardware telemetry audit"
                                style={{
                                  marginTop: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '10.5px',
                                  color: '#475569',
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  maxWidth: '200px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                <span>{inDev?.deviceType === 'Mobile' ? '📱' : inDev?.deviceType === 'Tablet' ? '📟' : '💻'}</span>
                                <span style={{ fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {inDev?.deviceName || inDev?.os || 'Device'}
                                </span>
                                {inIp && inIp !== 'N/A' && (
                                  <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: '10px' }}>
                                    · {inIp}
                                  </span>
                                )}
                              </div>
                            ) : log.punch_in_at ? (
                              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>No telemetry</div>
                            ) : null}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#334155', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{outTime}</div>
                            {(outDev || (outIp && outIp !== 'N/A')) ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAuditModalLog(log)
                                }}
                                title="Click to view full hardware telemetry audit"
                                style={{
                                  marginTop: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '10.5px',
                                  color: '#475569',
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  maxWidth: '200px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                <span>{outDev?.deviceType === 'Mobile' ? '📱' : outDev?.deviceType === 'Tablet' ? '📟' : '💻'}</span>
                                <span style={{ fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {outDev?.deviceName || outDev?.os || 'Device'}
                                </span>
                                {outIp && outIp !== 'N/A' && (
                                  <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: '10px' }}>
                                    · {outIp}
                                  </span>
                                )}
                              </div>
                            ) : log.punch_out_at ? (
                              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>No telemetry</div>
                            ) : null}
                          </td>
                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, color: '#0284C7' }}>
                              {hrs} hrs ({log.total_working_minutes}m)
                            </div>
                            {hasDiscrepancy && (
                              <div>
                                <span
                                  onClick={() => setAuditModalLog(log)}
                                  title="Discrepancy: Different device or public IP used between Punch In and Punch Out"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    backgroundColor: '#FEF2F2',
                                    color: '#DC2626',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    marginTop: '3px',
                                    cursor: 'pointer',
                                    border: '1px solid #FECACA',
                                  }}
                                >
                                  ⚠️ Diff Device/IP
                                </span>
                              </div>
                            )}
                            {isRegApproved ? (
                              <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: '4px', marginTop: '2px' }}>
                                ✓ Regularized
                              </span>
                            ) : isRegRejected ? (
                              <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, backgroundColor: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: '4px', marginTop: '2px' }}>
                                ✕ Request Declined
                              </span>
                            ) : isRegPending ? (
                              <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, backgroundColor: '#F5F3FF', color: '#6D28D9', padding: '1px 6px', borderRadius: '4px', marginTop: '2px' }}>
                                ⏳ Pending Review
                              </span>
                            ) : (log.is_auto_closed || (!log.punch_out_at && log.date < getLocalDateString())) ? (
                              <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', border: '1px solid #FDE68A' }}>
                                {autoCloseLabel}
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: isHq ? '#DCFCE7' : '#FEF08A',
                                color: isHq ? '#15803D' : '#854D0E',
                              }}
                            >
                              {isHq ? '🟢 Jeddah HQ' : `🟡 Remote (${formatDistance(log.punch_in_distance_m || 0)})`}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', verticalAlign: 'top' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => setAuditModalLog(log)}
                                style={{
                                  border: '1px solid #C7D2FE',
                                  background: '#EEF2FF',
                                  color: '#4338CA',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Inspect device hardware specs, CPU, RAM, OS, IP, and browser telemetry"
                              >
                                <ShieldCheck size={12} /> Audit Specs
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRegularizeLog(log)
                                  setRegularizeModalOpen(true)
                                }}
                                style={{
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  color: '#334155',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                                title="Adjust or regularize punch times"
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
          </div>

          {/* Employee Leave Applications & History Section */}
          <div
            style={{
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Employee Leave Applications ({leaveRequests.length} Filed)
              </h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Annual, Sick &amp; Emergency Time Off</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Dates &amp; Duration</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Reason</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', fontWeight: 600 }}>Submitted On</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                        No leave applications submitted by this employee.
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 14px' }}>
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
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A' }}>
                          {req.start_date} to {req.end_date} ({req.total_days} days)
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          {req.reason || '-'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
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
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', fontSize: 12 }}>
                          {new Date(req.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Footer */}
      <div
        onWheel={handleNonScrollableWheel}
        style={{
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          className="btn btn-primary"
          style={{
            padding: '8px 20px',
            fontWeight: 600,
          }}
        >
          Done
        </button>
      </div>
    </div>

      {/* Regularize Attendance Modal */}
      <RegularizeAttendanceModal
        isOpen={regularizeModalOpen}
        onClose={() => {
          setRegularizeModalOpen(false)
          setRegularizeLog(null)
        }}
        log={regularizeLog}
        employeeName={employee.name}
        adminId={adminId}
        onSuccess={() => {
          if (employee) {
            loadEmployeeData(employee.profile_id)
          }
        }}
      />

      {/* Delete Record In-App Modal */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        variant="danger"
        title="Delete Shift / Attendance Log"
        message={
          deleteConfirmModal.record ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
                Are you sure you want to permanently delete the attendance record for{' '}
                <strong style={{ color: '#0F172A', fontWeight: 700 }}>{employee.name}</strong> on{' '}
                <strong style={{ color: '#0F172A', fontWeight: 700 }}>{deleteConfirmModal.record.date}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                ⚠️ This will permanently remove this shift from monthly hours calculations, deficit audits, and timesheets.
              </p>
            </div>
          ) : (
            'Are you sure you want to permanently delete this record?'
          )
        }
        confirmLabel="Yes, Delete Permanently"
        cancelLabel="Cancel"
        loading={isDeletingRecord}
        onConfirm={handleConfirmDeleteLog}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, record: null })}
      />

      {/* Device & Hardware Telemetry Audit Modal */}
      <DeviceAuditModal
        isOpen={Boolean(auditModalLog)}
        onClose={() => setAuditModalLog(null)}
        log={auditModalLog}
        employeeName={employee.name}
      />
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
