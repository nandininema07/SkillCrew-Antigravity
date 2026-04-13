import { createClient } from '@/lib/supabase/server'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'
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
      modules: Array<{ id: string; title: string; learning_objective?: string; learningObjective?: string }>
      max_results_per_module?: number
    }
    if (!body.modules?.length) {
      return NextResponse.json({ error: 'modules required' }, { status: 400 })
    }

    const res = await proxyAgent('/dexter/resources', {
      modules: body.modules,
      max_results_per_module: body.max_results_per_module ?? 8,
    })
    if (!res.ok) {
      const err = await readProxyAgentError(res)
      return NextResponse.json({ error: err }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
