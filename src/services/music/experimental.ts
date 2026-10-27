import type { Track, MusicProviderInfo } from '../../types/music'

export const PROVIDER_REGISTRY: MusicProviderInfo[] = [
  {
    id: 'saavn',
    name: 'JioSaavn Gateway',
    description:
      'Direct 320kbps / 160kbps AAC streaming for millions of Bollywood, Punjabi, regional Indian, and global tracks with high-res artwork.',
    enabled: true,
    isAdFree: true,
    supportsFullTracks: true,
    status: 'active',
  },
  {
    id: 'piped',
    name: 'YouTube (Piped API)',
    description:
      'Ad-free audio streaming and trending music across the global YouTube music catalog via public privacy-respecting instances.',
    enabled: true,
    isAdFree: true,
    supportsFullTracks: true,
    status: 'active',
  },
  {
    id: 'archive',
    name: 'Internet Archive Open Music',
    description:
      'Public domain, Creative Commons, live concerts, and ambient recordings. Completely free and ad-free.',
    enabled: false,
    isAdFree: true,
    supportsFullTracks: true,
    status: 'active',
  },
  {
    id: 'ytmusic_exp',
    name: 'Direct YouTube Music (Research Reference)',
    description:
      'Metrolist/InnerTune architecture. Disabled in production due to browser CORS, SABR throttling, and dynamic n-token protection.',
    enabled: false,
    isAdFree: false,
    supportsFullTracks: false,
    status: 'experimental',
    limitationNotice:
      'Direct browser-to-YouTube playback is blocked by CORS headers on googlevideo.com. Handled via Piped provider.',
  },
  {
    id: 'monochrome_exp',
    name: 'Monochrome / Tidal Proxy (Research Reference)',
    description:
      'Based on reverse-engineered Tidal/Qobuz HiFi proxy endpoints. Disabled due to ephemeral endpoints and licensing restrictions.',
    enabled: false,
    isAdFree: false,
    supportsFullTracks: false,
    status: 'disabled',
    limitationNotice:
      'Third-party endpoints lack public stability guarantees and frequently encounter token revocations.',
  },
]

export const EXPERIMENTAL_PROVIDERS = PROVIDER_REGISTRY

export async function searchYtMusicExperimental(_query: string): Promise<Track[]> {
  console.info('[Music] Direct YouTube Music provider is reference-only; use Piped engine.')
  return []
}
