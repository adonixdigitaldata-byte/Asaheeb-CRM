'use client'

import React, { useRef } from 'react'
import {
  X,
  Printer,
  Download,
  Building2,
  FileCheck,
  Shield,
  Calendar,
  CheckCircle2,
  User,
  Award,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { EmployeeContract } from '@/types/contract'
import type { Profile } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
  contract: EmployeeContract
  profile: Profile
  onEditTerms?: () => void
  canEdit?: boolean
}

export default function ContractViewModal({
  isOpen,
  onClose,
  contract,
  profile,
  onEditTerms,
  canEdit = false,
}: Props) {
  const printAreaRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const isChannelPartner = contract.contract_type === 'CHANNEL_PARTNER'
  const totalMonthlyGross =
    Number(contract.base_salary || 0) +
    Number(contract.housing_allowance || 0) +
    Number(contract.transport_allowance || 0)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        overflowY: 'auto',
      }}
    >
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-contract-print-area,
          #official-contract-print-area * {
            visibility: visible !important;
          }
          #official-contract-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: #000 !important;
            font-size: 10.5pt !important;
          }
          .no-print {
            display: none !important;
          }
          .clause-block {
            margin-bottom: 12px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .clause-title,
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .signatures-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 16px !important;
          }
          p {
            orphans: 4 !important;
            widows: 4 !important;
          }
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
        }
      `}</style>

      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto"
        style={{
          maxHeight: '94vh',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Modal Top Control Bar (Hidden in Print) */}
        <div
          className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex-wrap gap-3"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isChannelPartner
                  ? 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
                  : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              <FileCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {isChannelPartner
                    ? 'External Channel Partner Agreement'
                    : 'Internal Sales Employment Contract'}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: isChannelPartner ? '#FEF3C7' : '#DCFCE7',
                    color: isChannelPartner ? '#92400E' : '#15803D',
                    border: isChannelPartner ? '1px solid #FDE68A' : '1px solid #BBF7D0',
                  }}
                >
                  {contract.status}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Official Paperwork · {profile.name} ({contract.designation})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && onEditTerms && (
              <button
                type="button"
                onClick={onEditTerms}
                className="btn btn-outline btn-sm"
                style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px' }}
              >
                ✏️ Edit Terms &amp; Variables
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px' }}
              title="Print official contract or save as PDF"
            >
              <Printer size={14} />
              <span>Print / Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100"
          style={{ minHeight: 400 }}
        >
          {/* Paper Sheet Preview Container */}
          <div
            id="official-contract-print-area"
            ref={printAreaRef}
            className="bg-white mx-auto shadow-md rounded-xl p-5 sm:p-7 text-slate-800"
            style={{
              maxWidth: 820,
              fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
              lineHeight: 1.5,
              border: '1px solid #CBD5E1',
            }}
          >
            {/* Document Letterhead */}
            <div
              style={{
                borderBottom: '2px solid #0F172A',
                paddingBottom: 10,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: '#0F172A',
                      color: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 18,
                    }}
                  >
                    A
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                      ASAHEEB &amp; ADONIX DEVELOPMENTS CO.
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>
                      شركة اساهيب وأدونيكس للتطوير — المملكة العربية السعودية
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 4 }}>
                  CR / Unified No.: 7055349166 · VAT: 315081325900003 · REGA Certified Brokerage Practitioner · Al Muruj, Riyadh 12281, KSA
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#0F172A',
                    backgroundColor: '#F1F5F9',
                    padding: '3px 8px',
                    borderRadius: 5,
                    display: 'inline-block',
                    letterSpacing: '0.04em',
                  }}
                >
                  REF #{contract.id ? contract.id.slice(0, 8).toUpperCase() : 'ASB-2026-CTR'}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                  Date: <strong>{formatDate(contract.start_date || new Date().toISOString())}</strong>
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div
              style={{
                textAlign: 'center',
                marginBottom: 14,
                padding: '8px 14px',
                background: isChannelPartner ? '#FFFBEB' : '#EFF6FF',
                border: `1.5px solid ${isChannelPartner ? '#FCD34D' : '#BFDBFE'}`,
                borderRadius: 8,
              }}
            >
              <h1
                style={{
                  fontSize: 15.5,
                  fontWeight: 900,
                  color: isChannelPartner ? '#92400E' : '#1E40AF',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}
              >
                {isChannelPartner
                  ? 'COMMERCIAL CHANNEL PARTNER & REAL ESTATE BROKERAGE AGREEMENT'
                  : 'SALES EXECUTIVE EMPLOYMENT & COMMISSION CONTRACT'}
              </h1>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: isChannelPartner ? '#B45309' : '#2563EB',
                  marginTop: 2,
                  direction: 'rtl',
                }}
              >
                {isChannelPartner
                  ? 'عقد وساطة وتسويق عقاري للشريك الخارجي المعتمد'
                  : 'عقد عمل استشاري مبيعات عقارية ونظام العمولات'}
              </div>
            </div>

            {/* Contracting Parties Section */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: '#0F172A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 8,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 4,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                1. Contracting Parties (أطراف العقد)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#F8FAFC',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                    fontSize: 11.5,
                  }}
                >
                  <strong style={{ color: '#0F172A' }}>First Party (الطرف الأول):</strong> Asaheeb and Adonix Developments Company (شركة اساهيب وأدونيكس للتطوير), a commercial entity organized and existing under the laws of the Kingdom of Saudi Arabia, Unified Number / Commercial Registration No. <strong>7055349166</strong>, VAT Registration No. <strong>315081325900003</strong> (TIN: 3150813259), REGA Certified Real Estate Brokerage Practitioner, with principal registered headquarters at Al Muruj Dist., Riyadh 12281, Kingdom of Saudi Arabia (hereinafter referred to as the <em>&quot;Company&quot;</em> or <em>&quot;First Party&quot;</em>).
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    background: '#F8FAFC',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                    fontSize: 11.5,
                  }}
                >
                  <strong style={{ color: '#0F172A' }}>Second Party (الطرف الثاني):</strong>{' '}
                  <span style={{ fontWeight: 800, color: '#0F172A' }}>{profile.name}</span>
                  {contract.brokerage_firm_name && isChannelPartner && (
                    <span> (Entity: <strong>{contract.brokerage_firm_name}</strong>)</span>
                  )}, holder of National ID / Iqama / Passport No.:{' '}
                  <strong style={{ color: '#1E293B' }}>{contract.national_id_iqama || 'On File'}</strong>
                  {isChannelPartner && contract.cr_number && (
                    <span> · CR No.: <strong>{contract.cr_number}</strong></span>
                  )}
                  {isChannelPartner && contract.fal_license_no && (
                    <span> · REGA Fal License: <strong>{contract.fal_license_no}</strong></span>
                  )}
                  {isChannelPartner && contract.vat_number && (
                    <span> · VAT No.: <strong>{contract.vat_number}</strong></span>
                  )}
                  {' '}(hereinafter referred to as the <em>&quot;{isChannelPartner ? 'Channel Partner' : 'Employee'}&quot;</em>).
                </div>
              </div>
            </div>

            {/* Scope & Designation */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: '#0F172A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 6,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 3,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                2. Engagement Scope &amp; Official Designation (المسمى الوظيفي والمهام)
              </div>
              <p style={{ fontSize: 12, color: '#334155', margin: '0 0 6px 0' }}>
                {isChannelPartner ? (
                  <>
                    The Company designates the Second Party as an authorized external broker and channel partner in the department of <strong>{contract.department}</strong> with the title of <strong>{contract.designation}</strong>. The Second Party agrees to source, introduce, and market official project opportunities in strict conformity with Saudi Real Estate General Authority (REGA / فال) guidelines.
                  </>
                ) : (
                  <>
                    The Company employs the Second Party in the capacity of <strong>{contract.designation}</strong> within the <strong>{contract.department}</strong>. The Second Party shall faithfully devote professional working hours, technical acumen, and sales efforts exclusively to promoting and closing property transactions represented by the Company.
                  </>
                )}
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }}>
                <span style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: 5, color: '#475569' }}>
                  📅 Effective Start Date: <strong>{formatDate(contract.start_date)}</strong>
                </span>
                {contract.end_date && (
                  <span style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: 5, color: '#475569' }}>
                    ⌛ Expiration Date: <strong>{formatDate(contract.end_date)}</strong>
                  </span>
                )}
                {!isChannelPartner && (
                  <span style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: 5, color: '#475569' }}>
                    🛡️ Probation Period: <strong>{contract.probation_months} Months</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Financial Terms & Compensation Matrix */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: '#0F172A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 6,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 3,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                3. Financial Consideration, Commission &amp; Compensation (الحزمة المالية والعمولات)
              </div>

              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  marginBottom: 8,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {!isChannelPartner ? (
                      <>
                        <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600, color: '#475569' }}>Basic Salary (الراتب الأساسي)</td>
                          <td style={{ padding: '6px 12px', fontWeight: 800, color: '#0F172A', textAlign: 'right' }}>
                            {formatCurrency(contract.base_salary)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600, color: '#475569' }}>Housing Allowance (بدل سكن)</td>
                          <td style={{ padding: '6px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                            {formatCurrency(contract.housing_allowance)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600, color: '#475569' }}>Transportation Allowance (بدل نقل)</td>
                          <td style={{ padding: '6px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                            {formatCurrency(contract.transport_allowance)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 800, color: '#0F172A' }}>Total Monthly Package (إجمالي الراتب الشهري)</td>
                          <td style={{ padding: '7px 12px', fontWeight: 900, color: '#16A34A', textAlign: 'right', fontSize: 13 }}>
                            {formatCurrency(totalMonthlyGross)}
                          </td>
                        </tr>
                      </>
                    ) : null}

                    <tr style={{ borderBottom: '1px solid #F1F5F9', background: isChannelPartner ? '#FEFCE8' : '#F0FDF4' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 800, color: isChannelPartner ? '#92400E' : '#15803D' }}>
                        {isChannelPartner ? 'Channel Partner Brokerage Split (نسبة العمولة المعتمدة)' : 'Excess Sales Commission Rate (نسبة العمولة فوق المستهدف)'}
                      </td>
                      <td style={{ padding: '7px 12px', fontWeight: 900, color: isChannelPartner ? '#B45309' : '#15803D', textAlign: 'right', fontSize: 13 }}>
                        {contract.commission_rate_pct}% of Gross Net Commission
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 600, color: '#475569' }}>Monthly Sales Threshold / Target (المستهدف البيعي)</td>
                      <td style={{ padding: '6px 12px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                        {contract.monthly_target_sar > 0 ? formatCurrency(contract.monthly_target_sar) : 'No Minimum Cap'}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: '6px 12px', fontWeight: 600, color: '#475569' }}>Disbursement &amp; Payment Terms (آلية الصرف)</td>
                      <td style={{ padding: '6px 12px', fontWeight: 600, color: '#334155', textAlign: 'right', fontSize: 11 }}>
                        {contract.payment_terms || 'Standard Escrow Disbursement upon Developer Settlement'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Standard Legal Clauses & Compliance */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: '#0F172A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 6,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 3,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                4. General Terms, Confidentiality &amp; Lead Protection (السرية وحماية العملاء)
              </div>

              <div style={{ fontSize: 11.5, color: '#475569', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <p style={{ margin: 0 }}>
                  <strong>A. Client &amp; Lead Protection:</strong> All prospective client contacts, inquiries, phone numbers, and pipeline records registered in the Asaheeb CRM platform constitute strictly proprietary trade secrets. The Second Party shall not disclose, duplicate, or misappropriate company client data to any competitor.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>B. REGA / Saudi Labor Law Compliance:</strong> This agreement is governed by and construed in accordance with the regulatory framework of the Kingdom of Saudi Arabia, including the regulations of the Real Estate General Authority (الهيئة العامة للعقار) and Saudi Labor Regulations.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>C. Notice &amp; Termination:</strong> Either party may terminate this relationship with a formal written notice period of <strong>{contract.notice_period_days} calendar days</strong>, without prejudice to accrued commissions earned prior to the termination date.
                </p>
                {contract.custom_terms && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      padding: '8px 10px',
                      borderRadius: 6,
                      borderLeft: '3px solid #2563EB',
                      fontSize: 11,
                      color: '#1E293B',
                      marginTop: 2,
                    }}
                  >
                    <strong>Special Agreed Addendum (شروط إضافية خاصة):</strong> {contract.custom_terms}
                  </div>
                )}
              </div>
            </div>

            {/* Conditional Clauses for Employee vs Channel Partner */}
            {!isChannelPartner ? (
              <>
                {/* Employee: Non-Competition & 2-Year Restraint */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#0F172A',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 3,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    5. Non-Competition &amp; 2-Year Restraint of Trade (حظر المنافسة لمدة سنتين بموجب المادة 83 من نظام العمل)
                  </div>
                  <div style={{ fontSize: 11.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.5 }}>
                    <p style={{ margin: 0 }}>
                      <strong>A. Non-Compete Covenant (Article 83, Saudi Labor Law):</strong> In consideration of employment, proprietary developer networks, client pipeline, and commission remuneration provided by the Company, the Second Party agrees that throughout this agreement and for a period of <strong>two (2) full calendar years</strong> following resignation, termination, or separation for any reason, the Second Party shall <strong>NOT</strong> practice, broker, advise, or conduct real estate outside the Company—whether independently for their own account or with/for any competing real estate entity or developer in Saudi Arabia.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>B. Legal Action:</strong> If the Second Party violates this covenant during or within the statutory two-year post-contractual period, the Company has the full legal right to initiate immediate court proceedings before competent Saudi courts to demand full financial compensation, forfeiture of unpaid commissions, and statutory damages.
                    </p>
                    <div style={{ padding: '5px 8px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 10.5, color: '#475569' }}>
                      <em>نص البند بالعربية (المادة 83 من نظام العمل):</em> يحظر على الطرف الثاني حظراً تاماً ممارسة أي نشاط عقاري أو وساطة أو تسويق عقاري خارج مظلة الشركة لحسابه أو لصالح أي جهة منافسة طوال فترة العقد ولمدة سنتين (٢) تلي انتهاء علاقته بالشركة، ويحق للشركة قانوناً مقاضاته أمام المحاكم المختصة للمطالبة بالتعويضات ومصادرة كافة المستحقات.
                    </div>
                  </div>
                </div>

                {/* Employee: Client & Developer Exclusivity */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#0F172A',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 3,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    6. Client &amp; Developer Exclusivity — Prohibition of Direct Closings (حظر التعاقد المباشر مع المطورين والعملاء)
                  </div>
                  <div style={{ fontSize: 11.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.5 }}>
                    <p style={{ margin: 0 }}>
                      <strong>A. Fiduciary Trust:</strong> This contract is built upon mutual trust. The Second Party is strictly forbidden from closing deals directly with developers, property owners, or clients outside the company.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>B. Mandatory Corporate Routing:</strong> All property transactions, client leads, inquiries, and contracts MUST happen exclusively through the Company, under the Company profile and portfolio, and registered within the Asaheeb CRM platform.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>C. Sanctions:</strong> Bypassing the company or dealing directly with developers constitutes gross misconduct and breach of trust under Article 80 of the Saudi Labor Law, resulting in immediate termination, forfeiture of commissions, and judicial prosecution.
                    </p>
                    <div style={{ padding: '5px 8px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 10.5, color: '#475569' }}>
                      <em>نص البند بالعربية:</em> يحظر على الطرف الثاني إتمام أي صفقات أو تعاقدات مباشرة مع المطورين العقاريين أو العملاء خارج مظلة الشركة. وتتم كافة المعاملات حصراً عبر ملف الشركة ومحفظتها الاستثمارية ومنظومة CRM. وأي إخلال يوجب الفصل الفوري ومصادرة العمولات والملاحقة القضائية.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Channel Partner: Independent Contractor Status */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#0F172A',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 3,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    5. Independent Third-Party Contractor Status (الصفة كطرف ثالث مستقل وعدم وجود علاقة عمل)
                  </div>
                  <div style={{ fontSize: 11.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.5 }}>
                    <p style={{ margin: 0 }}>
                      <strong>A. Commercial Affiliate Relationship:</strong> The Second Party operates strictly as an independent third-party commercial partner / external broker. Nothing herein shall be construed as creating an employment contract, agency, or partnership under Saudi Labor Law.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>B. Exclusion of Labor Benefits:</strong> The Second Party is NOT eligible for employee salaries, end-of-service awards, annual leave, or statutory labor entitlements. The Second Party is solely responsible for all operational expenses, REGA licensing, and ZATCA / VAT compliance.
                    </p>
                    <div style={{ padding: '5px 8px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 10.5, color: '#475569' }}>
                      <em>نص البند بالعربية:</em> يقر الطرفان بأن هذا العقد هو عقد تجاري مستقل بين طرفين مستقلين ولا يُعد الطرف الثاني موظفاً لدى الشركة، ولا تنشأ بموجبه أي علاقة عمل خاضعة لنظام العمل السعودي، ولا يحق له المطالبة برواتب أو مكافأة نهاية خدمة أو مستحقات عمالية.
                    </div>
                  </div>
                </div>

                {/* Channel Partner: Project Non-Circumvention & Deal Protection */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#0F172A',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 3,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    6. Project Non-Circumvention &amp; Deal Protection (حظر الالتفاف وحماية صفقات المشاريع المحالة)
                  </div>
                  <div style={{ fontSize: 11.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.5 }}>
                    <p style={{ margin: 0 }}>
                      <strong>A. Non-Circumvention:</strong> The Second Party shall NOT bypass or circumvent the Company to deal directly with property developers, project owners, or sellers introduced or made available through the Company's portfolio.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>B. Deal Protection &amp; CRM Registration:</strong> All transaction opportunities and buyer referrals must be registered within the Asaheeb CRM platform to guarantee deal protection and commission settlement.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>C. Liquidated Damages:</strong> Bypassing the Company on an introduced project or developer within 24 months obligates the Second Party to pay liquidated damages equal to 100% of the gross commission plus full legal expenses.
                    </p>
                    <div style={{ padding: '5px 8px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 10.5, color: '#475569' }}>
                      <em>نص البند بالعربية:</em> يحظر على شريك القنوات الالتفاف على الشركة أو تجاوزها للتعاقد المباشر مع أي مطور عقاري تم تعريفه عبر الشركة. ويجب تسجيل كافة الصفقات عبر منصة Asaheeb CRM، وتوجب أي محاولة التفاف تعويض الشركة بكامل قيمة العمولة المستحقة مع أتعاب المحاماة.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Signature & Seal Blocks */}
            <div
              className="signatures-block"
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: '2px solid #E2E8F0',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20,
              }}
            >
              {/* First Party Signature */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
                  For &amp; On Behalf of First Party (الطرف الأول)
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 16 }}>
                  Asaheeb and Adonix Developments Company
                </div>

                {/* Simulated Official Seal Stamp */}
                <div
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 90,
                    height: 90,
                    borderRadius: '50%',
                    border: '2px solid #1E3A8A',
                    color: '#1E3A8A',
                    padding: 4,
                    transform: 'rotate(-8deg)',
                    margin: '0 auto',
                    textAlign: 'center',
                    lineHeight: 1.15,
                  }}
                >
                  <div style={{ fontSize: 7.5, fontWeight: 900 }}>ASAHEEB &amp; ADONIX</div>
                  <div style={{ fontSize: 6.5, fontWeight: 800 }}>★ SEAL ★</div>
                  <div style={{ fontSize: 6.5, fontWeight: 700 }}>DEVELOPMENTS CO.</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: '#334155', fontWeight: 600 }}>
                  Executive Authorized Signatory — الإدارة العامة
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                  Date: {formatDate(contract.signed_at || contract.start_date || new Date().toISOString())}
                </div>
              </div>

              {/* Second Party Signature — Certified Digital Signature & Legal Acknowledgment */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4, textAlign: 'center' }}>
                  Acknowledged &amp; Agreed by Second Party (الطرف الثاني)
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 16, textAlign: 'center' }}>
                  {profile.name} ({contract.designation || 'Signatory'})
                </div>

                {/* Digital Signature Card */}
                <div
                  style={{
                    padding: '10px 12px',
                    border: '1.5px solid #10B981',
                    borderRadius: 8,
                    backgroundColor: '#F0FDF4',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={15} color="#059669" />
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#065F46', textTransform: 'uppercase' }}>
                        Digitally Signed &amp; Acknowledged
                      </span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#047857', backgroundColor: '#DCFCE7', padding: '1px 5px', borderRadius: 4 }}>
                      مُعتمد إلكترونياً
                    </span>
                  </div>

                  <div style={{ borderTop: '1px dashed #A7F3D0', paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#065F46' }}>
                        {contract.signed_by_name || profile.name}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#047857' }}>
                        ID: {contract.national_id_iqama || 'Verified on File'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 9.5, color: '#047857' }}>
                      AUTH-{contract.id ? contract.id.slice(0, 8).toUpperCase() : 'VERIFIED'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 6, lineHeight: 1.4 }}>
                  ✓ Electronically executed and binding under Saudi Electronic Transactions Law (Royal Decree No. M/18). No physical signature required.
                  <br />
                  <span style={{ color: '#94A3B8' }}>(تم التوقيع والإقرار إلكترونياً نظاماً ولا يلزم التوقيع الخطي).</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <div className="text-xs text-slate-500">
            🔒 Legally protected document generated directly from the Asaheeb CRM repository.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              style={{ fontWeight: 700 }}
            >
              <Printer size={14} />
              <span>Print / Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
