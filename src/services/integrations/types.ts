export interface TraktConfig {
  enabled: boolean
  clientId: string
  accessToken?: string
  scrobbleWatching: boolean
}

export interface JellyfinConfig {
  enabled: boolean
  serverUrl: string
  apiKey?: string
  userId?: string
}

export interface KomgaConfig {
  enabled: boolean
  serverUrl: string
  apiKey?: string
}

export interface IntegrationSettings {
  trakt: TraktConfig
  jellyfin: JellyfinConfig
  komga: KomgaConfig
}

export const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  trakt: {
    enabled: false,
    clientId: '',
    scrobbleWatching: true,
  },
  jellyfin: {
    enabled: false,
    serverUrl: '',
    apiKey: '',
  },
  komga: {
    enabled: false,
    serverUrl: '',
    apiKey: '',
  },
}
