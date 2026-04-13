import type { DBSkill } from '@/lib/database.types'

/** Response body from FastAPI `merge_profiles` (LinkedIn scrape or resume parse). */
export type MasterProfileResponse = {
  merged?: {
    skills?: unknown[]
    project_keywords?: unknown[]
  }
  linkedin_import?: {
    status?: string
    reason?: string
  }
}

function dedupeNames(values: unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (typeof v !== 'string') continue
    const name = v.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/** Map merged profile skills (+ project keywords) to payloads for `/api/skills/bulk`. */
export function skillsFromMaster(
  master: MasterProfileResponse,
  source: 'linkedin' | 'resume',
): Pick<DBSkill, 'name' | 'level' | 'confidence' | 'source'>[] {
  const merged = master.merged ?? {}
  const names = dedupeNames([
    ...(merged.skills ?? []),
    ...(merged.project_keywords ?? []),
  ])
  return names.map((name) => ({
    name,
    level: 'intermediate' as const,
    confidence: 0.75,
    source,
  }))
}

export function linkedinWarningFromMaster(master: MasterProfileResponse): string | undefined {
  const imp = master.linkedin_import
  if (imp?.status === 'skipped' && typeof imp.reason === 'string' && imp.reason.trim()) {
    return imp.reason.trim()
  }
  return undefined
}
