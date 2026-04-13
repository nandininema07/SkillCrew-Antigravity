import type { ArchieCertificationsBundle } from '@/lib/archie-certifications-mock'
import type { ArchieRoadmapBundle } from '@/lib/archie-roadmap-mock'

export async function fetchArchieRoadmap(
  roadmap_intent: 'skills' | 'job_ready',
  direction?: string,
): Promise<{ bundle: ArchieRoadmapBundle }> {
  const res = await fetch('/api/agents/archie/roadmap', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roadmap_intent, direction }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ bundle: ArchieRoadmapBundle }>
}

export async function fetchArchieCertifications(direction?: string): Promise<{ bundle: ArchieCertificationsBundle }> {
  const res = await fetch('/api/agents/archie/certifications', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ bundle: ArchieCertificationsBundle }>
}

export async function reviseArchieRoadmap(body: {
  current_bundle: Record<string, unknown>
  adaptation_signals?: Record<string, unknown>
  roadmap_intent: 'skills' | 'job_ready'
  direction?: string
}): Promise<{ bundle: ArchieRoadmapBundle }> {
  const res = await fetch('/api/agents/archie/revise', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ bundle: ArchieRoadmapBundle }>
}
