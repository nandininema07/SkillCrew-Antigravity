import { getBackendUrl } from '@/lib/backend-url'
import { skillsFromMaster, type MasterProfileResponse } from '@/lib/map-master-skills'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Proxies PDF to Python `/api/parse-resume` (Gemini) and returns skills for preview + save.
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

    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data with file field' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF resumes are supported' }, { status: 400 })
    }

    const fd = new FormData()
    fd.append('resume_file', file)

    const backendUrl = getBackendUrl()
    const backendResponse = await fetch(`${backendUrl}/api/parse-resume`, {
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
        { error: detail || 'Resume parsing failed' },
        { status: backendResponse.status >= 400 && backendResponse.status < 600 ? backendResponse.status : 502 },
      )
    }

    const master = (await backendResponse.json()) as MasterProfileResponse
    const skills = skillsFromMaster(master, 'resume')

    return NextResponse.json({
      skills,
      message:
        skills.length === 0
          ? 'No skills detected in this PDF. Try another file or add skills manually.'
          : `Found ${skills.length} skills`,
    })
  } catch (e) {
    console.error('extract-resume:', e)
    return NextResponse.json(
      { error: 'Backend unreachable. Start the API server (see BACKEND_URL) or try again later.' },
      { status: 502 },
    )
  }
}
