/**
 * OpenAI embeddings for semantic cache (optional — set OPENAI_API_KEY).
 * Edge-safe: uses fetch only.
 */
const EMBED_MODEL = 'text-embedding-3-small'

export async function embedTextOpenAI(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  const input = text.length > 8000 ? text.slice(0, 8000) : text
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  })
  if (!res.ok) {
    console.warn('[embeddings] OpenAI error', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = (await res.json()) as { data?: { embedding?: number[] }[] }
  const emb = data.data?.[0]?.embedding
  return Array.isArray(emb) && emb.length > 0 ? emb : null
}
