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
      return NextResponse.json({ error: 'Unauthorized - Please log in to generate revision materials' }, { status: 401 })
    }

    const body = (await request.json()) as { topics: string[]; notes?: string | null; locale?: string | null }
    if (!body.topics?.length) {
      return NextResponse.json({ error: 'topics required' }, { status: 400 })
    }

    const res = await proxyAgent('/pip/revision-pack', {
      topics: body.topics,
      notes: body.notes ?? null,
      locale: body.locale ?? null,
    })
    if (!res.ok) {
      const err = await readProxyAgentError(res)
      return NextResponse.json({ error: err }, { status: res.status })
    }
    return NextResponse.json(await res.json())
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
