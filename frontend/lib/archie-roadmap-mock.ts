/**
 * Archie (Architect) — mock roadmap builder. Later: merge Nova skills + goal via API.
 */

import type { WeeklyTimelineResult } from '@/lib/archie-weekly-timelines'
import {
  buildWeeklyTimelineForRoleString,
  buildUpskillWeeklyTimelineForRoleString,
} from '@/lib/archie-weekly-timelines'

/** Command center Archie tabs that use a weekly zigzag roadmap */
export type ArchieRoadmapMode = 'skills' | 'job_ready'

export type MilestoneStatus = 'completed' | 'in_progress' | 'available' | 'locked'

export type ArchieContentSuggestionType =
  | 'article'
  | 'youtube'
  | 'documentation'
  | 'book'
  | 'podcast'
  | 'course'
  | 'other'

export interface ArchieContentSuggestion {
  type: ArchieContentSuggestionType
  title: string
  url?: string
  description?: string
}

/** One ordered lesson inside a module — resources are curated (from Archie), not random search. */
export type ArchieGuidedLesson = {
  kind: 'lesson'
  id: string
  order: number
  title: string
  summary: string
  conceptTags: string[]
  resources: ArchieContentSuggestion[]
  /** Why this lesson was added or changed after a roadmap refresh (info / tooltip) */
  updateNote?: string
}

/** Checkpoint between lessons — may revisit concepts from earlier lessons (not 1:1 with modules). */
export type ArchieGuidedQuizCheckpoint = {
  kind: 'quiz_checkpoint'
  id: string
  order: number
  title: string
  summary: string
  revisitsConcepts?: string[]
  /** Drives question count in Pip: quick = short between lessons; module_capstone = longer end-of-module review */
  checkpointTier?: 'quick' | 'module_capstone'
}

export type ArchieGuidedStep = ArchieGuidedLesson | ArchieGuidedQuizCheckpoint

export interface ArchieRoadmapModule {
  id: string
  title: string
  summary: string
  skills: string[]
  /** Legacy: pooled suggestions; prefer `guidedSequence` lessons’ resources in the UI */
  contentSuggestions: ArchieContentSuggestion[]
  /** Which week (milestone id, e.g. week-2) this module belongs to */
  milestoneId?: string
  /** Ordered lessons + optional quiz checkpoints between them */
  guidedSequence?: ArchieGuidedStep[]
}

export interface ArchieRoadmapCheckpoint {
  id: string
  afterModuleId: string
  title: string
  topicsCovered: string[]
}

export interface ArchieRoadmapSection {
  id: string
  title: string
  summary?: string
  modules: ArchieRoadmapModule[]
  checkpoints: ArchieRoadmapCheckpoint[]
}

export interface ArchieMilestone {
  id: string
  /** Week badge on the node, e.g. W1, W2 */
  phaseLabel: string
  title: string
  /** Topic tags for this week (from syllabus) */
  topics: string[]
  /** Shown on the side card: e.g. "Completed", "65%", "Ready · 2h" */
  statusLine: string
  status: MilestoneStatus
  progressPercent?: number
  xpReward?: number
  /** Archie explainability: why this milestone exists and how it fits your plan */
  archieRationale: string
  /** One-sentence outcome for the week (from AI roadmap; used by Dexter for resources) */
  learningObjective?: string
  /** Short note on structure (e.g. skip redundancy) */
  structureNote?: string
}

export interface ArchieRoadmapBundle {
  trackTitle: string
  trackProgressPercent: number
  /** Gamified header */
  displayLevel: number
  roleSubtitle: string
  milestonesDone: number
  milestonesTotal: number
  displayXp: number
  /** Plan-level reasoning (Nova + goal) */
  planRationale: string
  milestones: ArchieMilestone[]
  /** roadmap.sh–style weekly syllabus + phases */
  weeklyTimeline: WeeklyTimelineResult
  sections: ArchieRoadmapSection[]
}

function titleCaseRole(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/** Heuristic “Nova” context from skills (mock merge). */
function novaContextLines(topSkills: string[]): string {
  if (topSkills.length === 0) {
    return 'Starting from your profile baseline, Archie assumes foundational modules unless you add skills in Skills.'
  }
  const joined = topSkills.slice(0, 5).join(', ')
  return `Nova mapped strengths in: ${joined}. Archie avoids re-teaching overlapping units where your level already satisfies prerequisites.`
}

/**
 * Mock status for week index on the visual roadmap (early weeks further along).
 */
function milestoneStatusForWeekIndex(
  index: number,
  total: number,
): { status: MilestoneStatus; progressPercent?: number } {
  if (total === 1) return { status: 'in_progress', progressPercent: 65 }
  if (total === 2) return index === 0 ? { status: 'completed' } : { status: 'in_progress', progressPercent: 65 }
  if (total === 3) {
    if (index === 0) return { status: 'completed' }
    if (index === 1) return { status: 'in_progress', progressPercent: 65 }
    return { status: 'available' }
  }
  if (index === 0 || index === 1) return { status: 'completed' }
  if (index === 2) return { status: 'in_progress', progressPercent: 65 }
  if (index === 3) return { status: 'available' }
  return { status: 'locked' }
}

function statusLineForWeek(
  status: MilestoneStatus,
  weekNum: number,
  progressPercent?: number,
): string {
  const label = `Week ${weekNum}`
  switch (status) {
    case 'completed':
      return `Completed · ${label}`
    case 'in_progress':
      return `${progressPercent ?? 65}% · ${label}`
    case 'available':
      return `Ready · ${label}`
    default:
      return `Locked · ${label}`
  }
}

function phaseNameForWeek(
  weekNum: number,
  phases: WeeklyTimelineResult['phases'],
): string | undefined {
  const p = phases.find((ph) => weekNum >= ph.weekStart && weekNum <= ph.weekEnd)
  return p?.name
}

/** One gamified node per syllabus week — the zigzag path is the weekly timeline. */
function buildMilestonesFromWeeklyWeeks(
  timeline: WeeklyTimelineResult,
  hasWebish: boolean,
  roadmapMode: ArchieRoadmapMode,
): ArchieMilestone[] {
  const { phases, weeks } = timeline
  const total = weeks.length

  return weeks.map((w, index) => {
    const { status, progressPercent } = milestoneStatusForWeekIndex(index, total)
    const phaseName = phaseNameForWeek(w.week, phases)

    const topicLine = w.topics.join(', ')
    const modeHint =
      roadmapMode === 'skills'
        ? 'Upskill mode: priority is measurable skill lift; portfolio and interview prep live in Job ready.'
        : 'Job-ready mode: this week advances toward hireable signal for your target role (projects, depth, polish).'

    const archieRationale = [
      `This week’s focus: ${w.title}. Skills to practice: ${topicLine}.`,
      phaseName ? `It sits in the “${phaseName}” segment of your ${timeline.archetypeLabel} track.` : '',
      modeHint,
      hasWebish && w.week <= 2 && /html|css|js|web|dom/i.test(`${w.title} ${topicLine}`)
        ? 'Nova overlap: if you already know these basics, Archie can compress this week after a short diagnostic.'
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const structureNote = phaseName
      ? `Segment: ${phaseName} · ${timeline.totalWeeks} weeks (${roadmapMode === 'skills' ? 'upskill sprint' : 'job-ready plan'})`
      : `${timeline.totalWeeks} weeks (${roadmapMode === 'skills' ? 'upskill sprint' : 'job-ready plan'})`

    const xpReward = status === 'completed' ? 80 + index * 15 : undefined

    return {
      id: `week-${w.week}`,
      phaseLabel: `W${w.week}`,
      title: w.title,
      topics: w.topics,
      statusLine: statusLineForWeek(status, w.week, progressPercent),
      status,
      progressPercent: status === 'in_progress' ? progressPercent : undefined,
      xpReward,
      archieRationale,
      structureNote,
    }
  })
}

export function buildArchieRoadmapForTargetRole(
  rawTargetRole: string,
  opts: { profileXp: number; profileLevel: number; topSkillNames: string[] },
  roadmapMode: ArchieRoadmapMode = 'job_ready',
): ArchieRoadmapBundle {
  const targetRole = titleCaseRole(rawTargetRole) || 'Your Target Role'
  const top = opts.topSkillNames.map((s) => s.trim()).filter(Boolean)

  const hasWebish = top.some((s) => /react|node|javascript|typescript|web|html|css|rest|api/i.test(s))

  const weeklyTimeline =
    roadmapMode === 'skills'
      ? buildUpskillWeeklyTimelineForRoleString(rawTargetRole)
      : buildWeeklyTimelineForRoleString(rawTargetRole)

  const milestones = buildMilestonesFromWeeklyWeeks(weeklyTimeline, hasWebish, roadmapMode)

  const done = milestones.filter((m) => m.status === 'completed').length
  const total = milestones.length
  const trackPct = Math.round(
    milestones.reduce((acc, m) => {
      if (m.status === 'completed') return acc + 100 / total
      if (m.status === 'in_progress') return acc + ((m.progressPercent ?? 0) / 100) * (100 / total)
      if (m.status === 'available') return acc + (0.5 * (100 / total))
      return acc
    }, 0),
  )

  const planRationale =
    roadmapMode === 'skills'
      ? [
          `Target role: ${targetRole}.`,
          `Skills tab — Archie’s upskill roadmap: ${weeklyTimeline.totalWeeks} weeks focused on core skill lift (${weeklyTimeline.archetypeLabel}). Each node is one week; interview prep and “hireable” packaging are emphasized in the Job ready tab.`,
          novaContextLines(top),
          hasWebish
            ? 'Nova overlap: where your map already shows strength, Archie steers hours into depth and adjacent skills instead of repeating basics.'
            : 'Foundations stay explicit until quiz data proves mastery; then Archie accelerates.',
          'Switch to Job ready when you want the full timeline toward role-ready delivery and portfolio signal.',
        ].join(' ')
      : [
          `Target role: ${targetRole}.`,
          `Job ready tab — Archie’s full ${weeklyTimeline.totalWeeks}-week path (${weeklyTimeline.archetypeLabel}) toward hireable depth: shipping, quality, and role-shaped outcomes. Each node is one week, roadmap.sh–style.`,
          novaContextLines(top),
          hasWebish
            ? 'Redundancy guard: REST/API-heavy intros are shortened because your skill map already indicates web exposure—Archie reallocates those hours to leadership and delivery depth.'
            : 'Full-stack breadth is included early to match typical role expectations; Archie can compress later if quiz signals stay strong.',
          'Dynamic restructuring: quiz outcomes and dwell-time from other agents feed Archie to add/remove foundation vs acceleration modules.',
        ].join(' ')

  return {
    trackTitle:
      roadmapMode === 'skills' ? `Upskill · ${targetRole}` : `Job-ready · ${targetRole}`,
    trackProgressPercent: trackPct,
    displayLevel: Math.max(1, opts.profileLevel),
    roleSubtitle:
      roadmapMode === 'skills'
        ? `${targetRole} · upskill focus`
        : `${targetRole} · job-ready depth`,
    milestonesDone: done,
    milestonesTotal: total,
    displayXp: opts.profileXp,
    planRationale,
    milestones,
    weeklyTimeline,
    sections: [],
  }
}
