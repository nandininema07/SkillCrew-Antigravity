/**
 * Path progress = completed roadmap milestones (weeks) vs total milestones in the stored bundle.
 *
 * We count milestones — not sections.modules — because Archie always generates the full week list
 * as milestones, whereas sections.modules can be sparse (1–2 entries per section).
 *
 * A milestone is considered "completed" when at least one of its child modules (linked via
 * milestoneId on sections[].modules[]) appears in the completed-module-ids set.
 * If no section modules carry milestoneIds (rare), we fall back to raw section module counts.
 */

import { normalizeStoredBundles } from '@/lib/server/persist-learning-roadmap'

export type RoadmapTrackNodeProgress = {
  completed: number
  total: number
  remaining: number
  percent: number
}

export function buildNodeProgress(
  moduleIds: string[],
  completedModuleIds: Set<string>,
): RoadmapTrackNodeProgress {
  const total = moduleIds.length
  if (total === 0) return { completed: 0, total: 0, remaining: 0, percent: 0 }
  let completed = 0
  for (const id of moduleIds) {
    if (completedModuleIds.has(id)) completed += 1
  }
  const remaining = total - completed
  const percent = Math.min(100, Math.round((completed / total) * 100))
  return { completed, total, remaining, percent }
}

/**
 * Primary progress function.
 * Total  = milestone count (represents weeks/units — always fully populated by Archie).
 * Done   = milestones that have ≥1 completed module linked to them.
 * Falls back to section-module count when no milestoneId links exist.
 */
export function getMilestoneNodeProgress(
  bundlesRaw: unknown,
  track: 'skills' | 'job_ready',
  completedModuleIds: Set<string>,
): RoadmapTrackNodeProgress {
  const base = normalizeStoredBundles(bundlesRaw)
  if (!base) return { completed: 0, total: 0, remaining: 0, percent: 0 }
  const bundle = base[track]
  if (!bundle) return { completed: 0, total: 0, remaining: 0, percent: 0 }

  const totalMilestones = bundle.milestones?.length ?? 0

  // Build module_id → milestoneId lookup from sections
  const moduleToMilestone = new Map<string, string>()
  for (const sec of bundle.sections ?? []) {
    for (const mod of sec.modules ?? []) {
      if (mod.id && mod.milestoneId) moduleToMilestone.set(mod.id, mod.milestoneId)
    }
  }

  // If we have milestones AND module-to-milestone links, use milestone-based counting
  if (totalMilestones > 0 && moduleToMilestone.size > 0) {
    const completedMilestoneIds = new Set<string>()
    for (const [modId, msId] of moduleToMilestone) {
      if (completedModuleIds.has(modId)) completedMilestoneIds.add(msId)
    }
    const completed = completedMilestoneIds.size
    const remaining = totalMilestones - completed
    const percent = Math.min(100, Math.round((completed / totalMilestones) * 100))
    return { completed, total: totalMilestones, remaining, percent }
  }

  // If milestones exist but no module links: use milestone count as total,
  // completed is 0 (no way to verify without links)
  if (totalMilestones > 0) {
    // Count completed modules that are in sections as a proxy
    const allModIds: string[] = []
    for (const sec of bundle.sections ?? []) {
      for (const mod of sec.modules ?? []) {
        if (mod.id) allModIds.push(mod.id)
      }
    }
    if (allModIds.length > 0) {
      const completedCount = allModIds.filter((id) => completedModuleIds.has(id)).length
      // Scale completion to milestone count for a consistent denominator
      const completedMilestones = Math.min(
        totalMilestones,
        Math.round((completedCount / allModIds.length) * totalMilestones),
      )
      const remaining = totalMilestones - completedMilestones
      const percent = Math.min(100, Math.round((completedMilestones / totalMilestones) * 100))
      return { completed: completedMilestones, total: totalMilestones, remaining, percent }
    }
    return { completed: 0, total: totalMilestones, remaining: totalMilestones, percent: 0 }
  }

  // Final fallback: raw section module count
  const allModIds: string[] = []
  for (const sec of bundle.sections ?? []) {
    for (const mod of sec.modules ?? []) {
      if (mod.id) allModIds.push(mod.id)
    }
  }
  return buildNodeProgress(allModIds, completedModuleIds)
}

/** Milestone ids that have at least one completed module (same rules as `getMilestoneNodeProgress`). */
export function getCompletedMilestoneIdSet(
  bundlesRaw: unknown,
  track: 'skills' | 'job_ready',
  completedModuleIds: Set<string>,
): Set<string> {
  const base = normalizeStoredBundles(bundlesRaw)
  if (!base) return new Set()
  const bundle = base[track]
  if (!bundle) return new Set()

  const totalMilestones = bundle.milestones?.length ?? 0
  const moduleToMilestone = new Map<string, string>()
  for (const sec of bundle.sections ?? []) {
    for (const mod of sec.modules ?? []) {
      if (mod.id && mod.milestoneId) moduleToMilestone.set(mod.id, mod.milestoneId)
    }
  }

  if (totalMilestones > 0 && moduleToMilestone.size > 0) {
    const completedMilestoneIds = new Set<string>()
    for (const [modId, msId] of moduleToMilestone) {
      if (completedModuleIds.has(modId)) completedMilestoneIds.add(msId)
    }
    return completedMilestoneIds
  }
  return new Set()
}

export function findMilestoneTitleInBundle(
  bundlesRaw: unknown,
  track: 'skills' | 'job_ready',
  milestoneId: string,
): string | null {
  const base = normalizeStoredBundles(bundlesRaw)
  if (!base) return null
  const bundle = base[track]
  const m = bundle?.milestones?.find((x) => x.id === milestoneId)
  return m?.title ? String(m.title) : null
}

/** @deprecated Use getMilestoneNodeProgress instead. */
export function getModuleIdsForTrack(
  bundlesRaw: unknown,
  weekGateProgress: unknown,
  track: 'skills' | 'job_ready',
): string[] {
  const base = normalizeStoredBundles(bundlesRaw)
  if (!base) return []
  const bundle = base[track]
  if (!bundle?.sections?.length) return []
  const ids: string[] = []
  for (const s of bundle.sections) {
    for (const m of s.modules ?? []) {
      if (m.id) ids.push(m.id)
    }
  }
  return ids
}
