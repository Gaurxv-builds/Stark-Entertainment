import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Track, Playlist, Lyrics, MusicProviderSettings } from '../types/music'
import {
  resolveTrackLyrics,
  getMusicSettings,
  saveMusicSettings,
  resolvePipedStreamUrl,
} from '../services/music'
import { toast } from '../lib/toast'

const FAVORITES_KEY = 'zk:music:favorites:v1'
const PLAYLISTS_KEY = 'zk:music:playlists:v1'
const PREFS_KEY = 'zk:music:prefs:v1'

export interface MusicContextType {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  queue: Track[]
  history: Track[]
  favorites: Track[]
  playlists: Playlist[]
  repeatMode: 'off' | 'all' | 'one'
  shuffle: boolean
  lyrics: Lyrics | null
  activeLyricIndex: number
  isExpanded: boolean
  play: (track?: Track) => Promise<void>
  playTrack: (track: Track, playlistContext?: Track[]) => Promise<void>
  pause: () => void
  togglePlay: () => void
  seek: (seconds: number) => void
  next: () => void
  prev: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
  addToQueue: (track: Track) => void
  playNext: (track: Track) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  toggleFavorite: (track: Track) => void
  isFavorite: (trackId: string) => boolean
  toggleShuffle: () => void
  cycleRepeat: () => void
  createPlaylist: (name: string) => Playlist
  deletePlaylist: (playlistId: string) => void
  addToPlaylist: (playlistId: string, track: Track) => void
  removeFromPlaylist: (playlistId: string, trackId: string) => void
  setExpanded: (open: boolean) => void
  openExpandedPlayer: () => void
  providerSettings: MusicProviderSettings
  updateProviderSettings: (settings: Partial<MusicProviderSettings>) => void
}

const MusicContext = createContext<MusicContextType | null>(null)

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {}
  return fallback
}

function saveStored<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(() => loadStored(PREFS_KEY, { vol: 0.8 }).vol)
  const [muted, setMuted] = useState(false)
  const [queue, setQueue] = useState<Track[]>([])
  const [history, setHistory] = useState<Track[]>([])
  const [favorites, setFavorites] = useState<Track[]>(() => loadStored(FAVORITES_KEY, []))
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadStored(PLAYLISTS_KEY, []))
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off')
  const [shuffle, setShuffle] = useState(false)
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1)
  const [isExpanded, setExpanded] = useState(false)
  const [providerSettings, setProviderSettings] = useState<MusicProviderSettings>(() => getMusicSettings())

  // Create single audio instance
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.crossOrigin = 'anonymous'
    audio.volume = volume
    audioRef.current = audio

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const onEnded = () => handleTrackEnded()
    const onError = (e: Event) => {
      console.warn('[MusicPlayer] Audio element error:', e)
      setIsPlaying(false)
      toast('Playback error on this stream. Trying next track...', 'error')
      next()
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    // Anti-conflict: if video starts playing in Anime or Movies, pause music
    const onVideoPlay = () => {
      if (!audio.paused) {
        audio.pause()
        toast('Music paused for video playback')
      }
    }
    window.addEventListener('stark:video-play', onVideoPlay)

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      window.removeEventListener('stark:video-play', onVideoPlay)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Sync lyrics highlight with playback time
  useEffect(() => {
    if (!lyrics?.synced || lyrics.synced.length === 0) {
      setActiveLyricIndex(-1)
      return
    }

    const t = currentTime
    let active = -1
    for (let i = 0; i < lyrics.synced.length; i++) {
      if (t >= lyrics.synced[i].time) {
        active = i
      } else {
        break
      }
    }
    setActiveLyricIndex(active)
  }, [currentTime, lyrics])

  // Setup Media Session API (lockscreen, keyboards, mobile controls)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || 'Gaurxv Verse',
      artwork: currentTrack.artwork
        ? [
            { src: currentTrack.artwork, sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.artwork, sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.artwork, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    })

    navigator.mediaSession.setActionHandler('play', () => togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => prev())
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        seek(details.seekTime)
      }
    })
  }, [currentTrack])

  // Track termination handling (repeat one, play next in queue, or stop)
  const handleTrackEnded = () => {
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
      return
    }
    next()
  }

  // Play a specific track or resume
  const play = async (track?: Track) => {
    const audio = audioRef.current
    if (!audio) return

    if (!track) {
      if (currentTrack && audio.src) {
        try {
          await audio.play()
        } catch (err) {
          console.error('[MusicPlayer] Resume failed:', err)
        }
      }
      return
    }

    if (currentTrack?.id !== track.id) {
      if (currentTrack) {
        setHistory((h) => [currentTrack, ...h.slice(0, 49)])
      }
      setCurrentTrack(track)
      setCurrentTime(0)
      setDuration(track.duration || 0)
      setLyrics(null)

      let stream = track.streamUrl
      if (!stream && track.provider === 'piped') {
        const videoId = track.id.replace(/^piped:/, '')
        try {
          const resolved = await resolvePipedStreamUrl(videoId)
          if (resolved) stream = resolved
        } catch {}
      }

      if (stream) {
        audio.src = stream
        try {
          await audio.play()
        } catch (err) {
          console.warn('[MusicPlayer] Direct stream autoplay blocked or failed:', err)
        }
      }

      // Fetch lyrics asynchronously
      resolveTrackLyrics(track)
        .then((lyr) => {
          if (lyr) setLyrics(lyr)
        })
        .catch(() => {})
    } else {
      try {
        await audio.play()
      } catch (err) {
        console.warn('[MusicPlayer] Play failed:', err)
      }
    }
  }

  // Convenience helper playing track with optional playlist queue context
  const playTrack = async (track: Track, playlistContext?: Track[]) => {
    if (playlistContext && playlistContext.length > 0) {
      const idx = playlistContext.findIndex((t) => t.id === track.id)
      const subsequent = idx >= 0 ? playlistContext.slice(idx + 1) : playlistContext
      setQueue(subsequent)
    }
    await play(track)
  }

  const pause = () => {
    audioRef.current?.pause()
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const target = Math.max(0, Math.min(seconds, audio.duration || duration || seconds))
    audio.currentTime = target
    setCurrentTime(target)
  }

  const next = () => {
    if (queue.length > 0) {
      let nextIndex = 0
      if (shuffle && queue.length > 1) {
        nextIndex = Math.floor(Math.random() * queue.length)
      }
      const nextTrack = queue[nextIndex]
      const nextQueue = queue.filter((_, i) => i !== nextIndex)
      setQueue(nextQueue)
      play(nextTrack)
    } else if (repeatMode === 'all' && history.length > 0) {
      const allPlayed = [...history].reverse()
      if (currentTrack) allPlayed.push(currentTrack)
      const [first, ...rest] = allPlayed
      setHistory([])
      setQueue(rest)
      if (first) play(first)
    } else {
      pause()
      setIsPlaying(false)
    }
  }

  const prev = () => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 4) {
      seek(0)
      return
    }

    if (history.length > 0) {
      const [previousTrack, ...restHistory] = history
      if (currentTrack) {
        setQueue((q) => [currentTrack, ...q])
      }
      setHistory(restHistory)
      play(previousTrack)
    } else {
      seek(0)
    }
  }

  const setVolume = (v: number) => {
    const val = Math.max(0, Math.min(1, v))
    setVolumeState(val)
    if (audioRef.current) {
      audioRef.current.volume = val
    }
    saveStored(PREFS_KEY, { vol: val })
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    const nextMuted = !muted
    audioRef.current.muted = nextMuted
    setMuted(nextMuted)
  }

  const addToQueue = (track: Track) => {
    setQueue((q) => [...q, track])
    toast(`Added "${track.title}" to queue`)
  }

  const playNext = (track: Track) => {
    setQueue((q) => [track, ...q])
    toast(`Playing "${track.title}" next`)
  }

  const removeFromQueue = (index: number) => {
    setQueue((q) => q.filter((_, i) => i !== index))
  }

  const clearQueue = () => {
    setQueue([])
    toast('Queue cleared')
  }

  const toggleFavorite = (track: Track) => {
    setFavorites((favs) => {
      const exists = favs.some((t) => t.id === track.id)
      let nextFavs: Track[]
      if (exists) {
        nextFavs = favs.filter((t) => t.id !== track.id)
        toast(`Removed from favorites`)
      } else {
        nextFavs = [track, ...favs]
        toast(`Added to favorites`)
      }
      saveStored(FAVORITES_KEY, nextFavs)
      return nextFavs
    })
  }

  const isFavorite = (trackId: string): boolean => {
    return favorites.some((t) => t.id === trackId)
  }

  const toggleShuffle = () => {
    setShuffle((s) => !s)
  }

  const cycleRepeat = () => {
    setRepeatMode((cur) => {
      if (cur === 'off') return 'all'
      if (cur === 'all') return 'one'
      return 'off'
    })
  }

  const createPlaylist = (name: string): Playlist => {
    const p: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setPlaylists((lists) => {
      const next = [p, ...lists]
      saveStored(PLAYLISTS_KEY, next)
      return next
    })
    toast(`Playlist "${p.name}" created`)
    return p
  }

  const deletePlaylist = (playlistId: string) => {
    setPlaylists((lists) => {
      const next = lists.filter((pl) => pl.id !== playlistId)
      saveStored(PLAYLISTS_KEY, next)
      return next
    })
    toast('Playlist deleted')
  }

  const addToPlaylist = (playlistId: string, track: Track) => {
    setPlaylists((lists) => {
      const next = lists.map((pl) => {
        if (pl.id !== playlistId) return pl
        if (pl.tracks.some((t) => t.id === track.id)) return pl
        return {
          ...pl,
          tracks: [...pl.tracks, track],
          cover: pl.cover || track.artwork,
          updatedAt: Date.now(),
        }
      })
      saveStored(PLAYLISTS_KEY, next)
      toast(`Added to playlist`)
      return next
    })
  }

  const removeFromPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((lists) => {
      const next = lists.map((pl) => {
        if (pl.id !== playlistId) return pl
        return {
          ...pl,
          tracks: pl.tracks.filter((t) => t.id !== trackId),
          updatedAt: Date.now(),
        }
      })
      saveStored(PLAYLISTS_KEY, next)
      return next
    })
  }

  const updateProviderSettings = (newSettings: Partial<MusicProviderSettings>) => {
    setProviderSettings((prev) => {
      const next: MusicProviderSettings = {
        saavn: newSettings.saavn ?? prev.saavn,
        piped: newSettings.piped ?? prev.piped,
        archive: newSettings.archive ?? prev.archive,
      }
      saveMusicSettings(next)
      return next
    })
  }

  const openExpandedPlayer = () => setExpanded(true)

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        muted,
        queue,
        history,
        favorites,
        playlists,
        repeatMode,
        shuffle,
        lyrics,
        activeLyricIndex,
        isExpanded,
        play,
        playTrack,
        pause,
        togglePlay,
        seek,
        next,
        prev,
        setVolume,
        toggleMute,
        addToQueue,
        playNext,
        removeFromQueue,
        clearQueue,
        toggleFavorite,
        isFavorite,
        toggleShuffle,
        cycleRepeat,
        createPlaylist,
        deletePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        setExpanded,
        openExpandedPlayer,
        providerSettings,
        updateProviderSettings,
      }}
    >
      {children}
    </MusicContext.Provider>
  )
}

export function useMusic(): MusicContextType {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusic must be used within MusicPlayerProvider')
  return ctx
}
