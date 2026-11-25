'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Printer, CheckCircle2, FileText, Building2, Loader2, CheckSquare, Square } from 'lucide-react'
import type { ProjectCommission, Project } from '@/types/database'

interface Props {
  projects: Project[]
  commissions: ProjectCommission[]
  initialProjectId?: string
  onClose: () => void
  onBatchUpdated: (updatedCommissions: ProjectCommission[]) => void
}

const BANK_STORAGE_KEY = 'asaheeb_company_bank_details'

export default function ProjectBatchReceiptModal({
  projects,
  commissions,
  initialProjectId,
  onClose,
  onBatchUpdated,
}: Props) {
  const defaultProjId =
    initialProjectId && initialProjectId !== 'ALL'
      ? initialProjectId
      : projects[0]?.id || ''

  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjId)
  const [docMode, setDocMode] = useState<'CLAIM' | 'RECEIPT'>('CLAIM')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  )

  const projectDeals = useMemo(() => {
    return commissions
      .filter((c) => c.project_id === selectedProjectId)
      .sort((a, b) => (a.sale_date || '').localeCompare(b.sale_date || ''))
  }, [commissions, selectedProjectId])

  // Auto-select unpaid / partial deals when switching project (or all deals in RECEIPT mode)
  useEffect(() => {
    const unpaid = projectDeals
      .filter((d) => (d.developer_payment_status || 'PENDING') !== 'RECEIVED')
      .map((d) => d.id)
    setSelectedIds(unpaid.length > 0 ? unpaid : projectDeals.map((d) => d.id))
  }, [selectedProjectId, projectDeals.length])

  const [developerName, setDeveloperName] = useState(
    selectedProject?.developer_en || 'Developer Finance & Broker Relations'
  )
  useEffect(() => {
    setDeveloperName(selectedProject?.developer_en || 'Developer Finance & Broker Relations')
  }, [selectedProject])

  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('Asaheeb Real Estate')
  const [iban, setIban] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [claimNote, setClaimNote] = useState(
    'Kindly process the consolidated brokerage commission transfer for the closed units listed above to the bank account below and share the transfer confirmation.'
  )
  const [receiptNote, setReceiptNote] = useState(
    'Thank you for your continued partnership. This consolidated receipt acknowledges the commission payment(s) received to date against the referenced units.'
  )
  const [markingSent, setMarkingSent] = useState(false)
  const [sentNotice, setSentNotice] = useState('')
  const printAreaRef = useRef<HTMLDivElement>(null)

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

  const selectedDeals = useMemo(
    () => projectDeals.filter((d) => selectedIds.includes(d.id)),
    [projectDeals, selectedIds]
  )

  const totals = useMemo(() => {
    let expected = 0
    let received = 0
    selectedDeals.forEach((d) => {
      expected += Number(d.commission_amount || 0)
      received += Number(d.developer_received_amount || 0)
    })
    return {
      expected,
      received,
      balance: Math.max(0, expected - received),
    }
  }, [selectedDeals])

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleMarkAllClaimSent() {
    if (selectedIds.length === 0) return
    setMarkingSent(true)
    try {
      const res = await fetch('/api/projects/commissions/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BATCH_MARK_CLAIM_SENT',
          commission_ids: selectedIds,
        }),
      })
      const data = await res.json()
      if (res.ok && data.commissions) {
        onBatchUpdated(data.commissions)
        setSentNotice(`Marked ${selectedIds.length} unit(s) as Claim Sent!`)
        setTimeout(() => setSentNotice(''), 3500)
      }
    } catch (err) {
      console.error('Failed to batch mark claims sent:', err)
    } finally {
      setMarkingSent(false)
    }
  }

  const refCode = `ASB-BATCH-${(selectedProject?.name_en || 'PRJ').replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase()}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`
  const todayStr = new Date().toISOString().split('T')[0]

  function handlePrint() {
    saveBankSettings()
    if (!printAreaRef.current) return
    const content = printAreaRef.current.innerHTML
    const printWin = window.open('', '_blank', 'width=950,height=1050')
    if (!printWin) {
      window.print()
      return
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docMode === 'CLAIM' ? 'Consolidated Commission Claim' : 'Consolidated Settlement Receipt'} - ${selectedProject?.name_en || ''}</title>
          <style>
            * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
            body { margin: 0; padding: 28px; color: #0F172A; background: #FFFFFF; }
            @media print {
              body { padding: 12px; }
              @page { size: A4; margin: 12mm; }
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
          maxWidth: 1020,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <FileText size={18} color="#1D4ED8" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
              Project-Wide Claim / Settlement Statement
            </span>

            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="form-select"
              style={{ width: 'auto', minWidth: 180, height: 32, fontSize: 12, fontWeight: 700 }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_en} ({commissions.filter((c) => c.project_id === p.id).length} deals)
                </option>
              ))}
            </select>

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
                Consolidated Claim
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
                Settlement Receipt
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {docMode === 'CLAIM' && (
              <button
                type="button"
                onClick={handleMarkAllClaimSent}
                disabled={markingSent || selectedIds.length === 0}
                className="btn btn-outline btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontWeight: 700,
                  color: '#059669',
                  borderColor: '#A7F3D0',
                  background: '#ECFDF5',
                }}
              >
                {markingSent ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                <span>Mark {selectedIds.length} Claimed</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              disabled={selectedIds.length === 0}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Printer size={14} /> Print / Save PDF ({selectedIds.length})
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

        {/* Settings Bar */}
        <div
          style={{
            padding: '10px 22px',
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
              Asaheeb Bank Name
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
              Company IBAN
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
              VAT / CR #
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
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>
              {docMode === 'CLAIM' ? 'Formal Claim Note (Printed on PDF)' : 'Formal Receipt Note (Printed on PDF)'}
            </label>
            <input
              type="text"
              value={docMode === 'CLAIM' ? claimNote : receiptNote}
              onChange={(e) => (docMode === 'CLAIM' ? setClaimNote(e.target.value) : setReceiptNote(e.target.value))}
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

        {/* Split Body: Left unit selector + Right A4 preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Left: Unit Selector */}
          <div style={{ borderRight: '1px solid #E2E8F0', background: '#FAFBFD', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                Select Units ({selectedIds.length}/{projectDeals.length})
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setSelectedIds(projectDeals.map((d) => d.id))}
                  style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  style={{ fontSize: 11, fontWeight: 700, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  None
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projectDeals.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#64748B' }}>
                  No deals recorded for this project yet.
                </div>
              ) : (
                projectDeals.map((d) => {
                  const checked = selectedIds.includes(d.id)
                  const st = d.developer_payment_status || 'PENDING'
                  const bal = Math.max(0, Number(d.commission_amount || 0) - Number(d.developer_received_amount || 0))
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleId(d.id)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: checked ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                        background: checked ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      {checked ? (
                        <CheckSquare size={15} color="#2563EB" style={{ marginTop: 2, flexShrink: 0 }} />
                      ) : (
                        <Square size={15} color="#94A3B8" style={{ marginTop: 2, flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{d.unit_name}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>
                          {d.buyer_name} · {d.sale_date}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, fontWeight: 700 }}>
                          <span style={{ color: st === 'RECEIVED' ? '#059669' : '#B45309' }}>
                            {st === 'RECEIVED' ? 'Received' : `Due: SAR ${bal.toLocaleString('en-US')}`}
                          </span>
                          {d.claim_sent_at && <span style={{ color: '#059669' }}>Claimed ✓</span>}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: A4 Printable Preview */}
          <div style={{ padding: 22, overflowY: 'auto', background: '#F1F5F9' }}>
            <div
              ref={printAreaRef}
              style={{
                maxWidth: 740,
                margin: '0 auto',
                background: '#FFFFFF',
                padding: '32px 36px',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '1px solid #E2E8F0',
              }}
            >
              {/* Letterhead */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>ASAHEEB REAL ESTATE</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF', marginTop: 2 }}>
                    العقارية · Brokerage &amp; Advisory
                  </div>
                  {vatNumber && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Registration / VAT: {vatNumber}</div>}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      background: docMode === 'CLAIM' ? '#EFF6FF' : '#ECFDF5',
                      color: docMode === 'CLAIM' ? '#1E40AF' : '#065F46',
                      border: `1px solid ${docMode === 'CLAIM' ? '#BFDBFE' : '#A7F3D0'}`,
                      textTransform: 'uppercase',
                    }}
                  >
                    {docMode === 'CLAIM' ? 'Consolidated Commission Claim' : 'Consolidated Settlement Receipt'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 6 }}>
                    <strong>Ref #:</strong> {refCode}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    <strong>Issue Date:</strong> {todayStr}
                  </div>
                </div>
              </div>

              {/* Project & Developer Info */}
              <div style={{ padding: 12, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: 18, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    {docMode === 'CLAIM' ? 'Billed To (Developer)' : 'Received From (Developer)'}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{developerName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Project</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1E40AF', marginTop: 2 }}>
                    {selectedProject?.name_en || '—'} ({selectedDeals.length} Units)
                  </div>
                </div>
              </div>

              {/* Itemized Units Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10.5 }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10.5 }}>Sale Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10.5 }}>Unit / Layout</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10.5 }}>Buyer</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10.5 }}>Commission</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10.5 }}>Received</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10.5 }}>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDeals.map((d, i) => {
                    const exp = Number(d.commission_amount || 0)
                    const rec = Number(d.developer_received_amount || 0)
                    const bal = Math.max(0, exp - rec)
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '8px 10px', color: '#64748B' }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{d.sale_date}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{d.unit_name}</td>
                        <td style={{ padding: '8px 10px' }}>{d.buyer_name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>SAR {exp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669' }}>SAR {rec.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>SAR {bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: docMode === 'CLAIM' ? '#EFF6FF' : '#ECFDF5', fontWeight: 900 }}>
                    <td colSpan={4} style={{ padding: '10px 10px', fontSize: 12.5 }}>
                      GRAND TOTAL ({selectedDeals.length} Units)
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      SAR {totals.expected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', color: '#059669' }}>
                      SAR {totals.received.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 13.5, color: totals.balance > 0 ? '#1E40AF' : '#059669' }}>
                      SAR {totals.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Bank Details */}
              {(bankName || iban) && (
                <div style={{ padding: 12, borderRadius: 8, background: '#F8FAFC', border: '1px solid #CBD5E1', marginBottom: 16 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Building2 size={12} /> Remittance / Bank Account Details
                  </div>
                  <div style={{ fontSize: 12, color: '#0F172A', lineHeight: 1.5 }}>
                    <div><strong>Beneficiary:</strong> {accountName || 'Asaheeb Real Estate'}</div>
                    {bankName && <div><strong>Bank:</strong> {bankName}</div>}
                    {iban && <div><strong>IBAN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{iban}</span></div>}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.55, marginBottom: 22 }}>
                {docMode === 'CLAIM' ? claimNote : receiptNote}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px dashed #CBD5E1', fontSize: 11, color: '#64748B' }}>
                <div>Authorized Signature — Asaheeb Real Estate</div>
                <div>Generated from Asaheeb CRM · {todayStr}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
