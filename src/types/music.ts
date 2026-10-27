export interface LyricLine {
  time: number // in seconds
  text: string
}

export interface Lyrics {
  synced?: LyricLine[]
  plain?: string
  source: string
}

export type MusicProvider = 'saavn' | 'piped' | 'archive' | 'ytmusic_exp' | 'monochrome_exp'

export interface Track {
  id: string
  title: string
  artist: string
  album?: string
  artwork?: string
  artworkUrl?: string
  duration: number // in seconds
  streamUrl?: string
  provider: MusicProvider
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
  bollywood: Track[]
  punjabi: Track[]
  pop: Track[]
  lofi: Track[]
  hiphop: Track[]
}

export interface MusicProviderSettings {
  saavn: boolean // Default: true
  piped: boolean // Default: true
  archive: boolean // Default: false
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
