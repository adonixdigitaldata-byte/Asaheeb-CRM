import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getFinancialYear,
  numberToWords,
  calculateSalarySplitFromGross,
  getDaysInMonth,
  getDefaultStatutoryDeductions,
} from '@/lib/payroll-utils'
import { PayslipCurrency } from '@/types/database'

interface MonthYear {
  month: number
  year: number
}

function getMonthsBetween(startDateStr: string, endYear: number, endMonth: number): MonthYear[] {
  const start = new Date(startDateStr)
  let startYear = isNaN(start.getFullYear()) ? endYear : start.getFullYear()
  let startMonth = isNaN(start.getMonth()) ? 1 : start.getMonth() + 1

  const results: MonthYear[] = []
  let curY = startYear
  let curM = startMonth

  while (curY < endYear || (curY === endYear && curM <= endMonth)) {
    results.push({ year: curY, month: curM })
    curM++
    if (curM > 12) {
      curM = 1
      curY++
    }
  }
  return results
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      month = new Date().getMonth() + 1,
      year = new Date().getFullYear(),
      mode = 'CURRENT_MONTH', // 'CURRENT_MONTH' | 'BACKFILL_FROM_JOINING' | 'SINGLE_EMPLOYEE'
      employeeId = null,
      employeeIds = null,
      overwriteExisting = false,
    } = body

    const targetMonth = Number(month)
    const targetYear = Number(year)

    // Use service client to bypass RLS for payroll operations
    const serviceClient = await createServiceClient()

    // 1. Fetch eligible employee salary profiles
    let profilesQuery = serviceClient
      .from('employee_salary_profiles')
      .select('*, profile:profiles(*)')

    if (employeeId) {
      profilesQuery = profilesQuery.eq('profile_id', employeeId)
    } else if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      profilesQuery = profilesQuery.in('profile_id', employeeIds)
    }

    const { data: salaryProfiles, error: profileErr } = await profilesQuery
    if (profileErr) throw profileErr
    if (!salaryProfiles || salaryProfiles.length === 0) {
      return NextResponse.json({ error: 'No employee salary profiles found.' }, { status: 404 })
    }

    // 2. Fetch all salary histories for interval rate determination
    const profileIds = salaryProfiles.map((p) => p.profile_id)
    const { data: salaryHistories } = await serviceClient
      .from('employee_salary_history')
      .select('*')
      .in('profile_id', profileIds)
      .order('start_date', { ascending: true })

    const historiesByProfile: Record<string, any[]> = {}
    salaryHistories?.forEach((h) => {
      if (!historiesByProfile[h.profile_id]) historiesByProfile[h.profile_id] = []
      historiesByProfile[h.profile_id].push(h)
    })

    const generated: any[] = []
    const skipped: any[] = []
    const errors: any[] = []

    for (const salProfile of salaryProfiles) {
      const emp = salProfile.profile
      if (!emp || emp.is_active === false) {
        continue
      }

      // Determine month periods to generate
      let periodsToGenerate: MonthYear[] = []
      if (mode === 'BACKFILL_FROM_JOINING' && salProfile.joining_date) {
        periodsToGenerate = getMonthsBetween(salProfile.joining_date, targetYear, targetMonth)
      } else {
        periodsToGenerate = [{ year: targetYear, month: targetMonth }]
      }

      for (const period of periodsToGenerate) {
        const pMonth = period.month
        const pYear = period.year

        // Check if payslip exists
        const { data: existing } = await serviceClient
          .from('payslips')
          .select('id, status')
          .eq('employee_id', salProfile.profile_id)
          .eq('month', pMonth)
          .eq('year', pYear)
          .maybeSingle()

        if (existing && !overwriteExisting) {
          skipped.push({
            employeeId: salProfile.profile_id,
            name: emp.name,
            period: `${pMonth}/${pYear}`,
            reason: 'Already exists (skipped without overwrite)',
          })
          continue
        }

        // Determine effective base salary for this specific month from history or profile
        const periodDateStr = `${pYear}-${String(pMonth).padStart(2, '0')}-01`
        const empHistories = historiesByProfile[salProfile.profile_id] || []
        
        let effectiveGross = salProfile.base_salary
        let effectiveCurrency: PayslipCurrency = salProfile.currency || 'SAR'

        const matchingHistory = empHistories.find((h) => {
          const s = h.start_date
          const e = h.end_date
          if (s <= periodDateStr) {
            if (!e || e >= periodDateStr) return true
          }
          return false
        })

        if (matchingHistory) {
          effectiveGross = matchingHistory.base_salary
          effectiveCurrency = matchingHistory.currency || effectiveCurrency
        }

        // Calculate standard earnings breakdown (Basic 80%, Housing 16%, Other 4%)
        const { basic, hra, specialAllowance } = calculateSalarySplitFromGross(effectiveGross)
        const earnings = [
          { id: 'basic', name: 'Basic Salary', amount: basic, description: '80% of Gross' },
          { id: 'hra', name: 'Housing Allowance', amount: hra, description: '16% of Gross' },
          { id: 'special', name: 'Transport / Other Allowance', amount: specialAllowance, description: '4% of Gross' },
        ]

        // Default statutory deductions
        const defaultDeds = (salProfile.default_deductions && salProfile.default_deductions.length > 0)
          ? salProfile.default_deductions
          : getDefaultStatutoryDeductions(effectiveCurrency)

        const totalDeductions = defaultDeds.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0)
        const grossEarnings = effectiveGross
        const netPay = Math.max(0, grossEarnings - totalDeductions)
        const totalDays = getDaysInMonth(pYear, pMonth)

        const startDayStr = `${pYear}-${String(pMonth).padStart(2, '0')}-01`
        const endDayStr = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

        const payslipPayload = {
          employee_id: salProfile.profile_id,
          month: pMonth,
          year: pYear,
          financial_year: getFinancialYear(pYear, pMonth),
          currency: effectiveCurrency,
          base_salary: basic,
          earnings_breakdown: earnings,
          deductions_breakdown: defaultDeds,
          gross_earnings: grossEarnings,
          total_deductions: totalDeductions,
          net_pay: netPay,
          net_pay_in_words: numberToWords(netPay, effectiveCurrency),
          working_days: totalDays,
          paid_days: totalDays,
          lop_days: 0,
          status: 'PAID',
          payment_date: endDayStr,
          period_start_date: startDayStr,
          period_end_date: endDayStr,
          payment_method: 'BANK_TRANSFER',
          designation: salProfile.designation || 'Sales Specialist',
          department: salProfile.department || 'Sales',
          employee_code: salProfile.employee_code,
          bank_name: salProfile.bank_name,
          account_number: salProfile.account_number,
          ifsc_or_iban: salProfile.ifsc_or_iban,
          pan_or_iqama: salProfile.pan_or_iqama,
          joining_date: salProfile.joining_date,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }

        if (existing && overwriteExisting) {
          const { error: updErr } = await serviceClient
            .from('payslips')
            .update(payslipPayload)
            .eq('id', existing.id)

          if (updErr) {
            errors.push({ employeeId: salProfile.profile_id, period: `${pMonth}/${pYear}`, error: updErr.message })
          } else {
            generated.push({ id: existing.id, employee: emp.name, period: `${pMonth}/${pYear}`, action: 'overwritten' })
          }
        } else {
          const { data: newSlip, error: insErr } = await serviceClient
            .from('payslips')
            .insert(payslipPayload)
            .select()
            .single()

          if (insErr) {
            errors.push({ employeeId: salProfile.profile_id, period: `${pMonth}/${pYear}`, error: insErr.message })
          } else {
            generated.push({ id: newSlip.id, employee: emp.name, period: `${pMonth}/${pYear}`, action: 'created' })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      generatedCount: generated.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
      generated,
      skipped,
      errors,
    })
  } catch (err: any) {
    console.error('Payroll generate error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
