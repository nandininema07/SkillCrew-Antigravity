/** Python FastAPI onboarding server (LinkedIn scrape + resume parse). */
export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL?.trim() || 'http://127.0.0.1:8000'
  return url.replace(/\/$/, '')
}
