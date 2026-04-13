/**
 * Rescales stored Archie roadmap JSON (`bundles_raw.skills` / `job_ready`) so the weekly
 * syllabus spans `newWeeks` calendar weeks — used when the learner sets a new target end date.
 */

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Whole calendar weeks from today (UTC) until target (inclusive of the week that contains target). */
export function calendarWeeksUntilTarget(targetYmd: string): number {
  const t = targetYmd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return 8
  const today = ymdUtc(new Date())
  const t0 = new Date(`${today}T12:00:00.000Z`).getTime()
  const t1 = new Date(`${t}T12:00:00.000Z`).getTime()
  const diffDays = Math.ceil((t1 - t0) / 86400000)
  if (diffDays <= 0) return 1
  return Math.max(1, Math.min(104, Math.ceil(diffDays / 7)))
}

function adjustPlanRationale(raw: Record<string, unknown>, targetYmd: string): void {
  const prev = String(raw.planRationale || '')
  const note = ` Pace adjusted to target finish by ${targetYmd} (UTC).`
  if (/Pace adjusted to target finish by/i.test(prev)) {
    raw.planRationale = prev.replace(/\s*Pace adjusted to target finish by[^\n.]*[.\s]*/i, '') + note
  } else {
    raw.planRationale = (prev + note).trim()
  }
}

/**
 * Remaps `weeklyTimeline` and milestone `phaseLabel` to spread across `newWeeks` calendar weeks.
 * Milestone ids and order are unchanged (week-gate logic stays consistent).
 */
export function rescaleRoadmapRawForCalendarWeeks(
  raw: Record<string, unknown>,
  newWeeks: number,
  targetYmd: string,
): Record<string, unknown> {
  const out = { ...raw } as Record<string, unknown>
  const w = { ...((out.weeklyTimeline || {}) as Record<string, unknown>) }
  const oldWeeksArr = Array.isArray(w.weeks) ? (w.weeks as Record<string, unknown>[]) : []
  const oldTotal = Math.max(
    1,
    typeof w.totalWeeks === 'number' ? w.totalWeeks : oldWeeksArr.length || 1,
  )
  const milestonesRaw = Array.isArray(out.milestones) ? (out.milestones as Record<string, unknown>[]) : []
  const n = milestonesRaw.length

  const safeNew = Math.max(1, Math.min(104, Math.round(newWeeks)))

  const newWeeksList: Record<string, unknown>[] = []
  for (let j = 0; j < safeNew; j++) {
    if (oldWeeksArr.length > 0) {
      const srcIdx = Math.min(
        oldWeeksArr.length - 1,
        Math.floor(((j + 0.5) / safeNew) * oldWeeksArr.length),
      )
      const src = oldWeeksArr[srcIdx] || {}
      newWeeksList.push({
        week: j + 1,
        title: String((src as Record<string, unknown>).title || `Week ${j + 1}`),
        topics: Array.isArray((src as Record<string, unknown>).topics)
          ? [...((src as Record<string, unknown>).topics as unknown[])]
          : [],
      })
    } else if (n > 0) {
      const srcIdx = Math.min(n - 1, Math.floor(((j + 0.5) / safeNew) * n))
      const m = milestonesRaw[srcIdx] || {}
      newWeeksList.push({
        week: j + 1,
        title: String((m as Record<string, unknown>).title || `Week ${j + 1}`),
        topics: Array.isArray((m as Record<string, unknown>).topics)
          ? [...((m as Record<string, unknown>).topics as unknown[])]
          : [],
      })
    } else {
      newWeeksList.push({ week: j + 1, title: `Week ${j + 1}`, topics: [] })
    }
  }

  const phasesRaw = Array.isArray(w.phases) ? (w.phases as Record<string, unknown>[]) : []
  const phases =
    phasesRaw.length > 0
      ? phasesRaw.map((p) => {
          const weekStart = typeof p.weekStart === 'number' ? p.weekStart : 1
          const weekEnd = typeof p.weekEnd === 'number' ? p.weekEnd : oldTotal
          const ns = Math.max(
            1,
            Math.min(safeNew, Math.round((weekStart / oldTotal) * safeNew) || 1),
          )
          const ne = Math.max(ns, Math.min(safeNew, Math.round((weekEnd / oldTotal) * safeNew) || safeNew))
          return {
            ...p,
            weekStart: ns,
            weekEnd: ne,
          }
        })
      : [{ name: 'Plan', weekStart: 1, weekEnd: safeNew }]

  const nextMilestones = milestonesRaw.map((m, i) => {
    const calWeek =
      n > 0 ? 1 + Math.min(safeNew - 1, Math.floor(((i + 0.5) / n) * safeNew)) : 1
    return {
      ...m,
      phaseLabel: `W${calWeek}`,
    }
  })

  out.weeklyTimeline = {
    ...w,
    totalWeeks: safeNew,
    weeks: newWeeksList,
    phases,
  }
  out.milestones = nextMilestones
  adjustPlanRationale(out, targetYmd)

  return out
}
