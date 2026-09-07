'use client'

import React from 'react'
import { X, Printer, Building } from 'lucide-react'
import { Expense, ExpenseSummaryStats } from '@/types/expense'

interface Props {
  isOpen: boolean
  onClose: () => void
  expenses: Expense[]
  stats: ExpenseSummaryStats
}

export default function FinancialReportModal({ isOpen, onClose, expenses, stats }: Props) {
  if (!isOpen) return null

  // Group spends by category
  const categoryTotals = expenses.reduce((acc, exp) => {
    if (!acc[exp.category]) {
      acc[exp.category] = { gross: 0, vat: 0, count: 0 }
    }
    acc[exp.category].gross += exp.amount
    acc[exp.category].vat += exp.vat_amount || 0
    acc[exp.category].count += 1
    return acc
  }, {} as Record<string, { gross: number; vat: number; count: number }>)

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1].gross - a[1].gross)

  // Top 4 disbursements to balance the page height beautifully
  const topExpenses = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 4)

  // True Single-Page Isolated Print Handler (eliminates all background DOM & phantom pages)
  const handlePrint = () => {
    const printContent = document.getElementById('financial-statement-print-area')
    if (!printContent) return

    // Remove any previous print iframe
    const oldFrame = document.getElementById('print-statement-iframe')
    if (oldFrame) oldFrame.remove()

    const iframe = document.createElement('iframe')
    iframe.id = 'print-statement-iframe'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asaheeb Real Estate - Financial Statement</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 14mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #FFFFFF;
              font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0F172A;
              -webkit-font-smoothing: antialiased;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
          </style>
        </head>
        <body>
          <div style="width: 100%; padding: 0;">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => {
        iframe.remove()
      }, 1500)
    }, 250)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        {/* Modal Top Control Bar */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} color="#38BDF8" />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>
              Executive Financial Statement · Asaheeb Real Estate (Jeddah HQ)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={14} /> Print / Export PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Financial Statement Body (Balanced for exactly 1 full A4 page) */}
        <div
          id="financial-statement-print-area"
          style={{
            padding: '30px 34px',
            overflowY: 'auto',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Header & Corporate Details (Clean, no unwanted license line) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid #0F172A',
              paddingBottom: '16px',
              marginBottom: '18px',
            }}
          >
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.03em' }}>
                ASAHEEB REAL ESTATE
              </h1>
              <p style={{ fontSize: '12.5px', color: '#475569', margin: '4px 0 0 0', fontWeight: 600 }}>
                شركة أصاهيب العقارية · Corporate Headquarters: Jeddah, KSA
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 9px',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Executive Statement
              </span>
              <div style={{ marginTop: '5px', fontSize: '11.5px', color: '#64748B' }}>
                Scope: <strong>Operational Ledger</strong>
              </div>
              <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Key Financial Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '18px',
            }}
          >
            <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Expenditure
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                {stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: '11px', color: '#64748B' }}>SAR</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '3px', fontWeight: 600 }}>
                {stats.totalTransactions} recorded entries
              </div>
            </div>

            <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                15% ZATCA VAT Paid
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#4F46E5', marginTop: '3px' }}>
                {stats.totalVat.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: '11px', color: '#64748B' }}>SAR</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#4F46E5', marginTop: '3px', fontWeight: 600 }}>
                Claimable tax refund
              </div>
            </div>

            <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Net Outlay (Excl. VAT)
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                {(stats.totalSpent - stats.totalVat).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: '11px', color: '#64748B' }}>SAR</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '3px', fontWeight: 600 }}>
                Actual operational cost
              </div>
            </div>

            <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Recurring Overhead
              </div>
              <div style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                {stats.recurringMonthlyCommitment.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: '11px', color: '#64748B' }}>SAR</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#D97706', marginTop: '3px', fontWeight: 600 }}>
                Monthly baseline
              </div>
            </div>
          </div>

          {/* Departmental & Category Ledger Table */}
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '8px', color: '#0F172A' }}>
              Departmental Cost Allocation & Expense Breakdown
            </h3>
            {sortedCategories.length === 0 ? (
              <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '6px', textAlign: 'center', color: '#64748B', fontSize: '11.5px' }}>
                No expense transactions recorded in this period yet.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1.5px solid #CBD5E1', textAlign: 'left' }}>
                    <th style={{ padding: '7px 9px', fontWeight: 700 }}>Category</th>
                    <th style={{ padding: '7px 9px', fontWeight: 700, textAlign: 'center' }}>Entries</th>
                    <th style={{ padding: '7px 9px', fontWeight: 700, textAlign: 'right' }}>Gross Spend (SAR)</th>
                    <th style={{ padding: '7px 9px', fontWeight: 700, textAlign: 'right' }}>15% VAT (SAR)</th>
                    <th style={{ padding: '7px 9px', fontWeight: 700, textAlign: 'right' }}>Net (Excl. VAT)</th>
                    <th style={{ padding: '7px 9px', fontWeight: 700, textAlign: 'right' }}>Share (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCategories.map(([cat, info]) => {
                    const pct = stats.totalSpent > 0 ? ((info.gross / stats.totalSpent) * 100).toFixed(1) : '0'

                    return (
                      <tr key={cat} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '6px 9px', fontWeight: 600, color: '#1E293B' }}>{cat}</td>
                        <td style={{ padding: '6px 9px', textAlign: 'center', color: '#64748B' }}>{info.count}</td>
                        <td style={{ padding: '6px 9px', textAlign: 'right', fontWeight: 700 }}>
                          {info.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 9px', textAlign: 'right', color: '#64748B' }}>
                          {info.vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 9px', textAlign: 'right', color: '#0F172A', fontWeight: 600 }}>
                          {(info.gross - info.vat).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 9px', textAlign: 'right', color: '#4F46E5', fontWeight: 700 }}>{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Key Outlays & Major Disbursements (Top 4 to fill the page gracefully) */}
          {topExpenses.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '8px', color: '#0F172A' }}>
                Major Expenditures & Significant Disbursements
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {topExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 11px',
                      borderRadius: '5px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: '11.5px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{exp.title}</span>
                      <span style={{ color: '#64748B', marginLeft: '6px' }}>
                        ({exp.vendor_payee} • {exp.cost_center} • {exp.expense_date})
                      </span>
                    </div>
                    <div>
                      <strong style={{ color: '#0F172A', fontSize: '12px' }}>
                        {exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Executive Sign-off & Audit Seal */}
          <div
            style={{
              marginTop: '22px',
              paddingTop: '12px',
              borderTop: '1px dashed #CBD5E1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                Compiled By: Corporate Finance & Accounting
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>
                Asaheeb Real Estate (Jeddah Headquarters) · Kingdom of Saudi Arabia
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '220px' }}>
              <div style={{ borderBottom: '1px solid #0F172A', paddingBottom: '22px' }} />
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A', marginTop: '5px' }}>
                Executive Financial Officer / GM
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>Sign-off Date: ________________________</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
