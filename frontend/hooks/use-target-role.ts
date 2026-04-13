'use client'

import { useCallback, useEffect, useState } from 'react'
import { TARGET_ROLE_STORAGE_KEY } from '@/lib/skillcrew-storage'

/** Target role saved from Command Center (localStorage). */
export function useTargetRole() {
  const [targetRole, setTargetRole] = useState('')

  const refresh = useCallback(() => {
    try {
      setTargetRole(localStorage.getItem(TARGET_ROLE_STORAGE_KEY)?.trim() ?? '')
    } catch {
      setTargetRole('')
    }
  }, [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (e.key === TARGET_ROLE_STORAGE_KEY) setTargetRole(e.newValue?.trim() ?? '')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  return { targetRole, refresh }
}
