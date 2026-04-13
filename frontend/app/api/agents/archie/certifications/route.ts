import { createClient } from '@/lib/supabase/server'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'
import { buildLearnerContextPayload } from '@/lib/server/learner-context'
import { normalizeCertificationsBundle } from '@/lib/agents/normalize-roadmap'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { direction?: string }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    const direction =
      (body.direction && body.direction.trim()) ||
      (profile?.learning_direction as string | undefined)?.trim() ||
      ''
    if (!direction) {
      return NextResponse.json({ error: 'Missing learning direction' }, { status: 400 })
    }

    const learner = await buildLearnerContextPayload(supabase, user.id, {
      direction,
      roadmap_intent: 'skills',
    })
    const context = { ...learner, roadmap_intent: 'certifications' }

    const res = await proxyAgent('/archie/certifications', { context })
    if (!res.ok) {
      const err = await readProxyAgentError(res)
      return NextResponse.json({ error: err }, { status: res.status })
    }
    const raw = (await res.json()) as Record<string, unknown>
    const bundle = normalizeCertificationsBundle(raw)
    return NextResponse.json({ bundle, raw })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
