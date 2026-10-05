/**
 * Cloudinary utilities for parsing URLs, extracting public IDs, and asset deletion
 */

export function isCloudinaryUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com')
}

/**
 * Extracts public_id from Cloudinary URL (including folders).
 * Handles version tags (v12345...), transforms (c_scale,w_800...), and file extensions.
 */
export function extractCloudinaryPublicId(urlOrId?: string | null): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null
  const trimmed = urlOrId.trim()

  // If already a clean public ID without http/https
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('//')) {
    // Strip file extension if any
    const lastDot = trimmed.lastIndexOf('.')
    if (lastDot > 0 && lastDot > trimmed.lastIndexOf('/')) {
      return trimmed.substring(0, lastDot)
    }
    return trimmed
  }

  if (!isCloudinaryUrl(trimmed)) {
    return null
  }

  try {
    const uploadIndex = trimmed.indexOf('/upload/')
    if (uploadIndex === -1) return null

    let afterUpload = trimmed.substring(uploadIndex + '/upload/'.length)
    // Strip query string and hashes
    afterUpload = afterUpload.split('?')[0].split('#')[0]

    const segments = afterUpload.split('/')
    // Find version index if present (e.g. v1728000000)
    const versionIndex = segments.findIndex((seg) => /^v\d+$/.test(seg))

    let publicIdWithExt: string
    if (versionIndex !== -1) {
      publicIdWithExt = segments.slice(versionIndex + 1).join('/')
    } else {
      // If first segment is a transformation chunk (contains commas or underscores like c_fill,w_300)
      const first = segments[0]
      if (first && (first.includes(',') || /^[a-z]{1,3}_/i.test(first))) {
        publicIdWithExt = segments.slice(1).join('/')
      } else {
        publicIdWithExt = segments.join('/')
      }
    }

    if (!publicIdWithExt) return null

    // Strip extension
    const lastDot = publicIdWithExt.lastIndexOf('.')
    if (lastDot > 0 && lastDot > publicIdWithExt.lastIndexOf('/')) {
      publicIdWithExt = publicIdWithExt.substring(0, lastDot)
    }

    return decodeURIComponent(publicIdWithExt)
  } catch (err) {
    console.error('Failed to extract Cloudinary public_id:', err)
    return null
  }
}

/**
 * Client-side helper to delete an asset from Cloudinary via our backend API route
 */
export async function deleteCloudinaryAsset(
  urlOrPublicId?: string | null
): Promise<{ success: boolean; result?: string; message?: string }> {
  if (!urlOrPublicId) {
    return { success: false, message: 'No URL or public ID provided' }
  }

  // If it's a URL and NOT a Cloudinary URL, ignore safely
  if ((urlOrPublicId.startsWith('http://') || urlOrPublicId.startsWith('https://')) && !isCloudinaryUrl(urlOrPublicId)) {
    return { success: false, message: 'Not a Cloudinary URL' }
  }

  try {
    const res = await fetch('/api/upload/cloudinary/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: urlOrPublicId }),
    })

    const data = await res.json()
    return data
  } catch (err: any) {
    console.warn('Error deleting Cloudinary asset:', err)
    return { success: false, message: err.message || 'Request failed' }
  }
}
