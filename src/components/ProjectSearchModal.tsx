'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Building, MapPin, Check, Plus, ArrowRight } from 'lucide-react'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import type { Project } from '@/types/database'

interface Props {
  isOpen: boolean
  projects: Project[]
  selectedProjectId?: string | null
  customPropertyName?: string
  propertyMode: 'NONE' | 'DB' | 'CUSTOM'
  onSelectProject: (project: Project) => void
  onSelectNone: () => void
  onSelectCustom: (customName: string) => void
  onClose: () => void
}

export default function ProjectSearchModal({
  isOpen,
  projects,
  selectedProjectId,
  customPropertyName = '',
  propertyMode,
  onSelectProject,
  onSelectNone,
  onSelectCustom,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('ALL')
  const [customText, setCustomText] = useState(customPropertyName)
  const [isTypingCustom, setIsTypingCustom] = useState(propertyMode === 'CUSTOM')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Autofocus search on open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setCityFilter('ALL')
      setCustomText(customPropertyName)
      setIsTypingCustom(propertyMode === 'CUSTOM')
      setTimeout(() => {
        if (propertyMode === 'CUSTOM') {
          customInputRef.current?.focus()
        } else {
          searchInputRef.current?.focus()
        }
      }, 100)
    }
  }, [isOpen, customPropertyName, propertyMode])

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Extract unique cities
  const cities = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => {
      if (p.city_en && p.city_en.trim()) set.add(p.city_en.trim())
    })
    return Array.from(set).sort()
  }, [projects])

  // Filter projects by search and city, sorting the selected project to the top
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = projects.filter((p) => {
      if (cityFilter !== 'ALL' && p.city_en !== cityFilter) return false
      if (!q) return true

      const matchEn = p.name_en?.toLowerCase().includes(q)
      const matchAr = p.name_ar?.toLowerCase().includes(q)
      const matchCityEn = p.city_en?.toLowerCase().includes(q)
      const matchCityAr = p.city_ar?.toLowerCase().includes(q)
      const matchDistrictEn = p.district_en?.toLowerCase().includes(q)
      const matchDistrictAr = p.district_ar?.toLowerCase().includes(q)
      const matchDeveloper = p.developer_en?.toLowerCase().includes(q)

      return matchEn || matchAr || matchCityEn || matchCityAr || matchDistrictEn || matchDistrictAr || matchDeveloper
    })

    // Float currently selected project to the very top
    if (selectedProjectId) {
      return [...list].sort((a, b) => {
        if (a.id === selectedProjectId) return -1
        if (b.id === selectedProjectId) return 1
        return 0
      })
    }

    return list
  }, [projects, search, cityFilter, selectedProjectId])

  if (!isOpen || !mounted) return null

  function handleCustomSubmit() {
    if (customText.trim()) {
      onSelectCustom(customText.trim())
      onClose()
    }
  }

  const modalElement = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 100050,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 100051,
          margin: 'auto',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Select Associated Project
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0' }}>
                Search database developments or specify a custom property
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ color: '#64748B', borderRadius: 8, padding: 6 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & City Filters */}
        <div style={{ padding: '14px 22px 10px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name, city (Riyadh, Jeddah), district, developer..."
              style={{
                width: '100%',
                padding: '10px 38px 10px 42px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                fontSize: '0.875rem',
                color: '#0F172A',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563EB'
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CBD5E1'
                e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick City Filter Pills */}
          {cities.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginRight: 2 }}>
                City:
              </span>
              <button
                type="button"
                onClick={() => setCityFilter('ALL')}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: cityFilter === 'ALL' ? 700 : 500,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  border: cityFilter === 'ALL' ? '1px solid #2563EB' : '1px solid #E2E8F0',
                  backgroundColor: cityFilter === 'ALL' ? '#EFF6FF' : '#FFFFFF',
                  color: cityFilter === 'ALL' ? '#1D4ED8' : '#64748B',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                All Cities
              </button>
              {cities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setCityFilter(city)}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: cityFilter === city ? 700 : 500,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    border: cityFilter === city ? '1px solid #2563EB' : '1px solid #E2E8F0',
                    backgroundColor: cityFilter === city ? '#EFF6FF' : '#FFFFFF',
                    color: cityFilter === city ? '#1D4ED8' : '#64748B',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Mode Options (None / Custom) */}
        <div
          style={{
            padding: '10px 22px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {/* None Option */}
          <button
            type="button"
            onClick={() => {
              onSelectNone()
              onClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 12px',
              borderRadius: '8px',
              border: propertyMode === 'NONE' ? '1.5px solid #2563EB' : '1px dashed #CBD5E1',
              backgroundColor: propertyMode === 'NONE' ? '#EFF6FF' : '#F8FAFC',
              color: propertyMode === 'NONE' ? '#1D4ED8' : '#475569',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {propertyMode === 'NONE' && <Check size={14} style={{ color: '#2563EB' }} />}
            <span>None / General Inquiry</span>
          </button>

          {/* Toggle Custom Property Input */}
          <button
            type="button"
            onClick={() => {
              setIsTypingCustom(!isTypingCustom)
              if (!isTypingCustom) {
                setTimeout(() => customInputRef.current?.focus(), 50)
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: '8px',
              border: propertyMode === 'CUSTOM' ? '1.5px solid #D97706' : '1px dashed #CBD5E1',
              backgroundColor: propertyMode === 'CUSTOM' ? '#FFFBEB' : '#F8FAFC',
              color: propertyMode === 'CUSTOM' ? '#B45309' : '#475569',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            <span>Custom Property Name</span>
          </button>
        </div>

        {/* Custom Property Input Bar (if open) */}
        {isTypingCustom && (
          <div
            style={{
              padding: '10px 22px',
              backgroundColor: '#FFFBEB',
              borderBottom: '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              ref={customInputRef}
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCustomSubmit()
                }
              }}
              placeholder="Enter custom property name (e.g. Al Narjis Villa)..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #F59E0B',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                color: '#1E293B',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={!customText.trim()}
              className="btn btn-sm"
              style={{
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '8px 14px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>Use Custom</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Projects List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Database Projects ({filteredProjects.length})
            </span>
          </div>

          {filteredProjects.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '36px 16px',
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
                border: '1px dashed #E2E8F0',
              }}
            >
              <Building size={32} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>
                No projects matched &ldquo;{search}&rdquo;
              </p>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 14px' }}>
                You can specify &ldquo;{search}&rdquo; as a custom property name.
              </p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCustom(search.trim())
                    onClose()
                  }}
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Use &ldquo;{search.trim()}&rdquo; as Custom Property
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isSelected = propertyMode === 'DB' && selectedProjectId === p.id
              const location = [p.district_en, p.city_en].filter(Boolean).join(', ')

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p)
                    onClose()
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#93C5FD'
                      e.currentTarget.style.backgroundColor = '#F8FAFC'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#E2E8F0'
                      e.currentTarget.style.backgroundColor = '#FFFFFF'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: isSelected ? '#DBEAFE' : '#F1F5F9',
                        color: isSelected ? '#1D4ED8' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Building size={18} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            color: isSelected ? '#1D4ED8' : '#0F172A',
                          }}
                        >
                          {p.name_en}
                        </span>
                        {p.name_ar && (
                          <span style={{ fontSize: '0.78rem', color: '#64748B', direction: 'rtl' }}>
                            {p.name_ar}
                          </span>
                        )}
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: '#2563EB',
                              color: '#FFFFFF',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Check size={10} strokeWidth={3} /> Selected
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 3,
                          fontSize: '0.75rem',
                          color: '#64748B',
                          flexWrap: 'wrap',
                        }}
                      >
                        {location && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} style={{ color: '#0284C7' }} />
                            <span>{location}</span>
                          </span>
                        )}
                        {p.developer_en && (
                          <span style={{ color: '#475569' }}>
                            by <strong>{p.developer_en}</strong>
                          </span>
                        )}
                        {p.starting_price_en && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#16A34A', fontWeight: 600 }}>
                            <SaudiRiyalIcon size={12} />
                            <span>From {p.starting_price_en}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected ? (
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#334155',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Select
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Tip: Type to quickly search across project names, cities, and developers
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalElement, document.body)
}
