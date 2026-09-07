'use client'

import { useState } from 'react'
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
  Sparkles,
} from 'lucide-react'
import { CompanyWorkPolicy } from '@/types/attendance'
import { saveCompanyWorkPolicy } from '@/lib/attendanceService'

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

  // Custom per-day hours & shift timings
  const [customDayHours, setCustomDayHours] = useState<Record<string, number>>(
    currentPolicy.custom_day_hours || {}
  )
  const [customDaySchedules, setCustomDaySchedules] = useState<Record<string, { startTime: string; endTime: string; hours: number }>>(
    currentPolicy.custom_day_schedules || {}
  )
  const [enableCustomHours, setEnableCustomHours] = useState<boolean>(
    Boolean(
      (currentPolicy.custom_day_hours && Object.keys(currentPolicy.custom_day_hours).length > 0) ||
      (currentPolicy.custom_day_schedules && Object.keys(currentPolicy.custom_day_schedules).length > 0)
    )
  )

  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

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

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: '580px',
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
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '76vh', overflowY: 'auto' }}>
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
                  onChange={(e) => setShiftStart(e.target.value)}
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
                  onChange={(e) => setShiftEnd(e.target.value)}
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
