'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  ArrowUpDown,
  Search,
  Check,
  Star,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Building,
  BookOpen,
  Loader2,
  MoveUp,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'

export interface OrderItem {
  id: string
  title: string
  subtitle?: string
  badge?: string
  sort_order?: number
}

interface Props {
  isOpen: boolean
  title: string
  subtitle: string
  items: OrderItem[]
  onClose: () => void
  onSave: (reorderedItems: { id: string; sort_order: number }[]) => Promise<void>
}

const ITEMS_PER_PAGE = 8

export default function OrderSlotManagerModal({
  isOpen,
  title,
  subtitle,
  items,
  onClose,
  onSave,
}: Props) {
  const [list, setList] = useState<OrderItem[]>(() => [...items])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeSlotPicker, setActiveSlotPicker] = useState<number | null>(null)
  const [slotPickerSearch, setSlotPickerSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset list if items change or modal opens
  React.useEffect(() => {
    setList([...items])
    setCurrentPage(1)
    setSearchQuery('')
    setActiveSlotPicker(null)
    setSlotPickerSearch('')
  }, [items, isOpen])

  if (!isOpen) return null

  // Top 10 slots
  const totalSlots = Math.min(10, list.length)
  const topSlots = list.slice(0, totalSlots)

  // Filtered list for the paginated bottom inventory table
  const filteredList = useMemo(() => {
    const withRank = list.map((item, idx) => ({ ...item, rank: idx + 1 }))
    if (!searchQuery.trim()) return withRank
    const q = searchQuery.toLowerCase()
    return withRank.filter(
      (it) => it.title.toLowerCase().includes(q) || (it.subtitle && it.subtitle.toLowerCase().includes(q))
    )
  }, [list, searchQuery])

  // Pagination for inventory list
  const totalPages = Math.max(1, Math.ceil(filteredList.length / ITEMS_PER_PAGE))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredList.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredList, currentPage])

  // Filtered items inside the Slot Picker Popover
  const slotPickerFilteredItems = useMemo(() => {
    if (!slotPickerSearch.trim()) return list
    const q = slotPickerSearch.toLowerCase()
    return list.filter(
      (it) => it.title.toLowerCase().includes(q) || (it.subtitle && it.subtitle.toLowerCase().includes(q))
    )
  }, [list, slotPickerSearch])

  // Move item to specific position index
  function moveToPosition(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex || targetIndex < 0 || targetIndex >= list.length) return
    const updated = [...list]
    const [moved] = updated.splice(sourceIndex, 1)
    updated.splice(targetIndex, 0, moved)
    setList(updated)
  }

  // Handle slot assignment
  function assignItemToSlot(selectedId: string, slotIndex: number) {
    const currentIndex = list.findIndex((it) => it.id === selectedId)
    if (currentIndex === -1 || currentIndex === slotIndex) {
      setActiveSlotPicker(null)
      return
    }
    moveToPosition(currentIndex, slotIndex)
    setActiveSlotPicker(null)
    setSlotPickerSearch('')
  }

  async function handleSaveOrder() {
    setSaving(true)
    try {
      const payload = list.map((item, idx) => ({
        id: item.id,
        sort_order: idx + 1,
      }))
      await onSave(payload)
      onClose()
    } catch (err) {
      console.error('Failed to save reordered items:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '860px',
          width: '95vw',
          maxHeight: '92vh',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 22px' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpDown size={19} style={{ color: 'var(--accent)' }} />
              <span>{title}</span>
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              {subtitle}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          
          {/* Top 10 Priority Slots Section with Searchable Pickers */}
          <div
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} style={{ color: '#D97706' }} />
                <span>Priority Display Slots (Positions #1 to #{totalSlots})</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Click any slot to search and choose from your inventory
              </span>
            </div>

            {/* Grid of Slots */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))', gap: '8px' }}>
              {topSlots.map((slotItem, slotIdx) => {
                const isPickerOpen = activeSlotPicker === slotIdx

                return (
                  <div
                    key={`slot-${slotIdx}`}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      backgroundColor: isPickerOpen ? '#EFF6FF' : '#FFFFFF',
                      border: isPickerOpen ? '1px solid #3B82F6' : '1px solid #CBD5E1',
                      borderRadius: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Rank Badge */}
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: slotIdx === 0 ? '#FEF3C7' : slotIdx < 3 ? '#FEF9C3' : '#EFF6FF',
                        color: slotIdx === 0 ? '#B45309' : slotIdx < 3 ? '#A16207' : '#1D4ED8',
                        fontWeight: 800,
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      #{slotIdx + 1}
                    </div>

                    {/* Active Selected Item Button / Search Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isPickerOpen) {
                          setActiveSlotPicker(null)
                        } else {
                          setActiveSlotPicker(slotIdx)
                          setSlotPickerSearch('')
                        }
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      title="Click to search and change project for this slot"
                    >
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {slotItem.title}
                      </div>
                      {slotItem.subtitle && (
                        <div style={{ fontSize: '10.5px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slotItem.subtitle}
                        </div>
                      )}
                    </button>

                    {/* Change Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isPickerOpen) {
                          setActiveSlotPicker(null)
                        } else {
                          setActiveSlotPicker(slotIdx)
                          setSlotPickerSearch('')
                        }
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '10.5px', padding: '2px 6px', height: '24px' }}
                    >
                      <span>{isPickerOpen ? 'Close' : 'Change'}</span>
                    </button>

                    {/* Arrows */}
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => moveToPosition(slotIdx, slotIdx - 1)}
                        disabled={slotIdx === 0}
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ padding: '2px', height: '24px', width: '24px' }}
                        title="Move Up"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveToPosition(slotIdx, slotIdx + 1)}
                        disabled={slotIdx === list.length - 1}
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ padding: '2px', height: '24px', width: '24px' }}
                        title="Move Down"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>

                    {/* Searchable Picker Dropdown Popover */}
                    {isPickerOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #3B82F6',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                          marginTop: '4px',
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ position: 'relative' }}>
                          <Search
                            size={12}
                            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                          />
                          <input
                            type="text"
                            placeholder="Type to search all inventory..."
                            value={slotPickerSearch}
                            onChange={(e) => setSlotPickerSearch(e.target.value)}
                            className="form-input"
                            style={{ paddingLeft: '26px', fontSize: '11.5px', height: '28px' }}
                            autoFocus
                          />
                        </div>

                        <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {slotPickerFilteredItems.length > 0 ? (
                            slotPickerFilteredItems.map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => assignItemToSlot(candidate.id, slotIdx)}
                                style={{
                                  padding: '5px 8px',
                                  textAlign: 'left',
                                  backgroundColor: candidate.id === slotItem.id ? '#EFF6FF' : '#FFFFFF',
                                  color: candidate.id === slotItem.id ? '#1D4ED8' : '#0F172A',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11.5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span style={{ fontWeight: candidate.id === slotItem.id ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {candidate.title} {candidate.subtitle ? `(${candidate.subtitle})` : ''}
                                </span>
                                {candidate.id === slotItem.id && <Check size={12} />}
                              </button>
                            ))
                          ) : (
                            <div style={{ fontSize: '11px', color: '#94A3B8', padding: '6px 8px', textAlign: 'center' }}>
                              No items match "{slotPickerSearch}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Full Inventory Search & Paginated Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Full Inventory Order ({list.length} total)
              </div>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    left: 9,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94A3B8',
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Search item to move (e.g. 100th item)..."
                  className="form-input"
                  style={{ paddingLeft: '28px', fontSize: '11.5px', height: '30px' }}
                />
              </div>
            </div>

            {/* List */}
            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
              }}
            >
              {paginatedItems.map((item) => {
                const originalIndex = list.findIndex((x) => x.id === item.id)
                const isTop10 = originalIndex < 10

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 12px',
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: isTop10 ? '#FFFBEB' : '#FFFFFF',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isTop10 ? '#FEF3C7' : '#F1F5F9',
                          color: isTop10 ? '#92400E' : '#475569',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          minWidth: '32px',
                          textAlign: 'center',
                        }}
                      >
                        #{originalIndex + 1}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div style={{ fontSize: '10.5px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {originalIndex !== 0 && (
                        <button
                          type="button"
                          onClick={() => moveToPosition(originalIndex, 0)}
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          title="Instantly make this #1"
                        >
                          <MoveUp size={11} />
                          <span>Make #1</span>
                        </button>
                      )}

                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => moveToPosition(originalIndex, originalIndex - 1)}
                          disabled={originalIndex === 0}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ padding: '2px', height: '24px', width: '24px' }}
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveToPosition(originalIndex, originalIndex + 1)}
                          disabled={originalIndex === list.length - 1}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ padding: '2px', height: '24px', width: '24px' }}
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  fontSize: '11.5px',
                  color: '#64748B',
                }}
              >
                <span>
                  Showing page {currentPage} of {totalPages} ({filteredList.length} items)
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    <ChevronLeft size={12} />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    <span>Next</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 22px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>
            Changes will update website display sort orders immediately.
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              <span>{saving ? 'Saving Order...' : 'Save Order in Database'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
