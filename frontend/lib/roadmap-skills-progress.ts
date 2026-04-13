/**
 * Roadmap completion progress = share of unique module skill tags the user already has on their profile.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizeSkillKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Collect unique normalized skill strings from one raw Archie bundle (`sections[].modules[].skills[]`). */
export function collectSkillKeysFromRawBundle(raw: Record<string, unknown>): Set<string> {
  const out = new Set<string>()
  const sections = Array.isArray(raw.sections) ? raw.sections : []
  for (const s of sections) {
    const sec = (s || {}) as Record<string, unknown>
    const modules = Array.isArray(sec.modules) ? sec.modules : []
    for (const m of modules) {
      const mo = (m || {}) as Record<string, unknown>
      const skills = Array.isArray(mo.skills) ? mo.skills : []
      for (const x of skills) {
        const k = normalizeSkillKey(String(x))
        if (k) out.add(k)
      }
    }
  }
  return out
}

/** Union of skill tags from both Skills and Job ready bundles stored in `bundles_raw`. */
export function requiredRoadmapSkillKeysFromBundlesRaw(bundlesRaw: unknown): Set<string> {
  const req = new Set<string>()
  if (!bundlesRaw || typeof bundlesRaw !== 'object') return req
  const b = bundlesRaw as Record<string, unknown>
  const skills = b.skills as Record<string, unknown> | undefined
  const job = b.job_ready as Record<string, unknown> | undefined
  if (skills) {
    for (const k of collectSkillKeysFromRawBundle(skills)) req.add(k)
  }
  if (job) {
    for (const k of collectSkillKeysFromRawBundle(job)) req.add(k)
  }
  return req
}

export function roadmapSkillsCoverage(
  userSkillNames: string[],
  bundlesRaw: unknown,
): { percent: number; matched: number; total: number } {
  const req = requiredRoadmapSkillKeysFromBundlesRaw(bundlesRaw)
  const user = new Set(userSkillNames.map(normalizeSkillKey).filter(Boolean))
  if (req.size === 0) {
    return { percent: 0, matched: 0, total: 0 }
  }
  let matched = 0
  for (const r of req) {
    if (user.has(r)) matched += 1
  }
  const percent = Math.min(100, Math.round((matched / req.size) * 100))
  return { percent, matched, total: req.size }
}

/** Loads the user’s skill names and returns coverage vs stored `bundles_raw`. */
export async function computeRoadmapSkillsProgressForUser(
  supabase: SupabaseClient,
  userId: string,
  bundlesRaw: unknown,
): Promise<{ percent: number; matched: number; total: number }> {
  const { data: skillRows } = await supabase.from('skills').select('name').eq('user_id', userId)
  const names = (skillRows || []).map((r) => String((r as { name?: string }).name || ''))
  return roadmapSkillsCoverage(names, bundlesRaw)
}
