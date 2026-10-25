import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, ExternalLink, House, List, Minus, Plus, Type, X } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { DEFAULT_NOVEL, loadPrefs, savePrefs, type NovelPrefs } from '../lib/reading'
import { cn } from '../lib/utils'
import { fetchEbookContent } from '../services/ebooks'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import NotFoundPage from './NotFoundPage'
import { pageTitle } from '../lib/brand'

const PREFS_KEY = 'zk:ebook-prefs:v1'

const THEMES: Record<NovelPrefs['theme'], { label: string; bg: string; fg: string; muted: string; bar: string; swatch: string }> = {
  dark: { label: 'Dark', bg: '#0c0c10', fg: '#dcdce2', muted: 'rgba(220,220,226,.55)', bar: 'rgba(12,12,16,.86)', swatch: '#0c0c10' },
  black: { label: 'Black', bg: '#000000', fg: '#bcbcc4', muted: 'rgba(188,188,196,.5)', bar: 'rgba(0,0,0,.88)', swatch: '#000000' },
  sepia: { label: 'Sepia', bg: '#f3ead6', fg: '#43362a', muted: 'rgba(67,54,42,.6)', bar: 'rgba(243,234,214,.9)', swatch: '#f3ead6' },
  light: { label: 'Light', bg: '#fafafb', fg: '#1b1b20', muted: 'rgba(27,27,32,.6)', bar: 'rgba(250,250,251,.9)', swatch: '#fafafb' },
}

const WIDTHS: Record<NovelPrefs['width'], string> = { narrow: '34rem', normal: '42rem', wide: '54rem' }

export default function EbookReaderPage() {
  const { id = '' } = useParams()
  if (!id) return <NotFoundPage />
  return <EbookReader bookId={id} />
}

function EbookReader({ bookId }: { bookId: string }) {
  const [prefs, setPrefs] = useState<NovelPrefs>(() => loadPrefs(PREFS_KEY, DEFAULT_NOVEL))
  const [panel, setPanel] = useState<'none' | 'sections' | 'settings'>('none')
  const [barVisible, setBarVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  const content = useAsync(() => fetchEbookContent(bookId), [bookId])
  const theme = THEMES[prefs.theme]

  const update = useCallback((p: Partial<NovelPrefs>) => {
    setPrefs((old) => {
      const n = { ...old, ...p }
      savePrefs(PREFS_KEY, n)
      return n
    })
  }, [])

  useEffect(() => {
    if (content.data?.title) {
      document.title = pageTitle(`${content.data.title} · Ebooks`)
    }
  }, [content.data?.title])

  /* Scroll handler for progress bar and auto-hiding top bar */
  const lastScrollY = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0)

      if (y < 48) setBarVisible(true)
      else if (Math.abs(y - lastScrollY.current) > 12) {
        setBarVisible(y < lastScrollY.current)
        lastScrollY.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Freeze scroll when side panel is open */
  useEffect(() => {
    if (panel === 'none') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [panel])

  const vars = { '--rd-bg': theme.bg, '--rd-fg': theme.fg, '--rd-muted': theme.muted, '--rd-bar': theme.bar } as CSSProperties

  return (
    <div style={{ ...vars, background: theme.bg, color: theme.fg }} className="min-h-svh overflow-x-clip transition-colors duration-300">
      {/* progress */}
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent">
        <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* top bar */}
      <header
        className={cn('fixed inset-x-0 top-0 z-50 border-b px-3 pt-[3px] backdrop-blur-xl transition-transform duration-300 sm:px-5', barVisible || panel !== 'none' ? 'translate-y-0' : '-translate-y-full')}
        style={{ background: theme.bar, borderColor: 'color-mix(in srgb, var(--rd-fg) 12%, transparent)' }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Link
              to="/ebooks"
              aria-label="Back to ebooks"
              title="Back to Ebooks"
              className="grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-black/10 active:scale-95"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <Link
              to="/"
              aria-label="Home"
              title="Return to Home Hub"
              className="grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-black/10 active:scale-95 text-accent"
            >
              <House className="size-4.5" />
            </Link>
            <div className="min-w-0 truncate pl-1">
              <p className="truncate font-display text-sm font-bold leading-tight sm:text-base">
                {content.data?.title || 'Ebook Reader'}
              </p>
              {content.data?.author && (
                <p className="truncate text-xs opacity-70">
                  {content.data.author}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {content.data?.sections && content.data.sections.length > 0 && (
              <button
                type="button"
                aria-label="Table of contents"
                title="Contents"
                onClick={() => setPanel((p) => (p === 'sections' ? 'none' : 'sections'))}
                className={cn('grid size-9 place-items-center rounded-full transition active:scale-95', panel === 'sections' ? 'bg-accent text-accent-fg' : 'hover:bg-black/10')}
              >
                <List className="size-5" />
              </button>
            )}
            <button
              type="button"
              aria-label="Reader settings"
              title="Display settings"
              onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))}
              className={cn('grid size-9 place-items-center rounded-full transition active:scale-95', panel === 'settings' ? 'bg-accent text-accent-fg' : 'hover:bg-black/10')}
            >
              <Type className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Reading View */}
      <main className="relative px-4 pb-28 pt-24 sm:px-6 sm:pt-28" onClick={() => setPanel('none')}>
        {content.loading ? (
          <div className="mx-auto space-y-4" style={{ maxWidth: WIDTHS[prefs.width] }}>
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <Skeleton className="h-5 w-1/3 rounded-lg" />
            <div className="mt-8 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
            </div>
          </div>
        ) : content.error ? (
          <div className="mx-auto max-w-md pt-20 text-center">
            <ErrorState message={content.error.message} onRetry={content.reload} />
            <p className="mt-6">
              <Link to="/ebooks" className="inline-flex items-center gap-2 font-semibold text-accent hover:underline">
                <ArrowLeft className="size-4" /> Back to Ebooks catalog
              </Link>
            </p>
          </div>
        ) : content.data ? (
          <div className="mx-auto" style={{ maxWidth: WIDTHS[prefs.width] }}>
            {/* If borrow-only (Open Library), show dedicated borrow notice */}
            {content.data.access === 'borrow' || content.data.paragraphs.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-card/60 p-6 sm:p-8 backdrop-blur-xl text-center shadow-xl">
                {content.data.cover && (
                  <img
                    src={content.data.cover}
                    alt={content.data.title}
                    className="mx-auto mb-6 aspect-[2/3] w-40 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
                  />
                )}
                <h1 className="font-display text-2xl font-black sm:text-3xl">{content.data.title}</h1>
                <p className="mt-1 text-sm opacity-70">by {content.data.author}</p>

                <div className="mt-6 rounded-2xl bg-white/5 p-4 text-xs leading-relaxed opacity-85 sm:text-sm">
                  {content.data.message || 'This title is part of the Open Library lending library.'}
                </div>

                {content.data.description && (
                  <p className="mt-4 text-xs leading-relaxed opacity-75 sm:text-sm line-clamp-6 text-left">
                    {content.data.description}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={content.data.borrowUrl || content.data.externalUrl || `https://openlibrary.org`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-fg shadow transition hover:brightness-110 active:scale-95"
                  >
                    <BookOpen className="size-4" />
                    Borrow on Open Library <ExternalLink className="size-3.5" />
                  </a>
                  <Link
                    to="/ebooks"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:bg-white/10 active:scale-95"
                  >
                    Browse Other Books
                  </Link>
                </div>
              </div>
            ) : (
              /* Public Domain / Full Text Reader */
              <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <header className="mb-10 text-center border-b pb-8" style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 10%, transparent)' }}>
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent uppercase tracking-wider">
                    Project Gutenberg Public Edition
                  </span>
                  <h1 className="mt-4 font-display text-2xl font-black leading-tight sm:text-4xl">
                    {content.data.title}
                  </h1>
                  <p className="mt-2 text-sm opacity-75">by {content.data.author}</p>
                </header>

                <div
                  style={{
                    fontSize: prefs.size,
                    lineHeight: prefs.line,
                    fontFamily: prefs.font === 'serif' ? 'Georgia, "Iowan Old Style", "Times New Roman", serif' : 'var(--font-sans)',
                  }}
                  className="space-y-4"
                >
                  {content.data.paragraphs.map((p, i) => {
                    if (p.startsWith('## ')) {
                      const headingText = p.replace(/^##\s+/, '')
                      return (
                        <h2
                          key={i}
                          id={`sec-${i}`}
                          className="pt-8 pb-3 font-display text-xl font-bold tracking-tight border-b sm:text-2xl"
                          style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 10%, transparent)' }}
                        >
                          {headingText}
                        </h2>
                      )
                    }
                    return (
                      <p key={i} className="text-justify leading-relaxed">
                        {p}
                      </p>
                    )
                  })}
                </div>

                {/* Footer Attribution */}
                <footer className="mt-16 border-t pt-8 text-center text-xs opacity-60" style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 12%, transparent)' }}>
                  <p>This work is in the public domain and provided by Project Gutenberg.</p>
                  <p className="mt-1">
                    <a href={content.data.externalUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                      View Project Gutenberg catalog entry
                    </a>
                  </p>
                </footer>
              </motion.article>
            )}
          </div>
        ) : null}
      </main>

      {/* Drawer: Table of Contents */}
      {panel === 'sections' && content.data?.sections && (
        <aside
          role="dialog"
          aria-label="Table of contents"
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l shadow-2xl backdrop-blur-2xl"
          style={{ background: theme.bar, borderColor: 'color-mix(in srgb, var(--rd-fg) 12%, transparent)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-14 items-center justify-between border-b px-4" style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 10%, transparent)' }}>
            <span className="font-display text-sm font-bold">Contents</span>
            <button type="button" onClick={() => setPanel('none')} className="grid size-8 place-items-center rounded-full hover:bg-black/10">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {content.data.sections.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPanel('none')
                  const el = document.getElementById(`sec-${s.index}`)
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-black/10 active:scale-98 truncate"
              >
                {s.title}
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Drawer: Reading Settings */}
      {panel === 'settings' && (
        <aside
          role="dialog"
          aria-label="Display settings"
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l shadow-2xl backdrop-blur-2xl"
          style={{ background: theme.bar, borderColor: 'color-mix(in srgb, var(--rd-fg) 12%, transparent)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-14 items-center justify-between border-b px-4" style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 10%, transparent)' }}>
            <span className="font-display text-sm font-bold">Reader Settings</span>
            <button type="button" onClick={() => setPanel('none')} className="grid size-8 place-items-center rounded-full hover:bg-black/10">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
            {/* Theme */}
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider opacity-70 mb-3">Theme</p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(THEMES) as NovelPrefs['theme'][]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update({ theme: t })}
                    className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-2 transition', prefs.theme === t ? 'border-accent ring-2 ring-accent/30' : 'border-white/10 opacity-70 hover:opacity-100')}
                  >
                    <span className="size-6 rounded-full border border-black/10 shadow" style={{ background: THEMES[t].swatch }} />
                    <span className="text-[11px] font-medium">{THEMES[t].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font */}
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider opacity-70 mb-3">Typography</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update({ font: 'serif' })}
                  className={cn('rounded-xl border py-2.5 text-center font-serif transition', prefs.font === 'serif' ? 'border-accent bg-accent/15 text-accent font-bold' : 'border-white/10 opacity-70')}
                >
                  Serif
                </button>
                <button
                  type="button"
                  onClick={() => update({ font: 'sans' })}
                  className={cn('rounded-xl border py-2.5 text-center font-sans transition', prefs.font === 'sans' ? 'border-accent bg-accent/15 text-accent font-bold' : 'border-white/10 opacity-70')}
                >
                  Sans-Serif
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs uppercase tracking-wider opacity-70">Font Size</span>
                <span className="text-xs font-semibold tabular-nums">{prefs.size}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update({ size: Math.max(14, prefs.size - 1) })}
                  className="grid size-9 place-items-center rounded-xl border border-white/10 hover:bg-black/10 active:scale-95"
                >
                  <Minus className="size-4" />
                </button>
                <input
                  type="range"
                  min={14}
                  max={28}
                  value={prefs.size}
                  onChange={(e) => update({ size: Number(e.target.value) })}
                  className="flex-1 accent-accent"
                />
                <button
                  type="button"
                  onClick={() => update({ size: Math.min(28, prefs.size + 1) })}
                  className="grid size-9 place-items-center rounded-xl border border-white/10 hover:bg-black/10 active:scale-95"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* Width */}
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider opacity-70 mb-3">Reading Width</p>
              <div className="grid grid-cols-3 gap-2">
                {(['narrow', 'normal', 'wide'] as NovelPrefs['width'][]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => update({ width: w })}
                    className={cn('rounded-xl border py-2 capitalize text-xs font-medium transition', prefs.width === w ? 'border-accent bg-accent/15 text-accent font-bold' : 'border-white/10 opacity-70')}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
