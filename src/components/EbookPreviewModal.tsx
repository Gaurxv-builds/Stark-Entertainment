import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Download, ExternalLink, Library, Sparkles, X } from 'lucide-react'
import type { EbookItem } from '../services/ebooks'

export function EbookPreviewModal({
  item,
  onClose,
}: {
  item: EbookItem | null
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (item) {
      window.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [item, onClose])

  if (!item) return null

  const authorText = item.authors.join(', ')
  const sourceLabel =
    item.source === 'gutenberg'
      ? 'Project Gutenberg'
      : item.source === 'internetarchive'
        ? 'Internet Archive'
        : 'Open Library'

  const readPath = `/ebooks/read/${encodeURIComponent(item.id)}`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-8"
        >
          {/* Close Button */}
          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-border bg-card-2 text-muted transition hover:bg-foreground hover:text-background active:scale-90"
          >
            <X className="size-4.5" />
          </button>

          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            {/* Book Cover */}
            <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card-2 shadow-xl shadow-black/30">
                {item.cover ? (
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center p-4 text-center">
                    <Library className="mx-auto size-10 text-muted/50" />
                  </div>
                )}
                <span className="absolute left-2.5 top-2.5 rounded-full bg-black/75 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
                  {sourceLabel}
                </span>
                {item.year && (
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-accent/90 px-2 py-0.5 text-[10px] font-bold text-accent-fg">
                    {item.year}
                  </span>
                )}
              </div>

              {/* Subjects pills */}
              {item.subjects && item.subjects.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.subjects.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Book Details & Actions */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                  <Sparkles className="size-3.5" />
                  <span>Public &amp; Free Edition</span>
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl">
                  {item.title}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  by <span className="font-semibold text-foreground">{authorText}</span>
                </p>
              </div>

              {/* Synopsis */}
              <div className="mt-4 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  About this Work
                </p>
                <div className="mt-1.5 max-h-44 overflow-y-auto pr-2 text-sm leading-relaxed text-muted scrollbar-thin">
                  {item.description || (
                    <p>
                      This open edition is verified and formatted for complete in-browser reading inside Gaurxv Verse. No external borrowing, accounts, or restrictions required.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
                <Link
                  to={readPath}
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
                >
                  <BookOpen className="size-4.5" />
                  <span>Read Inside Verse</span>
                </Link>

                {item.downloadUrl && (
                  <a
                    href={item.downloadUrl}
                    download
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold transition hover:bg-card-2 active:scale-95"
                  >
                    <Download className="size-4" />
                    <span>Download EPUB</span>
                  </a>
                )}

                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Source Archive</span>
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
