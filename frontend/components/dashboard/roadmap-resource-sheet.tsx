'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { ArchieMilestone } from '@/lib/archie-roadmap-mock'
import { ExternalLink, GraduationCap, Youtube } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ResourceItem = {
  title: string
  url: string
  description: string
  source: 'youtube' | 'coursera' | 'udemy'
}

type SearchResponse = {
  query: string
  free: ResourceItem[]
  paid: ResourceItem[]
  errors: string[]
  partial?: boolean
}

function SourceBadge({ source }: { source: ResourceItem['source'] }) {
  if (source === 'youtube') {
    return (
      <Badge variant="secondary" className="shrink-0 gap-1 border border-red-500/25 bg-red-500/10 text-[10px] text-red-700 dark:text-red-300">
        <Youtube className="size-3" />
        YouTube
      </Badge>
    )
  }
  if (source === 'coursera') {
    return (
      <Badge variant="secondary" className="shrink-0 border border-blue-500/25 bg-blue-500/10 text-[10px] text-blue-700 dark:text-blue-300">
        Coursera
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="shrink-0 border border-purple-500/25 bg-purple-500/10 text-[10px] text-purple-700 dark:text-purple-300">
      Udemy
    </Badge>
  )
}

function ResourceList({ items }: { items: ResourceItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
        No links matched this search. Try another milestone or check back later.
      </p>
    )
  }
  return (
    <ul className="space-y-3 pr-2">
      {items.map((it) => (
        <li
          key={it.url}
          className="rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm transition-colors hover:border-primary/30"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-w-0 flex-1 items-start gap-2 font-medium leading-snug text-foreground hover:text-primary"
            >
              <span className="line-clamp-3">{it.title}</span>
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
            </a>
            <SourceBadge source={it.source} />
          </div>
          {it.description ? (
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{it.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function RoadmapResourceSheet({
  milestone,
  open,
  onOpenChange,
}: {
  milestone: ArchieMilestone | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [tab, setTab] = useState<'free' | 'paid'>('free')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)

  useEffect(() => {
    if (!open || !milestone) {
      setData(null)
      return
    }

    const ctrl = new AbortController()
    setLoading(true)
    setData(null)
    setTab('free')

    void (async () => {
      try {
        const res = await fetch('/api/learning-resources/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            title: milestone.title,
            topics: milestone.topics,
            learningObjective: milestone.learningObjective ?? '',
          }),
        })
        const json = (await res.json()) as SearchResponse & { error?: string }
        if (!res.ok) {
          throw new Error(json.error || `Request failed (${res.status})`)
        }
        setData(json)
        if (json.errors?.length) {
          json.errors.forEach((e) => toast.warning(e))
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        const msg = e instanceof Error ? e.message : 'Search failed'
        toast.error(msg)
        setData(null)
      } finally {
        setLoading(false)
      }
    })()

    return () => ctrl.abort()
  }, [open, milestone])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full flex-col gap-0 border-border p-0 sm:max-w-lg',
          'data-[state=open]:duration-300',
        )}
      >
        <SheetHeader className="border-b border-border/80 px-4 py-4 text-left sm:px-6">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            {milestone ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {milestone.phaseLabel}
              </Badge>
            ) : null}
            <SheetTitle className="text-left text-base leading-snug sm:text-lg">
              {milestone?.title ?? 'Learning resources'}
            </SheetTitle>
          </div>
          <SheetDescription className="text-left text-xs sm:text-sm">
            Free picks from YouTube; paid courses from Coursera and Udemy, ranked by Tavily relevance for this milestone.
            Links open in a new tab.
          </SheetDescription>
          {milestone && milestone.topics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {milestone.topics.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2 sm:px-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col gap-3">
            <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 p-1">
              <TabsTrigger value="free" className="gap-1.5 text-xs sm:text-sm">
                <Youtube className="size-3.5" />
                Free
              </TabsTrigger>
              <TabsTrigger value="paid" className="gap-1.5 text-xs sm:text-sm">
                <GraduationCap className="size-3.5" />
                Paid
              </TabsTrigger>
            </TabsList>

            {(['free', 'paid'] as const).map((key) => (
              <TabsContent key={key} value={key} className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
                {loading ? (
                  <div className="space-y-3 pr-1 pt-1">
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <p className="text-center text-xs text-muted-foreground">Searching with Tavily…</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[min(60vh,520px)] pr-3">
                    <ResourceList items={key === 'free' ? (data?.free ?? []) : (data?.paid ?? [])} />
                  </ScrollArea>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {!loading && data && data.errors.length > 0 && data.free.length === 0 && data.paid.length === 0 ? (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {data.errors.join(' ')}
            </div>
          ) : null}

          {!loading && data && (data.free.length > 0 || data.paid.length > 0) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 shrink-0"
              onClick={() => {
                if (!milestone) return
                void (async () => {
                  setLoading(true)
                  try {
                    const res = await fetch('/api/learning-resources/search', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: milestone.title,
                        topics: milestone.topics,
                        learningObjective: milestone.learningObjective ?? '',
                      }),
                    })
                    const json = (await res.json()) as SearchResponse & { error?: string }
                    if (!res.ok) throw new Error(json.error || 'Refresh failed')
                    setData(json)
                    toast.success('Results refreshed')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Refresh failed')
                  } finally {
                    setLoading(false)
                  }
                })()
              }}
            >
              Refresh results
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
