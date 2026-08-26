'use client'

import React, { useRef } from 'react'
import { Payslip } from '@/types/database'
import {
  formatCurrencyAmount,
  getMonthName,
  getSalaryPeriod,
  getDaysInMonth,
  getDefaultStatutoryDeductions,
} from '@/lib/payroll-utils'
import { Printer, X } from 'lucide-react'

interface Props {
  payslip: Payslip
  onClose?: () => void
  isPrintOnly?: boolean
}

export default function PayslipDocument({ payslip, onClose, isPrintOnly = false }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const originalTitle = document.title
    const cleanName = (payslip.employee?.name || 'Staff').replace(/\s+/g, '')
    const cleanDesignation = (payslip.designation || payslip.employee?.specialization || 'Agent').replace(/\s+/g, '_')
    const cleanPeriod = `${monthName}_${payslip.year}`

    // Set custom filename for PDF download
    document.title = `Asaheeb_${cleanName}_${cleanDesignation}_Payslip_${cleanPeriod}`

    window.print()

    // Restore original title
    setTimeout(() => {
      document.title = originalTitle
    }, 200)
  }

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

  // Reference number
  const monthStr = payslip.month < 10 ? `0${payslip.month}` : `${payslip.month}`
  const empCodeClean = payslip.employee_code || payslip.id.slice(0, 5).toUpperCase()
  const payslipRefNumber = `ASH/PAY/${payslip.year}-${monthStr}/${empCodeClean}`

  // Standard deductions fallback list if empty
  const deductionsList = (payslip.deductions_breakdown && payslip.deductions_breakdown.length > 0)
    ? payslip.deductions_breakdown
    : getDefaultStatutoryDeductions(currency)

  // Bank name & masked account
  const bankName = payslip.bank_name || (isSAR ? 'Al Rajhi Bank' : 'Bank Transfer')
  const maskedAccount = payslip.account_number
    ? `•••• •••• ${payslip.account_number.slice(-4)}`
    : '•••• •••• 4128'

  const paymentDateStr = payslip.payment_date
    ? new Date(payslip.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : `${totalMonthDays} ${monthName.slice(0, 3)} ${payslip.year}`

  return (
    <div className="payslip-modal-backdrop" onClick={onClose}>
      <div
        className="payslip-modal-wrapper"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 840,
          width: '100%',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          margin: 'auto',
          position: 'relative',
        }}
      >
        {/* Action Header (Hidden during browser print) */}
        {!isPrintOnly && (
          <div className="no-print" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-admin" style={{ fontSize: 12, fontWeight: 700, background: '#EFF6FF', color: '#1E3A8A' }}>
                {payslip.financial_year}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                SALARY SLIP — {monthName.toUpperCase()} {payslip.year}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '8px 16px', background: '#1E3A8A', color: '#fff' }}
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline btn-sm"
                  title="Close"
                  style={{ padding: 6, border: 'none' }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* PRINTABLE PAYSLIP SHEET (Single Page A4 Layout) */}
        <div
          ref={printRef}
          id="printable-payslip"
          style={{
            padding: '36px 44px',
            background: '#ffffff',
            color: '#0F172A',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            fontSize: 13.5,
            lineHeight: 1.55,
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Watermark background */}
          <div className="payslip-watermark" style={{
            position: 'absolute',
            top: '52%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.035,
            pointerEvents: 'none',
            zIndex: 0,
            width: '320px',
            height: '320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src="/Favicon.png"
              alt="Asaheeb Watermark"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* HEADER & BRANDING */}
            <div className="payslip-header-block" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2.5px solid #1E3A8A',
              paddingBottom: 16,
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <img
                  src="/Favicon.png"
                  alt="Asaheeb Real Estate"
                  style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'contain' }}
                />
                <div>
                  <div style={{
                    fontSize: 21,
                    color: '#1E3A8A',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2
                  }}>
                    ASAHEEB REAL ESTATE
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', fontWeight: 700, letterSpacing: '0.03em' }}>
                    شركة أساهيب العقارية
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#64748B',
                    marginTop: 3,
                    lineHeight: 1.3
                  }}>
                    <div>Office 602, Matbouli Plaza, Fayd As Samaa</div>
                    <div>Al-Ruwais, Jeddah 23213, Saudi Arabia</div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block',
                  background: '#1E3A8A',
                  color: '#ffffff',
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 4,
                  letterSpacing: '0.02em',
                  marginBottom: 6,
                }}>
                  SALARY SLIP — {monthName.toUpperCase()} {payslip.year}
                </div>
                <div style={{ fontSize: 11, color: '#0F172A', lineHeight: 1.4 }}>
                  Salary Period: <strong>{salaryPeriod}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, lineHeight: 1.4 }}>
                  Financial Year: <strong>{payslip.financial_year}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, lineHeight: 1.4 }}>
                  Ref No: <strong style={{ color: '#1E3A8A' }}>{payslipRefNumber}</strong>
                </div>
              </div>
            </div>

            {/* NET PAY SUMMARY BANNER */}
            <div className="payslip-summary-banner" style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '14px 20px',
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Net Salary Payable
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1E3A8A', marginTop: 1 }}>
                  {formatCurrencyAmount(payslip.net_pay, currency)}
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 1, fontStyle: 'italic', fontWeight: 600 }}>
                  {payslip.net_pay_in_words || '—'}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderLeft: '1px solid #CBD5E1',
                paddingLeft: 16,
              }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>Gross Salary</div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: '#10B981', marginTop: 1 }}>
                    {formatCurrencyAmount(payslip.gross_earnings, currency)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>Deductions</div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: payslip.total_deductions > 0 ? '#EF4444' : '#64748B', marginTop: 1 }}>
                    {formatCurrencyAmount(payslip.total_deductions, currency)}
                  </div>
                </div>
              </div>
            </div>

            {/* EMPLOYEE & DISBURSEMENT DETAILS TABLE */}
            <table className="payslip-profile-table" style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #E2E8F0',
              marginBottom: 20,
              fontSize: 11.5,
            }}>
              <tbody>
                <tr>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B', width: '18%' }}>Employee Name</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#0F172A', width: '32%' }}>{payslip.employee?.name ?? '—'}</td>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B', width: '18%' }}>Employee ID</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A', width: '32%' }}>{payslip.employee_code ?? `ASH-${payslip.employee_id.slice(0, 5).toUpperCase()}`}</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Designation / Role</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{payslip.designation ?? payslip.employee?.specialization ?? 'Sales Specialist'}</td>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Department</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{payslip.department ?? 'Sales'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Date of Joining</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{payslip.joining_date || '—'}</td>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Bank &amp; Account</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{bankName} • {maskedAccount}</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>IBAN / Account ID</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{payslip.ifsc_or_iban || 'Verified'}</td>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>National ID / Iqama</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{payslip.pan_or_iqama || 'On File'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Working / Paid Days</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{workingDays} / {paidDays} Days</td>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Payment Date</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#10B981' }}>{paymentDateStr}</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Payment Mode</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: '#0F172A' }}>{payslip.payment_method}</td>
                  <td style={{ padding: '7px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontWeight: 600, color: '#64748B' }}>Loss of Pay (LOP)</td>
                  <td style={{ padding: '7px 12px', border: '1px solid #E2E8F0', fontWeight: 600, color: lopDays > 0 ? '#EF4444' : '#64748B' }}>{lopDays} Days</td>
                </tr>
              </tbody>
            </table>

            {/* TWO-COLUMN SALARY BREAKDOWN TABLE */}
            <div className="payslip-breakdown-container" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              border: '1px solid #E2E8F0',
              marginBottom: 20,
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              {/* EARNINGS COLUMN */}
              <div style={{ borderRight: '1px solid #E2E8F0' }}>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: 11.5,
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>EARNINGS &amp; ALLOWANCES</span>
                  <span>AMOUNT ({currency})</span>
                </div>
                <div style={{ padding: '8px 12px', minHeight: 160 }}>
                  {payslip.earnings_breakdown?.map((item, idx) => (
                    <div key={item.id || idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '5px 0',
                      borderBottom: idx === payslip.earnings_breakdown.length - 1 ? 'none' : '1px dashed #E2E8F0',
                      fontSize: 11.5,
                    }}>
                      <span style={{ color: '#334155' }}>{item.name}</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        {formatCurrencyAmount(item.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{
                  background: '#F8FAFC',
                  padding: '8px 12px',
                  borderTop: '1px solid #E2E8F0',
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#10B981',
                  fontSize: 12,
                }}>
                  <span>Total Gross Earnings</span>
                  <span>{formatCurrencyAmount(payslip.gross_earnings, currency)}</span>
                </div>
              </div>

              {/* DEDUCTIONS COLUMN */}
              <div>
                <div style={{
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: 11.5,
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>DEDUCTIONS</span>
                  <span>AMOUNT ({currency})</span>
                </div>
                <div style={{ padding: '8px 12px', minHeight: 160 }}>
                  {payslip.total_deductions === 0 ? (
                    <div style={{
                      color: '#64748B',
                      fontSize: 11.5,
                      fontStyle: 'italic',
                      padding: '24px 0',
                      textAlign: 'center',
                    }}>
                      No deductions applied for this period.
                    </div>
                  ) : (
                    deductionsList
                      .filter((item) => item.amount > 0)
                      .map((item, idx, arr) => (
                        <div key={item.id || idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '5px 0',
                          borderBottom: idx === arr.length - 1 ? 'none' : '1px dashed #E2E8F0',
                          fontSize: 11.5,
                        }}>
                          <span style={{ color: '#0F172A' }}>{item.name}</span>
                          <span style={{ fontWeight: 700, color: '#EF4444' }}>
                            - {formatCurrencyAmount(item.amount, currency)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
                <div style={{
                  background: '#F8FAFC',
                  padding: '8px 12px',
                  borderTop: '1px solid #E2E8F0',
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: payslip.total_deductions > 0 ? '#EF4444' : '#64748B',
                  fontSize: 12,
                }}>
                  <span>Total Deductions</span>
                  <span>{formatCurrencyAmount(payslip.total_deductions, currency)}</span>
                </div>
              </div>
            </div>

            {/* NET SALARY CALLOUT ROW */}
            <div className="payslip-net-callout" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              padding: '12px 18px',
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  TOTAL NET SALARY CREDITED
                </div>
                <div style={{ fontSize: 11.5, color: '#0F172A', fontWeight: 600, marginTop: 1 }}>
                  {payslip.net_pay_in_words}
                </div>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#1E3A8A' }}>
                {formatCurrencyAmount(payslip.net_pay, currency)}
              </div>
            </div>

            {/* OPTIONAL REMARKS */}
            {payslip.notes && (
              <div className="payslip-remarks" style={{
                border: '1px solid #E2E8F0',
                borderRadius: 6,
                padding: '8px 12px',
                background: '#F8FAFC',
                marginBottom: 20,
                fontSize: 11.5,
              }}>
                <strong>Remarks: </strong> {payslip.notes}
              </div>
            )}

            {/* FOOTER & BOILERPLATE SECTION */}
            <div className="payslip-boilerplate-section" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              paddingTop: 16,
              borderTop: '1px solid #E2E8F0',
              marginTop: 20,
              position: 'relative',
            }}>
              {/* Standard Boilerplate Policy Info */}
              <div style={{ flex: '1 1 55%', fontSize: 10.5, color: '#64748B', lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: '#1E3A8A', textTransform: 'uppercase', marginBottom: 3, letterSpacing: '0.02em', fontSize: 11 }}>
                  Confidential Document
                </div>
                <ul style={{ paddingLeft: 12, margin: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <li>This payslip is a confidential record between Asaheeb Real Estate and the employee.</li>
                  <li>For queries regarding commissions or salary, please contact admin directly.</li>
                  <li>This is a computer-generated statement and requires no physical signature.</li>
                </ul>
              </div>

              {/* Signature Block */}
              <div style={{ flex: '0 0 200px', position: 'relative', textAlign: 'center' }}>
                <div style={{
                  height: 38,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  color: '#1E3A8A',
                  fontWeight: 800,
                  fontSize: 14,
                  marginBottom: 3,
                }}>
                  Asaheeb Management
                </div>
                <div style={{ borderTop: '1.5px solid #1E3A8A', margin: '3px 0', width: '100%' }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>
                  Authorised Signatory
                </div>
                <div style={{ fontSize: 9.5, color: '#64748B' }}>
                  Asaheeb Real Estate · شركة أساهيب
                </div>
              </div>
            </div>

            {/* PAGE FOOTER FINE PRINT */}
            <div className="payslip-page-footer" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
              color: '#94A3B8',
              borderTop: '1px solid #E2E8F0',
              marginTop: 20,
              paddingTop: 8,
            }}>
              <div>
                ASAHEEB REAL ESTATE • Private &amp; Confidential
              </div>
              <div>
                Page 1 of 1
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STRICT SINGLE-PAGE A4 PRINT CSS */}
      <style jsx global>{`
        @media screen {
          .payslip-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            overflow-y: auto;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          
          .no-print,
          .sidebar,
          .activity-tracker,
          .page-header,
          .page-body > *:not(.payslip-modal-backdrop),
          .card:not(.payslip-modal-wrapper),
          .table-responsive:not(.payslip-modal-wrapper *),
          button,
          .btn,
          header,
          footer {
            display: none !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          .app-shell,
          .main-content {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
          }

          .payslip-modal-backdrop {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          .payslip-modal-wrapper {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          #printable-payslip {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            max-width: 760px !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  )
}
