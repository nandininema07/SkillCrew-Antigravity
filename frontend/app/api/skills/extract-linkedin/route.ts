import { getBackendUrl } from '@/lib/backend-url'
import { linkedinWarningFromMaster, skillsFromMaster, type MasterProfileResponse } from '@/lib/map-master-skills'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Proxies to Python `/api/scrape-linkedin` (Apify + Firecrawl) and returns skills for preview + save.
 */
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
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 })
    }

    const fd = new FormData()
    fd.append('linkedin_url', linkedin_url)

    const backendUrl = getBackendUrl()
    const backendResponse = await fetch(`${backendUrl}/api/scrape-linkedin`, {
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
        { error: detail || 'LinkedIn extraction failed' },
        { status: backendResponse.status >= 400 && backendResponse.status < 600 ? backendResponse.status : 502 },
      )
    }

    const master = (await backendResponse.json()) as MasterProfileResponse
    const skills = skillsFromMaster(master, 'linkedin')
    const warning = linkedinWarningFromMaster(master)

    return NextResponse.json({
      skills,
      warning: warning ?? null,
      message:
        skills.length === 0
          ? 'No skills found in the profile. You can add skills manually or try another URL.'
          : `Found ${skills.length} skills`,
    })
  } catch (e) {
    console.error('extract-linkedin:', e)
    return NextResponse.json(
      { error: 'Backend unreachable. Start the API server (see BACKEND_URL) or try again later.' },
      { status: 502 },
    )
  }
}
