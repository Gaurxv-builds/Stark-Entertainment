<div align="center">

<img src="docs/logo.svg" alt="Gaurxv Verse logo" width="112" height="112" />

# Gaurxv Verse ⎊

**Next-Gen Media Server & Reader**

*Stream anime, movies & series. Read manga, light novels & ebooks. Listen to high-fidelity ad-free music. Zero tracking, zero ads, zero compromise.*

[![Repository](https://img.shields.io/badge/GitHub-Stark--Entertainment-00E5FF?style=for-the-badge&logo=github)](https://github.com/Gaurxv-builds/Stark-Entertainment)
[![Branch](https://img.shields.io/badge/Branch-stark--features-7c3aed?style=for-the-badge&logo=git)](https://github.com/Gaurxv-builds/Stark-Entertainment/tree/stark-features)
[![Upstream](https://img.shields.io/badge/Upstream-Zenkai-8b949e?style=for-the-badge&logo=git)](https://github.com/Bortus-AI/Zenkai)
[![License: MIT](https://img.shields.io/badge/License-MIT-00E5FF?style=for-the-badge)](LICENSE)

[**Live Web App**](https://verse.gaurxv.eu.org) ·
[**Android App**](https://github.com/Nyyrox/zenkai/releases/latest) ·
[**Telegram**](https://t.me/Stark_X_Backup) ·
[**Portfolio**](https://gaurxv.eu.org) ·
[**Report an Issue**](https://github.com/Gaurxv-builds/Stark-Entertainment/issues)

<br />

</div>

---

## Overview

**Gaurxv Verse ⎊** is an all-in-one entertainment universe, digital library, and next-generation media server frontend. Designed with a deep charcoal (`#0a0a0c`), electric cyan (`#00E5FF`), and high-contrast monochrome aesthetic, it unifies **six distinct entertainment pillars** into a single, blazing-fast Progressive Web Application (PWA).

### The Six Pillars of Verse

| Section | Route | Theme Accent | Capabilities |
| :--- | :--- | :--- | :--- |
| **Anime** (アニメ) | `/anime` · `/home` | Electric Cyan | Trending, popular, top-rated feeds, live airing schedule, sub/dub switching, custom CinePlayer with HLS.js, WebGPU-powered Anime4K upscaling, and multi-audio stream support. |
| **Movies & TV** (映画) | `/movies` | Monochrome | Comprehensive TMDB catalogue with search, high-res posters, cast details, backdrops, and multi-source streaming resolvers. |
| **Manga** (漫画) | `/manga` | Indigo | Multi-source reader (ComicK, Manhua, Asura Scans, WeebCentral, MangaDex) with customizable layouts (Webtoon, Left-to-Right, Right-to-Left). |
| **Light Novels** (小説) | `/novel` | Amber | Clean, distraction-free light novel and web novel reader with chapter caching and typography customization. |
| **Ebooks & Documents** (電子書籍) | `/ebooks` | Emerald | Project Gutenberg & Open Library indexing with native **EPUB (`EpubReader`)** and **PDF (`PdfReader`)** readers, progress tracking, and **Indian Voice Read Aloud** (strictly 6 voices across Hindi, Indian English, and Sanskrit). |
| **Music Engine** (音楽) | `/music` | Violet | Free, high-fidelity music streaming powered by **JioSaavn** (320kbps AAC audio & 500x500 artwork) and **YouTube (Piped)**, centered floating miniplayer, dedicated queue management, and anti-conflict video pausing. |

---

## Key Features & Architecture

### 1. Built-in Stark Gate Authentication & Unified Navigation
- **Zero-Cost Server-Verified Auth:** Cryptographic passkey authentication with server verification (`/api/auth`), animated Lottie security gate, and multi-user credential storage.
- **Immediate Profile Synchronization:** Profiles appear automatically in the navigation header and landing page upon successful login without manual refresh.
- **Unified Navigation Architecture (`NavbarActions`):** Guarantees a strictly consistent action layout across Home, Anime, Movies, Manga, Novels, Ebooks, and Music (`Home → Admin [admins only] → Theme toggle → Logout → Profile/avatar`) with uniform 36px sizing and responsive breakpoints.
- **Admin Console (`/admin`):** Secure administrative management for credential provisioning, device synchronization, and privacy-preserving user management.

### 2. Cross-Device PostgreSQL Sync (Supabase)
- **Hybrid Cloud / Offline Storage:** Operates fully offline with zero database dependencies via `localStorage`, but seamlessly upgrades to cross-device PostgreSQL cloud sync when Supabase environment variables are provided.
- **JWT Ref Auto-Derivation & Sanitization:** Automatically extracts the true project reference directly from JWT anon keys, immunizing the application against environment variable URL typos.
- **Row-Level Security (RLS) & Verified Identity:** Links Stark Gate identities directly to authenticated Supabase users for secure, zero-leak multi-device sync across `user_profiles`, `user_library`, `user_reading_progress`, and `user_preferences`.
- **Cross-Device Session Auto-Healing & Dual-Token Provisioning:** Features a resilient multi-layer authentication fallback and recovery engine. Mobile and secondary devices auto-heal missing or corrupted Supabase Gotrue sessions on startup or profile mount via `/api/auth/verify`, synchronizing PostgreSQL RLS seamlessly without manual re-login.
- **Structured Health Diagnostics:** Real-time sync diagnostic pipeline (`diagnoseCloudSync()`) identifying network connectivity, auth sessions, table schemas, and RLS permissions with clear UI status hints.

### 3. Native Ebook Reader & Indian Voice Read Aloud
- **Dual Format Support:** High-performance native viewer for both `.epub` (via `epubjs`) and `.pdf` (via `pdfjs-dist`).
- **Continue Reading Shelf:** Automatically tracks reading progress, percent completed, and current chapter across devices.
- **Strictly Controlled 6 Indian TTS Voices:**
  | Language | Female Voice | Male Voice | Locale |
  | :--- | :--- | :--- | :--- |
  | **Hindi (India)** | Hindi (India) — Female | Hindi (India) — Male | `hi-IN` |
  | **English (India)** | English (India) — Female | English (India) — Male | `en-IN` |
  | **Sanskrit (India)** | Sanskrit (India) — Female | Sanskrit (India) — Male | `sa-IN` |
  *Includes automatic EPUB metadata language detection, Devanagari verse chunking (danda `।` and double-danda `॥`), and phonetic fallback mappings.*

### 4. Gaurxv Verse Music Engine
- **JioSaavn Gateway:** Native 320kbps / 160kbps AAC direct streaming audio, 500x500 high-resolution album artwork, Bollywood, regional Indian (Hindi, Punjabi, Tamil, Telugu, etc.), and trending global tracks.
- **Centered Floating Miniplayer:** Sits cleanly centered at the bottom of the viewport with responsive progress bar scrubbing, favorites, and instant playback controls.
- **Dedicated Queue Management:** High-performance expanded queue drawer to view upcoming tracks, remove individual entries, or clear the queue with zero latency.
- **Piped (YouTube) Gateway:** Secondary privacy-respecting audio resolver with automated instance failover and request timeout guardrails.
- **Persistent Global Audio Engine:** Global playback that continues uninterrupted as you browse. Features intelligent anti-conflict handling that automatically pauses music when you start watching anime or movies.
- **Customizable Provider Settings:** Toggle individual music providers on or off in the provider drawer (`localStorage: zk:music:providers:v2`).

### 5. Progressive Web App (PWA) & Instant Update Engine
- **Installable Desktop & Mobile App:** Install directly to your home screen or desktop via Chrome, Safari, Edge, or Firefox.
- **Auto-Update & Instant Refresh:** Service Worker detects newly deployed builds in the background, claims clients immediately (`skipWaiting`, `clientsClaim`), and reloads on `controllerchange` to guarantee zero stale cached versions.

### 6. CinePlayer & Streaming Resolvers
- **Marvel-Themed Resolvers:** High-speed streaming engine featuring Iron Man 4K, Scarlet Witch, Captain America, Thor, Hulk, and Spider-Man providers.
- **Anime4K Realtime Upscaling:** Hardware-accelerated WebGPU/WebGL shader pipelines for upscaling animation directly in the browser.
- **Verse Shield:** In-house cryptographic proof-of-work challenge protecting streaming gateways without annoying third-party captchas.
- **SSRF Hardening:** Strict server-side request forgery filtering blocking loopbacks, internal clouds, and private subnets.

### 7. Subscription & Access Management Engine (Stark Pass)
- **Access Policies & Real-time Ticker:** 30-minute free trial countdown initiated upon first login (server-enforced with zero client clock manipulation), ₹29 / 30-day manual renewals, custom durations, and lifetime administrator clearance.
- **Standalone Payment Portal ([`payments.gaurxv.eu.org`](https://payments.gaurxv.eu.org)):** Modern payment portal styled with Montserrat typography and obsidian glassmorphism. Features unclipped dynamic QR code, Paytm UPI ID (`paytmqr6qi789@ptys`), mobile intent launchers (Paytm, PhonePe, GPay), and direct screenshot file upload.
- **Direct Bot Delivery & In-Chat Action Engine (`@JarvisXPay_Bot`):** Submits receipt screenshots and account clearance requests directly to Telegram admin chat (`895044844`) with one-tap inline callback buttons (`[✅ Approve (+30 Days)]`, `[⚡ Approve & Generate Passcode]`, `[📧 Send Credentials Email]`), live status editing, and in-chat slash commands (`/pending`, `/requests`, `/approve`, `/reject`, `/create`, `/mail`, `/status`, `/stats`).
- **Brevo Email Notifications (`updates@gaurxv.eu.org`):** Automatic delivery of receipt submission acknowledgements, activation confirmations with computed expiration dates, and review feedback.
- **Subscription & Access Center (`/admin`):** Live metrics overview (Pending, Active, Trial, Lifetime, Revenue), real-time pending queue with inline approve/reject, and auto-healing dual-token authentication (Stark HMAC + Supabase JWT) across multiple devices.

---

## Quick Start

### Prerequisites
- **Node.js:** `v20.19.0` or higher (`v22 LTS` recommended)
- **npm:** Included with Node.js

```bash
# 1. Clone the repository
git clone https://github.com/Gaurxv-builds/Stark-Entertainment.git
cd Stark-Entertainment

# 2. Switch to the feature branch
git checkout stark-features

# 3. Install dependencies
npm install

# 4. Start local development server
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser.

---

## NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite development server with API middleware mounted in-process. |
| `npm run build` | Type-checks with TypeScript (`tsc --noEmit`) and compiles the static site into `dist/`. |
| `npm test` | Runs the automated 12-suite verification test (`node tests/verification.mjs`). |
| `npm run preview` | Previews the compiled production build locally. |
| `npm run build:server` | Compiles the server handler bundle into `dist-server/handler.js`. |
| `npm run build:selfhost` | Compiles both client and server bundles for standalone Node deployment. |
| `npm start` | Runs the standalone Node production server (`serve.js`). |

---

## Configuration & Environment Variables

Copy `.env.example` to `.env` to customize settings:

| Variable | Scope | Purpose | Default |
| :--- | :--- | :--- | :--- |
| `VITE_SITE_URL` | Client / Build | Canonical site URL for metadata, share cards, and sitemaps. | `https://verse.gaurxv.eu.org` |
| `VITE_SUPABASE_URL` | Client / Build | *(Optional)* Supabase project URL for cross-device PostgreSQL sync. | Unset (local fallback) |
| `VITE_SUPABASE_ANON_KEY` | Client / Build | *(Optional)* Supabase public anonymous API key. | Unset (local fallback) |
| `VITE_ANILIST_CLIENT_ID` | Client / Build | AniList developer client ID for OAuth progress sync. | `53784` |
| `VITE_API_BASE` | Client / Build | Remote backend origin if hosted on an external domain. | `""` (relative) |
| `TELEGRAM_BOT_TOKEN` | Server Runtime | Telegram bot token for alert dispatch & in-bot actions (`@JarvisXPay_Bot`). | Configured |
| `TELEGRAM_ADMIN_CHAT_ID` | Server Runtime | Telegram admin chat ID receiving receipts and action callbacks (`895044844`). | `895044844` |
| `BREVO_API_KEY` | Server Runtime | Brevo SMTP/REST API key for transactional emails (`updates@gaurxv.eu.org`). | Configured |
| `SHIELD_SECRET` | Server Runtime | Secret key for proof-of-work verification. If omitted, shield is off. | Unset |
| `GITHUB_TOKEN` | Server Runtime | GitHub PAT to prevent rate-limiting on Android release checking. | Unset |
| `SITE_PASSWORD` | Node Server | Password for the self-hosted server (`serve.js`). | Unset (public) |
| `HOST` | Node Server | Host binding address for `serve.js`. | `0.0.0.0` |
| `PORT` | Node Server | Port for `serve.js`. | `4180` |

---

## Routing Matrix

| Route | Page Component | Purpose |
| :--- | :--- | :--- |
| `/` | `LandingPage` | Universe Hub: Gate login status, profile display, and 6 media pillars entry points. |
| `/home` | `LandingPage` | Universe Hub: Gate login status, profile display, and 6 media pillars entry points. |
| `/anime` | `HomePage` | Anime home feed with trending, top rated, and current season. |
| `/trending` · `/popular` · `/top` | `CatalogPage` | Infinite-scroll ranked anime collections with comprehensive filters. |
| `/browse` | `CatalogPage` | Advanced anime search by genre, season, format, and status. |
| `/schedule` | `SchedulePage` | Live airing calendar synchronized to user's local timezone. |
| `/anime/:id` · `/mal/:id` | `DetailsPage` | Comprehensive anime details, characters, relations, and episodes. |
| `/watch/:id` | `WatchPage` | Immersive full-bleed anime player with Anime4K and multi-audio. |
| `/movies` · `/movies/browse` | `MoviesHomePage` | Film and television catalogue powered by TMDB. |
| `/movies/:type/:id` | `MovieDetailsPage` | Movie and series details, trailers, cast, and recommendations. |
| `/movies/watch/:type/:id` | `MovieWatchPage` | Multi-source movie & TV streaming player. |
| `/manga` · `/manga/:id` | `MangaHomePage` | Manga catalogue across five reader sources. |
| `/manga/:id/read/:chapterId` | `MangaReaderPage` | Full-screen multi-mode manga reader (Webtoon / LTR / RTL). |
| `/novel` · `/novel/:source/:slug` | `NovelHomePage` | Light novel and web novel catalogue. |
| `/novel/:source/:slug/read/:chapter` | `NovelReaderPage` | Focused, clean text reader with night mode and chapter navigation. |
| `/ebooks` | `EbooksHomePage` | Digital ebook library with Project Gutenberg & Open Library indexing. |
| `/ebooks/read/:id` | `EbookReaderPage` | Full-screen EPUB/PDF reader with strict 6-voice Indian Read Aloud. |
| `/music` | `MusicPage` | Ad-free music discovery, search, centered miniplayer, and audio player engine. |
| `/list` · `/profile` | `ListPage` / `ProfilePage` | User profile, watchlist, continue-reading shelf, and AniList / Supabase sync. |
| `/admin` | `AdminPage` | Dual-tab admin console: Subscription & Access Center and Credentials Directory. |
| `/app` | `AppPage` | Android application release notes, APK downloads, and updates. |
| `https://payments.gaurxv.eu.org/` | Standalone Portal | Standalone Montserrat glassmorphic payment portal with unclipped QR, UPI intent, and receipt upload. |

---

## Testing & Verification

The repository includes an end-to-end automated test harness covering all major subsystems:

```bash
node tests/verification.mjs
```

**Test Coverage (15 Subsystems):**
1. Supabase Client & Configuration Verification
2. SQL Migration & Row Level Security (RLS) Schema Integrity
3. Cross-Device Cloud Sync Module
4. Native EPUB & PDF Reader Components
5. SSRF Security Guardrails & Domain Filtering
6. PWA Offline Caching & Manifest
7. Media Connectors (Trakt, Jellyfin, Komga)
8. Music Engine (JioSaavn & Piped Resolvers, Audius Absence)
9. Global Persistent Audio Engine & Anti-Conflict Logic
10. Music UI Components, Hero & Category Shelves
11. Stark Gate Profile Display & Session Persistence
12. Strict Six Indian Voice TTS Engine & Language Detection
13. Stark Subscription, Payment Portal & Access Management Verification
14. Multi-device Admin Authentication & Payment Queue Resilience
15. Telegram Bot Direct Approval & In-Chat Action Engine

---

## Contributing

1. Fork the repository.
2. Create your feature branch off `stark-features`:
   ```bash
   git checkout -b feat/my-feature stark-features
   ```
3. Run the verification tests:
   ```bash
   node tests/verification.mjs
   ```
4. Verify your build passes type checking:
   ```bash
   npm run build
   ```
5. Commit your changes:
   ```bash
   git commit -m "feat: add my new feature"
   ```
6. Push to your branch and open a Pull Request targeting `stark-features`.

---

## License & Disclaimer

- **License:** Distributed under the [MIT License](LICENSE).
- **Disclaimer:** Gaurxv Verse does not host, upload, or store any video, audio, ebook, manga, or novel media files. It functions exclusively as a client-side interface linking to third-party public indexing services and APIs. All artwork, trademarks, and titles belong to their respective copyright holders.
- **Upstream:** Gaurxv Verse is forked from [Bortus-AI/Zenkai](https://github.com/Bortus-AI/Zenkai) (originally created by [Nyyrox](https://github.com/Nyyrox)).
