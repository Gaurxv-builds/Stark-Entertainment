import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  Maximize2,
  Disc3,
  X,
  ListMusic,
} from 'lucide-react'
import { useMusic } from '../../context/MusicContext'
import { cn } from '../../lib/utils'

export function MusicMiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    next,
    prev,
    seek,
    isFavorite,
    toggleFavorite,
    setExpanded,
    pause,
  } = useMusic()

  const { pathname } = useLocation()
  const isMusicHome = pathname === '/music'

  if (!currentTrack) return null

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const favorited = isFavorite(currentTrack.id)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          'fixed z-40 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-lg md:max-w-xl',
          'bottom-20 md:bottom-6' // Sits above MobileDock on phone, floating card on desktop
        )}
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-card/90 p-3 shadow-2xl backdrop-blur-2xl">
          {/* Progress Bar Hairline on top */}
          <div
            className="absolute inset-x-0 top-0 h-1 cursor-pointer bg-white/10 hover:h-1.5 transition-all"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = (e.clientX - rect.left) / rect.width
              seek(pct * (duration || 1))
            }}
          >
            <div
              className="h-full bg-purple-500 transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Track Info & Art */}
            <div
              className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer select-none"
              onClick={() => setExpanded(true)}
            >
              <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {currentTrack.artwork ? (
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.title}
                    className={cn(
                      'size-full object-cover transition duration-500',
                      isPlaying && 'scale-105'
                    )}
                  />
                ) : (
                  <div className="grid size-full place-items-center text-purple-400">
                    <Disc3 className={cn('size-6', isPlaying && 'animate-spin')} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold leading-tight text-foreground hover:text-purple-400">
                  {currentTrack.title}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {currentTrack.artist}
                </p>
              </div>
            </div>

            {/* Quick Playback Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => toggleFavorite(currentTrack)}
                aria-label={favorited ? 'Remove favorite' : 'Add favorite'}
                className={cn(
                  'grid size-8 place-items-center rounded-lg transition active:scale-95',
                  favorited ? 'text-red-500' : 'text-muted hover:text-foreground'
                )}
              >
                <Heart className={cn('size-4', favorited && 'fill-current')} />
              </button>

              <button
                type="button"
                onClick={prev}
                aria-label="Previous track"
                className="hidden sm:grid size-8 place-items-center rounded-lg text-muted transition hover:text-foreground active:scale-95"
              >
                <SkipBack className="size-4" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="grid size-9 place-items-center rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/30 transition hover:bg-purple-500 active:scale-95"
              >
                {isPlaying ? <Pause className="size-4.5" /> : <Play className="size-4.5 translate-x-0.5" />}
              </button>

              <button
                type="button"
                onClick={next}
                aria-label="Next track"
                className="grid size-8 place-items-center rounded-lg text-muted transition hover:text-foreground active:scale-95"
              >
                <SkipForward className="size-4" />
              </button>

              {!isMusicHome ? (
                <Link
                  to="/music"
                  aria-label="Open Music Player"
                  title="Open Music Player"
                  className="grid size-8 place-items-center rounded-lg text-muted transition hover:text-foreground active:scale-95"
                >
                  <Maximize2 className="size-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  aria-label="View Queue"
                  title="View Queue"
                  className="grid size-8 place-items-center rounded-lg text-muted transition hover:text-foreground active:scale-95"
                >
                  <ListMusic className="size-4" />
                </button>
              )}

              <button
                type="button"
                onClick={pause}
                aria-label="Stop playback"
                title="Stop playback"
                className="grid size-7 place-items-center rounded-lg text-muted hover:text-red-400 transition"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
