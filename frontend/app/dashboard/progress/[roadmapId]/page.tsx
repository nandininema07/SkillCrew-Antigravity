'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type { ProgressRoadmapSummary, ProgressRoadmapModule } from '@/lib/progress-analytics.types'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  Sparkles,
  Brain,
  ChevronDown,
  ChevronRight,
  Lock,
  Layers,
  Lightbulb,
  Target,
  PlayCircle,
} from 'lucide-react'

const goalLabel: Record<string, string> = {
  'skill-mastery': 'Skill mastery',
  'job-readiness': 'Job readiness',
  certification: 'Certification',
}

function statusIcon(status: ProgressRoadmapModule['status']) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    case 'in_progress':
      return <PlayCircle className="size-4 shrink-0 text-blue-500 dark:text-blue-400" />
    case 'locked':
      return <Lock className="size-4 shrink-0 text-muted-foreground/50" />
    default:
      return <Circle className="size-4 shrink-0 text-muted-foreground/60" />
  }
}

function statusBadge(status: ProgressRoadmapModule['status']) {
  switch (status) {
    case 'done':
      return (
        <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
          Completed
        </Badge>
      )
    case 'in_progress':
      return (
        <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px]">
          In progress
        </Badge>
      )
    case 'locked':
      return (
        <Badge variant="outline" className="text-muted-foreground/60 text-[10px]">
          Locked
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          Upcoming
        </Badge>
      )
  }
}

function ModuleCard({ mod, idx }: { mod: ProgressRoadmapModule; idx: number }) {
  const [open, setOpen] = useState(false)
  const isDone = mod.status === 'done'

  return (
    <div
      className={`rounded-xl border transition-all ${
        isDone
          ? 'border-emerald-500/25 bg-emerald-500/[0.03]'
          : mod.status === 'in_progress'
          ? 'border-blue-500/25 bg-blue-500/[0.02]'
          : 'border-border bg-card'
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl cursor-pointer hover:bg-muted/20 transition-colors"
        aria-expanded={open}
      >
        <span className="mt-0.5">{statusIcon(mod.status)}</span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {mod.phaseLabel && (
              <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                {mod.phaseLabel}
              </span>
            )}
            <span className="text-sm font-medium leading-snug">
              {mod.title}
            </span>
          </div>
          {mod.milestoneTitle && (
            <p className="text-[11px] text-muted-foreground truncate">{mod.milestoneTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {statusBadge(mod.status)}
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded X-AI body */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          {/* Summary */}
          {mod.summary && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="size-3" />
                What you&apos;ll cover
              </p>
              <p className="text-sm leading-relaxed text-foreground/85">{mod.summary}</p>
            </div>
          )}

          {/* X-AI: Archie's rationale */}
          {mod.archieRationale && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                <Brain className="size-3" />
                Why Archie included this
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">{mod.archieRationale}</p>
            </div>
          )}

          {/* Learning objective */}
          {mod.learningObjective && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Target className="size-3" />
                Learning goal
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">{mod.learningObjective}</p>
            </div>
          )}

          {/* Skills covered */}
          {mod.skills.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="size-3" />
                Skills covered
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mod.skills.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RoadmapDetailPage() {
  const params = useParams()
  const roadmapId = typeof params.roadmapId === 'string' ? params.roadmapId : ''
  const [roadmap, setRoadmap] = useState<ProgressRoadmapSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roadmapId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/analytics/progress/${roadmapId}`)
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setRoadmap(null)
            return
          }
          const body = await res.json().catch(() => ({}))
          throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to load roadmap')
        }
        const data = (await res.json()) as ProgressRoadmapSummary
        if (!cancelled) setRoadmap(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [roadmapId])

  if (!roadmapId) {
    return (
      <div className="p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Invalid roadmap</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Button variant="ghost" asChild className="gap-2">
            <Link href="/dashboard/progress">
              <ArrowLeft className="size-4" />
              Back to progress
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Could not load roadmap</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (!roadmap) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Button variant="ghost" asChild className="gap-2">
            <Link href="/dashboard/progress">
              <ArrowLeft className="size-4" />
              Back to progress
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Roadmap not found</CardTitle>
              <CardDescription>
                No saved roadmap matches this link, or it was removed.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const allModules = roadmap.modules ?? []
  const completed = roadmap.nodesCompleted ?? allModules.filter((m) => m.status === 'done').length
  const total = roadmap.nodesTotal ?? allModules.length
  const remaining = total - completed
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  const doneModules = allModules.filter((m) => m.status === 'done')
  const activeModules = allModules.filter((m) => m.status !== 'done')

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-8">

        {/* ── Back + Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" asChild className="w-fit gap-2 -ml-2 text-muted-foreground">
              <Link href="/dashboard/progress">
                <ArrowLeft className="size-4" />
                Progress
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{roadmap.title}</h1>
              <Badge variant="secondary" className="capitalize">
                {goalLabel[roadmap.goal] ?? roadmap.goal}
              </Badge>
            </div>
            <p className="text-muted-foreground max-w-2xl text-sm line-clamp-2">{roadmap.description}</p>
          </div>
        </div>

        {/* ── Overall progress bar ── */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers className="size-4 text-primary" />
                Module progress
              </div>
              <span className="text-sm font-bold tabular-nums">
                {total > 0 ? `${percent}%` : '—'}
              </span>
            </div>
            <Progress value={total > 0 ? percent : 0} className="h-3" />
            <div className="flex gap-6 text-sm text-muted-foreground pt-1">
              <span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{completed}</span> completed
              </span>
              <span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{remaining}</span> remaining
              </span>
              <span>
                <span className="font-semibold tabular-nums">{total}</span> total
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── X-AI: Archie's overall plan reasoning ── */}
        {roadmap.planRationale && (
          <Card className="border-violet-500/25 bg-violet-500/[0.03]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="size-5 text-violet-600 dark:text-violet-400" />
                Why Archie designed this roadmap for you
              </CardTitle>
              <CardDescription>Archie&apos;s reasoning behind your personalised learning plan</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">{roadmap.planRationale}</p>
            </CardContent>
          </Card>
        )}

        {/* ── Module breakdown ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <h2 className="text-xl font-semibold">All roadmap nodes</h2>
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">
              {total} week{total !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Click any week to see what&apos;s covered and <span className="text-violet-600 dark:text-violet-400 font-medium">why Archie included it</span> in your plan.
          </p>

          {allModules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Roadmap nodes will appear here once the roadmap finishes generating.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Completed weeks */}
              {doneModules.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    Completed &mdash; {doneModules.length} week{doneModules.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2">
                    {doneModules.map((mod, idx) => (
                      <ModuleCard key={mod.id} mod={mod} idx={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming / in-progress weeks */}
              {activeModules.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Circle className="size-3.5" />
                    {doneModules.length === 0 ? 'Full roadmap' : 'Still ahead'} &mdash; {activeModules.length} week{activeModules.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2">
                    {activeModules.map((mod, idx) => (
                      <ModuleCard key={mod.id} mod={mod} idx={idx} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Checkpoint timeline ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Checkpoint timeline & adaptations</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Your checkpoint submissions and how Archie adapted your roadmap based on performance.
          </p>

          {roadmap.quizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checkpoints in this roadmap bundle.</p>
          ) : (
            <div className="space-y-5 relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500/40 via-amber-500/20 to-red-500/40" />

              {(() => {
                const timelineEvents: Array<{
                  type: 'quiz' | 'adaptation'
                  timestamp: string
                  quiz?: typeof roadmap.quizzes[0]
                  adaptation?: typeof roadmap.adaptationThinking[0]
                }> = []

                for (const q of roadmap.quizzes) {
                  if (q.submittedAt) {
                    timelineEvents.push({ type: 'quiz', timestamp: q.submittedAt, quiz: q })
                  }
                }
                for (const a of roadmap.adaptationThinking ?? []) {
                  timelineEvents.push({ type: 'adaptation', timestamp: a.timestamp, adaptation: a })
                }

                timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

                return timelineEvents.map((event) => {
                  if (event.type === 'quiz' && event.quiz) {
                    const q = event.quiz
                    const submittedDate = new Date(q.submittedAt!).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit',
                    })

                    return (
                      <div key={`quiz-${q.id}`} className="relative pl-12">
                        <div className="absolute -left-5 top-4 size-8 rounded-full border-4 border-background bg-green-600 flex items-center justify-center">
                          <CheckCircle2 className="size-4 text-white" />
                        </div>
                        <Card className="border-green-500/20 bg-green-500/[0.03]">
                          <CardHeader className="pb-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex-1">
                                <CardTitle className="text-base leading-snug">{q.title}</CardTitle>
                                <div className="mt-3 rounded-lg border border-green-400/40 bg-green-400/10 px-3 py-2 inline-block">
                                  <p className="text-sm font-bold text-green-700 dark:text-green-400">{submittedDate}</p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {q.submittedAt && (
                                  <Badge className={q.scorePercent && q.scorePercent >= 60 ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}>
                                    {q.scorePercent?.toFixed(1) || '—'}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                                Why this checkpoint exists
                              </p>
                              <p className="text-sm leading-relaxed text-foreground/90">{q.purpose}</p>
                            </div>
                            {q.weakTopics && q.weakTopics.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                                  Areas needing improvement
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {q.weakTopics.map((topic) => (
                                    <Badge key={topic} variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {q.xpGained != null && (
                              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                  {q.xpGained >= 0 ? '+' : ''}{q.xpGained} XP earned
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )
                  } else if (event.type === 'adaptation' && event.adaptation) {
                    const thinking = event.adaptation
                    const adaptDate = new Date(thinking.timestamp).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit',
                    })

                    return (
                      <div key={`adapt-${thinking.timestamp}`} className="relative pl-12">
                        <div className="absolute -left-5 top-4 size-8 rounded-full border-4 border-background bg-red-600 flex items-center justify-center">
                          <Sparkles className="size-4 text-white" />
                        </div>
                        <Card className="border-red-500/20 bg-red-500/[0.03]">
                          <CardHeader className="pb-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-base leading-snug flex items-center gap-2">
                                  <span className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold ${thinking.scorePercent < 33.33 ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'}`}>
                                    {thinking.scorePercent.toFixed(1)}%
                                  </span>
                                  Roadmap adapted
                                </CardTitle>
                                <span className="mt-2 inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-900 shadow-sm dark:border-red-700 dark:bg-red-950/50 dark:text-red-100">
                                  Analyzed: {adaptDate}
                                </span>
                              </div>
                              <Badge variant="outline" className="shrink-0 font-normal">
                                <Sparkles className="mr-1 size-3" />
                                Agent adaptation
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
                              <p className="text-sm text-red-700 dark:text-red-400 font-semibold">Why this triggered adaptation</p>
                              <p className="mt-1 text-sm leading-relaxed text-foreground">{thinking.adaptationMessage}</p>
                            </div>
                            {thinking.weakTopics.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Areas needing focus</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {thinking.weakTopics.map((topic) => (
                                    <Badge key={topic} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1.5">
                                Deep-dive modules added
                              </p>
                              <p className="text-sm text-foreground">
                                {thinking.modulesAdded.length > 0
                                  ? `New modules on: ${thinking.modulesAdded.join(', ')}`
                                  : 'Roadmap is being optimized with targeted modules'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  }
                })
              })()}
            </div>
          )}
        </section>

        <Separator />

        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm text-muted-foreground">
            <BookOpen className="size-4 shrink-0" />
            <span>
              Module breakdown reflects your stored roadmap. Archie&apos;s reasoning explains why each module was chosen for your profile and direction.
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
