import type { Track } from '../../types/music'

const APP_NAME = 'gaurxv-verse'
const AUDIUS_DEFAULT_HOST = 'https://api.audius.co'

let cachedHost: string | null = null
let lastHostCheck = 0

/**
 * Get a healthy Audius discovery host.
 * Falls back safely to https://api.audius.co if discovery query fails.
 */
export async function getAudiusHost(): Promise<string> {
  const now = Date.now()
  if (cachedHost && now - lastHostCheck < 15 * 60 * 1000) {
    return cachedHost
  }

  try {
    const res = await fetch(`${AUDIUS_DEFAULT_HOST}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data) && json.data.length > 0) {
        cachedHost = json.data[0].replace(/\/$/, '')
        lastHostCheck = now
        return cachedHost!
      }
    }
  } catch {}

  cachedHost = AUDIUS_DEFAULT_HOST
  lastHostCheck = now
  return AUDIUS_DEFAULT_HOST
}

function normalizeArtwork(artworkObj: any): string {
  if (!artworkObj) return ''
  if (typeof artworkObj === 'string') return artworkObj
  return (
    artworkObj['480x480'] ||
    artworkObj['1000x1000'] ||
    artworkObj['150x150'] ||
    ''
  )
}

function mapAudiusTrack(item: any): Track {
  const artistName = item.user?.name || item.artist || 'Unknown Artist'
  const duration = Number(item.duration) || 0
  const artwork = normalizeArtwork(item.artwork)

  return {
    id: `audius:${item.id}`,
    title: item.title || 'Untitled Track',
    artist: artistName,
    album: item.genre || 'Single',
    artwork,
    duration,
    streamUrl: `https://api.audius.co/v1/tracks/${item.id}/stream?app_name=${APP_NAME}`,
    provider: 'audius',
    providerLabel: 'Audius',
    isPreview: false, // 100% full-length audio
    genre: item.genre || undefined,
    permalink: item.permalink ? `https://audius.co${item.permalink}` : undefined,
    raw: { id: item.id },
  }
}

/**
 * Search Audius catalog for full-length tracks.
 */
export async function searchAudiusTracks(query: string, limit = 20): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []

  try {
    const host = await getAudiusHost()
    const url = `${host}/v1/tracks/search?query=${encodeURIComponent(q)}&limit=${limit}&app_name=${APP_NAME}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })

    if (!res.ok) {
      throw new Error(`Audius search returned HTTP ${res.status}`)
    }

    const json = await res.json()
    if (!Array.isArray(json.data)) return []

    return json.data.map(mapAudiusTrack).filter((t: Track) => t.duration > 0)
  } catch (err) {
    console.warn('[Audius] Search error:', err)
    return []
  }
}

/**
 * Fetch top trending tracks on Audius.
 */
export async function getAudiusTrending(genre?: string, limit = 24): Promise<Track[]> {
  try {
    const host = await getAudiusHost()
    let url = `${host}/v1/tracks/trending?limit=${limit}&app_name=${APP_NAME}`
    if (genre && genre !== 'all') {
      url += `&genre=${encodeURIComponent(genre)}`
    }

    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      throw new Error(`Audius trending returned HTTP ${res.status}`)
    }

    const json = await res.json()
    if (!Array.isArray(json.data)) return []

    return json.data.map(mapAudiusTrack).filter((t: Track) => t.duration > 0)
  } catch (err) {
    console.warn('[Audius] Trending error:', err)
    return []
  }
}

/**
 * Resolve direct stream URL for an Audius track.
 */
export function getAudiusStreamUrl(rawId: string): string {
  const cleanId = rawId.replace(/^audius:/, '')
  return `https://api.audius.co/v1/tracks/${cleanId}/stream?app_name=${APP_NAME}`
}
