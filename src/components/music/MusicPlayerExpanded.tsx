import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  X,
  ListMusic,
  Disc3,
} from 'lucide-react'
import { useMusic } from '../../context/MusicContext'
import { cn } from '../../lib/utils'

function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MusicPlayerExpanded() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    next,
    prev,
    seek,
    volume,
    setVolume,
    muted,
    toggleMute,
    isFavorite,
    toggleFavorite,
    shuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    queue,
    playFromQueue,
    removeFromQueue,
    clearQueue,
    isExpanded,
    setExpanded,
  } = useMusic()

  const [showMobileQueue, setShowMobileQueue] = useState(false)

  if (!isExpanded || !currentTrack) return null

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const favorited = isFavorite(currentTrack.id)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative flex h-full max-h-[820px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d12]/95 shadow-2xl"
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-6">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-400">
                {currentTrack.providerLabel}
              </span>
              <span className="text-xs text-muted">Stark Audio Engine</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Queue Button - toggles mobile view on smaller screens, shows count on desktop */}
              <button
                type="button"
                onClick={() => setShowMobileQueue(!showMobileQueue)}
                aria-label="Toggle Up Next Queue"
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-95',
                  showMobileQueue
                    ? 'border-purple-500 bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'border-white/10 bg-white/5 text-purple-400 hover:bg-white/10'
                )}
              >
                <ListMusic className="size-3.5" />
                <span>Up Next ({queue.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-foreground transition"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Main Body */}
          <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
            {/* Player Controls Panel (hidden on mobile if user toggled mobile queue) */}
            <div
              className={cn(
                'flex flex-col justify-between p-6 sm:p-8 overflow-y-auto',
                showMobileQueue && 'hidden lg:flex'
              )}
            >
              {/* Artwork */}
              <div className="relative mx-auto my-auto aspect-square w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-3xl border border-white/15 bg-black/60 shadow-2xl">
                {currentTrack.artwork ? (
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-purple-400">
                    <Disc3 className={cn('size-24', isPlaying && 'animate-spin')} />
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="mt-6 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-xl font-black text-foreground sm:text-2xl">
                    {currentTrack.title}
                  </h2>
                  <p className="mt-1 truncate text-sm font-medium text-muted">
                    {currentTrack.artist}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(currentTrack)}
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl transition',
                    favorited ? 'text-red-500' : 'text-muted hover:text-foreground'
                  )}
                >
                  <Heart className={cn('size-6', favorited && 'fill-current')} />
                </button>
              </div>

              {/* Seek Bar */}
              <div className="mt-6 space-y-2">
                <div
                  className="group relative h-2 w-full cursor-pointer rounded-full bg-white/10"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const pct = (e.clientX - rect.left) / rect.width
                    seek(pct * (duration || 1))
                  }}
                >
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-100"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  className={cn(
                    'grid size-10 place-items-center rounded-xl transition',
                    shuffle ? 'text-purple-400' : 'text-muted hover:text-foreground'
                  )}
                >
                  <Shuffle className="size-4.5" />
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={prev}
                    className="grid size-11 place-items-center rounded-full text-foreground hover:bg-white/10 active:scale-95 transition"
                  >
                    <SkipBack className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="grid size-14 place-items-center rounded-full bg-purple-600 text-white shadow-xl shadow-purple-600/30 transition hover:bg-purple-500 active:scale-95"
                  >
                    {isPlaying ? <Pause className="size-7" /> : <Play className="size-7 translate-x-0.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="grid size-11 place-items-center rounded-full text-foreground hover:bg-white/10 active:scale-95 transition"
                  >
                    <SkipForward className="size-6" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={cycleRepeat}
                  className={cn(
                    'grid size-10 place-items-center rounded-xl transition',
                    repeatMode !== 'off' ? 'text-purple-400' : 'text-muted hover:text-foreground'
                  )}
                >
                  {repeatMode === 'one' ? <Repeat1 className="size-4.5" /> : <Repeat className="size-4.5" />}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-muted hover:text-foreground transition"
                >
                  {muted || volume === 0 ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer rounded-lg bg-white/10 accent-purple-500"
                />
              </div>
            </div>

            {/* Dedicated Up Next Queue Drawer (side panel on desktop, toggled view on mobile) */}
            <div
              className={cn(
                'border-l border-white/10 p-6 flex flex-col overflow-hidden',
                !showMobileQueue && 'hidden lg:flex'
              )}
            >
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
                      Up Next ({queue.length})
                    </h3>
                    <span className="text-[11px] text-muted/60">Tap track to play</span>
                  </div>
                  {queue.length > 0 && (
                    <button
                      type="button"
                      onClick={clearQueue}
                      className="text-xs font-semibold text-red-400 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-2 scrollbar-thin">
                  {queue.length > 0 ? (
                    queue.map((track, idx) => (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => playFromQueue(idx)}
                        className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 p-2.5 transition hover:border-purple-500/40 hover:bg-purple-950/20 active:scale-[0.99]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {/* Thumbnail Artwork with Play overlay */}
                          <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                            {track.artwork ? (
                              <img
                                src={track.artwork}
                                alt={track.title}
                                className="size-full object-cover transition duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="grid size-full place-items-center text-purple-400">
                                <Disc3 className="size-5" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                              <Play className="size-4 text-white fill-current translate-x-0.5" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-foreground group-hover:text-purple-300 transition">
                              {track.title}
                            </p>
                            <p className="truncate text-[11px] text-muted">{track.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {track.duration ? (
                            <span className="text-[11px] text-muted/60 font-mono">
                              {formatTime(track.duration)}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromQueue(idx)
                            }}
                            title="Remove from queue"
                            aria-label={`Remove ${track.title} from queue`}
                            className="grid size-7 place-items-center rounded-lg text-muted hover:text-red-400 hover:bg-white/5 transition"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-muted py-12">
                      <ListMusic className="size-10 mb-2 opacity-40 text-purple-400" />
                      <p className="text-xs font-medium">Queue is currently empty.</p>
                      <p className="text-[11px] text-muted/60 mt-1">Play any track or album to populate Up Next.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
