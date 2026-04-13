import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Bulk add skills from resume/LinkedIn extraction
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { skills, source } = body

    if (!Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json({ error: 'Skills array required' }, { status: 400 })
    }

    const skillsToInsert = skills.map((skill: { name: string; level?: string; confidence?: number }) => ({
      user_id: user.id,
      name: skill.name,
      level: skill.level || 'beginner',
      confidence: skill.confidence || 0.5,
      source: source || 'manual',
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('skills')
      .upsert(skillsToInsert, {
        onConflict: 'user_id,name',
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
