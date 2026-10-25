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

export const DEFAULT_SHOWCASE: ShowcasePools = {
  anime: [
    { src: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg', title: 'One Piece' },
    { src: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg', title: 'Attack on Titan' },
    { src: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg', title: 'Jujutsu Kaisen' },
    { src: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTyeRepL.png', title: 'Demon Slayer' },
    { src: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-lawCwhqnflbR.jpg', title: 'Death Note' },
  ],
  manga: [
    { src: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002-772L4USrLj47.jpg', title: 'Berserk' },
    { src: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105778-5mmsa4h5wZ45.jpg', title: 'Chainsaw Man' },
    { src: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b6b12a8740b2.jpg', title: 'Solo Leveling' },
    { src: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30656-7Uti7kE4pZ9E.jpg', title: 'Vagabond' },
  ],
  novel: [
    { src: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=780&q=80', title: 'Light Novel' },
    { src: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=780&q=80', title: 'Web Novel' },
    { src: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&w=780&q=80', title: 'Fantasy Novel' },
  ],
  movies: [
    { src: 'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', title: 'Interstellar' },
    { src: 'https://image.tmdb.org/t/p/w780/d5NXSklXo0qyIYkgV94XAgMIckC.jpg', title: 'Dune: Part Two' },
    { src: 'https://image.tmdb.org/t/p/w780/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', title: 'Spider-Man' },
    { src: 'https://image.tmdb.org/t/p/w780/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg', title: 'Avengers: Infinity War' },
  ],
  ebooks: [
    { src: 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg', title: 'Frankenstein' },
    { src: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg', title: 'Pride and Prejudice' },
    { src: 'https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg', title: 'Dracula' },
    { src: 'https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg', title: 'The Adventures of Sherlock Holmes' },
  ],
}

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

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 3500): Promise<Response> {
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctl.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

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

  try {
    const res = await fetchWithTimeout(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    }, 3500)
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
  } catch {
    return { anime: DEFAULT_SHOWCASE.anime, manga: DEFAULT_SHOWCASE.manga }
  }
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
  return DEFAULT_SHOWCASE.novel
}

/** Trending movies from TMDB (through our own /api/movies); empty when the API is down. */
async function loadMovies(): Promise<ShowcaseImage[]> {
  type Raw = { results?: { title?: string; poster_path?: string | null; backdrop_path?: string | null }[] }
  const load = async (url: string): Promise<Raw> => {
    const res = await fetchWithTimeout(url, undefined, 3500)
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as Raw
  }
  try {
    const d = await load('https://aniversee.vercel.app/api/tmdb/trending/movie/week').catch(() => load(apiUrl('/api/movies/trending/movie/week')))
    const list = (d.results ?? [])
      .filter((m) => m.poster_path)
      .map((m) => ({ src: `https://image.tmdb.org/t/p/w780${m.poster_path}`, wide: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null, title: m.title ?? 'Movie' }))
    return list.length ? list : DEFAULT_SHOWCASE.movies
  } catch {
    return DEFAULT_SHOWCASE.movies
  }
}

async function loadEbooksShowcase(): Promise<ShowcaseImage[]> {
  try {
    const res = await fetchWithTimeout('https://gutendex.com/books/?sort=popular', undefined, 3000)
    if (!res.ok) return DEFAULT_SHOWCASE.ebooks
    const json = await res.json()
    const list = (json.results ?? [])
      .filter((b: { formats?: Record<string, string> }) => b.formats?.['image/jpeg'])
      .slice(0, 15)
      .map((b: { title?: string; formats: Record<string, string> }) => ({
        src: b.formats['image/jpeg'],
        title: b.title ?? 'Ebook',
      }))
    return list.length ? list : DEFAULT_SHOWCASE.ebooks
  } catch {
    return DEFAULT_SHOWCASE.ebooks
  }
}

let pools: Promise<ShowcasePools> | null = null

/** One shared load for the whole page; individual loaders fall back to curated defaults on timeout or error. */
export function fetchShowcase(): Promise<ShowcasePools> {
  pools ??= (async () => {
    const [ani, novel, movies, ebooks] = await Promise.all([
      loadAniList().catch(() => ({ anime: DEFAULT_SHOWCASE.anime, manga: DEFAULT_SHOWCASE.manga })),
      loadNovels().catch(() => DEFAULT_SHOWCASE.novel),
      loadMovies().catch(() => DEFAULT_SHOWCASE.movies),
      loadEbooksShowcase().catch(() => DEFAULT_SHOWCASE.ebooks),
    ])
    return {
      anime: ani.anime?.length ? ani.anime : DEFAULT_SHOWCASE.anime,
      manga: ani.manga?.length ? ani.manga : DEFAULT_SHOWCASE.manga,
      novel: novel?.length ? novel : DEFAULT_SHOWCASE.novel,
      movies: movies?.length ? movies : DEFAULT_SHOWCASE.movies,
      ebooks: ebooks?.length ? ebooks : DEFAULT_SHOWCASE.ebooks,
    }
  })()
  return pools
}
