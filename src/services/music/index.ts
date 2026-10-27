import type {
  Track,
  Lyrics,
  MusicShelf,
  MusicShelves,
  MusicProviderSettings,
} from '../../types/music'
import { searchSaavnTracks, getSaavnTrending } from './saavn'
import { searchPipedTracks, getPipedTrending } from './piped'
import { searchArchiveMusic } from './archive'
import { fetchLyrics } from './lyrics'

export * from '../../types/music'
export * from './saavn'
export * from './piped'
export * from './archive'
export * from './lyrics'
export * from './experimental'

const MUSIC_SETTINGS_KEY = 'zk:music:providers:v2'

export const DEFAULT_MUSIC_SETTINGS: MusicProviderSettings = {
  saavn: true,
  piped: true,
  archive: false,
}

export function getProviderConfigs(): MusicProviderSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_MUSIC_SETTINGS }
  }
  try {
    const raw = localStorage.getItem(MUSIC_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        saavn: parsed.saavn ?? DEFAULT_MUSIC_SETTINGS.saavn,
        piped: parsed.piped ?? DEFAULT_MUSIC_SETTINGS.piped,
        archive: parsed.archive ?? DEFAULT_MUSIC_SETTINGS.archive,
      }
    }
  } catch {}

  return { ...DEFAULT_MUSIC_SETTINGS }
}

export function saveProviderConfigs(configs: MusicProviderSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify(configs))
  } catch {}
}

export function getMusicSettings(): MusicProviderSettings {
  return getProviderConfigs()
}

export function saveMusicSettings(settings: MusicProviderSettings) {
  saveProviderConfigs(settings)
}

/**
 * Deduplicate track list by title and artist, preserving distinct remixes/editions.
 */
export function deduplicateTracks(tracks: Track[]): Track[] {
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
 * Only queries providers currently toggled true in settings.
 */
export async function searchAllMusic(
  query: string,
  settings?: MusicProviderSettings,
  limit = 25
): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []

  const configs = settings || getProviderConfigs()
  const promises: Promise<Track[]>[] = []

  if (configs.saavn) {
    promises.push(searchSaavnTracks(q, limit).catch(() => []))
  }
  if (configs.piped) {
    promises.push(searchPipedTracks(q, Math.min(15, limit)).catch(() => []))
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
    const [trendingSaavn, trendingPiped, bollywood, punjabi, pop, lofi, hiphop] =
      await Promise.all([
        getSaavnTrending(12).catch(() => []),
        getPipedTrending(8).catch(() => []),
        searchSaavnTracks('bollywood top hits', 10).catch(() => []),
        searchSaavnTracks('punjabi latest', 10).catch(() => []),
        searchSaavnTracks('english global pop', 10).catch(() => []),
        searchSaavnTracks('lofi chill beats', 10).catch(() => []),
        searchSaavnTracks('indian hip hop', 10).catch(() => []),
      ])

    const trending = deduplicateTracks([...trendingSaavn, ...trendingPiped])

    const out: MusicShelves = {
      trending: trending.length > 0 ? trending : trendingSaavn,
      bollywood: deduplicateTracks(bollywood),
      punjabi: deduplicateTracks(punjabi),
      pop: deduplicateTracks(pop),
      lofi: deduplicateTracks(lofi),
      hiphop: deduplicateTracks(hiphop),
    }

    shelvesCache.data = out
    shelvesCache.timestamp = now
    return out
  } catch (err) {
    console.error('[Music] Failed to load shelves:', err)
    return {
      trending: [],
      bollywood: [],
      punjabi: [],
      pop: [],
      lofi: [],
      hiphop: [],
    }
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
      title: 'Trending Today',
      description: 'Hot hits streaming now across JioSaavn and Piped with zero ads',
      tracks: data.trending,
    },
    {
      id: 'bollywood',
      title: 'Bollywood Hits',
      description: 'The biggest Hindi film songs and chart-toppers',
      tracks: data.bollywood,
    },
    {
      id: 'punjabi',
      title: 'Punjabi Vibes',
      description: 'High-energy beats, Bhangra rhythms, and Punjabi pop',
      tracks: data.punjabi,
    },
    {
      id: 'pop',
      title: 'Global Pop',
      description: 'Top international pop anthems and radio favorites',
      tracks: data.pop,
    },
    {
      id: 'lofi',
      title: 'Lo-Fi Chill & Focus',
      description: 'Relaxing study beats and mellow ambient soundscapes',
      tracks: data.lofi,
    },
    {
      id: 'hiphop',
      title: 'Hip-Hop & Rap',
      description: 'Urban flow, Desi hip-hop, and hard-hitting basslines',
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
