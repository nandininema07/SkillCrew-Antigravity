'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CompanyResearchCard } from '@/components/job-ready/company-research-card'
import { MockInterviewSection } from '@/components/job-ready/mock-interview-section'
import { JobReadyTargetRoleProvider, useJobReadyTargetRole } from '@/components/job-ready/target-role-context'
import { TopJobOpenings } from '@/components/job-ready/top-job-openings'
import {
  Building2,
  Mic,
  Briefcase,
  ChevronDown,
  Loader2,
  Target,
  CheckCircle2,
} from 'lucide-react'

function TargetRoleHero() {
  const { targetRole, loading, applyTargetRole } = useJobReadyTargetRole()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(targetRole)
  }, [targetRole])

  const save = async () => {
    const t = draft.trim()
    if (!t) return
    setSaving(true)
    try {
      await applyTargetRole(t)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/8 via-background to-muted/30 px-6 py-10 lg:px-10">
      {/* Subtle background orb */}
      <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 size-64 rounded-full bg-violet-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: heading */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Make me job ready</p>
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">Interview prep &amp; openings</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Research any company for your target role, run a live voice mock interview, then scan fresh job listings
              — all in one flow.
            </p>
          </div>

          {/* Right: target role input */}
          <div className="flex w-full flex-col gap-2 rounded-xl border bg-card/80 p-4 shadow-sm lg:w-auto lg:min-w-[340px]">
            <div className="flex items-center gap-2">
              <Target className="size-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold">Your target role</span>
              {targetRole && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  <CheckCircle2 className="mr-1 size-3 text-emerald-500" />
                  Set
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. ML Engineer, Marketing Lead…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void save()}
                disabled={loading}
                className="flex-1"
              />
              <Button type="button" size="sm" onClick={() => void save()} disabled={loading || saving || !draft.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            {!targetRole && !loading && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Set your role above, or update it in{' '}
                <Link href="/dashboard" className="underline underline-offset-2">
                  Command Center
                </Link>
                .
              </p>
            )}
            {targetRole && (
              <p className="text-[11px] text-muted-foreground">
                Currently targeting: <span className="font-medium text-foreground">{targetRole}</span>
              </p>
            )}
          </div>
        </div>

        {/* Step flow pills */}
        <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
          <StepPill num={1} icon={Building2} label="Company research" color="blue" />
          <ChevronDown className="size-4 rotate-[-90deg] text-muted-foreground/50" />
          <StepPill num={2} icon={Mic} label="Mock interview" color="violet" />
          <ChevronDown className="size-4 rotate-[-90deg] text-muted-foreground/50" />
          <StepPill num={3} icon={Briefcase} label="Job openings" color="emerald" />
        </div>
      </div>
    </div>
  )
}

function StepPill({
  num,
  icon: Icon,
  label,
  color,
}: {
  num: number
  icon: React.ElementType
  label: string
  color: 'blue' | 'violet' | 'emerald'
}) {
  const cls = {
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  }[color]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      <span className="inline-flex size-4 items-center justify-center rounded-full bg-current/20 text-[10px] font-bold">
        {num}
      </span>
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

function SectionDivider({ step, icon: Icon, title, subtitle, color }: {
  step: number
  icon: React.ElementType
  title: string
  subtitle: string
  color: 'blue' | 'violet' | 'emerald'
}) {
  const { borderCls, bgCls, textCls, badgeCls } = {
    blue: {
      borderCls: 'border-l-blue-500',
      bgCls: 'bg-blue-500/[0.04]',
      textCls: 'text-blue-600 dark:text-blue-400',
      badgeCls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    },
    violet: {
      borderCls: 'border-l-violet-500',
      bgCls: 'bg-violet-500/[0.04]',
      textCls: 'text-violet-600 dark:text-violet-400',
      badgeCls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
    },
    emerald: {
      borderCls: 'border-l-emerald-500',
      bgCls: 'bg-emerald-500/[0.04]',
      textCls: 'text-emerald-600 dark:text-emerald-400',
      badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    },
  }[color]

  return (
    <div className={`border-l-4 ${borderCls} ${bgCls} rounded-r-xl px-5 py-4`}>
      <div className="flex items-center gap-3">
        <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${badgeCls}`}>
          {step}
        </span>
        <Icon className={`size-5 shrink-0 ${textCls}`} />
        <div>
          <p className={`text-base font-semibold ${textCls}`}>{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function FlowConnector() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex flex-col items-center gap-1">
        <div className="h-6 w-px bg-gradient-to-b from-border to-border/30" />
        <ChevronDown className="size-4 text-muted-foreground/40" />
      </div>
    </div>
  )
}

function JobReadyContent() {
  return (
    <div className="flex flex-col">
      <TargetRoleHero />

      <div className="mx-auto w-full max-w-7xl space-y-3 p-6 lg:p-8">

        {/* Step 1 */}
        <SectionDivider
          step={1}
          icon={Building2}
          title="Company research"
          subtitle="Interview write-ups from GeeksforGeeks · behavioral intel from Glassdoor"
          color="blue"
        />
        <CompanyResearchCard />

        <FlowConnector />

        {/* Step 2 */}
        <SectionDivider
          step={2}
          icon={Mic}
          title="Mock interview"
          subtitle="Live voice session via Vapi · get a full coaching report when you're done"
          color="violet"
        />
        <MockInterviewSection />

        <FlowConnector />

        {/* Step 3 */}
        <SectionDivider
          step={3}
          icon={Briefcase}
          title="Top job openings"
          subtitle="Fresh listings from LinkedIn, Naukri &amp; Glassdoor matched to your skills"
          color="emerald"
        />
        <TopJobOpenings />
      </div>
    </div>
  )
}

export default function JobReadyPage() {
  return (
    <JobReadyTargetRoleProvider>
      <JobReadyContent />
    </JobReadyTargetRoleProvider>
  )
}
