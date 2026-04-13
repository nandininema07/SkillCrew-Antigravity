'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, FileText } from 'lucide-react'
import { useJobReadyTargetRole } from '@/components/job-ready/target-role-context'
import { toast } from 'sonner'

const VapiControls = dynamic(
  () => import('./mock-interview-vapi-inner').then((m) => m.MockInterviewVapiInner),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground">Loading voice…</p> },
)

export function MockInterviewSection() {
  const { targetRole, loading: roleLoading } = useJobReadyTargetRole()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [structured, setStructured] = useState<unknown>(null)
  const [reportMeta, setReportMeta] = useState<{ targetRole?: string; cached?: boolean } | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? ''
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? ''
  const voiceReady = Boolean(publicKey?.trim() && assistantId?.trim())


  const handleCallStart = useCallback(() => {
    setSessionId(null)
    setReport(null)
    setStructured(null)
    setReportMeta(null)
  }, [])

  const handleInterviewSaved = useCallback((id: string) => {
    setSessionId(id)
    setReport(null)
    setStructured(null)
    setReportMeta(null)
    toast.success('Interview saved. Open your analysis when you are ready.')
  }, [])

  const handleSaveFailed = useCallback((message: string) => {
    toast.error(message)
  }, [])

  const showAnalysis = async () => {
    if (!sessionId) {
      toast.error('Complete an interview first')
      return
    }
    setAnalysisLoading(true)
    setReport(null)
    setStructured(null)
    try {
      const res = await fetch('/api/job-ready/mock-interview/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ sessionId }),
      })
      const json = (await res.json()) as {
        report?: string
        structured?: unknown
        error?: string
        targetRole?: string
        cached?: boolean
      }
      if (!res.ok) {
        toast.error(json.error ?? 'Analysis failed')
        return
      }
      setReport(json.report ?? '')
      setStructured(json.structured ?? null)
      setReportMeta({ targetRole: json.targetRole, cached: json.cached })
      setAnalysisOpen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setAnalysisLoading(false)
    }
  }

  return (
    <Card className="border-violet-500/20 bg-violet-500/[0.02] shadow-sm">
      <CardHeader className="pb-3">
        <CardDescription className="text-sm">
          A real-time voice interview session aligned with your target role. Finish the call, then open{' '}
          <strong className="text-foreground">Show analysis</strong> for a detailed coaching report.
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
        {!voiceReady ? (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            <p>
              Add <code className="rounded bg-muted/80 px-1 text-xs text-foreground">VAPI_API_KEY</code> and{' '}
              <code className="rounded bg-muted/80 px-1 text-xs text-foreground">VAPI_ASSISTANT_ID</code>, then restart
              the dev server.
            </p>
            {!publicKey?.trim() && <p className="text-xs opacity-90">Missing: key.</p>}
            {publicKey?.trim() && !assistantId?.trim() && <p className="text-xs opacity-90">Missing: assistant ID.</p>}
          </div>
        ) : (
          <VapiControls
            targetRole={targetRole}
            publicKey={publicKey}
            assistantId={assistantId}
            onCallStart={handleCallStart}
            onInterviewSaved={handleInterviewSaved}
            onSaveFailed={handleSaveFailed}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={showAnalysis}
            disabled={!sessionId || analysisLoading || !targetRole}
          >
            {analysisLoading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Show analysis
          </Button>
          {!sessionId && voiceReady && (
            <span className="text-xs text-muted-foreground">Complete a call to enable analysis.</span>
          )}
          {sessionId && (
            <span className="text-xs text-muted-foreground">Ready — report opens in a dialog.</span>
          )}
        </div>
      </CardContent>

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>Interview analysis</DialogTitle>
            <DialogDescription>
              {reportMeta?.targetRole && (
                <span>
                  Target role: <span className="font-medium text-foreground">{reportMeta.targetRole}</span>
                  {reportMeta.cached ? ' · from cache' : ''}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[min(70vh,560px)] px-6 py-4">
            <div className="space-y-4">
              {structured != null && (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Structured output (Vapi)
                  </p>
                  <pre className="max-h-[min(40vh,320px)] overflow-auto text-xs leading-relaxed text-foreground">
                    {JSON.stringify(structured, null, 2)}
                  </pre>
                </div>
              )}
              {report && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{report}</div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
