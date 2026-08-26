'use client'

import React, { useState, useMemo } from 'react'
import { Profile, Payslip } from '@/types/database'
import { formatCurrencyAmount, getMonthName } from '@/lib/payroll-utils'
import PayslipDocument from '@/components/payroll/PayslipDocument'
import { FileText, Eye, Printer, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Props {
  currentProfile: Profile
  payslips: Payslip[]
}

export default function MyPayslipsClient({ currentProfile, payslips }: Props) {
  const [selectedFY, setSelectedFY] = useState<string>('ALL')
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null)

  // Extract available Financial Years
  const availableFYs = useMemo(() => {
    const fys = Array.from(new Set(payslips.map((p) => p.financial_year).filter(Boolean)))
    return Array.from(new Set(fys)).sort().reverse()
  }, [payslips])

  const filteredPayslips = useMemo(() => {
    return payslips.filter((p) => {
      if (selectedFY !== 'ALL' && p.financial_year !== selectedFY) return false
      return true
    })
  }, [payslips, selectedFY])

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">
            My Payslips &amp; Compensation
          </h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            View and download your official monthly salary receipts across all financial cycles
          </p>
        </div>

        {currentProfile.role === 'ADMIN' && (
          <Link href="/payroll" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <ShieldCheck size={14} /> Open Admin Payroll Vault <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="page-body">
        {/* Financial Year Selector Tabs */}
        {availableFYs.length > 0 && (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            marginBottom: 20,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            gap: 16,
          }}>
            <button
              onClick={() => setSelectedFY('ALL')}
              style={{
                padding: '8px 4px',
                fontSize: 13.5,
                fontWeight: 600,
                color: selectedFY === 'ALL' ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: selectedFY === 'ALL' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                background: 'none',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
              }}
            >
              All Cycles ({payslips.length})
            </button>
            {availableFYs.map((fy) => {
              const count = payslips.filter((p) => p.financial_year === fy).length
              return (
                <button
                  key={fy}
                  onClick={() => setSelectedFY(fy)}
                  style={{
                    padding: '8px 4px',
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: selectedFY === fy ? 'var(--accent)' : 'var(--text-secondary)',
                    borderBottom: selectedFY === fy ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                    background: 'none',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {fy} ({count})
                </button>
              )
            })}
          </div>
        )}

      {/* Payslips Grid / Cards */}
      {filteredPayslips.length === 0 ? (
        <div className="card" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <FileText size={44} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>No Payslips Available Yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto' }}>
            Your monthly salary receipts will be displayed here once processed by the administration.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {filteredPayslips.map((p) => {
            const monthName = getMonthName(p.month)

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'transform 150ms ease, box-shadow 150ms ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="badge badge-admin" style={{ fontSize: 11, fontWeight: 700 }}>
                      {p.financial_year}
                    </span>
                    <span className="badge badge-active" style={{ fontSize: 11 }}>
                      {p.status}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                    {monthName} {p.year}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Disbursed via {p.payment_method?.replace('_', ' ')}
                  </div>
                </div>

                <div style={{
                  background: 'var(--bg)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Net Salary Paid</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                      {formatCurrencyAmount(p.net_pay, p.currency)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Paid Days</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.paid_days} / {p.working_days}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => setViewingPayslip(p)}
                  >
                    <Eye size={14} /> View Payslip
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}
                    onClick={() => {
                      setViewingPayslip(p)
                      setTimeout(() => window.print(), 200)
                    }}
                    title="Print / Save as PDF"
                  >
                    <Printer size={14} /> Print PDF
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>

      {/* Payslip Document Viewer Modal */}
      {viewingPayslip && (
        <PayslipDocument
          payslip={viewingPayslip}
          onClose={() => setViewingPayslip(null)}
        />
      )}
    </div>
  )
}
