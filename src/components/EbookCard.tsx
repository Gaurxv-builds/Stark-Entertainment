import { memo, useRef, useState } from 'react'
import { BookOpen, Download, ExternalLink, Library } from 'lucide-react'
import type { EbookItem } from '../services/ebooks'
import { cn } from '../lib/utils'

export const EbookCard = memo(function EbookCard({
  item,
  index = 0,
  fluid = false,
}: {
  item: EbookItem
  index?: number
  fluid?: boolean
}) {
  const tilt = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      if (tilt.current) {
        tilt.current.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 14}deg) rotateY(${(x - 0.5) * 14}deg)`
      }
    })
  }

  function onLeave() {
    cancelAnimationFrame(raf.current)
    if (tilt.current) tilt.current.style.transform = ''
  }

  const showImg = !!item.cover && !failed
  const authorText = item.authors.join(', ')

  return (
    <div
      className={cn(
        'group/card relative animate-card-in shrink-0 snap-start',
        fluid ? 'w-full' : 'w-[148px] sm:w-[178px] lg:w-[196px]'
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div onPointerMove={onMove} onPointerLeave={onLeave} className="group block outline-none">
        {/* Cover Artwork Container with 3D Tilt */}
        <div
          ref={tilt}
          className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card-2 shadow-lg shadow-black/10 transition-[transform,box-shadow] duration-200 ease-out group-hover:shadow-2xl group-hover:shadow-accent/20 group-focus-visible:ring-2 group-focus-visible:ring-accent"
        >
          {showImg ? (
            <img
              src={item.cover!}
              alt={item.title}
              loading="lazy"
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={cn(
                'h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-105',
                loaded ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-card-2 via-card to-card-2 p-3 text-center">
              <div className="space-y-1">
                <Library className="mx-auto size-7 text-accent/60" />
                <span className="line-clamp-3 font-display text-xs font-bold leading-snug text-foreground">
                  {item.title}
                </span>
                <span className="line-clamp-1 block text-[10px] text-muted">{authorText}</span>
              </div>
            </div>
          )}

          {/* Source Badge */}
          <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
            {item.source === 'gutenberg' ? 'Gutenberg' : 'Open Library'}
          </span>

          {/* Access / Year Badge */}
          {item.year && (
            <span className="absolute right-2 top-2 rounded-full bg-accent/90 px-2 py-0.5 text-[10px] font-bold text-accent-fg">
              {item.year}
            </span>
          )}

          {/* Hover Overlay with Action Buttons */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            {/* Subjects Pills */}
            <div className="flex flex-wrap gap-1">
              {(item.subjects ?? []).slice(0, 2).map((s) => (
                <span
                  key={s}
                  className="truncate max-w-[140px] rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-medium text-white"
                >
                  {s}
                </span>
              ))}
            </div>

            {/* Actions Buttons */}
            <div className="mt-2.5 flex flex-col gap-1.5">
              {item.readUrl && (
                <a
                  href={item.readUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg bg-accent px-2 text-[11px] font-bold text-accent-fg shadow transition hover:brightness-110 active:scale-95"
                >
                  <BookOpen className="size-3" />
                  <span>{item.access === 'borrow' ? 'Borrow & Read' : 'Read Online'}</span>
                </a>
              )}

              {item.downloadUrl && (
                <a
                  href={item.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
                  title="Download EPUB format"
                >
                  <Download className="size-3" />
                  <span>Download EPUB</span>
                </a>
              )}

              {!item.downloadUrl && item.access === 'catalog' && (
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
                >
                  <ExternalLink className="size-3" />
                  <span>View Details</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Title and Author Info */}
        <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-accent">
          {item.title}
        </h3>
        <p className="mt-1 truncate text-xs text-muted">{authorText}</p>
      </div>
    </div>
  )
})
