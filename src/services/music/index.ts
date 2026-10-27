import type { Track, Lyrics, MusicShelf, MusicShelves, MusicProviderSettings } from '../../types/music'
import { searchAudiusTracks, getAudiusTrending } from './audius'
import { searchArchiveMusic } from './archive'
import { fetchLyrics } from './lyrics'
import { PROVIDER_REGISTRY } from './experimental'

export * from '../../types/music'
export * from './audius'
export * from './archive'
export * from './lyrics'
export * from './experimental'

const MUSIC_SETTINGS_KEY = 'zk:music:providers:v1'

export function getProviderConfigs(): Record<string, boolean> {
  if (typeof window === 'undefined') {
    return Object.fromEntries(PROVIDER_REGISTRY.map((p) => [p.id, p.enabled]))
  }
  try {
    const raw = localStorage.getItem(MUSIC_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        audius: parsed.audius ?? true,
        archive: parsed.archive ?? true,
        ytmusic_exp: parsed.ytmusic_exp ?? false,
        monochrome_exp: parsed.monochrome_exp ?? false,
      }
    }
  } catch {}

  return Object.fromEntries(PROVIDER_REGISTRY.map((p) => [p.id, p.enabled]))
}

export function saveProviderConfigs(configs: Record<string, boolean>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify(configs))
  } catch {}
}

export function getMusicSettings(): MusicProviderSettings {
  const configs = getProviderConfigs()
  return {
    audius: !!configs.audius,
    archive: !!configs.archive,
    ytmusic_exp: !!configs.ytmusic_exp,
    monochrome_exp: !!configs.monochrome_exp,
  }
}

export function saveMusicSettings(settings: MusicProviderSettings) {
  saveProviderConfigs({
    audius: settings.audius,
    archive: settings.archive,
    ytmusic_exp: settings.ytmusic_exp,
    monochrome_exp: settings.monochrome_exp,
  })
}

/**
 * Deduplicate track list by title and artist, preserving distinct remixes/editions.
 */
function deduplicateTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>()
  const result: Track[] = []

  for (const t of tracks) {
    const key = `${t.title.toLowerCase().trim()}::${t.artist.toLowerCase().trim()}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(t)
    }
  }

  return result
}

/**
 * Unified search querying all active zero-ad music providers concurrently.
 */
export async function searchAllMusic(
  query: string,
  settings?: MusicProviderSettings,
  limit = 25,
): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []

  const configs = settings || getProviderConfigs()
  const promises: Promise<Track[]>[] = []

  if (configs.audius) {
    promises.push(searchAudiusTracks(q, limit).catch(() => []))
  }
  if (configs.archive) {
    promises.push(searchArchiveMusic(q, Math.min(10, limit)).catch(() => []))
  }

  const results = await Promise.all(promises)
  return deduplicateTracks(results.flat())
}

const shelvesCache = {
  data: null as MusicShelves | null,
  timestamp: 0,
}

/**
 * Get curated music shelves for the Music Home interface.
 */
export async function getCuratedMusicShelves(): Promise<MusicShelves> {
  const now = Date.now()
  if (shelvesCache.data && now - shelvesCache.timestamp < 10 * 60 * 1000) {
    return shelvesCache.data
  }

  try {
    const [trending, lofi, electronic, hiphop] = await Promise.all([
      getAudiusTrending(undefined, 12).catch(() => []),
      searchAudiusTracks('lofi chill', 10).catch(() => []),
      searchAudiusTracks('electronic bass synth', 10).catch(() => []),
      searchAudiusTracks('hip hop beats', 10).catch(() => []),
    ])

    const out: MusicShelves = {
      trending: deduplicateTracks(trending),
      lofi: deduplicateTracks(lofi),
      electronic: deduplicateTracks(electronic),
      hiphop: deduplicateTracks(hiphop),
    }

    shelvesCache.data = out
    shelvesCache.timestamp = now
    return out
  } catch (err) {
    console.error('[Music] Failed to load shelves:', err)
    return { trending: [], lofi: [], electronic: [], hiphop: [] }
  }
}

/**
 * Convenience helper returning structured shelves array with titles and descriptions.
 */
export async function fetchMusicShelves(): Promise<MusicShelf[]> {
  const data = await getCuratedMusicShelves()
  return [
    {
      id: 'trending',
      title: 'Trending Tracks',
      description: 'Popular community tracks streaming now with zero ads',
      tracks: data.trending,
    },
    {
      id: 'lofi',
      title: 'Lo-Fi Chill & Focus',
      description: 'Relaxing study beats and mellow rhythms',
      tracks: data.lofi,
    },
    {
      id: 'electronic',
      title: 'Electronic & Bass',
      description: 'Future bass, synthwave, and vibrant club energy',
      tracks: data.electronic,
    },
    {
      id: 'hiphop',
      title: 'Hip-Hop & Urban Beats',
      description: 'Underground flow, trap instrumentals, and groove',
      tracks: data.hiphop,
    },
  ]
}

/**
 * Cache for resolved track lyrics.
 */
const lyricsCache = new Map<string, Lyrics | null>()

/**
 * Fetches lyrics for a track, utilizing memory caching.
 */
export async function resolveTrackLyrics(track: Track): Promise<Lyrics | null> {
  const cacheKey = `${track.artist}::${track.title}`
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) ?? null
  }

  const lyrics = await fetchLyrics(track.title, track.artist, track.duration)
  lyricsCache.set(cacheKey, lyrics)
  return lyrics
}
