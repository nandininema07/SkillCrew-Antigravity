import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type RpcResult = {
  ok?: boolean
  already_unlocked?: boolean
  xp?: number
  level?: number
  xp_spent?: number
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const { data, error } = await supabase.rpc('unlock_roadmap_capstone', {
      p_roadmap_id: id,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('insufficient_xp')) {
        return NextResponse.json(
          { error: 'You need at least 300 XP in your account to unlock the capstone.' },
          { status: 400 },
        )
      }
      if (msg.includes('roadmap_not_found')) {
        return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })
      }
      if (msg.includes('not_authenticated')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      console.error('[capstone unlock]', error)
      return NextResponse.json({ error: error.message || 'Unlock failed' }, { status: 500 })
    }

    const out = data as RpcResult | null
    return NextResponse.json({
      ok: true,
      already_unlocked: !!out?.already_unlocked,
      xp: typeof out?.xp === 'number' ? out.xp : undefined,
      level: typeof out?.level === 'number' ? out.level : undefined,
      xp_spent: typeof out?.xp_spent === 'number' ? out.xp_spent : 300,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
