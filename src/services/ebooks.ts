import { apiUrl } from './api'

/**
 * Ebooks service integrating Project Gutenberg (via Gutendex), Internet Archive,
 * and Open Library public scans.
 *
 * Strict policy: ONLY books that are 100% available for complete, internal online reading
 * are included. All borrow-only or lending-gated items are strictly filtered out.
 */

export type EbookSource = 'gutenberg' | 'internetarchive' | 'openlibrary'
export type EbookScope = 'all' | EbookSource

export type EbookAccess = 'read_and_download' | 'read_only'

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
  readUrl: string
  downloadUrl?: string | null
  externalUrl: string
  description?: string | null
}

export interface EbookCategory {
  id: string
  label: string
  gutenbergTopic?: string
  iaQuery?: string
  openLibrarySubject?: string
}

export const EBOOK_CATEGORIES: EbookCategory[] = [
  { id: 'all', label: 'All Reads' },
  { id: 'literature', label: 'Literature & Fiction', gutenbergTopic: 'fiction', iaQuery: '(subject:fiction OR subject:literature OR subject:novel)', openLibrarySubject: 'fiction' },
  { id: 'textbooks', label: 'Academic & Textbooks', gutenbergTopic: 'education', iaQuery: '(subject:textbook OR title:textbook OR subject:"open educational resources")', openLibrarySubject: 'textbooks' },
  { id: 'science', label: 'Science & Nature', gutenbergTopic: 'science', iaQuery: '(subject:science OR subject:physics OR subject:biology OR subject:chemistry OR subject:astronomy)', openLibrarySubject: 'science' },
  { id: 'technology', label: 'Tech & Computing', gutenbergTopic: 'technology', iaQuery: '(subject:technology OR subject:computing OR subject:"computer science" OR subject:programming)', openLibrarySubject: 'computer_science' },
  { id: 'history', label: 'History & Biography', gutenbergTopic: 'history', iaQuery: '(subject:history OR subject:biography OR subject:"world history")', openLibrarySubject: 'history' },
  { id: 'philosophy', label: 'Philosophy & Ideas', gutenbergTopic: 'philosophy', iaQuery: '(subject:philosophy OR title:philosophy OR subject:ethics)', openLibrarySubject: 'philosophy' },
  { id: 'mystery', label: 'Mystery & Thriller', gutenbergTopic: 'mystery', iaQuery: '(subject:mystery OR subject:detective OR subject:thriller)', openLibrarySubject: 'mystery_and_detective_stories' },
]

export const EBOOK_SOURCES: { id: EbookScope; label: string }[] = [
  { id: 'all', label: 'All Catalogs' },
  { id: 'gutenberg', label: 'Project Gutenberg' },
  { id: 'internetarchive', label: 'Internet Archive' },
  { id: 'openlibrary', label: 'Open Library' },
]

/* ---------- In-memory cache ---------- */
const cache = new Map<string, { time: number; data: unknown }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCached<T>(key: string): T | null {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data as T
  return null
}

function setCache<T>(key: string, data: T) {
  cache.set(key, { time: Date.now(), data })
}

function cleanTitle(t: string): string {
  return t
    .replace(/\s+/g, ' ')
    .replace(/^the project gutenberg (?:ebook|edition) of\s+/i, '')
    .replace(/:\s*\$b\s*/g, ': ')
    .trim()
}

/* ---------- Project Gutenberg (via Gutendex) ---------- */
interface GutendexBook {
  id: number
  title: string
  authors?: { name: string; birth_year?: number; death_year?: number }[]
  subjects?: string[]
  bookshelves?: string[]
  formats: Record<string, string>
  download_count: number
}

function normalizeGutendex(b: GutendexBook): EbookItem | null {
  const epubUrl = b.formats['application/epub+zip'] || null
  const htmlUrl = b.formats['text/html'] || b.formats['text/html; charset=utf-8'] || null
  const txtUrl = b.formats['text/plain'] || b.formats['text/plain; charset=utf-8'] || null

  // Ensure fully readable
  if (!htmlUrl && !epubUrl && !txtUrl) return null

  const authors = (b.authors ?? []).map((a) => {
    if (a.name.includes(',')) {
      const [last, first] = a.name.split(',').map((s) => s.trim())
      return first ? `${first} ${last}` : last
    }
    return a.name
  })

  const cover = b.formats['image/jpeg'] || `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`

  return {
    id: `pg:${b.id}`,
    source: 'gutenberg',
    title: cleanTitle(b.title),
    authors: authors.length > 0 ? authors : ['Unknown Author'],
    cover,
    subjects: b.subjects?.slice(0, 3) ?? [],
    downloads: b.download_count,
    access: 'read_and_download',
    readUrl: `/ebooks/read/${encodeURIComponent('pg:' + b.id)}`,
    downloadUrl: epubUrl,
    externalUrl: `https://www.gutenberg.org/ebooks/${b.id}`,
  }
}

export async function fetchGutenbergBooks(topic?: string, search?: string): Promise<EbookItem[]> {
  const key = `pg:${topic ?? 'all'}:${search ?? ''}`
  const cached = getCached<EbookItem[]>(key)
  if (cached) return cached

  const url = new URL('https://gutendex.com/books')
  if (topic && topic !== 'all') url.searchParams.set('topic', topic)
  if (search) url.searchParams.set('search', search)

  try {
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Gutendex returned ${res.status}`)
    const data = await res.json()
    const results = (data.results ?? [])
      .map(normalizeGutendex)
      .filter((b: EbookItem | null): b is EbookItem => b !== null)

    setCache(key, results)
    return results
  } catch (err) {
    console.warn('Gutenberg fetch failed:', err)
    return []
  }
}

/* ---------- Internet Archive Texts & Open Books ---------- */
interface IaDoc {
  identifier: string
  title?: string
  creator?: string | string[]
  year?: number | string
  downloads?: number
  subject?: string | string[]
  description?: string | string[]
}

function normalizeIa(doc: IaDoc): EbookItem | null {
  if (!doc.identifier || !doc.title) return null

  let authors: string[] = ['Unknown Author']
  if (doc.creator) {
    if (Array.isArray(doc.creator)) authors = doc.creator.map((a) => a.trim()).filter(Boolean)
    else authors = [doc.creator.trim()]
  }

  let subjects: string[] = []
  if (doc.subject) {
    if (Array.isArray(doc.subject)) subjects = doc.subject.slice(0, 3)
    else subjects = [doc.subject]
  }

  return {
    id: `ia:${doc.identifier}`,
    source: 'internetarchive',
    title: cleanTitle(doc.title),
    authors: authors.length > 0 ? authors : ['Unknown Author'],
    cover: `https://archive.org/services/img/${doc.identifier}`,
    year: doc.year ? Number(doc.year) || null : null,
    subjects,
    downloads: typeof doc.downloads === 'number' ? doc.downloads : 0,
    access: 'read_only',
    readUrl: `/ebooks/read/${encodeURIComponent('ia:' + doc.identifier)}`,
    externalUrl: `https://archive.org/details/${doc.identifier}`,
    description: Array.isArray(doc.description) ? doc.description[0] : doc.description ?? null,
  }
}

export async function fetchInternetArchive(query?: string, categoryQuery?: string): Promise<EbookItem[]> {
  const key = `ia:${query ?? ''}:${categoryQuery ?? ''}`
  const cached = getCached<EbookItem[]>(key)
  if (cached) return cached

  // Strictly exclude lendinglibrary and inlibrary to hide borrow-only works
  let q = 'mediatype:texts AND NOT collection:(lendinglibrary) AND NOT collection:(inlibrary)'
  if (query && query.trim()) {
    q += ` AND (${query.trim()})`
  }
  if (categoryQuery) {
    q += ` AND ${categoryQuery}`
  }

  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,creator,year,downloads,subject,description&sort[]=downloads+desc&rows=28&page=1&output=json`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Internet Archive returned ${res.status}`)
    const data = await res.json()
    const docs: IaDoc[] = data.response?.docs ?? []
    const results = docs
      .map(normalizeIa)
      .filter((b: EbookItem | null): b is EbookItem => b !== null)

    setCache(key, results)
    return results
  } catch (err) {
    console.warn('Internet Archive fetch failed:', err)
    return []
  }
}

/* ---------- Open Library (Open Public Scans Only) ---------- */
interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  has_fulltext?: boolean
  ia?: string[]
  availability?: {
    status?: string
    is_readable?: boolean
  }
}

function normalizeOpenLibrary(doc: OpenLibraryDoc): EbookItem | null {
  // CRITICAL: Strictly hide borrow-only or unavailable books
  if (!doc.has_fulltext || !doc.ia || !doc.ia.length) return null
  if (doc.availability?.status === 'borrow_available') return null

  const primaryIa = doc.ia[0]
  const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : `https://archive.org/services/img/${primaryIa}`

  return {
    id: `ia:${primaryIa}`,
    source: 'openlibrary',
    title: cleanTitle(doc.title),
    authors: doc.author_name?.length ? doc.author_name : ['Unknown Author'],
    cover,
    year: doc.first_publish_year ?? null,
    subjects: ['Public Domain Scan'],
    access: 'read_only',
    readUrl: `/ebooks/read/${encodeURIComponent('ia:' + primaryIa)}`,
    externalUrl: `https://archive.org/details/${primaryIa}`,
  }
}

export async function fetchOpenLibrary(query?: string, subject?: string): Promise<EbookItem[]> {
  const key = `ol:${query ?? ''}:${subject ?? ''}`
  const cached = getCached<EbookItem[]>(key)
  if (cached) return cached

  const url = new URL('https://openlibrary.org/search.json')
  url.searchParams.set('has_fulltext', 'true')
  url.searchParams.set('mode', 'everything')
  url.searchParams.set('limit', '28')

  if (query && query.trim()) {
    url.searchParams.set('q', query.trim())
  } else if (subject) {
    url.searchParams.set('subject', subject)
  } else {
    url.searchParams.set('subject', 'classic_literature')
  }

  try {
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Open Library returned ${res.status}`)
    const data = await res.json()
    const docs: OpenLibraryDoc[] = data.docs ?? []
    const results = docs
      .map(normalizeOpenLibrary)
      .filter((b: EbookItem | null): b is EbookItem => b !== null)

    setCache(key, results)
    return results
  } catch (err) {
    console.warn('Open Library fetch failed:', err)
    return []
  }
}

/* ---------- Cross-Catalog Search & Deduplication ---------- */
function dedupeBooks(items: EbookItem[]): EbookItem[] {
  const seen = new Set<string>()
  const out: EbookItem[] = []

  for (const item of items) {
    const norm = (item.title + ' ' + (item.authors[0] || ''))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 36)

    if (!seen.has(norm)) {
      seen.add(norm)
      out.push(item)
    }
  }

  return out
}

export async function searchEbooks(query: string, scope: EbookScope = 'all'): Promise<EbookItem[]> {
  const q = query.trim()
  if (!q) return []

  if (scope === 'gutenberg') return fetchGutenbergBooks(undefined, q)
  if (scope === 'internetarchive') return fetchInternetArchive(q)
  if (scope === 'openlibrary') return fetchOpenLibrary(q)

  // Unified Search Across All Catalogs
  const [pg, ia, ol] = await Promise.all([
    fetchGutenbergBooks(undefined, q).catch(() => [] as EbookItem[]),
    fetchInternetArchive(q).catch(() => [] as EbookItem[]),
    fetchOpenLibrary(q).catch(() => [] as EbookItem[]),
  ])

  return dedupeBooks([...pg, ...ia, ...ol])
}

export async function fetchEbooksByCategory(categoryId: string, scope: EbookScope = 'all'): Promise<EbookItem[]> {
  const cat = EBOOK_CATEGORIES.find((c) => c.id === categoryId) || EBOOK_CATEGORIES[0]

  if (scope === 'gutenberg') {
    return fetchGutenbergBooks(cat.gutenbergTopic || cat.id)
  }
  if (scope === 'internetarchive') {
    return fetchInternetArchive(undefined, cat.iaQuery)
  }
  if (scope === 'openlibrary') {
    return fetchOpenLibrary(undefined, cat.openLibrarySubject || cat.id)
  }

  const [pg, ia, ol] = await Promise.all([
    fetchGutenbergBooks(cat.gutenbergTopic || cat.id).catch(() => [] as EbookItem[]),
    fetchInternetArchive(undefined, cat.iaQuery).catch(() => [] as EbookItem[]),
    fetchOpenLibrary(undefined, cat.openLibrarySubject || cat.id).catch(() => [] as EbookItem[]),
  ])

  return dedupeBooks([...pg, ...ia, ...ol])
}

/* ---------- Curated Homepage Shelves ---------- */
export interface EbookHomeData {
  featured: EbookItem[]
  textbooks: EbookItem[]
  classics: EbookItem[]
  science: EbookItem[]
  philosophy: EbookItem[]
}

export async function fetchEbooksHome(scope: EbookScope = 'all'): Promise<EbookHomeData> {
  const cacheKey = `ebooks:home:v2:${scope}`
  const cached = getCached<EbookHomeData>(cacheKey)
  if (cached) return cached

  if (scope === 'gutenberg') {
    const [featured, classics, science, philosophy] = await Promise.all([
      fetchGutenbergBooks(),
      fetchGutenbergBooks('fiction'),
      fetchGutenbergBooks('science'),
      fetchGutenbergBooks('philosophy'),
    ])
    const out: EbookHomeData = {
      featured,
      textbooks: [],
      classics,
      science,
      philosophy,
    }
    setCache(cacheKey, out)
    return out
  }

  if (scope === 'internetarchive') {
    const [featured, textbooks, classics, science, philosophy] = await Promise.all([
      fetchInternetArchive('downloads:[50000 TO *]'),
      fetchInternetArchive(undefined, '(subject:textbook OR title:textbook)'),
      fetchInternetArchive(undefined, '(subject:fiction OR subject:classics)'),
      fetchInternetArchive(undefined, '(subject:science OR subject:physics)'),
      fetchInternetArchive(undefined, '(subject:philosophy OR title:philosophy)'),
    ])
    const out: EbookHomeData = { featured, textbooks, classics, science, philosophy }
    setCache(cacheKey, out)
    return out
  }

  // Unified Catalogs: Blend Gutenberg classics + IA open textbooks & science
  const [pgPop, iaTextbooks, iaClassics, pgSci, iaPhil] = await Promise.all([
    fetchGutenbergBooks().catch(() => [] as EbookItem[]),
    fetchInternetArchive(undefined, '(subject:textbook OR title:textbook)').catch(() => [] as EbookItem[]),
    fetchInternetArchive(undefined, '(subject:fiction OR subject:classics)').catch(() => [] as EbookItem[]),
    fetchGutenbergBooks('science').catch(() => [] as EbookItem[]),
    fetchInternetArchive(undefined, '(subject:philosophy OR title:philosophy)').catch(() => [] as EbookItem[]),
  ])

  const out: EbookHomeData = {
    featured: dedupeBooks([...pgPop.slice(0, 14), ...iaClassics.slice(0, 10)]),
    textbooks: iaTextbooks.slice(0, 20),
    classics: pgPop.slice(0, 20),
    science: dedupeBooks([...pgSci.slice(0, 12), ...iaTextbooks.filter((b) => b.subjects?.some((s) => s.toLowerCase().includes('chem') || s.toLowerCase().includes('phys'))).slice(0, 8)]),
    philosophy: dedupeBooks([...iaPhil.slice(0, 16), ...pgPop.filter((b) => b.subjects?.some((s) => s.toLowerCase().includes('philosophy')))]),
  }

  setCache(cacheKey, out)
  return out
}

/* ---------- Content Endpoint ---------- */
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
  embedUrl?: string | null
  externalUrl?: string | null
  epubUrl?: string | null
  pdfUrl?: string | null
  rawEpubUrl?: string | null
  rawPdfUrl?: string | null
}

export async function fetchEbookContent(id: string): Promise<EbookContent> {
  const res = await fetch(apiUrl(`/api/ebooks/content?id=${encodeURIComponent(id)}`))
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || `Failed to load ebook content (${res.status})`)
  }
  return (await res.json()) as EbookContent
}
