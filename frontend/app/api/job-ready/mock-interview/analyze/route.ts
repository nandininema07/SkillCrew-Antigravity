import { createClient } from '@/lib/supabase/server'
import { getBackendUrl } from '@/lib/backend-url'
import { NextResponse } from 'next/server'

export const maxDuration = 120

type Body = {
  sessionId?: string
}

/** Omit empty `{}` / `[]` sentinels so the dialog only shows real Vapi data. */
function pickStructuredForUi(raw: unknown): unknown | null {
  if (raw == null) return null
  if (typeof raw !== 'object') return raw
  if (Array.isArray(raw)) return raw.length > 0 ? raw : null
  return Object.keys(raw as object).length > 0 ? raw : null
}

async function fetchVapiStructuredOutputs(callId: string): Promise<unknown | null> {
  const backendUrl = getBackendUrl()
  const res = await fetch(`${backendUrl}/api/job-ready/mock-interview/vapi-structured`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: callId }),
  })
  if (!res.ok) {
    const t = await res.text()
    console.warn('[mock-interview/analyze] Vapi structured fetch failed', res.status, t.slice(0, 300))
    return null
  }
  const json = (await res.json()) as { structuredOutputs?: unknown }
  return json.structuredOutputs ?? null
}

async function buildDetailedReport(transcript: string, targetRole: string): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim()
  if (!key) {
    return [
      '## Interview report (offline mode)',
      '',
      'Set **GROQ_API_KEY** in your environment for AI-generated coaching. Until then, use this checklist:',
      '',
      '### Structure',
      '- Did answers follow Situation → Task → Action → Result where appropriate?',
      '- Were openings and closings clear?',
      '',
      '### Role fit (' + targetRole + ')',
      '- Did you tie examples to responsibilities typical for this role?',
      '',
      '### Communication',
      '- Pace, specificity, metrics — note one upgrade per area.',
      '',
      '_Transcript stored securely; length: ' + transcript.length + ' characters._',
    ].join('\n')
  }

  const system = [
    'You are an expert interview coach.',
    'Produce a detailed, structured report for a mock interview candidate.',
    'Target role: ' + targetRole + '.',
    '',
    'Use clear Markdown headings exactly as below (no preamble):',
    '## Executive summary',
    '## What went well',
    '## Gaps and risks',
    '## How to improve (prioritized)',
    '## Practice plan (next 7 days)',
    '## Role-specific tips (' + targetRole + ')',
    '',
    'Be specific: reference themes from the transcript without quoting long verbatim chunks.',
    'Under "How to improve", give numbered, actionable steps.',
    'Tone: supportive, direct, interview-ready.',
  ].join('\n')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: 'Mock interview transcript:\n\n' + transcript.slice(0, 28000),
        },
      ],
      temperature: 0.35,
      max_tokens: 2500,
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Groq error ${res.status}: ${t.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty report from model')
  return text
}

type SessionRow = {
  id: string
  user_id: string
  target_role: string
  transcript: string
  analysis_report: string | null
  vapi_call_id: string | null
  vapi_structured_output: unknown | null
}

/**
 * Loads transcript from DB (server-only), generates or returns cached report.
 * Fetches Vapi `artifact.structuredOutputs` via FastAPI when `vapi_call_id` is set.
 * Response never includes the transcript.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionId = (body.sessionId ?? '').trim()
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row, error: fetchError } = await supabase
    .from('mock_interview_sessions')
    .select(
      'id, user_id, target_role, transcript, analysis_report, vapi_call_id, vapi_structured_output',
    )
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const r = row as SessionRow

  const needsStructuredBackfill =
    Boolean(r.analysis_report?.trim()) &&
    Boolean(r.vapi_call_id?.trim()) &&
    r.vapi_structured_output == null

  if (needsStructuredBackfill && r.vapi_call_id) {
    try {
      const structured = await fetchVapiStructuredOutputs(r.vapi_call_id)
      if (structured == null) {
        const { error: upError } = await supabase
          .from('mock_interview_sessions')
          .update({
            vapi_structured_output: {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('user_id', user.id)

        if (upError) {
          return NextResponse.json({ error: upError.message }, { status: 500 })
        }

        return NextResponse.json({
          report: r.analysis_report ?? '',
          structured: null,
          cached: true,
          targetRole: r.target_role,
        })
      }

      const { error: upError } = await supabase
        .from('mock_interview_sessions')
        .update({
          vapi_structured_output: structured as object,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)

      if (upError) {
        return NextResponse.json({ error: upError.message }, { status: 500 })
      }

      return NextResponse.json({
        report: r.analysis_report ?? '',
        structured: pickStructuredForUi(structured),
        cached: false,
        targetRole: r.target_role,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Structured output fetch failed'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  if (r.analysis_report?.trim()) {
    return NextResponse.json({
      report: r.analysis_report,
      structured: pickStructuredForUi(r.vapi_structured_output),
      cached: true,
      targetRole: r.target_role,
    })
  }

  try {
    let structured: unknown | null = null
    if (r.vapi_call_id?.trim()) {
      structured = await fetchVapiStructuredOutputs(r.vapi_call_id.trim())
    }

    const groqReport = await buildDetailedReport(r.transcript, r.target_role)
    const report = groqReport

    const { error: upError } = await supabase
      .from('mock_interview_sessions')
      .update({
        analysis_report: report,
        vapi_structured_output:
          structured != null ? (structured as object) : ({} as object),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (upError) {
      return NextResponse.json({ error: upError.message }, { status: 500 })
    }

    return NextResponse.json({
      report,
      structured: pickStructuredForUi(structured),
      cached: false,
      targetRole: r.target_role,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Report generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
