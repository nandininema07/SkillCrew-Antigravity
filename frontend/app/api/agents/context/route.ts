import { createClient } from '@/lib/supabase/server'
import { insertContextEvent } from '@/lib/server/learner-context'
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

    const body = (await request.json()) as {
      source: string
      kind: string
      payload?: Record<string, unknown>
    }
    if (!body.source || !body.kind) {
      return NextResponse.json({ error: 'source and kind required' }, { status: 400 })
    }

    const { error } = await insertContextEvent(supabase, user.id, body.source, body.kind, body.payload || {})
    if (error) {
      console.warn('user_context_events:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
