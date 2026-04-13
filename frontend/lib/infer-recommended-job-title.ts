/** Heuristic: suggest an interview-prep role title from a learning topic (user can edit before building Job ready). */
export function inferRecommendedJobTitle(topic: string): string {
  const t = topic.trim()
  const lower = t.toLowerCase()
  if (/\bmachine learning\b|\bdeep learning\b|\bml\b(?![a-z])|neural net/.test(lower)) return 'ML Engineer'
  if (/full.?stack|web dev|website|web development/.test(lower)) return 'Full Stack Developer'
  if (/frontend|react|vue|angular|next\.?js/.test(lower)) return 'Frontend Engineer'
  if (/backend|api design|server-side|node\.?js/.test(lower)) return 'Backend Engineer'
  if (/data sci|analytics|sql/.test(lower)) return 'Data Scientist'
  if (/devops|kubernetes|docker|terraform|\bsre\b/.test(lower)) return 'DevOps Engineer'
  if (/\bqa\b|test automation|quality assurance/.test(lower)) return 'QA Engineer'
  if (/mobile|ios|android|flutter|react native/.test(lower)) return 'Mobile Engineer'
  if (/security|infosec|cyber/.test(lower)) return 'Security Engineer'
  if (/cloud|aws|azure|gcp/.test(lower)) return 'Cloud Engineer'
  return `${t} (target role)`
}
