/**
 * Triggers on-demand ISR revalidation on the public Asaheeb website
 * for the /blog route.
 */
export async function triggerWebsiteBlogRevalidation(): Promise<{ revalidated: boolean; error?: string; timestamp?: string }> {
  try {
    const res = await fetch(
      'https://www.asaheebrealestate.com/api/revalidate?secret=asaheeb_revalidate_secure_2026&path=/blog',
      { method: 'GET', cache: 'no-store' }
    )

    if (!res.ok) {
      const text = await res.text()
      return { revalidated: false, error: `HTTP ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      revalidated: Boolean(data?.revalidated),
      timestamp: data?.timestamp,
    }
  } catch (err: any) {
    console.error('Failed to trigger website blog cache revalidation:', err)
    return { revalidated: false, error: err?.message || 'Network error' }
  }
}
