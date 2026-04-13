export type CheckpointDifficulty = 'easy' | 'medium' | 'hard'

const WRONG_PENALTY: Record<CheckpointDifficulty, number> = {
  easy: 14,
  medium: 9,
  hard: 5,
}

const CORRECT_BONUS: Record<CheckpointDifficulty, number> = {
  easy: 10,
  medium: 14,
  hard: 22,
}

export function coerceDifficulty(d: string | undefined): CheckpointDifficulty {
  if (d === 'easy' || d === 'medium' || d === 'hard') return d
  return 'medium'
}

export function xpDeltaFromCheckpointResults(
  results: { correct: boolean; difficulty?: string }[],
): { gained: number; lost: number; net: number } {
  let gained = 0
  let lost = 0
  for (const r of results) {
    const diff = coerceDifficulty(r.difficulty)
    if (r.correct) gained += CORRECT_BONUS[diff]
    else lost += WRONG_PENALTY[diff]
  }
  return { gained, lost, net: gained - lost }
}

export type PerQuestionXp = {
  question_id: string
  correct: boolean
  difficulty: CheckpointDifficulty
  /** Signed XP: bonus if correct, negative if wrong. */
  xp: number
}

/** XP earned or lost for each graded question (matches aggregate `xpDeltaFromCheckpointResults`). */
export function perQuestionXpBreakdown(
  gradedResults: { question_id?: string; correct?: boolean; difficulty?: string }[],
  difficultyByQuestionId: Map<string, string>,
): PerQuestionXp[] {
  const out: PerQuestionXp[] = []
  for (const r of gradedResults) {
    const qid = String(r.question_id || '').trim()
    if (!qid) continue
    const diff = coerceDifficulty(difficultyByQuestionId.get(qid) || r.difficulty)
    const correct = !!r.correct
    const xp = correct ? CORRECT_BONUS[diff] : -WRONG_PENALTY[diff]
    out.push({ question_id: qid, correct, difficulty: diff, xp })
  }
  return out
}

export { levelFromXp } from '@/lib/gamification-xp'
