/**
 * Geolocation & Distance Utilities for Asaheeb CRM
 * Standardized on WGS-84 Haversine spherical distance calculation
 */

export const DEFAULT_JEDDAH_HQ = {
  name: 'Jeddah Headquarters',
  address: 'Al-Andalus District, Prince Mohammed Bin Abdulaziz St, Jeddah, Saudi Arabia',
  latitude: 21.5433,
  longitude: 39.1728,
  radius_meters: 150,
}

export interface Coordinates {
  latitude: number
  longitude: number
  accuracy?: number
}

/**
 * Calculate the great-circle distance between two GPS coordinates using the Haversine formula
 * Returns distance in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's mean radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Format meters into clean, readable distance text (e.g. "85 m" or "7.3 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

/**
 * Request high-accuracy GPS coordinates from the device browser
 */
export async function getDeviceCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        let msg = 'Unable to retrieve your location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Location permission was denied. Please allow location access in your browser or phone settings.'
            break
          case error.POSITION_UNAVAILABLE:
            msg = 'GPS signal is currently unavailable. Please try again outside or near a window.'
            break
          case error.TIMEOUT:
            msg = 'GPS request timed out. Please try again.'
            break
        }
        reject(new Error(msg))
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    )
  })
}

/**
 * Open external map directions or view coordinate in Google Maps
 */
export function getGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}
