import type { SupabaseClient } from '@supabase/supabase-js'

import { isMissingSchemaObject } from '@/lib/server/supabase-schema-helpers'

export type RoadmapIntent = 'skills' | 'job_ready' | 'certifications'

export async function buildLearnerContextPayload(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    direction: string
    roadmap_intent: Exclude<RoadmapIntent, 'certifications'>
    extra_signals?: Record<string, unknown>
    /** When true, skip updating profiles.last_active_at (e.g. batch Archie calls share one pulse). */
    skip_profile_pulse?: boolean
    /**
     * When provided, recent_signals are filtered to only include events that
     * belong to this specific roadmap (or events with no roadmap_id).
     * This prevents checkpoints from unrelated roadmaps (e.g. DSA) from
     * influencing the agent when it is working on a different roadmap (e.g. marketing).
     */
    roadmapId?: string
  },
) {
  const [
    { data: profile },
    { data: skills },
    { data: experiences },
    { data: prefs },
    evRes,
    syllabusRes,
    youtubePlaylistRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('skills').select('name, level, confidence').eq('user_id', userId).limit(80),
    supabase
      .from('work_experiences')
      .select('company, title, description, is_current')
      .eq('user_id', userId)
      .limit(40),
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('user_context_events')
      .select('source, kind, payload, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('user_context_events')
      .select('payload, created_at')
      .eq('user_id', userId)
      .eq('kind', 'syllabus_pdf')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('user_context_events')
      .select('payload, created_at')
      .eq('user_id', userId)
      .eq('kind', 'youtube_playlist')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const rawEvents = evRes.error ? [] : evRes.data || []
  if (evRes.error && !isMissingSchemaObject(evRes.error.message)) {
    console.warn('user_context_events:', evRes.error.message)
  }

  // When a specific roadmap is in scope, exclude signals from other roadmaps so the
  // agent doesn't mistake, e.g., DSA checkpoint results as relevant to a marketing roadmap.
  const events = opts.roadmapId
    ? rawEvents.filter((ev) => {
        const p = (ev as { payload?: unknown }).payload
        if (!p || typeof p !== 'object') return true
        const evRoadmapId = (p as Record<string, unknown>).roadmap_id
        return !evRoadmapId || evRoadmapId === opts.roadmapId
      })
    : rawEvents

  const SYLLABUS_CONTEXT_MAX = 24000
  let syllabus_source_text: string | null = null
  if (!syllabusRes.error && syllabusRes.data?.payload && typeof syllabusRes.data.payload === 'object') {
    const raw = (syllabusRes.data.payload as { text?: unknown }).text
    if (typeof raw === 'string' && raw.trim()) {
      syllabus_source_text = raw.trim().slice(0, SYLLABUS_CONTEXT_MAX)
    }
  }
  if (syllabusRes.error && !isMissingSchemaObject(syllabusRes.error.message)) {
    console.warn('syllabus context:', syllabusRes.error.message)
  }

  const YOUTUBE_CONTEXT_MAX = 24000
  let youtube_transcript_context: string | null = null
  if (
    !youtubePlaylistRes.error &&
    youtubePlaylistRes.data?.payload &&
    typeof youtubePlaylistRes.data.payload === 'object'
  ) {
    const raw = (youtubePlaylistRes.data.payload as { text?: unknown }).text
    if (typeof raw === 'string' && raw.trim()) {
      youtube_transcript_context = raw.trim().slice(0, YOUTUBE_CONTEXT_MAX)
    }
  }
  if (youtubePlaylistRes.error && !isMissingSchemaObject(youtubePlaylistRes.error.message)) {
    console.warn('youtube playlist context:', youtubePlaylistRes.error.message)
  }

  const skillsList = (skills || []).map((s) => ({
    name: s.name,
    level: s.level,
    confidence: s.confidence,
  }))

  const expLines = (experiences || []).map((e) => {
    const cur = e.is_current ? 'current' : 'past'
    const desc = e.description ? ` — ${String(e.description).slice(0, 240)}` : ''
    return `${cur}: ${e.title} at ${e.company}${desc}`
  })

  const lastActive = profile?.last_active_at ? new Date(profile.last_active_at as string) : null
  const inactiveDays =
    lastActive != null && !Number.isNaN(lastActive.getTime())
      ? Math.max(0, Math.floor((Date.now() - lastActive.getTime()) / 86400000))
      : null

  if (!opts.skip_profile_pulse) {
    const { error: pulseErr } = await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (pulseErr) {
      if (isMissingSchemaObject(pulseErr.message)) {
        await supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', userId)
      } else {
        console.warn('profiles pulse:', pulseErr.message)
      }
    }
  }

  return {
    direction: opts.direction.trim(),
    roadmap_intent: opts.roadmap_intent,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    profile: {
      name: profile?.full_name || profile?.email || '',
      xp: profile?.xp ?? 0,
      level: profile?.level ?? 1,
      streak: profile?.streak ?? 0,
      learning_direction_stored: profile?.learning_direction ?? null,
    },
    skills: skillsList,
    experiences: expLines,
    preferences: prefs || {},
    recent_signals: events,
    behavior_summary: {
      inactive_days_estimate: inactiveDays,
      /** True when the DB has no skills — Archie must still build from direction alone. */
      profile_skills_empty: skillsList.length === 0,
      /** True when there is no work experience text — helps the model avoid blocking on empty CV data. */
      profile_experiences_empty: expLines.length === 0,
      ...opts.extra_signals,
    },
    /** Course / syllabus PDF text (from dashboard upload); consumed by Archie + Nova-style prompts */
    syllabus_source_text,
    /** YouTube playlist captions (dashboard); consumed by Archie + Nova-style prompts */
    youtube_transcript_context,
  }
}

export async function insertContextEvent(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  kind: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from('user_context_events').insert({
    user_id: userId,
    source,
    kind,
    payload,
  })
  if (error && isMissingSchemaObject(error.message)) {
    return { error: null }
  }
  return { error }
}
