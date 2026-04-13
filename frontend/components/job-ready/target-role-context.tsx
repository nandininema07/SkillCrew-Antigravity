'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { TARGET_ROLE_STORAGE_KEY } from '@/lib/skillcrew-storage'

type JobReadyTargetRoleContextValue = {
  targetRole: string
  loading: boolean
  applyTargetRole: (next: string) => Promise<void>
}

const JobReadyTargetRoleContext = createContext<JobReadyTargetRoleContextValue | null>(null)

export function JobReadyTargetRoleProvider({ children }: { children: ReactNode }) {
  const [targetRole, setTargetRoleState] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function init() {
      let fromStorage = ''
      try {
        fromStorage = localStorage.getItem(TARGET_ROLE_STORAGE_KEY)?.trim() ?? ''
      } catch {
        /* ignore */
      }
      if (fromStorage) {
        if (!cancelled) {
          setTargetRoleState(fromStorage)
          setLoading(false)
        }
        return
      }
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) {
          if (!cancelled) setLoading(false)
          return
        }
        const p = (await res.json()) as { learning_direction?: string | null }
        const dir = (p?.learning_direction as string | null)?.trim() ?? ''
        if (dir && !cancelled) {
          setTargetRoleState(dir)
          try {
            localStorage.setItem(TARGET_ROLE_STORAGE_KEY, dir)
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    const onStorage = (e: StorageEvent) => {
      if (e.key === TARGET_ROLE_STORAGE_KEY) setTargetRoleState(e.newValue?.trim() ?? '')
    }
    window.addEventListener('storage', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const applyTargetRole = useCallback(async (next: string) => {
    const t = next.trim()
    if (!t) {
      throw new Error('Target role cannot be empty')
    }
    try {
      localStorage.setItem(TARGET_ROLE_STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
    setTargetRoleState(t)
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learning_direction: t }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? 'Could not save profile')
    }
  }, [])

  const value = useMemo(
    () => ({ targetRole, loading, applyTargetRole }),
    [targetRole, loading, applyTargetRole],
  )

  return (
    <JobReadyTargetRoleContext.Provider value={value}>{children}</JobReadyTargetRoleContext.Provider>
  )
}

export function useJobReadyTargetRole() {
  const ctx = useContext(JobReadyTargetRoleContext)
  if (!ctx) {
    throw new Error('useJobReadyTargetRole must be used within JobReadyTargetRoleProvider')
  }
  return ctx
}
