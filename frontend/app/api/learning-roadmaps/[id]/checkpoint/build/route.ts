import { createClient } from '@/lib/supabase/server'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'
import { NextResponse } from 'next/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: roadmapId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      topics_covered: string[]
      question_count?: number
      roadmap_mode?: 'skills' | 'job_ready'
    }
    const topics = Array.isArray(body.topics_covered)
      ? body.topics_covered.map((t) => String(t).trim()).filter(Boolean)
      : []
    if (topics.length === 0) {
      return NextResponse.json({ error: 'topics_covered required' }, { status: 400 })
    }

    const [{ data: prefs }, { data: roadmapRow }] = await Promise.all([
      supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('user_archie_roadmaps')
        .select('direction, display_title')
        .eq('id', roadmapId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const direction =
      typeof roadmapRow?.direction === 'string' ? roadmapRow.direction.trim() : ''
    const displayTitle =
      typeof roadmapRow?.display_title === 'string' ? roadmapRow.display_title.trim() : ''

    const res = await proxyAgent('/pip/checkpoint/build', {
      topics_covered: topics,
      preferences: (prefs || {}) as Record<string, unknown>,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      question_count: Math.min(10, Math.max(3, body.question_count ?? 6)),
      roadmap_direction: direction || undefined,
      track_title: displayTitle || undefined,
      roadmap_mode: body.roadmap_mode,
    })

    if (!res.ok) {
      const err = await readProxyAgentError(res)
      return NextResponse.json({ error: err }, { status: res.status })
    }

    const text = await res.text()
    let assessment: Record<string, unknown>;
    try {
      assessment = JSON.parse(text) as Record<string, unknown>
    } catch (e) {
      return NextResponse.json({ error: `Agent build response was not valid JSON: ${text}` }, { status: 502 })
    }
    return NextResponse.json({ assessment })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
