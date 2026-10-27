import type { TraktConfig } from './types'

const TRAKT_API = 'https://api.trakt.tv'

export async function verifyTraktConnection(config: TraktConfig): Promise<boolean> {
  if (!config.enabled || !config.clientId) return false

  try {
    const res = await fetch(`${TRAKT_API}/movies/popular?limit=1`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId.trim(),
      },
    })
    return res.ok
  } catch {
    return false
  }
}

export interface ScrobbleItem {
  title: string
  year?: number
  tmdbId?: number
  progress: number // 0 to 100
  type: 'movie' | 'episode'
  season?: number
  episode?: number
}

/**
 * Report watch scrobble state to Trakt (start, pause, stop).
 * Completely non-blocking and safe: failures fail silently without impacting playback.
 */
export async function scrobbleToTrakt(
  config: TraktConfig,
  action: 'start' | 'pause' | 'stop',
  item: ScrobbleItem
): Promise<boolean> {
  if (!config.enabled || !config.clientId || !config.scrobbleWatching || !config.accessToken) {
    return false
  }

  try {
    const body: Record<string, any> = {
      progress: Math.min(100, Math.max(0, item.progress)),
    }

    if (item.type === 'movie') {
      body.movie = {
        title: item.title,
        ...(item.year ? { year: item.year } : {}),
        ...(item.tmdbId ? { ids: { tmdb: item.tmdbId } } : {}),
      }
    } else {
      body.episode = {
        season: item.season || 1,
        number: item.episode || 1,
      }
      body.show = {
        title: item.title,
        ...(item.year ? { year: item.year } : {}),
        ...(item.tmdbId ? { ids: { tmdb: item.tmdbId } } : {}),
      }
    }

    const res = await fetch(`${TRAKT_API}/scrobble/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId.trim(),
        Authorization: `Bearer ${config.accessToken.trim()}`,
      },
      body: JSON.stringify(body),
    })

    return res.ok
  } catch {
    return false
  }
}
