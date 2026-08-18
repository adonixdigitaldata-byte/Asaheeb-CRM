'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
  itemLabel?: string
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize = 15,
  onPageChange,
  itemLabel = 'items',
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)

  if (totalPages <= 1) return null

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return
    onPageChange(newPage)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const startIdx = (currentPage - 1) * pageSize + 1
  const endIdx = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers
  const pages: (number | string)[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ fontSize: '12.5px', color: '#64748B' }}>
        Showing <strong>{startIdx}</strong>–<strong>{endIdx}</strong> of <strong>{totalItems}</strong> {itemLabel}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn btn-outline btn-sm"
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            opacity: currentPage === 1 ? 0.45 : 1,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>

        {/* Page numbers */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '12px' }}>
                …
              </span>
            )
          }

          const pageNum = p as number
          const isActive = pageNum === currentPage

          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => handlePageChange(pageNum)}
              style={{
                minWidth: '28px',
                height: '28px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                border: isActive ? '1px solid var(--accent)' : '1px solid #E2E8F0',
                backgroundColor: isActive ? 'var(--accent)' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {pageNum}
            </button>
          )
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn btn-outline btn-sm"
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            opacity: currentPage === totalPages ? 0.45 : 1,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
