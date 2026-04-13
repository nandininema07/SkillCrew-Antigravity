/**
 * Optional Apify Glassdoor actor run — input shape varies by actor; configure via env.
 */

export type ApifyGlassdoorResult = {
  ok: boolean
  items: unknown[]
  runId?: string
  datasetId?: string
  error?: string
}

export async function runGlassdoorActor(opts: {
  token: string
  actorId: string
  /** Merged with optional APIFY_GLASSDOOR_INPUT_JSON */
  input: Record<string, unknown>
}): Promise<ApifyGlassdoorResult> {
  const { token, actorId, input } = opts
  const id = encodeURIComponent(actorId)

  const res = await fetch(`https://api.apify.com/v2/acts/${id}/runs?waitForFinish=120`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      items: [],
      error: typeof raw?.error?.message === 'string' ? raw.error.message : JSON.stringify(raw).slice(0, 400),
    }
  }

  const data = raw as {
    data?: { id?: string; defaultDatasetId?: string; status?: string }
  }
  const runId = data?.data?.id
  const datasetId = data?.data?.defaultDatasetId

  if (!datasetId) {
    return { ok: false, items: [], runId, error: 'Apify run finished without a dataset id.' }
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!itemsRes.ok) {
    return {
      ok: false,
      items: [],
      runId,
      datasetId,
      error: `Could not fetch dataset: ${itemsRes.status}`,
    }
  }

  const items = (await itemsRes.json()) as unknown[]
  return { ok: true, items, runId, datasetId }
}
