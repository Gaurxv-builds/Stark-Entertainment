import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tv,
  Film,
  BookOpen,
  FileText,
  Music2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  CheckCircle2,
  UserPlus,
} from 'lucide-react'
import { BorderBeam } from './BorderBeam'

export interface TourSlide {
  id: string
  pillar: string
  title: string
  subtitle: string
  image: string
  icon: any
  badges: string[]
  description: string
  stats: { label: string; value: string }[]
}

const TOUR_SLIDES: TourSlide[] = [
  {
    id: 'anime',
    pillar: 'Pillar 01',
    title: 'Anime Universe',
    subtitle: '1080p Sub & Dub Streaming with Instant Failover',
    image: '/tour/anime.png',
    icon: Tv,
    badges: ['1080p Full HD', 'Dual Audio (Sub & Dub)', 'Auto-Skip Intro & Filler', 'AniList Sync'],
    description:
      'Stream thousands of subbed and dubbed anime series and movies. Integrated episode tracker, auto-resume playback, and instant multi-provider servers guarantee buffer-free viewing.',
    stats: [
      { label: 'Library', value: '15,000+ Titles' },
      { label: 'Quality', value: '1080p / 60fps' },
      { label: 'Features', value: 'Zero Ads' },
    ],
  },
  {
    id: 'movies',
    pillar: 'Pillar 02',
    title: 'Cinema & TV Series',
    subtitle: 'Global Blockbusters & Trending Releases',
    image: '/tour/movies.png',
    icon: Film,
    badges: ['4K & 1080p HDR', 'Multi-Server Routing', 'Curated TMDB Metadata', 'Watchlist Cloud Sync'],
    description:
      'Watch trending Hollywood, Bollywood, anime feature films, and top television series. Experience high-bitrate streaming with automatic server failover and synchronized subtitle options.',
    stats: [
      { label: 'Content', value: 'Movies & Series' },
      { label: 'Resolution', value: 'Up to 4K' },
      { label: 'Servers', value: 'Multi-CDN Fallback' },
    ],
  },
  {
    id: 'manga',
    pillar: 'Pillar 03',
    title: 'Manga & Manhwa',
    subtitle: 'Crystal-Clear Paged & Vertical Webtoon Reader',
    image: '/tour/manga.png',
    icon: BookOpen,
    badges: ['Vertical Webtoon Scroll', 'Dual-Page Flip Mode', 'Chapter Cache', 'MangaDex Integration'],
    description:
      'Read Japanese manga, Korean manhwa, and Chinese manhua in full resolution. Includes responsive zooming, horizontal single/double-page flipping, vertical continuous scroll, and history tracking.',
    stats: [
      { label: 'Formats', value: 'Manga & Webtoons' },
      { label: 'Reader', value: 'Dual-Engine' },
      { label: 'Tracking', value: 'Chapter Auto-Save' },
    ],
  },
  {
    id: 'novels',
    pillar: 'Pillar 04',
    title: 'Novels & Ebooks Vault',
    subtitle: 'EPUB, PDF & Web Novels with Read-Aloud TTS',
    image: '/tour/novels.png',
    icon: FileText,
    badges: ['EPUB & PDF Reader', '6 Indian TTS Voices', 'OLED / Sepia Reading', 'Reading Progress Sync'],
    description:
      'Immerse yourself in translated light novels, web novels, and uploaded EPUB & PDF documents. Switch between customized font faces and enjoy hands-free reading with 6 natural Indian phonetic TTS voices.',
    stats: [
      { label: 'Supported', value: 'EPUB, PDF, Web' },
      { label: 'TTS Engine', value: '6 Indian Voices' },
      { label: 'Themes', value: 'Dark, Sepia, OLED' },
    ],
  },
  {
    id: 'music',
    pillar: 'Pillar 05',
    title: 'Lossless Music Engine',
    subtitle: 'Hi-Fi Audio Powered by JioSaavn & Piped',
    image: '/tour/music.png',
    icon: Music2,
    badges: ['320kbps Hi-Fi Audio', 'Synchronized Lyrics', 'Background Playback', 'Video Anti-Conflict Engine'],
    description:
      'Discover millions of tracks, trending Indian charts, and high-fidelity playlists. Audio continues playing in the background as you browse other tabs with zero video-playback interference.',
    stats: [
      { label: 'Bitrate', value: '320kbps Lossless' },
      { label: 'Providers', value: 'JioSaavn + Piped' },
      { label: 'Lyrics', value: 'Real-Time Sync' },
    ],
  },
  {
    id: 'account',
    pillar: 'Pillar 06',
    title: 'Cloud Sync & Security Vault',
    subtitle: 'PostgreSQL Multi-Device Encryption & Personalization',
    image: '/tour/account.png',
    icon: ShieldCheck,
    badges: ['Supabase PostgreSQL RLS', 'Animated Avatar Frames', 'Instant Device Linking', 'Watchlist Sync'],
    description:
      'Your profile, watchlist, reading progress, and settings sync securely across your phone, tablet, and desktop. Customize with glowing animated avatar frames and custom themes.',
    stats: [
      { label: 'Database', value: 'PostgreSQL RLS' },
      { label: 'Sync', value: 'Cross-Device' },
      { label: 'Security', value: 'Stark Protocol' },
    ],
  },
]

interface AppTourModalProps {
  isOpen: boolean
  onClose: () => void
  onRequestAccount: () => void
}

export function AppTourModal({ isOpen, onClose, onRequestAccount }: AppTourModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentIndex((i) => (i + 1) % TOUR_SLIDES.length)
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((i) => (i - 1 + TOUR_SLIDES.length) % TOUR_SLIDES.length)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const currentSlide = TOUR_SLIDES[currentIndex]
  const isLast = currentIndex === TOUR_SLIDES.length - 1

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-[2.2rem] border border-border bg-[#0a0a0f] text-foreground shadow-2xl"
        >
          <BorderBeam size={320} duration={9} />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-7 sm:py-5 bg-card/50 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/30">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-black tracking-tight sm:text-lg">
                  Explore Stark Entertainment
                </h2>
                <p className="text-[11px] text-muted">
                  Interactive Platform Tour &bull; 6 Core Pillars of Gaurxv Verse
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-foreground/10 px-3 py-1 font-mono text-xs font-semibold text-muted">
                {currentIndex + 1} / {TOUR_SLIDES.length}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full border border-border bg-card/60 text-muted transition hover:bg-card hover:text-foreground active:scale-95"
                aria-label="Close tour"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Pillar Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 px-5 py-2.5 sm:px-7 bg-background/40 scrollbar-none">
            {TOUR_SLIDES.map((slide, idx) => {
              const Icon = slide.icon
              const active = idx === currentIndex
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-accent text-accent-fg shadow-md shadow-accent/20'
                      : 'text-muted hover:bg-card hover:text-foreground'
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{slide.title}</span>
                </button>
              )
            })}
          </div>

          {/* Modal Body / Slide Viewport */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
            {/* Slide Hero Media Preview */}
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-black/60 shadow-inner group">
              <img
                src={currentSlide.image}
                alt={currentSlide.title}
                className="h-56 sm:h-72 w-full object-cover object-top transition duration-500 group-hover:scale-[1.015]"
                onError={(e) => {
                  // Fallback to project banner if screenshot isn't found
                  ;(e.currentTarget as HTMLImageElement).src = '/tour/banner.png'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-black/20 pointer-events-none" />

              {/* Floating Badge on Image */}
              <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-black/75 px-3 py-1 text-xs font-bold text-accent backdrop-blur-md">
                  <currentSlide.icon className="size-3.5" />
                  <span>{currentSlide.pillar}</span>
                </span>
                <span className="hidden sm:inline-flex rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
                  {currentSlide.subtitle}
                </span>
              </div>
            </div>

            {/* Slide Text Content & Badges */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <h3 className="font-display text-xl sm:text-2xl font-black tracking-tight text-white">
                  {currentSlide.title}
                </h3>
                <span className="text-xs text-muted font-mono">{currentSlide.subtitle}</span>
              </div>

              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                {currentSlide.description}
              </p>

              {/* Feature Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {currentSlide.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card/60 px-2.5 py-1 text-[11px] font-semibold text-gray-200"
                  >
                    <CheckCircle2 className="size-3 text-emerald-400" />
                    <span>{badge}</span>
                  </span>
                ))}
              </div>

              {/* Metric Highlights */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {currentSlide.stats.map((st) => (
                  <div
                    key={st.label}
                    className="rounded-xl border border-border/70 bg-card/40 p-2.5 text-center"
                  >
                    <span className="block text-[10px] font-mono uppercase text-muted">
                      {st.label}
                    </span>
                    <span className="mt-0.5 block font-display text-xs sm:text-sm font-black text-white">
                      {st.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between border-t border-border/80 px-5 py-4 sm:px-7 bg-card/40 backdrop-blur-md">
            {/* Prev Button */}
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold text-muted transition hover:bg-card-2 hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Center Slide Indicator Dots */}
            <div className="flex items-center gap-1.5">
              {TOUR_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`size-2 sm:size-2.5 rounded-full transition-all ${
                    idx === currentIndex
                      ? 'w-6 sm:w-7 bg-accent shadow-sm shadow-accent/40'
                      : 'bg-foreground/20 hover:bg-foreground/40'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Next or CTA Action */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onRequestAccount()
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-bold text-accent-fg shadow-lg shadow-accent/20 transition hover:brightness-110 active:scale-95"
              >
                <UserPlus className="size-3.5" />
                <span>Request Account</span>
              </button>

              {!isLast && (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-card-2 active:scale-95"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="size-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
