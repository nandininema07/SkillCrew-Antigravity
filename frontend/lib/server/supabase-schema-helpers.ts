/** PostgREST / Supabase errors when tables or columns from migration 004 are missing. */
export function isMissingSchemaObject(message: string | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('could not find') ||
    (m.includes('column') && (m.includes('profiles') || m.includes('last_active')))
  )
}
