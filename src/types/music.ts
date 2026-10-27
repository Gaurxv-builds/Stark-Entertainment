export interface LyricLine {
  time: number // in seconds
  text: string
}

export interface Lyrics {
  synced?: LyricLine[]
  plain?: string
  source: string
}

export interface Track {
  id: string
  title: string
  artist: string
  album?: string
  artwork?: string
  artworkUrl?: string
  duration: number // in seconds
  streamUrl?: string
  provider: 'audius' | 'archive' | 'ytmusic_exp' | 'monochrome_exp'
  providerLabel: string
  isPreview?: boolean
  genre?: string
  lyrics?: Lyrics
  permalink?: string
  raw?: any
}

export type MusicTrack = Track

export interface Playlist {
  id: string
  name: string
  description?: string
  cover?: string
  tracks: Track[]
  createdAt: number
  updatedAt: number
}

export interface MusicShelf {
  id: string
  title: string
  description?: string
  tracks: Track[]
}

export interface MusicShelves {
  trending: Track[]
  lofi: Track[]
  electronic: Track[]
  hiphop: Track[]
}

export interface MusicProviderSettings {
  audius: boolean
  archive: boolean
  ytmusic_exp: boolean
  monochrome_exp: boolean
}

export interface MusicProviderInfo {
  id: string
  name: string
  description: string
  enabled: boolean
  isAdFree: boolean
  supportsFullTracks: boolean
  status: 'active' | 'experimental' | 'disabled'
  limitationNotice?: string
}

export interface ProviderSearchOptions {
  limit?: number
  genre?: string
}
