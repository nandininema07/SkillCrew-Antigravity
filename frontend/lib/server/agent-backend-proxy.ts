import { getBackendUrl } from '@/lib/backend-url'

/** Parse error body from Python FastAPI or from our own proxy JSON — avoids double-encoded JSON in UI. */
export async function readProxyAgentError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string; detail?: unknown }
    if (typeof j.error === 'string') return j.error
    if (typeof j.detail === 'string') return j.detail
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join('; ')
    }
  } catch {
    /* plain text */
  }
  return text.trim() || res.statusText || 'Request failed'
}

/** Server-only: call Python internal agent routes. */
export async function proxyAgent<TBody extends object>(
  path: string,
  body: TBody,
): Promise<Response> {
  const base = getBackendUrl()
  const raw = process.env.BACKEND_AGENT_SECRET?.trim() ?? ''
  const secret = raw.replace(/^["']|["']$/g, '').trim()
  if (!secret) {
    return new Response(
      JSON.stringify({
        error:
          'BACKEND_AGENT_SECRET is not set for Next.js. Add it to frontend/.env.local (same value as backend/.env) and restart `next dev`.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  return fetch(`${base}/internal/agents${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify(body),
  })
}
