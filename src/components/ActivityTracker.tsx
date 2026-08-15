'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ActivityTracker({ userId }: { userId?: string }) {
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    const THROTTLE_MS = 5 * 60 * 1000 // 5 minutes
    let lastUpdate = 0

    async function updateActivity() {
      const now = Date.now()
      if (now - lastUpdate < THROTTLE_MS) return

      lastUpdate = now

      try {
        await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId)
      } catch (err) {
        console.error('Failed to update agent last seen:', err)
      }
    }

    // Trigger on mount
    updateActivity()

    // Trigger on user actions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    const handleActivity = () => updateActivity()

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [userId, supabase])

  return null
}
