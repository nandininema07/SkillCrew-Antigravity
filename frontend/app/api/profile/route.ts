import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      full_name,
      phone,
      avatar_url,
      linkedin_url,
      portfolio_url,
      learning_direction,
      notify_whatsapp_digest,
      notify_voice_daily_learning,
      sparky_digest_local_time,
      sparky_digest_timezone,
    } = body

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (full_name !== undefined) updateData.full_name = full_name
    if (phone !== undefined) updateData.phone = phone
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url
    if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url
    if (portfolio_url !== undefined) updateData.portfolio_url = portfolio_url
    if (learning_direction !== undefined) updateData.learning_direction = learning_direction
    if (notify_whatsapp_digest !== undefined) updateData.notify_whatsapp_digest = notify_whatsapp_digest
    if (notify_voice_daily_learning !== undefined) updateData.notify_voice_daily_learning = notify_voice_daily_learning
    if (sparky_digest_local_time !== undefined) updateData.sparky_digest_local_time = sparky_digest_local_time
    if (sparky_digest_timezone !== undefined) updateData.sparky_digest_timezone = sparky_digest_timezone

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (err) {
    console.error('Profile PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
