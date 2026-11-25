'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Printer, CheckCircle2, FileText, Building2, Loader2 } from 'lucide-react'
import type { ProjectCommission, CommissionPayment, Project } from '@/types/database'

interface Props {
  commission: ProjectCommission
  payments: CommissionPayment[]
  project?: Project
  onClose: () => void
  onUpdated: (updatedCommission: ProjectCommission) => void
}

const BANK_STORAGE_KEY = 'asaheeb_company_bank_details'

export default function DeveloperReceiptModal({
  commission,
  payments,
  project,
  onClose,
  onUpdated,
}: Props) {
  const [docMode, setDocMode] = useState<'CLAIM' | 'RECEIPT'>(
    Number(commission.developer_received_amount || 0) > 0 ? 'RECEIPT' : 'CLAIM'
  )
  const [developerName, setDeveloperName] = useState(project?.developer_en || 'Developer Finance & Broker Relations')
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('Asaheeb Real Estate')
  const [iban, setIban] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [extraNote, setExtraNote] = useState(
    'Kindly process the brokerage commission transfer to the bank account below and share the transfer confirmation.'
  )
  const [markingSent, setMarkingSent] = useState(false)
  const [sentNotice, setSentNotice] = useState('')
  const printAreaRef = useRef<HTMLDivElement>(null)

  // Load saved company bank info from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BANK_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.bankName) setBankName(parsed.bankName)
        if (parsed.accountName) setAccountName(parsed.accountName)
        if (parsed.iban) setIban(parsed.iban)
        if (parsed.vatNumber) setVatNumber(parsed.vatNumber)
      }
    } catch {}
  }, [])

  function saveBankSettings() {
    try {
      localStorage.setItem(
        BANK_STORAGE_KEY,
        JSON.stringify({ bankName, accountName, iban, vatNumber })
      )
    } catch {}
  }

  const totalExpected = Number(commission.commission_amount || 0)
  const totalReceived = Number(commission.developer_received_amount || 0)
  const balanceDue = Math.max(0, totalExpected - totalReceived)
  const inflowPayments = payments.filter((p) => p.direction === 'INFLOW')
  const refCode = `ASB-${commission.id.slice(0, 6).toUpperCase()}`
  const todayStr = new Date().toISOString().split('T')[0]

  async function handleMarkClaimSent() {
    setMarkingSent(true)
    try {
      const res = await fetch('/api/projects/commissions/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_id: commission.id,
          action: 'UPDATE_TERMS',
          mark_claim_sent: true,
        }),
      })
      const data = await res.json()
      if (res.ok && data.commission) {
        onUpdated(data.commission)
        setSentNotice('Marked as Claim Sent to Developer!')
        setTimeout(() => setSentNotice(''), 3500)
      }
    } catch (err) {
      console.error('Failed to mark claim sent:', err)
    } finally {
      setMarkingSent(false)
    }
  }

  function handlePrint() {
    saveBankSettings()
    if (!printAreaRef.current) return
    const content = printAreaRef.current.innerHTML
    const printWin = window.open('', '_blank', 'width=900,height=1000')
    if (!printWin) {
      window.print()
      return
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docMode === 'CLAIM' ? 'Commission Claim Note' : 'Official Payment Receipt'} - ${refCode}</title>
          <style>
            * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
            body { margin: 0; padding: 32px; color: #0F172A; background: #FFFFFF; }
            @media print {
              body { padding: 16px; }
              @page { size: A4; margin: 14mm; }
            }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 250); };
          </script>
        </body>
      </html>
    `)
    printWin.document.close()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 880,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} color="#1D4ED8" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
              Developer Document Generator
            </span>
            <div style={{ display: 'inline-flex', background: '#E2E8F0', borderRadius: 8, padding: 2 }}>
              <button
                type="button"
                onClick={() => setDocMode('CLAIM')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: docMode === 'CLAIM' ? '#FFFFFF' : 'transparent',
                  color: docMode === 'CLAIM' ? '#1D4ED8' : '#475569',
                }}
              >
                Commission Claim Note
              </button>
              <button
                type="button"
                onClick={() => setDocMode('RECEIPT')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: docMode === 'RECEIPT' ? '#FFFFFF' : 'transparent',
                  color: docMode === 'RECEIPT' ? '#059669' : '#475569',
                }}
              >
                Payment Receipt
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {docMode === 'CLAIM' && (
              <button
                type="button"
                onClick={handleMarkClaimSent}
                disabled={markingSent}
                className="btn btn-outline btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: '#059669', borderColor: '#A7F3D0', background: '#ECFDF5' }}
              >
                {markingSent ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                <span>{commission.claim_sent_at ? 'Claim Marked Sent ✓' : 'Mark Claim Sent'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Editable Company / Developer Settings Bar */}
        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#FAFBFD',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>
              Developer / Recipient Name
            </label>
            <input
              type="text"
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: 30, fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>
              Asaheeb Bank Name (Saved)
            </label>
            <input
              type="text"
              placeholder="e.g. Al Rajhi Bank / SNB"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: 30, fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>
              Company IBAN (Saved)
            </label>
            <input
              type="text"
              placeholder="SA00 0000 0000 ..."
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: 30, fontSize: 12 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>
              VAT / CR # (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. CR 4030..."
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="form-input"
              style={{ width: '100%', height: 30, fontSize: 12 }}
            />
          </div>
        </div>

        {sentNotice && (
          <div style={{ padding: '8px 22px', background: '#ECFDF5', color: '#065F46', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #A7F3D0' }}>
            {sentNotice}
          </div>
        )}

        {/* Printable A4 Preview */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#F1F5F9' }}>
          <div
            ref={printAreaRef}
            style={{
              maxWidth: 740,
              margin: '0 auto',
              background: '#FFFFFF',
              padding: '36px 40px',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: '1px solid #E2E8F0',
            }}
          >
            {/* Letterhead */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: 18, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  ASAHEEB REAL ESTATE
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', marginTop: 2 }}>
                  العقارية · Brokerage &amp; Advisory
                </div>
                {vatNumber && (
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    Registration / VAT: {vatNumber}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    background: docMode === 'CLAIM' ? '#EFF6FF' : '#ECFDF5',
                    color: docMode === 'CLAIM' ? '#1E40AF' : '#065F46',
                    border: `1px solid ${docMode === 'CLAIM' ? '#BFDBFE' : '#A7F3D0'}`,
                    textTransform: 'uppercase',
                  }}
                >
                  {docMode === 'CLAIM' ? 'Commission Claim / Debit Note' : 'Official Payment Receipt'}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
                  <strong>Ref #:</strong> {refCode}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  <strong>Issue Date:</strong> {todayStr}
                </div>
              </div>
            </div>

            {/* Recipient & Deal Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div style={{ padding: 14, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                  {docMode === 'CLAIM' ? 'Billed To (Developer)' : 'Received From (Developer)'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{developerName}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                  Project: <strong>{project?.name_en || '—'}</strong>
                </div>
                {project?.city_en && (
                  <div style={{ fontSize: 11.5, color: '#64748B' }}>{project.city_en}</div>
                )}
              </div>

              <div style={{ padding: 14, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                  Closed Deal Details
                </div>
                <div style={{ fontSize: 12.5, color: '#0F172A' }}>
                  <strong>Unit / Layout:</strong> {commission.unit_name}
                </div>
                <div style={{ fontSize: 12.5, color: '#0F172A', marginTop: 3 }}>
                  <strong>Purchasing Client:</strong> {commission.buyer_name}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
                  <strong>Sale Date:</strong> {commission.sale_date}
                  {commission.expected_payout_date ? ` · Due: ${commission.expected_payout_date}` : ''}
                </div>
              </div>
            </div>

            {/* Financial Summary Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 22, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11.5, textTransform: 'uppercase' }}>Amount (SAR)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <strong>Brokerage Commission — {project?.name_en || 'Property'} ({commission.unit_name})</strong>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                      Buyer: {commission.buyer_name}
                      {commission.deal_value_sar ? ` · Property Value: SAR ${Number(commission.deal_value_sar).toLocaleString('en-US')}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                    SAR {totalExpected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 700 }}>
                    Less: Total Received to Date
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#059669', fontWeight: 800 }}>
                    SAR {totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ background: docMode === 'CLAIM' ? '#EFF6FF' : '#ECFDF5' }}>
                  <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 900, color: '#0F172A' }}>
                    {docMode === 'CLAIM' ? 'Net Commission Balance Due' : 'Remaining Balance'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 16, fontWeight: 900, color: balanceDue > 0 ? '#1E40AF' : '#059669' }}>
                    SAR {balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Payment Tranches Received (shown when payments exist) */}
            {inflowPayments.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                  Recorded Payment Tranches
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #E2E8F0' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left' }}>Method / Reference</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>Amount Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflowPayments.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '7px 10px' }}>{p.payment_date}</td>
                        <td style={{ padding: '7px 10px' }}>
                          {p.payment_method.replace('_', ' ')} {p.reference_no ? `(${p.reference_no})` : ''}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          SAR {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bank Details (especially important for Claim Note) */}
            {(bankName || iban) && (
              <div style={{ padding: 14, borderRadius: 8, background: '#F8FAFC', border: '1px solid #CBD5E1', marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={13} /> Remittance / Bank Account Details
                </div>
                <div style={{ fontSize: 12.5, color: '#0F172A', lineHeight: 1.6 }}>
                  <div><strong>Beneficiary:</strong> {accountName || 'Asaheeb Real Estate'}</div>
                  {bankName && <div><strong>Bank:</strong> {bankName}</div>}
                  {iban && <div><strong>IBAN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{iban}</span></div>}
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 28 }}>
              {docMode === 'CLAIM'
                ? extraNote
                : 'Thank you for your partnership. This receipt acknowledges the payment(s) recorded above against the referenced brokerage commission.'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px dashed #CBD5E1', fontSize: 11.5, color: '#64748B' }}>
              <div>Authorized Signature — Asaheeb Real Estate</div>
              <div>Generated from Asaheeb CRM · {todayStr}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
