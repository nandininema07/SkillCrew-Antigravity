import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const maxDuration = 60

type Body = {
  transcript?: string
  targetRole?: string
  vapiAssistantId?: string | null
  vapiCallId?: string | null
}

/**
 * Persist transcript after a Vapi call. Does not return transcript text to the client.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const transcript = (body.transcript ?? '').trim()
  const targetRole = (body.targetRole ?? '').trim()
  if (!transcript || !targetRole) {
    return NextResponse.json({ error: 'transcript and targetRole are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapiCallId = (body.vapiCallId ?? '').trim() || null

  const { data, error } = await supabase
    .from('mock_interview_sessions')
    .insert({
      user_id: user.id,
      target_role: targetRole,
      transcript,
      vapi_assistant_id: body.vapiAssistantId?.trim() || null,
      vapi_call_id: vapiCallId,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: 'Ensure the mock_interview_sessions table exists (see supabase/migrations).' },
      { status: 500 },
    )
  }

  return NextResponse.json({ sessionId: data.id })
}
