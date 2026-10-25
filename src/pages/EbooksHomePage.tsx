import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { useDebounced } from '../hooks/useDebounced'
import {
  EBOOK_CATEGORIES,
  EBOOK_SOURCES,
  fetchEbooksByCategory,
  fetchEbooksHome,
  searchEbooks,
  type EbookItem,
  type EbookScope,
} from '../services/ebooks'
import { EbookCard } from '../components/EbookCard'
import { EbookRow } from '../components/EbookRow'
import { DiscoverHero } from '../components/DiscoverHero'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import { Tabs } from '../components/Tabs'
import { cn } from '../lib/utils'
import { pageTitle } from '../lib/brand'
import { BookMarked, Globe, Sparkles } from 'lucide-react'

export default function EbooksHomePage() {
  const [params, setParams] = useSearchParams()
  const rawSource = params.get('source') ?? 'all'
  const source: EbookScope =
    rawSource === 'gutenberg' || rawSource === 'internetarchive' || rawSource === 'openlibrary'
      ? rawSource
      : 'all'

  const [query, setQuery] = useState('')
  const term = useDebounced(query.trim(), 400)
  const [category, setCategory] = useState<string>('all')

  // Fetch Homepage Shelves
  const home = useAsync(() => fetchEbooksHome(source), [source])

  // Fetch Search or Category Results
  const isFiltering = category !== 'all'
  const isSearching = term.length > 0

  const results = useAsync(async () => {
    if (isSearching) {
      return searchEbooks(term, source)
    }
    if (isFiltering) {
      return fetchEbooksByCategory(category, source)
    }
    return null
  }, [term, category, source, isSearching, isFiltering])

  useEffect(() => {
    document.title = pageTitle('Ebooks')
  }, [])

  function setSource(s: EbookScope) {
    const next = new URLSearchParams(params)
    if (s === 'all') next.delete('source')
    else next.set('source', s)
    setParams(next, { replace: true })
  }

  // Rotating backdrop covers for the hero section
  const backdrop = useMemo(() => {
    const list = home.data?.featured ?? []
    return list
      .filter((b) => b.cover)
      .slice(0, 20)
      .map((b) => ({ src: b.cover!, title: b.title }))
  }, [home.data])

  const err = home.error?.message

  return (
    <main>
      <DiscoverHero
        eyebrow="YOUR DIGITAL LIBRARY"
        title="Every page, a"
        accent="new world."
        subtitle="Read thousands of free public domain classics, science, history, and textbooks directly in your browser."
        watermark="EBOOKS"
        query={query}
        onQuery={setQuery}
        placeholder="Search titles, authors, subjects..."
        backdrop={backdrop}
        blurBackdrop
      >
        <Tabs
          tabs={EBOOK_SOURCES}
          value={source}
          onChange={(s) => setSource(s as EbookScope)}
        />
      </DiscoverHero>

      <div className="relative z-10 space-y-12 pb-20 sm:space-y-16">
        {/* Category Pills Bar */}
        <section aria-label="Book categories" className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-2">
            {EBOOK_CATEGORIES.map((cat) => {
              const active = category === cat.id && !isSearching
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id)
                    if (isSearching) setQuery('')
                  }}
                  className={cn(
                    'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition active:scale-95',
                    active
                      ? 'border-accent bg-accent text-accent-fg shadow-md shadow-accent/20'
                      : 'border-border bg-card/60 text-muted hover:border-border/80 hover:text-foreground'
                  )}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </section>

        {/* View Mode 1: Search or Category Results Grid */}
        {isSearching || isFiltering ? (
          <section className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex flex-col gap-1">
              <p className="eyebrow text-accent">
                {isSearching ? 'Search Results' : 'Category'}
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {isSearching ? (
                  <>
                    Matches for “{term}”{' '}
                    <span className="text-sm font-normal text-muted">
                      ({source === 'all' ? 'All Sources' : EBOOK_SOURCES.find((s) => s.id === source)?.label})
                    </span>
                  </>
                ) : (
                  <>
                    {EBOOK_CATEGORIES.find((c) => c.id === category)?.label ?? 'Books'}{' '}
                    <span className="text-sm font-normal text-muted">Collection</span>
                  </>
                )}
              </h2>
            </div>

            {results.error ? (
              <ErrorState message={results.error.message} onRetry={results.reload} />
            ) : results.loading ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                    <Skeleton className="mt-3 h-4 w-4/5" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : results.data && results.data.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {results.data.map((b: EbookItem, i: number) => (
                  <EbookCard key={b.id} item={b} index={i} fluid />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-card/60 px-6 py-16 text-center backdrop-blur">
                <BookMarked className="mx-auto mb-3 size-10 text-muted/60" />
                <h3 className="font-display text-lg font-bold">No books found</h3>
                <p className="mt-1 text-xs text-muted">
                  Try a different search keyword, author name, or switch to All Catalogs.
                </p>
              </div>
            )}
          </section>
        ) : err ? (
          <ErrorState message={err} onRetry={home.reload} />
        ) : (
          /* View Mode 2: Curated Homepage Shelves */
          <>
            <EbookRow
              eyebrow="Trending Now"
              title="Featured Reads"
              items={home.data?.featured}
              loading={home.loading}
            />

            {home.data?.textbooks && home.data.textbooks.length > 0 && (
              <EbookRow
                eyebrow="Education &amp; Academia"
                title="Academic &amp; College Textbooks"
                items={home.data?.textbooks}
                loading={home.loading}
              />
            )}

            <EbookRow
              eyebrow="Timeless Stories"
              title="Popular Classics"
              items={home.data?.classics}
              loading={home.loading}
            />

            <EbookRow
              eyebrow="Knowledge &amp; Discovery"
              title="Science &amp; Technology"
              items={home.data?.science}
              loading={home.loading}
            />

            <EbookRow
              eyebrow="Thought &amp; Society"
              title="Philosophy &amp; Ideas"
              items={home.data?.philosophy}
              loading={home.loading}
            />
          </>
        )}

        {/* Source Attribution & Legal Notice */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider">
                  <Sparkles className="size-3.5" />
                  <span>Public Domain &amp; Open Access</span>
                </div>
                <h3 className="font-display text-lg font-bold">About Digital Book Sources</h3>
                <p className="text-xs text-muted leading-relaxed max-w-2xl">
                  All books in this digital library are 100% free and open to read in your browser. Titles are indexed from{' '}
                  <b>Project Gutenberg</b> and <b>Internet Archive</b> public collections. Only works that are completely available for online reading without digital borrowing restrictions are included.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://www.gutenberg.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 text-xs font-semibold transition hover:border-accent hover:text-accent"
                >
                  <Globe className="size-3.5" />
                  <span>Project Gutenberg</span>
                </a>
                <a
                  href="https://archive.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 text-xs font-semibold transition hover:border-accent hover:text-accent"
                >
                  <Globe className="size-3.5" />
                  <span>Internet Archive</span>
                </a>
                <a
                  href="https://openlibrary.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 text-xs font-semibold transition hover:border-accent hover:text-accent"
                >
                  <Globe className="size-3.5" />
                  <span>Open Library</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
