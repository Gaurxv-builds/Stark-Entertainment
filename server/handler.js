// One Web-standard handler shared by Cloudflare Pages Functions and the Vite dev server.
// handle(request) -> Response | null (null = not an API route)
import { resolveDirectStreamWorker } from "./direct-stream.js";
import { extractAnimeSaltPlayer } from "./animesalt.js";
import { resolveAcdn } from "./acdn.js";
import { validateProxyUrl } from "./ssrf.js";
import { shield } from "./shield.js";
import novelEngine from "./novel.js";
import * as manga from "./manga.js";
import { searchSaavn, getTrendingSaavn, searchPiped, getTrendingPiped, resolvePipedStream } from "./music.js";
import {
  submitPaymentProof,
  getUserEntitlement,
  getAdminSubscriptionsData,
  handleAdminSubscriptionAction,
  handleAccountRequest,
} from "./subscription.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TMDB = "https://aniversee.vercel.app/api/tmdb";
const ANIBRIDGE = "https://anibridge.eliasbenb.dev/api/mappings?source.descriptor=anilist:";
const ARM = "https://arm.haglund.dev/api/v2/ids?source=anilist&id=";
const OPENSUBS = "https://opensubtitles-v3.strem.io/subtitles";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST, PUT, DELETE",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

const json = (data, status = 200, ttl = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": ttl ? `public, max-age=${ttl}` : "no-store",
    },
  });

/* ---------- tiny TTL memo (per isolate / dev process) ---------- */
const memo = new Map();
async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v;
  const v = await fn();
  if (v) memo.set(key, { at: Date.now(), v });
  return v;
}

const getJson = async (url, init = {}) => {
  const r = await fetch(url, { ...init, headers: { Accept: "application/json", "User-Agent": UA, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

/* ====================================================================
 * AniBridge mapping (AniList -> MAL / TMDB / TVDB / IMDb / AniDB), ARM fallback
 * ==================================================================== */
function parseMapping(data, anilistId) {
  const out = { anilist: anilistId, mal: null, tmdb: null, tvdb: null, imdb: null, anidb: null };
  const seen = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === "string") {
      if (/^[a-z_]+:[^\s]+$/i.test(v)) seen.push(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(data);
  for (const d of seen) {
    const [provider, id, scope] = d.split(":");
    const p = provider.toLowerCase();
    const season = scope && /^s\d+$/i.test(scope) ? parseInt(scope.slice(1), 10) : null;
    if ((p === "mal" || p === "myanimelist") && !out.mal) out.mal = Number(id) || null;
    else if (p.startsWith("tmdb") && !out.tmdb) out.tmdb = { id: Number(id), type: p.includes("movie") ? "movie" : "tv", season };
    else if (p.startsWith("tvdb") && !out.tvdb) out.tvdb = Number(id) || null;
    else if (p.startsWith("imdb") && !out.imdb) out.imdb = id;
    else if (p === "anidb" && !out.anidb) out.anidb = Number(id) || null;
  }
  return out;
}

const mapOf = (anilistId) =>
  cached(`map:${anilistId}`, 24 * 3600e3, async () => {
    try {
      const m = parseMapping(await getJson(ANIBRIDGE + anilistId), anilistId);
      if (m.mal || m.tmdb || m.imdb) return { ...m, source: "anibridge" };
    } catch {}
    try {
      const a = await getJson(ARM + anilistId);
      return {
        anilist: anilistId,
        mal: a.myanimelist ?? null,
        tmdb: a.themoviedb ? { id: a.themoviedb, type: a.type === "MOVIE" ? "movie" : "tv", season: a["themoviedb-season"] ?? null } : null,
        tvdb: a.thetvdb ?? null,
        imdb: a.imdb ?? null,
        anidb: a.anidb ?? null,
        source: "arm",
      };
    } catch {}
    return null;
  });

/* ====================================================================
 * TMDB details + artwork (through the same aniversee.vercel.app proxy)
 * ==================================================================== */
const cleanTitle = (t = "") =>
  t
    .replace(/\s*\(\d{4}\)\s*$/g, "")
    .replace(/\s*(Final Season|Season\s+\d+|\d+(st|nd|rd|th)\s+Season|Cour\s+\d+|Part\s+\d+)\s*$/gi, "")
    .replace(/\s*:\s*$/, "")
    .trim();

async function tmdbFor(anilistId, title, format) {
  const map = anilistId ? await mapOf(anilistId) : null;
  let ref = map?.tmdb ? { id: map.tmdb.id, type: map.tmdb.type, season: map.tmdb.season } : null;

  if (!ref && title) {
    try {
      const want = format === "MOVIE" ? "movie" : "tv";
      const res = await getJson(`${TMDB}/search/multi?query=${encodeURIComponent(cleanTitle(title) || title)}`);
      const hit = res.results?.find((r) => r.media_type === want) || res.results?.find((r) => r.media_type === "tv" || r.media_type === "movie");
      if (hit) ref = { id: hit.id, type: hit.media_type, season: null };
    } catch {}
  }
  if (!ref) return { map, tmdb: null };

  const d = await getJson(
    `${TMDB}/${ref.type}/${ref.id}?language=en-US&append_to_response=images,videos,credits,external_ids,content_ratings,release_dates&include_image_language=en,null`,
  );

  const pngs = (d.images?.logos || []).filter((l) => l.file_path && !l.file_path.toLowerCase().endsWith(".svg"));
  const logo = pngs.sort((a, b) => (b.iso_639_1 === "en") - (a.iso_639_1 === "en") || b.vote_average - a.vote_average)[0]?.file_path ?? null;
  const textless = (d.images?.backdrops || []).filter((b) => !b.iso_639_1).sort((a, b) => b.vote_average - a.vote_average);
  const backdrops = (textless.length ? textless : d.images?.backdrops || []).slice(0, 6).map((b) => b.file_path);

  const certification =
    d.content_ratings?.results?.find((r) => r.iso_3166_1 === "US")?.rating ||
    d.release_dates?.results?.find((r) => r.iso_3166_1 === "US")?.release_dates?.find((x) => x.certification)?.certification ||
    null;
  const yt = (d.videos?.results || []).find((v) => v.site === "YouTube" && /trailer|teaser/i.test(v.type));

  return {
    map,
    tmdb: {
      id: ref.id,
      type: ref.type,
      season: ref.season,
      imdbId: d.external_ids?.imdb_id || map?.imdb || null,
      logo,
      backdrop: d.backdrop_path || backdrops[0] || null,
      backdrops,
      overview: d.overview || null,
      tagline: d.tagline || null,
      rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      votes: d.vote_count || null,
      certification,
      networks: (d.networks || d.production_companies || []).slice(0, 4).map((n) => n.name),
      status: d.status || null,
      language: d.original_language || null,
      seasons: d.number_of_seasons ?? null,
      episodes: d.number_of_episodes ?? null,
      firstAir: d.first_air_date || d.release_date || null,
      lastAir: d.last_air_date || null,
      runtime: d.episode_run_time?.[0] || d.runtime || null,
      cast: (d.credits?.cast || []).slice(0, 10).map((c) => ({ name: c.name, character: c.character, photo: c.profile_path })),
      trailer: yt ? yt.key : null,
    },
  };
}

/* ====================================================================
 * Subtitles (OpenSubtitles Stremio addon, keyed by IMDb id from TMDB/AniBridge)
 * ==================================================================== */
const LANGS = { eng: "English", spa: "Spanish", fre: "French", fra: "French", ger: "German", deu: "German", ita: "Italian", por: "Portuguese", pob: "Portuguese (BR)", ara: "Arabic", rus: "Russian", hin: "Hindi", jpn: "Japanese", chi: "Chinese", zho: "Chinese", ind: "Indonesian", tha: "Thai", vie: "Vietnamese", kor: "Korean", tur: "Turkish", pol: "Polish", dut: "Dutch", nld: "Dutch" };

async function subtitlesFor(anilistId, title, ep, format) {
  const { tmdb, map } = await cached(`tmdb:${anilistId}:${title}`, 24 * 3600e3, () => tmdbFor(anilistId, title, format)).then((v) => v || {});
  const imdb = tmdb?.imdbId || map?.imdb;
  if (!imdb) return [];
  const season = tmdb?.season || map?.tmdb?.season || 1;
  const url = tmdb?.type === "movie" ? `${OPENSUBS}/movie/${imdb}.json` : `${OPENSUBS}/series/${imdb}:${season}:${ep}.json`;
  const data = await getJson(url).catch(() => null);
  const count = {};
  return (data?.subtitles || []).slice(0, 60).map((s, i) => {
    const language = LANGS[s.lang] || (s.lang ? s.lang[0].toUpperCase() + s.lang.slice(1) : "English");
    count[language] = (count[language] || 0) + 1;
    return { id: s.id || `os_${i}`, label: count[language] > 1 ? `${language} #${count[language]}` : language, language, lang: s.lang, url: s.url, source: "OpenSubtitles" };
  });
}

/* ====================================================================
 * Proxy (HLS playlists are rewritten so segments also pass through here)
 * ==================================================================== */
function refererFor(host, requested) {
  if (requested && !/flixcloud\.cc|megaplay/.test(requested)) return requested;
  if (/krussdomi|advancedairesearchlab/.test(host)) return "https://krussdomi.com/";
  if (/animeapps|nukitashi|playeng/.test(host)) return "https://playeng.animeapps.top/";
  if (/nexabloom|stellarfrontier|phantomharbor|shadowharbor|hiddenvertex|emeralddrift|eclipseharbor|megaplay|megap|shiora|akirax|imgnex/.test(host)) return "https://megaplay.buzz/";
  if (/animesalt|as-cdn|acdn\.top|ravok/.test(host)) return "https://animesalt.cx/";
  if (/flixcloud|atomic4cdn|rundowncdn/.test(host)) return "https://flixcloud.cc/";
  return requested || null;
}

async function proxy(request, url) {
  const target = url.searchParams.get("url");
  const check = validateProxyUrl(target);
  if (!check.valid) return json({ error: check.error }, 403);
  const t = check.url;
  const referer = refererFor(t.hostname.toLowerCase(), url.searchParams.get("referer")) || `${t.origin}/`;

  const headers = new Headers({ "User-Agent": UA, Referer: referer, Origin: referer.replace(/\/$/, ""), Accept: "*/*" });
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);

  let up;
  try {
    up = await fetch(t, { headers });
  } catch (e) {
    return json({ error: "Proxy fetch failed: " + e.message }, 502);
  }

  const out = new Headers(CORS);
  const type = up.headers.get("Content-Type") || "";
  const isPlaylist = /mpegurl/i.test(type) || /\.m3u8?$/i.test(t.pathname);

  if (up.ok && isPlaylist) {
    const text = await up.text();
    if (/^\s*</.test(text)) return new Response(text, { status: up.status, headers: out });
    const direct = url.searchParams.get("seg") === "1"; // segments straight from the CDN, only playlists/keys use the Worker
    const wrap = (u, keep) => {
      try {
        const abs = new URL(u, t);
        if (!abs.search && t.search) abs.search = t.search;
        if (direct && keep) return abs.href;
        return `/proxy?url=${encodeURIComponent(abs.href)}&referer=${encodeURIComponent(referer)}${direct ? "&seg=1" : ""}`;
      } catch {
        return u;
      }
    };
    let variant = false;
    const body = text
      .split(/\r?\n/)
      .map((l) => {
        const s = l.trim();
        if (!s) return l;
        if (s.startsWith("#")) {
          variant = s.startsWith("#EXT-X-STREAM-INF");
          return s.replace(/URI=["']([^"']+)["']/g, (_, u) => `URI="${wrap(u, s.startsWith("#EXT-X-MAP"))}"`);
        }
        const plist = variant || /\.m3u8?(\?|$)/i.test(s);
        variant = false;
        return wrap(s, !plist);
      })
      .join("\n");
    out.set("Content-Type", "application/vnd.apple.mpegurl");
    out.set("Cache-Control", "no-store");
    return new Response(body, { status: up.status, headers: out });
  }

  if (type) out.set("Content-Type", type);
  for (const h of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
    const v = up.headers.get(h);
    if (v) out.set(h, v);
  }
  if (up.ok && /\.(ts|m4s|mp4|aac|key)$/i.test(t.pathname)) out.set("Cache-Control", "public, max-age=3600");
  return new Response(up.body, { status: up.status, headers: out });
}

/* ====================================================================
 * Router
 * ==================================================================== */

/* ====================================================================
 * Zenkai Android app: live GitHub release data
 * One cached request for the repo + latest releases, so visitors never hit GitHub's 60/h anonymous limit.
 * ==================================================================== */
const APP_REPO = "Nyyrox/Zenkai";
const RELEASE_TTL = 5 * 60e3;
let releaseSnap = null; // { at, v } kept per isolate / dev process; served stale if GitHub is down

const pickRelease = (r) => ({
  tag_name: r.tag_name,
  name: r.name,
  body: r.body || "",
  html_url: r.html_url,
  published_at: r.published_at,
  prerelease: !!r.prerelease,
  draft: !!r.draft,
  assets: (r.assets || []).map((a) => ({
    name: a.name,
    size: a.size,
    download_count: a.download_count,
    browser_download_url: a.browser_download_url,
    content_type: a.content_type,
    updated_at: a.updated_at,
  })),
});

async function loadAppRelease(env) {
  const token = env?.GITHUB_TOKEN || globalThis.process?.env?.GITHUB_TOKEN;
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const [repo, releases] = await Promise.all([
    getJson(`https://api.github.com/repos/${APP_REPO}`, { headers }),
    getJson(`https://api.github.com/repos/${APP_REPO}/releases?per_page=30`, { headers }),
  ]);
  return {
    repo: {
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      pushed_at: repo.pushed_at,
    },
    releases: releases.filter((r) => !r.draft).map(pickRelease),
    fetchedAt: new Date().toISOString(),
  };
}

/* ---------- Filler lists (animefillerlist.com: canon / mixed canon+filler / filler per episode) ---------- */
const slugOf = (t) => t.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Misses are cached too ({ max: 0 }), so an unknown title costs one request a day.
const fillerOf = (slug) =>
  cached(`filler:${slug}`, 24 * 3600e3, async () => {
    const out = { max: 0, filler: [], mixed: [] };
    try {
      const r = await fetch(`https://www.animefillerlist.com/shows/${slug}`, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
      });
      if (!r.ok) return out;
      const html = await r.text();
      // rows look like <tr class="odd mixed_canon/filler"><td class="Number">12</td>…<td class="Type">Mixed Canon/Filler</td>
      for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const num = row[1].match(/class=["']?Number["']?[^>]*>\s*(\d+)/i);
        const type = row[1].match(/class=["']?Type["']?[^>]*>\s*(?:<[^>]+>\s*)*([^<]*)/i);
        if (!num || !type) continue;
        const n = Number(num[1]);
        out.max = Math.max(out.max, n);
        if (/mixed/i.test(type[1])) out.mixed.push(n);
        else if (/filler/i.test(type[1])) out.filler.push(n);
      }
    } catch {
      /* unreachable: treated as a miss */
    }
    return out;
  });

// The show page slug is a guess from the title: also try it without "Season 2" / "Part 2" / ": subtitle" / "The".
const slugVariants = (t) => {
  const base = t.replace(/\s*[:\-–]\s*(season|part|cour)\s*\d+.*$/i, "").replace(/\s+(season|part|cour)\s*\d+.*$/i, "");
  return [t, base, base.replace(/\s*:.*$/, ""), base.replace(/^the\s+/i, ""), base.replace(/uu/gi, "u")].map(slugOf);
};

export async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const q = (k, d = "") => url.searchParams.get(k) ?? d;

  if (request.method === "OPTIONS" && (path.startsWith("/api/") || path === "/proxy"))
    return new Response(null, { status: 204, headers: CORS });

  const blocked = await shield(request, env, path, json);
  if (blocked) return blocked;

  if (path === "/proxy" || path === "/api/proxy") return proxy(request, url);

  if (path === "/api/stream") {
    const anilistId = parseInt(q("id", "0"), 10);
    const episode = parseInt(q("ep", "1"), 10) || 1;
    const server = q("server", "megaplay").toLowerCase();
    const audio = q("audio", "sub").toLowerCase();
    const title = q("title");
    if (!anilistId && !title) return json({ error: "Missing id or title" }, 400);

    // ACDN: multi-audio direct stream (anime-mapping.json + AnimeDekho / AnimeSalt), audio is picked inside the player
    if (server === "acdn") {
      const isMovie = q("format").toUpperCase() === "MOVIE" || q("isMovie") === "true";
      const lang = q("lang");
      try {
        const r = await cached(`acdn:${anilistId}:${episode}:${isMovie}:${lang}:${title}`, 10 * 60e3, () =>
          resolveAcdn({ anilistId, episode, title, isMovie, lang }),
        );
        if (!r?.streamUrl) return json({ error: "No multi-audio stream found on ACDN for this episode" }, 404);
        return json({
          success: true,
          server: "ACDN",
          audio: "multi",
          multiAudio: true,
          streamUrl: `/proxy?url=${encodeURIComponent(r.streamUrl)}&referer=${encodeURIComponent(r.referer || "https://animesalt.cx/")}&seg=1`,
          subtitles: [],
          intro: null,
          outro: null,
        });
      } catch (e) {
        return json({ error: e.message || "ACDN resolution failed" }, 502);
      }
    }

    try {
      const r = await resolveDirectStreamWorker({ anilistId, episode, audio, server, title });
      if (!r?.streamUrl) return json({ error: `No ${audio.toUpperCase()} stream found on ${server}` }, 404);
      return json({
        success: true,
        server: r.server,
        audio: r.audio,
        streamUrl: `/proxy?url=${encodeURIComponent(r.streamUrl)}&referer=${encodeURIComponent(r.referer || "https://megaplay.buzz/")}&seg=1`,
        subtitles: r.subtitles || [],
        intro: r.intro,
        outro: r.outro,
      });
    } catch (e) {
      return json({ error: e.message || "Stream resolution failed" }, 502);
    }
  }

  if (path === "/api/subtitles") {
    try {
      const subs = await subtitlesFor(parseInt(q("id", "0"), 10), q("title"), parseInt(q("ep", "1"), 10) || 1, q("format").toUpperCase());
      return json({ success: true, subtitles: subs }, 200, 3600);
    } catch {
      return json({ success: false, subtitles: [] }, 200);
    }
  }

  const mapMatch = path.match(/^\/api\/mapping\/(\d+)\/?$/);
  if (mapMatch) {
    const m = await mapOf(parseInt(mapMatch[1], 10));
    return m ? json({ success: true, data: m }, 200, 86400) : json({ success: false, data: null }, 200, 600);
  }

  if (path === "/api/tmdb") {
    const id = parseInt(q("id", "0"), 10);
    const title = q("title");
    if (!id && !title) return json({ error: "Missing id or title" }, 400);
    try {
      const r = await cached(`tmdb:${id}:${title}`, 24 * 3600e3, () => tmdbFor(id, title, q("format").toUpperCase()));
      return json({ success: !!r?.tmdb, mapping: r?.map ?? null, tmdb: r?.tmdb ?? null }, 200, 86400);
    } catch {
      return json({ success: false, mapping: null, tmdb: null }, 200, 300);
    }
  }

  // Search endpoint: /api/movies/search?q=dune&type=multi|movie|tv  ->  { results: [normalised titles] }
  if (path === "/api/movies/search") {
    const term = q("q").trim();
    const kind = ["movie", "tv"].includes(q("type")) ? q("type") : "multi";
    if (term.length < 2) return json({ results: [] }, 200, 60);
    try {
      const d = await cached(`msearch:${kind}:${term.toLowerCase()}`, 10 * 60e3, () => getJson(`${TMDB}/search/${kind}?query=${encodeURIComponent(term)}&include_adult=false&language=en-US`));
      const results = (d.results || [])
        .filter((r) => (r.media_type ? r.media_type === "movie" || r.media_type === "tv" : true) && r.poster_path)
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          type: r.media_type === "tv" || kind === "tv" ? "tv" : "movie",
          title: r.title || r.name,
          poster: r.poster_path,
          backdrop: r.backdrop_path || null,
          year: (r.release_date || r.first_air_date || "").slice(0, 4) || null,
          rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
          overview: r.overview || "",
          genreIds: r.genre_ids || [],
        }));
      return json({ results }, 200, 600);
    } catch {
      return json({ error: "Search is unavailable right now" }, 502);
    }
  }

  // Movies / TV catalogue: whitelisted read-only passthrough to the TMDB proxy, e.g. /api/movies/trending/movie/week
  if (path.startsWith("/api/movies/")) {
    const sub = path.slice("/api/movies/".length).replace(/\/+$/, "");
    const ok = /^(trending\/(movie|tv)\/(day|week)|(movie|tv)\/(popular|top_rated|now_playing|upcoming|airing_today|on_the_air)|discover\/(movie|tv)|search\/(movie|tv|multi)|(movie|tv)\/\d+(\/(similar|recommendations))?|tv\/\d+\/season\/\d+)$/.test(sub);
    if (!ok) return json({ error: "Unsupported path" }, 400);
    const qs = new URLSearchParams(url.searchParams);
    if (!qs.has("language")) qs.set("language", "en-US");
    qs.set("include_adult", "false");
    qs.sort();
    try {
      const d = await cached(`movies:${sub}?${qs}`, 10 * 60e3, () => getJson(`${TMDB}/${sub}?${qs}`));
      return json(d, 200, 600);
    } catch {
      return json({ error: "TMDB is unavailable right now" }, 502);
    }
  }

  if (path === "/api/tmdb/episodes") {
    const id = parseInt(q("id", "0"), 10);
    const season = parseInt(q("season", "1"), 10) || 1;
    if (!id) return json({ error: "Missing id" }, 400);
    try {
      const d = await cached(`tmdb-eps:${id}:${season}`, 24 * 3600e3, () => getJson(`${TMDB}/tv/${id}/season/${season}?language=en-US`));
      const episodes = (d.episodes || []).map((e) => ({ n: e.episode_number, name: e.name || null, overview: e.overview || null, still: e.still_path || null, runtime: e.runtime || null, air: e.air_date || null }));
      return json({ success: true, episodes }, 200, 86400);
    } catch {
      return json({ success: false, episodes: [] }, 200, 300); // client falls back to AniList
    }
  }

  if (path === "/api/filler") {
    // ponytail: AnimeFillerList has no API, so read its public show page (cached a day; it asks for a 10s crawl delay)
    // and guess the slug from the titles. Upgrade path: a build-time JSON bundle of all shows.
    const slugs = [...new Set(url.searchParams.getAll("t").flatMap(slugVariants).filter(Boolean))].slice(0, 6);
    for (const s of slugs) {
      const d = await fillerOf(s);
      if (d.max) return json({ success: true, ...d }, 200, 86400);
    }
    return json({ success: false }, 200, 3600);
  }

  if (path === "/api/embed/animesalt") {
    const anilistId = parseInt(q("id", "0"), 10);
    const format = q("format").toUpperCase();
    try {
      const r = await extractAnimeSaltPlayer({
        anilistId,
        episode: parseInt(q("ep", "1"), 10) || 1,
        title: q("title"),
        isMovie: q("isMovie") === "true" || format === "MOVIE",
        audio: q("audio", "multi"),
        server: q("server", "1"),
      });
      const two = ["2", "abyss"].includes(q("server", "1").toLowerCase());
      const embedUrl = r.success ? (two ? r.abyssUrl || r.myStreamUrl || r.embedUrl : r.myStreamUrl || r.abyssUrl || r.embedUrl) : null;
      return embedUrl ? json({ success: true, embedUrl }, 200, 1800) : json({ success: false, error: r.error || "Not found on AnimeSalt" }, 404);
    } catch (e) {
      return json({ success: false, error: e.message }, 500);
    }
  }

  
  /* ---------- Stark Protocol: Session & Authentication Endpoints ---------- */
  const authSecret = env?.STARK_AUTH_SECRET || env?.SHIELD_SECRET || "stark-protocol-jwt-2026";
  const authEnc = new TextEncoder();
  const authHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const authHmac = async (data, secret) => {
    const key = await crypto.subtle.importKey("raw", authEnc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return authHex(await crypto.subtle.sign("HMAC", key, authEnc.encode(data)));
  };
  const authSafeEq = (a, b) => {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  };
  const decodeBase64Url = (str) => {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    if (typeof Buffer !== "undefined") {
      return Buffer.from(b64, "base64").toString("utf8");
    }
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  };
  const createAuthToken = async (user, isAdmin, exp) => {
    const payload = JSON.stringify({ u: user, a: Boolean(isAdmin), exp, iat: Date.now() });
    const b64 = typeof Buffer !== "undefined"
      ? Buffer.from(payload, "utf8").toString("base64")
      : btoa(payload);
    const sig = await authHmac(b64, authSecret);
    return `${b64}.${sig}`;
  };
  const verifySupabaseToken = async (sbJwt) => {
    if (!sbJwt || typeof sbJwt !== "string") return null;
    const parts = sbJwt.split(".");
    if (parts.length !== 3) return null;

    let payload = null;
    try {
      const jsonStr = decodeBase64Url(parts[1]);
      payload = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    if (!payload) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    const email = (payload.email || "").toLowerCase();
    const isPepperonyxAdmin =
      email === "gaurav@pepperonyx.dpdns.org" ||
      email.startsWith("gaurav@") ||
      email.startsWith("gaurxv@") ||
      payload.app_metadata?.is_admin === true ||
      payload.user_metadata?.is_admin === true;

    const envVal = (key) =>
      (env && env[key]) ||
      (typeof process !== "undefined" && process.env && process.env[key]) ||
      "";
    let sbUrl =
      envVal("VITE_SUPABASE_URL") ||
      envVal("SUPABASE_URL") ||
      "https://tfykttkuoohjyjvrjxop.supabase.co";
    const sbKey =
      envVal("VITE_SUPABASE_ANON_KEY") ||
      envVal("SUPABASE_ANON_KEY") ||
      envVal("VITE_SUPABASE_PUBLISHABLE_KEY") ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmeWt0dGt1b29oanlqdnJqeG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMTc3OTAsImV4cCI6MjEwODY5Mzc5MH0.fMHT2ig0PNgoIs5lLKFUo1Ug9nBPbnk3LlSeHETAjPs";
    if (sbUrl.includes("tfykktkuoohjyjvrjxop")) {
      sbUrl = sbUrl.replace("tfykktkuoohjyjvrjxop", "tfykttkuoohjyjvrjxop");
    }

    try {
      const userRes = await fetch(`${sbUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${sbJwt}`,
          apikey: sbKey,
        },
      });
      if (userRes.ok) {
        const uData = await userRes.json();
        const uEmail = (uData.email || "").toLowerCase();
        const uIsAdmin =
          uEmail === "gaurav@pepperonyx.dpdns.org" ||
          uEmail.startsWith("gaurav@") ||
          uEmail.startsWith("gaurxv@") ||
          uData.app_metadata?.is_admin === true ||
          uData.user_metadata?.is_admin === true;
        return {
          u:
            uData.user_metadata?.full_name ||
            uData.user_metadata?.name ||
            (uIsAdmin ? "gaurxv" : uData.email?.split("@")[0] || "user"),
          a: uIsAdmin,
          exp: payload.exp ? payload.exp * 1000 : Date.now() + 3600000,
          email: uEmail,
          userId: uData.id,
        };
      }
    } catch (e) {
      // In case Supabase network lookup blips, fall back to payload inspection
    }

    if (isPepperonyxAdmin && (!payload.exp || Date.now() / 1000 <= payload.exp)) {
      return {
        u: payload.user_metadata?.full_name || "gaurxv",
        a: true,
        exp: payload.exp ? payload.exp * 1000 : Date.now() + 3600000,
        email: email,
        userId: payload.sub,
      };
    }

    return null;
  };
  const verifyAuthToken = async (token) => {
    if (!token || typeof token !== "string" || !token.includes(".")) return null;
    const cleanToken = token.trim();
    const parts = cleanToken.split(".");
    if (parts.length === 2) {
      const [b64, sig] = parts;
      if (!b64 || !sig) return null;
      const expectedSig = await authHmac(b64, authSecret);
      if (!authSafeEq(sig, expectedSig)) return null;
      try {
        const payload = JSON.parse(decodeBase64Url(b64));
        if (!payload || !payload.u || !payload.exp) return null;
        if (Date.now() > payload.exp) return null;
        return payload;
      } catch {
        return null;
      }
    }
    if (parts.length === 3) {
      return await verifySupabaseToken(cleanToken);
    }
    return null;
  };

  /* ---------- Public Runtime Config (Client Environment Hydration) ---------- */
  if (path === "/api/config") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
    }
    const envVal = (key) =>
      (env && env[key]) ||
      (typeof process !== "undefined" && process.env && process.env[key]) ||
      "";
    let url = envVal("VITE_SUPABASE_URL") || envVal("SUPABASE_URL") || "";
    const key =
      envVal("VITE_SUPABASE_ANON_KEY") ||
      envVal("SUPABASE_ANON_KEY") ||
      envVal("VITE_SUPABASE_PUBLISHABLE_KEY") ||
      envVal("SUPABASE_PUBLISHABLE_KEY") ||
      "";

    // Auto-derive project URL if key is a valid Supabase JWT
    if (key && key.includes(".")) {
      try {
        const parts = key.split(".");
        let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
        if (payload?.ref) url = `https://${payload.ref}.supabase.co`;
      } catch {}
    }
    if (url.includes("tfykktkuoohjyjvrjxop")) {
      url = url.replace("tfykktkuoohjyjvrjxop", "tfykttkuoohjyjvrjxop");
    }

    return json({
      supabaseUrl: url,
      supabaseAnonKey: key,
    });
  }

  if (path === "/api/auth/verify") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
    if (request.method === "POST" || request.method === "GET") {
      let token = "";
      const authHeader = request.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      } else if (authHeader) {
        token = authHeader.trim();
      }
      if (!token && request.method === "POST") {
        try {
          const body = await request.json();
          if (body?.token) token = String(body.token).trim();
        } catch {}
      }
      if (!token) {
        token = (request.headers.get("X-Stark-Token") || request.headers.get("X-Supabase-Auth") || "").replace(/^Bearer\s+/i, "").trim();
      }
      let verified = await verifyAuthToken(token);
      if (!verified && request.headers.get("X-Stark-Token")) {
        verified = await verifyAuthToken(request.headers.get("X-Stark-Token").replace(/^Bearer\s+/i, "").trim());
      }
      if (!verified && request.headers.get("X-Supabase-Auth")) {
        verified = await verifyAuthToken(request.headers.get("X-Supabase-Auth").replace(/^Bearer\s+/i, "").trim());
      }
      if (verified) {
        return json({ success: true, ok: true, user: verified.u, isAdmin: verified.a, exp: verified.exp });
      }
      return json({ success: false, ok: false, error: "Invalid or expired session" }, 401);
    }
  }

  if (path === "/api/auth/login") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
    if (request.method === "POST") {
      try {
        const { username, password, remember } = await request.json();
        const u = String(username || "").trim();
        const p = String(password || "").trim();
        const uLower = u.toLowerCase();

        if (!p) {
          return json({ success: false, ok: false, error: "Password required" }, 400);
        }

        // 1. Resolve email according to Stark Gate -> Supabase mapping
        let email = "";
        if (uLower === "gaurxv" || uLower === "admin" || uLower === "gaurav") {
          email = "gaurav@pepperonyx.dpdns.org";
        } else if (u.includes("@")) {
          email = u;
        } else {
          email = `${uLower.replace(/[^a-z0-9_]/g, "")}@pepperonyx.dpdns.org`;
        }

        // 2. Fetch Supabase configuration
        const envVal = (key) => (env && env[key]) || (typeof process !== "undefined" && process.env && process.env[key]) || "";
        let sbUrl = envVal("VITE_SUPABASE_URL") || envVal("SUPABASE_URL") || "";
        const sbKey = envVal("VITE_SUPABASE_ANON_KEY") || envVal("SUPABASE_ANON_KEY") || envVal("VITE_SUPABASE_PUBLISHABLE_KEY") || "";
        if (sbKey && sbKey.includes(".")) {
          try {
            const parts = sbKey.split(".");
            let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            while (b64.length % 4) b64 += "=";
            const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
            if (payload?.ref) sbUrl = `https://${payload.ref}.supabase.co`;
          } catch {}
        }
        if (sbUrl.includes("tfykktkuoohjyjvrjxop")) {
          sbUrl = sbUrl.replace("tfykktkuoohjyjvrjxop", "tfykttkuoohjyjvrjxop");
        }

        // 3. Attempt direct Supabase Auth verification
        let supabaseSession = null;
        if (sbUrl && sbKey && email && p) {
          try {
            const sbAuthRes = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: sbKey,
              },
              body: JSON.stringify({ email, password: p }),
            });
            if (sbAuthRes.ok) {
              supabaseSession = await sbAuthRes.json();
            }
          } catch {}
        }

        // 4. Server-configured admin credentials
        const envAdminUser = (envVal("VITE_ADMIN_USER") || envVal("ADMIN_USER") || "gaurxv").toLowerCase().trim();
        const envAdminPass = (envVal("VITE_ADMIN_PASS") || envVal("ADMIN_PASS") || "").trim();

        const isConfiguredAdmin =
          Boolean(envAdminPass) &&
          (uLower === envAdminUser || uLower === "gaurxv" || uLower === "admin" || uLower === "gaurav") &&
          p === envAdminPass;

        // 5. If admin credentials match server secret but Supabase Auth had older password, automatically sync
        if (isConfiguredAdmin && !supabaseSession && sbUrl && sbKey && email && p) {
          try {
            const syncRes = await fetch(`${sbUrl}/rest/v1/rpc/sync_admin_password`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: sbKey,
                Authorization: `Bearer ${sbKey}`,
              },
              body: JSON.stringify({
                user_email: email,
                new_password: p,
                secret_token: "stark_sec_sync_7e9a8f23b1c4d5e6a7b8c9d0e1f2a3b4",
              }),
            });
            if (syncRes.ok) {
              const retryRes = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: sbKey,
                },
                body: JSON.stringify({ email, password: p }),
              });
              if (retryRes.ok) {
                supabaseSession = await retryRes.json();
              }
            }
          } catch {}
        }

        const isSupabaseAdmin = Boolean(
          supabaseSession?.user &&
          (supabaseSession.user.email?.toLowerCase() === "gaurav@pepperonyx.dpdns.org" ||
           supabaseSession.user.app_metadata?.is_admin ||
           supabaseSession.user.user_metadata?.is_admin)
        );

        let ok = false;
        let isAdmin = false;
        let authUser = u || "gaurxv";
        let passwordMismatch = false;

        if (isSupabaseAdmin) {
          ok = true;
          isAdmin = true;
          authUser = supabaseSession.user.user_metadata?.full_name || u || "gaurxv";
        } else if (isConfiguredAdmin) {
          ok = true;
          isAdmin = true;
          authUser = u || "gaurxv";
          passwordMismatch = false;
        } else {
          // Check KV users
          let kvUsers = [];
          if (env && env.STARK_KV) {
            try {
              const raw = await env.STARK_KV.get("stark_users");
              if (raw) kvUsers = JSON.parse(raw);
            } catch {}
          }
          const matchKv = Array.isArray(kvUsers) && kvUsers.find((c) => c.username?.toLowerCase() === uLower && c.password === p);
          if (matchKv) {
            ok = true;
            authUser = matchKv.displayName || matchKv.username;
            isAdmin = false;
          }
        }

        if (ok) {
          const exp = remember !== false ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000;
          const token = await createAuthToken(authUser, isAdmin, exp);
          return json({
            success: true,
            ok: true,
            token,
            user: authUser,
            isAdmin,
            exp,
            supabaseSession: supabaseSession ? {
              access_token: supabaseSession.access_token,
              refresh_token: supabaseSession.refresh_token,
              user: supabaseSession.user,
            } : null,
            passwordMismatch,
          });
        }
        return json({ success: false, ok: false, error: "Access Denied: Invalid credentials" }, 401);
      } catch (err) {
        return json({ success: false, ok: false, error: String(err?.message || err) }, 400);
      }
    }
  }

  if (path === "/api/auth/logout") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
    return json({ success: true, ok: true });
  }

  /* ---------- Stark Protocol: Cloud Credentials Sync ---------- */
  if (path === "/api/auth/credentials") {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          ...CORS,
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST, PUT, DELETE",
        },
      });
    }

    if (request.method === "GET") {
      let kvUsers = [];
      let isKvConnected = false;
      if (env && env.STARK_KV) {
        try {
          const raw = await env.STARK_KV.get("stark_users");
          if (raw) kvUsers = JSON.parse(raw);
          isKvConnected = true;
        } catch (e) {}
      }

      let envUsers = [];
      const envRaw = (env?.VITE_AUTH_CREDENTIALS || env?.STARK_AUTH_CREDENTIALS)?.trim();
      if (envRaw) {
        try {
          let parsed = JSON.parse(envRaw);
          if (typeof parsed === "string") parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) envUsers = parsed;
        } catch (e) {}
      }

      return json({
        success: true,
        kvConnected: isKvConnected,
        users: isKvConnected ? kvUsers : envUsers,
      });
    }

    if (request.method === "POST") {
      // Server-side authorization check: Require valid Admin token
      const authHeader = request.headers.get("Authorization") || "";
      let token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const sbAuth = (request.headers.get("X-Supabase-Auth") || "").replace(/^Bearer\s+/i, "").trim();
      const starkAuth = (request.headers.get("X-Stark-Token") || "").replace(/^Bearer\s+/i, "").trim();

      let verified = await verifyAuthToken(token);
      if (!verified && starkAuth) {
        verified = await verifyAuthToken(starkAuth);
      }
      if (!verified && sbAuth) {
        verified = await verifyAuthToken(sbAuth);
      }
      if (!verified || !verified.a) {
        return json({ success: false, error: "Unauthorized: Admin clearance required" }, 403);
      }

      if (!env || !env.STARK_KV) {
        return json({ success: false, error: "STARK_KV not bound in Cloudflare" }, 200);
      }
      try {
        const body = await request.json();
        if (body && Array.isArray(body.users)) {
          await env.STARK_KV.put("stark_users", JSON.stringify(body.users));
          return json({ success: true, count: body.users.length });
        }
        return json({ success: false, error: "Invalid payload" }, 400);
      } catch (e) {
        return json({ success: false, error: String(e.message || e) }, 500);
      }
    }
  }

  /* ====================================================================
   * Subscription & Access Management Endpoints
   * ==================================================================== */

  // 1. Submit Payment Proof (direct image/receipt upload to Telegram bot + Brevo notification)
  if (path === "/api/subscription/submit-payment") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
    if (request.method === "POST") {
      try {
        const body = await request.json();
        const result = await submitPaymentProof({ ...body, env });
        return json(result);
      } catch (e) {
        return json({ success: false, error: e.message || "Failed to submit payment proof." }, 400);
      }
    }
  }

  // 2. User Entitlement & Trial Countdown
  if (path === "/api/subscription/entitlement") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
    }
    if (request.method === "GET") {
      const user = q("user") || q("username");
      if (!user) return json({ hasAccess: false, error: "Missing user parameter" }, 400);
      try {
        const entitlement = await getUserEntitlement(user, env);
        return json(entitlement);
      } catch (e) {
        return json({ hasAccess: false, error: e.message || "Failed to check entitlement." }, 500);
      }
    }
  }

  // 3. Admin Subscriptions Dashboard Data
  if (path === "/api/admin/subscriptions") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
    }
    if (request.method === "GET") {
      const authHeader = request.headers.get("Authorization") || "";
      let token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const sbAuth = (request.headers.get("X-Supabase-Auth") || "").replace(/^Bearer\s+/i, "").trim();
      const starkAuth = (request.headers.get("X-Stark-Token") || "").replace(/^Bearer\s+/i, "").trim();

      let verified = await verifyAuthToken(token);
      if (!verified && starkAuth) {
        verified = await verifyAuthToken(starkAuth);
      }
      if (!verified && sbAuth) {
        verified = await verifyAuthToken(sbAuth);
      }
      if (!verified || !verified.a) {
        return json({ success: false, error: "Unauthorized: Admin clearance required" }, 403);
      }
      try {
        const data = await getAdminSubscriptionsData(env);
        return json({ success: true, ...data });
      } catch (e) {
        return json({ success: false, error: e.message || "Failed to load subscription dashboard data." }, 500);
      }
    }
  }

  // 4. Admin Subscription Actions (Approve, Reject, Policy, Suspend, Extend)
  if (path === "/api/admin/subscription/action") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
    if (request.method === "POST") {
      const authHeader = request.headers.get("Authorization") || "";
      let token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const sbAuth = (request.headers.get("X-Supabase-Auth") || "").replace(/^Bearer\s+/i, "").trim();
      const starkAuth = (request.headers.get("X-Stark-Token") || "").replace(/^Bearer\s+/i, "").trim();

      let verified = await verifyAuthToken(token);
      if (!verified && starkAuth) {
        verified = await verifyAuthToken(starkAuth);
      }
      if (!verified && sbAuth) {
        verified = await verifyAuthToken(sbAuth);
      }
      if (!verified || !verified.a) {
        return json({ success: false, error: "Unauthorized: Admin clearance required" }, 403);
      }
      try {
        const body = await request.json();
        const result = await handleAdminSubscriptionAction(body, verified.u, env);
        return json(result);
      } catch (e) {
        return json({ success: false, error: e.message || "Action failed." }, 400);
      }
    }
  }

  // 5. Account Requests
  if (path === "/api/auth/request-account") {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
    if (request.method === "POST") {
      try {
        const body = await request.json();
        const result = await handleAccountRequest({ ...body, env });
        return json(result);
      } catch (e) {
        return json({ success: false, error: e.message || "Failed to submit account request." }, 400);
      }
    }
  }

  if (path === "/api/tts/voices") {
    return json({
      voices: [
        { id: "hi-IN-female", language: "hi-IN", group: "Hindi (India)", gender: "female", label: "Hindi (India) — Female" },
        { id: "hi-IN-male", language: "hi-IN", group: "Hindi (India)", gender: "male", label: "Hindi (India) — Male" },
        { id: "en-IN-female", language: "en-IN", group: "English (India)", gender: "female", label: "English (India) — Female" },
        { id: "en-IN-male", language: "en-IN", group: "English (India)", gender: "male", label: "English (India) — Male" },
        { id: "sa-IN-female", language: "sa-IN", group: "Sanskrit (India)", gender: "female", label: "Sanskrit (India) — Female" },
        { id: "sa-IN-male", language: "sa-IN", group: "Sanskrit (India)", gender: "male", label: "Sanskrit (India) — Male" }
      ],
      strictOptionsCount: 6,
      allowedLocales: ["hi-IN", "en-IN", "sa-IN"]
    }, 200, 86400);
  }

  if (path === "/api/tts/synthesize") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      const body = await request.json();
      const { text, voiceId, speed = 1.0 } = body || {};
      if (!text || typeof text !== "string") return json({ error: "Missing text parameter" }, 400);
      const allowed = ["hi-IN-female", "hi-IN-male", "en-IN-female", "en-IN-male", "sa-IN-female", "sa-IN-male"];
      if (!allowed.includes(voiceId)) return json({ error: "Invalid voice option. Only 6 Indian voices permitted." }, 400);

      return json({
        ok: true,
        voiceId,
        speed,
        length: text.length,
        language: voiceId.startsWith("sa") ? "sa-IN" : voiceId.startsWith("hi") ? "hi-IN" : "en-IN",
        clientSynthesized: true
      });
    } catch (e) {
      return json({ error: "Failed to process speech request: " + e.message }, 500);
    }
  }

  if (path === "/api/app/release") {
    try {
      if (!releaseSnap || Date.now() - releaseSnap.at > RELEASE_TTL) releaseSnap = { at: Date.now(), v: await loadAppRelease(env) };
      return json({ success: true, ...releaseSnap.v }, 200, 60);
    } catch (e) {
      if (releaseSnap) return json({ success: true, stale: true, ...releaseSnap.v }, 200, 30);
      return json({ success: false, error: String(e.message || e) }, 502);
    }
  }

  /* ---------- Novels (NovelFire / NovelFull / WebNovel) ---------- */
  if (path.startsWith("/api/novel/")) {
    const source = q("source", "novelfire");
    const engine = novelEngine.getSource(source);
    const page = parseInt(q("page", "1"), 10) || 1;
    const slug = q("slug");
    try {
      switch (path) {
        case "/api/novel/home":
          return json(await cached(`nhome:${source}:${page}`, 15 * 60e3, () => engine.getHome(page)), 200, 900);
        case "/api/novel/search": {
          const term = q("q").trim();
          if (!term) return json({ results: [] });
          return json({ results: await cached(`nsearch:${source}:${term}:${page}`, 10 * 60e3, () => engine.search(term, page)) }, 200, 600);
        }
        case "/api/novel/detail":
          if (!slug) return json({ error: "Missing novel slug" }, 400);
          return json({ detail: await cached(`ndetail:${source}:${slug}`, 3600e3, () => engine.getDetail(slug)) }, 200, 3600);
        case "/api/novel/chapters":
          if (!slug) return json({ error: "Missing novel slug" }, 400);
          return json(await cached(`nch:${source}:${slug}`, 3600e3, () => engine.getChapters(slug, page)), 200, 3600);
        case "/api/novel/read": {
          const novelSlug = q("novelSlug") || slug;
          const chapterSlug = q("chapterSlug") || q("ch") || "chapter-1";
          if (!novelSlug) return json({ error: "Missing novel slug" }, 400);
          const c = await cached(`nread:${source}:${novelSlug}:${chapterSlug}`, 2 * 3600e3, async () => {
            const r = await engine.getChapterContent(novelSlug, chapterSlug);
            return r.paragraphs?.length ? r : null; // never memoise failures
          });
          return c ? json(c, 200, 7200) : json({ ...(await engine.getChapterContent(novelSlug, chapterSlug)) }, 200);
        }
      }
    } catch (e) {
      return json({ error: "Novel source unavailable: " + e.message }, 502);
    }
    return json({ error: "Unknown novel route" }, 404);
  }

  /* ---------- Manga (five servers; see manga.js) ---------- */
  if (path.startsWith("/api/manga/")) {
    const source = manga.parseSource(q("source"));
    try {
      if (path === "/api/manga/sources") return json({ sources: manga.SOURCES, default: manga.DEFAULT_SOURCE }, 200, 3600);
      if (path === "/api/manga/home") return json(await cached(`mhome:${source}`, 15 * 60e3, () => manga.getHome(source)), 200, 900);
      if (path === "/api/manga/search") {
        const term = q("q").trim();
        return term ? json(await cached(`msearch:${source}:${term}`, 10 * 60e3, () => manga.search(term, source)), 200, 600) : json({ results: [] });
      }
      if (path === "/api/manga/chapters") {
        const id = q("id");
        if (!id) return json({ error: "Missing manga id" }, 400);
        return json(await cached(`mch:${source}:${id}`, 30 * 60e3, () => manga.getChapters(id, source)), 200, 1800);
      }
      if (path === "/api/manga/pages") {
        const chapterId = q("chapterId") || q("id");
        if (!chapterId) return json({ error: "Missing chapterId" }, 400);
        const ttl = source === "mangadex" ? 600 : 3600; // MangaDex image hosts rotate, keep those short
        const r = await cached(`mpg:${source}:${chapterId}`, ttl * 1e3, async () => {
          const x = await manga.getPages(chapterId, source);
          return x.pages.length ? x : null;
        });
        return json(r ?? { chapterId, pages: [] }, 200, r ? ttl : 0);
      }
    } catch (e) {
      return json({ error: `Manga source unavailable (${source}): ` + e.message }, 502);
    }
    return json({ error: "Unknown manga route" }, 404);
  }

  /* ---------- Ebooks (Project Gutenberg & Open Library) ---------- */
  if (path === "/api/ebooks/content") {
    const id = q("id");
    if (!id) return json({ error: "Missing book id" }, 400);

    try {
      const result = await cached(`ebook:${id}`, 6 * 3600e3, async () => {
        // Project Gutenberg
        if (id.startsWith("pg:") || /^\d+$/.test(id)) {
          const gId = id.replace(/^pg:/, "");
          const urls = [
            `https://www.gutenberg.org/cache/epub/${gId}/pg${gId}-images.html`,
            `https://www.gutenberg.org/cache/epub/${gId}/pg${gId}.txt`
          ];

          let text = "";
          let isHtml = false;
          for (const u of urls) {
            try {
              const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
              if (res.ok) {
                text = await res.text();
                isHtml = u.endsWith(".html");
                break;
              }
            } catch {}
          }

          if (!text) throw new Error("Could not fetch Gutenberg ebook content");

          // Extract title & author
          let title = "Unknown Title";
          let author = "Unknown Author";
          const titleMatch = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || text.match(/<title>([\s\S]*?)<\/title>/i) || text.match(/Title:\s*([^\r\n]+)/i);
          if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/The Project Gutenberg eBook of\s*/i, '').trim();

          const authorMatch = text.match(/Author:\s*([^\r\n]+)/i) || text.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
          if (authorMatch) author = authorMatch[1].replace(/<[^>]+>/g, '').replace(/by\s+/i, '').trim();

          const paragraphs = [];
          const sections = [];

          if (isHtml) {
            const baseGutenberg = `https://www.gutenberg.org/cache/epub/${gId}/`;
            const resolvedHtml = text.replace(/<img\b([^>]*?)src=["'](?!https?:\/\/)([^"']+)["']/gi, (match, prefix, src) => {
              const absUrl = src.startsWith("/") ? `https://www.gutenberg.org${src}` : `${baseGutenberg}${src}`;
              return `<img ${prefix}src="${absUrl}"`;
            });

            const tags = [...resolvedHtml.matchAll(/<(?:p|h[1-4]|blockquote)[^>]*>([\s\S]*?)<\/(?:p|h[1-4]|blockquote)>/gi)];
            for (const m of tags) {
              const rawTag = m[0];
              const inner = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              if (!inner || inner.length < 3) continue;
              if (inner.includes("*** START OF") || inner.includes("*** END OF")) continue;

              if (/^<h[1-4]/i.test(rawTag)) {
                sections.push({ title: inner, index: paragraphs.length });
                paragraphs.push(`## ${inner}`);
              } else {
                paragraphs.push(inner);
              }
            }
          } else {
            const lines = text.split(/\r?\n\r?\n/);
            let inBody = false;
            for (const block of lines) {
              const clean = block.replace(/\s+/g, ' ').trim();
              if (!clean) continue;
              if (clean.includes("*** START OF THE PROJECT GUTENBERG")) { inBody = true; continue; }
              if (clean.includes("*** END OF THE PROJECT GUTENBERG")) { inBody = false; break; }
              if (!inBody && clean.length > 300) inBody = true;
              if (inBody) {
                if (/^(?:CHAPTER|LETTER|BOOK|PART|ACT|SCENE)\b/i.test(clean) && clean.length < 80) {
                  sections.push({ title: clean, index: paragraphs.length });
                  paragraphs.push(`## ${clean}`);
                } else {
                  paragraphs.push(clean);
                }
              }
            }
          }

          return {
            id: `pg:${gId}`,
            title,
            author,
            source: "gutenberg",
            cover: `https://www.gutenberg.org/cache/epub/${gId}/pg${gId}.cover.medium.jpg`,
            paragraphs: paragraphs.slice(0, 3000),
            sections: sections.slice(0, 100),
            access: "read_and_download",
            externalUrl: `https://www.gutenberg.org/ebooks/${gId}`
          };
        }

        // Internet Archive
        if (id.startsWith("ia:")) {
          const iaId = id.replace(/^ia:/, "");
          const iaRes = await fetch(`https://archive.org/metadata/${iaId}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });
          if (!iaRes.ok) throw new Error(`Internet Archive item not found: ${iaRes.status}`);
          const iaData = await iaRes.json();
          const meta = iaData.metadata || {};
          const files = Array.isArray(iaData.files) ? iaData.files : [];

          let author = meta.creator || "Unknown Author";
          if (Array.isArray(author)) author = author.join(", ");

          let epubUrl = null;
          let pdfUrl = null;

          const epubFile = files.find(f => f.name && f.name.toLowerCase().endsWith(".epub"));
          if (epubFile) {
            epubUrl = `https://archive.org/download/${iaId}/${encodeURIComponent(epubFile.name)}`;
          }

          const pdfFile = files.find(f => f.name && f.name.toLowerCase().endsWith(".pdf") && !f.name.toLowerCase().includes("_bw.pdf"));
          if (pdfFile) {
            pdfUrl = `https://archive.org/download/${iaId}/${encodeURIComponent(pdfFile.name)}`;
          }

          const txtFile = files.find(f => f.name && (f.name.endsWith("_djvu.txt") || f.name.endsWith(".txt")));

          let paragraphs = [];
          if (txtFile && txtFile.name) {
            try {
              const txtRes = await fetch(`https://archive.org/download/${iaId}/${encodeURIComponent(txtFile.name)}`, {
                headers: { "User-Agent": "Mozilla/5.0", Range: "bytes=10000-160000" }
              });
              if (txtRes.ok) {
                const rawText = await txtRes.text();
                paragraphs = rawText
                  .split(/\r?\n\r?\n|\n{2,}/)
                  .map(p => p.trim())
                  .filter(p => p.length > 20)
                  .slice(0, 300);
              }
            } catch {}
          }

          const bookTitle = meta.title || iaId;
          const lang = meta.language || (bookTitle.toLowerCase().includes("ramayan") || bookTitle.toLowerCase().includes("valmiki") ? "sa" : "en");

          return {
            id: `ia:${iaId}`,
            title: bookTitle,
            author,
            source: "internetarchive",
            cover: `https://archive.org/services/img/${iaId}`,
            embedUrl: `https://archive.org/embed/${iaId}`,
            epubUrl,
            pdfUrl,
            paragraphs,
            language: lang,
            sections: [],
            access: epubUrl || pdfUrl ? "read_and_download" : "read_only",
            externalUrl: `https://archive.org/details/${iaId}`,
            description: typeof meta.description === "string" ? meta.description : ""
          };
        }

        // Open Library (resolves to open public scan on Internet Archive)
        const olKey = id.replace(/^ol:/, "").replace(/^\/works\//, "");
        const olRes = await fetch(`https://openlibrary.org/works/${olKey}.json`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!olRes.ok) throw new Error(`Open Library fetch failed: ${olRes.status}`);
        const olData = await olRes.json();

        // If Open Library links to an IA record, provide internal BookReader
        const iaId = Array.isArray(olData.ia) && olData.ia[0] ? olData.ia[0] : null;

        const title = olData.title || "Open Library Book";
        let author = "Unknown Author";
        if (olData.authors && olData.authors.length) {
          try {
            const aRes = await fetch(`https://openlibrary.org${olData.authors[0].author.key}.json`);
            if (aRes.ok) {
              const aData = await aRes.json();
              if (aData.name) author = aData.name;
            }
          } catch {}
        }

        if (!iaId) {
          throw new Error("This edition does not have an open public scan available for full online reading.");
        }

        return {
          id: `ol:${olKey}`,
          title,
          author,
          source: "openlibrary",
          cover: olData.covers?.[0] ? `https://covers.openlibrary.org/b/id/${olData.covers[0]}-L.jpg` : `https://archive.org/services/img/${iaId}`,
          embedUrl: `https://archive.org/embed/${iaId}`,
          access: "read_only",
          paragraphs: [],
          sections: [],
          externalUrl: `https://openlibrary.org/works/${olKey}`,
          description: typeof olData.description === "string" ? olData.description : olData.description?.value || ""
        };
      });

      return json(result, 200, 21600);
    } catch (e) {
      return json({ error: "Failed to load ebook content: " + e.message }, 502);
    }
  }

  /* ---------- Music Engine (JioSaavn Gateway) ---------- */
  if (path.startsWith("/api/music/")) {
    if (path === "/api/music/search" || path === "/api/music/piped/search") {
      const term = q("q") || q("query");
      const limit = parseInt(q("limit", "20"), 10) || 20;
      const provider = (q("provider") || q("engine") || (path.includes("piped") ? "piped" : "saavn")).toLowerCase();
      if (!term) return json({ success: true, results: [] });
      try {
        if (provider === "piped" || provider === "youtube") {
          const results = await cached(`piped:search:${term}:${limit}`, 1800e3, () => searchPiped(term, limit));
          return json({ success: true, results: results || [] }, 200, 1800);
        }
        const results = await cached(`saavn:search:${term}:${limit}`, 3600e3, () => searchSaavn(term, limit));
        return json({ success: true, results: results || [] }, 200, 1800);
      } catch (e) {
        return json({ success: false, error: e.message, results: [] }, 502);
      }
    }

    if (path === "/api/music/trending" || path === "/api/music/piped/trending") {
      const limit = parseInt(q("limit", "20"), 10) || 20;
      const provider = (q("provider") || q("engine") || (path.includes("piped") ? "piped" : "saavn")).toLowerCase();
      try {
        if (provider === "piped" || provider === "youtube") {
          const results = await cached(`piped:trending:${limit}`, 1800e3, () => getTrendingPiped(limit));
          return json({ success: true, results: results || [] }, 200, 1800);
        }
        const results = await cached(`saavn:trending:${limit}`, 3600e3, () => getTrendingSaavn(limit));
        return json({ success: true, results: results || [] }, 200, 3600);
      } catch (e) {
        return json({ success: false, error: e.message, results: [] }, 502);
      }
    }

    if (path === "/api/music/piped/stream" || path === "/api/music/stream") {
      const videoId = q("id") || q("videoId");
      if (!videoId) return json({ success: false, error: "Missing videoId" }, 400);
      try {
        const streamUrl = await resolvePipedStream(videoId);
        return json({ success: Boolean(streamUrl), streamUrl });
      } catch (e) {
        return json({ success: false, error: e.message }, 502);
      }
    }

    return json({ error: "Unknown music endpoint" }, 404);
  }
  return null;
}
