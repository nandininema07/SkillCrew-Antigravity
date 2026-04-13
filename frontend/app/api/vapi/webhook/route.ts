import { createServiceRoleClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Vapi Server URL target: POST `https://<your-host>/api/vapi/webhook`
 * Handles `end-of-call-report` (and `status-update` when ended) to cache
 * `artifact.structuredOutputs` on `mock_interview_sessions` by `vapi_call_id`.
 *
 * Configure in Vapi Dashboard → Assistant → Server URL (or org default).
 * For local dev: `ngrok http 3000` → use `https://<subdomain>.ngrok-free.app/api/vapi/webhook`
 */
export async function POST(req: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim()
  if (secret) {
    const headerSecret =
      req.headers.get('x-vapi-secret')?.trim() ||
      req.headers.get('x-api-key')?.trim() ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    if (headerSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const root = body as Record<string, unknown>
  const message = root.message as Record<string, unknown> | undefined
  if (!message || typeof message !== 'object') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const type = message.type
  if (type !== 'end-of-call-report' && type !== 'status-update') {
    return NextResponse.json({ ok: true })
  }

  if (type === 'status-update' && message.status !== 'ended') {
    return NextResponse.json({ ok: true })
  }

  const call = message.call as Record<string, unknown> | undefined
  const callId = typeof call?.id === 'string' ? call.id : null
  if (!callId) {
    return NextResponse.json({ ok: true })
  }

  const artifact =
    (message.artifact as Record<string, unknown> | undefined) ??
    (call?.artifact as Record<string, unknown> | undefined)
  const structured = artifact?.structuredOutputs

  if (structured == null) {
    return NextResponse.json({ ok: true, callId, note: 'no structuredOutputs yet' })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    console.error(
      '[vapi/webhook] SUPABASE_SERVICE_ROLE_KEY is not set; cannot persist structured output',
    )
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 503 })
  }

  const { data, error } = await admin
    .from('mock_interview_sessions')
    .update({
      vapi_structured_output: structured as object,
      updated_at: new Date().toISOString(),
    })
    .eq('vapi_call_id', callId)
    .select('id')

  if (error) {
    console.error('[vapi/webhook] supabase update', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const updated = Array.isArray(data) && data.length > 0
  if (!updated) {
    console.info(
      '[vapi/webhook] no row matched vapi_call_id (session may not be saved yet):',
      callId,
    )
  }

  return NextResponse.json({ ok: true, updated, callId })
}
