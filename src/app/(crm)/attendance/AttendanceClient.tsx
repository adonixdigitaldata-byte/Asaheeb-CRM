'use client'

import React, { useState, useEffect } from 'react'
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
} from '@/lib/attendanceService'
import { formatDistance } from '@/lib/geoUtils'
import PunchModal from '@/components/attendance/PunchModal'
import OfficeSettingsModal from '@/components/attendance/OfficeSettingsModal'
import LeaveRequestModal from '@/components/attendance/LeaveRequestModal'
import ExceptionReviewModal from '@/components/attendance/ExceptionReviewModal'
import EmployeeAttendanceDetailModal from '@/components/attendance/EmployeeAttendanceDetailModal'
import WorkPolicyModal from '@/components/attendance/WorkPolicyModal'
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
  type TabType = 'ROSTER' | 'EXCEPTIONS' | 'LEAVES' | 'HOURS_AUDIT' | 'MY_LOGS'
  const [activeTab, setActiveTab] = useState<TabType>(canManage ? 'ROSTER' : 'MY_LOGS')

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
  const [auditLoading, setAuditLoading] = useState(false)

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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'HQ' | 'REMOTE' | 'LEAVE' | 'ABSENT'>('ALL')

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

  async function loadInitialData() {
    try {
      const loc = await fetchOfficeLocation()
      setOffice(loc)

      const pol = await fetchCompanyWorkPolicy()
      setWorkPolicy(pol)

      const tLog = await fetchTodayAttendance(userId)
      setTodayLog(tLog)

      const hist = await fetchUserAttendanceHistory(userId)
      setMyHistory(hist)

      const bal = await fetchLeaveBalances(userId)
      setLeaveBalances(bal)

      const userReqs = await fetchUserLeaveRequests(userId)
      setMyLeaveRequests(userReqs)

      if (canManage) {
        const todayStr = new Date().toISOString().split('T')[0]
        const roster = await fetchAdminDailyRoster(todayStr)
        setAdminRoster(roster)

        const ex = await fetchPendingExceptions()
        setPendingExceptions(ex)

        const allLeaves = await fetchAllLeaveRequests()
        setAllLeaveRequests(allLeaves)

        loadMonthlyAudit(selectedAuditMonth)
      }
    } catch (e) {
      console.error('Error loading attendance data:', e)
    }
  }

  async function loadMonthlyAudit(monthStr: string) {
    setAuditLoading(true)
    try {
      const res = await fetchMonthlyWorkHoursAudit(monthStr)
      setMonthlyAuditList(res.auditList)
      setAuditExpectedDays(res.expectedWorkingDays)
      setAuditExpectedHours(res.expectedHoursPerEmployee)
    } catch (e) {
      console.error(e)
    } finally {
      setAuditLoading(false)
    }
  }

  function handleOpenPunch() {
    if (!todayLog?.punch_in_at) {
      setPunchType('IN')
    } else if (!todayLog?.punch_out_at) {
      setPunchType('OUT')
    } else {
      setPunchType('IN')
    }
    setPunchModalOpen(true)
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

  const filteredRoster = adminRoster.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (rosterFilter === 'HQ') return r.live_status === 'PRESENT_HQ'
    if (rosterFilter === 'REMOTE') return r.live_status === 'PRESENT_REMOTE'
    if (rosterFilter === 'LEAVE') return r.live_status === 'ON_LEAVE'
    if (rosterFilter === 'ABSENT') return r.live_status === 'NOT_PUNCHED'
    return true
  })

  // Cumulative Audit Totals
  const totalActualCompanyHours = Math.round(monthlyAuditList.reduce((acc, c) => acc + c.actual_worked_hours, 0) * 10) / 10
  const totalCompanyNonWorkingHours = Math.round(monthlyAuditList.reduce((acc, c) => acc + c.non_working_hours, 0) * 10) / 10
  const totalCompanyLeaveHours = Math.round(monthlyAuditList.reduce((acc, c) => acc + c.approved_leave_hours, 0) * 10) / 10
  const averageCompanyAdherence = monthlyAuditList.length > 0
    ? Math.round(monthlyAuditList.reduce((acc, c) => acc + c.attendance_adherence_percent, 0) / monthlyAuditList.length)
    : 100

  const remainingAnnualLeave = Math.max(
    0,
    leaveBalances.annual_leave_total - leaveBalances.annual_leave_used
  )

  const isPunchedIn = Boolean(todayLog?.punch_in_at && !todayLog?.punch_out_at)
  const isPunchedOut = Boolean(todayLog?.punch_in_at && todayLog?.punch_out_at)

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
            Biometric attendance verification, active vs non-working hours tracking, and annual leave management.
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
          <div
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
                    backgroundColor: isPunchedIn
                      ? 'rgba(34, 197, 94, 0.2)'
                      : isPunchedOut
                      ? 'rgba(148, 163, 184, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                    color: isPunchedIn ? '#4ADE80' : isPunchedOut ? '#CBD5E1' : '#F87171',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: isPunchedIn ? '#22C55E' : isPunchedOut ? '#94A3B8' : '#EF4444',
                    }}
                  />
                  {isPunchedIn
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
                {activeWorkDuration}
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>
                {todayLog?.punch_in_at
                  ? `Punched in at ${new Date(todayLog.punch_in_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Ready to punch in with GPS and facial verification'}
              </div>
            </div>

            {/* Tactile Punch Action CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleOpenPunch}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  backgroundColor: isPunchedIn ? '#DC2626' : '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: isPunchedIn
                    ? '0 4px 16px rgba(220, 38, 38, 0.4)'
                    : '0 4px 16px rgba(22, 163, 74, 0.4)',
                  transition: 'transform 0.1s ease',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <ShieldCheck size={22} />
                {isPunchedIn ? 'Punch Out & Confirm' : 'Punch In (GPS + Face)'}
              </button>
              <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                Verified against {office.name} ({office.radius_meters}m geofence perimeter)
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
        {/* 4. TABS NAVIGATION TOOLBAR */}
        {/* ======================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('ROSTER')}
                  className={activeTab === 'ROSTER' ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
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
                    backgroundColor: activeTab === 'EXCEPTIONS' ? '#D97706' : '#FFFFFF',
                    borderColor: activeTab === 'EXCEPTIONS' ? '#D97706' : 'var(--border)',
                    color: activeTab === 'EXCEPTIONS' ? '#FFFFFF' : 'var(--text-primary)',
                  }}
                >
                  <AlertTriangle size={15} /> Remote Exceptions
                  {pendingExceptions.length > 0 && (
                    <span
                      style={{
                        backgroundColor: '#DC2626',
                        color: '#FFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '999px',
                      }}
                    >
                      {pendingExceptions.length}
                    </span>
                  )}
                </button>

                {/* NEW 5TH TAB: MONTHLY HOURS & DEFICIT AUDIT */}
                <button
                  type="button"
                  onClick={() => setActiveTab('HOURS_AUDIT')}
                  className={activeTab === 'HOURS_AUDIT' ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
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
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Clock size={15} /> My Attendance &amp; Timesheet
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <div className="table-responsive-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
                <table className="table" style={{ width: '100%', minWidth: '850px', tableLayout: 'fixed', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '28%', padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Employee
                      </th>
                      <th style={{ width: '14%', padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Role
                      </th>
                      <th style={{ width: '14%', padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Login Time (In)
                      </th>
                      <th style={{ width: '14%', padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Logout Time (Out)
                      </th>
                      <th style={{ width: '12%', padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Working Hours
                      </th>
                      <th style={{ width: '18%', padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>
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
                      filteredRoster.map((emp) => {
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
                          NOT_PUNCHED: { bg: '#F1F5F9', text: '#475569', label: '⚪ Not Punched' },
                        }[emp.live_status]

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
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
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
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: 2 }}>
                  {auditExpectedDays} Working Days ({workPolicy.work_days.length} days/week)
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
                  <TrendingDown size={14} /> Cumulative Non-Working Hours
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                  {totalCompanyNonWorkingHours}h
                </div>
                <div style={{ fontSize: '11px', color: '#B45309', marginTop: 2 }}>
                  Total shortfall / deficit hours across company
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
                <table className="table" style={{ width: '100%', minWidth: '950px', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '22%', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Staff Member
                      </th>
                      <th style={{ width: '12%', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Expected Hours
                      </th>
                      <th style={{ width: '12%', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Actual Worked
                      </th>
                      <th style={{ width: '12%', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Approved Leave
                      </th>
                      <th style={{ width: '16%', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Non-Working (Deficit)
                      </th>
                      <th style={{ width: '10%', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Late Days
                      </th>
                      <th style={{ width: '16%', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        Compliance / Adherence
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAuditList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          No attendance records found for the selected month ({selectedAuditMonth}).
                        </td>
                      </tr>
                    ) : (
                      monthlyAuditList.map((aud) => {
                        const hasDeficit = aud.non_working_hours > 0
                        return (
                          <tr key={aud.employee_id}>
                            {/* Employee */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{aud.employee_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {aud.employee_role} • {aud.employee_email}
                              </div>
                            </td>

                            {/* Expected */}
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {aud.expected_total_hours}h
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
                              {hasDeficit ? (
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
                                  <TrendingDown size={12} /> -{aud.non_working_hours}h Deficit
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

                            {/* Late Days */}
                            <td style={{ padding: '12px 14px', color: aud.days_late > 0 ? '#DC2626' : 'var(--text-tertiary)', fontWeight: aud.days_late > 0 ? 600 : 400 }}>
                              {aud.days_late > 0 ? `${aud.days_late} Days Late` : 'None'}
                            </td>

                            {/* Adherence Rate */}
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                <span style={{ fontWeight: 700, color: aud.attendance_adherence_percent >= 90 ? '#16A34A' : '#D97706' }}>
                                  {aud.attendance_adherence_percent}%
                                </span>
                                <div style={{ width: 80, height: 4, backgroundColor: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${aud.attendance_adherence_percent}%`,
                                      height: '100%',
                                      backgroundColor: aud.attendance_adherence_percent >= 90 ? '#16A34A' : '#D97706',
                                    }}
                                  />
                                </div>
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

        {/* ======================================================= */}
        {/* TAB 3: EXCEPTIONS REVIEW QUEUE */}
        {/* ======================================================= */}
        {activeTab === 'EXCEPTIONS' && canManage && (
          <div>
            {pendingExceptions.length === 0 ? (
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
                  All Clear! No Pending Exceptions
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  All punches recorded outside Jeddah HQ have been reviewed and approved.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {pendingExceptions.map((item) => {
                  const isPunchInPending = item.punch_in_status === 'PENDING_REVIEW'
                  const punchKind = isPunchInPending ? 'IN' : 'OUT'
                  const reason = isPunchInPending ? item.punch_in_reason : item.punch_out_reason
                  const explanation = isPunchInPending ? item.punch_in_explanation : item.punch_out_explanation
                  const distance = isPunchInPending ? item.punch_in_distance_m : item.punch_out_distance_m
                  const selfieUrl = isPunchInPending ? item.punch_in_selfie_url : item.punch_out_selfie_url

                  return (
                    <div
                      key={item.id}
                      className="card"
                      style={{
                        padding: '16px 20px',
                        borderLeft: '4px solid #D97706',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        {selfieUrl && (
                          <img
                            src={selfieUrl}
                            alt="Selfie proof"
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 10,
                              objectFit: 'cover',
                              border: '2px solid #FCD34D',
                            }}
                          />
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.employee_name || 'Staff Member'}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                backgroundColor: '#FEF3C7',
                                color: '#B45309',
                              }}
                            >
                              Remote Punch {punchKind}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                            📍 <strong>{formatDistance(distance || 0)}</strong> from Jeddah HQ • Reason:{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>{reason || 'Field Work'}</strong>
                          </div>
                          {explanation && (
                            <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 3 }}>
                              &ldquo;{explanation}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedException(item)
                          setSelectedExceptionType(punchKind)
                          setExceptionModalOpen(true)
                        }}
                        className="btn btn-primary"
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: '#D97706',
                          borderColor: '#D97706',
                        }}
                      >
                        Inspect Punch Proof <ChevronRight size={14} />
                      </button>
                    </div>
                  )
                })}
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
                      allLeaveRequests.map((req) => (
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
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* TAB 5: MY ATTENDANCE & HISTORY */}
        {/* ======================================================= */}
        {activeTab === 'MY_LOGS' && (
          <div>
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
                    Past 60 days login history and work hours
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

              <div className="table-responsive-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
                <table className="table" style={{ width: '100%', minWidth: '700px', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Date
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Punch In (Login)
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Punch Out (Logout)
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                        Total Duration
                      </th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>
                        Verification Location
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {myHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          No punches logged yet. Clock in today using the green button above!
                        </td>
                      </tr>
                    ) : (
                      myHistory.map((item) => {
                        const inTime = item.punch_in_at
                          ? new Date(item.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '--:--'
                        const outTime = item.punch_out_at
                          ? new Date(item.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '--:--'
                        const hrs = (item.total_working_minutes / 60).toFixed(1)
                        const isHq = item.punch_in_status === 'APPROVED'

                        return (
                          <tr key={item.id}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.date}
                            </td>
                            <td style={{ padding: '12px 14px', color: inTime !== '--:--' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: inTime !== '--:--' ? 600 : 400 }}>
                              {inTime}
                            </td>
                            <td style={{ padding: '12px 14px', color: outTime !== '--:--' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: outTime !== '--:--' ? 600 : 400 }}>
                              {outTime}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284C7' }}>
                              {hrs} hrs ({item.total_working_minutes}m)
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
    </div>
  )
}
