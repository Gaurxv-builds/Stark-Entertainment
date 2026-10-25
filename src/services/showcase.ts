/**
 * Artwork pools for the rotating hero images (landing cards, Manga / Novels hero).
 * Anime + manga come from AniList's most popular and trending lists (One Piece, Naruto, Bleach…), novels from Lnori's
 * library with NovelFire as a fallback. Pools are cached for a few hours; the shuffle happens on every page view.
 */
import { apiUrl } from './api'
import { fetchNovelHome } from './novel'

export interface ShowcaseImage {
  /** portrait cover art */
  src: string
  /** landscape banner, when the title has one */
  wide?: string | null
  title: string
  color?: string | null
}
export type ShowcaseKind = 'anime' | 'manga' | 'novel' | 'movies' | 'ebooks'
export type ShowcasePools = Record<ShowcaseKind, ShowcaseImage[]>

const ENDPOINT = 'https://graphql.anilist.co'
const LS_KEY = 'zk:showcase:v1'
const TTL = 6 * 3600e3

interface AniNode {
  id: number
  title: { romaji: string | null; english: string | null }
  bannerImage: string | null
  coverImage: { extraLarge: string | null; large: string | null; color: string | null }
}

const FIELDS = 'id title { romaji english } bannerImage coverImage { extraLarge large color }'
const QUERY = `query {
  animePop: Page(perPage: 30) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${FIELDS} } }
  animeTrend: Page(perPage: 20) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${FIELDS} } }
  mangaPop: Page(perPage: 30) { media(type: MANGA, sort: POPULARITY_DESC, isAdult: false) { ${FIELDS} } }
  mangaTrend: Page(perPage: 20) { media(type: MANGA, sort: TRENDING_DESC, isAdult: false) { ${FIELDS} } }
}`

/** Fisher–Yates, returns a new array. */
export function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function toImages(...lists: AniNode[][]): ShowcaseImage[] {
  const seen = new Set<number>()
  const out: ShowcaseImage[] = []
  for (const n of lists.flat()) {
    const src = n.coverImage.extraLarge || n.coverImage.large
    if (!src || seen.has(n.id)) continue
    seen.add(n.id)
    out.push({ src, wide: n.bannerImage, title: n.title.english || n.title.romaji || 'Untitled', color: n.coverImage.color })
  }
  return out
}

async function loadAniList(): Promise<Pick<ShowcasePools, 'anime' | 'manga'>> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const { at, v } = JSON.parse(raw) as { at: number; v: Pick<ShowcasePools, 'anime' | 'manga'> }
      if (Date.now() - at < TTL && v.anime?.length && v.manga?.length) return v
    }
  } catch {
    /* no storage / corrupt cache: just fetch */
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  })
  const json = (await res.json().catch(() => null)) as { data?: Record<'animePop' | 'animeTrend' | 'mangaPop' | 'mangaTrend', { media: AniNode[] }> } | null
  if (!res.ok || !json?.data) throw new Error(`AniList request failed (${res.status})`)
  const d = json.data
  const v = { anime: toImages(d.animePop.media, d.animeTrend.media), manga: toImages(d.mangaPop.media, d.mangaTrend.media) }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), v }))
  } catch {
    /* storage full or blocked */
  }
  return v
}

async function loadNovels(): Promise<ShowcaseImage[]> {
  for (const source of ['lnori', 'novelfire'] as const) {
    try {
      const home = await fetchNovelHome(source)
      const seen = new Set<string>()
      const out = [...home.rankings, ...home.popular]
        .filter((n) => n.cover && !seen.has(n.cover) && seen.add(n.cover))
        .map((n) => ({ src: n.cover, title: n.title }))
      if (out.length >= 3) return out
    } catch {
      /* try the next source */
    }
  }
  return []
}

/** Trending movies from TMDB (through our own /api/movies); empty when the API is down. */
async function loadMovies(): Promise<ShowcaseImage[]> {
  type Raw = { results?: { title?: string; poster_path?: string | null; backdrop_path?: string | null }[] }
  const load = async (url: string): Promise<Raw> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as Raw
  }
  try {
    // our own API first; the public TMDB proxy as a fallback so the card never stays empty
    const d = await load('https://aniversee.vercel.app/api/tmdb/trending/movie/week').catch(() => load(apiUrl('/api/movies/trending/movie/week')))
    return (d.results ?? [])
      .filter((m) => m.poster_path)
      .map((m) => ({ src: `https://image.tmdb.org/t/p/w780${m.poster_path}`, wide: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null, title: m.title ?? 'Movie' }))
  } catch {
    return []
  }
}

async function loadEbooksShowcase(): Promise<ShowcaseImage[]> {
  try {
    const res = await fetch('https://gutendex.com/books/?sort=popular')
    if (!res.ok) return []
    const json = await res.json()
    return (json.results ?? [])
      .filter((b: { formats?: Record<string, string> }) => b.formats?.['image/jpeg'])
      .slice(0, 15)
      .map((b: { title?: string; formats: Record<string, string> }) => ({
        src: b.formats['image/jpeg'],
        title: b.title ?? 'Ebook',
      }))
  } catch {
    return []
  }
}

let pools: Promise<ShowcasePools> | null = null

/** One shared load for the whole page; a source that fails just yields an empty pool (the card keeps its plain look). */
export function fetchShowcase(): Promise<ShowcasePools> {
  pools ??= (async () => {
    const [ani, novel, movies, ebooks] = await Promise.all([loadAniList().catch(() => ({ anime: [], manga: [] })), loadNovels(), loadMovies(), loadEbooksShowcase()])
    return { anime: ani.anime, manga: ani.manga, novel, movies, ebooks }
  })()
  return pools
}
