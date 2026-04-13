'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search, ExternalLink } from 'lucide-react'
import { useJobReadyTargetRole } from '@/components/job-ready/target-role-context'
import { toast } from 'sonner'

type ResearchResponse = {
  company: string
  targetRole: string
  geeksforgeeks: { query: string; answer: string | null; results: { title: string; url: string; content?: string }[] }
  glassdoor: {
    tavily: { query: string; answer: string | null; results: { title: string; url: string; content?: string }[] }
    apify: {
      ok: boolean
      items: unknown[]
      runId?: string
      datasetId?: string
      error?: string
    } | null
    apifySkipped: boolean
  }
}

export function CompanyResearchCard() {
  const { targetRole, loading: roleLoading } = useJobReadyTargetRole()
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ResearchResponse | null>(null)

  const run = async () => {
    const c = company.trim()
    if (!c) {
      toast.error('Enter a company name')
      return
    }
    if (!targetRole) {
      toast.error('Enter a target role and save it in this section first')
      return
    }
    setLoading(true)
    setData(null)
    try {
      const res = await fetch('/api/job-ready/company-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: c, targetRole }),
      })
      const json = (await res.json()) as ResearchResponse & { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Research failed')
        return
      }
      setData(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-blue-500/20 bg-blue-500/[0.02] shadow-sm">
      <CardHeader className="pb-3">
        <CardDescription className="text-sm">
          Enter a company name to pull interview write-ups from <strong className="text-foreground">GeeksforGeeks</strong> and
          behavioral intel from <strong className="text-foreground">Glassdoor</strong> — filtered to your target role.
        </CardDescription>
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="company-research-company">Company</Label>
            <Input
              id="company-research-company"
              placeholder="e.g. Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <Button type="button" onClick={run} disabled={loading || !targetRole} className="sm:w-auto">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Research
          </Button>
        </div>

        {data && (
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">GeeksforGeeks — interview experience</h3>
              {data.geeksforgeeks.answer && (
                <p className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
                  {data.geeksforgeeks.answer}
                </p>
              )}
              <ScrollArea className="h-[min(20rem,50vh)] rounded-lg border border-border/60 pr-3">
                <ul className="space-y-3 p-1">
                  {data.geeksforgeeks.results.map((r, i) => (
                    <li key={r.url + i} className="rounded-md border border-border/50 bg-card/80 p-3 text-sm">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {r.title}
                        <ExternalLink className="size-3.5 shrink-0 opacity-70" />
                      </a>
                      {r.content && <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{r.content}</p>}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </section>

            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Glassdoor — behavioral & interviews</h3>
              {data.glassdoor.tavily.answer && (
                <p className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
                  {data.glassdoor.tavily.answer}
                </p>
              )}
              <ScrollArea className="h-[min(20rem,50vh)] rounded-lg border border-border/60 pr-3">
                <ul className="space-y-3 p-1">
                  {data.glassdoor.tavily.results.map((r, i) => (
                    <li key={r.url + i} className="rounded-md border border-border/50 bg-card/80 p-3 text-sm">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {r.title}
                        <ExternalLink className="size-3.5 shrink-0 opacity-70" />
                      </a>
                      {r.content && <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{r.content}</p>}
                    </li>
                  ))}
                </ul>
              </ScrollArea>

              {!data.glassdoor.apifySkipped && (
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Extra Glassdoor scrape</p>
                  {data.glassdoor.apify?.ok ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-relaxed">
                      {JSON.stringify(data.glassdoor.apify.items.slice(0, 3), null, 2)}
                      {data.glassdoor.apify.items.length > 3 ? '\n…' : ''}
                    </pre>
                  ) : (
                    <p className="mt-1 text-amber-700 dark:text-amber-400">
                      {data.glassdoor.apify?.error ?? 'No additional data returned.'}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
