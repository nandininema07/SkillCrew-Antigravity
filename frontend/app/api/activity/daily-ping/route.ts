import { createClient } from '@/lib/supabase/server'
import { XP_PER_DISTINCT_LOGIN_DAY, levelFromXp } from '@/lib/gamification-xp'
import { isMissingSchemaObject } from '@/lib/server/supabase-schema-helpers'
import { NextResponse } from 'next/server'

function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function utcYesterdayYmd(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === '23505') return true
  return /duplicate key|unique constraint/i.test(err.message || '')
}

/**
 * Call once per dashboard session. Records a UTC calendar login day, awards XP on first visit that day,
 * and maintains consecutive-day streak.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = utcTodayYmd()
    const yesterday = utcYesterdayYmd()
    const now = new Date().toISOString()

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('xp, level, streak, last_login_date')
      .eq('id', user.id)
      .maybeSingle()

    if (profErr && !isMissingSchemaObject(profErr.message)) {
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    const prevXp = typeof profile?.xp === 'number' ? profile.xp : 0
    const prevStreak = typeof profile?.streak === 'number' ? profile.streak : 0
    const last = profile?.last_login_date ? String(profile.last_login_date).slice(0, 10) : null

    const { error: insertErr } = await supabase.from('user_login_days').insert({
      user_id: user.id,
      login_date: today,
    })

    if (insertErr && !isUniqueViolation(insertErr)) {
      if (isMissingSchemaObject(insertErr.message)) {
        await supabase
          .from('profiles')
          .update({ last_active_at: now, updated_at: now })
          .eq('id', user.id)
        return NextResponse.json({
          ok: true,
          migration_required: true,
          xp: prevXp,
          streak: prevStreak,
          login_days: null,
        })
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const alreadyLoggedToday = insertErr && isUniqueViolation(insertErr)

    let { count: loginDays } = await supabase
      .from('user_login_days')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (loginDays == null) loginDays = 0

    if (alreadyLoggedToday) {
      await supabase
        .from('profiles')
        .update({ last_active_at: now, updated_at: now })
        .eq('id', user.id)

      return NextResponse.json({
        ok: true,
        already_logged_today: true,
        xp: prevXp,
        streak: prevStreak,
        level: levelFromXp(prevXp),
        login_days: loginDays,
        xp_gained_today: 0,
      })
    }

    const newStreak = last === yesterday ? prevStreak + 1 : 1

    const newXp = prevXp + XP_PER_DISTINCT_LOGIN_DAY
    const newLevel = levelFromXp(newXp)

    const { error: upErr } = await supabase
      .from('profiles')
      .update({
        xp: newXp,
        level: newLevel,
        streak: newStreak,
        last_login_date: today,
        last_active_at: now,
        updated_at: now,
      })
      .eq('id', user.id)

    if (upErr && !isMissingSchemaObject(upErr.message)) {
      console.warn('[daily-ping] profile update:', upErr.message)
    }

    return NextResponse.json({
      ok: true,
      already_logged_today: false,
      xp: newXp,
      streak: newStreak,
      level: newLevel,
      login_days: loginDays,
      xp_gained_today: XP_PER_DISTINCT_LOGIN_DAY,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
