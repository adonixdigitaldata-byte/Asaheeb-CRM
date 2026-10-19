'use client'

import React, { useState } from 'react'
import {
  X,
  Save,
  Building2,
  FileCheck,
  Shield,
  Calendar,
  AlertCircle,
  Percent,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import type { EmployeeContract } from '@/types/contract'
import type { Profile } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
  contract: EmployeeContract
  profile: Profile
  onSuccess: (updated: EmployeeContract) => void
}

export default function EditContractModal({
  isOpen,
  onClose,
  contract,
  profile,
  onSuccess,
}: Props) {
  const [form, setForm] = useState<EmployeeContract>({ ...contract })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const isChannelPartner = form.contract_type === 'CHANNEL_PARTNER'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save contract terms')
      }

      onSuccess(data.contract || form)
      onClose()
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving contract terms')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        overflowY: 'auto',
      }}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col my-auto"
        style={{
          maxHeight: '92vh',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Edit Contract &amp; Paperwork Variables
              </h2>
              <div className="text-xs text-slate-500">
                Customizing legal agreement for <strong>{profile.name}</strong> ({profile.role})
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {error && (
            <div
              className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Agreement Class & Status */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Agreement Classification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label text-xs">Contract Type</label>
                <select
                  value={form.contract_type}
                  onChange={(e) =>
                    setForm({ ...form, contract_type: e.target.value as any })
                  }
                  className="form-select text-xs"
                >
                  <option value="INTERNAL_SALES">Internal Sales Contract (Employees)</option>
                  <option value="CHANNEL_PARTNER">Channel Partner Agreement (External)</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Agreement Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as any })
                  }
                  className="form-select text-xs"
                >
                  <option value="ACTIVE">Active &amp; Enforced</option>
                  <option value="DRAFT">Draft</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">National ID / Iqama / Passport</label>
                <input
                  type="text"
                  value={form.national_id_iqama || ''}
                  onChange={(e) =>
                    setForm({ ...form, national_id_iqama: e.target.value })
                  }
                  placeholder="e.g. 2489012345"
                  className="form-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Role & Dates */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Role &amp; Timeframe
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="form-label text-xs">Official Designation / Title</label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="e.g. Senior Sales Specialist"
                  className="form-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="form-label text-xs">Department</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Sales & Acquisitions"
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Contract Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="form-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="form-label text-xs">End Date (Optional)</label>
                <input
                  type="date"
                  value={form.end_date || ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value || null })}
                  className="form-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Compensation & Commission Matrix */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Compensation &amp; Commission Scheme
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {!isChannelPartner && (
                <>
                  <div>
                    <label className="form-label text-xs">Base Salary (SAR / Month)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.base_salary}
                      onChange={(e) =>
                        setForm({ ...form, base_salary: parseFloat(e.target.value) || 0 })
                      }
                      className="form-input text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs">Housing Allowance (SAR)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.housing_allowance}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          housing_allowance: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="form-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs">Transport Allowance (SAR)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.transport_allowance}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          transport_allowance: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="form-input text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="form-label text-xs">Commission Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={form.commission_rate_pct}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        commission_rate_pct: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="form-input text-xs font-bold text-emerald-700 pr-7"
                    required
                  />
                  <Percent
                    size={13}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="form-label text-xs">Monthly Sales Target / Threshold (SAR)</label>
                <input
                  type="number"
                  step="any"
                  value={form.monthly_target_sar}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthly_target_sar: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Notice Period (Days)</label>
                <input
                  type="number"
                  value={form.notice_period_days}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      notice_period_days: parseInt(e.target.value, 10) || 30,
                    })
                  }
                  className="form-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Channel Partner Specific Information (When Applicable) */}
          {isChannelPartner && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">
                Channel Partner &amp; Brokerage Legal Entity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label text-xs">Brokerage / Firm Name</label>
                  <input
                    type="text"
                    value={form.brokerage_firm_name || ''}
                    onChange={(e) =>
                      setForm({ ...form, brokerage_firm_name: e.target.value })
                    }
                    placeholder="e.g. Al-Fursan Real Estate Advisory"
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label text-xs">Commercial Registration (CR No.)</label>
                  <input
                    type="text"
                    value={form.cr_number || ''}
                    onChange={(e) => setForm({ ...form, cr_number: e.target.value })}
                    placeholder="e.g. 1010992341"
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label text-xs">REGA Fal License No. (رخصة فال)</label>
                  <input
                    type="text"
                    value={form.fal_license_no || ''}
                    onChange={(e) =>
                      setForm({ ...form, fal_license_no: e.target.value })
                    }
                    placeholder="e.g. 1200034981"
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label text-xs">VAT Tax Registration</label>
                  <input
                    type="text"
                    value={form.vat_number || ''}
                    onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                    placeholder="e.g. 300129384700003"
                    className="form-input text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Terms & Conditions */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Payment Terms &amp; Special Clauses
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="form-label text-xs">Disbursement / Settlement Terms</label>
                <input
                  type="text"
                  value={form.payment_terms || ''}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  placeholder="e.g. Net 15 days upon developer commission clearance"
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Special Agreed Clauses (Custom Terms)</label>
                <textarea
                  rows={2}
                  value={form.custom_terms || ''}
                  onChange={(e) => setForm({ ...form, custom_terms: e.target.value })}
                  placeholder="Any extra covenants, project territory exclusivity, or specific performance conditions..."
                  className="form-textarea text-xs"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              style={{ fontWeight: 700 }}
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save & Update Contract'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
