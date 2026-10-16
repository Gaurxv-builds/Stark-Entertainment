import type { Mapping, Tmdb, TmdbBundle } from './api'

/**
 * Anime TMDB info straight from the browser, the same way Movies already works (no Worker request).
 * Same steps and same result shape as tmdbFor() in server/handler.js; api.ts tries this first and
 * falls back to the /api/tmdb server route when anything here fails.
 */
const TMDB = 'https://aniversee.vercel.app/api/tmdb'
const ANIBRIDGE = 'https://anibridge.eliasbenb.dev/api/mappings?source.descriptor=anilist:'
const ARM = 'https://arm.haglund.dev/api/v2/ids?source=anilist&id='

/* eslint-disable @typescript-eslint/no-explicit-any */
const get = async (url: string, ms = 12000): Promise<any> => {
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally {
    window.clearTimeout(t)
  }
}

function parseMapping(data: unknown, anilist: number): Mapping {
  const out: Mapping = { anilist, mal: null, tmdb: null, tvdb: null, imdb: null, anidb: null, source: 'anibridge' }
  const seen: string[] = []
  const walk = (v: any) => {
    if (!v) return
    if (typeof v === 'string') {
      if (/^[a-z_]+:[^\s]+$/i.test(v)) seen.push(v)
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(data)
  for (const d of seen) {
    const [provider, id, scope] = d.split(':')
    const p = provider.toLowerCase()
    const season = scope && /^s\d+$/i.test(scope) ? parseInt(scope.slice(1), 10) : null
    if ((p === 'mal' || p === 'myanimelist') && !out.mal) out.mal = Number(id) || null
    else if (p.startsWith('tmdb') && !out.tmdb) out.tmdb = { id: Number(id), type: p.includes('movie') ? 'movie' : 'tv', season }
    else if (p.startsWith('tvdb') && !out.tvdb) out.tvdb = Number(id) || null
    else if (p.startsWith('imdb') && !out.imdb) out.imdb = id
    else if (p === 'anidb' && !out.anidb) out.anidb = Number(id) || null
  }
  return out
}

async function mapOf(anilist: number): Promise<Mapping | null> {
  try {
    const m = parseMapping(await get(ANIBRIDGE + anilist), anilist)
    if (m.mal || m.tmdb || m.imdb) return m
  } catch {
    /* try ARM */
  }
  try {
    const a = await get(ARM + anilist)
    return {
      anilist,
      mal: a.myanimelist ?? null,
      tmdb: a.themoviedb ? { id: a.themoviedb, type: a.type === 'MOVIE' ? 'movie' : 'tv', season: a['themoviedb-season'] ?? null } : null,
      tvdb: a.thetvdb ?? null,
      imdb: a.imdb ?? null,
      anidb: a.anidb ?? null,
      source: 'arm',
    }
  } catch {
    return null
  }
}

const cleanTitle = (t = '') =>
  t
    .replace(/\s*\(\d{4}\)\s*$/g, '')
    .replace(/\s*(Final Season|Season\s+\d+|\d+(st|nd|rd|th)\s+Season|Cour\s+\d+|Part\s+\d+)\s*$/gi, '')
    .replace(/\s*:\s*$/, '')
    .trim()

export async function tmdbDirect(anilistId: number, title: string, format?: string | null): Promise<TmdbBundle> {
  const map = anilistId ? await mapOf(anilistId) : null
  let ref = map?.tmdb ? { id: map.tmdb.id, type: map.tmdb.type, season: map.tmdb.season } : null

  if (!ref && title) {
    try {
      const want = format === 'MOVIE' ? 'movie' : 'tv'
      const res = await get(`${TMDB}/search/multi?query=${encodeURIComponent(cleanTitle(title) || title)}`)
      const hit = res.results?.find((r: any) => r.media_type === want) || res.results?.find((r: any) => r.media_type === 'tv' || r.media_type === 'movie')
      if (hit) ref = { id: hit.id, type: hit.media_type, season: null }
    } catch {
      /* no match */
    }
  }
  if (!ref) return { mapping: map, tmdb: null }

  const d = await get(
    `${TMDB}/${ref.type}/${ref.id}?language=en-US&append_to_response=images,videos,credits,external_ids,content_ratings,release_dates&include_image_language=en,null`,
  )
  const pngs = (d.images?.logos || []).filter((l: any) => l.file_path && !l.file_path.toLowerCase().endsWith('.svg'))
  const logo = pngs.sort((a: any, b: any) => Number(b.iso_639_1 === 'en') - Number(a.iso_639_1 === 'en') || b.vote_average - a.vote_average)[0]?.file_path ?? null
  const textless = (d.images?.backdrops || []).filter((b: any) => !b.iso_639_1).sort((a: any, b: any) => b.vote_average - a.vote_average)
  const backdrops: string[] = (textless.length ? textless : d.images?.backdrops || []).slice(0, 6).map((b: any) => b.file_path)
  const certification =
    d.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US')?.rating ||
    d.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US')?.release_dates?.find((x: any) => x.certification)?.certification ||
    null
  const yt = (d.videos?.results || []).find((v: any) => v.site === 'YouTube' && /trailer|teaser/i.test(v.type))

  const tmdb: Tmdb = {
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
    networks: (d.networks || d.production_companies || []).slice(0, 4).map((n: any) => n.name),
    status: d.status || null,
    language: d.original_language || null,
    seasons: d.number_of_seasons ?? null,
    episodes: d.number_of_episodes ?? null,
    firstAir: d.first_air_date || d.release_date || null,
    lastAir: d.last_air_date || null,
    runtime: d.episode_run_time?.[0] || d.runtime || null,
    cast: (d.credits?.cast || []).slice(0, 10).map((c: any) => ({ name: c.name, character: c.character, photo: c.profile_path })),
    trailer: yt ? yt.key : null,
  }
  return { mapping: map, tmdb }
}

export async function tmdbEpisodesDirect(tmdbId: number, season: number): Promise<{ n: number; name: string | null; overview: string | null; still: string | null; runtime: number | null; air: string | null }[]> {
  const d = await get(`${TMDB}/tv/${tmdbId}/season/${season}?language=en-US`)
  return (d.episodes || []).map((e: any) => ({ n: e.episode_number, name: e.name || null, overview: e.overview || null, still: e.still_path || null, runtime: e.runtime || null, air: e.air_date || null }))
}
