import type { ArchieCertificationsBundle } from '@/lib/archie-certifications-mock'
import type { ArchieMilestone, ArchieRoadmapBundle } from '@/lib/archie-roadmap-mock'

/** Pip checkpoint score must be strictly greater than this (percent) to unlock the next week. */
export const PIP_PASS_THRESHOLD_PERCENT = 75

export type RoadmapWeekGateProgress = {
  skills?: { last_passed_week?: number }
  job_ready?: { last_passed_week?: number }
}

export const DEFAULT_WEEK_GATE_PROGRESS: RoadmapWeekGateProgress = {
  skills: { last_passed_week: 0 },
  job_ready: { last_passed_week: 0 },
}

export function normalizeWeekGateProgress(raw: unknown): RoadmapWeekGateProgress {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WEEK_GATE_PROGRESS }
  const o = raw as Record<string, unknown>
  const skills = o.skills as Record<string, unknown> | undefined
  const job_ready = o.job_ready as Record<string, unknown> | undefined
  const n = (v: unknown) => (typeof v === 'number' && v >= 0 ? Math.floor(v) : 0)
  return {
    skills: { last_passed_week: n(skills?.last_passed_week) },
    job_ready: { last_passed_week: n(job_ready?.last_passed_week) },
  }
}

export function getLastPassedWeek(progress: RoadmapWeekGateProgress, intent: 'skills' | 'job_ready'): number {
  const v = intent === 'skills' ? progress.skills?.last_passed_week : progress.job_ready?.last_passed_week
  return typeof v === 'number' && v >= 0 ? v : 0
}

export function parseWeekNumberFromMilestoneId(id: string): number | null {
  const m = /^week-(\d+)$/i.exec(String(id).trim())
  return m ? Number(m[1]) : null
}

export function milestoneWeekNumber(m: ArchieMilestone, index: number): number {
  return parseWeekNumberFromMilestoneId(m.id) ?? index + 1
}

/**
 * Applies sequential week gating: week 1 is active until Pip score > threshold; then week 2, etc.
 * `lastPassedWeek` = number of weeks for which the learner has passed Pip (> threshold); 0 = none yet.
 */
export function applyWeekGateToBundle(bundle: ArchieRoadmapBundle, lastPassedWeek: number): ArchieRoadmapBundle {
  const total = bundle.milestones.length
  const safeLast = Math.max(0, Math.min(lastPassedWeek, total))

  const milestones = bundle.milestones.map((m, i) => {
    const w = milestoneWeekNumber(m, i)
    const activeWeek = safeLast + 1

    let status: ArchieMilestone['status']
    let statusLine: string

    if (w > activeWeek) {
      status = 'locked'
      statusLine = 'Locked — score over 75% on Pip’s quiz for the previous week to unlock'
    } else if (w < activeWeek) {
      status = 'completed'
      statusLine = 'Completed — Pip checkpoint passed'
    } else {
      status = 'in_progress'
      statusLine = 'Pass Pip’s quiz with a score over 75% to unlock the next week'
    }

    const progressPercent = status === 'in_progress' ? (m.progressPercent ?? 45) : undefined
    const xpReward = status === 'completed' ? m.xpReward ?? 80 + (w - 1) * 15 : m.xpReward

    return {
      ...m,
      status,
      statusLine,
      ...(progressPercent !== undefined ? { progressPercent } : {}),
      ...(xpReward !== undefined ? { xpReward } : {}),
    }
  })

  const milestonesDone = safeLast
  const milestonesTotal = total || 1
  const trackProgressPercent = Math.min(100, Math.round((milestonesDone / milestonesTotal) * 100))

  return {
    ...bundle,
    milestones,
    milestonesDone,
    milestonesTotal,
    trackProgressPercent,
  }
}

export function applyWeekGateToStoredBundles(
  bundles: {
    skills: ArchieRoadmapBundle
    job_ready: ArchieRoadmapBundle
    certifications: ArchieCertificationsBundle
  },
  weekGateProgress: RoadmapWeekGateProgress | null,
): {
  skills: ArchieRoadmapBundle
  job_ready: ArchieRoadmapBundle
  certifications: ArchieCertificationsBundle
} {
  const g = normalizeWeekGateProgress(weekGateProgress)
  return {
    ...bundles,
    skills: applyWeekGateToBundle(bundles.skills, getLastPassedWeek(g, 'skills')),
    job_ready: applyWeekGateToBundle(bundles.job_ready, getLastPassedWeek(g, 'job_ready')),
  }
}
