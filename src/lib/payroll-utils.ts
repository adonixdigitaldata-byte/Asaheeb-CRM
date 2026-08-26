import { PayslipCurrency, PayslipLineItem } from '@/types/database'

export function getFinancialYear(year: number, month: number): string {
  // Financial year runs April (month 4) to March (month 3) or Calendar year based
  if (month >= 4) {
    return `FY ${year}-${year + 1}`
  }
  return `FY ${year - 1}-${year}`
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export function getMonthName(monthNumber: number): string {
  return MONTH_NAMES[monthNumber - 1] || 'Unknown Month'
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function getSalaryPeriod(year: number, month: number): string {
  const lastDay = getDaysInMonth(year, month)
  const shortMonth = MONTH_NAMES_SHORT[month - 1] || 'Aug'
  const endDayFormatted = lastDay < 10 ? `0${lastDay}` : `${lastDay}`
  return `01 ${shortMonth} ${year} – ${endDayFormatted} ${shortMonth} ${year}`
}

export function formatCurrencyAmount(amount: number, currency: PayslipCurrency = 'SAR'): string {
  const safeAmount = Number(amount) || 0
  if (currency === 'SAR') {
    return `SAR ${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(safeAmount)
  }
  return `$ ${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const FX_RATES_TO_SAR: Record<PayslipCurrency, number> = {
  SAR: 1,
  INR: 0.045,
  USD: 3.75,
}

export const FX_RATES_TO_INR: Record<PayslipCurrency, number> = {
  INR: 1,
  SAR: 22.2,
  USD: 83.5,
}

export function convertCurrency(
  amount: number,
  fromCurrency: PayslipCurrency,
  toCurrency: PayslipCurrency
): number {
  const safeAmount = Number(amount) || 0
  if (fromCurrency === toCurrency) return safeAmount
  
  // Convert from source currency to INR first
  const inrAmount = safeAmount * (FX_RATES_TO_INR[fromCurrency] || 1)
  
  // Convert from INR to target currency
  const targetRate = FX_RATES_TO_INR[toCurrency] || 1
  return inrAmount / targetRate
}

/**
 * Calculates standard 80/16/4 earnings structure:
 * e.g., on 10,000 SAR Gross -> Basic: 8,000 (80%), Housing/HRA: 1,600 (16%), Transport/Special Allowance: 400 (4%)
 */
export function calculateSalarySplitFromGross(gross: number): {
  basic: number
  hra: number
  specialAllowance: number
} {
  const safeGross = Math.max(0, Number(gross) || 0)
  const basic = Math.round(safeGross * 0.8)
  const hra = Math.round(safeGross * 0.16)
  const specialAllowance = Math.max(0, safeGross - basic - hra)
  return { basic, hra, specialAllowance }
}

/**
 * Calculates standard earnings structure when Basic is entered:
 */
export function calculateSalarySplitFromBasic(basic: number): {
  gross: number
  basic: number
  hra: number
  specialAllowance: number
} {
  const safeBasic = Math.max(0, Number(basic) || 0)
  const gross = Math.round(safeBasic / 0.8)
  const hra = Math.round(gross * 0.16)
  const specialAllowance = Math.max(0, gross - safeBasic - hra)
  return { gross, basic: safeBasic, hra, specialAllowance }
}

/**
 * Standard statutory deductions list showing non-applicable items with 0.00
 */
export function getDefaultStatutoryDeductions(currency: PayslipCurrency = 'SAR'): PayslipLineItem[] {
  if (currency === 'INR') {
    return [
      { id: 'epf', name: 'Employee Provident Fund (EPF)', amount: 0, description: 'Exempt (Below threshold)' },
      { id: 'pt', name: 'Professional Tax (PT)', amount: 0, description: 'Exempt / Nil' },
      { id: 'tds', name: 'Tax Deducted at Source (TDS)', amount: 0, description: 'Below taxable threshold' },
      { id: 'esi', name: 'Employee State Insurance (ESI)', amount: 0, description: 'Not Applicable' },
      { id: 'other_ded', name: 'Loss of Pay / Other Deductions', amount: 0 },
    ]
  }
  return [
    { id: 'gosi', name: 'GOSI / Social Insurance', amount: 0, description: 'Applicable per regulation' },
    { id: 'tax', name: 'Income / Withholding Tax', amount: 0, description: 'Exempt / Nil' },
    { id: 'other_ded', name: 'Loss of Pay / Other Deductions', amount: 0 },
  ]
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertLessThanThousand(num: number): string {
  let current = ''
  if (num % 100 < 20) {
    current = ONES[num % 100]
    num = Math.floor(num / 100)
  } else {
    current = ONES[num % 10]
    num = Math.floor(num / 10)
    current = TENS[num % 10] + (current ? ' ' + current : '')
    num = Math.floor(num / 10)
  }
  if (num === 0) return current
  return ONES[num] + ' Hundred' + (current ? ' ' + current : '')
}

export function numberToWords(num: number, currency: PayslipCurrency = 'SAR'): string {
  if (!num || isNaN(num) || num === 0) {
    if (currency === 'INR') return 'Zero Rupees Only'
    if (currency === 'SAR') return 'Zero Saudi Riyals Only'
    return 'Zero Dollars Only'
  }

  const integerPart = Math.floor(Math.abs(num))
  const fractionalPart = Math.round((Math.abs(num) - integerPart) * 100)

  let words = ''

  if (currency === 'INR') {
    let n = integerPart
    const crore = Math.floor(n / 10000000)
    n %= 10000000
    const lakh = Math.floor(n / 100000)
    n %= 100000
    const thousand = Math.floor(n / 1000)
    const hundred = n % 1000

    const parts: string[] = []
    if (crore > 0) parts.push(convertLessThanThousand(crore) + ' Crore')
    if (lakh > 0) parts.push(convertLessThanThousand(lakh) + ' Lakh')
    if (thousand > 0) parts.push(convertLessThanThousand(thousand) + ' Thousand')
    if (hundred > 0) parts.push(convertLessThanThousand(hundred))

    words = parts.join(' ') + ' Rupees'
    if (fractionalPart > 0) {
      words += ' and ' + convertLessThanThousand(fractionalPart) + ' Paise'
    }
  } else {
    let n = integerPart
    const millions = Math.floor(n / 1000000)
    n %= 1000000
    const thousands = Math.floor(n / 1000)
    const hundreds = n % 1000

    const parts: string[] = []
    if (millions > 0) parts.push(convertLessThanThousand(millions) + ' Million')
    if (thousands > 0) parts.push(convertLessThanThousand(thousands) + ' Thousand')
    if (hundreds > 0) parts.push(convertLessThanThousand(hundreds))

    const unit = currency === 'SAR' ? 'Saudi Riyals' : 'Dollars'
    const fractionUnit = currency === 'SAR' ? 'Halalas' : 'Cents'

    words = parts.join(' ') + ' ' + unit
    if (fractionalPart > 0) {
      words += ' and ' + convertLessThanThousand(fractionalPart) + ' ' + fractionUnit
    }
  }

  return (words.trim() + ' Only').replace(/\s+/g, ' ')
}
