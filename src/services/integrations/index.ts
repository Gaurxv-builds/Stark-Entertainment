import { DEFAULT_INTEGRATIONS, type IntegrationSettings } from './types'

const STORAGE_KEY = 'zk:integrations:v1'

export * from './types'
export * from './trakt'
export * from './jellyfin'
export * from './komga'

export function loadIntegrations(): IntegrationSettings {
  if (typeof window === 'undefined') return DEFAULT_INTEGRATIONS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        trakt: { ...DEFAULT_INTEGRATIONS.trakt, ...parsed.trakt },
        jellyfin: { ...DEFAULT_INTEGRATIONS.jellyfin, ...parsed.jellyfin },
        komga: { ...DEFAULT_INTEGRATIONS.komga, ...parsed.komga },
      }
    }
  } catch {}
  return DEFAULT_INTEGRATIONS
}

export function saveIntegrations(settings: IntegrationSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}
