'use client'

import React, { useState, useEffect } from 'react'
import {
  FileCheck,
  Printer,
  Building2,
  Shield,
  Calendar,
  CheckCircle2,
  Award,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import type { Profile } from '@/types/database'
import type { EmployeeContract } from '@/types/contract'
import ContractViewModal from '@/components/contracts/ContractViewModal'
import { formatDate } from '@/lib/utils'

interface Props {
  profile: Profile
}

export default function PartnerContractClient({ profile }: Props) {
  const [contract, setContract] = useState<EmployeeContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)

  useEffect(() => {
    async function loadContract() {
      try {
        setLoading(true)
        const res = await fetch(`/api/contracts?profile_id=${profile.id}`)
        const data = await res.json()
        if (data.contract) {
          setContract(data.contract)
        }
      } catch (err) {
        console.error('Failed to load partner agreement:', err)
      } finally {
        setLoading(false)
      }
    }
    loadContract()
  }, [profile.id])

  return (
    <div className="page-container" style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Top Header */}
      <div
        style={{
          padding: '24px 32px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #FDE68A',
              }}
            >
              Partner Portal · Official Documents
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>• {profile.name}</span>
          </div>

          <h1
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0,
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
              }}
            >
              <FileCheck size={20} />
            </div>
            <span>Partnership &amp; Brokerage Agreement</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Official commercial representation terms, REGA brokerage agreement, and authorized commission splits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {contract && (
            <button
              type="button"
              onClick={() => setIsViewModalOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              style={{ fontWeight: 700, padding: '7px 16px' }}
            >
              <Printer size={14} />
              <span>View &amp; Print Agreement (PDF)</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div className="card text-center py-16">
            <Loader2 size={32} className="animate-spin text-amber-600 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-700">Loading your partnership agreement...</div>
          </div>
        ) : !contract ? (
          <div className="card text-center py-16">
            <p className="text-slate-500">No active agreement on file.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Agreement Status Banner */}
            <div
              style={{
                padding: '20px 24px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: '1.5px solid #FCD34D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#D97706',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#92400E' }}>
                      Active Commercial Channel Partner Agreement
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        backgroundColor: '#16A34A',
                        color: '#FFF',
                        padding: '2px 8px',
                        borderRadius: 9999,
                      }}
                    >
                      ENFORCED
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#B45309', marginTop: 2 }}>
                    Effective since {formatDate(contract.start_date)} · Governed under REGA Real Estate Brokerage Code of Saudi Arabia
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsViewModalOpen(true)}
                className="btn btn-sm"
                style={{
                  background: '#B45309',
                  color: '#FFF',
                  fontWeight: 700,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Printer size={14} />
                <span>Download / Print Official PDF</span>
              </button>
            </div>

            {/* Terms Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Approved Commission Split
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#059669', marginTop: 4 }}>
                  {contract.commission_rate_pct}%
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Direct cut per closed project deal
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  REGA Fal License / CR
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginTop: 6 }}>
                  {contract.fal_license_no || contract.cr_number || 'Verified on File'}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                  {contract.brokerage_firm_name || profile.name}
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Settlement &amp; Payout Terms
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginTop: 6, lineHeight: 1.4 }}>
                  {contract.payment_terms || 'Net 15 days upon developer settlement'}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4 }}>
                  Direct escrow bank transfer
                </div>
              </div>
            </div>

            {/* Click to open full document view */}
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                View Full Bilingual Agreement
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', maxWidth: 540, margin: '0 auto 16px auto' }}>
                Click below to open the complete multi-page contract document with official company header, legal clauses, confidentiality terms, and signature seal blocks.
              </p>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(true)}
                className="btn btn-outline"
                style={{ fontWeight: 700 }}
              >
                📄 Open Complete Agreement Viewer
              </button>
            </div>
          </div>
        )}
      </div>

      {contract && (
        <ContractViewModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          contract={contract}
          profile={profile}
          canEdit={false}
        />
      )}
    </div>
  )
}
