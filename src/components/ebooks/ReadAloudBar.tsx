import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Pause,
  Play,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react'
import type {
  IndianVoiceId,
  TtsChunk,
  TtsSpeed,
  TtsStatus,
} from '../../types/tts'
import { INDIAN_VOICES } from '../../services/tts/voices'
import { cn } from '../../lib/utils'

interface ReadAloudBarProps {
  status: TtsStatus
  currentChunk: TtsChunk | null
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onVoiceChange: (voiceId: IndianVoiceId) => void
  onSpeedChange: (speed: TtsSpeed) => void
  onPrevChunk?: () => void
  onNextChunk?: () => void
  onClose?: () => void
  autoScroll?: boolean
  onToggleAutoScroll?: () => void
}

export function ReadAloudBar({
  status,
  currentChunk,
  onPlay,
  onPause,
  onResume,
  onStop,
  onVoiceChange,
  onSpeedChange,
  onPrevChunk,
  onNextChunk,
  onClose,
  autoScroll = true,
  onToggleAutoScroll,
}: ReadAloudBarProps) {
  const [minimized, setMinimized] = useState(false)

  const isPlaying = status.state === 'playing'
  const isPaused = status.state === 'paused'

  const currentVoice = INDIAN_VOICES.find((v) => v.id === status.currentVoiceId)

  // Strictly organize only the 6 options into the 3 language groups
  const hindiGroup = INDIAN_VOICES.filter((v) => v.languageCode === 'hi-IN')
  const englishGroup = INDIAN_VOICES.filter((v) => v.languageCode === 'en-IN')
  const sanskritGroup = INDIAN_VOICES.filter((v) => v.languageCode === 'sa-IN')

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-full border border-accent/40 bg-card/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition hover:border-accent hover:scale-105 active:scale-95"
        >
          <div className="relative flex size-3 items-center justify-center">
            {isPlaying && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
            )}
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </div>
          <Volume2 className="size-4 text-accent" />
          <span className="text-xs font-bold text-foreground">
            {isPlaying ? 'Reading Aloud...' : 'Read Aloud'}
          </span>
          <span className="text-[10px] text-muted">({status.currentChunkIndex + 1}/{status.totalChunks || 1})</span>
        </button>
      </div>
    )
  }

  return (
    <aside
      aria-label="Ebook Read Aloud Controls"
      className="fixed inset-x-3 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-white/15 bg-card/95 p-3.5 shadow-2xl shadow-black/80 backdrop-blur-2xl transition-all sm:bottom-6 sm:px-5"
    >
      {/* Top Header Row: Voice Selector & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-accent/15 text-accent">
            <Headphones className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold text-foreground tracking-wide">
                Read Aloud
              </span>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {status.currentLanguage === 'sa-IN' ? 'Sanskrit' : status.currentLanguage === 'hi-IN' ? 'Hindi' : 'Indian English'}
              </span>
              {status.currentLanguage === 'sa-IN' && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  <Sparkles className="size-2.5" /> Devanagari Meter
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 6-Voice Selector Strictly Grouped into Hindi, English, Sanskrit */}
        <div className="flex items-center gap-2">
          <label htmlFor="stark-tts-voice-select" className="sr-only">Select Indian Voice</label>
          <select
            id="stark-tts-voice-select"
            value={status.currentVoiceId}
            onChange={(e) => onVoiceChange(e.target.value as IndianVoiceId)}
            className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-xs font-semibold text-foreground transition focus:border-accent focus:outline-none"
            aria-label="Voice Selector"
          >
            <optgroup label="Hindi (India)">
              {hindiGroup.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="English (India)">
              {englishGroup.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sanskrit (India)">
              {sanskritGroup.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </optgroup>
          </select>

          <button
            type="button"
            onClick={() => {
              if (onClose) onClose()
              else setMinimized(true)
            }}
            aria-label="Close Read Aloud bar"
            title="Close Read Aloud"
            className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Current Passage Preview (Real-time sentence highlighting) */}
      <div className="my-2.5 rounded-xl border border-white/5 bg-black/30 p-2.5">
        <div className="flex items-center justify-between text-[11px] text-muted mb-1">
          <span className="font-medium">
            Passage {status.totalChunks > 0 ? status.currentChunkIndex + 1 : 0} of {status.totalChunks || 0}
          </span>
          <span className="truncate max-w-[180px] opacity-75">
            {currentVoice?.label}
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90 font-sans">
          {currentChunk?.text || (status.totalChunks === 0 ? 'No readable text loaded on this page.' : 'Press Play to begin reading aloud.')}
        </p>
      </div>

      {/* Controls Row: Play/Pause, Stop, Speed, AutoScroll */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Previous Chunk */}
          <button
            type="button"
            onClick={onPrevChunk}
            disabled={status.currentChunkIndex <= 0}
            aria-label="Previous sentence"
            title="Previous sentence"
            className="grid size-8 place-items-center rounded-full border border-white/10 text-muted transition hover:bg-white/10 hover:text-foreground active:scale-95 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* Play / Pause / Resume */}
          {isPlaying ? (
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause"
              title="Pause"
              className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
            >
              <Pause className="size-3.5 fill-current" />
              <span>Pause</span>
            </button>
          ) : isPaused ? (
            <button
              type="button"
              onClick={onResume}
              aria-label="Resume"
              title="Resume"
              className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
            >
              <Play className="size-3.5 fill-current" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onPlay}
              disabled={status.totalChunks === 0}
              aria-label="Play"
              title="Play"
              className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <Play className="size-3.5 fill-current" />
              <span>Play</span>
            </button>
          )}

          {/* Stop */}
          <button
            type="button"
            onClick={onStop}
            disabled={status.state === 'stopped' || status.state === 'idle'}
            aria-label="Stop"
            title="Stop playback"
            className="grid size-8 place-items-center rounded-full border border-white/10 text-muted transition hover:bg-white/10 hover:text-red-400 active:scale-95 disabled:opacity-40"
          >
            <Square className="size-3.5 fill-current" />
          </button>

          {/* Next Chunk */}
          <button
            type="button"
            onClick={onNextChunk}
            disabled={status.currentChunkIndex >= status.totalChunks - 1}
            aria-label="Next sentence"
            title="Next sentence"
            className="grid size-8 place-items-center rounded-full border border-white/10 text-muted transition hover:bg-white/10 hover:text-foreground active:scale-95 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Speed Adjustment: 0.75x, 1x, 1.25x, 1.5x */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px]">
            {([0.75, 1.0, 1.25, 1.5] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSpeedChange(spd)}
                className={cn(
                  'rounded px-1.5 py-0.5 font-semibold transition',
                  status.speed === spd
                    ? 'bg-accent text-accent-fg shadow-sm'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {spd}x
              </button>
            ))}
          </div>

          {onToggleAutoScroll && (
            <button
              type="button"
              onClick={onToggleAutoScroll}
              title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
              className={cn(
                'hidden sm:inline-flex rounded-lg border px-2 py-1 text-[11px] font-semibold transition active:scale-95',
                autoScroll
                  ? 'border-accent/40 bg-accent/15 text-accent'
                  : 'border-white/10 text-muted hover:text-foreground'
              )}
            >
              Scroll {autoScroll ? 'On' : 'Off'}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
