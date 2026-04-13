import { createClient } from '@/lib/supabase/server'
import { compactSkillPhrase, pickTopJobResults, TOP_PER_PLATFORM } from '@/lib/job-ready/job-opening-rank'
import { tavilySearch } from '@/lib/job-ready/tavily-search'
import { NextResponse } from 'next/server'

export const maxDuration = 60

type Body = { targetRole?: string }

/**
 * India-focused job discovery: Tavily with `time_range: day` + country boost, then top 3 per
 * platform ranked by overlap with the user's saved resume skills.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const targetRole = (body.targetRole ?? '').trim()
  if (!targetRole) {
    return NextResponse.json({ error: 'targetRole is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: skillRows } = await supabase
    .from('skills')
    .select('name, confidence')
    .eq('user_id', user.id)
    .order('confidence', { ascending: false })
    .limit(24)

  const skillNames = (skillRows ?? [])
    .map((r) => (typeof r?.name === 'string' ? r.name.trim() : ''))
    .filter((n): n is string => Boolean(n))

  const skillPhrase = compactSkillPhrase(skillNames)
  const tavilyKey = process.env.TAVILY_API_KEY?.trim()
  if (!tavilyKey) {
    return NextResponse.json({ error: 'TAVILY_API_KEY is not configured on the server.' }, { status: 503 })
  }

  const safe = targetRole.replace(/"/g, '')
  const india = 'India'
  const skillBit = skillPhrase ? ` ${skillPhrase}` : ''

  const linkedinQuery = `site:linkedin.com/jobs "${safe}" ${india}${skillBit} job opening OR job posting`
  const naukriQuery = `site:naukri.com "${safe}" ${india}${skillBit} jobs`
  const glassdoorQuery = `site:glassdoor.com "${safe}" ${india}${skillBit} job OR interview`

  const tavilyOpts = { timeRange: 'day' as const, country: 'india', includeAnswer: false }
  const fetchN = 15

  const [linkedin, naukri, glassdoor] = await Promise.all([
    tavilySearch(tavilyKey, linkedinQuery, fetchN, tavilyOpts),
    tavilySearch(tavilyKey, naukriQuery, fetchN, tavilyOpts),
    tavilySearch(tavilyKey, glassdoorQuery, fetchN, tavilyOpts),
  ])

  const rankedLinkedin = pickTopJobResults(linkedin.results, skillNames, TOP_PER_PLATFORM)
  const rankedNaukri = pickTopJobResults(naukri.results, skillNames, TOP_PER_PLATFORM)
  const rankedGlassdoor = pickTopJobResults(glassdoor.results, skillNames, TOP_PER_PLATFORM)

  return NextResponse.json({
    targetRole: safe,
    skillsConsidered: skillNames.slice(0, 12),
    skillsUsed: skillNames.length
      ? `${skillNames.slice(0, 8).join(', ')}${skillNames.length > 8 ? '…' : ''}`
      : null,
    disclaimer:
      'Showing up to three listings per source, ranked against your saved skills. Searches are India-focused with a same-day recency filter via Tavily; exact posting time may not match platform APIs.',
    sources: {
      linkedin: {
        query: linkedinQuery,
        answer: null,
        results: rankedLinkedin,
      },
      naukri: { query: naukriQuery, answer: null, results: rankedNaukri },
      glassdoor: {
        query: glassdoorQuery,
        answer: null,
        results: rankedGlassdoor,
      },
    },
  })
}
