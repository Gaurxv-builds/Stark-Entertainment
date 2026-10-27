import { useEffect, useRef, useState } from 'react'
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
  FileText,
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
    removeFromQueue,
    clearQueue,
    lyrics,
    activeLyricIndex,
    isExpanded,
    setExpanded,
  } = useMusic()

  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics')
  const lyricsContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (activeLyricIndex < 0 || !lyricsContainerRef.current) return
    const activeEl = document.getElementById(`lyric-line-${activeLyricIndex}`)
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLyricIndex])

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
              <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('lyrics')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition',
                    activeTab === 'lyrics' ? 'bg-purple-600 text-white' : 'text-muted hover:text-foreground'
                  )}
                >
                  <FileText className="size-3.5" />
                  <span>Lyrics</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('queue')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition',
                    activeTab === 'queue' ? 'bg-purple-600 text-white' : 'text-muted hover:text-foreground'
                  )}
                >
                  <ListMusic className="size-3.5" />
                  <span>Queue ({queue.length})</span>
                </button>
              </div>

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
            {/* Left: Artwork, Track Info, Controls */}
            <div className="flex flex-col justify-between p-6 sm:p-8">
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

            {/* Right: Lyrics / Queue Drawer */}
            <div className="hidden border-l border-white/10 p-6 lg:flex lg:flex-col lg:overflow-hidden">
              {activeTab === 'lyrics' ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
                      Lyrics
                    </h3>
                    {lyrics?.source && (
                      <span className="text-[11px] text-muted">Source: {lyrics.source}</span>
                    )}
                  </div>

                  <div
                    ref={lyricsContainerRef}
                    className="flex-1 space-y-4 overflow-y-auto pr-2 scroll-smooth text-center"
                  >
                    {lyrics?.synced && lyrics.synced.length > 0 ? (
                      lyrics.synced.map((line, idx) => (
                        <p
                          key={idx}
                          id={`lyric-line-${idx}`}
                          onClick={() => seek(line.time)}
                          className={cn(
                            'cursor-pointer py-1.5 text-base font-semibold transition-all duration-300',
                            activeLyricIndex === idx
                              ? 'scale-105 text-purple-400 font-bold'
                              : 'text-muted/60 hover:text-foreground'
                          )}
                        >
                          {line.text || '♪'}
                        </p>
                      ))
                    ) : lyrics?.plain ? (
                      <div className="whitespace-pre-line text-sm leading-relaxed text-muted">
                        {lyrics.plain}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-muted">
                        <FileText className="size-10 mb-2 opacity-40" />
                        <p className="text-xs">No lyrics found for this track.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
                      Up Next ({queue.length})
                    </h3>
                    {queue.length > 0 && (
                      <button
                        type="button"
                        onClick={clearQueue}
                        className="text-xs font-semibold text-red-400 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                    {queue.length > 0 ? (
                      queue.map((track, idx) => (
                        <div
                          key={`${track.id}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 p-2.5 transition hover:border-white/15"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="text-xs font-bold text-muted w-4 text-center">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground">
                                {track.title}
                              </p>
                              <p className="truncate text-[11px] text-muted">{track.artist}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromQueue(idx)}
                            className="grid size-7 place-items-center rounded-lg text-muted hover:text-red-400 transition"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-muted">
                        <ListMusic className="size-10 mb-2 opacity-40" />
                        <p className="text-xs">Queue is currently empty.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
