import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const moduleId = searchParams.get('module_id')
    const dueOnly = searchParams.get('due_only') === 'true'

    let query = supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)

    if (moduleId) {
      query = query.eq('module_id', moduleId)
    }

    if (dueOnly) {
      query = query.lte('next_review', new Date().toISOString())
    }

    const { data: flashcards, error } = await query.order('next_review', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(flashcards)
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
    const { front, back, difficulty, module_id } = body

    const { data: flashcard, error } = await supabase
      .from('flashcards')
      .insert({
        user_id: user.id,
        front,
        back,
        difficulty: difficulty || 'medium',
        module_id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(flashcard)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
