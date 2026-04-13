'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type {
  ArchieContentSuggestion,
  ArchieGuidedLesson,
  ArchieGuidedQuizCheckpoint,
  ArchieGuidedStep,
  ArchieMilestone,
  ArchieRoadmapBundle,
  ArchieRoadmapModule,
} from '@/lib/archie-roadmap-mock'
import { extractYoutubeVideoId, isYoutubeResourceUrl, youtubeThumbnailUrl } from '@/lib/youtube'
import { RoadmapMilestoneQuizDialog } from '@/components/dashboard/roadmap-milestone-quiz'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Briefcase,
  Check,
  ClipboardCheck,
  Crown,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Loader2,
  Lock,
  Podcast,
  Rocket,
  Sparkles,
  TrendingUp,
  Trophy,
  Youtube,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { CAPSTONE_XP_COST, levelFromXp } from '@/lib/gamification-xp'
import { buildCapstoneBrief } from '@/lib/capstone-brief'
import { fetchAndApplyProfileToStore } from '@/lib/sync-user-profile'
import { useAppStore } from '@/lib/store'

export type LastPipCheckpoint = {
  created_at: string
  score_percent: number
  weak_topics: string[]
  milestone_id: string | null
  week: number | null
  roadmap_mode: 'skills' | 'job_ready' | null
  xp_delta: number | null
  pip_summary_for_archie: string | null
  results_preview: Array<{ question_id?: string; correct?: boolean; topic?: string; note?: string }>
  flashcard_suggestions: unknown[]
}

function sortSteps(mod: ArchieRoadmapModule): ArchieGuidedStep[] {
  const g = mod.guidedSequence
  if (!g?.length) return []
  return [...g].sort((a, b) => a.order - b.order)
}

function ResourceTypeIcon({ type }: { type: string }) {
  if (type === 'youtube') return <Youtube className="size-3.5 text-red-600 dark:text-red-400" />
  if (type === 'podcast') return <Podcast className="size-3.5 text-violet-600 dark:text-violet-400" />
  if (type === 'course') return <GraduationCap className="size-3.5 text-blue-600 dark:text-blue-400" />
  return <ExternalLink className="size-3.5 text-muted-foreground" />
}

function YoutubeResourceCard({ r }: { r: ArchieContentSuggestion }) {
  const id = r.url ? extractYoutubeVideoId(r.url) : null
  const thumb = id ? youtubeThumbnailUrl(id, 'hq') : null
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm ring-1 ring-black/5 transition hover:border-red-500/40 hover:shadow-lg hover:ring-red-500/15 dark:ring-white/10"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- external CDN thumbnails
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-red-950/30 to-muted">
            <Youtube className="size-14 text-red-500/80" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100">
          <span className="flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
            <Youtube className="size-8" />
          </span>
        </div>
      </div>
      <div className="space-y-1 p-3.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{r.title}</p>
        {r.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
        ) : null}
      </div>
    </a>
  )
}

function OtherResourceCard({ r }: { r: ArchieContentSuggestion }) {
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 p-3 shadow-sm transition hover:border-primary/35 hover:shadow-md"
    >
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/50',
          r.type === 'course' && 'border-blue-500/20 bg-blue-500/10',
          r.type === 'podcast' && 'border-violet-500/20 bg-violet-500/10',
        )}
      >
        <ResourceTypeIcon type={r.type} />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{r.title}</p>
        {r.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
        ) : null}
      </div>
      <ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground opacity-60 transition group-hover:opacity-100" />
    </a>
  )
}

function LessonResourcesShowcase({ resources }: { resources: ArchieContentSuggestion[] }) {
  const youtubeRows: ArchieContentSuggestion[] = []
  const rest: ArchieContentSuggestion[] = []
  for (const r of resources) {
    if (r.url && (r.type === 'youtube' || isYoutubeResourceUrl(r.url))) youtubeRows.push(r)
    else rest.push(r)
  }
  if (resources.length === 0) {
    return <p className="text-sm text-muted-foreground">No links for this lesson yet.</p>
  }
  return (
    <div className="space-y-6">
      {youtubeRows.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-600/90 dark:text-red-400/90">Video</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {youtubeRows.map((r, i) => (
              <YoutubeResourceCard key={`${r.url ?? r.title}-${i}`} r={r} />
            ))}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          {youtubeRows.length > 0 ? (
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Read &amp; learn</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {rest.map((r, i) => (
              <OtherResourceCard key={`${r.url ?? r.title}-${i}`} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function milestoneTileClasses(status: ArchieMilestone['status']) {
  switch (status) {
    case 'completed':
      return 'border-chart-2/55 bg-chart-2/[0.11] text-chart-2 shadow-[0_0_24px_-6px] shadow-chart-2/30 dark:shadow-chart-2/25'
    case 'in_progress':
      return 'border-sparky/55 bg-sparky/[0.10] text-sparky shadow-[0_0_24px_-6px] shadow-sparky/30 dark:shadow-sparky/25'
    case 'available':
      return 'border-primary/45 bg-primary/[0.08] text-primary shadow-md shadow-primary/15'
    default:
      return 'border-border bg-muted/80 text-muted-foreground opacity-[0.85]'
  }
}

function milestoneIconClass(status: ArchieMilestone['status']) {
  switch (status) {
    case 'completed':
      return 'text-chart-2'
    case 'in_progress':
      return 'text-sparky'
    case 'available':
      return 'text-primary'
    default:
      return 'text-muted-foreground'
  }
}

function MilestoneTile({ milestone }: { milestone: ArchieMilestone }) {
  const { status } = milestone
  const locked = status === 'locked'
  const Icon =
    status === 'completed'
      ? Check
      : status === 'in_progress'
        ? Briefcase
        : status === 'available'
          ? TrendingUp
          : Lock

  return (
    <div className="relative shrink-0 pointer-events-none" aria-hidden>
      <div
        className={cn(
          'relative flex size-[4.25rem] items-center justify-center rounded-2xl border-2 sm:size-20',
          milestoneTileClasses(status),
          locked && 'opacity-60',
        )}
      >
        <Icon className={cn('size-8 sm:size-9', milestoneIconClass(status))} strokeWidth={2.25} />
        <span className="absolute -right-1 -top-1 flex min-h-8 min-w-8 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground shadow-md ring-2 ring-card sm:text-[11px]">
          {milestone.phaseLabel}
        </span>
      </div>
    </div>
  )
}

function SideCard({
  milestone,
  onOpenExplain,
  onOpenQuiz,
  quizDisabled,
  children,
}: {
  milestone: ArchieMilestone
  onOpenExplain: () => void
  onOpenQuiz: () => void
  quizDisabled: boolean
  children?: ReactNode
}) {
  const dim = milestone.status === 'locked'
  return (
    <Card
      className={cn(
        'border-border/90 bg-card/95 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/35 hover:shadow-md',
        dim && 'opacity-70',
      )}
    >
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{milestone.phaseLabel}</p>
          <h3 className={cn('font-semibold leading-snug text-card-foreground', dim && 'text-muted-foreground')}>
            {milestone.title}
          </h3>
        </div>
        {milestone.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {milestone.topics.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] font-normal text-muted-foreground">
                {t}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {milestone.status === 'completed' && (
            <>
              <Check className="size-3.5 text-chart-2" />
              <span className="font-medium text-chart-2">{milestone.statusLine}</span>
              {milestone.xpReward != null && (
                <Badge
                  variant="secondary"
                  className="border border-chart-3/30 bg-chart-3/15 text-chart-3 dark:bg-chart-3/20 dark:text-chart-3"
                >
                  +{milestone.xpReward} XP
                </Badge>
              )}
            </>
          )}
          {milestone.status === 'in_progress' && (
            <>
              <span className="font-medium text-sparky">In progress</span>
              <div className="w-full min-w-[140px] max-w-xs">
                <Progress
                  value={milestone.progressPercent ?? 0}
                  className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-sparky [&_[data-slot=progress-indicator]]:to-primary"
                />
              </div>
              <span className="tabular-nums text-muted-foreground">{milestone.progressPercent}%</span>
            </>
          )}
          {milestone.status === 'available' && (
            <span className="font-medium text-primary">{milestone.statusLine}</span>
          )}
          {milestone.status === 'locked' && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock className="size-3.5" />
              {milestone.statusLine}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="relative z-10 w-full border-primary/25 bg-primary/[0.04] hover:bg-primary/10 sm:w-auto"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenExplain()
            }}
          >
            <Sparkles className="size-3.5 text-archie" />
            Archie explains
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="relative z-10 w-full border-pip/35 bg-pip/10 hover:bg-pip/15 sm:w-auto"
            type="button"
            disabled={quizDisabled}
            title={
              quizDisabled
                ? milestone.status === 'locked'
                  ? 'Unlock this milestone on your path first'
                  : 'Save a roadmap to take Pip’s quiz'
                : 'Quiz & coding challenges for this week’s topics'
            }
            onClick={(e) => {
              e.stopPropagation()
              onOpenQuiz()
            }}
          >
            <Brain className="size-3.5 text-foreground" />
            Pip&apos;s quiz
          </Button>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function PhaseStrip({ bundle }: { bundle: ArchieRoadmapBundle }) {
  const { weeklyTimeline } = bundle
  if (weeklyTimeline.phases.length === 0) return null
  return (
    <div className="mb-6 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Archie · <span className="text-foreground">{weeklyTimeline.archetypeLabel}</span> ·{' '}
        <span className="tabular-nums">{weeklyTimeline.totalWeeks} weeks</span> on the path
      </p>
      <div className="flex flex-wrap gap-2">
        {weeklyTimeline.phases.map((p) => (
          <Badge key={`${p.name}-${p.weekStart}`} variant="secondary" className="border border-border/80 bg-muted/50 font-normal">
            {p.name}: W{p.weekStart}–{p.weekEnd}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function PathwayStatusLegend() {
  const items = [
    { label: 'Done', className: 'bg-chart-2 ring-chart-2/40' },
    { label: 'Active', className: 'bg-sparky ring-sparky/40' },
    { label: 'Next up', className: 'bg-primary ring-primary/35' },
    { label: 'Locked', className: 'bg-muted-foreground/35 ring-border' },
  ]
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">Path key</span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className={cn('size-2.5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-card', item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function GuidedStatusLegend() {
  const items = [
    { label: 'Lesson', className: 'border-primary/40 bg-primary/10' },
    { label: 'Quick check', className: 'border-pip/40 bg-pip/10' },
    { label: 'Module review', className: 'border-pip/60 bg-pip/15' },
  ]
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">Legend</span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className={cn('size-2.5 shrink-0 rounded-sm border', item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function ArchieGamifiedRoadmap({
  bundle,
  roadmapId,
  roadmapMode = 'skills',
  onRoadmapUpdated,
  lastPipCheckpoint,
  onContinuationRegenerate,
  continuationBusy,
  accountXp = 0,
  capstoneUnlockedAt = null,
  roadmapDirection,
  recommendedJobTitle = null,
}: {
  bundle: ArchieRoadmapBundle
  roadmapId?: string | null
  roadmapMode?: 'skills' | 'job_ready'
  onRoadmapUpdated?: () => void
  lastPipCheckpoint?: LastPipCheckpoint | null
  onContinuationRegenerate?: () => void | Promise<void>
  continuationBusy?: boolean
  accountXp?: number
  capstoneUnlockedAt?: string | null
  roadmapDirection?: string
  recommendedJobTitle?: string | null
}) {
  const allModules = useMemo(() => bundle.sections.flatMap((s) => s.modules), [bundle.sections])

  const [view, setView] = useState<'pathway' | 'guided'>('pathway')
  const [sel, setSel] = useState<{ moduleId: string; stepId: string } | null>(null)

  const enterGuided = useCallback((moduleId: string) => {
    const mod = allModules.find((m) => m.id === moduleId)
    if (!mod) return
    const steps = sortSteps(mod)
    const pick = steps[0]
    if (!pick) return
    setView('guided')
    setSel({ moduleId: mod.id, stepId: pick.id })
  }, [allModules])

  const selectedModule = sel ? allModules.find((m) => m.id === sel.moduleId) : undefined
  const selectedStep = selectedModule?.guidedSequence?.find((s) => s.id === sel?.stepId)
  const milestoneForModule = (mod: ArchieRoadmapModule | undefined) =>
    mod?.milestoneId ? bundle.milestones.find((x) => x.id === mod.milestoneId) : undefined

  const selectedMilestone = milestoneForModule(selectedModule)

  const [explainMilestone, setExplainMilestone] = useState<ArchieMilestone | null>(null)
  const [quizCtx, setQuizCtx] = useState<{
    milestone: ArchieMilestone
    extraTopicFocus?: string[]
    questionCount?: number
  } | null>(null)
  const [capstoneUnlocking, setCapstoneUnlocking] = useState(false)

  const capstoneBrief = useMemo(
    () =>
      buildCapstoneBrief({
        direction: roadmapDirection?.trim() || bundle.trackTitle,
        trackTitle: bundle.trackTitle,
        roleSubtitle: bundle.roleSubtitle,
        roadmapMode,
        recommendedJobTitle,
      }),
    [roadmapDirection, bundle.trackTitle, bundle.roleSubtitle, roadmapMode, recommendedJobTitle],
  )

  const isFirstGlobally =
    !!selectedModule &&
    !!selectedStep &&
    allModules[0]?.id === selectedModule.id &&
    sortSteps(allModules[0])[0]?.id === selectedStep.id

  const planInfoText = (() => {
    if (selectedStep?.kind === 'lesson') {
      const L = selectedStep as ArchieGuidedLesson
      if (L.updateNote?.trim()) return L.updateNote.trim()
      if (isFirstGlobally && bundle.planRationale?.trim()) return bundle.planRationale.trim()
    }
    return ''
  })()

  const checkpointQuestionCount = (q: ArchieGuidedQuizCheckpoint) => {
    if (q.checkpointTier === 'quick') return 3
    if (q.checkpointTier === 'module_capstone') return 10
    return 6
  }

  const pipAnalysis =
    lastPipCheckpoint &&
    (!lastPipCheckpoint.roadmap_mode || lastPipCheckpoint.roadmap_mode === roadmapMode)
      ? lastPipCheckpoint
      : null

  const trackComplete = bundle.trackProgressPercent >= 100
  const capstoneUnlocked = !!capstoneUnlockedAt

  const unlockCapstone = useCallback(async () => {
    if (!roadmapId || capstoneUnlocked) return
    setCapstoneUnlocking(true)
    try {
      const res = await fetch(`/api/learning-roadmaps/${roadmapId}/capstone/unlock`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json()) as {
        error?: string
        already_unlocked?: boolean
        xp?: number
        level?: number
      }
      if (!res.ok) throw new Error(data.error || 'Could not unlock capstone')
      if (data.already_unlocked) {
        toast.message('Capstone was already unlocked for this roadmap.')
      } else {
        toast.success(
          `You unlocked the capstone project! ${CAPSTONE_XP_COST.toLocaleString()} XP were deducted from your account.`,
        )
        if (typeof data.xp === 'number') {
          const prev = useAppStore.getState().user
          if (prev) {
            const nextLevel = typeof data.level === 'number' ? data.level : levelFromXp(data.xp)
            useAppStore.getState().setUser({ ...prev, xp: data.xp, level: nextLevel })
          }
        }
      }
      await fetchAndApplyProfileToStore()
      onRoadmapUpdated?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unlock failed')
    } finally {
      setCapstoneUnlocking(false)
    }
  }, [roadmapId, capstoneUnlocked, onRoadmapUpdated])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/40 text-card-foreground shadow-lg ring-1 ring-border/40 dark:from-card dark:via-card dark:to-muted/25 dark:ring-border/60">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.22]"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-archie/[0.06] via-transparent to-primary/[0.04] dark:from-archie/[0.10] dark:to-primary/[0.06]" />

      <div className="relative p-5 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Level {bundle.displayLevel}</p>
            <p className="text-sm text-muted-foreground">{bundle.roleSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {view === 'guided' && (
              <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => setView('pathway')}>
                <ArrowLeft className="mr-2 size-4" />
                Back to pathway
              </Button>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1.5 text-primary dark:bg-primary/[0.12]">
              <Zap className="size-5 shrink-0" aria-hidden />
              <span className="text-lg font-bold tabular-nums text-foreground">
                {accountXp.toLocaleString()} XP
              </span>
            </span>
            <div className="flex items-center gap-1.5 text-chart-3">
              <Trophy className="size-5" />
              <span className="text-sm font-semibold tabular-nums">
                {bundle.milestonesDone}/{bundle.milestonesTotal}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <h2 className="text-lg font-bold capitalize tracking-tight text-foreground sm:text-xl">{bundle.trackTitle}</h2>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Track progress</span>
              <span className="font-medium text-foreground">{bundle.trackProgressPercent}%</span>
            </div>
            <Progress
              value={bundle.trackProgressPercent}
              className="h-2.5 bg-muted [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-primary [&_[data-slot=progress-indicator]]:via-chart-2 [&_[data-slot=progress-indicator]]:to-primary"
            />
          </div>
        </div>

        {trackComplete ? (
          <div className="mb-5 rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.09] via-card to-primary/[0.06] p-4 shadow-sm sm:p-5">
            <p className="text-sm font-semibold text-foreground">Track complete — what&apos;s next</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You finished every milestone on this path. Keep momentum with applied practice, then advance the
              curriculum when you want a deeper level.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Ship a small project that uses the skills from your final weeks.</li>
              <li>
                If you have a combined roadmap, open the Job ready tab for interview-style reps next to this
                teaching track.
              </li>
              <li>
                Ready for more depth? Generate Level {bundle.displayLevel + 1} — Archie will build on what you
                completed here.
              </li>
            </ul>
            {roadmapId && onContinuationRegenerate ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={continuationBusy}
                  onClick={() => void onContinuationRegenerate()}
                >
                  <TrendingUp className="size-4" />
                  {continuationBusy ? 'Generating…' : `Generate level ${bundle.displayLevel + 1} of this course`}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {pipAnalysis ? (
          <div className="mb-5 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Your latest Pip checkpoint</p>
                  <p className="text-xs text-muted-foreground">
                    Week {pipAnalysis.week ?? '—'} ·{' '}
                    {pipAnalysis.milestone_id ? `${pipAnalysis.milestone_id}` : 'checkpoint'}
                    {pipAnalysis.created_at ? ` · ${new Date(pipAnalysis.created_at).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-foreground">{pipAnalysis.score_percent}%</p>
                {typeof pipAnalysis.xp_delta === 'number' ? (
                  <p className="text-xs text-muted-foreground">+{pipAnalysis.xp_delta} XP total</p>
                ) : null}
              </div>
            </div>
            {pipAnalysis.weak_topics.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Focus topics</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {pipAnalysis.weak_topics.map((t) => (
                    <Badge key={t} variant="secondary" className="font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {pipAnalysis.pip_summary_for_archie?.trim() ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {pipAnalysis.pip_summary_for_archie.trim()}
              </p>
            ) : null}
            
            {/* CORRECTED SECTION: Replaced Radix ScrollArea with native overflow scrolling */}
            {pipAnalysis.results_preview.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Question notes
                </p>
                <div className="max-h-80 overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-card/80 [scrollbar-gutter:stable]">
                  <ul className="space-y-2.5 p-2.5 text-sm">
                    {pipAnalysis.results_preview.map((r, idx) => (
                      <li
                        key={`${r.question_id || idx}`}
                        className="flex min-h-fit flex-col gap-1 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="shrink-0 font-semibold text-foreground">
                            {r.correct ? '✓' : '✗'}
                          </span>
                          {r.topic ? (
                            <span className="min-w-0 flex-1 text-muted-foreground">
                              {r.topic}
                            </span>
                          ) : null}
                        </div>
                        {r.note ? (
                          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                            {r.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            {/* END CORRECTED SECTION */}

            {pipAnalysis.flashcard_suggestions.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {pipAnalysis.flashcard_suggestions.length} flashcard idea
                {pipAnalysis.flashcard_suggestions.length === 1 ? '' : 's'} suggested — check your email for the full
                breakdown.
              </p>
            ) : null}
          </div>
        ) : null}

        <PhaseStrip bundle={bundle} />

        {allModules.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No modules in this roadmap yet. Generate or open a roadmap with sections and modules to see guided lessons here.
          </p>
        ) : view === 'pathway' ? (
          <>
            <div className="relative mx-auto max-w-3xl">
              <div
                className="pointer-events-none absolute left-1/2 top-8 bottom-8 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/25 to-transparent sm:block"
                aria-hidden
              />
              <div className="relative space-y-7 sm:space-y-9">
                {bundle.milestones.map((m, i) => {
                  const isLeft = i % 2 === 0
                  const mods = allModules.filter((mod) => mod.milestoneId === m.id)
                  const locked = m.status === 'locked'
                  const canOpenWeek = !locked && mods.length > 0
                  return (
                    <div
                      key={m.id}
                      role={canOpenWeek ? 'button' : undefined}
                      tabIndex={canOpenWeek ? 0 : undefined}
                      className={cn(
                        'relative flex flex-col gap-4 rounded-2xl border border-transparent p-2 outline-none transition-all sm:flex-row sm:items-stretch sm:gap-5 sm:p-3',
                        isLeft ? 'sm:flex-row' : 'sm:flex-row-reverse',
                        canOpenWeek &&
                          'cursor-pointer hover:border-primary/30 hover:bg-gradient-to-br hover:from-primary/[0.06] hover:to-muted/40 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring',
                        locked && 'opacity-[0.82]',
                      )}
                      onClick={
                        canOpenWeek
                          ? () => {
                              enterGuided(mods[0].id)
                            }
                          : undefined
                      }
                      onKeyDown={
                        canOpenWeek
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                enterGuided(mods[0].id)
                              }
                            }
                          : undefined
                      }
                      title={
                        canOpenWeek
                          ? 'Open lessons & quizzes for this week'
                          : locked
                            ? 'Complete the prior week’s quiz to unlock'
                            : undefined
                      }
                    >
                      <div className={cn('flex flex-1 sm:items-center', isLeft ? 'sm:justify-end' : 'sm:justify-start')}>
                        <MilestoneTile milestone={m} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <SideCard
                          milestone={m}
                          onOpenExplain={() => setExplainMilestone(m)}
                          onOpenQuiz={() => setQuizCtx({ milestone: m, questionCount: 6 })}
                          quizDisabled={m.status === 'locked' || !roadmapId}
                        >
                          {mods.length > 0 ? (
                            <div className="space-y-2 border-t border-border/60 pt-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {mods.length > 1 ? 'Modules — tap a week or pick one' : 'Open lessons & quizzes'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {mods.map((mod) => (
                                  <Button
                                    key={mod.id}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="relative z-10 h-auto max-w-full justify-start py-2 text-left text-xs font-normal leading-snug"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      enterGuided(mod.id)
                                    }}
                                  >
                                    <BookOpen className="mr-2 size-3.5 shrink-0 text-primary" />
                                    {mod.title}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </SideCard>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="relative mt-12 overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-card to-violet-600/[0.07] p-[1px] shadow-[0_0_60px_-12px_rgba(245,158,11,0.35)] dark:border-amber-400/20 dark:from-amber-400/[0.10] dark:via-card dark:to-violet-500/[0.12] dark:shadow-[0_0_70px_-10px_rgba(167,139,250,0.25)]">
              <div className="relative rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-card/95 via-card to-muted/30 px-5 py-6 sm:px-8 sm:py-8">
                <div
                  className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-gradient-to-br from-amber-400/20 to-violet-500/10 blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-primary/10 blur-3xl"
                  aria-hidden
                />

                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-violet-600/15 text-amber-700 shadow-inner dark:text-amber-300">
                        <Crown className="size-7" />
                      </div>
                      <div>
                        <Badge className="mb-1 border-amber-500/40 bg-amber-500/15 text-[10px] font-semibold uppercase tracking-widest text-amber-900 hover:bg-amber-500/20 dark:text-amber-100">
                          Culminating build
                        </Badge>
                        <h3 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                          {capstoneBrief.headline}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5 font-medium text-foreground">
                        <Zap className="size-4 text-primary" />
                        <span className="text-muted-foreground">Your XP</span>
                        <span className="tabular-nums font-bold text-primary">{accountXp.toLocaleString()}</span>
                      </span>
                    </div>

                    {capstoneUnlocked ? (
                      <div className="space-y-5">
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                          Unlocked — ship a portfolio-grade artifact that ties your weeks together.
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">{capstoneBrief.mission}</p>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Deliverables</p>
                            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                              {capstoneBrief.deliverables.map((line) => (
                                <li key={line} className="flex gap-2">
                                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                              Quality bar
                            </p>
                            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                              {capstoneBrief.qualityBar.map((line) => (
                                <li key={line} className="flex gap-2">
                                  <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-500 dark:text-violet-400" />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Study and implementation references
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {capstoneBrief.studyLinks.map((L) => (
                              <a
                                key={L.url}
                                href={L.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex gap-3 rounded-xl border border-border/80 bg-muted/25 p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
                              >
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-primary ring-1 ring-border/60">
                                  <ExternalLink className="size-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-foreground group-hover:text-primary">
                                    {L.title}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{L.description}</span>
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>

                        {capstoneUnlockedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Unlocked {new Date(capstoneUnlockedAt).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                    ) : !trackComplete ? (
                      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                        Complete every milestone on this track first. Then you can spend{' '}
                        <span className="font-semibold text-foreground">{CAPSTONE_XP_COST.toLocaleString()} account XP</span>{' '}
                        to reveal the full capstone brief, curated references, and the same portfolio checklist unlocked
                        learners see.
                      </p>
                    ) : accountXp < CAPSTONE_XP_COST ? (
                      <div className="max-w-prose space-y-2 text-sm leading-relaxed text-muted-foreground">
                        <p>
                          Track complete — you need at least{' '}
                          <span className="font-semibold text-foreground">{CAPSTONE_XP_COST.toLocaleString()} account XP</span>{' '}
                          to unlock. Your balance is{' '}
                          <span className="font-semibold tabular-nums text-foreground">{accountXp.toLocaleString()} XP</span>
                          ; earn more from daily login and Pip checkpoints, then return here.
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-prose space-y-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Track complete. Unlocking spends{' '}
                          <span className="font-semibold text-foreground">{CAPSTONE_XP_COST.toLocaleString()} account XP</span>{' '}
                          immediately. After unlock your wallet shows{' '}
                          <span className="tabular-nums font-semibold text-primary">
                            {(accountXp - CAPSTONE_XP_COST).toLocaleString()} XP
                          </span>{' '}
                          (plus any XP you earn afterward).
                        </p>
                        <Button
                          type="button"
                          size="default"
                          className="gap-2 bg-gradient-to-r from-amber-600 to-violet-600 text-white shadow-md hover:from-amber-500 hover:to-violet-500 dark:from-amber-500 dark:to-violet-500"
                          disabled={!roadmapId || capstoneUnlocking}
                          onClick={() => void unlockCapstone()}
                        >
                          {capstoneUnlocking ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Unlocking…
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-4" />
                              Unlock capstone for {CAPSTONE_XP_COST.toLocaleString()} XP
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <PathwayStatusLegend />
          </>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
              <aside className="w-full shrink-0 border-border lg:w-[min(100%,22rem)] lg:border-r lg:pr-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">This module</p>
                <ScrollArea className="max-h-[min(70vh,560px)] pr-3">
                  <div className="space-y-4 pb-2">
                    {selectedModule && selectedMilestone && (
                      <div className="rounded-xl border border-border/70 bg-card/40 p-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">{selectedMilestone.phaseLabel}</span> · {selectedMilestone.title}
                      </div>
                    )}
                    {selectedModule && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-foreground">{selectedModule.title}</p>
                        <ul className="space-y-1">
                          {sortSteps(selectedModule).map((step) => {
                            const active = sel?.moduleId === selectedModule.id && sel.stepId === step.id
                            const isQuiz = step.kind === 'quiz_checkpoint'
                            const tier = isQuiz ? (step as ArchieGuidedQuizCheckpoint).checkpointTier : undefined
                            return (
                              <li key={step.id}>
                                <button
                                  type="button"
                                  onClick={() => setSel({ moduleId: selectedModule.id, stepId: step.id })}
                                  className={cn(
                                    'flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors',
                                    isQuiz
                                      ? tier === 'module_capstone'
                                        ? 'border-pip/50 bg-pip/[0.12] hover:bg-pip/18'
                                        : 'border-pip/35 bg-pip/[0.07] hover:bg-pip/12'
                                      : 'border-primary/25 bg-primary/[0.04] hover:bg-primary/10',
                                    active && 'ring-2 ring-primary/40',
                                  )}
                                >
                                  {isQuiz ? (
                                    <Brain className="mt-0.5 size-3.5 shrink-0 text-pip" />
                                  ) : (
                                    <BookOpen className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                  )}
                                  <span className="min-w-0 flex-1 leading-snug">{step.title}</span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </aside>

              <section className="min-w-0 flex-1">
                {!selectedModule || !selectedStep ? (
                  <p className="text-sm text-muted-foreground">Select a step from the list.</p>
                ) : selectedStep.kind === 'lesson' ? (
                  <Card className="overflow-hidden border-border/90 bg-card/95 shadow-md">
                    <CardContent className="space-y-5 p-5 sm:p-7">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <Badge variant="secondary" className="border border-border/80 bg-muted/60 font-normal text-muted-foreground">
                            {selectedModule.title}
                          </Badge>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                              {(selectedStep as ArchieGuidedLesson).title}
                            </h3>
                            {planInfoText ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="rounded-full border border-border/80 bg-muted/50 p-1.5 text-muted-foreground hover:text-foreground"
                                    aria-label="Why this step was added or updated"
                                  >
                                    <HelpCircle className="size-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm text-balance">
                                  {planInfoText}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                          {selectedMilestone && (
                            <p className="text-xs text-muted-foreground">{selectedMilestone.phaseLabel} · {selectedMilestone.title}</p>
                          )}
                          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                            {(selectedStep as ArchieGuidedLesson).summary}
                          </p>
                          {(selectedStep as ArchieGuidedLesson).conceptTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {(selectedStep as ArchieGuidedLesson).conceptTags.map((t) => (
                                <Badge key={t} variant="outline" className="border-primary/20 text-[10px] font-normal">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedMilestone && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-pip/35 bg-pip/10 hover:bg-pip/15"
                            disabled={selectedMilestone.status === 'locked' || !roadmapId}
                            title={
                              selectedMilestone.status === 'locked'
                                ? 'Unlock this week on your path first'
                                : 'Full weekly quiz for this milestone (longer than quick checks)'
                            }
                            onClick={() => setQuizCtx({ milestone: selectedMilestone, questionCount: 6 })}
                          >
                            <Brain className="mr-1.5 size-3.5" />
                            Weekly quiz
                          </Button>
                        )}
                      </div>
                      <div className="border-t border-border/50 pt-5">
                        <LessonResourcesShowcase resources={(selectedStep as ArchieGuidedLesson).resources} />
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/90 bg-card/95 shadow-md">
                    <CardContent className="space-y-4 p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {selectedModule.title} ·{' '}
                            {(selectedStep as ArchieGuidedQuizCheckpoint).checkpointTier === 'module_capstone'
                              ? 'Module review'
                              : 'Quick check'}
                          </p>
                          <h3 className="text-lg font-semibold text-foreground">{(selectedStep as ArchieGuidedQuizCheckpoint).title}</h3>
                          {selectedMilestone && (
                            <p className="mt-1 text-[11px] text-muted-foreground">Week · {selectedMilestone.title}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{(selectedStep as ArchieGuidedQuizCheckpoint).summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedStep as ArchieGuidedQuizCheckpoint).checkpointTier === 'module_capstone'
                          ? 'About 10 questions — covers the whole module.'
                          : 'About 3 questions — short check between lessons.'}
                      </p>
                      {(selectedStep as ArchieGuidedQuizCheckpoint).revisitsConcepts &&
                        (selectedStep as ArchieGuidedQuizCheckpoint).revisitsConcepts!.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-foreground">Topics</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(selectedStep as ArchieGuidedQuizCheckpoint).revisitsConcepts!.map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      <Button
                        type="button"
                        className="bg-pip hover:bg-pip/90"
                        disabled={!selectedMilestone || selectedMilestone.status === 'locked' || !roadmapId}
                        onClick={() => {
                          if (!selectedMilestone) return
                          const q = selectedStep as ArchieGuidedQuizCheckpoint
                          const extra = [
                            ...(q.revisitsConcepts || []),
                            selectedModule.title,
                            ...(selectedModule.skills || []),
                          ]
                          setQuizCtx({
                            milestone: selectedMilestone,
                            extraTopicFocus: extra,
                            questionCount: checkpointQuestionCount(q),
                          })
                        }}
                      >
                        <Brain className="mr-2 size-4" />
                        Start quiz
                      </Button>
                      {selectedMilestone?.status === 'locked' ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="size-3.5" />
                          Unlock this week to take quizzes.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </section>
            </div>
            <GuidedStatusLegend />
          </>
        )}
      </div>

      <RoadmapMilestoneQuizDialog
        milestone={quizCtx?.milestone ?? null}
        open={!!quizCtx}
        onOpenChange={(v) => {
          if (!v) setQuizCtx(null)
        }}
        roadmapId={roadmapId ?? null}
        roadmapMode={roadmapMode}
        onGraded={onRoadmapUpdated}
        extraTopicFocus={quizCtx?.extraTopicFocus}
        questionCount={quizCtx?.questionCount}
      />

      <Dialog open={!!explainMilestone} onOpenChange={(v) => !v && setExplainMilestone(null)}>
        <DialogContent className="max-w-lg border-border">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-archie/15 px-2 py-0.5 text-xs font-semibold text-archie">Archie</span>
              <span>{explainMilestone?.title}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">Milestone rationale from the Architect agent</DialogDescription>
          </DialogHeader>
          {explainMilestone && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Why this milestone exists:</strong> {explainMilestone.archieRationale}
              </p>
              {explainMilestone.structureNote && (
                <p>
                  <strong className="text-foreground">Structure:</strong> {explainMilestone.structureNote}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}