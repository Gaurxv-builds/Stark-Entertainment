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

// 8. Music Engine Core Services & Types (JioSaavn & Piped)
test('Music engine types and services exist with JioSaavn and Piped integration (Audius removed)', () => {
  assert(fs.existsSync('src/types/music.ts'), 'src/types/music.ts must exist')
  assert(!fs.existsSync('src/services/music/audius.ts'), 'audius.ts must be deleted')
  assert(fs.existsSync('src/services/music/saavn.ts'), 'saavn.ts must exist')
  assert(fs.existsSync('src/services/music/piped.ts'), 'piped.ts must exist')
  assert(fs.existsSync('src/services/music/lyrics.ts'), 'lyrics.ts must exist')
  assert(fs.existsSync('src/services/music/archive.ts'), 'archive.ts must exist')
  assert(fs.existsSync('src/services/music/experimental.ts'), 'experimental.ts must exist')
  assert(fs.existsSync('src/services/music/index.ts'), 'index.ts must exist')

  const saavnContent = fs.readFileSync('src/services/music/saavn.ts', 'utf8')
  assert(saavnContent.includes('searchSaavnTracks'), 'searchSaavnTracks must exist')
  assert(saavnContent.includes('getSaavnTrending'), 'getSaavnTrending must exist')

  const pipedContent = fs.readFileSync('src/services/music/piped.ts', 'utf8')
  assert(pipedContent.includes('searchPipedTracks'), 'searchPipedTracks must exist')
  assert(pipedContent.includes('getPipedTrending'), 'getPipedTrending must exist')

  const indexContent = fs.readFileSync('src/services/music/index.ts', 'utf8')
  assert(indexContent.includes('zk:music:providers:v2'), 'index.ts must use zk:music:providers:v2 storage key')
  assert(!indexContent.includes('audius'), 'index.ts must not reference audius')

  const typesContent = fs.readFileSync('src/types/music.ts', 'utf8')
  assert(!typesContent.includes('audius'), 'types/music.ts must not reference audius')
  assert(typesContent.includes('saavn: boolean'), 'MusicProviderSettings must support saavn')
  assert(typesContent.includes('piped: boolean'), 'MusicProviderSettings must support piped')

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

// 11. Profile Visibility and Synchronization After Stark Gate Login
test('ProfileCard is rendered on LandingPage and profile resets on logout', () => {
  const landingContent = fs.readFileSync('src/pages/LandingPage.tsx', 'utf8')
  assert(landingContent.includes('<ProfileCard />'), 'LandingPage must render ProfileCard')
  assert(landingContent.includes('useProfile'), 'LandingPage must subscribe to useProfile')

  const profileContent = fs.readFileSync('src/lib/profile.ts', 'utf8')
  assert(profileContent.includes('resetProfile'), 'profile.ts must export resetProfile')

  const starkAuthContent = fs.readFileSync('src/lib/starkAuth.tsx', 'utf8')
  assert(starkAuthContent.includes('resetProfile()'), 'starkAuth.tsx lock must call resetProfile')
  assert(starkAuthContent.includes('saveProfile({ name: authUser'), 'unlock must sync authenticated user to profile')

  const profileCardContent = fs.readFileSync('src/components/ProfileCard.tsx', 'utf8')
  assert(profileCardContent.includes('useStarkAuth'), 'ProfileCard must subscribe to useStarkAuth')
  assert(profileCardContent.includes('authUser'), 'ProfileCard must display authenticated user')
})

// 12. Ebook Read Aloud: Strict Six Indian Voices and Language Detection
test('Read Aloud supports strictly six Indian voices with language detection and phonetics', () => {
  assert(fs.existsSync('src/types/tts.ts'), 'src/types/tts.ts must exist')
  assert(fs.existsSync('src/services/tts/voices.ts'), 'voices.ts must exist')
  assert(fs.existsSync('src/services/tts/languageDetector.ts'), 'languageDetector.ts must exist')
  assert(fs.existsSync('src/services/tts/phonetics.ts'), 'phonetics.ts must exist')
  assert(fs.existsSync('src/services/tts/chunker.ts'), 'chunker.ts must exist')
  assert(fs.existsSync('src/services/tts/engine.ts'), 'engine.ts must exist')
  assert(fs.existsSync('src/components/ebooks/ReadAloudBar.tsx'), 'ReadAloudBar.tsx must exist')

  const voicesContent = fs.readFileSync('src/services/tts/voices.ts', 'utf8')
  assert(voicesContent.includes('hi-IN-female'), 'hi-IN-female voice required')
  assert(voicesContent.includes('hi-IN-male'), 'hi-IN-male voice required')
  assert(voicesContent.includes('en-IN-female'), 'en-IN-female voice required')
  assert(voicesContent.includes('en-IN-male'), 'en-IN-male voice required')
  assert(voicesContent.includes('sa-IN-female'), 'sa-IN-female voice required')
  assert(voicesContent.includes('sa-IN-male'), 'sa-IN-male voice required')
  assert(!voicesContent.includes('en-US'), 'Must strictly forbid en-US')
  assert(!voicesContent.includes('en-GB'), 'Must strictly forbid en-GB')

  const barContent = fs.readFileSync('src/components/ebooks/ReadAloudBar.tsx', 'utf8')
  assert(barContent.includes('optgroup label="Hindi (India)"'), 'Selector must group Hindi (India)')
  assert(barContent.includes('optgroup label="English (India)"'), 'Selector must group English (India)')
  assert(barContent.includes('optgroup label="Sanskrit (India)"'), 'Selector must group Sanskrit (India)')

  const serverContent = fs.readFileSync('server/handler.js', 'utf8')
  assert(serverContent.includes('/api/tts/voices'), 'Server must provide /api/tts/voices')
  assert(serverContent.includes('/api/tts/synthesize'), 'Server must provide /api/tts/synthesize')

  const readerContent = fs.readFileSync('src/pages/EbookReaderPage.tsx', 'utf8')
  assert(readerContent.includes('<ReadAloudBar'), 'EbookReaderPage must mount ReadAloudBar')
  assert(readerContent.includes('TtsEngine'), 'EbookReaderPage must initialize TtsEngine')
})


test('Stark Subscription, Payment Portal & Access Management Verification', () => {
  // 1. Payment portal checks
  assert(fs.existsSync('payment-portal/index.html'), 'payment-portal/index.html must exist');
  const portalHtml = fs.readFileSync('payment-portal/index.html', 'utf8');
  assert(portalHtml.includes('paytmqr6qi789@ptys'), 'Portal must contain Paytm UPI ID paytmqr6qi789@ptys');
  assert(portalHtml.includes('payment_upi.png'), 'Portal must display Cloudinary UPI QR code');
  assert(portalHtml.includes('screenshotFileInput'), 'Portal must provide direct file upload input');
  assert(!portalHtml.includes('type="url"'), 'Portal must not ask for screenshot URL link');
  assert(portalHtml.includes('STARK-ORD-'), 'Portal must generate unique STARK-ORD reference');

  // 2. Server backend checks
  assert(fs.existsSync('server/subscription.js'), 'server/subscription.js must exist');
  const subServer = fs.readFileSync('server/subscription.js', 'utf8');
  assert(subServer.includes('9261746621'), 'Telegram bot token must be configured');
  assert(subServer.includes('895044844'), 'Admin chat ID must be 895044844');
  assert(subServer.includes('updates@gaurxv.eu.org'), 'Brevo sender updates@gaurxv.eu.org must be configured');

  const handlerContent = fs.readFileSync('server/handler.js', 'utf8');
  assert(handlerContent.includes('/api/subscription/submit-payment'), 'Handler must expose submit-payment route');
  assert(handlerContent.includes('/api/subscription/entitlement'), 'Handler must expose entitlement route');
  assert(handlerContent.includes('/api/admin/subscriptions'), 'Handler must expose admin subscriptions route');
  assert(handlerContent.includes('/api/admin/subscription/action'), 'Handler must expose admin action route');

  // 3. Frontend checks
  assert(fs.existsSync('src/components/SubscriptionModal.tsx'), 'SubscriptionModal.tsx must exist');
  assert(fs.existsSync('src/hooks/useEntitlement.ts'), 'useEntitlement.ts must exist');
  const adminContent = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8');
  assert(adminContent.includes('Subscription Management'), 'AdminPage must have Subscription Management tab');
  assert(adminContent.includes('Pending Payment Queue'), 'AdminPage must display Pending Payment Queue');
  const profileContent = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8');
  assert(profileContent.includes('Subscription & Access Pass'), 'ProfilePage must render Subscription & Access Pass section');
});

test('Multi-device Admin Authentication & Payment Queue Resilience', () => {
  const handlerContent = fs.readFileSync('server/handler.js', 'utf8');
  assert(handlerContent.includes('verifySupabaseToken'), 'Server handler must support Supabase JWT verification');
  assert(handlerContent.includes('X-Supabase-Auth'), 'Server handler must support X-Supabase-Auth header');
  assert(handlerContent.includes('X-Stark-Token'), 'Server handler must support X-Stark-Token header');

  const starkAuthContent = fs.readFileSync('src/lib/starkAuth.tsx', 'utf8');
  assert(starkAuthContent.includes('gaurxv_verse_sb_token'), 'starkAuth must preserve Supabase token');
  assert(starkAuthContent.includes('createClientToken'), 'starkAuth must export createClientToken');

  const adminContent = fs.readFileSync('src/pages/AdminPage.tsx', 'utf8');
  assert(adminContent.includes('getAdminHeaders'), 'AdminPage must use getAdminHeaders');
  assert(adminContent.includes('createClientToken'), 'AdminPage must auto-generate client tokens for admin');
  assert(adminContent.includes('subError'), 'AdminPage must track subError and show retry button');
  assert(adminContent.includes('subLoading'), 'AdminPage must handle subLoading gracefully');
});

test('Telegram Bot Direct Approval & In-Chat Action Engine', () => {
  const subContent = fs.readFileSync('server/subscription.js', 'utf8');
  assert(subContent.includes('handleTelegramWebhook'), 'subscription.js must export handleTelegramWebhook');
  assert(subContent.includes('answerTelegramCallbackQuery'), 'subscription.js must export answerTelegramCallbackQuery');
  assert(subContent.includes('editTelegramMessageCaption'), 'subscription.js must export editTelegramMessageCaption');
  assert(subContent.includes('approve:'), 'Inline keyboard must include approve callback');
  assert(subContent.includes('reject:'), 'Inline keyboard must include reject callback');
  assert(subContent.includes('approve_req:'), 'Inline keyboard must support account request approval');
  assert(subContent.includes('send_mail:'), 'Inline keyboard must support direct credentials email dispatch');
  assert(subContent.includes('/requests'), 'Bot must support /requests command');
  assert(subContent.includes('/create'), 'Bot must support /create command');
  assert(subContent.includes('/mail'), 'Bot must support /mail command');
  assert(subContent.includes('/stats'), 'Bot must support /stats command');
  assert(subContent.includes('findPaymentProof'), 'subscription.js must support flexible proof lookup');

  const handlerContent = fs.readFileSync('server/handler.js', 'utf8');
  assert(handlerContent.includes('/api/telegram/webhook'), 'Server handler must route /api/telegram/webhook');
  assert(handlerContent.includes('/api/telegram/setup-webhook'), 'Server handler must route /api/telegram/setup-webhook');
  assert(handlerContent.includes('/api/auth/request-account'), 'Server handler must route /api/auth/request-account');

  const gateContent = fs.readFileSync('src/components/StarkLoginGate.tsx', 'utf8');
  assert(gateContent.includes('text-center'), 'Subscription & Payment Portal text must be aligned in center');
});

console.log(`\nVerification complete: ${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
