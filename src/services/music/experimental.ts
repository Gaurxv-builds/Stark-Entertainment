import type { Track, MusicProviderInfo } from '../../types/music'

export const PROVIDER_REGISTRY: MusicProviderInfo[] = [
  {
    id: 'audius',
    name: 'Audius Decentralized Audio',
    description: 'High-bitrate, full-length streaming directly from independent and electronic artists. Verified zero-ad and free access.',
    enabled: true,
    isAdFree: true,
    supportsFullTracks: true,
    status: 'active',
  },
  {
    id: 'archive',
    name: 'Internet Archive Open Music',
    description: 'Public domain, Creative Commons, live concerts, and ambient recordings. Completely free and ad-free.',
    enabled: true,
    isAdFree: true,
    supportsFullTracks: true,
    status: 'active',
  },
  {
    id: 'ytmusic_exp',
    name: 'Unofficial YouTube Music (Research Reference)',
    description: 'Based on Metrolist/InnerTune/YouTube.js architecture. Disabled in production due to browser CORS, SABR throttling, and dynamic n-token bot protection.',
    enabled: false,
    isAdFree: false,
    supportsFullTracks: false,
    status: 'experimental',
    limitationNotice:
      'Direct browser-to-YouTube playback is blocked by CORS headers on googlevideo.com. Requires external proxy and n-token deciphering to prevent 403 throttling.',
  },
  {
    id: 'monochrome_exp',
    name: 'Monochrome / Tidal Proxy (Research Reference)',
    description: 'Based on reverse-engineered Tidal/Qobuz HiFi proxy endpoints. Disabled due to ephemeral endpoints and licensing restrictions.',
    enabled: false,
    isAdFree: false,
    supportsFullTracks: false,
    status: 'disabled',
    limitationNotice:
      'Third-party endpoints lack public stability guarantees, frequently encounter token revocations, and do not possess redistributive streaming licenses.',
  },
]

export const EXPERIMENTAL_PROVIDERS = PROVIDER_REGISTRY

/**
 * Experimental YouTube Music resolver reference stub.
 * Explicitly rejects playback unless a verified dedicated proxy is configured.
 */
export async function searchYtMusicExperimental(_query: string): Promise<Track[]> {
  console.info('[Music] YouTube Music provider is disabled by policy: requires backend proxy with n-token decipherer.')
  return []
}
