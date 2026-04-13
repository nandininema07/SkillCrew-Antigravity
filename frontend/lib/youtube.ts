/** Parse YouTube watch / short / youtu.be URLs. */

export function extractYoutubeVideoId(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  const u = raw.trim()
  try {
    const url = new URL(u)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0]
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v')
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
      const m = url.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)
      if (m?.[1]) return m[1]
    }
  } catch {
    return null
  }
  return null
}

/** Standard thumbnail; hqdefault is reliably present for public videos. */
export function youtubeThumbnailUrl(videoId: string, quality: 'maxres' | 'hq' | 'mq' = 'hq'): string {
  const q = quality === 'maxres' ? 'maxresdefault' : quality === 'mq' ? 'mqdefault' : 'hqdefault'
  return `https://i.ytimg.com/vi/${videoId}/${q}.jpg`
}

export function isYoutubeResourceUrl(url: string | undefined): boolean {
  if (!url?.startsWith('http')) return false
  return extractYoutubeVideoId(url) != null
}
