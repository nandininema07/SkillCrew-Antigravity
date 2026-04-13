import type { SupabaseClient } from '@supabase/supabase-js'

import type { ArchieRoadmapBundle, ArchieRoadmapModule } from '@/lib/archie-roadmap-mock'
import type {
  ProgressAnalyticsPayload,
  ProgressRoadmapModule,
  ProgressRoadmapQuiz,
  ProgressRoadmapSummary,
  ProgressRoadmapTopic,
  RoadmapGoal,
} from '@/lib/progress-analytics.types'
import { roadmapSkillsCoverage } from '@/lib/roadmap-skills-progress'
import { mergeStoredBundlesWithWeekGate } from '@/lib/server/persist-learning-roadmap'
import { isMissingSchemaObject } from '@/lib/server/supabase-schema-helpers'

export type {
  ProgressAnalyticsPayload,
  ProgressRoadmapModule,
  ProgressRoadmapQuiz,
  ProgressRoadmapSummary,
  ProgressRoadmapTopic,
  RoadmapGoal,
} from '@/lib/progress-analytics.types'

function flattenSkillsModules(bundle: ArchieRoadmapBundle): ArchieRoadmapModule[] {
  return bundle.sections.flatMap((s) => s.modules)
}

function inferGoal(direction: string): RoadmapGoal {
  const d = direction.toLowerCase()
  if (d.includes('certif')) return 'certification'
  if (d.includes('job') && (d.includes('ready') || d.includes('role'))) return 'job-readiness'
  return 'skill-mastery'
}

function estimatedPathHours(bundle: ArchieRoadmapBundle): number {
  const w = Math.max(1, bundle.weeklyTimeline.totalWeeks || 1)
  return Math.max(4, Math.round(w * 4))
}

function buildTopicSplit(
  modules: ArchieRoadmapModule[],
  completedIds: Set<string>,
): { covered: ProgressRoadmapTopic[]; remaining: ProgressRoadmapTopic[] } {
  const covered: ProgressRoadmapTopic[] = []
  const remaining: ProgressRoadmapTopic[] = []
  let placedInProgress = false
  for (const m of modules) {
    if (completedIds.has(m.id)) {
      covered.push({ id: m.id, title: m.title, status: 'done' })
    } else if (!placedInProgress) {
      covered.push({ id: m.id, title: m.title, status: 'in_progress' })
      placedInProgress = true
    } else {
      remaining.push({ id: m.id, title: m.title, status: 'pending' })
    }
  }
  return { covered, remaining }
}

function checkpointsToQuizzes(bundle: ArchieRoadmapBundle): ProgressRoadmapQuiz[] {
  const out: ProgressRoadmapQuiz[] = []
  for (const sec of bundle.sections) {
    for (const cp of sec.checkpoints) {
      const purpose =
        cp.topicsCovered.length > 0
          ? `Focus: ${cp.topicsCovered.join(', ')}.`
          : 'Checkpoint to validate readiness before moving to the next segment of your plan.'
      out.push({
        id: cp.id,
        title: cp.title,
        purpose,
        followsTopicId: cp.afterModuleId || undefined,
      })
    }
  }
  return out
}

function skillLevelScore(level: string, confidence: number): number {
  const base: Record<string, number> = {
    beginner: 22,
    intermediate: 48,
    advanced: 72,
    expert: 92,
  }
  const b = base[level] ?? 28
  return Math.min(100, Math.round(b * (0.85 + Math.min(1, Math.max(0, confidence)) * 0.15)))
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0))
}

function weekBucketIndex(completedAt: string, now: Date): number | null {
  const t = new Date(completedAt).getTime()
  const n = now.getTime()
  const daysAgo = (n - t) / (24 * 3600 * 1000)
  if (daysAgo < 0 || daysAgo > 27.99) return null
  return Math.min(3, Math.floor(daysAgo / 7))
}

function weekLabel(bucket: number, now: Date): string {
  const end = new Date(now)
  end.setUTCDate(end.getUTCDate() - bucket * 7)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(start)}–${fmt(end)}`
}

export async function fetchProgressAnalytics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProgressAnalyticsPayload> {
  const now = new Date()
  const flags = {
    module_completion_track_available: true,
    assessment_performance_available: true,
  }

  const { data: roadmapRows, error: rmErr } = await supabase
    .from('user_archie_roadmaps')
    .select('id, direction, display_title, progress_percent, estimated_completion, bundles_raw, week_gate_progress, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (rmErr) {
    throw new Error(rmErr.message)
  }

  let trackRows: {
    roadmap_id: string
    module_id: string
    time_spent_minutes: number | null
    completed_at: string | null
    status: string
  }[] = []

  const { data: tr, error: trErr } = await supabase
    .from('module_completion_track')
    .select('roadmap_id, module_id, time_spent_minutes, completed_at, status')
    .eq('user_id', userId)

  if (trErr) {
    if (isMissingSchemaObject(trErr.message)) {
      flags.module_completion_track_available = false
    } else {
      throw new Error(trErr.message)
    }
  } else {
    trackRows = tr || []
  }

  let perfRows: { xp_earned: number | null; completed_at: string | null }[] = []
  const { data: pr, error: prErr } = await supabase
    .from('assessment_performance')
    .select('xp_earned, completed_at')
    .eq('user_id', userId)

  if (prErr) {
    if (isMissingSchemaObject(prErr.message)) {
      flags.assessment_performance_available = false
    } else {
      throw new Error(prErr.message)
    }
  } else {
    perfRows = pr || []
  }

  const { data: skillRows, error: skErr } = await supabase
    .from('skills')
    .select('name, level, confidence')
    .eq('user_id', userId)
    .order('confidence', { ascending: false })
    .limit(24)

  if (skErr && !isMissingSchemaObject(skErr.message)) {
    throw new Error(skErr.message)
  }

  const skills = skErr ? [] : skillRows || []

  const { data: allSkillNameRows } = await supabase.from('skills').select('name').eq('user_id', userId)
  const roadmapSkillNames = (allSkillNameRows || []).map((r) => String((r as { name?: string }).name || ''))

  const completedByRoadmap = new Map<string, Set<string>>()
  for (const r of trackRows) {
    if (r.status !== 'completed') continue
    if (!completedByRoadmap.has(r.roadmap_id)) completedByRoadmap.set(r.roadmap_id, new Set())
    completedByRoadmap.get(r.roadmap_id)!.add(r.module_id)
  }

  const roadmaps: ProgressRoadmapSummary[] = []
  const moduleTimeRows: Array<{ topic: string; allottedHours: number; spentHours: number }> = []
  const timeByRoadmapMinutes = new Map<string, number>()

  for (const row of roadmapRows || []) {
    const bundles = mergeStoredBundlesWithWeekGate(row.bundles_raw, row.week_gate_progress)
    if (!bundles) continue

    const bundle = bundles.skills
    const modules = flattenSkillsModules(bundle)
    const completed = completedByRoadmap.get(row.id) || new Set<string>()
    const { covered, remaining } = buildTopicSplit(modules, completed)

    const { percent: skillPct } = roadmapSkillsCoverage(roadmapSkillNames, row.bundles_raw)

    roadmaps.push({
      id: row.id,
      title: row.display_title || row.direction || 'Learning roadmap',
      description: bundle.planRationale?.slice(0, 280) || String(row.direction || '').slice(0, 280),
      goal: inferGoal(String(row.direction || '')),
      progressPercent: Math.min(100, Math.max(0, skillPct)),
      estimatedCompletion: row.estimated_completion,
      topicsCovered: covered,
      topicsRemaining: remaining,
      quizzes: checkpointsToQuizzes(bundle).map((q, idx) => ({
        ...q,
        milestoneId: `week-${idx + 1}`,
      })),
      adaptationThinking: [],
    })

    const pathHours = estimatedPathHours(bundle)
    const n = Math.max(1, modules.length)
    const allottedPerModule = pathHours / n

    for (const m of modules) {
      const spentMin =
        trackRows.find((t) => t.roadmap_id === row.id && t.module_id === m.id)?.time_spent_minutes ?? 0
      const spentHours = Math.round((spentMin / 60) * 100) / 100
      moduleTimeRows.push({
        topic: m.title.slice(0, 42),
        allottedHours: Math.round(allottedPerModule * 10) / 10,
        spentHours: spentHours,
      })
    }
  }

  for (const t of trackRows) {
    if (t.status !== 'completed') continue
    const prev = timeByRoadmapMinutes.get(t.roadmap_id) || 0
    timeByRoadmapMinutes.set(t.roadmap_id, prev + (t.time_spent_minutes || 0))
  }

  if (moduleTimeRows.length > 12) {
    moduleTimeRows.sort((a, b) => b.spentHours - a.spentHours)
    moduleTimeRows.splice(12)
  }

  const totalMinutes = [...timeByRoadmapMinutes.values()].reduce((a, b) => a + b, 0)
  const timeAllocation: Array<{ name: string; hours: number; percentage: number }> = []
  for (const rm of roadmapRows || []) {
    const mins = timeByRoadmapMinutes.get(rm.id) || 0
    if (mins <= 0) continue
    const hrs = Math.round((mins / 60) * 10) / 10
    const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0
    timeAllocation.push({
      name: (rm.display_title || rm.direction || 'Roadmap').slice(0, 48),
      hours: hrs,
      percentage: pct,
    })
  }
  timeAllocation.sort((a, b) => b.hours - a.hours)

  const weeklyTrend = [3, 2, 1, 0].map((bucket) => ({
    week: weekLabel(bucket, now),
    xp: 0,
    courses: 0,
  }))

  const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000
  let xpEarnedLast7Days = 0
  for (const p of perfRows) {
    const t = p.completed_at ? new Date(p.completed_at).getTime() : 0
    if (t >= sevenDaysAgo && p.xp_earned != null) {
      xpEarnedLast7Days += Number(p.xp_earned) || 0
    }
    const bi = p.completed_at ? weekBucketIndex(p.completed_at, now) : null
    if (bi !== null && p.xp_earned != null) {
      weeklyTrend[3 - bi].xp += Number(p.xp_earned) || 0
    }
  }

  for (const t of trackRows) {
    if (t.status !== 'completed' || !t.completed_at) continue
    const bi = weekBucketIndex(t.completed_at, now)
    if (bi !== null) weeklyTrend[3 - bi].courses += 1
  }

  const monthStart = startOfMonth(now)
  let monthlyAssessmentXp = 0
  let monthlyModuleCompletions = 0
  for (const p of perfRows) {
    const ct = p.completed_at ? new Date(p.completed_at) : null
    if (ct && ct >= monthStart && p.xp_earned != null) {
      monthlyAssessmentXp += Number(p.xp_earned) || 0
    }
  }
  for (const t of trackRows) {
    if (t.status !== 'completed' || !t.completed_at) continue
    if (new Date(t.completed_at) >= monthStart) monthlyModuleCompletions += 1
  }

  const skillDistribution = (skills as { name: string; level: string; confidence: number }[])
    .slice(0, 8)
    .map((s) => ({
      name: s.name.slice(0, 32),
      value: skillLevelScore(s.level, s.confidence),
    }))

  const totalPlanModules = (roadmapRows || []).reduce((acc, row) => {
    const b = mergeStoredBundlesWithWeekGate(row.bundles_raw, row.week_gate_progress)
    if (!b) return acc
    return acc + flattenSkillsModules(b.skills).length
  }, 0)

  const { data: profile } = await supabase.from('profiles').select('streak, xp').eq('id', userId).maybeSingle()

  const streak = Number(profile?.streak) || 0
  const monthXpTarget = 1000
  const moduleMonthTarget = Math.min(8, Math.max(2, Math.ceil(totalPlanModules / 4) || 4))
  const skilledCount = (skills as { level: string }[]).filter((s) =>
    ['intermediate', 'advanced', 'expert'].includes(s.level),
  ).length
  const skillGoalTarget = Math.min(6, Math.max(2, Math.min(6, skills.length || 2)))

  const goals: Array<{ label: string; progress: number; detail: string }> = [
    {
      label: 'Modules completed this month',
      progress: Math.min(100, moduleMonthTarget ? (monthlyModuleCompletions / moduleMonthTarget) * 100 : 0),
      detail: `${monthlyModuleCompletions} / ${moduleMonthTarget} modules`,
    },
    {
      label: 'Assessment XP this month',
      progress: Math.min(100, monthXpTarget ? (monthlyAssessmentXp / monthXpTarget) * 100 : 0),
      detail: `${monthlyAssessmentXp} / ${monthXpTarget} XP`,
    },
    {
      label: '7-day streak goal',
      progress: Math.min(100, (Math.min(streak, 7) / 7) * 100),
      detail: `${streak} / 7 days`,
    },
    {
      label: 'Skills tracked (intermediate+)',
      progress: skillGoalTarget ? Math.min(100, (skilledCount / skillGoalTarget) * 100) : 0,
      detail: `${skilledCount} / ${skillGoalTarget} skills`,
    },
  ]

  return {
    roadmaps,
    moduleTimeRows,
    weeklyTrend,
    xpEarnedLast7Days,
    monthlyAssessmentXp,
    monthlyModuleCompletions,
    skillsTracked: skills.length,
    proficientSkillsCount: skilledCount,
    skillDistribution,
    timeAllocation,
    goals,
    flags,
  }
}

export async function fetchRoadmapSummaryById(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
): Promise<ProgressRoadmapSummary | null> {
  const { data: row, error } = await supabase
    .from('user_archie_roadmaps')
    .select('id, direction, display_title, progress_percent, estimated_completion, bundles_raw, week_gate_progress')
    .eq('id', roadmapId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) return null

  const bundles = mergeStoredBundlesWithWeekGate(row.bundles_raw, row.week_gate_progress)
  if (!bundles) return null

  const { data: completions, error: compErr } = await supabase
    .from('module_completion_track')
    .select('module_id')
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId)
    .eq('status', 'completed')

  if (compErr && !isMissingSchemaObject(compErr.message)) {
    throw new Error(compErr.message)
  }

  const completed = new Set((completions || []).map((c) => c.module_id as string))

  const { data: nameRows } = await supabase.from('skills').select('name').eq('user_id', userId)
  const roadmapNames = (nameRows || []).map((r) => String((r as { name?: string }).name || ''))
  const { percent: skillPct } = roadmapSkillsCoverage(roadmapNames, row.bundles_raw)

  // Fetch checkpoint submissions and agent thinking events — scoped to this roadmap only
  const { data: contextEvents, error: evErr } = await supabase
    .from('user_context_events')
    .select('kind, payload, created_at')
    .eq('user_id', userId)
    .in('kind', ['checkpoint_graded', 'roadmap_adapted'])
    .eq('source', 'pip')
    .order('created_at', { ascending: false })
    .limit(200)

  if (evErr && !isMissingSchemaObject(evErr.message)) {
    console.warn('context_events fetch:', evErr.message)
  }

  // Filter in JS by roadmap_id stored in each event's payload so that checkpoints
  // from other roadmaps (e.g. a DSA roadmap) never appear on this roadmap's page.
  const contextEventsList = (contextEvents || []).filter((ev) => {
    const p = ev.payload as Record<string, unknown> | null
    if (!p || typeof p !== 'object') return false
    return p.roadmap_id === roadmapId
  })

  // Build submission map and adaptation thinking
  const submissionsByMilestoneId = new Map<string, { submittedAt: string; scorePercent: number; xpGained: number; weakTopics: string[] }>()
  const adaptationThinkingList: Array<{
    timestamp: string
    scorePercent: number
    reason: string
    weakTopics: string[]
    adaptationMessage: string
    modulesAdded: string[]
    roadmapMode: 'skills' | 'job_ready'
  }> = []

  for (const ev of contextEventsList) {
    if (ev.kind === 'checkpoint_graded' && ev.payload && typeof ev.payload === 'object') {
      const p = ev.payload as Record<string, unknown>
      const milestoneId = String(p.milestone_id || '')
      const scorePercent = Number(p.score_percent) || 0
      const xpDelta = Number(p.xp_delta) || 0
      const created = String(ev.created_at || '')
      const weakTopics = Array.isArray(p.weak_topics) ? (p.weak_topics as string[]) : []
      
      // Keep only the MOST RECENT submission per milestone (skip if we've already seen this one)
      if (milestoneId && !submissionsByMilestoneId.has(milestoneId)) {
        submissionsByMilestoneId.set(milestoneId, {
          submittedAt: created,
          scorePercent,
          xpGained: xpDelta,
          weakTopics,
        })
        
        // Only create adaptation thinking from the most recent submission
        if (scorePercent < 60) {
          adaptationThinkingList.push({
            timestamp: created,
            scorePercent,
            reason: scorePercent < 33.33 ? 'significantly below proficiency' : 'below proficiency target',
            weakTopics,
            adaptationMessage:
              scorePercent < 33.33
                ? `Score of ${scorePercent.toFixed(1)}% indicates the user is not yet proficient in these topics. Adding deep dive modules to strengthen fundamentals.`
                : `Score of ${scorePercent.toFixed(1)}% shows room for improvement. Recommending focused review modules.`,
            modulesAdded: weakTopics,
            roadmapMode: (p.roadmap_mode as 'skills' | 'job_ready') || 'skills',
          })
        }
      }
    }
  }

  let quizzes = checkpointsToQuizzes(bundles.skills)
  
  // Add milestone_id to each quiz based on sequential order (week-1, week-2, etc.)
  quizzes = quizzes.map((q, idx) => ({
    ...q,
    milestoneId: `week-${idx + 1}`,
  }))
  
  // Enrich quizzes with submission data
  quizzes = quizzes.map((q) => {
    // Match by milestone_id instead of id
    const submission = submissionsByMilestoneId.get(q.milestoneId || '')
    return {
      ...q,
      submittedAt: submission?.submittedAt,
      scorePercent: submission?.scorePercent,
      xpGained: submission?.xpGained,
      weakTopics: submission?.weakTopics,
    }
  })

  // Build milestoneId -> completed flag lookup via section modules
  // A milestone is "done" if any of its child modules (linked by milestoneId) are in the completed set.
  const completedMilestoneIds = new Set<string>()
  for (const sec of bundles.skills.sections ?? []) {
    for (const m of sec.modules ?? []) {
      if (m.milestoneId && completed.has(m.id)) {
        completedMilestoneIds.add(m.milestoneId)
      }
    }
  }

  // Build the X-AI module list directly from milestones — always the full roadmap scope.
  const milestonesList = bundles.skills.milestones ?? []
  let foundFirstIncomplete = false
  const enrichedModules: ProgressRoadmapModule[] = milestonesList.map((ms) => {
    const isDone = completedMilestoneIds.has(ms.id)
    let status: ProgressRoadmapModule['status']
    if (isDone) {
      status = 'done'
    } else if (!foundFirstIncomplete) {
      foundFirstIncomplete = true
      status = 'in_progress'
    } else {
      status = 'pending'
    }
    // Collect topics as the "skills" for this week
    const weekTopics = Array.isArray(ms.topics) ? ms.topics : []
    return {
      id: ms.id,
      title: ms.title,
      summary: ms.learningObjective || weekTopics.join(', '),
      skills: weekTopics,
      milestoneId: ms.id,
      phaseLabel: ms.phaseLabel,
      archieRationale: ms.archieRationale,
      learningObjective: ms.learningObjective,
      status,
    }
  })

  const nodesTotal = milestonesList.length
  const nodesCompleted = completedMilestoneIds.size

  // Build topic split from milestones for the legacy topicsCovered / topicsRemaining fields
  const covered: ProgressRoadmapTopic[] = enrichedModules
    .filter((m) => m.status === 'done' || m.status === 'in_progress')
    .map((m) => ({ id: m.id, title: m.title, status: m.status === 'done' ? 'done' : 'in_progress' }))
  const remaining: ProgressRoadmapTopic[] = enrichedModules
    .filter((m) => m.status === 'pending' || m.status === 'locked')
    .map((m) => ({ id: m.id, title: m.title, status: 'pending' }))

  return {
    id: row.id,
    title: row.display_title || row.direction || 'Learning roadmap',
    description: bundles.skills.planRationale?.slice(0, 280) || String(row.direction || '').slice(0, 280),
    planRationale: bundles.skills.planRationale || undefined,
    goal: inferGoal(String(row.direction || '')),
    progressPercent: Math.min(100, Math.max(0, skillPct)),
    nodesCompleted,
    nodesTotal,
    estimatedCompletion: row.estimated_completion,
    modules: enrichedModules,
    topicsCovered: covered,
    topicsRemaining: remaining,
    quizzes,
    adaptationThinking: adaptationThinkingList,
  }
}
