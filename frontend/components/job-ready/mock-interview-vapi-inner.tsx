'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyCall, DailyEventObjectTrack } from '@daily-co/daily-js'
import Vapi from '@vapi-ai/web'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, PhoneOff, Loader2, Video } from 'lucide-react'
import { buildVapiAssistantOverrides, isVapiVideoRecordingEnabled } from '@/lib/job-ready/vapi-assistant-overrides'
import { toast } from 'sonner'

function normalizeRoleForTranscript(roleRaw: string): string {
  const r = roleRaw.trim().toLowerCase()
  if (r === 'user' || r === 'customer' || r === 'caller') return 'user'
  if (
    r === 'assistant' ||
    r === 'bot' ||
    r === 'model' ||
    r === 'interviewer' ||
    r === 'system' ||
    r === 'tool'
  ) {
    return 'assistant'
  }
  return roleRaw.trim() || 'assistant'
}

/** Attach local camera preview from Daily's participant snapshot (handles persistentTrack + missed track-started). */
function attachLocalVideoPreview(el: HTMLVideoElement | null, daily: DailyCall): boolean {
  if (!el) return false
  const local = daily.participants()?.local
  const vs = local?.tracks?.video
  if (!vs) return false
  const track = (vs.persistentTrack ?? vs.track) as MediaStreamTrack | undefined
  if (!track || track.kind !== 'video' || track.readyState === 'ended') return false

  const current = el.srcObject
  if (current instanceof MediaStream) {
    const existing = current.getVideoTracks()[0]
    if (existing?.id === track.id) {
      void el.play().catch(() => {})
      return true
    }
  }

  el.srcObject = new MediaStream([track])
  void el.play().catch(() => {})
  return true
}

function appendToTranscript(prev: string, message: unknown): string {
  if (message == null) return prev
  if (typeof message === 'string') return prev + message + '\n\n'
  const m = message as Record<string, unknown>
  const rawRole = (m.role as string) || (m.type as string) || ''
  const content =
    (m.content as string) ||
    (m.transcript as string) ||
    (typeof m.message === 'string' ? m.message : '') ||
    ''
  if (content) {
    const role = rawRole ? normalizeRoleForTranscript(rawRole) : 'assistant'
    const line = `${role}: ${content}`
    return prev + line + '\n\n'
  }
  try {
    return prev + JSON.stringify(message).slice(0, 500) + '\n\n'
  } catch {
    return prev
  }
}

export function MockInterviewVapiInner({
  targetRole,
  publicKey,
  assistantId,
  onCallStart,
  onInterviewSaved,
  onSaveFailed,
}: {
  targetRole: string
  publicKey: string
  assistantId: string
  onCallStart?: () => void
  onInterviewSaved?: (sessionId: string) => void
  onSaveFailed?: (message: string) => void
}) {
  const vapiRef = useRef<Vapi | null>(null)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [saving, setSaving] = useState(false)
  const transcriptRef = useRef('')
  const targetRoleRef = useRef(targetRole)
  const assistantIdRef = useRef(assistantId)
  const onCallStartRef = useRef(onCallStart)
  const onInterviewSavedRef = useRef(onInterviewSaved)
  const onSaveFailedRef = useRef(onSaveFailed)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const localVideoCleanupRef = useRef<(() => void) | null>(null)
  const vapiCallIdRef = useRef<string | null>(null)

  useEffect(() => {
    targetRoleRef.current = targetRole
  }, [targetRole])
  useEffect(() => {
    assistantIdRef.current = assistantId
  }, [assistantId])
  useEffect(() => {
    onCallStartRef.current = onCallStart
  }, [onCallStart])
  useEffect(() => {
    onInterviewSavedRef.current = onInterviewSaved
  }, [onInterviewSaved])
  useEffect(() => {
    onSaveFailedRef.current = onSaveFailed
  }, [onSaveFailed])

  useEffect(() => {
    transcriptRef.current = ''
    const vapi = new Vapi(publicKey)
    vapiRef.current = vapi

    const onMessage = (message: unknown) => {
      transcriptRef.current = appendToTranscript(transcriptRef.current, message)
    }

    vapi.on('call-start', () => {
      vapiCallIdRef.current = null
      setActive(true)
      setStarting(false)
      onCallStartRef.current?.()

      localVideoCleanupRef.current?.()
      localVideoCleanupRef.current = null

      if (!isVapiVideoRecordingEnabled()) return

      const daily = vapi.getDailyCallObject()
      if (!daily) return

      const tryAttach = () => attachLocalVideoPreview(videoRef.current, daily)

      const onTrackStarted = (e: DailyEventObjectTrack) => {
        if (!e.participant?.local || e.track?.kind !== 'video') return
        tryAttach()
      }

      const onParticipantUpdated = (e: { participant?: { local?: boolean } }) => {
        if (e.participant?.local) tryAttach()
      }

      const onJoinedMeeting = () => tryAttach()
      const onStartedCamera = () => tryAttach()

      daily.on('track-started', onTrackStarted)
      daily.on('participant-updated', onParticipantUpdated)
      daily.on('joined-meeting', onJoinedMeeting)
      daily.on('started-camera', onStartedCamera)

      tryAttach()

      let pollId: number | null = null
      let pollSafetyId: number | null = null

      const stopPolling = () => {
        if (pollId != null) {
          window.clearInterval(pollId)
          pollId = null
        }
        if (pollSafetyId != null) {
          window.clearTimeout(pollSafetyId)
          pollSafetyId = null
        }
      }

      pollId = window.setInterval(() => {
        if (tryAttach()) stopPolling()
      }, 300)

      pollSafetyId = window.setTimeout(() => stopPolling(), 15000)

      localVideoCleanupRef.current = () => {
        stopPolling()
        try {
          daily.off('track-started', onTrackStarted)
          daily.off('participant-updated', onParticipantUpdated)
          daily.off('joined-meeting', onJoinedMeeting)
          daily.off('started-camera', onStartedCamera)
        } catch {
          /* ignore */
        }
        const el = videoRef.current
        if (el) {
          el.srcObject = null
        }
      }
    })

    const onCallStartSuccess = (e: { callId?: string }) => {
      if (e.callId && e.callId !== 'unknown') {
        vapiCallIdRef.current = e.callId
      }
    }
    vapi.on('call-start-success' as Parameters<Vapi['on']>[0], onCallStartSuccess as Parameters<Vapi['on']>[1])

    vapi.on('call-end', async () => {
      localVideoCleanupRef.current?.()
      localVideoCleanupRef.current = null
      setActive(false)
      const t = transcriptRef.current.trim()
      const role = targetRoleRef.current
      if (!t || !role) return

      setSaving(true)
      try {
        const res = await fetch('/api/job-ready/mock-interview/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            transcript: t,
            targetRole: role,
            vapiAssistantId: assistantIdRef.current,
            vapiCallId: vapiCallIdRef.current,
          }),
        })
        const json = (await res.json()) as { sessionId?: string; error?: string }
        if (!res.ok) {
          throw new Error(json.error ?? 'Could not save interview')
        }
        if (json.sessionId) {
          onInterviewSavedRef.current?.(json.sessionId)
        }
      } catch (e) {
        onSaveFailedRef.current?.(e instanceof Error ? e.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    })

    vapi.on('message', onMessage)
    vapi.on('error', (e: unknown) => {
      console.error('Vapi error', e)
      setStarting(false)
    })

    vapi.on('camera-error', (err: unknown) => {
      console.error('Vapi camera error', err)
      toast.error('Camera access failed. Allow camera for this site, or set NEXT_PUBLIC_VAPI_VIDEO_RECORDING=false for audio-only.')
    })

    return () => {
      localVideoCleanupRef.current?.()
      localVideoCleanupRef.current = null
      vapi.removeAllListeners()
      void vapi.stop().catch(() => {})
      vapiRef.current = null
    }
  }, [publicKey])

  const start = useCallback(async () => {
    const vapi = vapiRef.current
    if (!vapi) return
    setStarting(true)
    transcriptRef.current = ''
    try {
      const role = targetRoleRef.current.trim()
      const overrides = buildVapiAssistantOverrides(role)
      await vapi.start(assistantIdRef.current, overrides ?? undefined)
    } catch (e) {
      console.error(e)
      setStarting(false)
    }
  }, [])

  const stop = useCallback(async () => {
    const vapi = vapiRef.current
    if (!vapi) return
    await vapi.stop()
    setActive(false)
  }, [])

  const showVideoPreview = isVapiVideoRecordingEnabled()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!active ? (
          <Button type="button" onClick={start} disabled={starting || !targetRole || saving} size="sm">
            {starting ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
            Start mock interview
          </Button>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={stop}>
            <PhoneOff className="size-4" />
            End call
          </Button>
        )}
        {active && (
          <Badge variant="secondary" className="animate-pulse">
            Live
          </Badge>
        )}
        {showVideoPreview && active && (
          <Badge variant="outline" className="gap-1 font-normal">
            <Video className="size-3.5" />
            Camera + recording
          </Badge>
        )}
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Saving interview…
          </span>
        )}
      </div>

      {showVideoPreview && (
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
          <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Video className="size-3.5" />
              Your camera (sent to Vapi for interview recording)
            </span>
          </div>
          <div className="relative aspect-video max-h-[min(280px,45vh)] w-full bg-black/80">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
              aria-label="Your camera preview"
            />
            {!active && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-muted-foreground">
                Preview appears when the call is live
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
