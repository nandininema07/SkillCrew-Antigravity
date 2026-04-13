import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeArchieRoadmapBundle, normalizeCertificationsBundle } from '@/lib/agents/normalize-roadmap'
import {
  applyWeekGateToStoredBundles,
  DEFAULT_WEEK_GATE_PROGRESS,
  normalizeWeekGateProgress,
} from '@/lib/archie-week-gate'
import { calendarWeeksUntilTarget, rescaleRoadmapRawForCalendarWeeks } from '@/lib/roadmap-rescale-target-date'
import { computeRoadmapSkillsProgressForUser } from '@/lib/roadmap-skills-progress'
import { inferRecommendedJobTitle } from '@/lib/infer-recommended-job-title'
import { buildLearnerContextPayload } from '@/lib/server/learner-context'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'

function weeksFromRaw(raw: Record<string, unknown> | null): number {
  if (!raw) return 8
  const w = (raw.weeklyTimeline || {}) as Record<string, unknown>
  const n = w.totalWeeks
  return typeof n === 'number' && n > 0 ? Math.min(104, Math.round(n)) : 8
}

function etaDateFromWeeks(weeks: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

function titleFromRaw(skills: Record<string, unknown> | null, direction: string): string {
  const t = skills?.trackTitle
  if (typeof t === 'string' && t.trim()) return t.trim().slice(0, 240)
  return direction.trim().slice(0, 240)
}

function titleFromJobRaw(job: Record<string, unknown> | null, direction: string): string {
  const t = job?.trackTitle
  if (typeof t === 'string' && t.trim()) return t.trim().slice(0, 240)
  return direction.trim().slice(0, 240)
}

/** Extra learner signals for Archie when replacing a completed track with “level N+1”. */
function continuationSignalsFromBundle(
  bundlesRaw: unknown,
  intent: 'skills' | 'job_ready',
): Record<string, unknown> | undefined {
  if (!bundlesRaw || typeof bundlesRaw !== 'object') return undefined
  const br = bundlesRaw as Record<string, unknown>
  const raw = (intent === 'job_ready' ? br.job_ready : br.skills) as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') return undefined
  const trackTitle = typeof raw.trackTitle === 'string' ? raw.trackTitle.trim() : ''
  const milestones = Array.isArray(raw.milestones) ? raw.milestones : []
  const weekTitles = milestones
    .map((m) =>
      m && typeof m === 'object' ? String((m as { title?: string }).title || '').trim() : '',
    )
    .filter(Boolean)
    .slice(0, 16)
  const displayLevel =
    typeof raw.displayLevel === 'number' && raw.displayLevel > 0 ? Math.floor(raw.displayLevel) : 1
  return {
    roadmap_continuation: true,
    prior_display_level: displayLevel,
    next_display_level: displayLevel + 1,
    completed_track_title: trackTitle || undefined,
    completed_week_titles: weekTitles,
    continuation_instruction:
      'The learner finished this roadmap track. Generate the NEXT level: deeper applied work, integration, and professional practice. Use at least eight weekly milestones unless they explicitly asked for a micro course.',
  }
}

export type RegenerateRoadmapOptions = {
  /** Replace the teaching track with Archie “level N+1” using the prior bundle as context */
  continuation?: boolean
}

export type RoadmapKind = 'combined' | 'skills' | 'job_ready'

export type PersistedRoadmapResult = {
  id: string
  direction: string
  display_title: string
  progress_percent: number
  progress_skills_matched: number
  progress_skills_total: number
  /** Path (module) completion for teaching track — set on create; list GET has live counts. */
  nodes_completed_skills?: number
  nodes_total_skills?: number
  nodes_remaining_skills?: number
  nodes_percent_skills?: number
  nodes_completed_job?: number
  nodes_total_job?: number
  nodes_remaining_job?: number
  nodes_percent_job?: number
  estimated_completion: string | null
  created_at: string
  updated_at: string
  roadmap_kind: RoadmapKind
  recommended_job_title: string | null
  linked_skills_roadmap_id: string | null
  bundles: {
    skills: ReturnType<typeof normalizeArchieRoadmapBundle>
    job_ready: ReturnType<typeof normalizeArchieRoadmapBundle>
    certifications: ReturnType<typeof normalizeCertificationsBundle>
  }
}

const EMPTY_RAW: Record<string, unknown> = {}

async function insertRoadmapRow(
  supabase: SupabaseClient,
  userId: string,
  params: {
    direction: string
    display_title: string
    progress_percent: number
    estimated_completion: string | null
    bundles_raw: Record<string, unknown>
    roadmap_kind: RoadmapKind
    recommended_job_title: string | null
    linked_skills_roadmap_id: string | null
    skillCov: { matched: number; total: number }
  },
): Promise<PersistedRoadmapResult> {
  const bundlesNorm = {
    skills: normalizeArchieRoadmapBundle((params.bundles_raw.skills as Record<string, unknown>) ?? EMPTY_RAW),
    job_ready: normalizeArchieRoadmapBundle((params.bundles_raw.job_ready as Record<string, unknown>) ?? EMPTY_RAW),
    certifications: normalizeCertificationsBundle(
      (params.bundles_raw.certifications as Record<string, unknown>) ?? EMPTY_RAW,
    ),
  }
  const bundles = applyWeekGateToStoredBundles(bundlesNorm, DEFAULT_WEEK_GATE_PROGRESS)

  const now = new Date().toISOString()
  const { data: row, error } = await supabase
    .from('user_archie_roadmaps')
    .insert({
      user_id: userId,
      direction: params.direction,
      display_title: params.display_title,
      progress_percent: params.progress_percent,
      estimated_completion: params.estimated_completion,
      bundles_raw: params.bundles_raw as never,
      week_gate_progress: DEFAULT_WEEK_GATE_PROGRESS as unknown as Record<string, unknown>,
      roadmap_kind: params.roadmap_kind,
      recommended_job_title: params.recommended_job_title,
      linked_skills_roadmap_id: params.linked_skills_roadmap_id,
      updated_at: now,
    })
    .select('id, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  if (!row?.id) throw new Error('Insert failed')

  const skillsTotal = bundles.skills.milestones?.length ?? bundles.skills.sections.reduce((acc, s) => acc + s.modules.length, 0)
  const jobTotal = bundles.job_ready.milestones?.length ?? bundles.job_ready.sections.reduce((acc, s) => acc + s.modules.length, 0)

  return {
    id: row.id,
    direction: params.direction,
    display_title: params.display_title,
    progress_percent: params.progress_percent,
    progress_skills_matched: params.skillCov.matched,
    progress_skills_total: params.skillCov.total,
    nodes_completed_skills: 0,
    nodes_total_skills: skillsTotal,
    nodes_remaining_skills: skillsTotal,
    nodes_percent_skills: 0,
    nodes_completed_job: 0,
    nodes_total_job: jobTotal,
    nodes_remaining_job: jobTotal,
    nodes_percent_job: 0,
    estimated_completion: params.estimated_completion,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    roadmap_kind: params.roadmap_kind,
    recommended_job_title: params.recommended_job_title,
    linked_skills_roadmap_id: params.linked_skills_roadmap_id,
    bundles,
  }
}

/** Teaching-focused path + certifications only (no interview roadmap in this row). */
export async function generateAndInsertSkillsRoadmap(
  supabase: SupabaseClient,
  userId: string,
  direction: string,
): Promise<PersistedRoadmapResult> {
  const d = direction.trim()
  if (!d) throw new Error('direction required')

  const learnerSkills = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'skills',
    skip_profile_pulse: false,
  })
  const learnerCertifications = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: true,
  })

  const [rs, rc] = await Promise.all([
    proxyAgent('/archie/roadmap', { context: { ...learnerSkills, roadmap_intent: 'skills' } }),
    proxyAgent('/archie/certifications', {
      context: { ...learnerCertifications, roadmap_intent: 'certifications' },
    }),
  ])

  if (!rs.ok) throw new Error(await readProxyAgentError(rs))
  if (!rc.ok) throw new Error(await readProxyAgentError(rc))

  const rawSkills = (await rs.json()) as Record<string, unknown>
  const rawCert = (await rc.json()) as Record<string, unknown>

  const weeks = weeksFromRaw(rawSkills)
  const eta = etaDateFromWeeks(weeks)
  const displayTitle = titleFromRaw(rawSkills, d)
  const recommended = inferRecommendedJobTitle(d)

  const bundlesRawDb = { skills: rawSkills, job_ready: EMPTY_RAW, certifications: rawCert }
  const skillCov = await computeRoadmapSkillsProgressForUser(supabase, userId, bundlesRawDb)

  return insertRoadmapRow(supabase, userId, {
    direction: d,
    display_title: displayTitle,
    progress_percent: skillCov.percent,
    estimated_completion: eta,
    bundles_raw: bundlesRawDb,
    roadmap_kind: 'skills',
    recommended_job_title: recommended,
    linked_skills_roadmap_id: null,
    skillCov,
  })
}

/** Interview / job-readiness path only (separate from teaching roadmaps). */
export async function generateAndInsertJobReadyRoadmap(
  supabase: SupabaseClient,
  userId: string,
  jobTitle: string,
  linkedSkillsRoadmapId: string | null,
): Promise<PersistedRoadmapResult> {
  const d = jobTitle.trim()
  if (!d) throw new Error('job title required')

  const learnerJobReady = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: false,
  })

  const rj = await proxyAgent('/archie/roadmap', { context: { ...learnerJobReady, roadmap_intent: 'job_ready' } })
  if (!rj.ok) throw new Error(await readProxyAgentError(rj))

  const rawJob = (await rj.json()) as Record<string, unknown>
  const weeks = weeksFromRaw(rawJob)
  const eta = etaDateFromWeeks(weeks)
  const displayTitle = titleFromJobRaw(rawJob, d)

  const bundlesRawDb = { skills: EMPTY_RAW, job_ready: rawJob, certifications: EMPTY_RAW }
  const skillCov = await computeRoadmapSkillsProgressForUser(supabase, userId, bundlesRawDb)

  return insertRoadmapRow(supabase, userId, {
    direction: d,
    display_title: displayTitle,
    progress_percent: skillCov.percent,
    estimated_completion: eta,
    bundles_raw: bundlesRawDb,
    roadmap_kind: 'job_ready',
    recommended_job_title: null,
    linked_skills_roadmap_id: linkedSkillsRoadmapId,
    skillCov,
  })
}

/**
 * Legacy: one AI pass for skills + job_ready + certifications (same topic). New users should use split flows instead.
 */
export async function generateAndInsertLearningRoadmap(
  supabase: SupabaseClient,
  userId: string,
  direction: string,
): Promise<PersistedRoadmapResult> {
  const d = direction.trim()
  if (!d) throw new Error('direction required')

  const learnerSkills = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'skills',
    skip_profile_pulse: false,
  })
  const learnerJobReady = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: true,
  })
  const learnerCertifications = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: true,
  })

  const [rs, rj, rc] = await Promise.all([
    proxyAgent('/archie/roadmap', { context: { ...learnerSkills, roadmap_intent: 'skills' } }),
    proxyAgent('/archie/roadmap', { context: { ...learnerJobReady, roadmap_intent: 'job_ready' } }),
    proxyAgent('/archie/certifications', {
      context: { ...learnerCertifications, roadmap_intent: 'certifications' },
    }),
  ])

  if (!rs.ok) throw new Error(await readProxyAgentError(rs))
  if (!rj.ok) throw new Error(await readProxyAgentError(rj))
  if (!rc.ok) throw new Error(await readProxyAgentError(rc))

  const rawSkills = (await rs.json()) as Record<string, unknown>
  const rawJob = (await rj.json()) as Record<string, unknown>
  const rawCert = (await rc.json()) as Record<string, unknown>

  const weeks = Math.max(weeksFromRaw(rawSkills), weeksFromRaw(rawJob))
  const eta = etaDateFromWeeks(weeks)
  const displayTitle = titleFromRaw(rawSkills, d)

  const bundlesRawDb = { skills: rawSkills, job_ready: rawJob, certifications: rawCert }
  const skillCov = await computeRoadmapSkillsProgressForUser(supabase, userId, bundlesRawDb)

  return insertRoadmapRow(supabase, userId, {
    direction: d,
    display_title: displayTitle,
    progress_percent: skillCov.percent,
    estimated_completion: eta,
    bundles_raw: bundlesRawDb,
    roadmap_kind: 'combined',
    recommended_job_title: inferRecommendedJobTitle(d),
    linked_skills_roadmap_id: null,
    skillCov,
  })
}

async function regenerateCombinedRoadmap(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
  d: string,
  createdAt: string,
  continuationExtra?: Record<string, unknown>,
): Promise<PersistedRoadmapResult> {
  const learnerSkills = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'skills',
    skip_profile_pulse: false,
    extra_signals: continuationExtra,
  })
  const learnerJobReady = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: true,
  })
  const learnerCertifications = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: true,
  })

  const [rs, rj, rc] = await Promise.all([
    proxyAgent('/archie/roadmap', { context: { ...learnerSkills, roadmap_intent: 'skills' } }),
    proxyAgent('/archie/roadmap', { context: { ...learnerJobReady, roadmap_intent: 'job_ready' } }),
    proxyAgent('/archie/certifications', {
      context: { ...learnerCertifications, roadmap_intent: 'certifications' },
    }),
  ])

  if (!rs.ok) throw new Error(await readProxyAgentError(rs))
  if (!rj.ok) throw new Error(await readProxyAgentError(rj))
  if (!rc.ok) throw new Error(await readProxyAgentError(rc))

  const rawSkills = (await rs.json()) as Record<string, unknown>
  const rawJob = (await rj.json()) as Record<string, unknown>
  const rawCert = (await rc.json()) as Record<string, unknown>

  const weeks = Math.max(weeksFromRaw(rawSkills), weeksFromRaw(rawJob))
  const eta = etaDateFromWeeks(weeks)
  const displayTitle = titleFromRaw(rawSkills, d)

  const bundlesRawDb = { skills: rawSkills, job_ready: rawJob, certifications: rawCert }
  const skillCov = await computeRoadmapSkillsProgressForUser(supabase, userId, bundlesRawDb)

  const bundlesNorm = {
    skills: normalizeArchieRoadmapBundle(rawSkills),
    job_ready: normalizeArchieRoadmapBundle(rawJob),
    certifications: normalizeCertificationsBundle(rawCert),
  }
  const bundles = applyWeekGateToStoredBundles(bundlesNorm, DEFAULT_WEEK_GATE_PROGRESS)

  const { error: upErr } = await supabase
    .from('user_archie_roadmaps')
    .update({
      display_title: displayTitle,
      progress_percent: skillCov.percent,
      estimated_completion: eta,
      bundles_raw: bundlesRawDb as never,
      week_gate_progress: DEFAULT_WEEK_GATE_PROGRESS as unknown as Record<string, unknown>,
      recommended_job_title: inferRecommendedJobTitle(d),
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId)
    .eq('user_id', userId)

  if (upErr) throw new Error(upErr.message)

  const updatedAt = new Date().toISOString()
  return {
    id: roadmapId,
    direction: d,
    display_title: displayTitle,
    progress_percent: skillCov.percent,
    progress_skills_matched: skillCov.matched,
    progress_skills_total: skillCov.total,
    estimated_completion: eta,
    created_at: createdAt,
    updated_at: updatedAt,
    roadmap_kind: 'combined',
    recommended_job_title: inferRecommendedJobTitle(d),
    linked_skills_roadmap_id: null,
    bundles,
  }
}

async function regenerateSkillsOnlyRoadmap(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
  d: string,
  createdAt: string,
  continuationExtra?: Record<string, unknown>,
): Promise<PersistedRoadmapResult> {
  const learnerSkills = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'skills',
    skip_profile_pulse: false,
    extra_signals: continuationExtra,
  })
  const learnerCertifications = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: true,
  })

  const [rs, rc] = await Promise.all([
    proxyAgent('/archie/roadmap', { context: { ...learnerSkills, roadmap_intent: 'skills' } }),
    proxyAgent('/archie/certifications', {
      context: { ...learnerCertifications, roadmap_intent: 'certifications' },
    }),
  ])

  if (!rs.ok) throw new Error(await readProxyAgentError(rs))
  if (!rc.ok) throw new Error(await readProxyAgentError(rc))

  const rawSkills = (await rs.json()) as Record<string, unknown>
  const rawCert = (await rc.json()) as Record<string, unknown>

  const { data: prevRow } = await supabase
    .from('user_archie_roadmaps')
    .select('bundles_raw, linked_skills_roadmap_id, recommended_job_title')
    .eq('id', roadmapId)
    .eq('user_id', userId)
    .single()

  const prevBr = (prevRow?.bundles_raw || {}) as Record<string, unknown>
  const bundlesRawDb = {
    skills: rawSkills,
    job_ready: (prevBr.job_ready as Record<string, unknown>) ?? EMPTY_RAW,
    certifications: rawCert,
  }

  const weeks = weeksFromRaw(rawSkills)
  const eta = etaDateFromWeeks(weeks)
  const displayTitle = titleFromRaw(rawSkills, d)
  const skillCov = await computeRoadmapSkillsProgressForUser(supabase, userId, bundlesRawDb)
  const recommended =
    (typeof prevRow?.recommended_job_title === 'string' && prevRow.recommended_job_title.trim()) ||
    inferRecommendedJobTitle(d)

  const bundlesNorm = {
    skills: normalizeArchieRoadmapBundle(rawSkills),
    job_ready: normalizeArchieRoadmapBundle((bundlesRawDb.job_ready as Record<string, unknown>) ?? EMPTY_RAW),
    certifications: normalizeCertificationsBundle(rawCert),
  }
  const bundles = applyWeekGateToStoredBundles(bundlesNorm, DEFAULT_WEEK_GATE_PROGRESS)

  const { error: upErr } = await supabase
    .from('user_archie_roadmaps')
    .update({
      display_title: displayTitle,
      progress_percent: skillCov.percent,
      estimated_completion: eta,
      bundles_raw: bundlesRawDb as never,
      week_gate_progress: DEFAULT_WEEK_GATE_PROGRESS as unknown as Record<string, unknown>,
      recommended_job_title: recommended,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId)
    .eq('user_id', userId)

  if (upErr) throw new Error(upErr.message)

  const updatedAt = new Date().toISOString()
  return {
    id: roadmapId,
    direction: d,
    display_title: displayTitle,
    progress_percent: skillCov.percent,
    progress_skills_matched: skillCov.matched,
    progress_skills_total: skillCov.total,
    estimated_completion: eta,
    created_at: createdAt,
    updated_at: updatedAt,
    roadmap_kind: 'skills',
    recommended_job_title: recommended,
    linked_skills_roadmap_id: (prevRow?.linked_skills_roadmap_id as string | null) ?? null,
    bundles,
  }
}

async function regenerateJobReadyOnlyRoadmap(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
  d: string,
  createdAt: string,
  continuationExtra?: Record<string, unknown>,
): Promise<PersistedRoadmapResult> {
  const learnerJobReady = await buildLearnerContextPayload(supabase, userId, {
    direction: d,
    roadmap_intent: 'job_ready',
    skip_profile_pulse: false,
    extra_signals: continuationExtra,
  })

  const rj = await proxyAgent('/archie/roadmap', { context: { ...learnerJobReady, roadmap_intent: 'job_ready' } })
  if (!rj.ok) throw new Error(await readProxyAgentError(rj))

  const rawJob = (await rj.json()) as Record<string, unknown>

  const { data: prevRow } = await supabase
    .from('user_archie_roadmaps')
    .select('bundles_raw, linked_skills_roadmap_id')
    .eq('id', roadmapId)
    .eq('user_id', userId)
    .single()

  const prevBr = (prevRow?.bundles_raw || {}) as Record<string, unknown>
  const bundlesRawDb = {
    skills: (prevBr.skills as Record<string, unknown>) ?? EMPTY_RAW,
    job_ready: rawJob,
    certifications: (prevBr.certifications as Record<string, unknown>) ?? EMPTY_RAW,
  }

  const weeks = weeksFromRaw(rawJob)
  const eta = etaDateFromWeeks(weeks)
  const displayTitle = titleFromJobRaw(rawJob, d)
  const skillCov = await computeRoadmapSkillsProgressForUser(supabase, userId, bundlesRawDb)

  const bundlesNorm = {
    skills: normalizeArchieRoadmapBundle((bundlesRawDb.skills as Record<string, unknown>) ?? EMPTY_RAW),
    job_ready: normalizeArchieRoadmapBundle(rawJob),
    certifications: normalizeCertificationsBundle(
      (bundlesRawDb.certifications as Record<string, unknown>) ?? EMPTY_RAW,
    ),
  }
  const bundles = applyWeekGateToStoredBundles(bundlesNorm, DEFAULT_WEEK_GATE_PROGRESS)

  const { error: upErr } = await supabase
    .from('user_archie_roadmaps')
    .update({
      display_title: displayTitle,
      progress_percent: skillCov.percent,
      estimated_completion: eta,
      bundles_raw: bundlesRawDb as never,
      week_gate_progress: DEFAULT_WEEK_GATE_PROGRESS as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId)
    .eq('user_id', userId)

  if (upErr) throw new Error(upErr.message)

  const updatedAt = new Date().toISOString()
  return {
    id: roadmapId,
    direction: d,
    display_title: displayTitle,
    progress_percent: skillCov.percent,
    progress_skills_matched: skillCov.matched,
    progress_skills_total: skillCov.total,
    estimated_completion: eta,
    created_at: createdAt,
    updated_at: updatedAt,
    roadmap_kind: 'job_ready',
    recommended_job_title: null,
    linked_skills_roadmap_id: (prevRow?.linked_skills_roadmap_id as string | null) ?? null,
    bundles,
  }
}

export async function regenerateLearningRoadmap(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
  opts?: RegenerateRoadmapOptions,
): Promise<PersistedRoadmapResult> {
  const { data: existing, error: fetchErr } = await supabase
    .from('user_archie_roadmaps')
    .select('direction, created_at, roadmap_kind, bundles_raw')
    .eq('id', roadmapId)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !existing?.direction) {
    throw new Error('Roadmap not found')
  }

  const d = String(existing.direction).trim()
  const createdAt = existing.created_at as string
  const kind = (existing.roadmap_kind as RoadmapKind | null) || 'combined'

  let continuationExtra: Record<string, unknown> | undefined
  if (opts?.continuation) {
    if (kind === 'job_ready') {
      continuationExtra = continuationSignalsFromBundle(existing.bundles_raw, 'job_ready')
    } else {
      continuationExtra = continuationSignalsFromBundle(existing.bundles_raw, 'skills')
    }
  }

  if (kind === 'skills') {
    return regenerateSkillsOnlyRoadmap(supabase, userId, roadmapId, d, createdAt, continuationExtra)
  }
  if (kind === 'job_ready') {
    return regenerateJobReadyOnlyRoadmap(supabase, userId, roadmapId, d, createdAt, continuationExtra)
  }
  return regenerateCombinedRoadmap(supabase, userId, roadmapId, d, createdAt, continuationExtra)
}

export function normalizeStoredBundles(bundlesRaw: unknown): {
  skills: ReturnType<typeof normalizeArchieRoadmapBundle>
  job_ready: ReturnType<typeof normalizeArchieRoadmapBundle>
  certifications: ReturnType<typeof normalizeCertificationsBundle>
} | null {
  if (!bundlesRaw || typeof bundlesRaw !== 'object') return null
  const b = bundlesRaw as Record<string, unknown>
  const rs = (b.skills as Record<string, unknown> | undefined) ?? EMPTY_RAW
  const rj = (b.job_ready as Record<string, unknown> | undefined) ?? EMPTY_RAW
  const rc = (b.certifications as Record<string, unknown> | undefined) ?? EMPTY_RAW
  return {
    skills: normalizeArchieRoadmapBundle(rs),
    job_ready: normalizeArchieRoadmapBundle(rj),
    certifications: normalizeCertificationsBundle(rc),
  }
}

/** Normalized bundles with sequential week locks applied from `week_gate_progress`. */
export function mergeStoredBundlesWithWeekGate(
  bundlesRaw: unknown,
  weekGateProgress: unknown,
): NonNullable<ReturnType<typeof normalizeStoredBundles>> | null {
  const base = normalizeStoredBundles(bundlesRaw)
  if (!base) return null
  return applyWeekGateToStoredBundles(base, normalizeWeekGateProgress(weekGateProgress))
}

/** Replace one intent's raw bundle inside `user_archie_roadmaps.bundles_raw`. */
export async function updateRoadmapIntentBundleRaw(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
  intent: 'skills' | 'job_ready',
  raw: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase
    .from('user_archie_roadmaps')
    .select('bundles_raw')
    .eq('id', roadmapId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(error.message)
  const prev = (data?.bundles_raw || {}) as Record<string, unknown>
  const next = { ...prev, [intent]: raw }
  const { percent: progressPercent } = await computeRoadmapSkillsProgressForUser(supabase, userId, next)
  const { error: up } = await supabase
    .from('user_archie_roadmaps')
    .update({
      bundles_raw: next as never,
      progress_percent: progressPercent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId)
    .eq('user_id', userId)

  if (up) throw new Error(up.message)
}

/** Sets `estimated_completion` and rescales weekly syllabus to match the target date (no AI). */
export async function updateRoadmapTargetCompletionDate(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
  targetYmd: string,
): Promise<void> {
  const t = targetYmd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error('Invalid date (use YYYY-MM-DD)')

  const { data, error } = await supabase
    .from('user_archie_roadmaps')
    .select('bundles_raw, roadmap_kind')
    .eq('id', roadmapId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(error.code === 'PGRST116' ? 'Roadmap not found' : error.message)
  const br = (data?.bundles_raw || {}) as Record<string, unknown>
  const kind = ((data as { roadmap_kind?: string }).roadmap_kind as RoadmapKind | null) || 'combined'

  const rs = br.skills as Record<string, unknown> | undefined
  const rj = br.job_ready as Record<string, unknown> | undefined
  const newWeeks = calendarWeeksUntilTarget(t)

  let nextBundles: Record<string, unknown>

  if (kind === 'job_ready') {
    if (!rj || Object.keys(rj).length === 0) throw new Error('Roadmap data is incomplete')
    nextBundles = { ...br, job_ready: rescaleRoadmapRawForCalendarWeeks(rj, newWeeks, t) }
  } else if (kind === 'skills') {
    if (!rs || Object.keys(rs).length === 0) throw new Error('Roadmap data is incomplete')
    nextBundles = { ...br, skills: rescaleRoadmapRawForCalendarWeeks(rs, newWeeks, t) }
  } else {
    if (!rs || !rj || Object.keys(rs).length === 0 || Object.keys(rj).length === 0) {
      throw new Error('Roadmap data is incomplete')
    }
    nextBundles = {
      ...br,
      skills: rescaleRoadmapRawForCalendarWeeks(rs, newWeeks, t),
      job_ready: rescaleRoadmapRawForCalendarWeeks(rj, newWeeks, t),
    }
  }

  const skillCov = await computeRoadmapSkillsProgressForUser(supabase, userId, nextBundles)
  const { error: up } = await supabase
    .from('user_archie_roadmaps')
    .update({
      estimated_completion: t,
      bundles_raw: nextBundles as never,
      progress_percent: skillCov.percent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId)
    .eq('user_id', userId)

  if (up) throw new Error(up.message)
}
