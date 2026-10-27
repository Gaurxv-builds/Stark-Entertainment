import type { Track } from '../../types/music'

export const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi-libre.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.nosebs.ru',
]

function parseDuration(rawDuration: any): number {
  if (typeof rawDuration === 'number') return rawDuration
  if (typeof rawDuration === 'string') {
    const parts = rawDuration.split(':').map((p) => parseInt(p, 10))
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1]
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
  }
  return 210
}

function extractVideoId(urlOrId: string): string {
  if (!urlOrId) return ''
  if (urlOrId.includes('v=')) {
    return urlOrId.split('v=')[1]?.split('&')[0] || ''
  }
  if (urlOrId.startsWith('/watch?v=')) {
    return urlOrId.replace('/watch?v=', '').split('&')[0]
  }
  return urlOrId.replace(/^\/+/, '')
}

/**
 * Resolves a direct audio stream URL for a Piped/YouTube video with timeout.
 */
export async function resolvePipedStreamUrl(videoId: string): Promise<string | null> {
  const cleanId = extractVideoId(videoId)
  if (!cleanId) return null

  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2500)
      const res = await fetch(`${instance}/streams/${cleanId}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
        const bestAudio =
          data.audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4') || s.format === 'M4A') ||
          data.audioStreams[0]
        if (bestAudio?.url) return bestAudio.url
      }
    } catch {
      // Try next instance
    }
  }
  return null
}

function mapPipedItemToTrack(item: any): Track {
  const videoId = extractVideoId(item.url || item.id || '')
  const title = (item.title || 'Unknown Video').trim()
  const artist = (item.uploaderName || item.uploader || 'YouTube Artist').trim()
  const duration = parseDuration(item.duration)
  const thumbnail = item.thumbnail || item.uploaderAvatar || ''

  return {
    id: `piped:${videoId}`,
    title,
    artist,
    album: 'YouTube Music',
    artwork: thumbnail,
    artworkUrl: thumbnail,
    duration,
    streamUrl: undefined,
    provider: 'piped',
    providerLabel: 'YouTube (Piped)',
    isPreview: false,
    genre: 'Global',
    permalink: `https://piped.video/watch?v=${videoId}`,
    raw: item,
  }
}

/**
 * Executes a search across public Piped instances with failover and per-request timeout.
 */
export async function searchPipedTracks(
  query: string,
  limit = 20
): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []

  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      const url = `${instance}/search?q=${encodeURIComponent(q)}&filter=music_songs`
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) continue
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
      if (items.length > 0) {
        return items
          .filter((i: any) => i.type === 'stream' || i.url)
          .slice(0, limit)
          .map(mapPipedItemToTrack)
      }
    } catch {
      // Continue to next instance
    }
  }

  return []
}

/**
 * Retrieves trending tracks from Piped with region support.
 */
export async function getPipedTrending(limit = 20): Promise<Track[]> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      const url = `${instance}/trending?region=IN`
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) continue
      const data = await res.json()
      const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : []
      if (items.length > 0) {
        return items
          .slice(0, limit)
          .map(mapPipedItemToTrack)
      }
    } catch {
      // Continue to next instance
    }
  }

  return []
}
