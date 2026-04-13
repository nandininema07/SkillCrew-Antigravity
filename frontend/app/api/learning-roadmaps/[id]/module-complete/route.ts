import { createClient } from '@/lib/supabase/server'
import { extractModuleIdsFromRawBundle, findModuleSkillsInRawBundle } from '@/lib/agents/roadmap-state-helpers'
import { isMissingSchemaObject } from '@/lib/server/supabase-schema-helpers'
import { NextResponse } from 'next/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: roadmapId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      roadmap_mode: 'skills' | 'job_ready'
      module_id: string
    }

    if (body.roadmap_mode !== 'skills' && body.roadmap_mode !== 'job_ready') {
      return NextResponse.json({ error: 'Invalid roadmap_mode' }, { status: 400 })
    }
    const moduleId = (body.module_id || '').trim()
    if (!moduleId) {
      return NextResponse.json({ error: 'Missing module_id' }, { status: 400 })
    }

    const { data: row, error: loadErr } = await supabase
      .from('user_archie_roadmaps')
      .select('bundles_raw')
      .eq('id', roadmapId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 })
    }
    if (!row?.bundles_raw) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })
    }

    const bundles = row.bundles_raw as Record<string, unknown>
    const raw = bundles[body.roadmap_mode] as Record<string, unknown> | undefined
    if (!raw) {
      return NextResponse.json({ error: 'Bundle not found for mode' }, { status: 404 })
    }

    const valid = new Set(extractModuleIdsFromRawBundle(raw))
    if (!valid.has(moduleId)) {
      return NextResponse.json({ error: 'Unknown module for this roadmap' }, { status: 400 })
    }

    const skillNames = findModuleSkillsInRawBundle(raw, moduleId) || []

    for (const name of skillNames) {
      const rowSkill = {
        user_id: user.id,
        name,
        level: 'intermediate' as const,
        confidence: 0.72,
        source: 'roadmap' as const,
        updated_at: new Date().toISOString(),
      }
      let { error: skErr } = await supabase.from('skills').upsert(rowSkill as never, { onConflict: 'user_id,name' })
      if (skErr?.message?.includes('check constraint') || skErr?.message?.includes('skills_source_check')) {
        ;({ error: skErr } = await supabase
          .from('skills')
          .upsert({ ...rowSkill, source: 'ai_extracted' } as never, { onConflict: 'user_id,name' }))
      }
      if (skErr && !isMissingSchemaObject(skErr.message)) {
        console.warn('skills upsert:', skErr.message)
      }
    }

    const trackRow = {
      user_id: user.id,
      roadmap_id: roadmapId,
      module_id: moduleId,
      status: 'completed' as const,
      completed_at: new Date().toISOString(),
      skills_acquired: skillNames,
      updated_at: new Date().toISOString(),
    }

    const { error: trErr } = await supabase.from('module_completion_track').upsert(trackRow as never, {
      onConflict: 'user_id,roadmap_id,module_id',
    })

    if (trErr) {
      if (isMissingSchemaObject(trErr.message)) {
        return NextResponse.json(
          {
            error:
              'Run Supabase migrations for module_completion_track (see 20260413000000_dynamic_roadmap_assessments.sql).',
          },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: trErr.message }, { status: 500 })
    }

    await supabase.from('user_context_events').insert({
      user_id: user.id,
      source: 'roadmap',
      kind: 'module_completed',
      payload: { roadmap_id: roadmapId, roadmap_mode: body.roadmap_mode, module_id: moduleId, skills: skillNames },
    })

    const { data: doneRows } = await supabase
      .from('module_completion_track')
      .select('module_id')
      .eq('user_id', user.id)
      .eq('roadmap_id', roadmapId)
      .eq('status', 'completed')

    const completed_module_ids = [...new Set((doneRows || []).map((r) => r.module_id as string).filter(Boolean))]

    return NextResponse.json({ ok: true, completed_module_ids, skills_recorded: skillNames.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
