/**
 * Shared utility functions for Asaheeb VIP Consultations cycle & quota calculations.
 * 
 * Saudi Arabian business week operates from Saturday through Thursday.
 * Friday is the official weekend / day-off.
 */

export interface WeekCycleInfo {
  cycleString: string
  start: Date
  end: Date
  thursday: Date
}

/**
 * Calculates the current weekly operating cycle (Saturday through Thursday).
 * If today is Friday, it belongs to the active cycle ending this week.
 * On Saturday morning (00:00:00), the new weekly cycle begins and the quota resets.
 */
export function getCurrentWeekCycle(targetDate: Date = new Date()): WeekCycleInfo {
  const d = new Date(targetDate)
  const day = d.getDay() // 0: Sun, 1: Mon, ..., 6: Sat
  const daysSinceSaturday = (day + 7 - 6) % 7

  const saturday = new Date(d)
  saturday.setDate(d.getDate() - daysSinceSaturday)
  saturday.setHours(0, 0, 0, 0)

  const thursday = new Date(saturday)
  thursday.setDate(saturday.getDate() + 5)
  thursday.setHours(23, 59, 59, 999)

  const nextSaturday = new Date(saturday)
  nextSaturday.setDate(saturday.getDate() + 7)
  nextSaturday.setHours(0, 0, 0, 0)

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const satPart = `Sat ${months[saturday.getMonth()]} ${saturday.getDate()}`
  const thuPart = `Thu ${months[thursday.getMonth()]} ${thursday.getDate()}, ${thursday.getFullYear()}`
  const cycleString = `${satPart} – ${thuPart}`

  return { cycleString, start: saturday, end: nextSaturday, thursday }
}

/**
 * Determines whether a booking belongs to the specified weekly cycle.
 * Checks both the stored week_cycle string and the payment/creation timestamp.
 */
export function isBookingInCycle(
  booking: { week_cycle?: string | null; paid_at?: string | null; created_at?: string | null },
  cycle: WeekCycleInfo
): boolean {
  if (booking.week_cycle === cycle.cycleString) return true
  const dateStr = booking.paid_at || booking.created_at
  if (!dateStr) return false
  const t = new Date(dateStr).getTime()
  return t >= cycle.start.getTime() && t < cycle.end.getTime()
}

