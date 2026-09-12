'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MapPin, Search, Layers, Loader2 } from 'lucide-react'

interface InteractiveMapPickerProps {
  latitude: number
  longitude: number
  onLocationChange: (lat: number, lng: number) => void
  height?: number
  districtName?: string
  cityName?: string
}

declare global {
  interface Window {
    L: any
  }
}

export default function InteractiveMapPicker({
  latitude,
  longitude,
  onLocationChange,
  height = 320,
  districtName,
  cityName,
}: InteractiveMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street')
  const tileLayerRef = useRef<any>(null)

  const [currentPos, setCurrentPos] = useState({ lat: latitude, lng: longitude })

  // Sync internal position when props change
  useEffect(() => {
    if (latitude && longitude) {
      setCurrentPos({ lat: latitude, lng: longitude })
      if (markerRef.current && mapInstanceRef.current) {
        markerRef.current.setLatLng([latitude, longitude])
        mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom() || 16)
      }
    }
  }, [latitude, longitude])

  // Load Leaflet CSS and JS dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS
    if (window.L) {
      setIsLoaded(true)
    } else {
      const existingScript = document.getElementById('leaflet-js')
      if (!existingScript) {
        const script = document.createElement('script')
        script.id = 'leaflet-js'
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.async = true
        script.onload = () => setIsLoaded(true)
        document.body.appendChild(script)
      } else {
        existingScript.addEventListener('load', () => setIsLoaded(true))
      }
    }
  }, [])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapInstanceRef.current || !window.L) return

    const L = window.L

    const defaultLat = currentPos.lat || 21.534639
    const defaultLng = currentPos.lng || 39.176639

    // Custom SVG Pin Marker
    const customPinIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          background: #DC2626;
          border: 3px solid #FFFFFF;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
          cursor: grab;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: #FFFFFF;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    })

    const map = L.map(containerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: true,
    })

    // Street layer (OSM)
    const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    tileLayerRef.current = streetTile

    // Draggable Marker
    const marker = L.marker([defaultLat, defaultLng], {
      icon: customPinIcon,
      draggable: true,
    }).addTo(map)

    // Handle marker drag
    marker.on('dragend', () => {
      const position = marker.getLatLng()
      const lat = parseFloat(position.lat.toFixed(6))
      const lng = parseFloat(position.lng.toFixed(6))
      setCurrentPos({ lat, lng })
      onLocationChange(lat, lng)
    })

    // Handle map click to reposition pin
    map.on('click', (e: any) => {
      const lat = parseFloat(e.latlng.lat.toFixed(6))
      const lng = parseFloat(e.latlng.lng.toFixed(6))
      marker.setLatLng([lat, lng])
      setCurrentPos({ lat, lng })
      onLocationChange(lat, lng)
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    // Invalidate size once rendered
    setTimeout(() => {
      map.invalidateSize()
    }, 250)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [isLoaded])

  // Toggle map type (Street / Satellite)
  function toggleMapType() {
    if (!mapInstanceRef.current || !window.L || !tileLayerRef.current) return
    const L = window.L

    mapInstanceRef.current.removeLayer(tileLayerRef.current)

    if (mapType === 'street') {
      // Switch to Satellite (Esri World Imagery)
      const satelliteTile = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles © Esri',
        }
      ).addTo(mapInstanceRef.current)
      tileLayerRef.current = satelliteTile
      setMapType('satellite')
    } else {
      // Switch to Street (OSM)
      const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current)
      tileLayerRef.current = streetTile
      setMapType('street')
    }
  }

  // Search Address / District geocoding (Nominatim OpenStreetMap)
  async function handleSearch(query: string) {
    const q = query.trim()
    if (!q) return
    setIsSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const data = await res.json()
      if (data && data.length > 0) {
        const lat = parseFloat(parseFloat(data[0].lat).toFixed(6))
        const lng = parseFloat(parseFloat(data[0].lon).toFixed(6))
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16)
          markerRef.current.setLatLng([lat, lng])
        }
        setCurrentPos({ lat, lng })
        onLocationChange(lat, lng)
      } else {
        alert(`Location "${q}" not found. Try adding city name, e.g. "${q}, Jeddah".`)
      }
    } catch (err) {
      console.error('Geocoding error:', err)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Search & Style Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          background: '#F8FAFC',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', flex: 1, minWidth: '220px', gap: '6px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearch(searchQuery)
              }
            }}
            placeholder={`Search street or area (e.g. ${districtName || 'Al-Hamra'}, ${cityName || 'Jeddah'})...`}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              background: '#FFFFFF',
              color: '#0F172A',
            }}
          />
          <button
            type="button"
            onClick={() => handleSearch(searchQuery)}
            disabled={isSearching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            Search Area
          </button>
        </div>

        {/* Layer toggle (Street / Satellite) */}
        <button
          type="button"
          onClick={toggleMapType}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 10px',
            background: '#FFFFFF',
            color: '#334155',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Layers size={13} />
          {mapType === 'street' ? '🛰️ Satellite' : '🗺️ Map View'}
        </button>
      </div>

      {/* Interactive Map Box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          borderRadius: '10px',
          overflow: 'hidden',
          border: '2px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          background: '#E2E8F0',
        }}
      >
        {!isLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#F8FAFC',
              zIndex: 10,
              gap: '8px',
              color: '#64748B',
              fontSize: '12px',
            }}
          >
            <Loader2 size={24} className="animate-spin" color="#D97706" />
            Loading interactive map picker...
          </div>
        )}

        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Live Cursor Instruction Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            color: '#FFFFFF',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 500,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <MapPin size={13} color="#FBBF24" />
          <span>Click anywhere or drag red pin with cursor</span>
        </div>
      </div>

      {/* Live Selected Coordinates Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          background: '#F1F5F9',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#475569',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#10B981',
              display: 'inline-block',
            }}
          />
          <strong>Active Pin:</strong> {currentPos.lat.toFixed(6)}, {currentPos.lng.toFixed(6)}
        </span>
        <span style={{ color: '#059669', fontWeight: 600 }}>
          ✓ Generates clean Google Maps embed automatically
        </span>
      </div>
    </div>
  )
}
