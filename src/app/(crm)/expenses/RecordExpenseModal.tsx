'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, AlertCircle, FileText, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react'
import { Expense, ExpenseCategory } from '@/types/expense'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => Promise<void>
  initialData?: Expense | null
}

const CATEGORIES: ExpenseCategory[] = [
  'Office Expenses',
  'Fuel & Fleet',
  'Payroll & Broker Splits',
  'Portals & Digital Ads',
  'VIP & Investor Hospitality',
  'Government, REGA & Balady',
  'Utilities & Telecom',
  'IT & Software Tools',
  'Legal & Professional',
  'Miscellaneous',
]

const COST_CENTERS = [
  'Jeddah HQ',
  'Marketing & Lead Gen',
  'Sales & Client Relations',
  'Executive & Investment',
  'Compliance & Legal',
  'General Brokerage',
  'Executive Fleet',
]

const PAYMENT_METHODS = [
  'Corporate Card',
  'Bank Transfer (WPS/Corporate)',
  'SADAD Payment',
  'Mada Card',
  'Cash / Petty Cash',
  'Company Cheque',
]

export default function RecordExpenseModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: Props) {

  const [title, setTitle] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Office Expenses')
  const [amount, setAmount] = useState<string>('')
  const [includeVat, setIncludeVat] = useState(true)
  const [vatRate, setVatRate] = useState<number>(15)
  const [calculatedVat, setCalculatedVat] = useState<number>(0)
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [vendorPayee, setVendorPayee] = useState('')
  const [costCenter, setCostCenter] = useState(COST_CENTERS[0])
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [status, setStatus] = useState<'Paid' | 'Pending Approval' | 'Under Review'>('Paid')
  const [notes, setNotes] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [approvedBy, setApprovedBy] = useState('Admin')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [receiptFileName, setReceiptFileName] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Populate or reset form
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setReferenceNumber(initialData.reference_number)
      setCategory(initialData.category)
      setAmount(initialData.amount.toString())
      setIncludeVat((initialData.vat_amount || 0) > 0)
      setVatRate(initialData.vat_rate || 15)
      setCalculatedVat(initialData.vat_amount || 0)
      setExpenseDate(initialData.expense_date)
      setVendorPayee(initialData.vendor_payee)
      setCostCenter(initialData.cost_center)
      setPaymentMethod(initialData.payment_method)
      setStatus(initialData.status)
      setNotes(initialData.notes || '')
      setIsRecurring(initialData.is_recurring)
      setApprovedBy(initialData.approved_by || 'Admin')
      setReceiptUrl(initialData.receipt_url || '')
      setReceiptFileName(initialData.receipt_file_name || '')
    } else {
      const randomSuffix = Math.floor(100 + Math.random() * 900)
      setReferenceNumber(`EXP-2026-${randomSuffix}`)
      setTitle('')
      setCategory('Office Expenses')
      setAmount('')
      setIncludeVat(true)
      setVatRate(15)
      setCalculatedVat(0)
      setExpenseDate(new Date().toISOString().split('T')[0])
      setVendorPayee('')
      setCostCenter(COST_CENTERS[0])
      setPaymentMethod(PAYMENT_METHODS[0])
      setStatus('Paid')
      setNotes('')
      setIsRecurring(false)
      setApprovedBy('Admin')
      setReceiptUrl('')
      setReceiptFileName('')
    }
    setErrorMsg('')
  }, [initialData, isOpen])

  // Real-time Saudi 15% ZATCA VAT calculation
  useEffect(() => {
    const val = parseFloat(amount)
    if (!isNaN(val) && val > 0 && includeVat) {
      // VAT extracted from gross: val * (rate / (100 + rate))
      const vat = val * (vatRate / (100 + vatRate))
      setCalculatedVat(Math.round(vat * 100) / 100)
    } else {
      setCalculatedVat(0)
    }
  }, [amount, includeVat, vatRate])

  if (!isOpen) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0]
    if (!file) return

    setUploadingReceipt(true)
    setErrorMsg('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'asaheeb/expenses')

      const res = await fetch('/api/upload/cloudinary', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.url) {
        setReceiptUrl(data.url)
        setReceiptFileName(file.name)
      } else {
        // Fallback simulate attachment
        const mockUrl = URL.createObjectURL(file)
        setReceiptUrl(mockUrl)
        setReceiptFileName(file.name)
      }
    } catch {
      const mockUrl = URL.createObjectURL(file)
      setReceiptUrl(mockUrl)
      setReceiptFileName(file.name)
    } finally {
      setUploadingReceipt(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMsg('Please enter an expense title')
      return
    }
    if (!vendorPayee.trim()) {
      setErrorMsg('Please enter vendor or payee name')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0 SAR')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      await onSave({
        id: initialData?.id,
        reference_number: referenceNumber,
        title: title.trim(),
        category,
        amount: parseFloat(amount),
        currency: 'SAR',
        vat_amount: calculatedVat,
        vat_rate: includeVat ? vatRate : 0,
        expense_date: expenseDate,
        vendor_payee: vendorPayee.trim(),
        cost_center: costCenter as any,
        payment_method: paymentMethod as any,
        status,
        notes: notes.trim() || null,
        receipt_url: receiptUrl || null,
        receipt_file_name: receiptFileName || null,
        is_recurring: isRecurring,
        approved_by: approvedBy.trim() || 'Admin',
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record expense. Please verify details.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
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
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #0F172A, #1E293B)',
            color: '#FFFFFF',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(217, 119, 6, 0.25)',
                  color: '#FBBF24',
                }}
              >
                <Sparkles size={16} />
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                {initialData ? 'Edit Brokerage Expense' : 'Record Brokerage Expense'}
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', margin: 0 }}>
              Saudi Arabia Real Estate Operations · SAR (ريال سعودي) · 15% ZATCA VAT Compliant
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {errorMsg && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reference & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Reference Code
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Expense Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                }}
                required
              />
            </div>
          </div>

          {/* Title & Payee */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Expense Title / Description *
            </label>
            <input
              type="text"
              placeholder="e.g. Aqar Premium Listing Package or Jeddah HQ Deep Cleaning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
              }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Vendor / Payee Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Al Safwa FM, SEC, Aldrees, Aqar Portal"
                value={vendorPayee}
                onChange={(e) => setVendorPayee(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & 15% ZATCA VAT */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Total Gross Amount (SAR - ريال) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#64748B',
                    }}
                  >
                    SAR
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 48px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0F172A',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={includeVat}
                      onChange={(e) => setIncludeVat(e.target.checked)}
                      style={{ accentColor: '#4F46E5', width: '15px', height: '15px' }}
                    />
                    Include 15% ZATCA VAT
                  </label>
                  {includeVat && (
                    <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700, background: '#ECFDF5', padding: '1px 6px', borderRadius: '4px' }}>
                      Standard KSA
                    </span>
                  )}
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: includeVat ? '#EEF2FF' : '#F1F5F9',
                    border: '1px dashed #CBD5E1',
                    fontSize: '13px',
                    color: includeVat ? '#4338CA' : '#94A3B8',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>VAT Component:</span>
                  <strong style={{ fontSize: '14px' }}>{calculatedVat.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</strong>
                </div>
              </div>
            </div>
          </div>



          {/* Cost Center & Payment Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Cost Center / Department
              </label>
              <select
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {COST_CENTERS.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status & Recurring Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Accounting Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="Paid">Paid / Settled</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Under Review">Under Review</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                Recurrence
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#1E293B',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: isRecurring ? '#EEF2FF' : '#FFFFFF',
                }}
              >
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  style={{ accentColor: '#4F46E5', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: isRecurring ? 600 : 400 }}>Monthly Recurring Expense (WPS / Rent / Software)</span>
              </label>
            </div>
          </div>

          {/* Receipt Attachment */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Invoice / Receipt Document (PDF or Photo)
            </label>

            {receiptUrl ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {receiptUrl.startsWith('data:image') || receiptUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || !receiptFileName.toLowerCase().endsWith('.pdf') ? (
                    <img
                      src={receiptUrl}
                      alt="Receipt Preview"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '6px',
                        objectFit: 'cover',
                        border: '1px solid #E2E8F0',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '6px',
                        backgroundColor: '#EEF2FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4F46E5',
                      }}
                    >
                      <FileText size={22} />
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                      {receiptFileName || 'Uploaded Receipt'}
                    </div>
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#4F46E5',
                        fontWeight: 600,
                        marginTop: '2px',
                      }}
                    >
                      <ExternalLink size={12} /> View Full Attachment
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl('')
                    setReceiptFileName('')
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploadingReceipt}
                  style={{ fontSize: '12px' }}
                />
                {uploadingReceipt && <span style={{ fontSize: '12px', color: '#4F46E5' }}>Uploading...</span>}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Audit & Accounting Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. VAT Tax Invoice #9841 attached; for north Riyadh villa campaign"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #E2E8F0',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#4F46E5',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
              }}
            >
              {submitting ? 'Saving...' : initialData ? 'Update Record' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
