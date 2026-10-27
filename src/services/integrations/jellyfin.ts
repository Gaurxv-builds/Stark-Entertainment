import type { JellyfinConfig } from './types'

/** Basic client-side SSRF validation for user-entered server URLs */
export function isSafeServerUrl(rawUrl: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'URL must use http:// or https://' }
    }

    const host = parsed.hostname.toLowerCase()
    const forbidden = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254',
      'metadata.google.internal',
      'instance-data',
    ]

    if (forbidden.includes(host) || host.endsWith('.internal')) {
      return { valid: false, reason: 'Local and cloud metadata loopbacks are forbidden' }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }
}

export interface JellyfinSystemInfo {
  serverName: string
  version: string
  id: string
}

export async function testJellyfinConnection(
  config: JellyfinConfig
): Promise<{ ok: boolean; info?: JellyfinSystemInfo; error?: string }> {
  if (!config.enabled || !config.serverUrl) {
    return { ok: false, error: 'Jellyfin integration is not configured' }
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
      headers['X-Emby-Token'] = config.apiKey.trim()
    }

    const res = await fetch(`${base}/System/Info/Public`, {
      method: 'GET',
      headers,
    })

    if (!res.ok) {
      return { ok: false, error: `Jellyfin server responded with HTTP ${res.status}` }
    }

    const data = await res.json()
    return {
      ok: true,
      info: {
        serverName: data.ServerName || 'Jellyfin Server',
        version: data.Version || 'Unknown',
        id: data.Id || '',
      },
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unable to reach Jellyfin server' }
  }
}
