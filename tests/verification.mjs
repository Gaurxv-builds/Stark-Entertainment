import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

console.log('--- STARTING COMPREHENSIVE VERIFICATION SUITE ---')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`[PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message)
    failed++
  }
}

// 1. Supabase Initialization & Fallback
test('Supabase client module exists and exports expected symbols', () => {
  const content = fs.readFileSync('src/lib/supabase.ts', 'utf8')
  assert(content.includes('isSupabaseConfigured'), 'Should export isSupabaseConfigured')
  assert(content.includes('createClient'), 'Should call createClient')
  assert(content.includes('storageKey'), 'Should set secure auth storage key')
})

// 2. SQL Migration File
test('SQL migration creates all required tables with RLS and trigger', () => {
  const migrationPath = 'supabase/migrations/20261027_init_stark_auth_and_sync.sql'
  assert(fs.existsSync(migrationPath), 'Migration file must exist')
  const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase()

  assert(sql.includes('create table if not exists public.user_profiles'), 'user_profiles table required')
  assert(sql.includes('create table if not exists public.user_library'), 'user_library table required')
  assert(sql.includes('create table if not exists public.user_reading_progress'), 'user_reading_progress table required')
  assert(sql.includes('create table if not exists public.user_preferences'), 'user_preferences table required')
  assert(sql.includes('alter table public.user_profiles enable row level security'), 'RLS must be enabled on profiles')
  assert(sql.includes('alter table public.user_library enable row level security'), 'RLS must be enabled on library')
  assert(sql.includes('alter table public.user_reading_progress enable row level security'), 'RLS must be enabled on reading progress')
  assert(sql.includes('create or replace function public.handle_new_user'), 'handle_new_user trigger function required')
})

// 3. Cloud Sync Bidirectional Logic
test('cloudSync module handles reading progress, library, profile, and event listener', () => {
  const content = fs.readFileSync('src/lib/cloudSync.ts', 'utf8')
  assert(content.includes('pullCloudData'), 'pullCloudData required')
  assert(content.includes('pushCloudData'), 'pushCloudData required')
  assert(content.includes('schedulePushCloudData'), 'schedulePushCloudData required')
  assert(content.includes('zk:reading:change'), 'zk:reading:change event listener required')
})

// 4. Ebooks EPUB & PDF Components
test('EpubReader and PdfReader components exist with proper imports', () => {
  const epubPath = 'src/components/ebooks/EpubReader.tsx'
  const pdfPath = 'src/components/ebooks/PdfReader.tsx'
  assert(fs.existsSync(epubPath), 'EpubReader component must exist')
  assert(fs.existsSync(pdfPath), 'PdfReader component must exist')

  const epubContent = fs.readFileSync(epubPath, 'utf8')
  assert(epubContent.includes("from 'epubjs'"), 'EpubReader must import epubjs')
  assert(epubContent.includes('rendition.themes'), 'EpubReader must support themes')

  const pdfContent = fs.readFileSync(pdfPath, 'utf8')
  assert(pdfContent.includes("from 'pdfjs-dist'"), 'PdfReader must import pdfjs-dist')
  assert(pdfContent.includes('pdfjsLib.GlobalWorkerOptions.workerSrc'), 'PdfReader must set workerSrc')
})

// 5. Server SSRF Allowed Domains
test('server SSRF configuration permits Gutenberg and Archive while rejecting forbidden loopbacks', () => {
  const ssrf = fs.readFileSync('server/ssrf.js', 'utf8')
  assert(ssrf.includes('"gutenberg.org"'), 'gutenberg.org must be permitted')
  assert(ssrf.includes('"archive.org"'), 'archive.org must be permitted')
  assert(ssrf.includes('"openlibrary.org"'), 'openlibrary.org must be permitted')
  assert(ssrf.includes('"169.254.169.254"'), 'AWS/Cloud metadata must be forbidden')
  assert(ssrf.includes('"localhost"'), 'localhost must be forbidden')
})

// 6. PWA Vite Configuration and Assets
test('vite.config.ts configures VitePWA with safe offline caching', () => {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8')
  assert(viteConfig.includes('VitePWA'), 'VitePWA must be registered in plugins')
  assert(viteConfig.includes('navigateFallbackDenylist'), 'Denylist must protect auth and admin routes')
  assert(viteConfig.includes('maximumFileSizeToCacheInBytes'), 'Must configure cache file limit')
  assert(fs.existsSync('dist/sw.js'), 'dist/sw.js must be generated after build')
  assert(fs.existsSync('dist/manifest.webmanifest'), 'dist/manifest.webmanifest must exist')
})

// 7. Optional Media Integrations
test('services/integrations exports Trakt, Jellyfin, and Komga connectors', () => {
  assert(fs.existsSync('src/services/integrations/trakt.ts'), 'trakt.ts exists')
  assert(fs.existsSync('src/services/integrations/jellyfin.ts'), 'jellyfin.ts exists')
  assert(fs.existsSync('src/services/integrations/komga.ts'), 'komga.ts exists')
  assert(fs.existsSync('src/services/integrations/index.ts'), 'index.ts exists')

  const jellyfin = fs.readFileSync('src/services/integrations/jellyfin.ts', 'utf8')
  assert(jellyfin.includes('isSafeServerUrl'), 'SSRF check function must exist in jellyfin.ts')
})

// 8. Music Engine Core Services & Types
test('Music engine types and services exist with Audius and LRCLIB integration', () => {
  assert(fs.existsSync('src/types/music.ts'), 'src/types/music.ts must exist')
  assert(fs.existsSync('src/services/music/audius.ts'), 'audius.ts must exist')
  assert(fs.existsSync('src/services/music/lyrics.ts'), 'lyrics.ts must exist')
  assert(fs.existsSync('src/services/music/archive.ts'), 'archive.ts must exist')
  assert(fs.existsSync('src/services/music/experimental.ts'), 'experimental.ts must exist')
  assert(fs.existsSync('src/services/music/index.ts'), 'index.ts must exist')

  const audiusContent = fs.readFileSync('src/services/music/audius.ts', 'utf8')
  assert(audiusContent.includes('searchAudiusTracks'), 'searchAudiusTracks must exist')
  assert(audiusContent.includes('getAudiusTrending'), 'getAudiusTrending must exist')

  const lyricsContent = fs.readFileSync('src/services/music/lyrics.ts', 'utf8')
  assert(lyricsContent.includes('parseLrc'), 'parseLrc timestamp parser must exist')
  assert(lyricsContent.includes('fetchLyrics'), 'fetchLyrics must query LRCLIB')

  const expContent = fs.readFileSync('src/services/music/experimental.ts', 'utf8')
  assert(expContent.includes('PROVIDER_REGISTRY'), 'PROVIDER_REGISTRY must exist')
  assert(expContent.includes('EXPERIMENTAL_PROVIDERS'), 'EXPERIMENTAL_PROVIDERS alias must exist')
})

// 9. Music Context and Playback Engine
test('MusicContext provides persistent global audio engine with video anti-conflict', () => {
  assert(fs.existsSync('src/context/MusicContext.tsx'), 'MusicContext.tsx must exist')
  const ctxContent = fs.readFileSync('src/context/MusicContext.tsx', 'utf8')
  assert(ctxContent.includes('MusicPlayerProvider'), 'MusicPlayerProvider must exist')
  assert(ctxContent.includes('useMusic'), 'useMusic hook must exist')
  assert(ctxContent.includes('stark:video-play'), 'Anti-conflict video-play listener must exist')
  assert(ctxContent.includes('navigator.mediaSession'), 'Media Session API must be implemented')
  assert(ctxContent.includes('deletePlaylist'), 'deletePlaylist must exist')
  assert(ctxContent.includes('playTrack'), 'playTrack must exist')
})

// 10. Music UI Components and Routes
test('Music UI components, page, and navigation routes are wired up', () => {
  assert(fs.existsSync('src/components/music/MusicMiniPlayer.tsx'), 'MusicMiniPlayer.tsx must exist')
  assert(fs.existsSync('src/components/music/MusicPlayerExpanded.tsx'), 'MusicPlayerExpanded.tsx must exist')
  assert(fs.existsSync('src/components/music/MusicTrackCard.tsx'), 'MusicTrackCard.tsx must exist')
  assert(fs.existsSync('src/components/music/MusicTrackRow.tsx'), 'MusicTrackRow.tsx must exist')
  assert(fs.existsSync('src/pages/MusicPage.tsx'), 'MusicPage.tsx must exist')

  const sectionsContent = fs.readFileSync('src/lib/sections.ts', 'utf8')
  assert(sectionsContent.includes("'music'"), 'sections.ts must include music')

  const landingContent = fs.readFileSync('src/pages/LandingPage.tsx', 'utf8')
  assert(landingContent.includes('/music'), 'LandingPage must include /music')

  const appContent = fs.readFileSync('src/App.tsx', 'utf8')
  assert(appContent.includes('<Route path="/music" element={<MusicPage />} />'), 'App.tsx must register /music route')
  assert(appContent.includes('<MusicPlayerProvider>'), 'App.tsx must mount MusicPlayerProvider')
  assert(appContent.includes('<MusicMiniPlayer />'), 'App.tsx must mount MusicMiniPlayer')
})

console.log(`\nVerification complete: ${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
