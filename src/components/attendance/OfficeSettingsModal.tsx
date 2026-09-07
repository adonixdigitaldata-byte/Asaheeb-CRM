'use client'

import { useState } from 'react'
import {
  X,
  MapPin,
  Building,
  Navigation,
  Check,
  Loader2,
  Sliders,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import { CompanyLocation } from '@/types/attendance'
import { getDeviceCoordinates, getGoogleMapsUrl } from '@/lib/geoUtils'
import { saveOfficeLocation } from '@/lib/attendanceService'

interface OfficeSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentOffice: CompanyLocation
  onUpdated: (newOffice: CompanyLocation) => void
}

const RADIUS_PRESETS = [
  { label: '50m (Single Suite)', value: 50 },
  { label: '150m (Standard HQ)', value: 150 },
  { label: '300m (Office Complex)', value: 300 },
  { label: '500m (Business Park)', value: 500 },
]

export default function OfficeSettingsModal({
  isOpen,
  onClose,
  currentOffice,
  onUpdated,
}: OfficeSettingsModalProps) {
  const [name, setName] = useState(currentOffice.name || 'Jeddah Headquarters')
  const [address, setAddress] = useState(
    currentOffice.address || 'Al-Andalus District, Prince Mohammed Bin Abdulaziz St, Jeddah, Saudi Arabia'
  )
  const [latitude, setLatitude] = useState<number>(currentOffice.latitude || 21.5433)
  const [longitude, setLongitude] = useState<number>(currentOffice.longitude || 39.1728)
  const [radiusMeters, setRadiusMeters] = useState<number>(currentOffice.radius_meters || 150)

  const [isDetectingGps, setIsDetectingGps] = useState(false)
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

  async function handleUseCurrentLocation() {
    setIsDetectingGps(true)
    setGpsMessage(null)
    try {
      const coords = await getDeviceCoordinates()
      setLatitude(parseFloat(coords.latitude.toFixed(6)))
      setLongitude(parseFloat(coords.longitude.toFixed(6)))
      setGpsMessage(
        `GPS acquired: ±${Math.round(coords.accuracy || 10)}m accuracy from current device.`
      )
    } catch (err: any) {
      setGpsMessage(`Location error: ${err.message || 'Could not fetch GPS.'}`)
    } finally {
      setIsDetectingGps(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const updated = await saveOfficeLocation({
        id: currentOffice.id,
        name,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: Number(radiusMeters),
      })
      onUpdated(updated)
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onClose()
      }, 1200)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Office Geofence Settings
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Configure headquarters location and punch tolerance radius
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: '#E2E8F0',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Office Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jeddah Headquarters"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#0F172A',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Street Address / District
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Al-Andalus District, Jeddah"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#0F172A',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* GPS Coordinates Section */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#0284C7" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                  GPS Coordinates (WGS-84)
                </span>
              </div>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isDetectingGps}
                className="btn btn-outline"
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#FFFFFF',
                }}
              >
                {isDetectingGps ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Locating...
                  </>
                ) : (
                  <>
                    <Navigation size={12} /> Use My Current GPS
                  </>
                )}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#0F172A',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#0F172A',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {gpsMessage && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#0284C7' }}>
                {gpsMessage}
              </div>
            )}

            <div style={{ marginTop: '8px', textAlign: 'right' }}>
              <a
                href={getGoogleMapsUrl(latitude, longitude)}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '11px',
                  color: '#2563EB',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                Inspect on Google Maps <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {/* Geofence Radius */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Geofence Radius (Tolerance)
              </label>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#4F46E5',
                  backgroundColor: '#EEF2FF',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {radiusMeters} meters
              </span>
            </div>

            <input
              type="range"
              min={30}
              max={1000}
              step={10}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#4F46E5',
                cursor: 'pointer',
                marginBottom: '10px',
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {RADIUS_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setRadiusMeters(p.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: radiusMeters === p.value ? '#EEF2FF' : '#F8FAFC',
                    border: `1px solid ${radiusMeters === p.value ? '#4F46E5' : '#E2E8F0'}`,
                    color: radiusMeters === p.value ? '#4338CA' : '#64748B',
                    fontSize: '11px',
                    fontWeight: radiusMeters === p.value ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || savedSuccess}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving...
              </>
            ) : savedSuccess ? (
              <>
                <Check size={15} /> Saved!
              </>
            ) : (
              <>
                <ShieldCheck size={15} /> Save Geofence
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
