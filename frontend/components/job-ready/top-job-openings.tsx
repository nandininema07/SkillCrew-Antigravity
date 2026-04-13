'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useJobReadyTargetRole } from '@/components/job-ready/target-role-context'
import { toast } from 'sonner'

type Block = {
  query: string
  answer: string | null
  results: { title: string; url: string; content?: string }[]
}

type JobsResponse = {
  targetRole: string
  disclaimer: string
  skillsConsidered?: string[]
  skillsUsed?: string | null
  sources: {
    linkedin: Block
    naukri: Block
    glassdoor: Block
  }
}

export function TopJobOpenings() {
  const { targetRole, loading: roleLoading } = useJobReadyTargetRole()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<JobsResponse | null>(null)

  const load = async () => {
    if (!targetRole) {
      toast.error('Enter a target role and save it in this section first')
      return
    }
    setLoading(true)
    setData(null)
    try {
      const res = await fetch('/api/job-ready/recent-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ targetRole }),
      })
      const json = (await res.json()) as JobsResponse & { error?: string }
      if (res.status === 401) {
        toast.error('Sign in to match openings to your saved resume skills.')
        return
      }
      if (!res.ok) {
        toast.error(json.error ?? 'Could not load jobs')
        return
      }
      setData(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const renderBlock = (label: string, block: Block) => (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
      <ScrollArea className="h-[min(14rem,32vh)] rounded-lg border border-border/60 pr-3">
        <ul className="space-y-2 p-1">
          {block.results.map((r, i) => (
            <li key={r.url + i} className="rounded-md border border-border/50 bg-card/80 p-2.5 text-sm">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                {r.title}
                <ExternalLink className="size-3.5 shrink-0 opacity-70" />
              </a>
              {r.content && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.content}</p>}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </section>
  )

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/[0.02] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardDescription className="flex-1 text-sm">
            Fresh listings from <strong className="text-foreground">LinkedIn</strong>,{' '}
            <strong className="text-foreground">Naukri</strong>, and{' '}
            <strong className="text-foreground">Glassdoor</strong> — ranked against your saved skills.
          </CardDescription>
          <Button
            type="button"
            size="sm"
            className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
            variant="outline"
            onClick={load}
            disabled={loading || !targetRole}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {loading ? 'Loading…' : 'Load openings'}
          </Button>
        </div>
        {!targetRole && !roleLoading && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Set your target role at the top of the page first.
          </p>
        )}
        {targetRole && (
          <Badge variant="secondary" className="w-fit font-normal text-[10px]">
            Role: {targetRole}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.disclaimer && (
          <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3">{data.disclaimer}</p>
        )}
        {data && (data.skillsConsidered?.length ?? 0) > 0 && data.skillsUsed && (
          <p className="text-xs text-foreground/90">
            <span className="font-medium text-foreground">Skills used for matching: </span>
            {data.skillsUsed}
          </p>
        )}
        {data && (data.skillsConsidered?.length ?? 0) === 0 && (
          <p className="text-xs text-amber-800 dark:text-amber-200/90">
            No saved skills yet — results rank by role fit only. Add skills from your resume on the{' '}
            <Link href="/dashboard/skills" className="font-medium underline underline-offset-4">
              Skills
            </Link>{' '}
            page for tighter matches.
          </p>
        )}
        {data && (
          <div className="grid gap-6 lg:grid-cols-3">
            {renderBlock('LinkedIn', data.sources.linkedin)}
            {renderBlock('Naukri', data.sources.naukri)}
            {renderBlock('Glassdoor', data.sources.glassdoor)}
          </div>
        )}
        {!data && !loading && (
          <p className="text-center text-sm text-muted-foreground">Click Load to fetch job pages for your role.</p>
        )}
      </CardContent>
    </Card>
  )
}
