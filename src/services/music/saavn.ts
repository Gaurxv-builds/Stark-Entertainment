import type { Track } from '../../types/music'

const SAAVN_INSTANCES = [
  'https://saavn.dev/api',
  'https://saavn.me/api',
  'https://jiosaavn-api.vercel.app/api',
]

function decodeHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function extractArtwork(raw: any): string {
  if (Array.isArray(raw.image)) {
    const high =
      raw.image.find((i: any) => i.quality === '500x500') ||
      raw.image[raw.image.length - 1]
    if (high?.url) return high.url
  }
  if (typeof raw.image === 'string') {
    return raw.image
      .replace(/150x150\.jpg$/i, '500x500.jpg')
      .replace(/50x50\.jpg$/i, '500x500.jpg')
  }
  return ''
}

function extractStreamUrl(raw: any): string {
  if (Array.isArray(raw.downloadUrl) && raw.downloadUrl.length > 0) {
    const stream320 = raw.downloadUrl.find(
      (d: any) => d.quality === '320kbps' || d.quality === '320'
    )
    if (stream320?.url) return stream320.url

    const stream160 = raw.downloadUrl.find(
      (d: any) => d.quality === '160kbps' || d.quality === '160'
    )
    if (stream160?.url) return stream160.url

    const valid = raw.downloadUrl.filter((d: any) => d.url)
    if (valid.length > 0) return valid[valid.length - 1].url
  }

  if (raw.more_info?.media_preview_url) {
    const prev: string = raw.more_info.media_preview_url
    return prev.replace('_preview.mp4', '_320.mp4')
  }

  return ''
}

export function mapSaavnSongToTrack(s: any): Track {
  const id = String(s.id || s.song_id || Math.random())
  const title = decodeHtml(s.name || s.title || s.song || 'Unknown Track')

  let artist = 'Various Artists'
  if (Array.isArray(s.artists?.primary) && s.artists.primary.length > 0) {
    artist = s.artists.primary.map((a: any) => a.name).join(', ')
  } else if (typeof s.primary_artists === 'string' && s.primary_artists.trim()) {
    artist = decodeHtml(s.primary_artists)
  } else if (typeof s.more_info?.singers === 'string' && s.more_info.singers.trim()) {
    artist = decodeHtml(s.more_info.singers)
  } else if (typeof s.more_info?.primary_artists === 'string' && s.more_info.primary_artists.trim()) {
    artist = decodeHtml(s.more_info.primary_artists)
  } else if (typeof s.artist === 'string' && s.artist.trim()) {
    artist = decodeHtml(s.artist)
  }

  const album = decodeHtml(
    typeof s.album === 'object'
      ? s.album?.name || ''
      : s.album || s.more_info?.album || ''
  )

  const duration = parseInt(s.duration || s.more_info?.duration || '180', 10) || 180
  const artwork = extractArtwork(s)
  const streamUrl = extractStreamUrl(s)

  return {
    id: `saavn:${id}`,
    title,
    artist,
    album: album || undefined,
    artwork: artwork || undefined,
    artworkUrl: artwork || undefined,
    duration,
    streamUrl: streamUrl || undefined,
    provider: 'saavn',
    providerLabel: 'JioSaavn',
    isPreview: !streamUrl || streamUrl.includes('_preview'),
    genre: s.language || s.genre || 'Indian',
    permalink: s.url || s.perma_url,
    raw: s,
  }
}

/**
 * Executes a request against JioSaavn API gateway with automatic instance failover.
 */
async function fetchFromSaavnInstances(
  path: string,
  params: Record<string, string | number> = {}
): Promise<any> {
  const queryStr = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    queryStr.set(k, String(v))
  }
  const qs = queryStr.toString()

  // 1. Try public wrapper instances
  for (const instance of SAAVN_INSTANCES) {
    try {
      const url = `${instance}${path}${qs ? `?${qs}` : ''}`
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data && (data.status === 'SUCCESS' || data.success === true || data.data)) {
        return data
      }
    } catch {
      // Continue to next instance
    }
  }

  // 2. Direct JioSaavn fallback
  if (path.includes('search/songs') || path.includes('search')) {
    const q = String(params.query || params.q || 'top')
    const directUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
      q
    )}&n=${params.limit || 20}&p=1`

    const res = await fetch(directUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.results)) {
        return { data: { results: data.results } }
      }
    }
  }

  throw new Error('All JioSaavn gateways are currently unreachable')
}

/**
 * Searches for songs across JioSaavn's catalog.
 */
export async function searchSaavnTracks(
  query: string,
  limit = 20
): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []

  try {
    const res = await fetchFromSaavnInstances('/search/songs', {
      query: q,
      limit,
    })

    const items =
      res?.data?.results ||
      res?.data ||
      (Array.isArray(res?.results) ? res.results : [])

    if (!Array.isArray(items)) return []

    return items
      .map(mapSaavnSongToTrack)
      .filter((t) => t.title && t.id)
  } catch (err) {
    console.warn('[JioSaavn] search failed:', err)
    return []
  }
}

/**
 * Retrieves trending Indian tracks from JioSaavn.
 */
export async function getSaavnTrending(limit = 20): Promise<Track[]> {
  try {
    // Search top trending hits or hindi charts
    const res = await fetchFromSaavnInstances('/search/songs', {
      query: 'trending hindi',
      limit,
    })

    const items =
      res?.data?.results ||
      res?.data ||
      (Array.isArray(res?.results) ? res.results : [])

    if (!Array.isArray(items)) return []

    return items
      .map(mapSaavnSongToTrack)
      .filter((t) => t.title && t.id)
  } catch (err) {
    console.warn('[JioSaavn] trending failed:', err)
    return []
  }
}
