import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { computeRoadmapSkillsProgressForUser } from '@/lib/roadmap-skills-progress'
import { mergeStoredBundlesWithWeekGate, updateRoadmapTargetCompletionDate } from '@/lib/server/persist-learning-roadmap'
import { NextResponse } from 'next/server'

async function fetchLatestPipCheckpointForRoadmap(
  supabase: SupabaseClient,
  userId: string,
  roadmapId: string,
) {
  const { data: rows, error } = await supabase
    .from('user_context_events')
    .select('payload, created_at')
    .eq('user_id', userId)
    .eq('source', 'pip')
    .eq('kind', 'checkpoint_graded')
    .order('created_at', { ascending: false })
    .limit(48)

  if (error || !rows?.length) return null

  const hit = rows.find((r) => {
    const p = r.payload as { roadmap_id?: string }
    return p?.roadmap_id === roadmapId
  })
  if (!hit) return null

  const p = hit.payload as Record<string, unknown>
  const mode = p.roadmap_mode
  return {
    created_at: hit.created_at as string,
    score_percent: typeof p.score_percent === 'number' ? p.score_percent : 0,
    weak_topics: Array.isArray(p.weak_topics) ? (p.weak_topics as string[]) : [],
    milestone_id: typeof p.milestone_id === 'string' ? p.milestone_id : null,
    week: typeof p.week === 'number' ? p.week : null,
    roadmap_mode: mode === 'job_ready' || mode === 'skills' ? mode : null,
    xp_delta: typeof p.xp_delta === 'number' ? p.xp_delta : null,
    pip_summary_for_archie:
      typeof p.pip_summary_for_archie === 'string' ? p.pip_summary_for_archie : null,
    results_preview: Array.isArray(p.results_preview) ? p.results_preview : [],
    flashcard_suggestions: Array.isArray(p.flashcard_suggestions) ? p.flashcard_suggestions : [],
  }
}

/** Full saved bundles for one roadmap (no AI — read from DB). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: row, error } = await supabase
      .from('user_archie_roadmaps')
      .select(
        'id, direction, display_title, progress_percent, estimated_completion, bundles_raw, week_gate_progress, roadmap_kind, recommended_job_title, linked_skills_roadmap_id, capstone_unlocked_at, created_at, updated_at',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const bundles = mergeStoredBundlesWithWeekGate(row.bundles_raw, row.week_gate_progress)
    if (!bundles) {
      return NextResponse.json({ error: 'Stored roadmap data is invalid' }, { status: 500 })
    }

    const cov = await computeRoadmapSkillsProgressForUser(supabase, user.id, row.bundles_raw)
    const lastPipCheckpoint = await fetchLatestPipCheckpointForRoadmap(supabase, user.id, id)

    const rk = (row as { roadmap_kind?: string }).roadmap_kind
    return NextResponse.json({
      id: row.id,
      direction: row.direction,
      display_title: row.display_title,
      progress_percent: cov.percent,
      progress_skills_matched: cov.matched,
      progress_skills_total: cov.total,
      estimated_completion: row.estimated_completion,
      roadmap_kind: rk === 'skills' || rk === 'job_ready' || rk === 'combined' ? rk : 'combined',
      recommended_job_title: (row as { recommended_job_title?: string | null }).recommended_job_title ?? null,
      linked_skills_roadmap_id:
        (row as { linked_skills_roadmap_id?: string | null }).linked_skills_roadmap_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      capstone_unlocked_at: (row as { capstone_unlocked_at?: string | null }).capstone_unlocked_at ?? null,
      bundles,
      last_pip_checkpoint: lastPipCheckpoint,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Update target end date; rescales weekly syllabus in stored bundles (no AI). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { estimated_completion?: string }
    const raw = (body.estimated_completion || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return NextResponse.json({ error: 'estimated_completion must be YYYY-MM-DD' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    if (raw < today) {
      return NextResponse.json({ error: 'Target date must be today or later' }, { status: 400 })
    }

    await updateRoadmapTargetCompletionDate(supabase, user.id, id, raw)

    const { data: row, error } = await supabase
      .from('user_archie_roadmaps')
      .select('estimated_completion, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      estimated_completion: row?.estimated_completion ?? raw,
      updated_at: row?.updated_at,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    if (msg === 'Roadmap not found' || msg.includes('incomplete')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    console.error(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase.from('user_archie_roadmaps').delete().eq('id', id).eq('user_id', user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
