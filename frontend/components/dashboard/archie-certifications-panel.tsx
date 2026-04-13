'use client'

import { useState } from 'react'
import type { ArchieCertificationsBundle, ArchieCertificationSuggestion } from '@/lib/archie-certifications-mock'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Award, Sparkles } from 'lucide-react'

export function ArchieCertificationsPanel({ bundle }: { bundle: ArchieCertificationsBundle }) {
  const [open, setOpen] = useState<ArchieCertificationSuggestion | null>(null)

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

      <div className="relative space-y-6 p-5 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Certifications</p>
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Archie&apos;s picks for {bundle.targetRole}</h2>
            <Badge variant="secondary" className="mt-2 border border-border/80 bg-muted/50 font-normal">
              {bundle.archetypeLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-archie/25 bg-archie/10 px-3 py-2 text-archie">
            <Award className="size-5 shrink-0" />
            <span className="text-sm font-medium">{bundle.items.length} suggestions</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{bundle.intro}</p>

        <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          {bundle.items.map((c) => (
            <li key={c.id}>
              <Card className="h-full border-border/90 bg-card/95 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/35 hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{c.provider}</p>
                    <h3 className="font-semibold leading-snug text-card-foreground">{c.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Focus:</span> {c.focus}
                  </p>
                  {c.prepHint && (
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium">Prep:</span> {c.prepHint}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto w-full border-primary/25 bg-primary/[0.04] hover:bg-primary/10"
                    type="button"
                    onClick={() => setOpen(c)}
                  >
                    <Sparkles className="size-3.5 text-archie" />
                    Why Archie suggests this
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg border-border">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-archie/15 px-2 py-0.5 text-xs font-semibold text-archie">Archie</span>
              <span>{open?.name}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">Certification rationale for your target role</DialogDescription>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Provider:</strong> {open.provider}
              </p>
              <p>
                <strong className="text-foreground">Why this cert:</strong> {open.archieRationale}
              </p>
              {open.prepHint && (
                <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
                  <strong className="text-foreground">Prep window:</strong> {open.prepHint} — treat as a guide; your
                  Skills tab can carve study blocks without blocking Job ready shipping work.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
