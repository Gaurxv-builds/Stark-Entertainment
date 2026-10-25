import { apiUrl } from './api'
/**
 * Ebooks service integrating Project Gutenberg (via Gutendex) and Open Library.
 * Fully typed, cached, and resilient to API outages or partial metadata.
 */

export type EbookSource = 'gutenberg' | 'openlibrary'
export type EbookScope = 'all' | EbookSource

export type EbookAccess = 'read_and_download' | 'read_only' | 'borrow' | 'catalog'

export interface EbookItem {
  id: string
  source: EbookSource
  title: string
  authors: string[]
  cover: string | null
  year?: number | null
  subjects?: string[]
  downloads?: number
  access: EbookAccess
  readUrl?: string | null
  downloadUrl?: string | null // EPUB direct file
  externalUrl: string
  description?: string | null
}

export interface EbookCategory {
  id: string
  label: string
  gutenbergTopic?: string
  openLibrarySubject?: string
}

export const EBOOK_CATEGORIES: EbookCategory[] = [
  { id: 'all', label: 'All' },
  { id: 'fiction', label: 'Fiction', gutenbergTopic: 'fiction', openLibrarySubject: 'fiction' },
  { id: 'fantasy', label: 'Fantasy', gutenbergTopic: 'fantasy', openLibrarySubject: 'fantasy' },
  { id: 'science', label: 'Science', gutenbergTopic: 'science', openLibrarySubject: 'science' },
  { id: 'history', label: 'History', gutenbergTopic: 'history', openLibrarySubject: 'history' },
  { id: 'technology', label: 'Technology', gutenbergTopic: 'technology', openLibrarySubject: 'technology' },
  { id: 'philosophy', label: 'Philosophy', gutenbergTopic: 'philosophy', openLibrarySubject: 'philosophy' },
  { id: 'mystery', label: 'Mystery', gutenbergTopic: 'mystery', openLibrarySubject: 'mystery_and_detective_stories' },
]

export const EBOOK_SOURCES: { id: EbookScope; label: string }[] = [
  { id: 'all', label: 'All Sources' },
  { id: 'gutenberg', label: 'Project Gutenberg' },
  { id: 'openlibrary', label: 'Open Library' },
]

/* ---------- In-memory cache to prevent redundant fetches ---------- */
const cache = new Map<string, { time: number; data: EbookItem[] }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCached(key: string): EbookItem[] | null {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data
  return null
}

function setCache(key: string, data: EbookItem[]) {
  cache.set(key, { time: Date.now(), data })
}

/* ---------- Normalizers ---------- */

interface GutendexBook {
  id: number
  title: string
  authors?: { name: string; birth_year?: number; death_year?: number }[]
  subjects?: string[]
  bookshelves?: string[]
  formats: Record<string, string>
  download_count: number
}

function normalizeGutendex(b: GutendexBook): EbookItem {
  // Format author names: "Austen, Jane" -> "Jane Austen"
  const authors = (b.authors ?? []).map((a) => {
    if (a.name.includes(',')) {
      const [last, first] = a.name.split(',').map((s) => s.trim())
      return first ? `${first} ${last}` : last
    }
    return a.name
  })

  const cover = b.formats['image/jpeg'] || null
  const htmlUrl = b.formats['text/html'] || b.formats['text/html; charset=utf-8'] || null
  const epubUrl = b.formats['application/epub+zip'] || null

  return {
    id: `pg:${b.id}`,
    source: 'gutenberg',
    title: b.title,
    authors: authors.length > 0 ? authors : ['Unknown Author'],
    cover,
    subjects: b.subjects?.slice(0, 3) ?? [],
    downloads: b.download_count,
    access: epubUrl || htmlUrl ? 'read_and_download' : 'catalog',
    readUrl: htmlUrl || `https://www.gutenberg.org/ebooks/${b.id}`,
    downloadUrl: epubUrl,
    externalUrl: `https://www.gutenberg.org/ebooks/${b.id}`,
  }
}

interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  has_fulltext?: boolean
  ia?: string[]
}

function normalizeOpenLibrarySearch(doc: OpenLibraryDoc): EbookItem {
  const key = doc.key.replace(/^\/works\//, '')
  const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null
  const iaId = doc.ia?.[0]

  let access: EbookAccess = 'catalog'
  let readUrl: string | null = null

  if (doc.has_fulltext && iaId) {
    access = 'read_only'
    readUrl = `https://archive.org/details/${iaId}/mode/2up`
  } else {
    readUrl = `https://openlibrary.org/works/${key}`
  }

  return {
    id: `ol:${key}`,
    source: 'openlibrary',
    title: doc.title,
    authors: doc.author_name?.length ? doc.author_name.slice(0, 2) : ['Unknown Author'],
    cover,
    year: doc.first_publish_year ?? null,
    access,
    readUrl,
    externalUrl: `https://openlibrary.org/works/${key}`,
  }
}

interface OpenLibraryWork {
  key: string
  title: string
  authors?: { name: string }[]
  first_publish_year?: number
  cover_id?: number
  availability?: {
    status?: string
    is_readable?: boolean
    is_lendable?: boolean
    identifier?: string
  }
}

function normalizeOpenLibrarySubject(w: OpenLibraryWork): EbookItem {
  const key = w.key.replace(/^\/works\//, '')
  const cover = w.cover_id ? `https://covers.openlibrary.org/b/id/${w.cover_id}-M.jpg` : null
  const av = w.availability
  const iaId = av?.identifier

  let access: EbookAccess = 'catalog'
  let readUrl: string | null = null

  if (av?.status === 'open' || av?.is_readable) {
    access = 'read_only'
    readUrl = iaId ? `https://archive.org/details/${iaId}/mode/2up` : `https://openlibrary.org/works/${key}`
  } else if (av?.is_lendable || av?.status === 'borrow_available') {
    access = 'borrow'
    readUrl = `https://openlibrary.org/works/${key}`
  } else {
    readUrl = `https://openlibrary.org/works/${key}`
  }

  return {
    id: `ol:${key}`,
    source: 'openlibrary',
    title: w.title,
    authors: w.authors?.length ? w.authors.map((a) => a.name).slice(0, 2) : ['Unknown Author'],
    cover,
    year: w.first_publish_year ?? null,
    access,
    readUrl,
    externalUrl: `https://openlibrary.org/works/${key}`,
  }
}

/* ---------- API Fetchers ---------- */

/** Fetch popular books from Project Gutenberg */
export async function fetchGutenbergBooks(topic?: string): Promise<EbookItem[]> {
  const cacheKey = `gutendex:${topic || 'popular'}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = topic
    ? `https://gutendex.com/books/?topic=${encodeURIComponent(topic)}`
    : 'https://gutendex.com/books/?sort=popular'

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Project Gutenberg error: ${res.status}`)

  const json = await res.json()
  const items = (json.results as GutendexBook[]).map(normalizeGutendex)
  setCache(cacheKey, items)
  return items
}

/** Search Project Gutenberg by keyword */
export async function searchGutenberg(query: string): Promise<EbookItem[]> {
  const q = query.trim()
  if (!q) return []

  const cacheKey = `gutendex:search:${q.toLowerCase()}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `https://gutendex.com/books/?search=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Project Gutenberg search error: ${res.status}`)

  const json = await res.json()
  const items = (json.results as GutendexBook[]).map(normalizeGutendex)
  setCache(cacheKey, items)
  return items
}

/** Fetch books from Open Library by subject */
export async function fetchOpenLibrarySubject(subject: string): Promise<EbookItem[]> {
  const cacheKey = `openlibrary:subject:${subject}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=24`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Open Library error: ${res.status}`)

  const json = await res.json()
  const items = (json.works as OpenLibraryWork[]).map(normalizeOpenLibrarySubject)
  setCache(cacheKey, items)
  return items
}

/** Search Open Library by keyword */
export async function searchOpenLibrary(query: string): Promise<EbookItem[]> {
  const q = query.trim()
  if (!q) return []

  const cacheKey = `openlibrary:search:${q.toLowerCase()}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=24`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Open Library search error: ${res.status}`)

  const json = await res.json()
  const items = (json.docs as OpenLibraryDoc[]).map(normalizeOpenLibrarySearch)
  setCache(cacheKey, items)
  return items
}

/** Unified Search across selected source */
export async function searchEbooks(query: string, scope: EbookScope = 'all'): Promise<EbookItem[]> {
  const q = query.trim()
  if (!q) return []

  if (scope === 'gutenberg') return searchGutenberg(q)
  if (scope === 'openlibrary') return searchOpenLibrary(q)

  // Fetch both concurrently with error tolerance
  const [pg, ol] = await Promise.all([
    searchGutenberg(q).catch(() => [] as EbookItem[]),
    searchOpenLibrary(q).catch(() => [] as EbookItem[]),
  ])

  // Interleave results for source variety
  const merged: EbookItem[] = []
  const max = Math.max(pg.length, ol.length)
  for (let i = 0; i < max; i++) {
    if (i < pg.length) merged.push(pg[i])
    if (i < ol.length) merged.push(ol[i])
  }
  return merged
}

/** Fetch books by category filter across selected source */
export async function fetchEbooksByCategory(categoryId: string, scope: EbookScope = 'all'): Promise<EbookItem[]> {
  const cat = EBOOK_CATEGORIES.find((c) => c.id === categoryId)
  if (!cat || cat.id === 'all') {
    return fetchEbooksHome(scope).then((h) => h.featured)
  }

  if (scope === 'gutenberg') {
    return fetchGutenbergBooks(cat.gutenbergTopic || cat.id)
  }
  if (scope === 'openlibrary') {
    return fetchOpenLibrarySubject(cat.openLibrarySubject || cat.id)
  }

  const [pg, ol] = await Promise.all([
    fetchGutenbergBooks(cat.gutenbergTopic || cat.id).catch(() => [] as EbookItem[]),
    fetchOpenLibrarySubject(cat.openLibrarySubject || cat.id).catch(() => [] as EbookItem[]),
  ])

  const merged: EbookItem[] = []
  const max = Math.max(pg.length, ol.length)
  for (let i = 0; i < max; i++) {
    if (i < pg.length) merged.push(pg[i])
    if (i < ol.length) merged.push(ol[i])
  }
  return merged
}

export interface EbookHomeData {
  featured: EbookItem[]
  classics: EbookItem[]
  science: EbookItem[]
  philosophy: EbookItem[]
}

/** Fetch curated homepage shelves */
export async function fetchEbooksHome(scope: EbookScope = 'all'): Promise<EbookHomeData> {
  const cacheKey = `ebooks:home:${scope}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    const d = cached.data as unknown as EbookHomeData
    if (d.featured) return d
  }

  if (scope === 'gutenberg') {
    const [featured, classics, science, philosophy] = await Promise.all([
      fetchGutenbergBooks(),
      fetchGutenbergBooks('fiction'),
      fetchGutenbergBooks('science'),
      fetchGutenbergBooks('philosophy'),
    ])
    const out: EbookHomeData = { featured, classics, science, philosophy }
    cache.set(cacheKey, { time: Date.now(), data: out as unknown as EbookItem[] })
    return out
  }

  if (scope === 'openlibrary') {
    const [featured, classics, science, philosophy] = await Promise.all([
      fetchOpenLibrarySubject('classic_literature'),
      fetchOpenLibrarySubject('fiction'),
      fetchOpenLibrarySubject('science'),
      fetchOpenLibrarySubject('philosophy'),
    ])
    const out: EbookHomeData = { featured, classics, science, philosophy }
    cache.set(cacheKey, { time: Date.now(), data: out as unknown as EbookItem[] })
    return out
  }

  // Combined sources
  const [pgPop, olClassics, pgSci, olPhil] = await Promise.all([
    fetchGutenbergBooks().catch(() => [] as EbookItem[]),
    fetchOpenLibrarySubject('classic_literature').catch(() => [] as EbookItem[]),
    fetchGutenbergBooks('science').catch(() => [] as EbookItem[]),
    fetchOpenLibrarySubject('philosophy').catch(() => [] as EbookItem[]),
  ])

  const out: EbookHomeData = {
    featured: pgPop.slice(0, 18),
    classics: olClassics.slice(0, 18),
    science: pgSci.slice(0, 18),
    philosophy: olPhil.slice(0, 18),
  }

  cache.set(cacheKey, { time: Date.now(), data: out as unknown as EbookItem[] })
  return out
}

export interface EbookSection {
  title: string
  index: number
}

export interface EbookContent {
  id: string
  title: string
  author: string
  source: EbookSource
  cover?: string | null
  paragraphs: string[]
  sections: EbookSection[]
  access: EbookAccess
  description?: string | null
  borrowUrl?: string | null
  message?: string | null
  externalUrl?: string | null
}

export async function fetchEbookContent(id: string): Promise<EbookContent> {
  const res = await fetch(apiUrl(`/api/ebooks/content?id=${encodeURIComponent(id)}`))
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `Failed to load ebook content (${res.status})`)
  }
  return (await res.json()) as EbookContent
}
