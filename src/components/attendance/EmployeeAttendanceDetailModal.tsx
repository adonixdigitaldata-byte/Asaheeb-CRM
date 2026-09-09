'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  User,
  Clock,
  Calendar,
  MapPin,
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ChevronRight,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Maximize2,
} from 'lucide-react'
import { AttendanceLog, LeaveBalance, LeaveRequest, RosterEmployee } from '@/types/attendance'
import { fetchUserAttendanceHistory, fetchLeaveBalances, fetchUserLeaveRequests } from '@/lib/attendanceService'
import { formatDistance, getGoogleMapsUrl } from '@/lib/geoUtils'
import { getEmployeeFaceEnrollment, resetEmployeeFaceEnrollment } from '@/lib/biometricEngine'

interface EmployeeAttendanceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  employee: RosterEmployee | null
  adminId: string
}

export default function EmployeeAttendanceDetailModal({
  isOpen,
  onClose,
  employee,
  adminId,
}: EmployeeAttendanceDetailModalProps) {
  const [history, setHistory] = useState<AttendanceLog[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSelfie, setSelectedSelfie] = useState<{ url: string; title: string } | null>(null)
  const [enrolledInfo, setEnrolledInfo] = useState<{ hasEnrolled: boolean; enrolledAt: string | null }>({ hasEnrolled: false, enrolledAt: null })
  const [isResettingFace, setIsResettingFace] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && employee) {
      loadEmployeeData(employee.profile_id)
    }
  }, [isOpen, employee])

  async function loadEmployeeData(id: string) {
    setLoading(true)
    try {
      const [hist, bal, reqs] = await Promise.all([
        fetchUserAttendanceHistory(id),
        fetchLeaveBalances(id),
        fetchUserLeaveRequests(id),
      ])
      setHistory(hist)
      setLeaveBalances(bal)
      setLeaveRequests(reqs)

      getEmployeeFaceEnrollment(id).then((res) => {
        setEnrolledInfo({
          hasEnrolled: Boolean(res.descriptor && res.descriptor.length === 128),
          enrolledAt: res.enrolled_at,
        })
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetFaceId() {
    if (!employee) return
    const confirmed = window.confirm(
      `Are you sure you want to reset the Biometric Face ID for ${employee.name}?\n\nThey will be prompted to re-enroll a new face on their next attendance punch.`
    )
    if (!confirmed) return

    setIsResettingFace(true)
    await resetEmployeeFaceEnrollment(employee.profile_id)
    setEnrolledInfo({ hasEnrolled: false, enrolledAt: null })
    setIsResettingFace(false)
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

  // Listen for Escape key to close selfie lightbox
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedSelfie(null)
      }
    }
    if (selectedSelfie) {
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedSelfie])

  if (!isOpen || !employee) return null

  const todayLog = employee.today_log
  const remainingAnnual = leaveBalances
    ? Math.max(0, leaveBalances.annual_leave_total - leaveBalances.annual_leave_used)
    : 21

  // Current month active metrics
  const currentMonthKey = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const currentMonthLogs = history.filter((h) => h.date && h.date.startsWith(currentMonthKey))
  const monthActiveMinutes = currentMonthLogs.reduce((acc, h) => acc + (h.total_working_minutes || 0), 0)
  const monthActiveHours = (monthActiveMinutes / 60).toFixed(1)

  function handleExportEmployeeCsv() {
    const rows = [
      ['Date', 'Employee', 'Punch In', 'Punch In Status', 'Punch Out', 'Punch Out Status', 'Duration Minutes', 'Working Hours'],
      ...history.map((l) => [
        l.date,
        employee?.name || '',
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
          maxWidth: '840px',
          width: '100%',
          maxHeight: '90vh',
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
                {currentMonthLogs.length} active work shifts logged
              </div>
            </div>

            {/* Leave Balance */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                Annual Paid Leave Balance
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>
                {remainingAnnual} / {leaveBalances?.annual_leave_total || 21} Days
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                {leaveBalances?.sick_leave_total ? leaveBalances.sick_leave_total - leaveBalances.sick_leave_used : 30} Sick
                days remaining
              </div>
            </div>

            {/* Biometric Face ID Status & Reset */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: enrolledInfo.hasEnrolled ? '#F0FDF4' : '#FFFBEB',
                border: `1px solid ${enrolledInfo.hasEnrolled ? '#BBF7D0' : '#FDE68A'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: enrolledInfo.hasEnrolled ? '#166534' : '#92400E', textTransform: 'uppercase' }}>
                    Biometric Face ID
                  </span>
                  <ShieldCheck size={16} style={{ color: enrolledInfo.hasEnrolled ? '#16A34A' : '#D97706' }} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: enrolledInfo.hasEnrolled ? '#15803D' : '#B45309', marginTop: '4px' }}>
                  {enrolledInfo.hasEnrolled ? '🟢 Registered' : '🟡 Pending Setup'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  {enrolledInfo.hasEnrolled && enrolledInfo.enrolledAt
                    ? `Enrolled ${new Date(enrolledInfo.enrolledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Auto-enrolls on employee first punch'}
                </div>
              </div>

              {enrolledInfo.hasEnrolled && (
                <button
                  type="button"
                  onClick={handleResetFaceId}
                  disabled={isResettingFace}
                  className="btn btn-outline btn-sm"
                  style={{
                    marginTop: '10px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#DC2626',
                    borderColor: '#FECACA',
                    backgroundColor: '#FFFFFF',
                    alignSelf: 'flex-start',
                  }}
                  title="Reset Face ID so employee can register again"
                >
                  {isResettingFace ? 'Resetting...' : 'Reset Face ID'}
                </button>
              )}
            </div>
          </div>

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
                Today's Verification & GPS Snapshot
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Punch In Proof */}
                {todayLog.punch_in_at && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {todayLog.punch_in_selfie_url ? (
                      <div
                        onClick={() =>
                          setSelectedSelfie({
                            url: todayLog.punch_in_selfie_url!,
                            title: `${employee.name} • Punch In Snapshot (${todayLog.date})`,
                          })
                        }
                        style={{
                          position: 'relative',
                          width: '64px',
                          height: '64px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '2px solid #CBD5E1',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                        }}
                        title="Click to view enlarged snapshot"
                      >
                        <img
                          src={todayLog.punch_in_selfie_url}
                          alt="Punch in selfie"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(15, 23, 42, 0.75)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px 0',
                            color: '#FFFFFF',
                            fontSize: '9px',
                            fontWeight: 700,
                          }}
                        >
                          <Maximize2 size={9} style={{ marginRight: 2 }} /> Zoom
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '10px',
                          background: '#F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94A3B8',
                          flexShrink: 0,
                        }}
                      >
                        <Camera size={24} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                        Punch In at{' '}
                        {new Date(todayLog.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        📍 {formatDistance(todayLog.punch_in_distance_m || 0)} from Jeddah HQ
                      </div>
                      {todayLog.punch_in_reason && (
                        <div style={{ fontSize: '12px', color: '#D97706', marginTop: '2px' }}>
                          Reason: {todayLog.punch_in_reason}
                        </div>
                      )}
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
                            marginTop: '2px',
                          }}
                        >
                          View Map <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Punch Out Proof */}
                {todayLog.punch_out_at && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {todayLog.punch_out_selfie_url ? (
                      <div
                        onClick={() =>
                          setSelectedSelfie({
                            url: todayLog.punch_out_selfie_url!,
                            title: `${employee.name} • Punch Out Snapshot (${todayLog.date})`,
                          })
                        }
                        style={{
                          position: 'relative',
                          width: '64px',
                          height: '64px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '2px solid #CBD5E1',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                        }}
                        title="Click to view enlarged snapshot"
                      >
                        <img
                          src={todayLog.punch_out_selfie_url}
                          alt="Punch out selfie"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(15, 23, 42, 0.75)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px 0',
                            color: '#FFFFFF',
                            fontSize: '9px',
                            fontWeight: 700,
                          }}
                        >
                          <Maximize2 size={9} style={{ marginRight: 2 }} /> Zoom
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '10px',
                          background: '#F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94A3B8',
                          flexShrink: 0,
                        }}
                      >
                        <Camera size={24} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                        Punch Out at{' '}
                        {new Date(todayLog.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        📍 {formatDistance(todayLog.punch_out_distance_m || 0)} from Jeddah HQ
                      </div>
                      {todayLog.punch_out_reason && (
                        <div style={{ fontSize: '12px', color: '#D97706', marginTop: '2px' }}>
                          Reason: {todayLog.punch_out_reason}
                        </div>
                      )}
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
                            marginTop: '2px',
                          }}
                        >
                          View Map <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Attendance &amp; Login History ({history.length} Records)
              </h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Past 60 days</span>
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
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', fontWeight: 600 }}>Photo Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                        No historical attendance records logged yet for this employee.
                      </td>
                    </tr>
                  ) : (
                    history.map((log) => {
                      const inTime = log.punch_in_at
                        ? new Date(log.punch_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '-'
                      const outTime = log.punch_out_at
                        ? new Date(log.punch_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '-'
                      const hrs = (log.total_working_minutes / 60).toFixed(1)
                      const isHq = log.punch_in_status === 'APPROVED'

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A' }}>{log.date}</td>
                          <td style={{ padding: '10px 14px', color: '#334155' }}>{inTime}</td>
                          <td style={{ padding: '10px 14px', color: '#334155' }}>{outTime}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0284C7' }}>
                            {hrs} hrs ({log.total_working_minutes}m)
                          </td>
                          <td style={{ padding: '10px 14px' }}>
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
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                              {log.punch_in_selfie_url && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSelfie({
                                      url: log.punch_in_selfie_url!,
                                      title: `${employee.name} • Punch In (${log.date} ${inTime})`,
                                    })
                                  }
                                  style={{
                                    border: '1px solid #BFDBFE',
                                    background: '#EFF6FF',
                                    color: '#2563EB',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                  title="View Punch In selfie snapshot"
                                >
                                  <Camera size={12} /> In Selfie
                                </button>
                              )}
                              {log.punch_out_selfie_url && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSelfie({
                                      url: log.punch_out_selfie_url!,
                                      title: `${employee.name} • Punch Out (${log.date} ${outTime})`,
                                    })
                                  }
                                  style={{
                                    border: '1px solid #FDE68A',
                                    background: '#FFFBEB',
                                    color: '#D97706',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                  title="View Punch Out selfie snapshot"
                                >
                                  <Camera size={12} /> Out Selfie
                                </button>
                              )}
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

      {/* Selfie Preview Lightbox Modal Mounted via Portal to document.body */}
      {selectedSelfie && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backdropFilter: 'blur(10px)',
          }}
          onClick={() => setSelectedSelfie(null)}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid #E2E8F0',
              position: 'relative',
              animation: 'fadeIn 150ms ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {selectedSelfie.title}
                </h4>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Biometric Facial Snapshot Verification
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSelfie(null)}
                style={{
                  border: 'none',
                  background: '#E2E8F0',
                  padding: '6px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                width: '100%',
                maxHeight: '440px',
                backgroundColor: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
              }}
            >
              <img
                src={selectedSelfie.url}
                alt="Verification selfie proof"
                style={{
                  maxWidth: '100%',
                  maxHeight: '420px',
                  borderRadius: '8px',
                  objectFit: 'contain',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              />
            </div>

            <div
              style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#15803D',
                  backgroundColor: '#DCFCE7',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={14} /> GPS &amp; Facial Identity Logged
              </span>

              <a
                href={selectedSelfie.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '12px',
                  color: '#2563EB',
                  textDecoration: 'none',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Full Resolution <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
