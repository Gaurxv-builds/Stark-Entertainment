import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  RotateCcw,
  Volume2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { ReadAloudBar } from './ReadAloudBar'
import { TtsEngine } from '../../services/tts/engine'
import { chunkTextForSpeech } from '../../services/tts/chunker'
import { detectEbookLanguage } from '../../services/tts/languageDetector'
import type { TtsChunk, TtsStatus } from '../../types/tts'

// Use reliable official cdnjs worker matching pdfjs-dist version
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

interface PdfReaderProps {
  url: string
  title: string
  author?: string
  initialProgress?: number
  onProgress?: (progress: number) => void
}

export default function PdfReader({
  url,
  title,
  author,
  initialProgress,
  onProgress,
}: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<any>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.25)
  const [pageInput, setPageInput] = useState<string>('1')
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

  const extractCurrentPageText = useCallback(async (): Promise<string> => {
    const pdf = pdfDocRef.current
    if (!pdf) return ''
    try {
      const page = await pdf.getPage(pageNumber)
      const tc = await page.getTextContent()
      return tc.items.map((item: any) => ('str' in item ? item.str : '')).join(' ').trim()
    } catch {
      return ''
    }
  }, [pageNumber])

  useEffect(() => {
    const engine = new TtsEngine({
      onChunkChange: (chunk) => setCurrentChunk(chunk),
      onStatusChange: (st) => setTtsStatus(st),
      onSequenceComplete: () => {
        // When finished reading current page, advance to next page if available
        setPageNumber((p) => {
          if (p < numPages) {
            setPageInput(String(p + 1))
            return p + 1
          }
          return p
        })
      },
    })
    ttsEngine.current = engine
    return () => {
      engine.destroy()
    }
  }, [numPages])

  // Sync text whenever page number changes
  useEffect(() => {
    let cancelled = false
    extractCurrentPageText().then((text) => {
      if (cancelled || !ttsEngine.current || !text) return
      const detected = detectEbookLanguage(text, { title })
      ttsEngine.current.setDefaultVoiceForLanguage(detected.language)
      const chunks = chunkTextForSpeech(text)
      ttsEngine.current.setChunks(chunks)
    })
    return () => {
      cancelled = true
    }
  }, [pageNumber, title, extractCurrentPageText])

  // Load PDF Document
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const loadingTask = pdfjsLib.getDocument({
      url,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    })

    loadingTask.promise
      .then((pdf) => {
        if (cancelled) return
        pdfDocRef.current = pdf
        setNumPages(pdf.numPages)

        // Calculate initial page from progress if provided
        let targetPage = 1
        if (initialProgress && initialProgress > 0 && initialProgress < 1) {
          targetPage = Math.max(1, Math.min(pdf.numPages, Math.round(initialProgress * pdf.numPages)))
        }
        setPageNumber(targetPage)
        setPageInput(String(targetPage))
        setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load PDF document')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      try {
        loadingTask.destroy()
      } catch {}
    }
  }, [url])

  // Render Page to Canvas
  useEffect(() => {
    const pdf = pdfDocRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas || loading) return

    let cancelled = false
    setRendering(true)

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {}
    }

    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return

      const pixelRatio = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: scale * pixelRatio })
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.height = viewport.height
      canvas.width = viewport.width
      canvas.style.height = `${viewport.height / pixelRatio}px`
      canvas.style.width = `${viewport.width / pixelRatio}px`

      const renderContext = {
        canvasContext: context,
        viewport,
        canvas,
      }

      const task = page.render(renderContext)
      renderTaskRef.current = task

      task.promise
        .then(() => {
          if (!cancelled) {
            setRendering(false)
            if (numPages > 0) {
              const p = (pageNumber - 1) / Math.max(1, numPages - 1)
              onProgress?.(p)
            }
          }
        })
        .catch((err: any) => {
          if (err?.name !== 'RenderingCancelledException' && !cancelled) {
            console.warn('PDF render error:', err)
            setRendering(false)
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [pageNumber, scale, loading, numPages])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const activeEl = document.activeElement
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') return

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrev()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [pageNumber, numPages])

  const goToPrev = () => {
    setPageNumber((p) => {
      const next = Math.max(1, p - 1)
      setPageInput(String(next))
      return next
    })
  }

  const goToNext = () => {
    setPageNumber((p) => {
      const next = Math.min(numPages, p + 1)
      setPageInput(String(next))
      return next
    })
  }

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseInt(pageInput, 10)
    if (!isNaN(num) && num >= 1 && num <= numPages) {
      setPageNumber(num)
    } else {
      setPageInput(String(pageNumber))
    }
  }

  return (
    <div className="relative flex h-[calc(100svh-120px)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d12] shadow-2xl backdrop-blur">
      {/* PDF Controls Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4 text-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 font-bold uppercase tracking-wider text-red-400 text-[11px]">
            PDF
          </span>
          <span className="truncate font-medium text-muted">
            {title} {author ? `· ${author}` : ''}
          </span>
        </div>

        {/* Page and Zoom Tools */}
        <div className="flex items-center gap-2">
          {/* Read Aloud Button */}
          <button
            type="button"
            onClick={() => {
              const next = !showReadAloud
              setShowReadAloud(next)
              if (next && ttsStatus.state === 'idle') {
                extractCurrentPageText().then((text) => {
                  if (text) {
                    const detected = detectEbookLanguage(text, { title })
                    ttsEngine.current?.setDefaultVoiceForLanguage(detected.language)
                    const chunks = chunkTextForSpeech(text)
                    ttsEngine.current?.setChunks(chunks)
                    ttsEngine.current?.play()
                  }
                })
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

          {/* Page Selector Form */}
          <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
            <button
              type="button"
              disabled={pageNumber <= 1}
              onClick={goToPrev}
              aria-label="Previous Page"
              className="grid size-8 place-items-center rounded-lg border border-white/10 bg-card text-muted transition hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex items-center gap-1 px-1 text-muted">
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageSubmit}
                className="h-7 w-12 rounded border border-white/10 bg-black/40 text-center text-xs font-semibold text-foreground outline-none focus:border-accent"
              />
              <span className="text-[11px]">/ {numPages || '–'}</span>
            </div>

            <button
              type="button"
              disabled={pageNumber >= numPages}
              onClick={goToNext}
              aria-label="Next Page"
              className="grid size-8 place-items-center rounded-lg border border-white/10 bg-card text-muted transition hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </form>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-white/10 bg-card">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
              aria-label="Zoom out"
              className="grid size-8 place-items-center text-muted transition hover:text-foreground active:scale-95"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="px-1 text-[11px] font-semibold text-muted select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(1))))}
              aria-label="Zoom in"
              className="grid size-8 place-items-center text-muted transition hover:text-foreground active:scale-95"
            >
              <ZoomIn className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScale(1.25)}
              aria-label="Reset zoom"
              title="Reset Zoom"
              className="grid size-8 place-items-center border-l border-white/10 text-muted transition hover:text-foreground active:scale-95"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative flex-1 overflow-auto bg-[#07070a] p-4 text-center">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">
              Loading PDF Document...
            </p>
          </div>
        )}

        {error ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <p className="font-display text-sm font-semibold text-red-400">
              Unable to display PDF: {error}
            </p>
            <p className="mt-2 text-xs text-muted">
              You may switch to the embedded scan reader or text edition.
            </p>
          </div>
        ) : (
          <div className="inline-block relative shadow-2xl shadow-black rounded-lg overflow-hidden border border-white/10">
            {rendering && (
              <div className="absolute top-2 right-2 z-10 rounded bg-black/60 px-2 py-1 text-[10px] text-muted">
                Rendering...
              </div>
            )}
            <canvas ref={canvasRef} className="block max-w-none" />
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-white/10 px-4 text-xs text-muted">
        <span>
          Page {pageNumber} of {numPages}
        </span>
        <span>Use Left/Right arrow keys to change pages</span>
      </div>

      {/* Floating Read Aloud Toolbar */}
      {showReadAloud && (
        <ReadAloudBar
          status={ttsStatus}
          currentChunk={currentChunk}
          onPlay={() => {
            if (ttsStatus.totalChunks === 0) {
              extractCurrentPageText().then((text) => {
                if (text) {
                  const chunks = chunkTextForSpeech(text)
                  ttsEngine.current?.setChunks(chunks)
                  ttsEngine.current?.play()
                }
              })
            } else {
              ttsEngine.current?.play()
            }
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
