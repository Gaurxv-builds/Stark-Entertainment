import { useCallback, useEffect, useRef, useState } from 'react'
import ePub, { type Book, type Rendition } from 'epubjs'
import { ChevronLeft, ChevronRight, List, X, Loader2, Volume2, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ReadAloudBar } from './ReadAloudBar'
import { TtsEngine } from '../../services/tts/engine'
import { chunkTextForSpeech } from '../../services/tts/chunker'
import { detectEbookLanguage } from '../../services/tts/languageDetector'
import type { TtsChunk, TtsStatus } from '../../types/tts'

interface TocItem {
  id: string
  label: string
  href: string
  subitems?: TocItem[]
}

interface EpubReaderProps {
  url: string
  title: string
  author?: string
  theme: 'dark' | 'sepia' | 'light' | 'black'
  fontSize?: number
  onProgress?: (progress: number) => void
  initialProgress?: number
}

const THEME_STYLES = {
  dark: { bg: '#0c0c10', fg: '#dcdce2' },
  black: { bg: '#000000', fg: '#bcbcc4' },
  sepia: { bg: '#f3ead6', fg: '#43362a' },
  light: { bg: '#fafafb', fg: '#1b1b20' },
}

export default function EpubReader({
  url,
  title,
  author,
  theme,
  fontSize = 18,
  onProgress,
  initialProgress,
}: EpubReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const [showToc, setShowToc] = useState(false)
  const [currentProgress, setCurrentProgress] = useState<number>(0)
  const [currentFontSize, setCurrentFontSize] = useState<number>(fontSize)
  const [showReadAloud, setShowReadAloud] = useState(false)
  const [currentChunk, setCurrentChunk] = useState<TtsChunk | null>(null)
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>({
    state: 'idle',
    currentVoiceId: 'hi-IN-female',
    currentLanguage: 'hi-IN',
    speed: 1.0,
    currentChunkIndex: 0,
    totalChunks: 0,
    currentText: '',
    activeVoiceAvailable: true,
    providerType: 'native',
  })

  const ttsEngine = useRef<TtsEngine | null>(null)

  const extractVisibleText = useCallback((): string => {
    try {
      const contents = renditionRef.current?.getContents() || []
      const texts = contents.map((c: any) => c.document?.body?.innerText || '')
      return texts.join('\n').trim()
    } catch {
      return ''
    }
  }, [])

  useEffect(() => {
    const engine = new TtsEngine({
      onChunkChange: (chunk) => setCurrentChunk(chunk),
      onStatusChange: (st) => setTtsStatus(st),
      onSequenceComplete: () => {
        // Automatically advance to the next EPUB page and continue reading aloud
        renditionRef.current?.next()
      },
    })
    ttsEngine.current = engine
    return () => {
      engine.destroy()
    }
  }, [])

  const activeTheme = THEME_STYLES[theme] || THEME_STYLES.dark

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    if (!containerRef.current) return

    try {
      const book = ePub(url)
      bookRef.current = book

      const rendition = book.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
      })
      renditionRef.current = rendition

      // Apply styling
      rendition.themes.register('default', {
        body: {
          background: activeTheme.bg,
          color: activeTheme.fg,
          'font-size': `${currentFontSize}px !important`,
          'line-height': '1.75 !important',
          'font-family': 'Georgia, "Times New Roman", serif !important',
          padding: '0 1rem !important',
        },
        p: {
          'line-height': '1.75 !important',
          'margin-bottom': '1em !important',
        },
      })
      rendition.themes.select('default')

      // Load locations for accurate progress percentage
      book.ready
        .then(() => {
          if (cancelled) return
          return book.locations.generate(1000)
        })
        .then(() => {
          if (cancelled) return
          if (initialProgress && initialProgress > 0 && initialProgress < 1 && book.locations) {
            const cfi = book.locations.cfiFromPercentage(initialProgress)
            if (cfi) rendition.display(cfi)
            else rendition.display()
          } else {
            rendition.display()
          }
        })
        .catch(() => {
          if (!cancelled) rendition.display()
        })

      // Load navigation/TOC
      book.loaded.navigation
        .then((nav) => {
          if (cancelled) return
          if (nav && Array.isArray(nav.toc)) {
            setToc(nav.toc as TocItem[])
          }
        })
        .catch(() => {})

      // Hook up relocated listener
      rendition.on('relocated', (location: any) => {
        if (cancelled) return
        setLoading(false)
        if (location?.start?.percentage !== undefined && book.locations) {
          const pct = location.start.percentage
          setCurrentProgress(pct)
          onProgress?.(pct)
        }

        // Synchronize read aloud text when page changes
        setTimeout(() => {
          if (cancelled || !ttsEngine.current) return
          const text = extractVisibleText()
          if (text) {
            const detected = detectEbookLanguage(text, { title })
            ttsEngine.current.setDefaultVoiceForLanguage(detected.language)
            const chunks = chunkTextForSpeech(text)
            ttsEngine.current.setChunks(chunks)
          }
        }, 200)
      })

      // Forward keyboard events inside iframe to window
      rendition.on('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          rendition.next()
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          rendition.prev()
        }
      })

      rendition.on('rendered', () => {
        if (!cancelled) setLoading(false)
      })
    } catch (err: any) {
      if (!cancelled) {
        setError(err?.message || 'Failed to initialize EPUB engine')
        setLoading(false)
      }
    }

    return () => {
      cancelled = true
      try {
        renditionRef.current?.destroy()
        bookRef.current?.destroy()
      } catch {}
    }
  }, [url])

  // Update theme dynamically
  useEffect(() => {
    if (!renditionRef.current) return
    renditionRef.current.themes.override('background', activeTheme.bg)
    renditionRef.current.themes.override('color', activeTheme.fg)
  }, [activeTheme])

  // Update font size dynamically
  useEffect(() => {
    if (!renditionRef.current) return
    renditionRef.current.themes.fontSize(`${currentFontSize}px`)
  }, [currentFontSize])

  const goNext = () => renditionRef.current?.next()
  const goPrev = () => renditionRef.current?.prev()

  const navigateTo = (href: string) => {
    renditionRef.current?.display(href)
    setShowToc(false)
  }

  return (
    <div className="relative flex h-[calc(100svh-120px)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/60 shadow-2xl backdrop-blur">
      {/* Top Controls Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4 text-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-full bg-accent/20 px-2.5 py-0.5 font-bold uppercase tracking-wider text-accent text-[11px]">
            EPUB
          </span>
          <span className="truncate font-medium text-muted">
            {title} {author ? `· ${author}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !showReadAloud
              setShowReadAloud(next)
              if (next && ttsStatus.state === 'idle') {
                const text = extractVisibleText()
                if (text) {
                  const detected = detectEbookLanguage(text, { title })
                  ttsEngine.current?.setDefaultVoiceForLanguage(detected.language)
                  const chunks = chunkTextForSpeech(text)
                  ttsEngine.current?.setChunks(chunks)
                  ttsEngine.current?.play()
                }
              }
            }}
            aria-label="Read Aloud"
            title="Read Aloud (6 Indian Voices)"
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 transition active:scale-95',
              showReadAloud
                ? 'border-accent bg-accent/20 text-accent'
                : 'border-white/10 bg-card hover:bg-white/5 text-muted hover:text-foreground'
            )}
          >
            <Volume2 className="size-3.5" />
            <span className="hidden sm:inline">Read Aloud</span>
          </button>

          {toc.length > 0 && (
            <button
              type="button"
              onClick={() => setShowToc(!showToc)}
              aria-label="Table of Contents"
              title="Table of Contents"
              className={cn(
                'flex h-8 items-center gap-1 rounded-lg border px-2.5 transition active:scale-95',
                showToc
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-white/10 bg-card hover:bg-white/5 text-muted hover:text-foreground'
              )}
            >
              <List className="size-3.5" />
              <span className="hidden sm:inline">Chapters</span>
            </button>
          )}

          <div className="flex items-center rounded-lg border border-white/10 bg-card">
            <button
              type="button"
              onClick={() => setCurrentFontSize((s) => Math.max(14, s - 2))}
              aria-label="Decrease font"
              className="grid size-8 place-items-center text-muted transition hover:text-foreground active:scale-95"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-1 text-[11px] font-semibold text-muted select-none">
              {currentFontSize}px
            </span>
            <button
              type="button"
              onClick={() => setCurrentFontSize((s) => Math.min(32, s + 2))}
              aria-label="Increase font"
              className="grid size-8 place-items-center text-muted transition hover:text-foreground active:scale-95"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Reader Container */}
      <div className="relative flex-1 overflow-hidden" style={{ background: activeTheme.bg }}>
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">
              Rendering EPUB Document...
            </p>
          </div>
        )}

        {error ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <p className="font-display text-sm font-semibold text-red-400">
              Unable to open EPUB: {error}
            </p>
            <p className="mt-2 text-xs text-muted">
              You can switch to the clean text reader or view via standard edition.
            </p>
          </div>
        ) : (
          <div ref={containerRef} className="size-full" />
        )}

        {/* Side Turn Buttons */}
        {!loading && !error && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous Page"
              className="group absolute top-1/2 left-2 z-10 -translate-y-1/2 grid size-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white/70 shadow-lg backdrop-blur transition hover:bg-black/80 hover:text-white active:scale-90"
            >
              <ChevronLeft className="size-6 transition group-hover:-translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next Page"
              className="group absolute top-1/2 right-2 z-10 -translate-y-1/2 grid size-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white/70 shadow-lg backdrop-blur transition hover:bg-black/80 hover:text-white active:scale-90"
            >
              <ChevronRight className="size-6 transition group-hover:translate-x-0.5" />
            </button>
          </>
        )}

        {/* Table of Contents Drawer */}
        {showToc && (
          <div className="absolute inset-y-0 right-0 z-30 w-72 border-l border-white/10 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
                Table of Contents
              </h4>
              <button
                type="button"
                onClick={() => setShowToc(false)}
                className="grid size-6 place-items-center rounded text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 max-h-[calc(100%-48px)] space-y-1 overflow-y-auto pr-1">
              {toc.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => navigateTo(item.href)}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-muted transition hover:bg-white/5 hover:text-accent"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Progress Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-white/10 px-4 text-xs text-muted">
        <span>Progress: {Math.round(currentProgress * 100)}%</span>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Use arrow keys or buttons to flip pages</span>
        </div>
      </div>

      {/* Floating Read Aloud Toolbar */}
      {showReadAloud && (
        <ReadAloudBar
          status={ttsStatus}
          currentChunk={currentChunk}
          onPlay={() => {
            if (ttsStatus.totalChunks === 0) {
              const text = extractVisibleText()
              if (text) {
                const chunks = chunkTextForSpeech(text)
                ttsEngine.current?.setChunks(chunks)
              }
            }
            ttsEngine.current?.play()
          }}
          onPause={() => ttsEngine.current?.pause()}
          onResume={() => ttsEngine.current?.resume()}
          onStop={() => ttsEngine.current?.stop()}
          onVoiceChange={(v) => ttsEngine.current?.setVoice(v)}
          onSpeedChange={(s) => ttsEngine.current?.setSpeed(s)}
          onPrevChunk={() => ttsEngine.current?.seekChunk(ttsStatus.currentChunkIndex - 1)}
          onNextChunk={() => ttsEngine.current?.seekChunk(ttsStatus.currentChunkIndex + 1)}
          onClose={() => {
            ttsEngine.current?.stop()
            setShowReadAloud(false)
          }}
        />
      )}
    </div>
  )
}
