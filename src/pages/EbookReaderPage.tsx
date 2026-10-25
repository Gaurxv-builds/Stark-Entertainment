import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, House, List, Maximize, Minimize, Minus, Plus, Type, X } from 'lucide-react'
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
  const [fullscreen, setFullscreen] = useState(false)

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {})
    }
  }

  const isEmbedded = !!content.data?.embedUrl
  const vars = { '--rd-bg': theme.bg, '--rd-fg': theme.fg, '--rd-muted': theme.muted, '--rd-bar': theme.bar } as CSSProperties

  return (
    <div style={{ ...vars, background: theme.bg, color: theme.fg }} className="min-h-svh overflow-x-clip transition-colors duration-300">
      {/* progress hairline */}
      {!isEmbedded && (
        <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent">
          <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}

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
            <button
              type="button"
              aria-label="Fullscreen"
              title="Toggle Fullscreen"
              onClick={toggleFullscreen}
              className="grid size-9 place-items-center rounded-full transition hover:bg-black/10 active:scale-95"
            >
              {fullscreen ? <Minimize className="size-4.5" /> : <Maximize className="size-4.5" />}
            </button>

            {!isEmbedded && content.data?.sections && content.data.sections.length > 0 && (
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

            {!isEmbedded && (
              <button
                type="button"
                aria-label="Reader settings"
                title="Display settings"
                onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))}
                className={cn('grid size-9 place-items-center rounded-full transition active:scale-95', panel === 'settings' ? 'bg-accent text-accent-fg' : 'hover:bg-black/10')}
              >
                <Type className="size-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Reading View */}
      <main className="relative px-4 pb-20 pt-20 sm:px-6 sm:pt-24" onClick={() => setPanel('none')}>
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
          isEmbedded ? (
            /* Mode 1: Interactive In-Browser BookReader for Internet Archive & Open Scans */
            <div className="mx-auto w-full max-w-6xl">
              <div className="relative aspect-[4/3] w-full min-h-[560px] sm:min-h-[720px] h-[calc(100svh-120px)] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/50">
                <iframe
                  src={content.data.embedUrl!}
                  title={content.data.title}
                  className="size-full border-0"
                  allow="fullscreen; autoplay; webkitallowfullscreen; mozallowfullscreen"
                  allowFullScreen
                />
              </div>
              {content.data.description && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-card/60 p-6 backdrop-blur">
                  <h3 className="font-display text-sm font-bold text-accent uppercase tracking-wider mb-2">About this Book</h3>
                  <p className="text-xs text-muted leading-relaxed line-clamp-4">{content.data.description}</p>
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Clean Typography Reader for Project Gutenberg */
            <div className="mx-auto" style={{ maxWidth: WIDTHS[prefs.width] }}>
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

                <footer className="mt-16 border-t pt-8 text-center text-xs opacity-60" style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 12%, transparent)' }}>
                  <p>This public domain work is provided by Project Gutenberg and formatted for online reading inside Gaurxv Verse.</p>
                </footer>
              </motion.article>
            </div>
          )
        ) : null}
      </main>

      {/* Table of Contents Drawer */}
      {panel === 'sections' && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l p-6 shadow-2xl backdrop-blur-2xl transition-transform" style={{ background: theme.bar, borderColor: 'color-mix(in srgb, var(--rd-fg) 14%, transparent)' }}>
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 10%, transparent)' }}>
            <h3 className="font-display text-lg font-bold">Contents</h3>
            <button type="button" onClick={() => setPanel('none')} className="grid size-8 place-items-center rounded-full hover:bg-black/10">
              <X className="size-5" />
            </button>
          </div>
          <div className="mt-4 max-h-[calc(100vh-120px)] space-y-1 overflow-y-auto pr-2">
            {content.data?.sections?.map((sec, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`sec-${sec.index}`)
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                  setPanel('none')
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-black/10 hover:text-accent"
              >
                {sec.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reader Settings Drawer */}
      {panel === 'settings' && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l p-6 shadow-2xl backdrop-blur-2xl" style={{ background: theme.bar, borderColor: 'color-mix(in srgb, var(--rd-fg) 14%, transparent)' }}>
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 10%, transparent)' }}>
            <h3 className="font-display text-lg font-bold">Reading Preferences</h3>
            <button type="button" onClick={() => setPanel('none')} className="grid size-8 place-items-center rounded-full hover:bg-black/10">
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {/* Theme */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Color Theme</p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(THEMES) as [NovelPrefs['theme'], typeof THEMES['dark']][]).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => update({ theme: k })}
                    className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-xs font-medium transition', prefs.theme === k ? 'border-accent ring-2 ring-accent/30' : 'border-border/60')}
                  >
                    <span className="size-6 rounded-full border shadow-sm" style={{ background: t.swatch }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Font Size ({prefs.size}px)</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update({ size: Math.max(14, prefs.size - 2) })}
                  className="grid size-10 place-items-center rounded-xl border border-border bg-card/60 transition active:scale-95"
                >
                  <Minus className="size-4" />
                </button>
                <div className="h-2 flex-1 rounded-full bg-current/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${((prefs.size - 14) / 14) * 100}%` }} />
                </div>
                <button
                  type="button"
                  onClick={() => update({ size: Math.min(28, prefs.size + 2) })}
                  className="grid size-10 place-items-center rounded-xl border border-border bg-card/60 transition active:scale-95"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* Font Family */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Typeface</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update({ font: 'serif' })}
                  className={cn('rounded-xl border py-2.5 text-sm font-serif transition', prefs.font === 'serif' ? 'border-accent bg-accent/15 text-accent' : 'border-border/60')}
                >
                  Serif (Book)
                </button>
                <button
                  type="button"
                  onClick={() => update({ font: 'sans' })}
                  className={cn('rounded-xl border py-2.5 text-sm font-sans transition', prefs.font === 'sans' ? 'border-accent bg-accent/15 text-accent' : 'border-border/60')}
                >
                  Sans (Modern)
                </button>
              </div>
            </div>

            {/* Layout Width */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Reading Width</p>
              <div className="grid grid-cols-3 gap-2">
                {(['narrow', 'normal', 'wide'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => update({ width: w })}
                    className={cn('capitalize rounded-xl border py-2 text-xs font-medium transition', prefs.width === w ? 'border-accent bg-accent/15 text-accent' : 'border-border/60')}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
