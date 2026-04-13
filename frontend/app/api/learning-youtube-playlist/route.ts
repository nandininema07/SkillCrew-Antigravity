import { createClient } from '@/lib/supabase/server'
import { getBackendUrl } from '@/lib/backend-url'
import { NextResponse } from 'next/server'

const MAX_STORE_CHARS = 100_000

export const maxDuration = 300

type YoutubeMeta = {
  video_count?: number
  transcripts_ok?: number
  transcripts_failed?: number
  playlist_error?: string
  failed?: unknown[]
}

/** Latest saved playlist transcript context (for dashboard). */
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
      .eq('kind', 'youtube_playlist')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (error.message.includes('Could not find') || error.message.includes('schema cache')) {
        return NextResponse.json({
          hasPlaylist: false,
          charCount: 0,
          videoCount: 0,
          transcriptsOk: 0,
          playlistUrl: null as string | null,
          preview: '',
          updatedAt: null as string | null,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const payload = data?.payload as {
      text?: string
      playlist_url?: string
      char_count?: number
      youtube_transcript_meta?: YoutubeMeta
    } | null
    const text = typeof payload?.text === 'string' ? payload.text : ''
    const meta = payload?.youtube_transcript_meta
    return NextResponse.json({
      hasPlaylist: Boolean(text.trim()),
      charCount: typeof payload?.char_count === 'number' ? payload.char_count : text.length,
      videoCount: typeof meta?.video_count === 'number' ? meta.video_count : 0,
      transcriptsOk: typeof meta?.transcripts_ok === 'number' ? meta.transcripts_ok : 0,
      playlistUrl: typeof payload?.playlist_url === 'string' ? payload.playlist_url : null,
      preview: text.slice(0, 400),
      updatedAt: data?.created_at ?? null,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Resolve playlist → transcripts on FastAPI → store for Archie / Nova. */
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

    const body = (await request.json()) as { playlist_url?: string }
    const playlistUrl = (body.playlist_url || '').trim()
    if (!playlistUrl) {
      return NextResponse.json({ error: 'playlist_url is required' }, { status: 400 })
    }

    const parseRes = await fetch(`${getBackendUrl()}/api/youtube-playlist-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Secret': secret,
      },
      body: JSON.stringify({ playlist_url: playlistUrl }),
      signal: AbortSignal.timeout(280_000),
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
      return NextResponse.json({ error: detail || 'Could not process playlist' }, { status: parseRes.status })
    }

    const parsed = (await parseRes.json()) as {
      text?: string
      char_count?: number
      playlist_url?: string
      youtube_transcript_meta?: YoutubeMeta
      playlist_resolve_error?: string | null
    }

    if (parsed.playlist_resolve_error) {
      return NextResponse.json(
        { error: parsed.playlist_resolve_error },
        { status: 400 },
      )
    }

    const text = typeof parsed.text === 'string' ? parsed.text : ''
    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            'No caption text was extracted (videos may lack captions or transcripts were unavailable).',
        },
        { status: 400 },
      )
    }

    const storeText = text.slice(0, MAX_STORE_CHARS)
    const charCount = typeof parsed.char_count === 'number' ? parsed.char_count : text.length
    const meta = parsed.youtube_transcript_meta || {}
    const savedUrl = typeof parsed.playlist_url === 'string' ? parsed.playlist_url : playlistUrl

    const { error: delErr } = await supabase
      .from('user_context_events')
      .delete()
      .eq('user_id', user.id)
      .eq('kind', 'youtube_playlist')
    if (delErr) {
      console.warn('learning-youtube-playlist delete previous:', delErr.message)
    }

    const { error: insErr } = await supabase.from('user_context_events').insert({
      user_id: user.id,
      source: 'dashboard',
      kind: 'youtube_playlist',
      payload: {
        text: storeText,
        playlist_url: savedUrl,
        char_count: charCount,
        youtube_transcript_meta: meta,
      },
    })
    if (insErr) {
      return NextResponse.json({ error: insErr.message || 'Could not save playlist context' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      charCount,
      videoCount: typeof meta.video_count === 'number' ? meta.video_count : 0,
      transcriptsOk: typeof meta.transcripts_ok === 'number' ? meta.transcripts_ok : 0,
      playlistUrl: savedUrl,
      preview: text.slice(0, 400),
    })
  } catch (e) {
    console.error(e)
    if (
      e instanceof Error &&
      (e.name === 'TimeoutError' || e.name === 'AbortError' || e.message.includes('timeout'))
    ) {
      return NextResponse.json({ error: 'Playlist processing timed out — try a shorter playlist.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
      .eq('kind', 'youtube_playlist')

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
