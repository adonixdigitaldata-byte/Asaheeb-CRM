'use client'

import React from 'react'
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 100 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel()
        }
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '460px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        <div style={{ padding: '24px 24px 16px 24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {/* Icon Badge */}
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: isDanger ? '#FEE2E2' : '#FEF3C7',
              color: isDanger ? '#DC2626' : '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid ${isDanger ? '#FECACA' : '#FDE68A'}`,
            }}
          >
            {isDanger ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
          </div>

          {/* Title & Message */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {title}
              </h3>
              <button
                onClick={onCancel}
                disabled={loading}
                className="btn btn-ghost btn-icon btn-sm"
                style={{ color: '#94A3B8', padding: '4px', margin: '-4px -4px 0 0' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
              {message}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '14px 24px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #F1F5F9',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 14px' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={isDanger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
            style={{
              padding: '6px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
            }}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            <span>{loading ? 'Deleting...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
