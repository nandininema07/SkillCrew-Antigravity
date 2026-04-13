'use client'

import { useEffect } from 'react'

import { fetchAndApplyProfileToStore } from '@/lib/sync-user-profile'

/**
 * Runs once per dashboard mount: daily activity ping (XP / streak), then loads
 * `profiles` into the client store so the sidebar and other UI show real data.
 */
export function DashboardSessionSync() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        await fetch('/api/activity/daily-ping', { method: 'POST', credentials: 'include' })
        if (cancelled) return
        await fetchAndApplyProfileToStore()
        void fetch('/api/sparky/digest-if-due', { method: 'POST', credentials: 'include' }).catch(() => {
          /* Twilio/backend optional */
        })
      } catch {
        /* offline / session edge cases */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
