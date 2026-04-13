export async function fetchPipQuiz(body: {
  topics_learned: string[]
  difficulty?: string
  count?: number
  locale?: string | null
}) {
  const res = await fetch('/api/agents/pip/quiz', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<Record<string, unknown>>
}

export async function fetchPipGrade(quiz: Record<string, unknown>, answers: Record<string, number>) {
  const res = await fetch('/api/agents/pip/grade', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz, answers }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<Record<string, unknown>>
}

export async function fetchPipRevisionPack(body: { topics: string[]; notes?: string | null }) {
  const res = await fetch('/api/agents/pip/revision-pack', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<Record<string, unknown>>
}
