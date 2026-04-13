import type { ArchieCertificationsBundle } from '@/lib/archie-certifications-mock'
import type {
  ArchieContentSuggestion,
  ArchieContentSuggestionType,
  ArchieGuidedLesson,
  ArchieGuidedQuizCheckpoint,
  ArchieGuidedStep,
  ArchieMilestone,
  ArchieRoadmapBundle,
  ArchieRoadmapCheckpoint,
  ArchieRoadmapModule,
  ArchieRoadmapSection,
} from '@/lib/archie-roadmap-mock'
import type { RoleArchetype, WeeklyTimelineResult } from '@/lib/archie-weekly-timelines'
import { isYoutubeResourceUrl } from '@/lib/youtube'

const SUGGESTION_TYPES: ArchieContentSuggestionType[] = [
  'article',
  'youtube',
  'documentation',
  'book',
  'podcast',
  'course',
  'other',
]

function coerceSuggestionType(raw: string | undefined): ArchieContentSuggestionType {
  if (raw && (SUGGESTION_TYPES as string[]).includes(raw)) return raw as ArchieContentSuggestionType
  return 'other'
}

function mapContentSuggestions(mo: Record<string, unknown>) {
  const sugRaw = Array.isArray(mo.contentSuggestions) ? mo.contentSuggestions : []
  return sugRaw.map((c) => {
    const co = (c || {}) as Record<string, unknown>
    return {
      type: coerceSuggestionType(typeof co.type === 'string' ? co.type : undefined),
      title: String(co.title || 'Resource'),
      url: co.url != null ? String(co.url) : undefined,
      description: co.description != null ? String(co.description) : undefined,
    }
  })
}

function parseCheckpointTier(
  q: Record<string, unknown>,
  r: Record<string, unknown>,
): ArchieGuidedQuizCheckpoint['checkpointTier'] {
  const raw = String(q.checkpointTier ?? r.checkpointTier ?? q.tier ?? r.tier ?? '').toLowerCase()
  if (raw === 'module_capstone' || raw === 'capstone' || raw === 'module_review') return 'module_capstone'
  if (raw === 'quick' || raw === 'short') return 'quick'
  return undefined
}

function normalizeResources(arr: unknown): {
  type: ArchieContentSuggestionType
  title: string
  url?: string
  description?: string
}[] {
  if (!Array.isArray(arr)) return []
  return arr.map((c) => {
    const co = (c || {}) as Record<string, unknown>
    return {
      type: coerceSuggestionType(typeof co.type === 'string' ? co.type : undefined),
      title: String(co.title || 'Resource'),
      url: co.url != null ? String(co.url) : undefined,
      description: co.description != null ? String(co.description) : undefined,
    }
  })
}

/** Parse LLM `guidedSequence` or legacy `lessons[]` into discriminated steps. */
function parseGuidedSequence(mo: Record<string, unknown>, modId: string): ArchieGuidedStep[] | null {
  const gs = mo.guidedSequence
  if (Array.isArray(gs) && gs.length > 0) {
    const out: ArchieGuidedStep[] = []
    let ord = 1
    for (const row of gs) {
      const r = (row || {}) as Record<string, unknown>
      const kind = String(r.kind || '').toLowerCase()
      const isQuizRow =
        kind === 'quiz_checkpoint' || kind === 'module_capstone' || kind === 'quick_quiz' || kind === 'checkpoint'
      if (isQuizRow) {
        const q = (r.quiz || r) as Record<string, unknown>
        const tierFromKind: ArchieGuidedQuizCheckpoint['checkpointTier'] =
          kind === 'module_capstone' ? 'module_capstone' : kind === 'quick_quiz' ? 'quick' : undefined
        const parsedTier = parseCheckpointTier(q, r)
        const quiz: ArchieGuidedQuizCheckpoint = {
          kind: 'quiz_checkpoint',
          id: String(q.id || r.id || `quiz-${modId}-${ord}`),
          order: typeof q.order === 'number' ? q.order : ord,
          title: String(q.title || r.title || 'Checkpoint quiz'),
          summary: String(q.summary || r.summary || ''),
          revisitsConcepts: Array.isArray(q.revisitsConcepts)
            ? (q.revisitsConcepts as unknown[]).map((x) => String(x))
            : Array.isArray(r.revisitsConcepts)
              ? (r.revisitsConcepts as unknown[]).map((x) => String(x))
              : undefined,
          checkpointTier: parsedTier ?? tierFromKind,
        }
        out.push(quiz)
        ord += 1
        continue
      }
      const lessonBlock = (r.lesson || r) as Record<string, unknown>
      const resources = normalizeResources(lessonBlock.resources ?? r.resources ?? [])
      const lesson: ArchieGuidedLesson = {
        kind: 'lesson',
        id: String(lessonBlock.id || r.id || `lesson-${modId}-${ord}`),
        order: typeof lessonBlock.order === 'number' ? lessonBlock.order : ord,
        title: String(lessonBlock.title || r.title || 'Lesson'),
        summary: String(lessonBlock.summary || r.summary || ''),
        conceptTags: Array.isArray(lessonBlock.conceptTags)
          ? (lessonBlock.conceptTags as unknown[]).map((x) => String(x))
          : Array.isArray(r.conceptTags)
            ? (r.conceptTags as unknown[]).map((x) => String(x))
            : [],
        resources,
        updateNote:
          lessonBlock.updateNote != null
            ? String(lessonBlock.updateNote)
            : r.updateNote != null
              ? String(r.updateNote)
              : undefined,
      }
      out.push(lesson)
      ord += 1
    }
    return out.length ? out : null
  }

  const lessonsOnly = mo.lessons
  if (Array.isArray(lessonsOnly) && lessonsOnly.length > 0) {
    const out: ArchieGuidedStep[] = []
    let ord = 1
    for (const row of lessonsOnly) {
      const lessonBlock = (row || {}) as Record<string, unknown>
      const resources = normalizeResources(lessonBlock.resources)
      out.push({
        kind: 'lesson',
        id: String(lessonBlock.id || `lesson-${modId}-${ord}`),
        order: typeof lessonBlock.order === 'number' ? lessonBlock.order : ord,
        title: String(lessonBlock.title || 'Lesson'),
        summary: String(lessonBlock.summary || ''),
        conceptTags: Array.isArray(lessonBlock.conceptTags)
          ? (lessonBlock.conceptTags as unknown[]).map((x) => String(x))
          : [],
        resources,
        updateNote: lessonBlock.updateNote != null ? String(lessonBlock.updateNote) : undefined,
      })
      ord += 1
    }
    return out
  }

  return null
}

/** Cap before splitting a lesson; room for ~4 YouTube + articles per lesson */
const MAX_RESOURCES_PER_LESSON = 14
/** Minimum lessons per module when enough curated links exist (paired with backend Tavily fill). */
const MIN_LESSONS_PER_MODULE = 5
function splitIntoNChunks<T>(arr: T[], n: number): T[][] {
  if (n <= 0 || arr.length === 0) return []
  const nActual = Math.min(n, arr.length)
  const chunks: T[][] = Array.from({ length: nActual }, () => [])
  const base = Math.floor(arr.length / nActual)
  let rem = arr.length % nActual
  let idx = 0
  for (let i = 0; i < nActual; i++) {
    const sz = base + (rem > 0 ? 1 : 0)
    if (rem > 0) rem -= 1
    chunks[i] = arr.slice(idx, idx + sz)
    idx += sz
  }
  return chunks
}

/** Pad chunk array to exactly `n` buckets (empty arrays) for merging with another dimension. */
function padResourceChunks(chunks: ArchieContentSuggestion[][], n: number): ArchieContentSuggestion[][] {
  const out = chunks.map((c) => [...c])
  while (out.length < n) out.push([])
  return out.slice(0, n)
}

function partitionYoutubeRest(pool: ArchieContentSuggestion[]): {
  yt: ArchieContentSuggestion[]
  rest: ArchieContentSuggestion[]
} {
  const yt: ArchieContentSuggestion[] = []
  const rest: ArchieContentSuggestion[] = []
  for (const r of pool) {
    const u = (r.url || '').trim()
    if (r.type === 'youtube' || (u && isYoutubeResourceUrl(u))) {
      yt.push(r.type === 'youtube' ? r : { ...r, type: 'youtube' })
    } else {
      rest.push(r)
    }
  }
  return { yt, rest }
}

/** Split YouTube links evenly across lessons (typically 3–4 each when ≥15 videos and 5 lessons). */
function splitYoutubeAcrossLessons(yt: ArchieContentSuggestion[], nLessons: number): ArchieContentSuggestion[][] {
  if (nLessons <= 0) return []
  if (yt.length === 0) return Array.from({ length: nLessons }, () => [])
  return padResourceChunks(splitIntoNChunks(yt, nLessons), nLessons)
}

function resourceDedupeKey(r: { url?: string; title: string }): string {
  const u = (r.url || '').trim()
  if (u) return `url:${u}`
  return `title:${r.title.trim().toLowerCase()}`
}

function dedupeSuggestions(items: ArchieContentSuggestion[]): ArchieContentSuggestion[] {
  const seen = new Set<string>()
  const out: ArchieContentSuggestion[] = []
  for (const x of items) {
    const k = resourceDedupeKey(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

function collectLessonResourceKeys(lessons: ArchieGuidedLesson[]): Set<string> {
  const s = new Set<string>()
  for (const L of lessons) {
    for (const r of L.resources) {
      s.add(resourceDedupeKey(r))
    }
  }
  return s
}

function distributePoolToLessons(lessons: ArchieGuidedLesson[], pool: ArchieContentSuggestion[]): void {
  if (pool.length === 0 || lessons.length === 0) return
  let rr = 0
  for (const res of pool) {
    const key = resourceDedupeKey(res)
    for (let attempt = 0; attempt < lessons.length; attempt++) {
      const li = (rr + attempt) % lessons.length
      const L = lessons[li]
      const existing = new Set(L.resources.map(resourceDedupeKey))
      if (!existing.has(key)) {
        L.resources.push(res)
        rr = (li + 1) % lessons.length
        break
      }
    }
  }
}

function splitLessonsByResourceCap(lessons: ArchieGuidedLesson[], mod: ArchieRoadmapModule, maxPer: number): ArchieGuidedLesson[] {
  const out: ArchieGuidedLesson[] = []
  for (const L of lessons) {
    if (L.resources.length <= maxPer) {
      out.push(L)
      continue
    }
    const chunks: ArchieContentSuggestion[][] = []
    for (let i = 0; i < L.resources.length; i += maxPer) {
      chunks.push(L.resources.slice(i, i + maxPer))
    }
    chunks.forEach((chunk, ci) => {
      out.push({
        ...L,
        id: ci === 0 ? L.id : `${L.id}-part-${ci + 1}`,
        title: chunks.length > 1 ? `${L.title} · Part ${ci + 1}` : L.title,
        resources: chunk,
      })
    })
  }
  return out
}

function buildLessonsFromResourcePool(mod: ArchieRoadmapModule, pool: ArchieContentSuggestion[]): ArchieGuidedLesson[] {
  const flat = dedupeSuggestions(pool)
  if (flat.length === 0) return []

  const nBuckets =
    flat.length >= MIN_LESSONS_PER_MODULE
      ? MIN_LESSONS_PER_MODULE
      : Math.max(1, Math.ceil(flat.length / Math.min(8, MAX_RESOURCES_PER_LESSON)))

  const { yt, rest } = partitionYoutubeRest(flat)
  const ytChunks = splitYoutubeAcrossLessons(yt, nBuckets)
  const restChunksRaw = rest.length === 0 ? [] : splitIntoNChunks(rest, nBuckets)
  const restChunks = padResourceChunks(restChunksRaw, nBuckets)

  return Array.from({ length: nBuckets }, (_, i) => {
    const ytPart = ytChunks[i] ?? []
    const restPart = restChunks[i] ?? []
    const merged = dedupeSuggestions([...ytPart, ...restPart])
    return {
      kind: 'lesson' as const,
      id: `lesson-${mod.id}-step-${i + 1}`,
      order: i + 1,
      title: nBuckets > 1 ? `${mod.title} · Lesson ${i + 1}` : mod.title,
      summary: mod.summary || 'Work through these curated resources in order — several videos plus reads per step.',
      conceptTags: mod.skills,
      resources: merged,
    }
  })
}

function interleaveLessonsAndQuizzes(lessons: ArchieGuidedLesson[], mod: ArchieRoadmapModule): ArchieGuidedStep[] {
  if (lessons.length === 0) return []
  const out: ArchieGuidedStep[] = []
  let ord = 1
  for (let i = 0; i < lessons.length; i++) {
    const L: ArchieGuidedLesson = { ...lessons[i], order: ord++ }
    out.push(L)
    if (i < lessons.length - 1) {
      const tags = [...new Set([...L.conceptTags, ...lessons[i + 1].conceptTags])].slice(0, 8)
      const q: ArchieGuidedQuizCheckpoint = {
        kind: 'quiz_checkpoint',
        id: `auto-quick-${mod.id}-${i}`,
        order: ord++,
        title: `Quick check · ${L.title.slice(0, 52)}`,
        summary: 'Short quiz on what you just covered before the next lesson.',
        revisitsConcepts: tags.length ? tags : [mod.title],
        checkpointTier: 'quick',
      }
      out.push(q)
    }
  }
  const cap: ArchieGuidedQuizCheckpoint = {
    kind: 'quiz_checkpoint',
    id: `auto-capstone-${mod.id}`,
    order: ord++,
    title: `${mod.title}: module review`,
    summary: 'Longer quiz covering this full module.',
    revisitsConcepts: mod.skills.length ? [...mod.skills] : [mod.title],
    checkpointTier: 'module_capstone',
  }
  out.push(cap)
  return out
}

/**
 * Use real module `contentSuggestions` (YouTube, courses, etc.), split into bite-sized lessons,
 * and insert short quizzes between lessons plus a longer capstone at the end.
 * Lesson steps from the model are kept; pooled URLs are merged in so nothing is dropped.
 */
function finalizeModuleGuidedSequence(mod: ArchieRoadmapModule): ArchieGuidedStep[] {
  const pool = dedupeSuggestions(mod.contentSuggestions || [])

  let lessons: ArchieGuidedLesson[]
  let rebuiltFromPool = false

  if (pool.length >= MIN_LESSONS_PER_MODULE) {
    lessons = buildLessonsFromResourcePool(mod, pool)
    rebuiltFromPool = true
  } else {
    const raw = mod.guidedSequence || []
    lessons = raw.filter((s): s is ArchieGuidedLesson => s.kind === 'lesson').map((L) => ({
      ...L,
      resources: dedupeSuggestions(L.resources || []),
    }))

    const used = collectLessonResourceKeys(lessons)
    const orphanPool = pool.filter((r) => !used.has(resourceDedupeKey(r)))

    if (lessons.length === 0 && pool.length > 0) {
      lessons = buildLessonsFromResourcePool(mod, pool)
      rebuiltFromPool = true
    } else if (lessons.length > 0 && orphanPool.length > 0) {
      distributePoolToLessons(lessons, orphanPool)
    } else if (lessons.length === 0 && pool.length === 0) {
      lessons = [
        {
          kind: 'lesson',
          id: `lesson-${mod.id}-placeholder`,
          order: 1,
          title: mod.title,
          summary: mod.summary || 'Content coming soon.',
          conceptTags: mod.skills,
          resources: [],
        },
      ]
    }
  }

  const fullPool = dedupeSuggestions(mod.contentSuggestions || [])
  const { yt } = partitionYoutubeRest(fullPool)
  if (
    !rebuiltFromPool &&
    yt.length >= MIN_LESSONS_PER_MODULE * 3 &&
    fullPool.length >= MIN_LESSONS_PER_MODULE
  ) {
    lessons = buildLessonsFromResourcePool(mod, fullPool)
  }

  lessons = splitLessonsByResourceCap(lessons, mod, MAX_RESOURCES_PER_LESSON)
  return interleaveLessonsAndQuizzes(lessons, mod)
}

function assignMilestoneIds(modules: ArchieRoadmapModule[], milestones: ArchieMilestone[]) {
  const w = milestones.length
  if (w === 0 || modules.length === 0) return
  const n = modules.length
  modules.forEach((mod, i) => {
    if (mod.milestoneId && milestones.some((m) => m.id === mod.milestoneId)) return
    const bucket = Math.min(w - 1, Math.floor((i * w) / Math.max(1, n)))
    mod.milestoneId = milestones[bucket].id
  })
}

function normalizeSections(raw: Record<string, unknown>, milestones: ArchieMilestone[]): ArchieRoadmapSection[] {
  const secRaw = Array.isArray(raw.sections) ? raw.sections : []
  const sections: ArchieRoadmapSection[] = secRaw.map((s, si) => {
    const o = (s || {}) as Record<string, unknown>
    const modulesRaw = Array.isArray(o.modules) ? o.modules : []
    const modules: ArchieRoadmapModule[] = modulesRaw.map((m, mi) => {
      const mo = (m || {}) as Record<string, unknown>
      const contentSuggestions = mapContentSuggestions(mo)
      const id = String(mo.id || `mod-${si + 1}-${mi + 1}`)
      const milestoneId =
        typeof mo.milestoneId === 'string' && mo.milestoneId.trim() ? String(mo.milestoneId).trim() : undefined

      const parsedGuided = parseGuidedSequence(mo, id)
      const base: ArchieRoadmapModule = {
        id,
        title: String(mo.title || `Module ${mi + 1}`),
        summary: String(mo.summary || ''),
        skills: Array.isArray(mo.skills) ? (mo.skills as unknown[]).map((x) => String(x)) : [],
        contentSuggestions,
        milestoneId,
        guidedSequence: parsedGuided ?? undefined,
      }
      base.guidedSequence = finalizeModuleGuidedSequence(base)
      return base
    })
    const cpRaw = Array.isArray(o.checkpoints) ? o.checkpoints : []
    const checkpoints: ArchieRoadmapCheckpoint[] = cpRaw.map((c, ci) => {
      const co = (c || {}) as Record<string, unknown>
      return {
        id: String(co.id || `cp-${si + 1}-${ci + 1}`),
        afterModuleId: String(co.afterModuleId || modules[modules.length - 1]?.id || ''),
        title: String(co.title || 'Checkpoint'),
        topicsCovered: Array.isArray(co.topicsCovered)
          ? (co.topicsCovered as unknown[]).map((t) => String(t))
          : [],
      }
    })
    return {
      id: String(o.id || `sec-${si + 1}`),
      title: String(o.title || `Section ${si + 1}`),
      summary: o.summary != null ? String(o.summary) : undefined,
      modules,
      checkpoints,
    }
  })
  return sections
}

const KNOWN_ARCHETYPES: RoleArchetype[] = [
  'fullstack',
  'frontend',
  'backend',
  'data',
  'devops',
  'leadership',
  'generic',
]

function coerceArchetype(raw: string | undefined): RoleArchetype {
  if (raw && (KNOWN_ARCHETYPES as string[]).includes(raw)) return raw as RoleArchetype
  return 'generic'
}

/** Maps LLM JSON to UI `ArchieRoadmapBundle` (best-effort). */
export function normalizeArchieRoadmapBundle(raw: Record<string, unknown>): ArchieRoadmapBundle {
  const weekly = (raw.weeklyTimeline || {}) as Record<string, unknown>
  const weeksRaw = Array.isArray(weekly.weeks) ? weekly.weeks : []
  const phasesRaw = Array.isArray(weekly.phases) ? weekly.phases : []

  const weeks = weeksRaw.map((w, i) => {
    const o = (w || {}) as Record<string, unknown>
    const weekNum = typeof o.week === 'number' ? o.week : i + 1
    return {
      week: weekNum,
      title: String(o.title || `Week ${weekNum}`),
      topics: Array.isArray(o.topics) ? (o.topics as unknown[]).map((t) => String(t)) : [],
    }
  })

  const phases = phasesRaw.map((p) => {
    const o = (p || {}) as Record<string, unknown>
    return {
      name: String(o.name || 'Phase'),
      weekStart: typeof o.weekStart === 'number' ? o.weekStart : 1,
      weekEnd: typeof o.weekEnd === 'number' ? o.weekEnd : weeks.length || 1,
    }
  })

  const archetype = coerceArchetype(typeof weekly.archetype === 'string' ? weekly.archetype : undefined)
  const weeklyTimeline: WeeklyTimelineResult = {
    archetype,
    archetypeLabel: String(weekly.archetypeLabel || 'Your path'),
    phases: phases.length ? phases : [{ name: 'Plan', weekStart: 1, weekEnd: weeks.length || 1 }],
    weeks,
    totalWeeks: typeof weekly.totalWeeks === 'number' ? weekly.totalWeeks : weeks.length || 1,
  }

  const milestonesRaw = Array.isArray(raw.milestones) ? raw.milestones : []
  const milestones: ArchieMilestone[] = milestonesRaw.map((m, idx) => {
    const o = (m || {}) as Record<string, unknown>
    const status = (['completed', 'in_progress', 'available', 'locked'].includes(String(o.status))
      ? o.status
      : 'locked') as ArchieMilestone['status']
    const learningObjective =
      o.learningObjective != null ? String(o.learningObjective) : undefined
    return {
      id: String(o.id || `week-${idx + 1}`),
      phaseLabel: String(o.phaseLabel || `W${idx + 1}`),
      title: String(o.title || weeklyTimeline.weeks[idx]?.title || `Week ${idx + 1}`),
      topics: Array.isArray(o.topics)
        ? (o.topics as unknown[]).map((t) => String(t))
        : weeklyTimeline.weeks[idx]?.topics || [],
      statusLine: String(o.statusLine || ''),
      status,
      progressPercent: typeof o.progressPercent === 'number' ? o.progressPercent : undefined,
      xpReward: typeof o.xpReward === 'number' ? o.xpReward : undefined,
      learningObjective,
      archieRationale: String(
        o.archieRationale ||
          (learningObjective ? learningObjective : 'See weekly focus in your plan.'),
      ),
      structureNote: o.structureNote != null ? String(o.structureNote) : undefined,
    }
  })

  const sections = normalizeSections(raw, milestones)
  for (const sec of sections) {
    assignMilestoneIds(sec.modules, milestones)
  }

  return {
    trackTitle: String(raw.trackTitle || 'Your learning track'),
    trackProgressPercent: Math.min(100, Math.max(0, Number(raw.trackProgressPercent) || 0)),
    displayLevel: Math.max(1, Number(raw.displayLevel) || 1),
    roleSubtitle: String(raw.roleSubtitle || ''),
    milestonesDone: Number(raw.milestonesDone) || 0,
    milestonesTotal: Number(raw.milestonesTotal) || milestones.length || 1,
    displayXp: Number(raw.displayXp) || 0,
    planRationale: String(raw.planRationale || ''),
    milestones,
    weeklyTimeline,
    sections,
  }
}

export function normalizeCertificationsBundle(raw: Record<string, unknown>): ArchieCertificationsBundle {
  const itemsRaw = Array.isArray(raw.items) ? raw.items : []
  const items = itemsRaw.map((it, i) => {
    const o = (it || {}) as Record<string, unknown>
    return {
      id: String(o.id || `cert-${i}`),
      name: String(o.name || 'Credential'),
      provider: String(o.provider || ''),
      focus: String(o.focus || ''),
      archieRationale: String(o.archieRationale || ''),
      prepHint: o.prepHint != null ? String(o.prepHint) : undefined,
    }
  })
  return {
    targetRole: String(raw.targetRole || ''),
    archetypeLabel: String(raw.archetypeLabel || 'Your field'),
    intro: String(raw.intro || ''),
    items,
  }
}

export function milestonesForDexter(bundle: ArchieRoadmapBundle) {
  return bundle.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    learning_objective:
      m.learningObjective || m.archieRationale?.slice(0, 400) || m.topics.join(', '),
  }))
}
