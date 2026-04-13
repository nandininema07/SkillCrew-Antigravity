import type { SupabaseClient } from '@supabase/supabase-js'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'
import { buildLearnerContextPayload, insertContextEvent } from '@/lib/server/learner-context'
import {
  hashCoachInput,
  lookupCoachExact,
  lookupCoachSemantic,
  storeCoachResponse,
} from '@/lib/server/agent-cache'
import { embedTextOpenAI } from '@/lib/agents/embeddings'
import { planCoachSideEffects, type CoachRoutePlan } from '@/lib/agents/coach-router'

export type CoachPipelineResult = {
  coachOut: Record<string, unknown>
  fromCache: boolean
  router: CoachRoutePlan
  direction: string
}

async function fetchProfileAndMessages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string | undefined,
) {
  return Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    conversationId
      ? supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(24)
      : Promise.resolve({ data: null as unknown, error: null as unknown }),
  ])
}

export async function runCoachPipeline(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  body: { latest_user_message: string; conversation_id?: string },
): Promise<CoachPipelineResult | { error: string; status: number }> {
  const msg = (body.latest_user_message || '').trim()
  if (!msg) {
    return { error: 'latest_user_message required', status: 400 }
  }

  const router = planCoachSideEffects(msg)

  const inputHash = await hashCoachInput(msg)
  let cached: Record<string, unknown> | null = await lookupCoachExact(supabase, inputHash)
  if (!cached) {
    const emb = await embedTextOpenAI(msg)
    if (emb) {
      cached = await lookupCoachSemantic(supabase, emb)
    }
  }

  if (cached) {
    const { data: prof } = await supabase.from('profiles').select('learning_direction').eq('id', user.id).maybeSingle()
    const direction = ((prof?.learning_direction as string | null) || '').trim()
    return { coachOut: cached, fromCache: true, router, direction }
  }

  const [profileResult, messagesResult] = await fetchProfileAndMessages(
    supabase,
    user.id,
    body.conversation_id,
  )

  const profile = profileResult.data
  const rows = messagesResult.data as { role: string; content: string; created_at?: string }[] | null
  const recent = (rows || [])
    .slice()
    .reverse()
    .map((r) => ({ role: r.role, content: r.content }))

  const direction = (profile?.learning_direction as string | null)?.trim() || ''

  const learner = await buildLearnerContextPayload(supabase, user.id, {
    direction: direction || 'General learning',
    roadmap_intent: 'skills',
  })

  const lastActive = profile?.last_active_at ? new Date(profile.last_active_at as string) : null
  const inactiveDays =
    lastActive && !Number.isNaN(lastActive.getTime())
      ? Math.max(0, Math.floor((Date.now() - lastActive.getTime()) / 86400000))
      : null

  const payload = {
    latest_user_message: msg,
    recent_transcript: recent,
    profile: learner.profile,
    preferences: learner.preferences || {},
    learning_direction: direction,
    skills_top: (learner.skills as { name: string }[]).slice(0, 12).map((s) => s.name),
    behavior_summary: {
      ...(learner.behavior_summary as object),
      inactive_days_estimate: inactiveDays,
    },
    syllabus_source_text: learner.syllabus_source_text ?? null,
    youtube_transcript_context: learner.youtube_transcript_context ?? null,
  }

  const res = await proxyAgent('/coach', { payload })
  if (!res.ok) {
    const err = await readProxyAgentError(res)
    return { error: err, status: res.status }
  }

  const coachOut = (await res.json()) as Record<string, unknown>

  void (async () => {
    try {
      const emb = await embedTextOpenAI(msg)
      await storeCoachResponse(supabase, user.id, inputHash, msg, coachOut, emb)
    } catch (e) {
      console.warn('[coach] cache store', e)
    }
  })()

  return { coachOut, fromCache: false, router, direction }
}

export async function postCoachSideEffects(
  supabase: SupabaseClient,
  userId: string,
  msg: string,
  conversationId: string | undefined,
  coachOut: Record<string, unknown>,
  direction: string,
): Promise<void> {
  await insertContextEvent(supabase, userId, 'chat', 'user_message', {
    preview: msg.slice(0, 500),
    conversation_id: conversationId ?? null,
  })

  const actions = coachOut.actions as Record<string, unknown> | undefined
  const prefUp = actions?.update_preferences as Record<string, unknown> | null | undefined

  if (actions?.refresh_roadmap && direction) {
    const { data: snaps } = await supabase
      .from('archie_roadmap_snapshots')
      .select('bundle, roadmap_mode, created_at')
      .eq('user_id', userId)
      .in('roadmap_mode', ['skills', 'job_ready'])
      .order('created_at', { ascending: false })
      .limit(12)

    const notes = String(actions.roadmap_adjustment_notes || '')

    await Promise.all(
      (['skills', 'job_ready'] as const).map(async (mode) => {
        const row = (snaps || []).find((s) => s.roadmap_mode === mode)
        const bundle = row?.bundle as Record<string, unknown> | undefined
        if (!bundle) return
        const learner = await buildLearnerContextPayload(supabase, userId, {
          direction,
          roadmap_intent: mode,
          extra_signals: { coach_followup: msg.slice(0, 800), coach_notes: notes.slice(0, 2000) },
        })
        const rev = await proxyAgent('/archie/revise', {
          current_bundle: bundle,
          adaptation_signals: {
            source: 'coach',
            latest_user_message: msg,
            roadmap_adjustment_notes: notes,
          },
          learner_context: { ...learner, roadmap_intent: mode },
        })
        if (rev.ok) {
          const raw = (await rev.json()) as Record<string, unknown>
          await supabase.from('archie_roadmap_snapshots').insert({
            user_id: userId,
            roadmap_mode: `${mode}_coach_revised`,
            bundle: raw as never,
          })
        }
      }),
    )
  }

  if (prefUp && typeof prefUp === 'object' && Object.keys(prefUp).length > 0) {
    const allowed: Record<string, unknown> = {}
    if (prefUp.learning_pace) allowed.learning_pace = prefUp.learning_pace
    if (prefUp.difficulty_level) allowed.difficulty_level = prefUp.difficulty_level
    if (typeof prefUp.daily_goal_minutes === 'number') allowed.daily_goal_minutes = prefUp.daily_goal_minutes
    if (Object.keys(allowed).length > 0) {
      allowed.updated_at = new Date().toISOString()
      const { error: pe } = await supabase.from('user_preferences').update(allowed).eq('user_id', userId)
      if (pe) console.warn('preferences update:', pe.message)
    }
  }
}
