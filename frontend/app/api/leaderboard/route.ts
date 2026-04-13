import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { levelFromXp } from '@/lib/gamification-xp'
import { NextResponse } from 'next/server'

type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  xp: number | null
  level: number | null
  streak: number | null
}

/** Prefer service-role `profiles` query (no RPC / schema cache). Fallback: SECURITY DEFINER RPCs if migrations applied. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sort = (searchParams.get('sort') || 'xp').toLowerCase()
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10))

    let rows: ProfileRow[] | null = null
    let fetchError: string | null = null

    const admin = createServiceRoleClient()
    if (admin) {
      let q = admin.from('profiles').select('id, full_name, avatar_url, xp, level, streak')

      if (sort === 'streak') {
        q = q.order('streak', { ascending: false }).order('xp', { ascending: false })
      } else if (sort === 'level') {
        q = q.order('level', { ascending: false }).order('xp', { ascending: false })
      } else {
        q = q.order('xp', { ascending: false })
      }

      const res = await q.limit(limit)
      if (res.error) {
        fetchError = res.error.message
      } else {
        rows = (res.data || []) as ProfileRow[]
      }
    }

    if (!rows && fetchError == null) {
      fetchError = 'SUPABASE_SERVICE_ROLE_KEY is not set; cannot load leaderboard.'
    }

    if (!rows) {
      const rpc =
        sort === 'streak'
          ? 'leaderboard_by_streak'
          : sort === 'level'
            ? 'leaderboard_by_level'
            : 'leaderboard_by_xp'

      const { data, error } = await supabase.rpc(rpc, { limit_count: limit })
      if (!error && data) {
        rows = data as ProfileRow[]
        fetchError = null
      } else if (error) {
        return NextResponse.json(
          {
            error:
              fetchError ||
              error.message ||
              'Leaderboard unavailable. Set SUPABASE_SERVICE_ROLE_KEY in the server env, or apply the leaderboard RPC migrations.',
            items: [],
          },
          { status: 503 },
        )
      }
    }

    if (!rows) {
      return NextResponse.json({ error: fetchError || 'No leaderboard data', items: [] }, { status: 503 })
    }

    const items = rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.id,
      name: (r.full_name || 'Learner').trim() || 'Learner',
      avatar: r.avatar_url || undefined,
      xp: typeof r.xp === 'number' ? r.xp : 0,
      level: typeof r.level === 'number' ? r.level : levelFromXp(typeof r.xp === 'number' ? r.xp : 0),
      streak: typeof r.streak === 'number' ? r.streak : 0,
    }))

    return NextResponse.json({ sort, items })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
