import type { KomgaConfig } from './types'
import { isSafeServerUrl } from './jellyfin'

export interface KomgaLibrary {
  id: string
  name: string
  booksCount?: number
}

export async function testKomgaConnection(
  config: KomgaConfig
): Promise<{ ok: boolean; libraries?: KomgaLibrary[]; error?: string }> {
  if (!config.enabled || !config.serverUrl) {
    return { ok: false, error: 'Komga integration is not configured' }
  }

  const check = isSafeServerUrl(config.serverUrl)
  if (!check.valid) {
    return { ok: false, error: check.reason }
  }

  try {
    const base = config.serverUrl.replace(/\/$/, '')
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (config.apiKey) {
      headers['X-Auth-Token'] = config.apiKey.trim()
    }

    const res = await fetch(`${base}/api/v1/libraries`, {
      method: 'GET',
      headers,
    })

    if (!res.ok) {
      return { ok: false, error: `Komga responded with HTTP ${res.status}` }
    }

    const data = await res.json()
    const libs: KomgaLibrary[] = Array.isArray(data)
      ? data.map((l: any) => ({
          id: l.id,
          name: l.name,
          booksCount: l.booksCount,
        }))
      : []

    return { ok: true, libraries: libs }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unable to reach Komga server' }
  }
}
