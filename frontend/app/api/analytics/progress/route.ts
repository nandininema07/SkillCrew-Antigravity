import { createClient } from '@/lib/supabase/server'
import { fetchProgressAnalytics } from '@/lib/server/progress-analytics'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await fetchProgressAnalytics(supabase, user.id)
    return NextResponse.json(payload)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
