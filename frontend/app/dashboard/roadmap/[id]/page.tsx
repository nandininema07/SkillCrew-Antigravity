'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ArchieGamifiedRoadmap, type LastPipCheckpoint } from '@/components/dashboard/archie-gamified-roadmap'
import { ArchieCertificationsPanel } from '@/components/dashboard/archie-certifications-panel'
import type { ArchieCertificationsBundle } from '@/lib/archie-certifications-mock'
import type { ArchieRoadmapBundle } from '@/lib/archie-roadmap-mock'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Award, Briefcase, GraduationCap, Loader2, RefreshCw, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'

type RoadmapKind = 'combined' | 'skills' | 'job_ready'

type RoadmapDetail = {
  id: string
  direction: string
  display_title: string
  roadmap_kind: RoadmapKind
  recommended_job_title: string | null
  linked_skills_roadmap_id: string | null
  capstone_unlocked_at: string | null
  bundles: {
    skills: ArchieRoadmapBundle
    job_ready: ArchieRoadmapBundle
    certifications: ArchieCertificationsBundle
  }
  last_pip_checkpoint: LastPipCheckpoint | null
}

type TabMode = 'skills' | 'job_ready' | 'certifications'

function hasCertContent(b: ArchieCertificationsBundle): boolean {
  return Array.isArray(b.items) && b.items.length > 0
}

function hasRoadmapWeeks(b: ArchieRoadmapBundle): boolean {
  return (b.milestones?.length ?? 0) > 0 || (b.weeklyTimeline?.weeks?.length ?? 0) > 0
}

function RoadmapDetailInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const accountXp = useAppStore((s) => s.user?.xp ?? 0)

  const [detail, setDetail] = useState<RoadmapDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenLoading, setRegenLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/learning-roadmaps/${id}`)
      const data = (await res.json()) as RoadmapDetail & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not load roadmap')
      setDetail(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load roadmap'
      setError(msg)
      setDetail(null)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const urlMode = searchParams.get('mode') as TabMode | null
  const kind = detail?.roadmap_kind ?? 'combined'

  const allowedModes = useMemo((): TabMode[] => {
    if (!detail) return ['skills']
    if (detail.roadmap_kind === 'job_ready') return ['job_ready']
    if (detail.roadmap_kind === 'skills') {
      const modes: TabMode[] = ['skills']
      if (hasCertContent(detail.bundles.certifications)) modes.push('certifications')
      return modes
    }
    return ['skills', 'job_ready', 'certifications']
  }, [detail])

  const [tab, setTab] = useState<TabMode>('skills')

  useEffect(() => {
    if (!detail) return
    const k = detail.roadmap_kind
    const m =
      k === 'job_ready'
        ? 'job_ready'
        : urlMode && allowedModes.includes(urlMode)
          ? urlMode
          : 'skills'
    setTab(m)
  }, [detail, urlMode, allowedModes])

  const regenerate = async () => {
    setRegenLoading(true)
    try {
      const res = await fetch(`/api/learning-roadmaps/${id}/regenerate`, { method: 'POST' })
      const data = (await res.json()) as Omit<RoadmapDetail, 'last_pip_checkpoint'> & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Regenerate failed')
      setDetail((prev) => ({
        ...(prev as RoadmapDetail),
        ...data,
        last_pip_checkpoint: prev?.last_pip_checkpoint ?? null,
      }))
      toast.success('Roadmap refreshed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Regenerate failed')
    } finally {
      setRegenLoading(false)
    }
  }

  const regenerateContinuation = async () => {
    setRegenLoading(true)
    try {
      const res = await fetch(`/api/learning-roadmaps/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ continuation: true }),
      })
      const data = (await res.json()) as Omit<RoadmapDetail, 'last_pip_checkpoint'> & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not generate next level')
      setDetail((prev) => ({
        ...(prev as RoadmapDetail),
        ...data,
        last_pip_checkpoint: prev?.last_pip_checkpoint ?? null,
      }))
      toast.success('Next level curriculum generated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate next level')
    } finally {
      setRegenLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="p-6 lg:p-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" /> Command center
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Roadmap unavailable</CardTitle>
            <CardDescription>{error || 'Not found'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const showTabs = allowedModes.length > 1

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" /> Command center
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{detail.display_title}</h1>
          <p className="text-sm text-muted-foreground">{detail.direction}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {kind === 'skills' && 'Teaching path — learn concepts in order.'}
            {kind === 'job_ready' && 'Interview prep — crack the role, not a duplicate of your skills syllabus.'}
            {kind === 'combined' && 'Legacy roadmap with teaching, interview, and certification views.'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={regenLoading}
          onClick={() => void regenerate()}
          className="shrink-0"
        >
          {regenLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Refreshing…
            </>
          ) : (
            <>
              <RefreshCw className="size-4" /> Regenerate from profile
            </>
          )}
        </Button>
      </div>

      {!showTabs ? (
        <div className="space-y-6">
          {tab === 'job_ready' && (
            <ArchieGamifiedRoadmap
              bundle={detail.bundles.job_ready}
              roadmapId={detail.id}
              roadmapMode="job_ready"
              onRoadmapUpdated={() => void load()}
              lastPipCheckpoint={detail.last_pip_checkpoint}
              onContinuationRegenerate={() => void regenerateContinuation()}
              continuationBusy={regenLoading}
              accountXp={accountXp}
              capstoneUnlockedAt={detail.capstone_unlocked_at}
              roadmapDirection={detail.direction}
              recommendedJobTitle={detail.recommended_job_title}
            />
          )}
          {tab === 'skills' && (
            <ArchieGamifiedRoadmap
              bundle={detail.bundles.skills}
              roadmapId={detail.id}
              roadmapMode="skills"
              onRoadmapUpdated={() => void load()}
              lastPipCheckpoint={detail.last_pip_checkpoint}
              onContinuationRegenerate={() => void regenerateContinuation()}
              continuationBusy={regenLoading}
              accountXp={accountXp}
              capstoneUnlockedAt={detail.capstone_unlocked_at}
              roadmapDirection={detail.direction}
              recommendedJobTitle={detail.recommended_job_title}
            />
          )}
          {tab === 'certifications' && <ArchieCertificationsPanel bundle={detail.bundles.certifications} />}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabMode)} className="gap-4">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-0">
            {allowedModes.includes('skills') && (
              <TabsTrigger value="skills" className="gap-2 py-2.5 sm:py-1.5">
                <GraduationCap className="size-4 shrink-0" />
                Skills
              </TabsTrigger>
            )}
            {allowedModes.includes('job_ready') && (
              <TabsTrigger value="job_ready" className="gap-2 py-2.5 sm:py-1.5">
                <Briefcase className="size-4 shrink-0" />
                Job ready
              </TabsTrigger>
            )}
            {allowedModes.includes('certifications') && (
              <TabsTrigger value="certifications" className="gap-2 py-2.5 sm:py-1.5">
                <Award className="size-4 shrink-0" />
                Certifications
              </TabsTrigger>
            )}
          </TabsList>

          {allowedModes.includes('skills') && (
            <TabsContent value="skills" className="mt-4">
              {!hasRoadmapWeeks(detail.bundles.skills) ? (
                <p className="text-sm text-muted-foreground">No skills track stored for this roadmap.</p>
              ) : (
                <ArchieGamifiedRoadmap
                  bundle={detail.bundles.skills}
                  roadmapId={detail.id}
                  roadmapMode="skills"
                  onRoadmapUpdated={() => void load()}
                  lastPipCheckpoint={detail.last_pip_checkpoint}
                  onContinuationRegenerate={() => void regenerateContinuation()}
                  continuationBusy={regenLoading}
                  accountXp={accountXp}
                  capstoneUnlockedAt={detail.capstone_unlocked_at}
                  roadmapDirection={detail.direction}
                  recommendedJobTitle={detail.recommended_job_title}
                />
              )}
            </TabsContent>
          )}
          {allowedModes.includes('job_ready') && (
            <TabsContent value="job_ready" className="mt-4">
              {!hasRoadmapWeeks(detail.bundles.job_ready) ? (
                <p className="text-sm text-muted-foreground">No job-ready track stored for this roadmap.</p>
              ) : (
                <ArchieGamifiedRoadmap
                  bundle={detail.bundles.job_ready}
                  roadmapId={detail.id}
                  roadmapMode="job_ready"
                  onRoadmapUpdated={() => void load()}
                  lastPipCheckpoint={detail.last_pip_checkpoint}
                  onContinuationRegenerate={() => void regenerateContinuation()}
                  continuationBusy={regenLoading}
                  accountXp={accountXp}
                  capstoneUnlockedAt={detail.capstone_unlocked_at}
                  roadmapDirection={detail.direction}
                  recommendedJobTitle={detail.recommended_job_title}
                />
              )}
            </TabsContent>
          )}
          {allowedModes.includes('certifications') && (
            <TabsContent value="certifications" className="mt-4">
              <ArchieCertificationsPanel bundle={detail.bundles.certifications} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}

export default function RoadmapByIdPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <RoadmapDetailInner />
    </Suspense>
  )
}
