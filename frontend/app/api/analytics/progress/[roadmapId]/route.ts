import { createClient } from '@/lib/supabase/server'
import { fetchRoadmapSummaryById } from '@/lib/server/progress-analytics'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, context: { params: Promise<{ roadmapId: string }> }) {
  try {
    const { roadmapId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmap = await fetchRoadmapSummaryById(supabase, user.id, roadmapId)
    if (!roadmap) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(roadmap)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
