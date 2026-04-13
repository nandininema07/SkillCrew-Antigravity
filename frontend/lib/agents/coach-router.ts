/**
 * Lightweight routing (no LangChain) — decides which follow-up work is worth running
 * for a coach turn. The coach LLM still runs once unless cache hits.
 */
export type CoachRoutePlan = {
  /** Message likely needs roadmap / Archie follow-up (beyond generic chat). */
  likelyNeedsRoadmapSignals: boolean
  /** Run skills + job_ready Archie revise in parallel when coach requests refresh. */
  parallelArchieRevise: boolean
}

const ROADMAP_SIGNAL =
  /\b(roadmap|pace|slow|fast|overwhelm|burnout|too much|too busy|deadline|rebuild|regenerate|adjust|schedule|timeline|depth|syllabus|milestone|quiz|pip|archie)\b/i

export function planCoachSideEffects(message: string): CoachRoutePlan {
  const t = message.trim()
  const likely = ROADMAP_SIGNAL.test(t)
  return {
    likelyNeedsRoadmapSignals: likely,
    parallelArchieRevise: likely,
  }
}
