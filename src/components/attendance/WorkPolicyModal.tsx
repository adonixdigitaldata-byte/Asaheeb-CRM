'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Clock,
  Calendar,
  ShieldCheck,
  Check,
  Loader2,
  Sliders,
  Briefcase,
  Plus,
  Trash2,
  Rocket,
  Zap,
  RotateCcw,
} from 'lucide-react'
import { CompanyWorkPolicy, CompanyHoliday } from '@/types/attendance'
import { saveCompanyWorkPolicy, fetchOfficialHolidays, DEFAULT_OFFICIAL_HOLIDAYS } from '@/lib/attendanceService'

interface WorkPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  currentPolicy: CompanyWorkPolicy
  onUpdated: (newPolicy: CompanyWorkPolicy) => void
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

export default function WorkPolicyModal({
  isOpen,
  onClose,
  currentPolicy,
  onUpdated,
}: WorkPolicyModalProps) {
  const [workDays, setWorkDays] = useState<string[]>(
    currentPolicy.work_days || ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']
  )
  const [dailyHours, setDailyHours] = useState<number>(currentPolicy.daily_expected_hours || 8.0)
  const [shiftStart, setShiftStart] = useState<string>(currentPolicy.shift_start_time?.slice(0, 5) || '09:00')
  const [shiftEnd, setShiftEnd] = useState<string>(currentPolicy.shift_end_time?.slice(0, 5) || '17:00')
  const [graceMins, setGraceMins] = useState<number>(currentPolicy.grace_period_mins ?? 15)
  const [annualQuota, setAnnualQuota] = useState<number>(currentPolicy.default_annual_leave_quota || 21)
  const [sickQuota, setSickQuota] = useState<number>(currentPolicy.default_sick_leave_quota || 30)
  const [trackingStartDate, setTrackingStartDate] = useState<string>(
    currentPolicy.tracking_start_date || ''
  )

  // Custom per-day hours & shift timings
  const [customDayHours, setCustomDayHours] = useState<Record<string, number>>({})
  const [customDaySchedules, setCustomDaySchedules] = useState<Record<string, { startTime: string; endTime: string; hours: number }>>({})
  const [enableCustomHours, setEnableCustomHours] = useState<boolean>(false)

  // Official Company Holidays
  const [officialHolidays, setOfficialHolidays] = useState<CompanyHoliday[]>(
    currentPolicy.official_holidays || DEFAULT_OFFICIAL_HOLIDAYS
  )
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayDate, setNewHolidayDate] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Synchronize state whenever modal is opened or currentPolicy changes
  useEffect(() => {
    if (isOpen) {
      setWorkDays(currentPolicy.work_days || ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'SATURDAY'])
      setDailyHours(currentPolicy.daily_expected_hours || 8.0)
      setShiftStart(currentPolicy.shift_start_time?.slice(0, 5) || '09:00')
      setShiftEnd(currentPolicy.shift_end_time?.slice(0, 5) || '17:00')
      setGraceMins(currentPolicy.grace_period_mins ?? 15)
      setAnnualQuota(currentPolicy.default_annual_leave_quota || 21)
      setSickQuota(currentPolicy.default_sick_leave_quota || 30)
      setTrackingStartDate(currentPolicy.tracking_start_date || '')

      // Clean custom day hours (filter out internal properties)
      const cleanCustomHours: Record<string, number> = {}
      if (currentPolicy.custom_day_hours) {
        Object.entries(currentPolicy.custom_day_hours).forEach(([k, v]) => {
          if (!k.startsWith('_') && typeof v === 'number') {
            cleanCustomHours[k] = v
          }
        })
      }
      setCustomDayHours(cleanCustomHours)

      const schedules = currentPolicy.custom_day_schedules || {}
      setCustomDaySchedules(schedules)
      setEnableCustomHours(
        Object.keys(cleanCustomHours).length > 0 || Object.keys(schedules).length > 0
      )

      if (currentPolicy.official_holidays && currentPolicy.official_holidays.length > 0) {
        setOfficialHolidays(currentPolicy.official_holidays)
      } else {
        setOfficialHolidays(DEFAULT_OFFICIAL_HOLIDAYS)
      }

      // Fetch live holidays directly from database
      fetchOfficialHolidays()
        .then((dbHols) => {
          if (dbHols && dbHols.length > 0) {
            setOfficialHolidays(dbHols)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, currentPolicy])

  if (!isOpen) return null

  function handleAddHoliday() {
    if (!newHolidayName.trim() || !newHolidayDate) return
    const newHol: CompanyHoliday = {
      id: `hol-${Date.now()}`,
      name: newHolidayName.trim(),
      date: newHolidayDate,
    }
    setOfficialHolidays((prev) => [...prev, newHol].sort((a, b) => a.date.localeCompare(b.date)))
    setNewHolidayName('')
    setNewHolidayDate('')
  }

  function handleDeleteHoliday(id: string) {
    setOfficialHolidays((prev) => prev.filter((h) => h.id !== id))
  }

  function toggleDay(dayKey: string) {
    if (workDays.includes(dayKey)) {
      if (workDays.length <= 1) return // keep at least 1 day
      setWorkDays(workDays.filter((d) => d !== dayKey))
    } else {
      setWorkDays([...workDays, dayKey])
    }
  }

  // Calculate hours difference between start and end time
  function computeHours(start: string, end: string): number {
    if (!start || !end) return 8.0
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let diffMinutes = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))
    if (diffMinutes < 0) diffMinutes += 24 * 60
    return Math.round((diffMinutes / 60) * 10) / 10
  }

  function handleDayTimingChange(dayKey: string, field: 'start' | 'end', value: string) {
    const existing = customDaySchedules[dayKey] || {
      startTime: shiftStart,
      endTime: shiftEnd,
      hours: customDayHours[dayKey] ?? dailyHours,
    }

    const newStart = field === 'start' ? value : existing.startTime
    const newEnd = field === 'end' ? value : existing.endTime
    const autoHours = computeHours(newStart, newEnd)

    setCustomDaySchedules((prev) => ({
      ...prev,
      [dayKey]: {
        startTime: newStart,
        endTime: newEnd,
        hours: autoHours,
      },
    }))

    setCustomDayHours((prev) => ({
      ...prev,
      [dayKey]: autoHours,
    }))
  }

  function handleDayHoursChange(dayKey: string, hoursVal: number) {
    const existing = customDaySchedules[dayKey] || {
      startTime: shiftStart,
      endTime: shiftEnd,
      hours: hoursVal,
    }

    setCustomDayHours((prev) => ({
      ...prev,
      [dayKey]: hoursVal,
    }))

    setCustomDaySchedules((prev) => ({
      ...prev,
      [dayKey]: {
        ...existing,
        hours: hoursVal,
      },
    }))
  }

  function resetDayToStandard(dayKey: string) {
    setCustomDayHours((prev) => {
      const next = { ...prev }
      delete next[dayKey]
      return next
    })
    setCustomDaySchedules((prev) => {
      const next = { ...prev }
      delete next[dayKey]
      return next
    })
  }

  function handleMainPolicyTimingChange(field: 'start' | 'end', val: string) {
    const newStart = field === 'start' ? val : shiftStart
    const newEnd = field === 'end' ? val : shiftEnd
    const autoHours = computeHours(newStart, newEnd)
    if (field === 'start') setShiftStart(val)
    if (field === 'end') setShiftEnd(val)
    setDailyHours(autoHours)
  }

  // Calculate live weekly total expected hours
  const totalWeeklyHours = workDays.reduce((sum, d) => {
    const h =
      enableCustomHours && customDayHours[d] !== undefined && customDayHours[d] !== null
        ? Number(customDayHours[d])
        : Number(dailyHours || 8)
    return sum + h
  }, 0)

  async function handleSave() {
    setIsSaving(true)
    try {
      const customPayload = enableCustomHours ? customDayHours : {}
      const customSchedulesPayload = enableCustomHours ? customDaySchedules : {}
      const updated = await saveCompanyWorkPolicy({
        work_days: workDays,
        daily_expected_hours: Number(dailyHours),
        shift_start_time: `${shiftStart}:00`,
        shift_end_time: `${shiftEnd}:00`,
        grace_period_mins: Number(graceMins),
        default_annual_leave_quota: Number(annualQuota),
        default_sick_leave_quota: Number(sickQuota),
        custom_day_hours: customPayload,
        custom_day_schedules: customSchedulesPayload,
        official_holidays: officialHolidays,
        exempt_employee_ids: currentPolicy.exempt_employee_ids || [],
        tracking_start_date: trackingStartDate.trim() || null,
      })
      onUpdated(updated)
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onClose()
      }, 1200)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  function getTomorrowDateStr() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  function getTodayDateStr() {
    return new Date().toISOString().split('T')[0]
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Briefcase size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Work Schedule &amp; Hours Policy
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Configure official working days, shift hours, grace period, and leave quotas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: '#E2E8F0',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Tracking Launch / Go-Live Date Card */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#F0FDF4',
              borderRadius: '12px',
              border: '1px solid #BBF7D0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Rocket size={18} style={{ color: '#16A34A' }} />
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#14532D', margin: 0 }}>
                  Attendance Tracking Effective Start Date (Go-Live Date)
                </label>
              </div>
              {trackingStartDate && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    border: '1px solid #86EFAC',
                  }}
                >
                  Active from: {trackingStartDate}
                </span>
              )}
            </div>

            <p style={{ fontSize: '11px', color: '#166534', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Working hours, deficit audit, late penalties, and pay deductions will strictly begin calculating from this date onwards. Days prior to this start date will have <strong>0h expected, 0h deficit, and 100% adherence</strong> without requiring any fake backfill!
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={trackingStartDate}
                onChange={(e) => setTrackingStartDate(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #86EFAC',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              />

              <button
                type="button"
                onClick={() => setTrackingStartDate(getTomorrowDateStr())}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #16A34A',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.2)',
                }}
              >
                <Rocket size={13} /> Start from Tomorrow ({getTomorrowDateStr()})
              </button>

              <button
                type="button"
                onClick={() => setTrackingStartDate(getTodayDateStr())}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#15803D',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Zap size={13} /> Start from Today
              </button>

              {trackingStartDate && (
                <button
                  type="button"
                  onClick={() => setTrackingStartDate('')}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Clear start date to track full month"
                >
                  <RotateCcw size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Working Days Checkbox Grid */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
              Official Business Working Days ({workDays.length} Days / Week)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ALL_DAYS.map((d) => {
                const active = workDays.includes(d.key)
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: active ? '#EEF2FF' : '#F8FAFC',
                      border: `1px solid ${active ? '#4F46E5' : '#E2E8F0'}`,
                      color: active ? '#4338CA' : '#64748B',
                      fontSize: '12px',
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        border: `1px solid ${active ? '#4F46E5' : '#CBD5E1'}`,
                        backgroundColor: active ? '#4F46E5' : '#FFFFFF',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFF',
                        fontSize: '10px',
                      }}
                    >
                      {active && '✓'}
                    </span>
                    {d.label}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
              Saudi Arabia Standard: Sunday through Thursday.
            </div>
          </div>

          {/* Shift Hours & Expected Daily Duration */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="#0284C7" /> Daily Shift &amp; Hours Expectation
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Shift Start Time
                </label>
                <input
                  type="time"
                  value={shiftStart}
                  onChange={(e) => handleMainPolicyTimingChange('start', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Shift End Time
                </label>
                <input
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => handleMainPolicyTimingChange('end', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Expected Daily Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="12"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Late Grace Period (Mins)
                </label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="60"
                  value={graceMins}
                  onChange={(e) => setGraceMins(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '10px' }}>
              Base expected hours: <strong>{dailyHours}h / day</strong>. Late arrivals flagged after {shiftStart} + {graceMins} mins.
            </div>

            {/* Custom Hours Per Day Toggle & Table */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #E2E8F0' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1E293B',
                }}
              >
                <input
                  type="checkbox"
                  checked={enableCustomHours}
                  onChange={(e) => setEnableCustomHours(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#4F46E5', cursor: 'pointer' }}
                />
                <span>Set different working hours for specific days (e.g. half-day on Saturday or Thursday)</span>
              </label>

              {enableCustomHours && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '10px' }}>
                    Configure specific shift start/end times and daily hours for individual business days:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {ALL_DAYS.filter((d) => workDays.includes(d.key)).map((d) => {
                      const daySchedule = customDaySchedules[d.key]
                      const dayStartTime = daySchedule?.startTime || shiftStart
                      const dayEndTime = daySchedule?.endTime || shiftEnd
                      const currentHours =
                        customDayHours[d.key] !== undefined && customDayHours[d.key] !== null
                          ? customDayHours[d.key]
                          : dailyHours

                      const isCustom = Boolean(
                        (customDayHours[d.key] !== undefined && customDayHours[d.key] !== dailyHours) ||
                        (daySchedule && (daySchedule.startTime !== shiftStart || daySchedule.endTime !== shiftEnd))
                      )

                      return (
                        <div
                          key={d.key}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: isCustom ? '#F5F7FF' : '#FFFFFF',
                            border: `1.5px solid ${isCustom ? '#6366F1' : '#E2E8F0'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                {d.label}
                              </span>
                              {isCustom ? (
                                <span style={{ fontSize: '10px', backgroundColor: '#EEF2FF', color: '#4F46E5', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                                  Custom Shift
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                                  Standard
                                </span>
                              )}
                            </div>

                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => resetDayToStandard(d.key)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748B',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  textDecoration: 'underline',
                                }}
                                title="Reset this day to default standard hours"
                              >
                                Reset
                              </button>
                            )}
                          </div>

                          {/* Day-to-Day Time Controls */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                                Shift Start
                              </label>
                              <input
                                type="time"
                                value={dayStartTime}
                                onChange={(e) => handleDayTimingChange(d.key, 'start', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: `1px solid ${isCustom ? '#818CF8' : '#CBD5E1'}`,
                                  backgroundColor: '#FFFFFF',
                                  fontSize: '12px',
                                  color: '#0F172A',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                                Shift End
                              </label>
                              <input
                                type="time"
                                value={dayEndTime}
                                onChange={(e) => handleDayTimingChange(d.key, 'end', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: `1px solid ${isCustom ? '#818CF8' : '#CBD5E1'}`,
                                  backgroundColor: '#FFFFFF',
                                  fontSize: '12px',
                                  color: '#0F172A',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                                Daily Hours
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  max="24"
                                  value={currentHours}
                                  onChange={(e) => handleDayHoursChange(d.key, parseFloat(e.target.value) || 0)}
                                  style={{
                                    width: '52px',
                                    padding: '6px 6px',
                                    borderRadius: '6px',
                                    border: `1px solid ${isCustom ? '#4F46E5' : '#CBD5E1'}`,
                                    backgroundColor: '#FFFFFF',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    color: '#0F172A',
                                  }}
                                />
                                <span style={{ fontSize: '11px', color: '#64748B' }}>h</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                    }}
                  >
                    <span>Weekly Total Schedule:</span>
                    <strong style={{ color: '#4F46E5', fontSize: '13px' }}>
                      {totalWeeklyHours} Hours / Week ({workDays.length} Working Days)
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Yearly Leave Quotas */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="#059669" /> Company Leave Quotas (Days / Year)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Default Annual Paid Leave
                </label>
                <input
                  type="number"
                  min="15"
                  max="45"
                  value={annualQuota}
                  onChange={(e) => setAnnualQuota(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '3px' }}>
                  Saudi Labor Law: 21 days (30 days after 5 yrs)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Default Medical / Sick Leave
                </label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={sickQuota}
                  onChange={(e) => setSickQuota(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '3px' }}>
                  Saudi Standard: 30 days full pay
                </div>
              </div>
            </div>
          </div>

          {/* Official Company Holidays */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} color="#4F46E5" /> Official Company Holidays ({officialHolidays.length})
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Excluded from expected working hours
              </span>
            </div>

            {/* List of existing holidays */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {officialHolidays.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '12px' }}>
                  No official holidays added yet.
                </div>
              ) : (
                officialHolidays.map((hol) => (
                  <div
                    key={hol.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0F172A' }}>{hol.name}</strong>
                      <span style={{ color: '#64748B', marginLeft: '8px', fontSize: '11px' }}>({hol.date})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteHoliday(hol.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Remove Holiday"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Holiday Form */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1.2fr auto',
                gap: '8px',
                alignItems: 'center',
                paddingTop: '10px',
                borderTop: '1px dashed #CBD5E1',
              }}
            >
              <input
                type="text"
                placeholder="Holiday Name (e.g. Saudi National Day)"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  color: '#0F172A',
                  backgroundColor: '#FFFFFF',
                }}
              />
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  color: '#0F172A',
                  backgroundColor: '#FFFFFF',
                }}
              />
              <button
                type="button"
                onClick={handleAddHoliday}
                disabled={!newHolidayName.trim() || !newHolidayDate}
                className="btn btn-primary"
                style={{
                  padding: '7px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: !newHolidayName.trim() || !newHolidayDate ? 'not-allowed' : 'pointer',
                  opacity: !newHolidayName.trim() || !newHolidayDate ? 0.6 : 1,
                }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || savedSuccess}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving...
              </>
            ) : savedSuccess ? (
              <>
                <Check size={15} /> Policy Saved!
              </>
            ) : (
              <>
                <ShieldCheck size={15} /> Save Policy
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
