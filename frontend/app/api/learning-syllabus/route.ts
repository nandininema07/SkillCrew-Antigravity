import { createClient } from '@/lib/supabase/server'
import { getBackendUrl } from '@/lib/backend-url'
import { NextResponse } from 'next/server'

const MAX_STORE_CHARS = 100_000
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Latest syllabus PDF metadata + preview (for dashboard). */
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

    const { data, error } = await supabase
      .from('user_context_events')
      .select('payload, created_at')
      .eq('user_id', user.id)
      .eq('kind', 'syllabus_pdf')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (error.message.includes('Could not find') || error.message.includes('schema cache')) {
        return NextResponse.json({
          hasSyllabus: false,
          charCount: 0,
          filename: null,
          preview: '',
          updatedAt: null,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const payload = data?.payload as { text?: string; filename?: string; char_count?: number } | null
    const text = typeof payload?.text === 'string' ? payload.text : ''
    return NextResponse.json({
      hasSyllabus: Boolean(text.trim()),
      charCount: typeof payload?.char_count === 'number' ? payload.char_count : text.length,
      filename: typeof payload?.filename === 'string' ? payload.filename : null,
      preview: text.slice(0, 500),
      updatedAt: data?.created_at ?? null,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Upload PDF → FastAPI text extraction → store in user_context_events for Archie / Nova context. */
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

    const secret = process.env.BACKEND_AGENT_SECRET?.trim()?.replace(/^["']|["']$/g, '')
    if (!secret) {
      return NextResponse.json(
        { error: 'BACKEND_AGENT_SECRET is not set on the Next.js server' },
        { status: 503 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required (PDF)' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'PDF must be 15MB or smaller' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const out = new FormData()
    out.append('file', new Blob([buf], { type: 'application/pdf' }), file.name)

    const parseRes = await fetch(`${getBackendUrl()}/api/parse-pdf-text`, {
      method: 'POST',
      headers: { 'X-Agent-Secret': secret },
      body: out,
    })

    if (!parseRes.ok) {
      let detail = parseRes.statusText
      try {
        const j = (await parseRes.json()) as { detail?: unknown }
        if (typeof j.detail === 'string') detail = j.detail
        else if (Array.isArray(j.detail)) detail = JSON.stringify(j.detail)
      } catch {
        /* ignore */
      }
      return NextResponse.json({ error: detail || 'Could not parse PDF' }, { status: parseRes.status })
    }

    const parsed = (await parseRes.json()) as {
      text?: string
      char_count?: number
      filename?: string
    }
    const text = typeof parsed.text === 'string' ? parsed.text : ''
    const storeText = text.slice(0, MAX_STORE_CHARS)
    const charCount = typeof parsed.char_count === 'number' ? parsed.char_count : text.length
    const filename = typeof parsed.filename === 'string' ? parsed.filename : file.name

    const { error: delErr } = await supabase
      .from('user_context_events')
      .delete()
      .eq('user_id', user.id)
      .eq('kind', 'syllabus_pdf')
    if (delErr) {
      console.warn('learning-syllabus delete previous:', delErr.message)
    }

    const { error: insErr } = await supabase.from('user_context_events').insert({
      user_id: user.id,
      source: 'dashboard',
      kind: 'syllabus_pdf',
      payload: { text: storeText, filename, char_count: charCount },
    })
    if (insErr) {
      return NextResponse.json({ error: insErr.message || 'Could not save syllabus text' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      charCount,
      filename,
      preview: text.slice(0, 500),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Remove stored syllabus text (optional; requires DELETE policy — run 006_user_context_events_delete.sql). */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('user_context_events')
      .delete()
      .eq('user_id', user.id)
      .eq('kind', 'syllabus_pdf')

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: 'If this fails with RLS, run frontend/scripts/006_user_context_events_delete.sql in Supabase.',
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
