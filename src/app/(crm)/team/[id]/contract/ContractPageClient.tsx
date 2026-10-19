'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import {
  FileCheck,
  Printer,
  ArrowLeft,
  Edit3,
  Eye,
  CheckCircle2,
  Building2,
  Shield,
  Calendar,
  AlertCircle,
  Save,
  Loader2,
  User,
  Percent,
  Clock,
  Sparkles,
  Phone,
  Mail,
} from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Profile } from '@/types/database'
import type { EmployeeContract } from '@/types/contract'

interface Props {
  currentProfile: Profile
  member: Profile
  initialContract: EmployeeContract
  backUrl?: string
  backLabel?: string
  isPartnerPortalView?: boolean
}

export default function ContractPageClient({
  currentProfile,
  member,
  initialContract,
  backUrl,
  backLabel,
  isPartnerPortalView = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view')
  const [contract, setContract] = useState<EmployeeContract>(initialContract)
  const [form, setForm] = useState<EmployeeContract>(initialContract)
  const [memberPhone, setMemberPhone] = useState(member.phone || '')
  const [memberEmail, setMemberEmail] = useState(member.email || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState('')

  const printAreaRef = useRef<HTMLDivElement>(null)

  const isAdmin = currentProfile.role === 'ADMIN'
  const isManagerOrAdmin = isAdmin || currentProfile.role === 'SALES_MANAGER'
  const isChannelPartner = contract.contract_type === 'CHANNEL_PARTNER'

  const isStaffRole =
    currentProfile.role === 'EMPLOYEE' ||
    currentProfile.role === 'AGENT' ||
    currentProfile.role === 'SALES_MANAGER' ||
    currentProfile.role === 'CHANNEL_PARTNER'

  // Determine back navigation link
  const defaultFallbackUrl =
    currentProfile.role === 'ADMIN'
      ? '/team'
      : currentProfile.role === 'CHANNEL_PARTNER' || isPartnerPortalView
      ? '/dashboard'
      : '/payslips'

  const defaultFallbackLabel =
    currentProfile.role === 'ADMIN'
      ? 'Team Directory'
      : currentProfile.role === 'CHANNEL_PARTNER' || isPartnerPortalView
      ? 'Dashboard'
      : 'My Payslips'

  const computedBackUrl = backUrl || defaultFallbackUrl
  const computedBackLabel = backLabel || defaultFallbackLabel

  const handlePrint = () => {
    window.print()
  }

  const handleSaveTerms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      setError('Only Admins can update contract terms')
      return
    }
    setSaving(true)
    setError('')
    setSuccessToast('')

    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: memberPhone,
          email: memberEmail,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save contract terms')
      }

      const updated = data.contract || form
      setContract(updated)
      setForm(updated)
      if (data.profile) {
        if (data.profile.phone !== undefined) setMemberPhone(data.profile.phone || '')
        if (data.profile.email !== undefined) setMemberEmail(data.profile.email || '')
      }
      setSuccessToast('Contract terms and contact details saved successfully!')
      setActiveTab('view')
      setTimeout(() => setSuccessToast(''), 4000)
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving contract')
    } finally {
      setSaving(false)
    }
  }

  const totalMonthlyCompensation =
    (Number(contract.base_salary) || 0) +
    (Number(contract.housing_allowance) || 0) +
    (Number(contract.transport_allowance) || 0)

  return (
    <div className="page-container" style={{ minHeight: '100vh', backgroundColor: '#F1F5F9', paddingBottom: 60 }}>
      {/* Explicit Print Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 15mm;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                font-size: 10.5pt !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .app-shell,
              .main-content,
              .page-container {
                display: block !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                border: none !important;
                box-shadow: none !important;
                background: #ffffff !important;
              }
              .sidebar,
              aside,
              header,
              .crm-mobile-header,
              .no-print,
              .page-header-wrapper,
              .mobile-close-btn,
              button,
              .btn,
              nav {
                display: none !important;
              }
              .contract-paper {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                background: #ffffff !important;
              }
              .clause-block {
                margin-bottom: 13px !important;
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
              .clause-block p,
              .clause-block div {
                orphans: 4 !important;
                widows: 4 !important;
              }
              .signatures-block {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin-top: 18px !important;
              }
            }
          `,
        }}
      />

      {/* Top Header & Breadcrumbs (Hidden when printing) */}
      <div
        className="no-print page-header-wrapper"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '18px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Breadcrumb Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748B', marginBottom: 12 }}>
            <Link
              href={computedBackUrl}
              style={{
                color: '#1E3A8A',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} /> {computedBackLabel}
            </Link>
            <span>/</span>
            {!isPartnerPortalView && !isStaffRole && (
              <>
                <Link
                  href={`/team/${member.id}`}
                  style={{ color: '#475569', fontWeight: 600, textDecoration: 'none' }}
                >
                  {member.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span style={{ color: '#0F172A', fontWeight: 700 }}>
              {isChannelPartner ? 'Channel Partner Agreement' : 'Sales Contract'}
            </span>
          </div>

          {/* Member Banner & Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: isChannelPartner
                    ? 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
                    : 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                }}
              >
                {member.name?.slice(0, 2).toUpperCase() || 'AS'}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {member.name}
                  </h1>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: isChannelPartner ? '#FEF3C7' : '#EFF6FF',
                      color: isChannelPartner ? '#92400E' : '#1D4ED8',
                      border: isChannelPartner ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                    }}
                  >
                    {isChannelPartner ? 'Channel Partner' : member.role}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: contract.status === 'ACTIVE' ? '#F0FDF4' : '#FEF2F2',
                      color: contract.status === 'ACTIVE' ? '#166534' : '#991B1B',
                      border: contract.status === 'ACTIVE' ? '1px solid #BBF7D0' : '1px solid #FECACA',
                    }}
                  >
                    {contract.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {contract.designation || member.specialization || 'Real Estate Specialist'} &bull; {memberEmail}
                </div>
              </div>
            </div>

            {/* Actions: Tab Switcher & Print Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Tab Switcher (Visible to Admins only) */}
              {isAdmin && !isPartnerPortalView && (
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: '#F1F5F9',
                    padding: 3,
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('view')}
                    style={{
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: activeTab === 'view' ? '#FFFFFF' : 'transparent',
                      color: activeTab === 'view' ? '#0F172A' : '#64748B',
                      boxShadow: activeTab === 'view' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Eye size={14} /> View Document
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    style={{
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: activeTab === 'edit' ? '#FFFFFF' : 'transparent',
                      color: activeTab === 'edit' ? '#1E3A8A' : '#64748B',
                      boxShadow: activeTab === 'edit' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Edit3 size={14} /> Edit Terms &amp; Variables
                  </button>
                </div>
              )}

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  backgroundColor: '#1E3A8A',
                  borderColor: '#1E3A8A',
                }}
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div
          className="no-print"
          style={{
            maxWidth: 1100,
            margin: '16px auto 0',
            padding: '12px 18px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 10,
            color: '#065F46',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Container */}
      <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px' }}>
        {/* ========================================================================= */}
        {/* TAB 1: VIEW CONTRACT (OFFICIAL DOCUMENT)                                 */}
        {/* ========================================================================= */}
        {activeTab === 'view' && (
          <div
            ref={printAreaRef}
            className="contract-paper"
            style={{
              maxWidth: 860,
              margin: '0 auto',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              boxShadow: '0 6px 24px rgba(0,0,0,0.05)',
              padding: '24px 32px',
              color: '#0F172A',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {/* Document Header with Logo & Reg Info */}
            <div
              className="clause-block"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                borderBottom: '2px solid #0F172A',
                paddingBottom: 10,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: '#1E3A8A',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 16,
                    }}
                  >
                    A
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.03em', color: '#0F172A' }}>
                      ASAHEEB &amp; ADONIX DEVELOPMENTS CO.
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#B45309' }}>
                      شركة اساهيب وأدونيكس للتطوير — المملكة العربية السعودية
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', lineHeight: 1.35 }}>
                  CR / Unified No.: 7055349166 &bull; VAT: 315081325900003 &bull; REGA Certified Brokerage Practitioner &bull; Al Muruj, Riyadh 12281, KSA
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: 5,
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: '#334155',
                  }}
                >
                  REF #{contract.id ? contract.id.slice(0, 12).toUpperCase() : 'ASB-2026-CTR'}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 3 }}>
                  Date: {contract.start_date ? formatDate(contract.start_date) : formatDate(new Date().toISOString())}
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div
              className="clause-block"
              style={{
                textAlign: 'center',
                padding: '8px 14px',
                backgroundColor: isChannelPartner ? '#FFFBEB' : '#EFF6FF',
                border: isChannelPartner ? '1.5px solid #FCD34D' : '1.5px solid #BFDBFE',
                borderRadius: 8,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isChannelPartner ? '#92400E' : '#1E3A8A',
                }}
              >
                {isChannelPartner
                  ? 'COMMERCIAL CHANNEL PARTNER & REAL ESTATE BROKERAGE AGREEMENT'
                  : 'EMPLOYMENT & SALES COMMISSION CONTRACT'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isChannelPartner ? '#B45309' : '#2563EB',
                  marginTop: 2,
                }}
              >
                {isChannelPartner
                  ? 'عقد وساطة وتسويق عقاري للشريك الخارجي المعتمد'
                  : 'عقد عمل ومستحقات وعمولات مبيعات عقارية'}
              </div>
            </div>

            {/* ============================================================= */}
            {/* CLAUSE 1: PARTIES                                             */}
            {/* ============================================================= */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 4,
                  marginBottom: 8,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                1. CONTRACTING PARTIES (أطراف العقد)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* First Party */}
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                    fontSize: 11.5,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>
                    First Party (الطرف الأول):
                  </div>
                  <strong>Asaheeb and Adonix Developments Company (شركة اساهيب وأدونيكس للتطوير)</strong>, a commercial entity organized and existing under the laws of the Kingdom of Saudi Arabia, Unified Number / Commercial Registration No. <strong>7055349166</strong>, VAT Registration No. <strong>315081325900003</strong> (TIN: 3150813259), REGA Certified Real Estate Brokerage Practitioner, with principal registered headquarters at Al Muruj Dist., Riyadh 12281, Kingdom of Saudi Arabia (hereinafter referred to as the <em>"Company"</em> or <em>"First Party"</em>).
                </div>

                {/* Second Party */}
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                    fontSize: 11.5,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>
                    Second Party (الطرف الثاني):
                  </div>
                  <strong>{member.name}</strong>
                  {contract.brokerage_firm_name && (
                    <div>Entity / Brokerage: <strong>{contract.brokerage_firm_name}</strong></div>
                  )}
                  <div>
                    National ID / Iqama / Passport: <strong>{contract.national_id_iqama || 'On File'}</strong>
                  </div>
                  <div>
                    Phone: <strong>{memberPhone || 'On File'}</strong> &bull; Email: <strong>{memberEmail || member.email}</strong>
                  </div>
                  <div style={{ fontStyle: 'italic', color: '#64748B', marginTop: 2 }}>
                    (hereinafter referred to as the <em>"{isChannelPartner ? 'Channel Partner' : 'Employee'}"</em>).
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* CLAUSE 2: ENGAGEMENT & SCOPE                                  */}
            {/* ============================================================= */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 4,
                  marginBottom: 8,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                2. {isChannelPartner ? 'INDEPENDENT COMMERCIAL COLLABORATION & SCOPE (طبيعة التعاقد التجاري المستقل ونطاق العمل)' : 'APPOINTMENT & SCOPE OF EMPLOYMENT (المسمى الوظيفي ونطاق العمل)'}
              </div>

              <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                {isChannelPartner ? (
                  <>
                    The Company hereby engages the Second Party as an <strong>Independent External Channel Partner / Brokerage Affiliate</strong> within the <strong>{contract.department || 'External Channels'}</strong> network. The Second Party acts strictly as an independent third-party commercial partner to source, introduce, and market qualifying property buyers and transaction opportunities. The Second Party shall conduct all activities with professional diligence in strict conformity with Saudi Real Estate General Authority (REGA / فال) guidelines and applicable commercial regulations.
                  </>
                ) : (
                  <>
                    The Company hereby employs the Second Party to serve as{' '}
                    <strong style={{ color: '#0F172A' }}>{contract.designation || 'Real Estate Specialist'}</strong> within
                    the <strong>{contract.department || 'Sales'}</strong> division. The Second Party undertakes to devote
                    their full professional fidelity to perform real estate brokerage, client advisory, lead conversion,
                    and transaction facilitation duties with the highest standard of professional diligence and in strict
                    adherence to Company directives and Saudi Real Estate General Authority (REGA) guidelines.
                  </>
                )}
              </div>
            </div>

            {/* ============================================================= */}
            {/* CLAUSE 3: REMUNERATION & COMMISSION MATRIX                    */}
            {/* ============================================================= */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 4,
                  marginBottom: 8,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                3. FINANCIAL REMUNERATION &amp; COMMISSION MATRIX (المستحقات المالية وجدول العمولات)
              </div>

              {/* Remuneration cards/table */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  marginBottom: 8,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '7px 12px' }}>Item</th>
                      <th style={{ padding: '7px 12px' }}>Arabic Description</th>
                      <th style={{ padding: '7px 12px', textAlign: 'right' }}>Agreed Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!isChannelPartner && (
                      <>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 600 }}>Monthly Base Salary</td>
                          <td style={{ padding: '7px 12px', color: '#64748B' }}>الراتب الأساسي الشهري</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(contract.base_salary || 0)} SAR
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 600 }}>Housing Allowance</td>
                          <td style={{ padding: '7px 12px', color: '#64748B' }}>بدل السكن</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(contract.housing_allowance || 0)} SAR
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 600 }}>Transportation Allowance</td>
                          <td style={{ padding: '7px 12px', color: '#64748B' }}>بدل المواصلات</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(contract.transport_allowance || 0)} SAR
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 800 }}>Total Fixed Monthly Remuneration</td>
                          <td style={{ padding: '7px 12px', color: '#64748B', fontWeight: 700 }}>إجمالي الراتب الثابت</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#1E3A8A' }}>
                            {formatCurrency(totalMonthlyCompensation)} SAR
                          </td>
                        </tr>
                      </>
                    )}

                    <tr style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: '#F0FDF4' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 800, color: '#166534' }}>
                        Performance Commission Rate
                      </td>
                      <td style={{ padding: '7px 12px', color: '#166534' }}>نسبة العمولة البيعية المتفق عليها</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#166534', fontSize: 13 }}>
                        {contract.commission_rate_pct}%
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: '7px 12px', fontWeight: 600 }}>
                        {isChannelPartner ? 'Minimum Volume Threshold' : 'Monthly Sales Quota Target (X)'}
                      </td>
                      <td style={{ padding: '7px 12px', color: '#64748B' }}>المستهدف البيعي الشهري</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>
                        {contract.monthly_target_sar && contract.monthly_target_sar > 0
                          ? `${formatCurrency(contract.monthly_target_sar)} SAR`
                          : 'Nil / From 1st Deal'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4 }}>
                <em>Formula Applied:</em> Commission is calculated on cleared deal volume according to company policy.
                Disbursement is processed in accordance with Clause 5 upon successful registration and payment clearance.
              </div>
            </div>

            {/* ============================================================= */}
            {/* CLAUSE 4: REGULATORY & BROKER CREDENTIALS (CHANNEL PARTNER)   */}
            {/* ============================================================= */}
            {isChannelPartner && (
              <div className="clause-block" style={{ marginBottom: 14 }}>
                <div
                  className="clause-title"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#1E3A8A',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: 4,
                    marginBottom: 8,
                    breakAfter: 'avoid',
                    pageBreakAfter: 'avoid',
                  }}
                >
                  4. BROKERAGE REGISTRATION &amp; COMPLIANCE (التراخيص والامتثال النظامي)
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    backgroundColor: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11.5,
                  }}
                >
                  <div>
                    <div style={{ color: '#92400E', fontWeight: 700 }}>Commercial Registration (CR)</div>
                    <div style={{ fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                      {contract.cr_number || 'Registered on file'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#92400E', fontWeight: 700 }}>REGA Fal License (رخصة فال)</div>
                    <div style={{ fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                      {contract.fal_license_no || 'Certified Broker'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#92400E', fontWeight: 700 }}>VAT Tax Number (الرقم الضريبي)</div>
                    <div style={{ fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                      {contract.vat_number || 'Standard Entity'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* CLAUSE 5: PAYMENT TERMS & SETTLEMENT                         */}
            {/* ============================================================= */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 4,
                  marginBottom: 8,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                {isChannelPartner ? '5' : '4'}. PAYMENT TERMS &amp; SETTLEMENT (شروط الصرف والسداد)
              </div>

              <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                {contract.payment_terms ||
                  (isChannelPartner
                    ? 'Commissions disbursed within 5 business days upon title deed conveyance and full receipt of client funds.'
                    : 'Commissions processed with monthly payroll cycle following closed transaction clearance.')}
              </div>
            </div>

            {/* ============================================================= */}
            {/* CLAUSE 6: TERM, PROBATION & TERMINATION                      */}
            {/* ============================================================= */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 4,
                  marginBottom: 8,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                {isChannelPartner ? '6' : '5'}. TERM &amp; TERMINATION (سريان العقد وإنهاؤه)
              </div>

              <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                This agreement commences on <strong>{contract.start_date ? formatDate(contract.start_date) : 'Execution Date'}</strong>
                {contract.end_date ? ` and terminates on ${formatDate(contract.end_date)}.` : ' for an indefinite renewable duration.'}
                {!isChannelPartner && (
                  <> A statutory probation period of <strong>{contract.probation_months || 3} months</strong> applies.</>
                )}
                {' '}Either party may terminate this agreement by providing a written notice of at least{' '}
                <strong>{contract.notice_period_days || 30} days</strong>.
              </div>
            </div>

            {/* ============================================================= */}
            {/* CLAUSE 7: CONFIDENTIALITY & NON-DISCLOSURE                   */}
            {/* ============================================================= */}
            <div className="clause-block" style={{ marginBottom: 14 }}>
              <div
                className="clause-title"
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#1E3A8A',
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 4,
                  marginBottom: 8,
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                {isChannelPartner ? '7' : '6'}. CONFIDENTIALITY &amp; CRM DATA PROTECTION (السرية والمحافظة على البيانات)
              </div>

              <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                The Second Party strictly agrees to protect and maintain confidential all Asaheeb CRM client leads,
                inquiries, valuations, financial structures, property inventory, and pricing negotiations. Any unauthorized
                disclosure, lead poaching, or export of client records without written authorization is strictly prohibited
                and constitutes grounds for immediate legal liability and damages under the applicable laws of Saudi Arabia.
              </div>
            </div>

            {/* ============================================================= */}
            {/* CLAUSES FOR EMPLOYEE VS CHANNEL PARTNER                       */}
            {/* ============================================================= */}
            {!isChannelPartner ? (
              <>
                {/* EMPLOYEE CLAUSE: NON-COMPETITION & 2-YEAR RESTRAINT (SAUDI LABOR LAW ART. 83) */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#1E3A8A',
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 4,
                      marginBottom: 8,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    7. NON-COMPETITION &amp; 2-YEAR RESTRAINT OF TRADE (حظر المنافسة لمدة سنتين بموجب المادة 83 من نظام العمل)
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>A. Non-Competition Undertaking (Article 83, Saudi Labor Law):</strong> In consideration of employment, confidential proprietary developer networks, client pipeline, and commission remuneration provided by the Company, the Second Party covenants and agrees that throughout the term of this contract and for a period of <strong>two (2) full calendar years</strong> following resignation, termination, or cessation of employment for any reason, the Second Party shall <strong>NOT</strong> engage in, conduct, advise, broker, or perform any real estate sales, leasing, or brokerage activities outside of the Company—whether acting independently for their own account, under an individual license, or for any competing real estate brokerage, developer, or commercial entity within the Kingdom of Saudi Arabia.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>B. Legal Recourse &amp; Judicial Enforcement:</strong> In the event the Second Party engages in real estate activities outside this contract during employment or within the statutory two-year post-contractual period pursuant to Article 83 of the Saudi Labor Law, the Company reserves the absolute legal right to take the Second Party directly to court and initiate judicial proceedings before the competent Saudi courts to enforce compliance, demand full financial restitution, forfeit all unpaid commissions, and seek maximum judicial damages under applicable laws.
                    </p>
                    <div style={{ padding: '6px 10px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 11, color: '#475569' }}>
                      <em>نص البند بالعربية (وفقاً للمادة 83 من نظام العمل السعودي):</em> يقر ويتعهد الطرف الثاني بأنه نظراً لعمله في المجال العقاري واطلاعه على أسرار العمل وعملاء الشركة وموافقته على شروط العقد ونظام الرواتب والعمولات، فإنه يُحظر عليه حظراً تاماً ممارسة أي نشاط عقاري أو وساطة أو تسويق أو تقديم استشارات عقارية خارج نطاق الشركة، سواء لحسابه الخاص أو لصالح أي جهة منافسة داخل المملكة، وذلك طوال فترة سريان العقد ولمدة سنتين (٢) كاملتين تلي انتهاء أو إنهاء علاقة العمل لأي سبب كان. وفي حال ثبوت قيام الطرف الثاني بأي نشاط عقاري خارج هذا العقد أو خلال فترة السنتين المذكورة، فإن للشركة الحق القانوني الكامل في مقاضاته وملاحقته قضائياً أمام المحاكم والجهات المختصة للمطالبة بالتعويضات المالية ومصادرة كافة المستحقات والعمولات.
                    </div>
                  </div>
                </div>

                {/* EMPLOYEE CLAUSE: CLIENT & DEVELOPER EXCLUSIVITY */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#1E3A8A',
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 4,
                      marginBottom: 8,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    8. CLIENT &amp; DEVELOPER EXCLUSIVITY — PROHIBITION OF DIRECT CLOSINGS (حصرية العملاء والمطورين وحظر التعاقد المباشر)
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>A. Fiduciary Trust &amp; Good Faith:</strong> This contract is founded upon mutual trust, loyalty, and good faith. The Company places its trust, client relationships, marketing resources, and commercial portfolio in the Second Party, and the Second Party commits full fidelity to the Company.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>B. Absolute Prohibition of Direct Dealings:</strong> The Second Party is strictly prohibited from bypassing, circumverting, or closing real estate transactions directly with property developers, project owners, asset managers, or clients. Under no circumstances may the Second Party enter into direct agency, sales, or advisory agreements with developers outside of the Company.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>C. Mandatory Corporate Routing:</strong> Anything and everything conducted by the Second Party—including client leads, inquiries, site visits, reservations, negotiations, and sales closings—MUST happen exclusively through the Company, under the Company profile, under the Company portfolio, and recorded within the Asaheeb CRM platform.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>D. Sanctions for Breach:</strong> Any attempt to close deals outside the company, deal directly with developers, divert client leads, or conceal commissions constitutes a gross breach of fiduciary trust under Article 80 of the Saudi Labor Law. Such breach results in immediate summary termination without notice or end-of-service benefits, total forfeiture of accrued commissions, refund of all diverted funds, and immediate legal prosecution before the competent judicial courts.
                    </p>
                    <div style={{ padding: '6px 10px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 11, color: '#475569' }}>
                      <em>نص البند بالعربية:</em> يقوم هذا العقد على أساس الأمانة والثقة المتبادلة. ويُحظر على الطرف الثاني حظراً قاطعاً ومطلقاً إتمام أو إغلاق أي صفقات بيع أو شراء أو وساطة عقارية مباشرة مع المطورين العقاريين أو ملاك المشاريع أو العملاء خارج مظلة الشركة. ويجب أن تمر وتتم كافة الأنشطة والصفقات والمراسلات حصراً عبر ملف الشركة الرسمي ومحفظتها الاستثمارية ومنظومة إدارة علاقات العملاء (CRM). وتعد أي محاولة للتعامل المباشر مع المطورين أو العملاء أو الالتفاف على الشركة خيانة للأمانة توجب الفصل الفوري دون مكافأة أو إشعار وفقاً للمادة 80 من نظام العمل، ومصادرة كافة العمولات، وإحالة المخالف للمحاكمة القضائية للمطالبة بكافة التعويضات.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* CHANNEL PARTNER CLAUSE: INDEPENDENT THIRD-PARTY CONTRACTOR STATUS */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#1E3A8A',
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 4,
                      marginBottom: 8,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    8. INDEPENDENT THIRD-PARTY CONTRACTOR STATUS (الصفة كطرف ثالث مستقل وعدم وجود علاقة عمل)
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>A. Independent Commercial Partner:</strong> The parties expressly acknowledge and agree that the Second Party is engaged strictly as an independent third-party commercial collaborator / external channel partner, and NOT as an employee, agent, or legal partner of the Company. Nothing contained herein shall be deemed or construed to create an employment relationship, employer-employee dependency, or statutory labor contract under Saudi Labor Law.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>B. Exclusion of Labor Benefits &amp; Wage Guarantees:</strong> As an independent external entity, the Second Party has no entitlement to monthly salaries, overtime, medical health insurance, annual leave allowances, end-of-service gratuities, or any statutory benefits provided to employees under Saudi Labor Regulations. Compensation is strictly limited to commissions earned on successfully closed transactions as defined herein.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>C. Operational Autonomy &amp; Fiscal Compliance:</strong> The Second Party operates independently, determines their own working arrangements, and is solely responsible for maintaining their valid REGA Fal brokerage licenses, commercial registrations (CR), and tax obligations (including ZATCA / VAT compliance).
                    </p>
                    <div style={{ padding: '6px 10px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 11, color: '#475569' }}>
                      <em>نص البند بالعربية:</em> يقر الطرفان بصورة قاطعة بأن هذا العقد هو عقد تعاون تجاري مستقل بين جهتين تجاريتين مستقلتين، ولا يُعد الطرف الثاني بأي حال من الأحوال موظفاً أو تابعاً أو وكيلاً للشركة، ولا تنشأ بموجبه أي علاقة عمل خاضعة لنظام العمل السعودي. ولا يحق للطرف الثاني المطالبة بأي رواتب شهرية أو بدلات أو مكافأة نهاية خدمة أو تأمين طبي أو تعويضات عمالية، ويكون مسؤولاً استقلالاً وتاماً عن كافة نفقاته وتراخيصه (رخصة فال) والتزاماته الضريبية أمام هيئة الزكاة والضريبة والجمارك (ZATCA).
                    </div>
                  </div>
                </div>

                {/* CHANNEL PARTNER CLAUSE: PROJECT NON-CIRCUMVENTION & DEAL PROTECTION */}
                <div className="clause-block" style={{ marginBottom: 14 }}>
                  <div
                    className="clause-title"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#1E3A8A',
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 4,
                      marginBottom: 8,
                      breakAfter: 'avoid',
                      pageBreakAfter: 'avoid',
                    }}
                  >
                    9. PROJECT NON-CIRCUMVENTION &amp; DEAL PROTECTION (حظر الالتفاف وحماية صفقات ومشاريع الشركة)
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>A. Non-Circumvention of Asaheeb Portfolio:</strong> The Second Party covenants and agrees that they shall NOT bypass, circumvent, or directly or indirectly approach any property developer, master developer, project owner, or seller introduced, shared, or made accessible by or through the Company for the purpose of executing transactions outside this agreement.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>B. Mandatory CRM Lead Registration:</strong> To qualify for commission entitlement and full deal protection, all buyer introductions, reservations, client inquiries, and transaction negotiations involving Company projects MUST be registered and logged within the Asaheeb CRM platform prior to contract closure.
                    </p>
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>C. Liquidated Damages for Circumvention:</strong> In the event the Second Party circumvents the Company to close or broker any transaction directly or indirectly with a developer or project introduced by the Company—during the term of this agreement or within twenty-four (24) months following introduction—the Second Party shall be legally bound to pay the Company full liquidated damages equal to 100% of the gross brokerage commission generated, plus reimbursement of all legal fees and court expenses incurred.
                    </p>
                    <div style={{ padding: '6px 10px', backgroundColor: '#F8FAFC', borderLeft: '3px solid #1E3A8A', borderRadius: 4, fontSize: 11, color: '#475569' }}>
                      <em>نص البند بالعربية:</em> يتعهد شريك القنوات (الطرف الثاني) بعدم الالتفاف على الشركة أو تجاوزها للتعاقد المباشر مع أي مطور عقاري أو مالك مشروع تم تقديمه أو التعريف به عبر محفظة الشركة ومشاريعها. ويجب تسجيل وتوثيق كافة العملاء والصفقات عبر منصة Asaheeb CRM لضمان حماية الحقوق وصرف العمولات. وفي حال ثبوت قيام شريك القنوات بإتمام أي صفقة بالالتفاف على الشركة خلال مدة العقد أو خلال أربعة وعشرين (٢٤) شهراً من تاريخ التعريف بالمشروع، يلتزم الطرف الثاني بدفع كامل قيمة العمولة الإجمالية للشركة كتعويض اتفاقي ملزم، مع تحمله لكافة أتعاب التقاضي والمحاماة.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Custom Terms if any */}
            {contract.custom_terms && contract.custom_terms.trim() && (
              <div className="clause-block" style={{ marginBottom: 14 }}>
                <div
                  className="clause-title"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#1E3A8A',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: 4,
                    marginBottom: 8,
                    breakAfter: 'avoid',
                    pageBreakAfter: 'avoid',
                  }}
                >
                  SPECIAL CLAUSES (شروط وبنود خاصة)
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: '#334155',
                    backgroundColor: '#F8FAFC',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {contract.custom_terms}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* CLAUSE 8: SIGNATURES & OFFICIAL STAMP                         */}
            {/* ============================================================= */}
            <div
              className="signatures-block"
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: '2px dashed #CBD5E1',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20,
              }}
            >
              {/* First Party Signature Box */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>
                  FOR FIRST PARTY (الطرف الأول):
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A' }}>
                  Asaheeb and Adonix Developments Company
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 1 }}>
                  Executive Authorized Signatory — الإدارة العامة
                </div>

                <div
                  style={{
                    marginTop: 10,
                    height: 74,
                    border: '1px dashed #94A3B8',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  {/* Official Stamp Watermark */}
                  <div
                    style={{
                      border: '2px solid #1E3A8A',
                      borderRadius: '50%',
                      width: 68,
                      height: 68,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#1E3A8A',
                      fontSize: 7,
                      fontWeight: 900,
                      transform: 'rotate(-10deg)',
                      opacity: 0.88,
                      textAlign: 'center',
                      lineHeight: 1.15,
                    }}
                  >
                    <span>ASAHEEB &amp; ADONIX</span>
                    <span>★ SEAL ★</span>
                    <span>DEVELOPMENTS</span>
                  </div>
                </div>

                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>
                  Date: {formatDate(contract.signed_at || contract.start_date || new Date().toISOString())}
                </div>
              </div>

              {/* Second Party Signature Box — Certified Digital Signature & Legal Acknowledgment */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>
                  FOR SECOND PARTY (الطرف الثاني):
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A' }}>
                  {contract.signed_by_name || member.name}
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 1 }}>
                  {contract.designation || 'Signatory / Real Estate Executive'}
                </div>

                {/* Certified Digital Acknowledgment Badge (No Physical Sign Required) */}
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    border: '1.5px solid #10B981',
                    borderRadius: 8,
                    backgroundColor: '#F0FDF4',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={15} color="#059669" />
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Digitally Signed &amp; Legally Acknowledged
                      </span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#047857', backgroundColor: '#DCFCE7', padding: '1px 5px', borderRadius: 4 }}>
                      مُوقع ومُعتمد إلكترونياً
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '1px dashed #A7F3D0', paddingTop: 4, marginTop: 2 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#065F46' }}>
                        {contract.signed_by_name || member.name}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#047857' }}>
                        National ID / Iqama: {contract.national_id_iqama || 'Verified on File'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#059669' }}>
                        REF: AUTH-{contract.id ? contract.id.slice(0, 8).toUpperCase() : 'VERIFIED'}
                      </div>
                      <div style={{ fontSize: 9, color: '#047857' }}>
                        Date: {formatDate(contract.signed_at || contract.start_date || new Date().toISOString())}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 6, lineHeight: 1.4 }}>
                  ✓ Digitally acknowledged and authenticated via Asaheeb CRM portal under the Saudi Electronic Transactions Law (Royal Decree No. M/18). Binding and legally enforceable without requiring handwritten physical signature.
                  <br />
                  <span style={{ color: '#94A3B8' }}>(تم الإقرار والموافقة والتوقيع إلكترونياً بموجب نظام التعاملات الإلكترونية السعودي، ويُعد نافذاً وملزماً نظاماً وقانوناً دون الحاجة لتوقيع خطي).</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: EDIT CONTRACT TERMS & VARIABLES                                   */}
        {/* ========================================================================= */}
        {activeTab === 'edit' && isAdmin && !isPartnerPortalView && (
          <div
            style={{
              maxWidth: 900,
              margin: '0 auto',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 28px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Edit Contract Terms &amp; Financial Variables
                </h2>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  Changes will update official paperwork, contact details, commission matrix, and salary profiles.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('view')}
                className="btn btn-outline btn-sm"
                style={{ fontSize: 12 }}
              >
                Cancel &amp; Return to Preview
              </button>
            </div>

            {error && (
              <div
                style={{
                  margin: '16px 28px 0',
                  padding: '12px 16px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 8,
                  color: '#991B1B',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Edit Form */}
            <form onSubmit={handleSaveTerms} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Section 1: Classification & Contact Details */}
              <div
                style={{
                  padding: 18,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', marginBottom: 14 }}>
                  1. Agreement Classification &amp; Contact Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Contract Type</label>
                    <select
                      className="select"
                      style={{ width: '100%', height: 38 }}
                      value={form.contract_type}
                      onChange={(e) => setForm({ ...form, contract_type: e.target.value as any })}
                    >
                      <option value="INTERNAL_SALES">Internal Sales Contract (Staff)</option>
                      <option value="CHANNEL_PARTNER">Channel Partner Agreement (External)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Status</label>
                    <select
                      className="select"
                      style={{ width: '100%', height: 38 }}
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    >
                      <option value="ACTIVE">Active &amp; Enforced</option>
                      <option value="DRAFT">Draft</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="TERMINATED">Terminated</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>National ID / Iqama / Passport</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: 38 }}
                      placeholder="e.g. 2489012345"
                      value={form.national_id_iqama || ''}
                      onChange={(e) => setForm({ ...form, national_id_iqama: e.target.value })}
                    />
                  </div>
                </div>

                {/* Contact Edit Row: Phone Number & Email Address */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={13} style={{ color: '#1E3A8A' }} /> Phone Number
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      style={{ height: 38 }}
                      placeholder="e.g. +966 50 123 4567"
                      value={memberPhone}
                      onChange={(e) => setMemberPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={13} style={{ color: '#1E3A8A' }} /> Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      style={{ height: 38 }}
                      placeholder="e.g. broker@example.com"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Start Date</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      style={{ height: 38 }}
                      value={form.start_date || ''}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>End Date (Leave blank if open-ended)</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ height: 38 }}
                      value={form.end_date || ''}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value || null })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Position */}
              <div
                style={{
                  padding: 18,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', marginBottom: 14 }}>
                  2. Role &amp; Official Designation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Official Job Title</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ height: 38 }}
                      placeholder="e.g. Senior Sales Specialist"
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Department</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: 38 }}
                      placeholder="e.g. Sales & Acquisitions"
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Financial Remuneration & Commission */}
              <div
                style={{
                  padding: 18,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', marginBottom: 14 }}>
                  3. Compensation &amp; Commission Scheme
                </div>

                {form.contract_type !== 'CHANNEL_PARTNER' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Base Salary (SAR/Month)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-input"
                        style={{ height: 38, fontWeight: 700 }}
                        value={form.base_salary}
                        onChange={(e) => setForm({ ...form, base_salary: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Housing Allowance (SAR)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-input"
                        style={{ height: 38 }}
                        value={form.housing_allowance}
                        onChange={(e) => setForm({ ...form, housing_allowance: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Transport Allowance (SAR)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-input"
                        style={{ height: 38 }}
                        value={form.transport_allowance}
                        onChange={(e) => setForm({ ...form, transport_allowance: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      className="form-input"
                      style={{ height: 38, fontWeight: 800, color: '#166534' }}
                      placeholder="e.g. 2.5"
                      value={form.commission_rate_pct}
                      onChange={(e) => setForm({ ...form, commission_rate_pct: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Monthly Target Quota (SAR)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-input"
                      style={{ height: 38 }}
                      placeholder="e.g. 50000"
                      value={form.monthly_target_sar}
                      onChange={(e) => setForm({ ...form, monthly_target_sar: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Notice Period (Days)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ height: 38 }}
                      value={form.notice_period_days}
                      onChange={(e) => setForm({ ...form, notice_period_days: parseInt(e.target.value, 10) || 30 })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Channel Partner Credentials (If applicable) */}
              {form.contract_type === 'CHANNEL_PARTNER' && (
                <div
                  style={{
                    padding: 18,
                    backgroundColor: '#FFFBEB',
                    borderRadius: 10,
                    border: '1px solid #FDE68A',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', marginBottom: 14 }}>
                    4. External Broker Legal Credentials
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Brokerage / Firm Legal Name</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: 38 }}
                        placeholder="e.g. Al-Fursan Real Estate"
                        value={form.brokerage_firm_name || ''}
                        onChange={(e) => setForm({ ...form, brokerage_firm_name: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Commercial Registration (CR No.)</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: 38 }}
                        placeholder="e.g. 1010992341"
                        value={form.cr_number || ''}
                        onChange={(e) => setForm({ ...form, cr_number: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>REGA Fal License No. (رخصة فال)</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: 38 }}
                        placeholder="e.g. 1200034981"
                        value={form.fal_license_no || ''}
                        onChange={(e) => setForm({ ...form, fal_license_no: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>VAT Tax Registration</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: 38 }}
                        placeholder="e.g. 300129384700003"
                        value={form.vat_number || ''}
                        onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Section 5: Terms & Clauses */}
              <div
                style={{
                  padding: 18,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', marginBottom: 14 }}>
                  {form.contract_type === 'CHANNEL_PARTNER' ? '5' : '4'}. Disbursement Terms &amp; Special Clauses
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Disbursement &amp; Settlement Timeline</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ height: 38 }}
                    value={form.payment_terms || ''}
                    onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Custom Terms / Special Agreements</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Enter any additional conditions or notes..."
                    value={form.custom_terms || ''}
                    onChange={(e) => setForm({ ...form, custom_terms: e.target.value })}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 700,
                    backgroundColor: '#1E3A8A',
                    borderColor: '#1E3A8A',
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Changes &amp; Update Contract
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
