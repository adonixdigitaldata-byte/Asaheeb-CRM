'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import ActivityTracker from '@/components/ActivityTracker'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
  userId: string
  children: React.ReactNode
}

export default function CRMAppShell({ profile, userId, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      {/* Mobile Top Header */}
      <header className="crm-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="crm-mobile-hamburger"
            aria-label="Open Navigation Menu"
          >
            <Menu size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                position: 'relative',
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image
                src="/Favicon.png"
                alt="Asaheeb Real Estate"
                width={24}
                height={24}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
              Asaheeb CRM
            </span>
          </div>
        </div>

        <div className="avatar-circle" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
          {profile?.name ? profile.name.charAt(0).toUpperCase() : 'A'}
        </div>
      </header>

      {/* Sidebar Navigation */}
      <Sidebar
        profile={profile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <ActivityTracker userId={userId} />

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
