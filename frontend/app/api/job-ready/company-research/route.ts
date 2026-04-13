import { NextResponse } from 'next/server'
import { tavilySearch } from '@/lib/job-ready/tavily-search'
import { runGlassdoorActor } from '@/lib/job-ready/apify-glassdoor'

export const maxDuration = 120

type Body = {
  company?: string
  targetRole?: string
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const company = (body.company ?? '').trim()
  const targetRole = (body.targetRole ?? '').trim()
  if (!company || !targetRole) {
    return NextResponse.json({ error: 'company and targetRole are required' }, { status: 400 })
  }

  const tavilyKey = process.env.TAVILY_API_KEY?.trim()
  if (!tavilyKey) {
    return NextResponse.json(
      { error: 'TAVILY_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const safeCompany = company.replace(/"/g, '')
  const safeRole = targetRole.replace(/"/g, '')

  const gfgQuery = `site:geeksforgeeks.org "${safeCompany}" interview experience "${safeRole}" OR interview questions`
  const glassdoorQuery = `site:glassdoor.com "${safeCompany}" behavioral interview "${safeRole}" OR interview experience`

  const [gfg, glassdoorWeb] = await Promise.all([
    tavilySearch(tavilyKey, gfgQuery, 10),
    tavilySearch(tavilyKey, glassdoorQuery, 10),
  ])

  const token = process.env.APIFY_API_TOKEN?.trim()
  const actorId = process.env.APIFY_GLASSDOOR_ACTOR?.trim()

  let apifyGlassdoor: Awaited<ReturnType<typeof runGlassdoorActor>> | null = null
  if (token && actorId) {
    let baseInput: Record<string, unknown> = {
      company: safeCompany,
      companyName: safeCompany,
      query: `${safeCompany} interview behavioral`,
      maxItems: 15,
    }
    const extra = process.env.APIFY_GLASSDOOR_INPUT_JSON?.trim()
    if (extra) {
      try {
        const parsed = JSON.parse(extra) as Record<string, unknown>
        baseInput = { ...baseInput, ...parsed }
      } catch {
        /* ignore bad JSON */
      }
    }
    apifyGlassdoor = await runGlassdoorActor({ token, actorId, input: baseInput })
  }

  return NextResponse.json({
    company: safeCompany,
    targetRole: safeRole,
    geeksforgeeks: {
      query: gfgQuery,
      answer: gfg.answer,
      results: gfg.results,
    },
    glassdoor: {
      tavily: {
        query: glassdoorQuery,
        answer: glassdoorWeb.answer,
        results: glassdoorWeb.results,
      },
      apify: apifyGlassdoor
        ? {
            ok: apifyGlassdoor.ok,
            items: apifyGlassdoor.items.slice(0, 40),
            runId: apifyGlassdoor.runId,
            datasetId: apifyGlassdoor.datasetId,
            error: apifyGlassdoor.error,
          }
        : null,
      apifySkipped: !token || !actorId,
    },
  })
}
