/** Collect module ids from one Archie raw bundle's `sections`. */
export function extractModuleIdsFromRawBundle(raw: Record<string, unknown>): string[] {
  const sections = raw.sections
  if (!Array.isArray(sections)) return []
  const ids: string[] = []
  for (const s of sections) {
    const mod = (s as Record<string, unknown>).modules
    if (!Array.isArray(mod)) continue
    for (const m of mod) {
      const id = (m as Record<string, unknown>).id
      if (typeof id === 'string' && id.trim()) ids.push(id.trim())
    }
  }
  return [...new Set(ids)]
}

export function findModuleSkillsInRawBundle(raw: Record<string, unknown>, moduleId: string): string[] | null {
  const sections = raw.sections
  if (!Array.isArray(sections)) return null
  for (const s of sections) {
    const mod = (s as Record<string, unknown>).modules
    if (!Array.isArray(mod)) continue
    for (const m of mod) {
      const o = m as Record<string, unknown>
      if (String(o.id || '') !== moduleId) continue
      if (!Array.isArray(o.skills)) return []
      return (o.skills as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    }
  }
  return null
}
