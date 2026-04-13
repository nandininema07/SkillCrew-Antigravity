import { NextResponse } from 'next/server'
import { tavilySearch } from '@/lib/job-ready/tavily-search'
import type { TavilyResultItem } from '@/lib/job-ready/tavily-search'

export const maxDuration = 60

type ResourceItem = {
  title: string
  url: string
  description: string
  source: 'youtube' | 'coursera' | 'udemy'
}

function isYoutubeUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase()
    return h.includes('youtube.com') || h.includes('youtu.be')
  } catch {
    return /youtube\.com|youtu\.be/i.test(url)
  }
}

function paidSource(url: string): 'coursera' | 'udemy' | null {
  try {
    const h = new URL(url).hostname.toLowerCase()
    if (h.includes('coursera.org')) return 'coursera'
    if (h.includes('udemy.com')) return 'udemy'
  } catch {
    /* ignore */
  }
  if (/coursera\.org/i.test(url)) return 'coursera'
  if (/udemy\.com/i.test(url)) return 'udemy'
  return null
}

function dedupeByUrl(items: ResourceItem[]): ResourceItem[] {
  const seen = new Set<string>()
  const out: ResourceItem[] = []
  for (const it of items) {
    const key = it.url.split('#')[0] ?? it.url
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

function byScoreDesc(a: TavilyResultItem, b: TavilyResultItem): number {
  return (b.score ?? 0) - (a.score ?? 0)
}

export async function POST(req: Request) {
  const apiKey = process.env.TAVILY_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TAVILY_API_KEY is not configured on the server. Add it to frontend/.env.local.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const title = String(b.title ?? '').trim()
  const topics = Array.isArray(b.topics) ? b.topics.map((x) => String(x)).filter(Boolean) : []
  const learningObjective = String(b.learningObjective ?? '').trim()

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const concept = [title, ...topics.slice(0, 5), learningObjective].filter(Boolean).join(' ').slice(0, 400)

  const youtubeQuery = `best free video tutorial or course to learn (hands-on, beginner-friendly): ${concept}`
  const paidQuery = `best rated online course or specialization to learn (structured path, reviews): ${concept}`

  const [freeSettled, paidSettled] = await Promise.allSettled([
    tavilySearch(apiKey, youtubeQuery, 10, {
      includeAnswer: false,
      includeDomains: ['youtube.com', 'youtu.be'],
    }),
    tavilySearch(apiKey, paidQuery, 10, {
      includeAnswer: false,
      includeDomains: ['coursera.org', 'udemy.com'],
    }),
  ])

  const errors: string[] = []
  const free: ResourceItem[] = []
  const paid: ResourceItem[] = []

  if (freeSettled.status === 'fulfilled') {
    const sorted = [...freeSettled.value.results].sort(byScoreDesc)
    for (const r of sorted) {
      const url = r.url?.trim() ?? ''
      if (!url.startsWith('http') || !isYoutubeUrl(url)) continue
      free.push({
        title: r.title?.trim() || 'YouTube',
        url,
        description: (r.content ?? '').trim().slice(0, 500),
        source: 'youtube',
      })
    }
  } else {
    const msg = freeSettled.reason instanceof Error ? freeSettled.reason.message : String(freeSettled.reason)
    errors.push(`YouTube (Tavily): ${msg}`)
  }

  if (paidSettled.status === 'fulfilled') {
    const sorted = [...paidSettled.value.results].sort(byScoreDesc)
    for (const r of sorted) {
      const url = r.url?.trim() ?? ''
      if (!url.startsWith('http')) continue
      const src = paidSource(url)
      if (!src) continue
      paid.push({
        title: r.title?.trim() || 'Course',
        url,
        description: (r.content ?? '').trim().slice(0, 500),
        source: src,
      })
    }
  } else {
    const msg = paidSettled.reason instanceof Error ? paidSettled.reason.message : String(paidSettled.reason)
    errors.push(`Coursera/Udemy (Tavily): ${msg}`)
  }

  return NextResponse.json({
    query: concept,
    free: dedupeByUrl(free),
    paid: dedupeByUrl(paid),
    errors,
    partial: errors.length > 0 && (free.length > 0 || paid.length > 0),
  })
}
