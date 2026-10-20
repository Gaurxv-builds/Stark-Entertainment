<div align="center">

<img src="docs/logo.svg" alt="Gaurxv Verse logo" width="112" height="112" />

# Gaurxv Verse ⎊

**Next-Gen Media Server**

*Stream anime & movies. Read manga & light novels. Track it all in one unified, futuristic universe.*

[![Repository](https://img.shields.io/badge/GitHub-Stark--Entertainment-00E5FF?style=for-the-badge&logo=github)](https://github.com/Gaurxv-builds/Stark-Entertainment)
[![Upstream](https://img.shields.io/badge/Upstream-Zenkai-8b949e?style=for-the-badge&logo=git)](https://github.com/Bortus-AI/Zenkai)
[![License: MIT](https://img.shields.io/badge/License-MIT-00E5FF?style=for-the-badge)](LICENSE)

[**Explore**](https://gaurxv-verse.pages.dev) ·
[**Download Android App**](https://github.com/Nyyrox/zenkai/releases/latest) ·
[**Report an Issue**](https://github.com/Gaurxv-builds/Stark-Entertainment/issues) ·
[**Telegram**](https://t.me/StreamverseOfc) ·
[**Discord**](https://discord.gg/kHxHzZtH7)

<br />

</div>

---

## Overview

**Gaurxv Verse ⎊** is an all-in-one entertainment client and next-generation media server frontend. Designed with a deep charcoal (`#0a0a0c`), electric cyan (`#00E5FF`), and monochrome palette, it unifies four media pillars into a single responsive application:

| Section | Theme Accent | Capabilities |
| :--- | :--- | :--- |
| **Anime** (アニメ) | Electric Cyan | Trending, popular, top-rated feeds, live airing schedule, sub/dub switching, custom CinePlayer with HLS, Anime4K upscaling, and multi-audio stream support. |
| **Movies & TV** (映画) | Monochrome | Full TMDB catalogue with search, high-res posters, cast info, backdrops, and multi-source streaming providers. |
| **Manga** (漫画) | Indigo | Five reader sources (ComicK, Manhua, Asura Scans, WeebCentral, MangaDex) with customizable reading modes (webtoon, LTR, RTL). |
| **Novels** (小説) | Amber | Distraction-free light novel and web novel reader with chapter caching and typography customization. |

---

## Key Features

- **Zero-Database Architecture:** Your watch history, reading position, and watchlist live locally in your browser's `localStorage` via reactive, multi-tab observable stores.
- **AniList Two-Way Sync:** Connect your AniList account with an implicit OAuth flow to seamlessly sync progress and watchlist across devices.
- **CinePlayer Engine:** In-house video player featuring HLS.js adaptive streaming, WebGPU-powered Anime4K upscaling, subtitle selection, and audio language toggling.
- **Unified Media Server (Marvel-themed Providers):** High-speed streaming resolvers (Iron Man 4K, Scarlet Witch, Captain America, Thor, Hulk, Spider-Man, and more).
- **Verse Shield:** Optional cryptographic proof-of-work challenge and rate-limiting gateway protecting backend streaming workers without third-party captchas.
- **10-Foot TV Mode:** Built-in D-pad and smart TV navigation support for Android TV, Fire TV, and modern web browsers (`?tv=1`).

---

## Quick Start

### Prerequisites
- **Node.js:** `v20.19.0` or higher (`v22 LTS` recommended)
- **npm:** Included with Node.js

```bash
# Clone the repository
git clone https://github.com/Gaurxv-builds/Stark-Entertainment.git
cd Stark-Entertainment

# Install dependencies
npm install

# Start development server (serves client + in-process API middleware)
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser.

---

## NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite development server with API middleware mounted in-process. |
| `npm run build` | Type-checks with TypeScript (`tsc --noEmit`) and compiles the static site to `dist/`. |
| `npm run preview` | Previews the compiled production build locally. |
| `npm run build:server` | Builds the SSR server bundle to `dist-server/handler.js`. |
| `npm run build:selfhost` | Compiles both client and server bundles for standalone Node deployment. |
| `npm start` | Runs the standalone Node production server (`serve.js`). |

---

## Configuration

Copy `.env.example` to `.env` to customize settings:

| Variable | Scope | Purpose | Default |
| :--- | :--- | :--- | :--- |
| `VITE_SITE_URL` | Client / Build | Canonical site URL for metadata, share cards, and sitemaps. | `https://gaurxv-verse.pages.dev` |
| `VITE_ANILIST_CLIENT_ID` | Client / Build | AniList developer client ID for OAuth authentication. | `53784` |
| `VITE_API_BASE` | Client / Build | Remote backend origin if hosted on an external domain. | `""` (relative) |
| `SHIELD_SECRET` | Server Runtime | Secret key for proof-of-work verification. If omitted, shield is off. | Unset |
| `GITHUB_TOKEN` | Server Runtime | GitHub PAT to prevent rate-limiting on Android release checking. | Unset |
| `SITE_PASSWORD` | Node Server | Password for the self-hosted server (`serve.js`). | Unset (public) |
| `HOST` | Node Server | Host address for `serve.js`. | `0.0.0.0` |
| `PORT` | Node Server | Port for `serve.js`. | `4180` |

---

## Project Structure

```
src/
  pages/        Portal (Landing), Home, Details, Watch, Manga, Novel, Movies, Profile, App
  components/   Modular UI components (CinePlayer, Navbar, MobileDock, ShieldGate, etc.)
  services/     API connectors (AniList GraphQL, TMDB, Jikan, Novel, Manga, Release)
  hooks/        Custom React hooks (useAsync, useTmdb, useEpisodes, useShowcase, etc.)
  lib/          Core utilities, state stores (brand.ts, library.ts, providers.ts, sections.ts)
server/         Web-standard API handler shared across dev and production (server/handler.js)
functions/      Cloudflare Pages Functions integration (functions/api/[[route]].js)
public/         Static assets, web manifest, favicon, OpenGraph cards, mapping tables
docs/           Branding and logo assets
serve.js        Standalone Node.js production server with static hosting & API routing
gate.js         HMAC-SHA256 password gate for private server instances
```

---

## Routing Overview

| Route | Page | Purpose |
| :--- | :--- | :--- |
| `/` | `LandingPage` | Entertainment Hub: Dive into Anime, Manga, Novels, or Movies. |
| `/home` | `HomePage` | Anime home feed with trending, top rated, and current season. |
| `/trending` · `/popular` · `/top` | `CatalogPage` | Infinite-scroll ranked anime collections with filters. |
| `/browse` | `CatalogPage` | Advanced search by genre, season, format, and status. |
| `/schedule` | `SchedulePage` | Airing calendar aligned to user local timezone. |
| `/anime/:id` · `/mal/:id` | `DetailsPage` | Comprehensive anime overview, characters, staff, and relations. |
| `/watch/:id` | `WatchPage` | Immersive full-bleed anime player. |
| `/movies` · `/movies/browse` | `MoviesHomePage` | Film and television catalogue powered by TMDB. |
| `/movies/:type/:id` | `MovieDetailsPage` | Movie and series details, trailers, and cast. |
| `/movies/watch/:type/:id` | `MovieWatchPage` | Multi-provider movie & TV streaming player. |
| `/manga` · `/manga/:id` | `MangaHomePage` | Manga catalog across five reader sources. |
| `/manga/:id/read/:chapterId` | `MangaReaderPage` | Full-screen multi-mode manga reader. |
| `/novel` · `/novel/:source/:slug` | `NovelHomePage` | Light novel and web novel catalog. |
| `/novel/:source/:slug/read/:chapter` | `NovelReaderPage` | Focused, clean text reader with night mode. |
| `/list` · `/profile` | `ListPage` / `ProfilePage` | Local library, watchlist, AniList sync, and preference controls. |
| `/app` | `AppPage` | Android application release notes, APK downloads, and updates. |

---

## Contributing

1. Fork the repository.
2. Create your feature branch: `git checkout -b feat/my-feature`
3. Verify your changes pass type checks: `npm run build`
4. Commit your changes: `git commit -m "feat: add feature"`
5. Push to your branch and open a Pull Request.

---

## License & Disclaimer

- **License:** Distributed under the [MIT License](LICENSE).
- **Disclaimer:** Gaurxv Verse does not host, upload, or store any video, audio, manga, or novel media files. It functions exclusively as a client-side interface linking to third-party public indexing services and APIs. All artwork, trademarks, and titles belong to their respective copyright holders.
- **Upstream:** Gaurxv Verse is forked from [Bortus-AI/Zenkai](https://github.com/Bortus-AI/Zenkai) (originally created by [Nyyrox](https://github.com/Nyyrox)).
