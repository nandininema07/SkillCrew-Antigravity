import { createClient } from '@/lib/supabase/server'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'
import { NextResponse } from 'next/server'

/** Server-only: ask Python to send today's learning digest (WhatsApp/voice) if schedule + activity allow. */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const res = await proxyAgent('/engagement/digest-if-due', { user_id: user.id })
    if (!res.ok) {
      return NextResponse.json(
        { error: await readProxyAgentError(res) },
        { status: res.status >= 400 ? res.status : 502 },
      )
    }

    const payload = (await res.json()) as Record<string, unknown>
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
