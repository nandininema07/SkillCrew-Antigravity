export type DexterBuckets = {
  youtube: { title: string; url: string; description?: string }[]
  courses: { title: string; url: string; description?: string }[]
  certifications: { title: string; url: string; description?: string }[]
  articles: { title: string; url: string; description?: string }[]
  error?: string
}

export async function fetchDexterResources(modules: { id: string; title: string; learning_objective: string }[]) {
  const res = await fetch('/api/agents/dexter/resources', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modules }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ byModuleId: Record<string, DexterBuckets>; provider?: string }>
}
