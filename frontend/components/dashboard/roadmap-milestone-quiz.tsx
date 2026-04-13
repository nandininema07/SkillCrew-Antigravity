'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import type { ArchieMilestone } from '@/lib/archie-roadmap-mock'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type CheckpointQuestion = {
  id: string
  kind?: string
  difficulty?: string
  topic?: string
  prompt?: string
  choices?: string[]
  starter_code?: string
}

function isQuestionAnswered(
  q: CheckpointQuestion,
  entry: { mcq_index?: number; text?: string } | undefined,
): boolean {
  const k = (q.kind || '').toLowerCase()
  const isMcq = (k === 'mcq' || k === '') && Array.isArray(q.choices) && q.choices.length >= 2
  const isCode = k === 'coding' || k === 'debug'
  const isOther = !isMcq && !isCode
  if (isMcq && entry?.mcq_index != null && entry.mcq_index >= 0) return true
  if (isCode && (entry?.text || '').trim().length > 0) return true
  if (isOther && (entry?.text || '').trim().length > 0) return true
  return false
}

function buildTopicsCovered(m: ArchieMilestone): string[] {
  const parts = [m.title, ...m.topics]
  if (m.learningObjective?.trim()) parts.push(m.learningObjective.trim())
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = p.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out.length ? out : [m.title]
}

type GradedPayload = {
  results?: { question_id?: string; correct?: boolean; topic?: string; difficulty?: string; kind?: string; note?: string }[]
  score_percent?: number
  weak_topics?: string[]
  pip_summary_for_archie?: string
  flashcard_suggestions?: { front?: string; back?: string; from_question_id?: string }[]
}

function mergeTopics(base: string[], extra: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of [...base, ...(extra || [])]) {
    const t = p.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out.length ? out : base
}

type XpPayload = {
  previous?: number
  next?: number
  net?: number
  quiz_net?: number
  score_bonus?: number
  pip_completion?: number
  per_question?: Array<{
    question_id: string
    correct: boolean
    difficulty: string
    xp: number
  }>
}

export function RoadmapMilestoneQuizDialog({
  milestone,
  open,
  onOpenChange,
  roadmapId,
  roadmapMode,
  onGraded,
  extraTopicFocus,
  questionCount,
}: {
  milestone: ArchieMilestone | null
  open: boolean
  onOpenChange: (open: boolean) => void
  roadmapId: string | null | undefined
  roadmapMode: 'skills' | 'job_ready'
  onGraded?: () => void
  /** Spiral / checkpoint quizzes: emphasize these topics (e.g. revisitsConcepts) */
  extraTopicFocus?: string[]
  /** Default 6 (weekly). Guided: quick checkpoints ≈3; module capstone ≈10 */
  questionCount?: number
}) {
  const [assessment, setAssessment] = useState<Record<string, unknown> | null>(null)
  const [answers, setAnswers] = useState<Record<string, { mcq_index?: number; text?: string }>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [graded, setGraded] = useState<GradedPayload | null>(null)
  const [xpNet, setXpNet] = useState<number | null>(null)
  const [xpDetail, setXpDetail] = useState<XpPayload | null>(null)
  const [revised, setRevised] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const questions = (Array.isArray(assessment?.questions) ? assessment?.questions : []) as CheckpointQuestion[]

  const answeredCount = useMemo(() => {
    let n = 0
    for (const q of questions) {
      const k = (q.kind || '').toLowerCase()
      const isMcq = (k === 'mcq' || k === '') && Array.isArray(q.choices) && q.choices.length >= 2
      const isCode = k === 'coding' || k === 'debug'
      const isOther = !isMcq && !isCode
      const a = answers[q.id]
      if (isMcq && a?.mcq_index != null && a.mcq_index >= 0) n += 1
      else if (isCode && (a?.text || '').trim().length > 0) n += 1
      else if (isOther && (a?.text || '').trim().length > 0) n += 1
    }
    return n
  }, [questions, answers])

  const lastStep = questions.length > 0 ? questions.length - 1 : 0
  const safeStep = Math.min(Math.max(0, stepIndex), lastStep)
  const currentQuestion = questions[safeStep]
  const currentAnswered = currentQuestion
    ? isQuestionAnswered(currentQuestion, answers[currentQuestion.id])
    : false
  const stepProgressPct = questions.length ? ((safeStep + 1) / questions.length) * 100 : 0

  useEffect(() => {
    if (!open || !milestone || !roadmapId) {
      setAssessment(null)
      setAnswers({})
      setGraded(null)
      setXpNet(null)
      setXpDetail(null)
      setRevised(false)
      setStepIndex(0)
      return
    }

    const ctrl = new AbortController()
    setLoading(true)
    setAssessment(null)
    setAnswers({})
    setGraded(null)
    setXpNet(null)
    setXpDetail(null)
    setRevised(false)
    setResultsOpen(false)
    setStepIndex(0)

    const topics = mergeTopics(buildTopicsCovered(milestone), extraTopicFocus)

    void (async () => {
      try {
        const res = await fetch(`/api/learning-roadmaps/${roadmapId}/checkpoint/build`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            topics_covered: topics,
            question_count: typeof questionCount === 'number' && questionCount > 0 ? questionCount : 6,
            roadmap_mode: roadmapMode,
          }),
        })
        const text = await res.text()
        let data: { assessment?: Record<string, unknown>; error?: string } = {}
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error(`Build quiz failed: ${res.status} ${res.statusText} — ${text}`)
        }
        if (!res.ok) throw new Error(data.error || 'Could not build quiz')
        const a = data.assessment || null
        const n = Array.isArray(a?.questions) ? (a.questions as unknown[]).length : 0
        if (!a || n === 0) {
          toast.error('Pip could not generate questions for this milestone. Try again in a moment.')
          onOpenChange(false)
          return
        }
        setAssessment(a)
        setStepIndex(0)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        toast.error(e instanceof Error ? e.message : 'Quiz failed to load')
        onOpenChange(false)
      } finally {
        setLoading(false)
      }
    })()

    return () => ctrl.abort()
  }, [open, milestone, roadmapId, onOpenChange, extraTopicFocus, questionCount])

  const submit = async () => {
    if (!assessment || !roadmapId) return
    if (answeredCount < questions.length) {
      toast.message('Answer every question', { description: 'Pip is waiting for your full attempt.' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/learning-roadmaps/${roadmapId}/checkpoint/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment,
          answers,
          roadmap_mode: roadmapMode,
          revise_on_weak: true,
          milestone_id: milestone?.id,
        }),
      })
      const text = await res.text()
      let data: {
        error?: string
        graded?: GradedPayload
        xp?: XpPayload
        revised?: unknown
        week_advanced?: boolean
      } = {}
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Submit failed: ${res.status} ${res.statusText} — ${text}`)
      }
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      setGraded(data.graded ?? null)
      setXpNet(typeof data.xp?.net === 'number' ? data.xp.net : null)
      setXpDetail(data.xp ?? null)
      setRevised(!!data.revised)
      setResultsOpen(true)
      if (data.revised) {
        toast.info('Archie may adjust your roadmap for weak spots.')
      }
      if (data.week_advanced) {
        toast.success('Next week unlocked — score over 75% on each week’s Pip quiz to keep going.')
      }
      onGraded?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const close = (v: boolean) => {
    if (!v) {
      setAssessment(null)
      setAnswers({})
      setGraded(null)
      setXpNet(null)
      setXpDetail(null)
      setRevised(false)
      setStepIndex(0)
    }
    onOpenChange(v)
  }

  const scorePct =
    graded?.score_percent ??
    (graded?.results?.length
      ? Math.round(
          (graded.results.filter((r) => r.correct).length / graded.results.length) * 100,
        )
      : null)

  const questionById = useMemo(() => {
    const m = new Map<string, CheckpointQuestion>()
    for (const q of questions) {
      if (q.id) m.set(q.id, q)
    }
    return m
  }, [questions])

  const xpByQuestionId = useMemo(() => {
    const m = new Map<string, { xp: number; difficulty: string }>()
    for (const row of xpDetail?.per_question || []) {
      m.set(row.question_id, { xp: row.xp, difficulty: row.difficulty })
    }
    return m
  }, [xpDetail?.per_question])

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        showCloseButton
        className={cn(
          'fixed left-[50%] top-4 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden border-border p-0 sm:top-6 sm:max-h-[calc(100vh-3rem)]',
        )}
      >
        <div className="shrink-0 border-b border-border/80 bg-gradient-to-r from-pip/12 via-card to-primary/5 px-4 py-4 sm:px-6">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-pip/20 px-2 py-0.5 text-xs font-semibold text-foreground">
                <Brain className="size-3.5" aria-hidden />
                Pip
              </span>
              {milestone ? (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {milestone.phaseLabel}
                </Badge>
              ) : null}
            </div>
            <DialogTitle className="text-left text-lg leading-snug">
              {graded ? 'How you did' : milestone ? `Quiz · ${milestone.title}` : 'Milestone quiz'}
            </DialogTitle>
            <DialogDescription className="text-left text-xs sm:text-sm">
              {graded
                ? 'Pip graded your answers. Wrong picks become study signals for Archie — not judgment, just curiosity.'
                : 'Quick mix of multiple choice and (when it fits) small coding challenges. Pip checks your answers and shares results with Archie.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="size-10 animate-spin text-pip" />
              <p className="text-sm text-muted-foreground">Pip is crafting your questions…</p>
            </div>
          )}

          {!loading && !graded && assessment && currentQuestion && (
            <div className="space-y-6 pr-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-xs text-muted-foreground">
                  Question {safeStep + 1} of {questions.length}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {answeredCount}/{questions.length} answered
                </span>
              </div>
              <Progress
                value={stepProgressPct}
                className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-pip"
              />

              {(() => {
                const q = currentQuestion
                const qi = safeStep
                const kind = (q.kind || '').toLowerCase()
                const isMcq =
                  (kind === 'mcq' || kind === '') && Array.isArray(q.choices) && (q.choices as string[]).length >= 2
                const isCode = kind === 'coding' || kind === 'debug'
                const isOther = !isMcq && !isCode
                return (
                  <div
                    key={q.id}
                    className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Question {qi + 1} of {questions.length}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {q.kind || 'mcq'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {q.difficulty || 'medium'}
                      </Badge>
                      {q.topic ? (
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          {q.topic}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{q.prompt}</p>
                    {isMcq && Array.isArray(q.choices) && (
                      <RadioGroup
                        value={answers[q.id]?.mcq_index != null ? String(answers[q.id]?.mcq_index) : ''}
                        onValueChange={(v) =>
                          setAnswers((a) => ({
                            ...a,
                            [q.id]: { ...a[q.id], mcq_index: Number.parseInt(v, 10) },
                          }))
                        }
                        className="gap-2"
                      >
                        {q.choices!.map((choice, idx) => (
                          <label
                            key={idx}
                            htmlFor={`pip-${q.id}-${idx}`}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-muted/50',
                              answers[q.id]?.mcq_index === idx && 'border-pip/40 bg-pip/10',
                            )}
                          >
                            <RadioGroupItem value={String(idx)} id={`pip-${q.id}-${idx}`} className="mt-1" />
                            <span className="text-sm leading-snug">{choice}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                    {isCode && (
                      <div className="space-y-2">
                        {q.starter_code && (
                          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] leading-relaxed">
                            {q.starter_code}
                          </pre>
                        )}
                        <Label className="text-xs text-muted-foreground">Your solution</Label>
                        <Textarea
                          rows={7}
                          className="font-mono text-xs"
                          placeholder="Write code or a short explanation as the question asks…"
                          value={answers[q.id]?.text || ''}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [q.id]: { ...a[q.id], text: e.target.value },
                            }))
                          }
                        />
                      </div>
                    )}
                    {isOther && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Your answer</Label>
                        <Textarea
                          rows={4}
                          className="text-sm"
                          placeholder="Type your answer…"
                          value={answers[q.id]?.text || ''}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [q.id]: { ...a[q.id], text: e.target.value },
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {!loading && graded && (
            <div className="space-y-5 pr-2">
              <div
                className={cn(
                  'rounded-xl border p-4 text-center',
                  (scorePct ?? 0) >= 70 ? 'border-chart-2/40 bg-chart-2/10' : 'border-border bg-muted/30',
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Score</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{scorePct ?? '—'}%</p>
                {xpNet != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Total XP from this quiz:{' '}
                    <span className="font-semibold text-foreground">
                      {xpNet >= 0 ? '+' : ''}
                      {xpNet}
                    </span>{' '}
                    (added to your profile — used on the leaderboard)
                  </p>
                )}
                {xpDetail != null &&
                  typeof xpDetail.previous === 'number' &&
                  typeof xpDetail.next === 'number' && (
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      Profile XP: {xpDetail.previous} → {xpDetail.next}
                    </p>
                  )}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setResultsOpen((open) => !open)}
                  >
                    {resultsOpen ? 'Hide detailed results' : 'View detailed results'}
                  </Button>
                </div>
                {revised && (
                  <p className="mt-2 flex items-center justify-center gap-1 text-xs text-primary">
                    <Sparkles className="size-3.5" /> Archie updated your path for weak topics.
                  </p>
                )}
              </div>

              <Collapsible open={resultsOpen} onOpenChange={setResultsOpen} className="group rounded-xl border border-border/80 bg-muted/10">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex h-10 w-full items-center justify-between gap-2 px-3 font-semibold"
                  >
                    <span>Quiz results — marks &amp; XP per question</span>
                    <ChevronDown className="size-4 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 border-t border-border/60 px-3 py-3 text-sm">
                  {(xpDetail?.per_question?.length || graded.results?.length) ? (
                    <ul className="space-y-2">
                      {(graded.results || []).map((r, idx) => {
                        const qid = String(r.question_id || '')
                        const q = qid ? questionById.get(qid) : undefined
                        const pq = qid ? xpByQuestionId.get(qid) : undefined
                        const label = (q?.prompt || r.topic || `Question ${idx + 1}`).trim()
                        const short =
                          label.length > 120 ? `${label.slice(0, 118).trim()}…` : label
                        return (
                          <li
                            key={qid || idx}
                            className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/90 p-2.5 sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Q{idx + 1} · {pq?.difficulty || r.difficulty || 'medium'}
                              </p>
                              <p className="mt-0.5 text-sm leading-snug text-foreground">{short}</p>
                              {r.note ? (
                                <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                              {r.correct ? (
                                <CheckCircle2 className="size-4 text-chart-2 sm:hidden" />
                              ) : (
                                <XCircle className="size-4 text-destructive/80 sm:hidden" />
                              )}
                              <Badge
                                variant={r.correct ? 'default' : 'destructive'}
                                className="tabular-nums"
                              >
                                {pq != null ? (pq.xp >= 0 ? `+${pq.xp}` : `${pq.xp}`) : r.correct ? 'OK' : '—'} XP
                              </Badge>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No per-question breakdown available.</p>
                  )}
                  {xpDetail != null && (
                    <div className="space-y-1 rounded-lg border border-dashed border-border/80 bg-muted/20 p-2.5 text-xs">
                      <div className="flex justify-between gap-2 tabular-nums">
                        <span className="text-muted-foreground">Quiz questions (net)</span>
                        <span>
                          {typeof xpDetail.quiz_net === 'number'
                            ? `${xpDetail.quiz_net >= 0 ? '+' : ''}${xpDetail.quiz_net}`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 tabular-nums">
                        <span className="text-muted-foreground">Score bonus</span>
                        <span>+{typeof xpDetail.score_bonus === 'number' ? xpDetail.score_bonus : 0}</span>
                      </div>
                      <div className="flex justify-between gap-2 tabular-nums">
                        <span className="text-muted-foreground">Pip completion</span>
                        <span>+{typeof xpDetail.pip_completion === 'number' ? xpDetail.pip_completion : 0}</span>
                      </div>
                      <div className="flex justify-between gap-2 border-t border-border/60 pt-1 font-semibold tabular-nums">
                        <span>Total this quiz</span>
                        <span>
                          {typeof xpDetail.net === 'number'
                            ? `${xpDetail.net >= 0 ? '+' : ''}${xpDetail.net}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {graded.pip_summary_for_archie ? (
                <div className="rounded-lg border border-border/80 bg-card/80 p-3 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">For Archie</p>
                  <p className="mt-1 text-muted-foreground">{graded.pip_summary_for_archie}</p>
                </div>
              ) : null}

              {graded.weak_topics && graded.weak_topics.length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Review next</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {graded.weak_topics.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {Array.isArray(graded.flashcard_suggestions) && graded.flashcard_suggestions.length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Flashcards Pip suggests
                  </p>
                  <ul className="mt-2 space-y-2">
                    {graded.flashcard_suggestions.slice(0, 6).map((fc, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-foreground">{fc.front}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="text-muted-foreground">{fc.back}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-3 border-t border-border/80 bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.08)] sm:flex-row sm:justify-between sm:px-6">
          {loading ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => close(false)}>
              Cancel
            </Button>
          ) : graded ? (
            <Button type="button" className="w-full sm:ml-auto sm:w-auto" onClick={() => close(false)}>
              Done
            </Button>
          ) : assessment && questions.length > 0 ? (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Close
              </Button>
              <div className="flex w-full flex-1 flex-wrap items-center justify-end gap-2 sm:w-auto">
                {safeStep > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Back
                  </Button>
                ) : null}
                {safeStep < lastStep ? (
                  <Button
                    type="button"
                    className="min-h-11 min-w-[7.5rem] font-semibold"
                    disabled={!currentAnswered}
                    onClick={() => setStepIndex((s) => Math.min(lastStep, s + 1))}
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="min-h-11 min-w-[7.5rem] font-semibold"
                    disabled={submitting || answeredCount < questions.length}
                    onClick={() => void submit()}
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    Submit
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
