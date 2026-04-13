/**
 * Server-side Tavily search helper (used by Job Ready API routes).
 */

export type TavilyResultItem = {
  title: string
  url: string
  content?: string
  score?: number
}

export type TavilySearchResponse = {
  answer?: string | null
  results: TavilyResultItem[]
  query: string
}

export type TavilySearchOptions = {
  /** Filter by publish/update recency (e.g. `day` ≈ last 24h). */
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y'
  /** Boost results from a country (Tavily `general` topic). */
  country?: string
  /** When false, skips Tavily’s LLM summary (`answer`). Default true. */
  includeAnswer?: boolean
  /** Restrict results to these domains (e.g. `youtube.com`, `coursera.org`). */
  includeDomains?: string[]
}

export async function tavilySearch(
  apiKey: string,
  query: string,
  maxResults = 8,
  opts?: TavilySearchOptions,
): Promise<TavilySearchResponse> {
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    search_depth: 'advanced',
    include_answer: opts?.includeAnswer !== false,
    max_results: maxResults,
    topic: 'general',
  }
  if (opts?.timeRange) body.time_range = opts.timeRange
  if (opts?.country) body.country = opts.country
  if (opts?.includeDomains?.length) body.include_domains = opts.includeDomains

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Tavily error ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    answer?: string
    results?: { title?: string; url?: string; content?: string; score?: number }[]
  }

  return {
    answer: data.answer ?? null,
    query,
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? 'Untitled',
      url: r.url ?? '#',
      content: r.content,
      score: r.score,
    })),
  }
}
