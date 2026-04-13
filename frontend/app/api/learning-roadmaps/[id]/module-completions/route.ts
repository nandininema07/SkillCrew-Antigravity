import { createClient } from '@/lib/supabase/server'
import { isMissingSchemaObject } from '@/lib/server/supabase-schema-helpers'
import { NextResponse } from 'next/server'

/** Completed module ids for a saved roadmap (requires module_completion_track migration). */
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

    const { data, error } = await supabase
      .from('module_completion_track')
      .select('module_id')
      .eq('user_id', user.id)
      .eq('roadmap_id', id)
      .eq('status', 'completed')

    if (error) {
      if (isMissingSchemaObject(error.message)) {
        return NextResponse.json({ completed_module_ids: [], migration_required: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = (data || []).map((r) => r.module_id as string).filter(Boolean)
    return NextResponse.json({ completed_module_ids: [...new Set(ids)] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
