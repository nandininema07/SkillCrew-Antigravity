import { createClient } from '@/lib/supabase/server'
import { runCoachPipeline, postCoachSideEffects } from '@/lib/server/coach-pipeline'
import { NextResponse } from 'next/server'

/** Node runtime: full coach pipeline + post-effects (DB writes, parallel Archie revise). */
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
      latest_user_message: string
      conversation_id?: string
    }

    const result = await runCoachPipeline(supabase, user, body)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { coachOut, fromCache, direction } = result

    await postCoachSideEffects(
      supabase,
      user.id,
      body.latest_user_message.trim(),
      body.conversation_id,
      coachOut,
      direction,
    )

    const headers = new Headers()
    if (fromCache) headers.set('X-Coach-Cache', 'hit')
    else headers.set('X-Coach-Cache', 'miss')

    return NextResponse.json(coachOut, { headers })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
