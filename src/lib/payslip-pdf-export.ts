'use client'

import { Payslip, Profile } from '@/types/database'
import {
  formatCurrencyAmount,
  getMonthName,
  getSalaryPeriod,
  getDaysInMonth,
  getDefaultStatutoryDeductions,
} from '@/lib/payroll-utils'

export interface ZipExportProgress {
  current: number
  total: number
  currentFileName: string
}

let faviconBase64Cache: string | null = null

async function getFaviconBase64(): Promise<string> {
  if (faviconBase64Cache) return faviconBase64Cache
  if (typeof window === 'undefined') return '/Favicon.png'
  try {
    const res = await fetch('/Favicon.png')
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        faviconBase64Cache = reader.result as string
        resolve(faviconBase64Cache)
      }
      reader.onerror = () => resolve('/Favicon.png')
      reader.readAsDataURL(blob)
    })
  } catch {
    return '/Favicon.png'
  }
}

export function generatePayslipHTML(payslip: Payslip, profile?: Profile, logoSrc: string = '/Favicon.png'): string {
  const monthName = getMonthName(payslip.month)
  const currency = payslip.currency || 'SAR'
  const isSAR = currency === 'SAR'

  const formatPeriodDate = (dStr: string) => {
    try {
      return new Date(dStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return dStr
    }
  }

  const salaryPeriod = (payslip.period_start_date && payslip.period_end_date)
    ? `${formatPeriodDate(payslip.period_start_date)} – ${formatPeriodDate(payslip.period_end_date)}`
    : getSalaryPeriod(payslip.year, payslip.month)
  const totalMonthDays = getDaysInMonth(payslip.year, payslip.month)
  const workingDays = payslip.working_days || totalMonthDays
  const paidDays = payslip.paid_days || workingDays
  const lopDays = payslip.lop_days || 0

  const monthStr = payslip.month < 10 ? `0${payslip.month}` : `${payslip.month}`
  const empCodeClean = payslip.employee_code || payslip.id.slice(0, 5).toUpperCase()
  const payslipRefNumber = `ASH/PAY/${payslip.year}-${monthStr}/${empCodeClean}`

  const deductionsList = (payslip.deductions_breakdown && payslip.deductions_breakdown.length > 0)
    ? payslip.deductions_breakdown
    : getDefaultStatutoryDeductions(currency)

  const bankName = payslip.bank_name || (isSAR ? 'Al Rajhi Bank' : 'Bank Transfer')
  const maskedAccount = payslip.account_number
    ? `•••• •••• ${payslip.account_number.slice(-4)}`
    : '•••• •••• 4128'

  const paymentDateStr = payslip.payment_date
    ? new Date(payslip.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : `${totalMonthDays} ${monthName.slice(0, 3)} ${payslip.year}`

  const empName = payslip.employee?.name || profile?.name || 'Staff'
  const designation = payslip.designation || payslip.employee?.specialization || profile?.specialization || 'Sales Specialist'

  // Build earnings rows
  const earningsRows = (payslip.earnings_breakdown || []).map((item, idx, arr) => `
    <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: ${idx === arr.length - 1 ? 'none' : '1px dashed #E2E8F0'}; font-size: 12px;">
      <span style="color: #334155;">${item.name}</span>
      <span style="font-weight: 700; color: #0F172A;">${formatCurrencyAmount(item.amount, currency)}</span>
    </div>
  `).join('')

  // Build deductions rows
  const deductionsRows = deductionsList.filter(d => d.amount > 0).map((item, idx, arr) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: ${idx === arr.length - 1 ? 'none' : '1px dashed #E2E8F0'}; font-size: 12px;">
      <span style="color: #0F172A;">${item.name}</span>
      <span style="font-weight: 700; color: #EF4444;">- ${formatCurrencyAmount(item.amount, currency)}</span>
    </div>
  `).join('')

  return `
    <div style="width: 740px; background: #ffffff; color: #0F172A; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.55; padding: 0; margin: 0; box-sizing: border-box; position: relative;">
      
      <!-- Watermark background -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.035; pointer-events: none; z-index: 0; width: 340px; height: 340px; min-width: 340px; min-height: 340px; display: flex; align-items: center; justify-content: center;">
        <img
          src="${logoSrc}"
          alt="Asaheeb Watermark"
          width="340"
          height="340"
          style="width: 340px; height: 340px; max-width: 340px; max-height: 340px; display: block;"
        />
      </div>

      <div style="position: relative; z-index: 1;">
        <!-- HEADER & BRANDING -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1E3A8A; padding-bottom: 18px; margin-bottom: 22px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 56px; height: 56px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              <img
                src="${logoSrc}"
                alt="Asaheeb Real Estate"
                style="height: 56px; width: auto; max-width: 56px; object-fit: contain; display: block;"
              />
            </div>

            <div>
              <div style="font-size: 22px; color: #1E3A8A; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2;">
                ASAHEEB REAL ESTATE
              </div>
              <div style="font-size: 13.5px; color: #64748B; font-weight: 700; letter-spacing: 0; text-align: left; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
                <span dir="rtl" style="display: inline-block;">شركة أساهيب العقارية</span>
              </div>
              <div style="font-size: 11.5px; color: #64748B; margin-top: 3px; line-height: 1.35; text-align: left;">
                <div>Office 602, Matbouli Plaza, Fayd As Samaa</div>
                <div>Al-Ruwais, Jeddah 23213, Saudi Arabia</div>
              </div>
            </div>
          </div>

          <div style="text-align: right;">
            <div style="display: inline-block; background: #1E3A8A; color: #ffffff; padding: 5px 14px; font-size: 12.5px; font-weight: 800; border-radius: 4px; letter-spacing: 0.02em; margin-bottom: 7px;">
              SALARY SLIP — ${monthName.toUpperCase()} ${payslip.year}
            </div>
            <div style="font-size: 11.5px; color: #0F172A; line-height: 1.45;">
              Salary Period: <strong>${salaryPeriod}</strong>
            </div>
            <div style="font-size: 11.5px; color: #64748B; margin-top: 1px; line-height: 1.45;">
              Financial Year: <strong>${payslip.financial_year}</strong>
            </div>
            <div style="font-size: 11.5px; color: #64748B; margin-top: 1px; line-height: 1.45;">
              Ref No: <strong style="color: #1E3A8A;">${payslipRefNumber}</strong>
            </div>
          </div>
        </div>

        <!-- NET PAY SUMMARY BANNER -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px 22px; color: #0F172A; display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px;">
          <div>
            <div style="font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700;">
              NET SALARY PAYABLE
            </div>
            <div style="font-size: 26px; font-weight: 800; color: #1E3A8A; margin-top: 2px;">
              ${formatCurrencyAmount(payslip.net_pay, currency)}
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 2px; font-style: italic; font-weight: 600;">
              ${payslip.net_pay_in_words || '—'}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 18px; border-left: 1px solid #CBD5E1; padding-left: 18px;">
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #64748B; font-weight: 600;">Gross Salary</div>
              <div style="font-size: 16px; font-weight: 700; color: #10B981; margin-top: 1px;">
                ${formatCurrencyAmount(payslip.gross_earnings, currency)}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #64748B; font-weight: 600;">Deductions</div>
              <div style="font-size: 16px; font-weight: 700; color: ${payslip.total_deductions > 0 ? '#EF4444' : '#64748B'}; margin-top: 1px;">
                ${formatCurrencyAmount(payslip.total_deductions, currency)}
              </div>
            </div>
          </div>
        </div>

        <!-- EMPLOYEE & DISBURSEMENT DETAILS TABLE -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; margin-bottom: 22px; font-size: 12px;">
          <tbody>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B; width: 18%;">Employee Name</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; width: 32%;">${payslip.employee?.name ?? profile?.name ?? '—'}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B; width: 18%;">Employee ID</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A; width: 32%;">${payslip.employee_code ?? `ASH-${(payslip.employee_id || '').slice(0, 5).toUpperCase()}`}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Designation / Role</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${payslip.designation ?? payslip.employee?.specialization ?? profile?.specialization ?? 'Sales Specialist'}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Department</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${payslip.department ?? 'Sales'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Date of Joining</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${payslip.joining_date || '—'}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Bank &amp; Account</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${bankName} • ${maskedAccount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">IBAN / Account ID</td>
              <td style="padding: 7px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${payslip.ifsc_or_iban || 'Verified'}</td>
              <td style="padding: 7px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">National ID / Iqama</td>
              <td style="padding: 7px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${payslip.pan_or_iqama || 'On File'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Working / Paid Days</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${workingDays} / ${paidDays} Days</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Payment Date</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #10B981;">${paymentDateStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Payment Mode</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${payslip.payment_method || 'BANK_TRANSFER'}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; font-weight: 600; color: #64748B;">Loss of Pay (LOP)</td>
              <td style="padding: 8px 12px; border: 1px solid #E2E8F0; font-weight: 600; color: ${lopDays > 0 ? '#EF4444' : '#64748B'};">${lopDays} Days</td>
            </tr>
          </tbody>
        </table>

        <!-- TWO-COLUMN SALARY BREAKDOWN TABLE -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #E2E8F0; margin-bottom: 22px; border-radius: 6px; overflow: hidden;">
          <!-- EARNINGS COLUMN -->
          <div style="border-right: 1px solid #E2E8F0;">
            <div style="background: #F1F5F9; padding: 9px 14px; font-weight: 700; font-size: 12px; color: #1E3A8A; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
              <span>EARNINGS &amp; ALLOWANCES</span>
              <span>AMOUNT (${currency})</span>
            </div>
            <div style="padding: 10px 14px; min-height: 175px;">
              ${earningsRows}
            </div>
            <div style="background: #F8FAFC; padding: 9px 14px; border-top: 1px solid #E2E8F0; font-weight: 700; display: flex; justify-content: space-between; color: #10B981; font-size: 12.5px;">
              <span>Total Gross Earnings</span>
              <span>${formatCurrencyAmount(payslip.gross_earnings, currency)}</span>
            </div>
          </div>

          <!-- DEDUCTIONS COLUMN -->
          <div>
            <div style="background: #F1F5F9; padding: 9px 14px; font-weight: 700; font-size: 12px; color: #1E3A8A; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
              <span>DEDUCTIONS</span>
              <span>AMOUNT (${currency})</span>
            </div>
            <div style="padding: 10px 14px; min-height: 175px;">
              ${deductionsList.filter(item => item.amount > 0).length === 0 ? `
                <div style="color: #64748B; font-size: 12px; font-style: italic; padding: 42px 0; text-align: center;">
                  No deductions applied for this period.
                </div>
              ` : deductionsRows}
            </div>
            <div style="background: #F8FAFC; padding: 9px 14px; border-top: 1px solid #E2E8F0; font-weight: 700; display: flex; justify-content: space-between; color: ${payslip.total_deductions > 0 ? '#EF4444' : '#64748B'}; font-size: 12.5px;">
              <span>Total Deductions</span>
              <span>${formatCurrencyAmount(payslip.total_deductions, currency)}</span>
            </div>
          </div>
        </div>

        <!-- NET SALARY CALLOUT ROW -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px 20px; margin-bottom: 22px;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">
              TOTAL NET SALARY CREDITED
            </div>
            <div style="font-size: 12px; color: #0F172A; font-weight: 600; margin-top: 1px;">
              ${payslip.net_pay_in_words || '—'}
            </div>
          </div>
          <div style="font-size: 20px; font-weight: 800; color: #1E3A8A;">
            ${formatCurrencyAmount(payslip.net_pay, currency)}
          </div>
        </div>

        ${payslip.notes ? `
          <div style="border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; background: #F8FAFC; margin-bottom: 22px; font-size: 12px;">
            <strong>Remarks: </strong> ${payslip.notes}
          </div>
        ` : ''}

        <!-- FOOTER & BOILERPLATE SECTION -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-top: 18px; border-top: 1px solid #E2E8F0; margin-top: 22px; position: relative;">
          <!-- Standard Boilerplate Policy Info -->
          <div style="flex: 1 1 55%; font-size: 11px; color: #64748B; line-height: 1.5;">
            <div style="font-weight: 700; color: #1E3A8A; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.02em; font-size: 11.5px;">
              CONFIDENTIAL DOCUMENT
            </div>
            <ul style="padding-left: 14px; margin: 0; display: flex; flex-direction: column; gap: 2.5px;">
              <li>This payslip is a confidential record between Asaheeb Real Estate and the employee.</li>
              <li>For queries regarding commissions or salary, please contact admin directly.</li>
              <li>This is a computer-generated statement and requires no physical signature.</li>
            </ul>
          </div>

          <!-- Signature Block -->
          <div style="flex: 0 0 210px; position: relative; text-align: center;">
            <div style="height: 40px; display: flex; align-items: flex-end; justify-content: center; color: #1E3A8A; font-weight: 800; font-size: 14.5px; margin-bottom: 4px;">
              Asaheeb Management
            </div>
            <div style="border-top: 1.5px solid #1E3A8A; margin: 4px 0; width: 100%;"></div>
            <div style="font-size: 11.5px; font-weight: 700; color: #0F172A;">
              Authorised Signatory
            </div>
            <div style="font-size: 10px; color: #64748B; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
              Asaheeb Real Estate · <span dir="rtl">شركة أساهيب</span>
            </div>
          </div>
        </div>

        <!-- PAGE FOOTER FINE PRINT -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #94A3B8; border-top: 1px solid #E2E8F0; margin-top: 22px; padding-top: 10px;">
          <div>
            ASAHEEB REAL ESTATE • Private &amp; Confidential
          </div>
          <div>
            Page 1 of 1
          </div>
        </div>
      </div>
    </div>
  `
}

/**
 * Builds the exact, standardized filename for a payslip PDF
 */
export function getPayslipPdfFileName(payslip: Payslip, profile?: Profile): string {
  const monthName = getMonthName(payslip.month)
  const monthStr = payslip.month < 10 ? `0${payslip.month}` : `${payslip.month}`
  const empName = (payslip.employee?.name || profile?.name || 'Staff')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')

  return `Asaheeb_${empName}_Payslip_${payslip.year}_${monthStr}_${monthName}.pdf`
}

/**
 * Converts a payslip into a high-resolution Vector/Raster PDF ArrayBuffer matching the exact print layout & full-page vertical span
 */
export async function renderPayslipToPdfArrayBuffer(payslip: Payslip, profile?: Profile): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const html2canvas = (await import('html2canvas')).default
  const logoBase64 = await getFaviconBase64()

  // Create an off-screen container with exact 740px printable width and padding: 0
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-99999px'
  container.style.left = '-99999px'
  container.style.width = '740px'
  container.style.zIndex = '-1000'
  container.innerHTML = generatePayslipHTML(payslip, profile, logoBase64)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2.5, // Crisp 300+ DPI vector-like clarity
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.98)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    // Standard A4 dimensions: 210mm x 297mm
    // Margins: 14mm horizontal, 18mm vertical header space (matching Photo 1)
    const marginX = 14
    const marginY = 18
    const printWidth = 210 - (marginX * 2) // exactly 182mm
    const printHeight = (canvas.height * printWidth) / canvas.width

    pdf.addImage(imgData, 'JPEG', marginX, marginY, printWidth, Math.min(265, printHeight))

    const arrayBuffer = pdf.output('arraybuffer')
    return new Uint8Array(arrayBuffer)
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Packages all selected payslips into a single .ZIP archive containing individual PDFs
 */
export async function exportPayslipsAsZip(
  payslips: Payslip[],
  profile: Profile,
  financialYear: string = 'ALL',
  onProgress?: (progress: ZipExportProgress) => void
): Promise<void> {
  if (!payslips || payslips.length === 0) return

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const total = payslips.length
  for (let i = 0; i < total; i++) {
    const payslip = payslips[i]
    const fileName = getPayslipPdfFileName(payslip, profile)

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        currentFileName: fileName,
      })
    }

    const pdfBuffer = await renderPayslipToPdfArrayBuffer(payslip, profile)
    zip.file(fileName, pdfBuffer)
  }

  // Generate and download zip
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const cleanEmpName = (profile.name || 'Staff').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
  const cleanFY = financialYear.replace(/[^\w-]/g, '_')
  const zipFileName = `Asaheeb_Payslips_${cleanEmpName}_${cleanFY}.zip`

  const downloadUrl = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = zipFileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(downloadUrl)
}
