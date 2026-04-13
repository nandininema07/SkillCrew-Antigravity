import { getBackendUrl } from '@/lib/backend-url'
import { linkedinWarningFromMaster, skillsFromMaster, type MasterProfileResponse } from '@/lib/map-master-skills'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Settings page: scrape LinkedIn via backend and upsert skills into Supabase immediately. */
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

    const body = await request.json()
    const linkedin_url = typeof body.linkedin_url === 'string' ? body.linkedin_url.trim() : ''
    if (!linkedin_url) {
      return NextResponse.json({ error: 'LinkedIn URL is required' }, { status: 400 })
    }

    const fd = new FormData()
    fd.append('linkedin_url', linkedin_url)

    const backendResponse = await fetch(`${getBackendUrl()}/api/scrape-linkedin`, {
      method: 'POST',
      body: fd,
    })

    if (!backendResponse.ok) {
      let detail = await backendResponse.text()
      try {
        const j = JSON.parse(detail) as { detail?: unknown }
        if (typeof j.detail === 'string') detail = j.detail
      } catch {
        /* use raw */
      }
      return NextResponse.json(
        { error: detail || 'LinkedIn import failed' },
        { status: backendResponse.status >= 400 && backendResponse.status < 600 ? backendResponse.status : 502 },
      )
    }

    const master = (await backendResponse.json()) as MasterProfileResponse
    const skills = skillsFromMaster(master, 'linkedin')
    const warning = linkedinWarningFromMaster(master)

    if (skills.length === 0) {
      return NextResponse.json({
        message: warning
          ? `Import finished with a notice: ${warning.slice(0, 200)}`
          : 'No skills found to import.',
        skills: [],
        warning: warning ?? null,
      })
    }

    const skillsToInsert = skills.map((s) => ({
      user_id: user.id,
      name: s.name,
      level: s.level,
      confidence: s.confidence,
      source: 'linkedin' as const,
      updated_at: new Date().toISOString(),
    }))

    const { data, error: insertError } = await supabase
      .from('skills')
      .upsert(skillsToInsert, { onConflict: 'user_id,name' })
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Skills imported successfully from LinkedIn',
      skills: data,
      warning: warning ?? null,
    })
  } catch (e) {
    console.error('scrape-linkedin:', e)
    return NextResponse.json(
      { error: 'Backend unreachable. Start the Python API (BACKEND_URL) or try again later.' },
      { status: 502 },
    )
  }
}
