'use client'

import type { DBProfile } from '@/lib/database.types'
import { levelFromXp } from '@/lib/gamification-xp'
import { useAppStore } from '@/lib/store'

/** Fetches `/api/profile` and updates the Zustand user slice (preserves skills/path). */
export async function fetchAndApplyProfileToStore(): Promise<boolean> {
  const res = await fetch('/api/profile', { credentials: 'include' })
  if (!res.ok) return false

  const profile = (await res.json()) as DBProfile
  const prev = useAppStore.getState().user

  const xp = typeof profile.xp === 'number' ? profile.xp : 0
  const level = typeof profile.level === 'number' ? profile.level : levelFromXp(xp)
  const email = profile.email || ''
  const name =
    (profile.full_name && profile.full_name.trim()) ||
    (email ? email.split('@')[0] : 'Learner')

  useAppStore.getState().setUser({
    id: profile.id,
    name,
    email,
    avatar: profile.avatar_url || undefined,
    xp,
    level,
    streak: typeof profile.streak === 'number' ? profile.streak : 0,
    skills: prev?.skills ?? [],
    badges: prev?.badges ?? [],
    currentPath: prev?.currentPath,
  })
  return true
}
