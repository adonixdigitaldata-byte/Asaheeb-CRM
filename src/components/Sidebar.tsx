'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  LogOut,
  Mail,
  FileSpreadsheet,
  Banknote,
  Receipt,
  UserCheck,
  Laptop,
  WalletCards,
  Clock,
  Megaphone,
} from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { Profile } from '@/types/database'

interface SidebarProps {
  profile: Profile | null
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ profile, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const role = profile?.role || 'AGENT'
  const isAdmin = role === 'ADMIN'
  const isManager = role === 'SALES_MANAGER'

  const adminNav = [
    {
      section: 'Pipeline & Leads',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/leads', label: 'Leads Pipeline', icon: Users },
        { href: '/leads/import', label: 'Import Leads', icon: FileSpreadsheet },
      ],
    },
    {
      section: 'Staff & Assets',
      items: [
        { href: '/team', label: 'Team Directory', icon: UserCheck },
        { href: '/attendance', label: 'Attendance & Leaves', icon: Clock },
        { href: '/assets', label: 'Company Assets', icon: Laptop },
        { href: '/payroll', label: 'Payroll & Compensation', icon: Banknote },
        { href: '/expenses', label: 'Expense Tracker', icon: WalletCards },
        { href: '/payslips', label: 'My Payslips', icon: Receipt },
      ],
    },
    {
      section: 'Content & Marketing',
      items: [
        { href: '/projects', label: 'Projects CMS', icon: Building2 },
        { href: '/blogs', label: 'Market Insights', icon: BookOpen },
        // { href: '/marketing-popups', label: 'Marketing Pop-ups', icon: Megaphone },
        { href: '/newsletter', label: 'Subscribers', icon: Mail },
      ],
    },
  ]

  const managerNav = [
    {
      section: 'Pipeline & Leads',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/leads', label: 'All Team Leads', icon: Users },
        { href: '/leads/import', label: 'Import Leads', icon: FileSpreadsheet },
      ],
    },
    {
      section: 'Staff & Assets',
      items: [
        { href: '/team', label: 'Team Overview', icon: UserCheck },
        { href: '/attendance', label: 'Attendance & Leaves', icon: Clock },
        { href: '/assets', label: 'Company Assets', icon: Laptop },
        { href: '/payslips', label: 'My Payslips', icon: Receipt },
      ],
    },
    {
      section: 'Content & Marketing',
      items: [
        { href: '/projects', label: 'Projects CMS', icon: Building2 },
        { href: '/blogs', label: 'Market Insights', icon: BookOpen },
        // { href: '/marketing-popups', label: 'Marketing Pop-ups', icon: Megaphone },
        { href: '/newsletter', label: 'Subscribers', icon: Mail },
      ],
    },
  ]

  const agentNav = [
    {
      section: 'My Pipeline',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/leads', label: 'My Leads', icon: Users },
      ],
    },
    {
      section: 'Staff & Assets',
      items: [
        { href: '/attendance', label: 'Attendance & Leaves', icon: Clock },
        { href: '/assets', label: 'Company Assets', icon: Laptop },
        { href: '/payslips', label: 'My Payslips', icon: Receipt },
      ],
    },
    {
      section: 'Content & Marketing',
      items: [
        { href: '/projects', label: 'Projects CMS', icon: Building2 },
        { href: '/blogs', label: 'Market Insights', icon: BookOpen },
        // { href: '/marketing-popups', label: 'Marketing Pop-ups', icon: Megaphone },
        { href: '/newsletter', label: 'Subscribers', icon: Mail },
      ],
    },
  ]

  const navSections = isAdmin ? adminNav : isManager ? managerNav : agentNav

  const roleLabel =
    isAdmin ? 'ADMIN' :
    isManager ? 'SALES MANAGER' :
    role === 'EMPLOYEE' ? 'EMPLOYEE' : 'SALES AGENT'

  return (
    <>
      {/* Mobile Dark Backdrop */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              position: 'relative',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              flexShrink: 0,
            }}>
              <Image
                src="/Favicon.png"
                alt="Asaheeb Real Estate"
                width={32}
                height={32}
                style={{ objectFit: 'contain', borderRadius: '50%' }}
                priority
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Asaheeb
              </div>
              <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em' }}>
                العقارية · REAL ESTATE
              </div>
            </div>
          </div>

          {/* Close button for mobile */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mobile-close-btn"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                padding: '4px',
                display: 'none',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <div className="sidebar-nav">
          {navSections.map((sec, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div className="sidebar-section-label">{sec.section}</div>
              {sec.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href === '/leads'
                    ? pathname.startsWith('/leads/') && !pathname.startsWith('/leads/import')
                    : item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer Profile & Logout */}
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="avatar-circle">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.name || 'Staff'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span className={`badge ${isAdmin ? 'badge-admin' : isManager ? 'badge-admin' : 'badge-agent'}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="btn btn-outline btn-sm"
              style={{ width: '100%', justifyContent: 'center', color: 'var(--text-secondary)' }}
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
