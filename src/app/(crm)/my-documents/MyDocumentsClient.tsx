'use client'

import React from 'react'
import { Profile, EmployeeDocument, EmployeeCustomRecord } from '@/types/database'
import EmployeeDocumentsTab from '@/components/team/EmployeeDocumentsTab'
import { FolderLock, Info, FileCheck } from 'lucide-react'

interface Props {
  currentProfile: Profile
  initialDocuments: EmployeeDocument[]
  initialCustomRecords: EmployeeCustomRecord[]
}

export default function MyDocumentsClient({
  currentProfile,
  initialDocuments,
  initialCustomRecords,
}: Props) {
  const isAdmin = currentProfile.role === 'ADMIN'

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="text-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderLock size={22} style={{ color: 'var(--accent)' }} />
              My Documents &amp; Vault
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999,
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
              }}
            >
              Employee Self-Service
            </span>
          </div>
          <p className="text-meta" style={{ marginTop: 4 }}>
            Securely upload and view your verified official records: National ID/Iqama, Passport, certificates, degrees, and driving license.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href={`/team/${currentProfile.id}/contract?from=documents`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              borderColor: '#BFDBFE',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              textDecoration: 'none',
            }}
            title="Open your official sales employment contract in a new tab"
          >
            <FileCheck size={14} />
            <span>📄 My Official Contract</span>
          </a>
        </div>
      </div>

      {/* Helpful Policy Notice for Employees */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 8,
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          marginBottom: 20,
          fontSize: 12.5,
          color: '#475569',
        }}
      >
        <Info size={18} style={{ color: '#0284C7', flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong style={{ color: '#0F172A' }}>Document Retention &amp; Compliance Policy:</strong>{' '}
          Once uploaded, documents cannot be replaced or deleted directly to maintain an audit-ready compliance trail. If a document has expired, contains an error, or needs a correction, click <strong>&ldquo;Request Re-upload&rdquo;</strong> to alert admin. Once deleted by admin, you will be able to upload the updated copy.
        </div>
      </div>

      {/* Documents & Vault Component */}
      <EmployeeDocumentsTab
        member={currentProfile}
        isAdmin={isAdmin}
        isSelfView={true}
        initialDocuments={initialDocuments}
        initialCustomRecords={initialCustomRecords}
      />
    </div>
  )
}
