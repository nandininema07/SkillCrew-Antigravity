import type { TavilyResultItem } from '@/lib/job-ready/tavily-search'

const TOP_PER_PLATFORM = 3

/** Truncate query helper text so Tavily queries stay within practical limits. */
export function compactSkillPhrase(skillNames: string[], maxLen = 140): string {
  const parts: string[] = []
  let len = 0
  for (const raw of skillNames) {
    const s = raw.trim()
    if (!s) continue
    const next = parts.length ? `${parts.join(' ')} ${s}` : s
    if (next.length > maxLen) break
    parts.push(s)
    len = next.length
    if (len >= maxLen * 0.85) break
  }
  return parts.join(' ')
}

function skillMatchScore(haystack: string, skills: string[]): number {
  if (skills.length === 0) return 0
  const hay = haystack.toLowerCase()
  let score = 0
  for (const skill of skills) {
    const n = skill.trim().toLowerCase()
    if (n.length < 2) continue
    if (hay.includes(n)) {
      score += 1
      continue
    }
    for (const w of n.split(/[\s,&/+]+/).filter((x) => x.length > 2)) {
      if (hay.includes(w)) score += 0.35
    }
  }
  return score
}

/** Prefer resume-skill overlap, then Tavily relevance score. */
export function pickTopJobResults(items: TavilyResultItem[], skillNames: string[], topN = TOP_PER_PLATFORM): TavilyResultItem[] {
  if (items.length === 0) return []
  const names = skillNames.map((s) => s.trim()).filter(Boolean)
  const scored = items.map((item) => {
    const text = `${item.title} ${item.content ?? ''}`
    const skillPart = names.length ? skillMatchScore(text, names) * 18 : 0
    const tavilyPart = item.score ?? 0
    return { item, combined: skillPart + tavilyPart }
  })
  scored.sort((a, b) => b.combined - a.combined)
  return scored.slice(0, topN).map((s) => s.item)
}

export { TOP_PER_PLATFORM }
