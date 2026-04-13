import { createClient } from '@/lib/supabase/server'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'
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

    const body = (await request.json()) as { quiz: Record<string, unknown>; answers: Record<string, number> }
    if (!body.quiz || !body.answers) {
      return NextResponse.json({ error: 'quiz and answers required' }, { status: 400 })
    }

    const res = await proxyAgent('/pip/grade', { quiz: body.quiz, answers: body.answers })
    if (!res.ok) {
      const err = await readProxyAgentError(res)
      return NextResponse.json({ error: err }, { status: res.status })
    }
    const grade = await res.json()

    const { error: qe } = await supabase.from('quiz_sessions').insert({
      user_id: user.id,
      quiz: body.quiz as never,
      grade: grade as never,
    })
    if (qe) console.warn('quiz_sessions:', qe.message)

    await insertContextEvent(supabase, user.id, 'pip', 'quiz_graded', {
      score_percent: (grade as { score_percent?: number }).score_percent,
      mistakes_count: Array.isArray((grade as { mistakes?: unknown[] }).mistakes)
        ? (grade as { mistakes: unknown[] }).mistakes.length
        : 0,
    })

    return NextResponse.json(grade)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
