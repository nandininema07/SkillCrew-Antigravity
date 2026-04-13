'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import type { ProgressAnalyticsPayload } from '@/lib/progress-analytics.types'
import type { DBProfile } from '@/lib/database.types'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  Target,
  Calendar,
  Brain,
  Map,
  ChevronRight,
  Loader2,
  FileDown,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'

type RoadmapKind = 'combined' | 'skills' | 'job_ready'

type LearningRoadmapMeta = {
  id: string
  direction: string
  display_title: string
  progress_percent: number
  nodes_completed_skills?: number
  nodes_total_skills?: number
  nodes_remaining_skills?: number
  nodes_percent_skills?: number
  nodes_completed_job?: number
  nodes_total_job?: number
  nodes_remaining_job?: number
  nodes_percent_job?: number
  estimated_completion: string | null
  roadmap_kind: RoadmapKind
  recommended_job_title: string | null
  created_at: string
  updated_at: string
}

export default function ProgressPage() {
  const { currentPath } = useAppStore()
  const [profile, setProfile] = useState<DBProfile | null>(null)
  const [analytics, setAnalytics] = useState<ProgressAnalyticsPayload | null>(null)
  const [roadmaps, setRoadmaps] = useState<LearningRoadmapMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [reportDownloading, setReportDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setAnalyticsError(null)
      try {
        const [profileRes, analyticsRes, roadmapsRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/analytics/progress'),
          fetch('/api/learning-roadmaps'),
        ])
        if (profileRes.ok) {
          const data = (await profileRes.json()) as DBProfile
          if (!cancelled) setProfile(data)
        }
        if (analyticsRes.ok) {
          const a = (await analyticsRes.json()) as ProgressAnalyticsPayload
          if (!cancelled) setAnalytics(a)
        } else {
          const err = await analyticsRes.json().catch(() => ({}))
          if (!cancelled) setAnalyticsError(typeof err?.error === 'string' ? err.error : 'Analytics unavailable')
        }
        if (roadmapsRes.ok) {
          const body = (await roadmapsRes.json()) as { items?: LearningRoadmapMeta[] } | LearningRoadmapMeta[]
          const items = Array.isArray(body) ? body : (body as { items?: LearningRoadmapMeta[] }).items ?? []
          if (!cancelled) setRoadmaps(items)
        }
      } catch (e) {
        console.error('Progress page load:', e)
        if (!cancelled) setAnalyticsError('Could not load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Sign in to view progress</CardTitle>
            <CardDescription>Your session needs a profile. Sign in to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const topicTimeBudgetData = analytics?.moduleTimeRows?.length ? analytics.moduleTimeRows : []
  const monthlyTrendData = analytics?.weeklyTrend?.length ? analytics.weeklyTrend : []
  const skillDistribution = (analytics?.skillDistribution ?? []).filter((s) => s.value > 0)

  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

  const xpDelta = analytics?.xpEarnedLast7Days ?? 0
  const proficientSkills = analytics?.proficientSkillsCount ?? 0

  const stats = [
    {
      icon: TrendingUp,
      label: 'Total XP Earned',
      value: profile.xp,
      change:
        xpDelta > 0
          ? `+${xpDelta} XP from assessments (last 7 days)`
          : 'No assessment XP in the last 7 days',
      trend: 'up' as const,
    },
    {
      icon: Calendar,
      label: 'Current Streak',
      value: `${profile.streak} days`,
      change: profile.streak > 0 ? 'Keep it up!' : 'Complete a lesson to start a streak',
      trend: 'up' as const,
    },
    {
      icon: Target,
      label: 'Path Progress',
      value: `${Math.round(currentPath?.progress || 0)}%`,
      change: `${currentPath?.modules.filter((m) => m.status === 'completed').length || 0} of ${currentPath?.modules.length || 0} modules`,
      trend: 'up' as const,
    },
    {
      icon: Brain,
      label: 'Proficient skills',
      value: `${proficientSkills}`,
      change:
        analytics != null
          ? `${analytics.skillsTracked} skills on your profile`
          : 'Skills from your profile',
      trend: 'up' as const,
    },
  ]

  const downloadProgressReport = async () => {
    setReportDownloading(true)
    try {
      const res = await fetch('/api/analytics/progress/report')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err?.error === 'string' ? err.error : 'Could not generate report')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `skillcrew-progress-report-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Progress report downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate report')
    } finally {
      setReportDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Progress & Analytics
            </h1>
            <p className="text-muted-foreground">Track your learning journey and growth metrics</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2 sm:self-start"
            onClick={() => void downloadProgressReport()}
            disabled={reportDownloading}
          >
            {reportDownloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            Generate progress report (PDF)
          </Button>
        </div>

        {analyticsError && (
          <p className="text-sm text-destructive" role="alert">
            {analyticsError}
          </p>
        )}

        {/* ── Roadmaps section ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Map className="size-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Your learning roadmaps</h2>
              <p className="text-sm text-muted-foreground">
                Click any roadmap to see a full module breakdown and Archie&apos;s reasoning
              </p>
            </div>
          </div>

          {roadmaps.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">No roadmaps yet</CardTitle>
                <CardDescription>
                  Create a personalized roadmap from your dashboard to see progress here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {roadmaps.map((roadmap) => {
                const isJobReady = roadmap.roadmap_kind === 'job_ready'
                const completed = isJobReady
                  ? (roadmap.nodes_completed_job ?? 0)
                  : (roadmap.nodes_completed_skills ?? 0)
                const total = isJobReady
                  ? (roadmap.nodes_total_job ?? 0)
                  : (roadmap.nodes_total_skills ?? 0)
                const remaining = isJobReady
                  ? (roadmap.nodes_remaining_job ?? 0)
                  : (roadmap.nodes_remaining_skills ?? 0)
                const percent = isJobReady
                  ? (roadmap.nodes_percent_job ?? 0)
                  : (roadmap.nodes_percent_skills ?? 0)

                const createdDate = new Date(roadmap.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })

                return (
                  <Link
                    key={roadmap.id}
                    href={`/dashboard/progress/${roadmap.id}`}
                    className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Card className="h-full border-border/80 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
                            {roadmap.display_title || roadmap.direction}
                          </CardTitle>
                          <Badge
                            variant="secondary"
                            className="shrink-0 capitalize text-[10px]"
                          >
                            {roadmap.roadmap_kind === 'job_ready' ? 'Interview' : 'Teaching'}
                          </Badge>
                        </div>
                        {roadmap.recommended_job_title && (
                          <p className="text-xs text-muted-foreground">
                            Target: {roadmap.recommended_job_title}
                          </p>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Module completion bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Layers className="size-3" />
                              Module progress
                            </span>
                            <span className="tabular-nums font-medium">
                              {total > 0 ? `${percent}%` : '—'}
                            </span>
                          </div>
                          <Progress
                            value={total > 0 ? percent : 0}
                            className="h-2"
                          />
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-2">
                            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {completed}
                            </p>
                            <p className="text-[10px] text-muted-foreground">done</p>
                          </div>
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-2">
                            <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                              {remaining}
                            </p>
                            <p className="text-[10px] text-muted-foreground">remaining</p>
                          </div>
                          <div className="rounded-lg border bg-muted/40 px-2 py-2">
                            <p className="text-lg font-bold tabular-nums">{total}</p>
                            <p className="text-[10px] text-muted-foreground">total</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t pt-3">
                          <span className="text-[11px] text-muted-foreground">
                            Started {createdDate}
                          </span>
                          <span className="flex items-center gap-1 text-sm font-medium text-primary">
                            View breakdown
                            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {stat.trend === 'up' ? '↗' : '↘'} {stat.trend}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold mb-2">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Tabs defaultValue="topicTime" className="w-full space-y-4">
          <TabsList>
            <TabsTrigger value="topicTime">Time allotted vs spent</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Trend</TabsTrigger>
            <TabsTrigger value="skills">Skill Distribution</TabsTrigger>
          </TabsList>

          <TabsContent value="topicTime" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Time allotted vs time spent by topic</CardTitle>
                <CardDescription>
                  Planned hours per module (from your roadmap length) compared to logged time in module completion
                  records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topicTimeBudgetData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No module time data yet. Complete roadmap modules to see hours here.
                  </p>
                ) : (
                  <div className="w-full h-[22rem] min-h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topicTimeBudgetData}
                        margin={{ top: 8, right: 8, left: 4, bottom: 48 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis
                          dataKey="topic"
                          stroke="var(--color-muted-foreground)"
                          tick={{ fontSize: 11 }}
                          interval={0}
                          angle={-28}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          stroke="var(--color-muted-foreground)"
                          tick={{ fontSize: 11 }}
                          label={{
                            value: 'Hours',
                            angle: -90,
                            position: 'insideLeft',
                            style: { fill: 'var(--color-muted-foreground)', fontSize: 12 },
                          }}
                          domain={[0, 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Bar dataKey="allottedHours" name="Allotted" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="spentHours" name="Spent" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Monthly learning trend</CardTitle>
                <CardDescription>XP earned and modules completed each week</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyTrendData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No trend data yet. Complete assessments and modules to track your weekly progress.
                  </p>
                ) : (
                  <div className="w-full h-[22rem] min-h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthlyTrendData}
                        margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="week" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="xp"
                          name="XP"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: '#8b5cf6', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="courses"
                          name="Modules"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: '#10b981', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Skill level distribution</CardTitle>
                <CardDescription>Breakdown of proficiency levels across your skill set</CardDescription>
              </CardHeader>
              <CardContent>
                {skillDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No skill data available. Add skills to your profile or complete roadmap modules to see your
                    distribution.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-full sm:w-64 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={skillDistribution}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            labelLine
                          >
                            {skillDistribution.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--color-card)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {skillDistribution.map((skill, index) => (
                        <div key={skill.name} className="flex items-center gap-2 rounded-lg border p-3">
                          <div
                            className="size-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate capitalize">{skill.name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{skill.value} skills</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
