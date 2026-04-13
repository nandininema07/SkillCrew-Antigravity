import { createClient } from '@/lib/supabase/server'
import { roadmapSkillsCoverage } from '@/lib/roadmap-skills-progress'
import { getMilestoneNodeProgress } from '@/lib/roadmap-node-progress'
import {
  generateAndInsertJobReadyRoadmap,
  generateAndInsertSkillsRoadmap,
} from '@/lib/server/persist-learning-roadmap'
import { isMissingSchemaObject } from '@/lib/server/supabase-schema-helpers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** List saved roadmaps with skill-coverage + path (node) completion vs remaining modules. */
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

    const [{ data, error }, { data: skillRows }] = await Promise.all([
      supabase
        .from('user_archie_roadmaps')
        .select(
          'id, direction, display_title, progress_percent, estimated_completion, bundles_raw, week_gate_progress, roadmap_kind, recommended_job_title, linked_skills_roadmap_id, created_at, updated_at',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('skills').select('name').eq('user_id', user.id),
    ])

    if (error) {
      if (error.message.includes('Could not find') || error.message.includes('schema cache')) {
        return NextResponse.json({ items: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const roadmapIds = rows.map((r) => r.id as string)

    let completionRows: { roadmap_id: string; module_id: string }[] = []
    if (roadmapIds.length > 0) {
      const { data: cr, error: crErr } = await supabase
        .from('module_completion_track')
        .select('roadmap_id, module_id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .in('roadmap_id', roadmapIds)

      if (crErr && !isMissingSchemaObject(crErr.message)) {
        return NextResponse.json({ error: crErr.message }, { status: 500 })
      }
      completionRows = cr || []
    }

    const doneByRoadmap = new Map<string, Set<string>>()
    for (const c of completionRows) {
      const rid = c.roadmap_id as string
      const mid = c.module_id as string
      if (!rid || !mid) continue
      if (!doneByRoadmap.has(rid)) doneByRoadmap.set(rid, new Set())
      doneByRoadmap.get(rid)!.add(mid)
    }

    const userSkillNames = (skillRows || []).map((r) => String((r as { name?: string }).name || ''))
    const items = rows.map((row) => {
      const cov = roadmapSkillsCoverage(userSkillNames, row.bundles_raw)
      const rk = (row as { roadmap_kind?: string }).roadmap_kind
      const rid = row.id as string
      const done = doneByRoadmap.get(rid) ?? new Set<string>()
      const nodesSkills = getMilestoneNodeProgress(row.bundles_raw, 'skills', done)
      const nodesJob = getMilestoneNodeProgress(row.bundles_raw, 'job_ready', done)
      return {
        id: row.id,
        direction: row.direction,
        display_title: row.display_title,
        progress_percent: cov.percent,
        progress_skills_matched: cov.matched,
        progress_skills_total: cov.total,
        nodes_completed_skills: nodesSkills.completed,
        nodes_total_skills: nodesSkills.total,
        nodes_remaining_skills: nodesSkills.remaining,
        nodes_percent_skills: nodesSkills.percent,
        nodes_completed_job: nodesJob.completed,
        nodes_total_job: nodesJob.total,
        nodes_remaining_job: nodesJob.remaining,
        nodes_percent_job: nodesJob.percent,
        estimated_completion: row.estimated_completion,
        roadmap_kind: rk === 'skills' || rk === 'job_ready' || rk === 'combined' ? rk : 'combined',
        recommended_job_title: (row as { recommended_job_title?: string | null }).recommended_job_title ?? null,
        linked_skills_roadmap_id:
          (row as { linked_skills_roadmap_id?: string | null }).linked_skills_roadmap_id ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    })

    return NextResponse.json({ items })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Generate once via AI and persist (only when user explicitly creates a roadmap). */
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

    const body = (await request.json()) as {
      direction?: string
      kind?: string
      linked_skills_roadmap_id?: string | null
    }
    const direction = (body.direction || '').trim()
    if (!direction) {
      return NextResponse.json({ error: 'direction is required' }, { status: 400 })
    }

    try {
      const result =
        body.kind === 'job_ready'
          ? await generateAndInsertJobReadyRoadmap(
              supabase,
              user.id,
              direction,
              body.linked_skills_roadmap_id?.trim() || null,
            )
          : await generateAndInsertSkillsRoadmap(supabase, user.id, direction)
      return NextResponse.json(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
