import { createClient } from '@/lib/supabase/server'
import { regenerateLearningRoadmap } from '@/lib/server/persist-learning-roadmap'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let continuation = false
    try {
      const body = (await request.json()) as { continuation?: boolean }
      continuation = body?.continuation === true
    } catch {
      /* empty body */
    }

    try {
      const result = await regenerateLearningRoadmap(supabase, user.id, id, { continuation })
      return NextResponse.json(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed'
      const status = msg.includes('not found') ? 404 : 502
      return NextResponse.json({ error: msg }, { status })
    }
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
