/** Central XP rules: login days, Pip quizzes, and score bonuses. */

/** Spend this much account XP to unlock the end-of-course capstone project (per roadmap). */
export const CAPSTONE_XP_COST = 300

export const XP_PER_DISTINCT_LOGIN_DAY = 15
/** Extra XP each time a Pip checkpoint is submitted (in addition to per-question net). */
export const XP_PIP_TEST_COMPLETION = 15
/**
 * Extra XP scaling with quiz score (0–100). e.g. 80% → +24 XP.
 * Added on top of difficulty-based correct/wrong net from the quiz.
 */
export function xpFromPipScorePercent(scorePercent: number): number {
  const s = Math.max(0, Math.min(100, Math.round(scorePercent)))
  return Math.round(s * 0.3)
}

export function levelFromXp(xp: number): number {
  return Math.max(1, 1 + Math.floor(Math.max(0, xp) / 500))
}
