import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: paths, error } = await supabase
      .from('learning_paths')
      .select(`
        *,
        learning_modules (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(paths)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, goal, estimated_completion } = body

    // Set all other paths to inactive
    await supabase
      .from('learning_paths')
      .update({ is_active: false })
      .eq('user_id', user.id)

    const { data: path, error } = await supabase
      .from('learning_paths')
      .insert({
        user_id: user.id,
        title,
        goal,
        is_active: true,
        estimated_completion,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(path)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
