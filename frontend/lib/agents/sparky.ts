export async function fetchSparkyCompose(state: Record<string, unknown>) {
  const res = await fetch('/api/agents/sparky/compose', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<Record<string, unknown>>
}
