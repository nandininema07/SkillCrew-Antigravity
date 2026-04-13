import type { SupabaseClient } from '@supabase/supabase-js'

const AGENT_COACH = 'coach'
const MATCH_THRESHOLD = 0.95

/** SHA-256 hex (Edge-safe via Web Crypto). */
export async function hashCoachInput(message: string): Promise<string> {
  const normalized = message.trim().replace(/\s+/g, ' ').toLowerCase()
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function lookupCoachExact(
  supabase: SupabaseClient,
  inputHash: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('agent_cache')
    .select('response')
    .eq('agent_key', AGENT_COACH)
    .eq('input_hash', inputHash)
    .maybeSingle()

  if (error || !data?.response) return null
  return data.response as Record<string, unknown>
}

export async function lookupCoachSemantic(
  supabase: SupabaseClient,
  embedding: number[],
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('match_agent_cache', {
    query_embedding: embedding,
    match_agent: AGENT_COACH,
    match_threshold: MATCH_THRESHOLD,
    match_count: 1,
  })

  if (error) {
    console.warn('[agent_cache] match_agent_cache', error.message)
    return null
  }
  const row = Array.isArray(data) ? data[0] : null
  if (!row || typeof row !== 'object') return null
  const r = row as { response?: Record<string, unknown>; similarity?: number }
  return r.response ?? null
}

export async function storeCoachResponse(
  supabase: SupabaseClient,
  userId: string,
  inputHash: string,
  inputPreview: string,
  response: Record<string, unknown>,
  embedding: number[] | null,
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    agent_key: AGENT_COACH,
    input_hash: inputHash,
    input_preview: inputPreview.slice(0, 500),
    response,
  }
  if (embedding && embedding.length === 1536) {
    row.embedding = embedding
  }

  const { error } = await supabase.from('agent_cache').insert(row as never)
  if (error) console.warn('[agent_cache] insert', error.message)
}
