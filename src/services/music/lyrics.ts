import type { LyricLine, Lyrics } from '../../types/music'

const LRCLIB_API = 'https://lrclib.net/api'
const lyricsCache = new Map<string, Lyrics | null>()

/**
 * Parse standard LRC format string into structured timestamped array.
 * e.g. "[00:12.34] Hello world" -> { time: 12.34, text: "Hello world" }
 */
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return []
  const lines = lrcText.split('\n')
  const result: LyricLine[] = []

  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const matches = [...trimmed.matchAll(timeRegex)]
    if (matches.length > 0) {
      const text = trimmed.replace(timeRegex, '').trim()
      for (const match of matches) {
        const minutes = parseInt(match[1], 10)
        const seconds = parseFloat(match[2])
        const totalSeconds = minutes * 60 + seconds
        result.push({ time: totalSeconds, text })
      }
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

/**
 * Clean artist and track title string for optimal lyrics matching.
 */
function cleanSearchTerm(str: string): string {
  return str
    .replace(/\s*[\(\[](?:feat|ft|with|prod|official|remix|audio|video|lyrics)[^\)\]]*[\)\]]/gi, '')
    .replace(/[^\w\s\u00C0-\u024F\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fetch lyrics from LRCLIB (open-source, 100% free, zero-ad lyrics database).
 */
export async function fetchLyrics(
  artist: string,
  title: string,
  duration?: number
): Promise<Lyrics | null> {
  const cleanArtist = cleanSearchTerm(artist)
  const cleanTitle = cleanSearchTerm(title)

  if (!cleanTitle) return null

  const cacheKey = `${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}`
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) || null
  }

  try {
    let url = `${LRCLIB_API}/get?track_name=${encodeURIComponent(cleanTitle)}`
    if (cleanArtist) {
      url += `&artist_name=${encodeURIComponent(cleanArtist)}`
    }
    if (duration && duration > 0) {
      url += `&duration=${Math.round(duration)}`
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'GaurxvVerse/2.0 (https://verse.gaurxv.eu.org)',
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      lyricsCache.set(cacheKey, null)
      return null
    }

    const data = await res.json()
    const synced = data.syncedLyrics ? parseLrc(data.syncedLyrics) : undefined
    const plain = data.plainLyrics || undefined

    if (!synced && !plain) {
      lyricsCache.set(cacheKey, null)
      return null
    }

    const lyricsObj: Lyrics = {
      synced,
      plain,
      source: 'LRCLIB (Open Lyrics)',
    }

    lyricsCache.set(cacheKey, lyricsObj)
    return lyricsObj
  } catch (err) {
    lyricsCache.set(cacheKey, null)
    return null
  }
}
