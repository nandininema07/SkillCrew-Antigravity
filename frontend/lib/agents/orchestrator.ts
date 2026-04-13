import { reviseArchieRoadmap } from '@/lib/agents/archie'

export type CoachResponse = {
  assistant_message?: string
  signals?: { type: string; detail: string }[]
  actions?: {
    update_preferences?: Record<string, unknown> | null
    refresh_roadmap?: boolean
    roadmap_adjustment_notes?: string
    ask_user_followup?: string | null
  }
}

export async function sendCoachMessage(
  latest_user_message: string,
  conversation_id?: string,
): Promise<CoachResponse> {
  const res = await fetch('/api/agents/coach', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latest_user_message, conversation_id }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<CoachResponse>
}

/**
 * Streaming coach pipeline (Edge NDJSON). UI can read phases as soon as they arrive.
 * Returns the final coach payload from the `complete` event.
 */
export async function sendCoachMessageStream(
  latest_user_message: string,
  conversation_id: string | undefined,
  onEvent?: (ev: { type: string; [k: string]: unknown }) => void,
): Promise<CoachResponse> {
  const res = await fetch('/api/agents/coach/stream', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latest_user_message, conversation_id }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  let final: CoachResponse | null = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as { type: string; coach?: CoachResponse; message?: string }
        onEvent?.(ev)
        if (ev.type === 'error') {
          throw new Error(typeof ev.message === 'string' ? ev.message : 'Stream error')
        }
        if (ev.type === 'complete' && ev.coach) {
          final = ev.coach as CoachResponse
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }
  if (!final) {
    throw new Error('Stream ended without complete event')
  }
  return final
}

/** After Pip or coach flags refresh: revise roadmap using latest raw bundle + signals. */
export async function refreshRoadmapFromSignals(opts: {
  currentBundle: Record<string, unknown>
  adaptation_signals: Record<string, unknown>
  roadmap_intent: 'skills' | 'job_ready'
  direction?: string
}) {
  return reviseArchieRoadmap({
    current_bundle: opts.currentBundle,
    adaptation_signals: opts.adaptation_signals,
    roadmap_intent: opts.roadmap_intent,
    direction: opts.direction,
  })
}

export async function logUserContext(source: string, kind: string, payload?: Record<string, unknown>) {
  await fetch('/api/agents/context', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, kind, payload }),
  })
}
