'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Cpu,
  Monitor,
  Wifi,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Clock,
  MapPin,
  Maximize2,
  HardDrive,
  Activity,
  Layers,
} from 'lucide-react'
import { AttendanceLog } from '@/types/attendance'
import { DeviceSpecs, NetworkSpecs } from '@/lib/deviceTelemetry'
import { formatDistance } from '@/lib/geoUtils'

interface DeviceAuditModalProps {
  isOpen: boolean
  onClose: () => void
  log: AttendanceLog | null
  employeeName?: string
}

export default function DeviceAuditModal({
  isOpen,
  onClose,
  log,
  employeeName = 'Employee',
}: DeviceAuditModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  if (!isOpen || !log) return null

  function copyText(key: string, text: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  function getDeviceIcon(deviceType?: string) {
    const dt = deviceType?.toLowerCase()
    if (dt === 'mobile') return <Smartphone size={16} />
    if (dt === 'tablet') return <Tablet size={16} />
    return <Laptop size={16} />
  }

  const inDev = log.punch_in_device_info
  const inNet = log.punch_in_network_info
  const inIp = log.punch_in_ip || inNet?.ip || 'N/A'

  const outDev = log.punch_out_device_info
  const outNet = log.punch_out_network_info
  const outIp = log.punch_out_ip || outNet?.ip || 'N/A'

  // Audit Comparison Analysis
  const hasBothPunches = Boolean(log.punch_in_at && log.punch_out_at)
  const isIpMismatch =
    hasBothPunches &&
    inIp !== 'N/A' &&
    outIp !== 'N/A' &&
    inIp !== outIp

  const isDeviceMismatch =
    hasBothPunches &&
    Boolean(inDev && outDev) &&
    (inDev?.deviceType !== outDev?.deviceType ||
      inDev?.os !== outDev?.os ||
      inDev?.browser !== outDev?.browser)

  const renderSpecsCard = (
    title: string,
    time: string | null,
    status: string | null,
    distanceM: number | null,
    dev: DeviceSpecs | null | undefined,
    net: NetworkSpecs | null | undefined,
    ip: string,
    tagPrefix: string
  ) => {
    if (!time) {
      return (
        <div
          style={{
            flex: 1,
            backgroundColor: '#F8FAFC',
            border: '1px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748B',
            minHeight: '260px',
          }}
        >
          <Clock size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{title} Not Recorded</div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
            No punch recorded for this action.
          </div>
        </div>
      )
    }

    const hasTelemetry = Boolean(dev || (ip && ip !== 'N/A'))

    return (
      <div
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: title.includes('In') ? '#EEF2FF' : '#F0FDF4',
                color: title.includes('In') ? '#4F46E5' : '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {getDeviceIcon(dev?.deviceType)}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{title}</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {status && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: status === 'APPROVED' ? '#DCFCE7' : status === 'FLAGGED' ? '#FEE2E2' : '#FEF3C7',
                  color: status === 'APPROVED' ? '#15803D' : status === 'FLAGGED' ? '#DC2626' : '#B45309',
                }}
              >
                {status}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          {/* Location context */}
          {distanceM !== null && distanceM !== undefined && (
            <div
              style={{
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#F1F5F9',
                padding: '6px 10px',
                borderRadius: '6px',
              }}
            >
              <MapPin size={13} color="#2563EB" />
              <span>Location: <strong>{formatDistance(distanceM)} from Jeddah HQ</strong></span>
            </div>
          )}

          {!hasTelemetry ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#94A3B8',
                fontSize: '12px',
                fontStyle: 'italic',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
              }}
            >
              Hardware telemetry was not captured for this punch (legacy timestamp or restricted permissions).
            </div>
          ) : (
            <>
              {/* Device Profile Card */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748B',
                    letterSpacing: '0.04em',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Monitor size={12} /> Device &amp; Operating System
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>DEVICE TYPE / NAME</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {dev?.deviceName || dev?.deviceType || 'Desktop PC'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>OPERATING SYSTEM</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {dev?.os || dev?.platform || 'Unknown OS'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      gridColumn: 'span 2',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>BROWSER / ENGINE</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {dev?.browser || 'Web Browser'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Network & IP Audit */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748B',
                    letterSpacing: '0.04em',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Wifi size={12} /> Network &amp; Connection Audit
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#FAF5FF',
                      border: '1px solid #E9D5FF',
                      gridColumn: 'span 2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: '#7E22CE', fontWeight: 700 }}>PUBLIC IP ADDRESS</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#581C87', marginTop: '2px', fontFamily: 'monospace' }}>
                        {ip || 'Unknown IP'}
                      </div>
                    </div>
                    {ip && ip !== 'N/A' && (
                      <button
                        type="button"
                        onClick={() => copyText(`${tagPrefix}-ip`, ip)}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #D8B4FE',
                          color: '#7E22CE',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {copiedKey === `${tagPrefix}-ip` ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                        {copiedKey === `${tagPrefix}-ip` ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>NETWORK TYPE</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {net?.effectiveType ? `${net.effectiveType.toUpperCase()} (${net.downlinkMbps || 10} Mbps)` : 'Broadband'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>LATENCY (RTT)</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {net?.rttMs ? `${net.rttMs} ms` : '< 50 ms'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hardware & Hardware Fingerprint */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748B',
                    letterSpacing: '0.04em',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Cpu size={12} /> Hardware &amp; Display Specs
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>SCREEN</div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {dev?.screenResolution || 'N/A'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>CPU CORES</div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {dev?.hardwareConcurrency ? `${dev.hardwareConcurrency} Cores` : 'N/A'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>RAM (APPROX)</div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {dev?.deviceMemoryGb ? `${dev.deviceMemoryGb} GB` : 'N/A'}
                    </div>
                  </div>

                  {dev?.gpuRenderer && (
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        gridColumn: 'span 3',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>GPU / WEBGL RENDERER</div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#334155',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={dev.gpuRenderer}
                      >
                        {dev.gpuRenderer}
                      </div>
                    </div>
                  )}

                  {dev?.timezone && (
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        gridColumn: 'span 3',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>SYSTEM TIMEZONE &amp; LOCALE</div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                        {dev.timezone} ({dev.language || 'en'})
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* User Agent String */}
              {dev?.userAgent && (
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#64748B',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Full User-Agent Fingerprint</span>
                    <button
                      type="button"
                      onClick={() => copyText(`${tagPrefix}-ua`, dev.userAgent)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4F46E5',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0,
                      }}
                    >
                      {copiedKey === `${tagPrefix}-ua` ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                      {copiedKey === `${tagPrefix}-ua` ? 'Copied' : 'Copy UA'}
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#64748B',
                      fontFamily: 'monospace',
                      backgroundColor: '#F1F5F9',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      wordBreak: 'break-all',
                      maxHeight: '52px',
                      overflowY: 'auto',
                    }}
                  >
                    {dev.userAgent}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const modalElement = (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 100010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 100015,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
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
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Device &amp; Telemetry Audit Inspector
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#E0E7FF',
                    color: '#3730A3',
                  }}
                >
                  {log.date}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Employee: <strong style={{ color: '#1E293B' }}>{employeeName}</strong> · Forensic verification of devices, hardware &amp; networks
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              background: '#E2E8F0',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Audit Match Alert Banner */}
        {hasBothPunches && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: isDeviceMismatch || isIpMismatch ? '#FEF2F2' : '#F0FDF4',
              borderBottom: `1px solid ${isDeviceMismatch || isIpMismatch ? '#FECACA' : '#BBF7D0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isDeviceMismatch || isIpMismatch ? (
                <AlertTriangle size={16} color="#DC2626" />
              ) : (
                <ShieldCheck size={16} color="#16A34A" />
              )}
              <span style={{ color: isDeviceMismatch || isIpMismatch ? '#991B1B' : '#166534', fontWeight: 600 }}>
                {isDeviceMismatch && isIpMismatch
                  ? '⚠️ Security Alert: Different Device AND Different Public IP used between Punch In and Punch Out!'
                  : isDeviceMismatch
                  ? '⚠️ Security Notice: Different Device detected between Punch In and Punch Out (e.g. Mobile vs Desktop).'
                  : isIpMismatch
                  ? '⚠️ Network Notice: Different Public IP address used between Punch In and Punch Out.'
                  : '✓ Verified: Same Device & Consistent Network signature used for both Punch In & Out.'}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
              Shift Duration: <strong>{(log.total_working_minutes / 60).toFixed(1)} hrs</strong>
            </div>
          </div>
        )}

        {/* Side by Side Cards */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 150px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '16px',
            }}
          >
            {renderSpecsCard(
              'Punch In Verification',
              log.punch_in_at,
              log.punch_in_status,
              log.punch_in_distance_m,
              inDev,
              inNet,
              inIp,
              'punch-in'
            )}

            {renderSpecsCard(
              'Punch Out Verification',
              log.punch_out_at,
              log.punch_out_status,
              log.punch_out_distance_m,
              outDev,
              outNet,
              outIp,
              'punch-out'
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B' }}>
            Data collected via automated browser fingerprinting &amp; network telemetry APIs.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '6px 18px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#4F46E5',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalElement, document.body)
}
