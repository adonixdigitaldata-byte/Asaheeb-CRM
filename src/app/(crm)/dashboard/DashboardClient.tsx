'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
  Trophy,
  DollarSign,
  Clock,
  Plus,
  ArrowRight,
} from 'lucide-react'
import type { LeadStage, Profile } from '@/types/database'
import { formatCurrency, formatTimeAgo, formatDate } from '@/lib/utils'

interface Props {
  profile: Profile
  stages: LeadStage[]
  stageCounts: Record<string, number>
  sourceCounts: Record<string, number>
  totalLeads: number
  recentLeads: any[]
  followups: any[]
}

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: 'Meta Ads',
  MANUAL: 'Manual',
  XLSX_IMPORT: 'XLSX Import',
  TIKTOK: 'TikTok',
  SNAPCHAT: 'Snapchat',
  WHATSAPP: 'WhatsApp',
  WEBSITE_FORM: 'Website Form',
  PROPERTY_INQUIRY: 'Property Inquiry',
}

export default function DashboardClient({
  profile,
  stages,
  stageCounts,
  sourceCounts,
  totalLeads,
  recentLeads,
  followups,
}: Props) {
  const router = useRouter()

  // Won stage metrics
  const wonStage = stages.find((s) => s.key === 'won')
  const wonCount = wonStage ? (stageCounts[wonStage.id] ?? 0) : 0
  const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0'

  // Estimated pipeline value from active leads
  const totalPipelineValue = recentLeads.reduce(
    (acc, lead) => acc + (Number(lead.potential_value) || 0),
    0
  )

  // Max count for progress bars (default 1 to avoid /0)
  const maxStageCount = Math.max(...stages.map((s) => stageCounts[s.id] ?? 0), 1)

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'morning'
    if (hour < 17) return 'afternoon'
    return 'evening'
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-page-title">Dashboard</h1>
          <p className="text-meta" style={{ marginTop: 2 }}>
            Good {getGreeting()}, {profile.name?.split(' ')[0] || 'Staff'} · Overview of real estate sales &amp; pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads" className="btn btn-outline btn-sm">
            <Users size={14} /> View All Leads
          </Link>
          <Link href="/leads?action=new" className="btn btn-primary btn-sm">
            <Plus size={14} /> Add Lead
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* Metric Summary Cards */}
        <div className="rg-4 mb-6">
          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total Leads</span>
              <span style={{ padding: 6, borderRadius: 6, background: '#EFF6FF', color: 'var(--accent)' }}>
                <Users size={16} />
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>
              {totalLeads}
            </div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
              Active in sales pipeline
            </span>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Won Leads</span>
              <span style={{ padding: 6, borderRadius: 6, background: 'var(--success-light)', color: 'var(--success)' }}>
                <Trophy size={16} />
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>
              {wonCount}
            </div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
              Closed property sales
            </span>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Conversion Rate</span>
              <span style={{ padding: 6, borderRadius: 6, background: '#FEF3C7', color: '#D97706' }}>
                <DollarSign size={16} />
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706' }}>
              {conversionRate}%
            </div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
              Lead-to-deal conversion
            </span>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Pending Follow-ups</span>
              <span style={{ padding: 6, borderRadius: 6, background: 'var(--info-light)', color: 'var(--info)' }}>
                <Clock size={16} />
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--info)' }}>
              {followups.length}
            </div>
            <span style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'block' }}>
              Scheduled agent calls
            </span>
          </div>
        </div>

        {/* 2 Column Section: Funnel Overview (All Stages with Progress Bars) & Lead Sources */}
        <div className="rg-2 mb-6">
          {/* Funnel Overview with All Stages Listed */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Funnel Overview</h3>
              <Link href="/leads" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                View all leads &rarr;
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stages.map((stage) => {
                const count = stageCounts[stage.id] ?? 0
                const percent = (count / maxStageCount) * 100

                return (
                  <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Stage Label */}
                    <div style={{ width: 100, fontSize: 13, fontWeight: 500, color: '#0F172A', flexShrink: 0 }}>
                      {stage.label}
                    </div>

                    {/* Colored Stage Dot */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: stage.color_hex || '#3B82F6',
                        flexShrink: 0,
                      }}
                    />

                    {/* Progress Bar */}
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#F1F5F9',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: count > 0 ? `${Math.max(percent, 3)}%` : '0%',
                          backgroundColor: stage.color_hex || '#3B82F6',
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    {/* Number Count */}
                    <div
                      style={{
                        width: 32,
                        textAlign: 'right',
                        fontSize: 13,
                        fontWeight: 700,
                        color: count > 0 ? '#0F172A' : '#94A3B8',
                      }}
                    >
                      {count}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lead Sources Distribution */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Lead Sources</h3>
              <span className="text-meta">{totalLeads} total</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Object.keys(SOURCE_LABELS).map((sourceKey) => {
                const count = sourceCounts[sourceKey] ?? 0
                const percent = totalLeads > 0 ? (count / totalLeads) * 100 : 0
                if (count === 0 && sourceKey !== 'MANUAL' && sourceKey !== 'META_ADS') return null

                return (
                  <div key={sourceKey} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 110, fontSize: 13, fontWeight: 500, color: '#0F172A', flexShrink: 0 }}>
                      {SOURCE_LABELS[sourceKey] || sourceKey}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#F1F5F9',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${percent}%`,
                          backgroundColor: 'var(--accent)',
                          borderRadius: 4,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        width: 32,
                        textAlign: 'right',
                        fontSize: 13,
                        fontWeight: 700,
                        color: count > 0 ? '#0F172A' : '#94A3B8',
                      }}
                    >
                      {count}
                    </div>
                  </div>
                )
              })}

              {totalLeads === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>
                  No lead sources recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2 Column Bottom: Recent Leads & Scheduled Follow-ups */}
        <div className="rg-2">
          {/* Recent Leads */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Recent Leads</h3>
              <Link href="/leads" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                View all &rarr;
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentLeads.slice(0, 5).map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                    backgroundColor: '#FFFFFF',
                    transition: 'background 0.15s ease',
                  }}
                  className="hover:bg-slate-50"
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                      {lead.name || 'Unnamed'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', display: 'flex', gap: 8, marginTop: 2 }}>
                      <span>{lead.phone || 'No phone'}</span>
                      {(lead.property?.name_en || lead.interest) && (
                        <span style={{ color: '#D97706' }}>· {lead.property?.name_en || lead.interest}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: `${lead.stage?.color_hex || '#3B82F6'}15`,
                        color: lead.stage?.color_hex || '#3B82F6',
                        border: `1px solid ${lead.stage?.color_hex || '#3B82F6'}30`,
                      }}
                    >
                      {lead.stage?.label}
                    </span>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                      {formatTimeAgo(lead.created_at)}
                    </div>
                  </div>
                </Link>
              ))}

              {recentLeads.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>
                  No leads registered yet.
                </div>
              )}
            </div>
          </div>

          {/* Pending Follow-ups */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-section-header">Scheduled Follow-ups</h3>
              <span className="badge" style={{ background: '#EFF6FF', color: 'var(--accent)' }}>
                {followups.length} pending
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {followups.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: '#FAFAFA',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                      {f.note || 'Follow-up call'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                      Lead: <strong style={{ color: '#0F172A' }}>{f.lead?.name || 'Lead'}</strong> · {f.lead?.phone || ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--info)' }}>
                      {new Date(f.scheduled_at).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {followups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>
                  No pending follow-ups.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
