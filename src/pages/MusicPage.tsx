import React, { useState, useEffect, useMemo } from 'react'
import {
  Flame,
  Sparkles,
  Heart,
  ListMusic,
  Play,
  Disc,
  X,
  Plus,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react'
import { useMusic } from '../context/MusicContext'
import { MusicTrackCard } from '../components/music/MusicTrackCard'
import { MusicTrackRow } from '../components/music/MusicTrackRow'
import { DiscoverHero } from '../components/DiscoverHero'
import { Tabs } from '../components/Tabs'
import {
  fetchMusicShelves,
  searchAllMusic,
  searchSaavnTracks,
  searchPipedTracks,
} from '../services/music'
import type { MusicTrack, MusicShelf, MusicProviderSettings } from '../types/music'
import { pageTitle } from '../lib/brand'
import { cn } from '../lib/utils'

const GENRE_PILLS = [
  'All',
  'Bollywood',
  'Punjabi',
  'Pop',
  'Lo-Fi',
  'Hip-Hop',
  'EDM',
  'Acoustic',
  'Devotional',
] as const

type Genre = (typeof GENRE_PILLS)[number]

const MUSIC_SOURCES = [
  { id: 'all', label: 'All Engines' },
  { id: 'saavn', label: 'JioSaavn' },
  { id: 'piped', label: 'YouTube (Piped)' },
] as const

type MusicSourceId = (typeof MUSIC_SOURCES)[number]['id']

export default function MusicPage() {
  const {
    playTrack,
    favorites,
    playlists,
    createPlaylist,
    deletePlaylist,
    providerSettings,
    updateProviderSettings,
  } = useMusic()

  const [activeTab, setActiveTab] = useState<'discover' | 'favorites' | 'playlists'>('discover')
  const [sourceFilter, setSourceFilter] = useState<MusicSourceId>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState<Genre>('All')
  const [shelves, setShelves] = useState<MusicShelf[]>([])
  const [isLoadingShelves, setIsLoadingShelves] = useState(true)
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)

  useEffect(() => {
    document.title = pageTitle('Music')
  }, [])

  // Load curated shelves on mount
  useEffect(() => {
    let isMounted = true
    async function loadShelves() {
      setIsLoadingShelves(true)
      try {
        const data = await fetchMusicShelves()
        if (isMounted) {
          setShelves(data)
        }
      } catch (err) {
        console.error('Failed to load music shelves:', err)
      } finally {
        if (isMounted) setIsLoadingShelves(false)
      }
    }
    loadShelves()
    return () => {
      isMounted = false
    }
  }, [])

  // Active settings based on quick source filter tab
  const activeSettings = useMemo<MusicProviderSettings>(() => {
    if (sourceFilter === 'saavn') {
      return { saavn: true, piped: false, archive: false }
    }
    if (sourceFilter === 'piped') {
      return { saavn: false, piped: true, archive: false }
    }
    return providerSettings
  }, [sourceFilter, providerSettings])

  // Execute Search
  const handleSearch = async (queryToSearch: string) => {
    const q = queryToSearch.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      let results: MusicTrack[] = []
      if (sourceFilter === 'saavn') {
        results = await searchSaavnTracks(q, 25)
      } else if (sourceFilter === 'piped') {
        results = await searchPipedTracks(q, 25)
      } else {
        results = await searchAllMusic(q, activeSettings, 25)
      }
      setSearchResults(results)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search trigger when typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If a specific genre is selected and no search text, load genre tracks
      if (selectedGenre !== 'All') {
        let genreQuery = `${selectedGenre.toLowerCase()} songs`
        if (selectedGenre === 'Bollywood') genreQuery = 'bollywood top hits'
        if (selectedGenre === 'Punjabi') genreQuery = 'punjabi hits'
        if (selectedGenre === 'Devotional') genreQuery = 'devotional bhakti songs'
        if (selectedGenre === 'Lo-Fi') genreQuery = 'lofi hindi chill'
        if (selectedGenre === 'Hip-Hop') genreQuery = 'indian hip hop rap'
        handleSearch(genreQuery)
      } else {
        setSearchResults([])
      }
      return
    }
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 450)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedGenre, sourceFilter, activeSettings])

  // Backdrop images extracted from top shelf tracks
  const backdrop = useMemo(() => {
    const allTracks = shelves.flatMap((s) => s.tracks)
    return allTracks
      .filter((t) => t.artwork)
      .slice(0, 15)
      .map((t) => ({ src: t.artwork!, title: t.title }))
  }, [shelves])

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId)

  const handlePlayAll = (tracks: MusicTrack[]) => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks)
    }
  }

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    const playlist = createPlaylist(newPlaylistName.trim())
    setSelectedPlaylistId(playlist.id)
    setNewPlaylistName('')
    setShowNewPlaylistModal(false)
  }

  const isSearchActive = !!searchQuery.trim() || selectedGenre !== 'All'

  return (
    <main className="min-h-screen pb-32">
      {/* Redesigned Hero matching EbooksHomePage */}
      <DiscoverHero
        watermark="MUSIC"
        eyebrow="YOUR AUDIO UNIVERSE"
        title="Sound Without"
        accent="Limits."
        subtitle="Stream millions of Bollywood, regional Indian, and global English tracks with high-fidelity audio and zero ads."
        query={searchQuery}
        onQuery={setSearchQuery}
        placeholder="Search songs, artists, albums, or genres..."
        backdrop={backdrop}
        blurBackdrop
      >
        <Tabs
          tabs={MUSIC_SOURCES as any}
          value={sourceFilter}
          onChange={(s) => setSourceFilter(s as MusicSourceId)}
        />
      </DiscoverHero>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Genre Pills Bar matching Ebooks Design */}
        <section aria-label="Music genres" className="w-full">
          <div className="no-scrollbar flex items-center justify-between gap-3 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 shrink-0">
              {GENRE_PILLS.map((genre) => {
                const active = selectedGenre === genre && !searchQuery.trim()
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      setSelectedGenre(genre)
                      if (searchQuery.trim()) setSearchQuery('')
                    }}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition active:scale-95',
                      active
                        ? 'border-accent bg-accent text-accent-fg shadow-md shadow-accent/20'
                        : 'border-border bg-card/60 text-muted hover:border-border/80 hover:text-foreground'
                    )}
                  >
                    {genre}
                  </button>
                )
              })}
            </div>

            {/* Provider Settings Button */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-2 text-xs font-semibold text-muted hover:text-accent hover:border-accent/40 backdrop-blur transition active:scale-95"
              title="Provider Settings & Engines"
            >
              <SlidersHorizontal className="size-3.5 text-accent" />
              <span>Engines</span>
            </button>
          </div>
        </section>

        {/* View Mode & Sub-Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('discover')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition active:scale-95',
                activeTab === 'discover'
                  ? 'border border-accent/30 bg-accent/15 text-accent shadow-sm'
                  : 'text-muted hover:bg-card/40 hover:text-foreground'
              )}
            >
              <Sparkles className="size-4 text-accent" />
              <span>Discover</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition active:scale-95',
                activeTab === 'favorites'
                  ? 'border border-accent/30 bg-accent/15 text-accent shadow-sm'
                  : 'text-muted hover:bg-card/40 hover:text-foreground'
              )}
            >
              <Heart className="size-4 text-rose-400" />
              <span>Favorites ({favorites.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('playlists')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition active:scale-95',
                activeTab === 'playlists'
                  ? 'border border-accent/30 bg-accent/15 text-accent shadow-sm'
                  : 'text-muted hover:bg-card/40 hover:text-foreground'
              )}
            >
              <ListMusic className="size-4 text-accent" />
              <span>Playlists ({playlists.length})</span>
            </button>
          </div>

          {/* Grid / List View Toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-card/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-lg px-2.5 py-1 font-semibold transition',
                viewMode === 'grid'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-lg px-2.5 py-1 font-semibold transition',
                viewMode === 'list'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              List
            </button>
          </div>
        </div>

        {/* TAB 1: DISCOVER / SEARCH / SHELVES */}
        {activeTab === 'discover' && (
          <div className="space-y-12">
            {isSearchActive ? (
              /* Search or Genre Filter Results */
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Sparkles className="size-5 text-accent" />
                      {searchQuery.trim() ? (
                        <>Matches for “{searchQuery}”</>
                      ) : (
                        <>{selectedGenre} Hits</>
                      )}
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      {isSearching
                        ? 'Querying high-bitrate music engines...'
                        : `Found ${searchResults.length} tracks via ${
                            sourceFilter === 'saavn'
                              ? 'JioSaavn'
                              : sourceFilter === 'piped'
                              ? 'YouTube (Piped)'
                              : 'Unified Engines'
                          }`}
                    </p>
                  </div>
                  {searchResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePlayAll(searchResults)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
                    >
                      <Play className="size-3.5 fill-current" />
                      Play All
                    </button>
                  )}
                </div>

                {isSearching ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse bg-card/40 rounded-2xl p-3 h-56 flex flex-col justify-between border border-border/30"
                      >
                        <div className="bg-muted/20 aspect-square rounded-xl w-full" />
                        <div className="space-y-2 mt-3">
                          <div className="h-3.5 bg-muted/20 rounded w-3/4" />
                          <div className="h-2.5 bg-muted/10 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl border border-border/40 bg-card/40 backdrop-blur">
                    <Disc className="size-12 text-muted/50 mx-auto mb-3 animate-spin-slow" />
                    <h3 className="text-base font-semibold text-foreground">No tracks found</h3>
                    <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                      Try searching for different keywords or toggle active providers in Engines.
                    </p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {searchResults.map((track) => (
                      <MusicTrackCard
                        key={track.id}
                        track={track}
                        playlistContext={searchResults}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1 rounded-2xl p-2 border border-border/40 bg-card/40 backdrop-blur">
                    {searchResults.map((track, i) => (
                      <MusicTrackRow
                        key={track.id}
                        track={track}
                        index={i}
                        playlistContext={searchResults}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Curated Shelves (Bollywood, Trending, Punjabi, Pop, Lo-Fi, Hip-Hop) */
              <>
                {isLoadingShelves ? (
                  <div className="space-y-10">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="space-y-4">
                        <div className="h-6 bg-card/60 rounded w-48 animate-pulse" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} className="h-56 bg-card/40 rounded-2xl animate-pulse" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  shelves.map((shelf) => (
                    <section key={shelf.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-display text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            {shelf.id === 'trending' ? (
                              <Flame className="size-5 text-amber-400" />
                            ) : (
                              <Sparkles className="size-5 text-accent" />
                            )}
                            {shelf.title}
                          </h2>
                          {shelf.description && (
                            <p className="text-xs text-muted mt-0.5">{shelf.description}</p>
                          )}
                        </div>
                        {shelf.tracks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handlePlayAll(shelf.tracks)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-muted hover:border-accent hover:text-accent backdrop-blur transition active:scale-95"
                          >
                            <Play className="size-3.5 fill-current" />
                            Play Shelf
                          </button>
                        )}
                      </div>

                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {shelf.tracks.map((track) => (
                            <MusicTrackCard
                              key={track.id}
                              track={track}
                              playlistContext={shelf.tracks}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1 rounded-2xl p-2 border border-border/40 bg-card/40 backdrop-blur">
                          {shelf.tracks.map((track, i) => (
                            <MusicTrackRow
                              key={track.id}
                              track={track}
                              index={i}
                              playlistContext={shelf.tracks}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: FAVORITES */}
        {activeTab === 'favorites' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Heart className="size-5 text-rose-500 fill-current" />
                  Your Favorites
                </h2>
                <p className="text-xs text-muted mt-1">
                  {favorites.length} saved track{favorites.length === 1 ? '' : 's'}
                </p>
              </div>

              {favorites.length > 0 && (
                <button
                  type="button"
                  onClick={() => handlePlayAll(favorites)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
                >
                  <Play className="size-3.5 fill-current" />
                  Play All Favorites
                </button>
              )}
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border border-border/40 bg-card/40 backdrop-blur">
                <Heart className="size-12 text-muted/40 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground">No favorites yet</h3>
                <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                  Click the heart icon on any track to save it here for fast playback.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {favorites.map((track) => (
                  <MusicTrackCard
                    key={track.id}
                    track={track}
                    playlistContext={favorites}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1 rounded-2xl p-2 border border-border/40 bg-card/40 backdrop-blur">
                {favorites.map((track, i) => (
                  <MusicTrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    playlistContext={favorites}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PLAYLISTS */}
        {activeTab === 'playlists' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <ListMusic className="size-5 text-accent" />
                  Your Playlists
                </h2>
                <p className="text-xs text-muted mt-1">Create and manage personal mixes</p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewPlaylistModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
              >
                <Plus className="size-3.5" />
                New Playlist
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className={cn(
                      'p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between',
                      selectedPlaylistId === pl.id
                        ? 'border-accent bg-accent/15 text-foreground shadow-md'
                        : 'border-border/40 bg-card/60 text-muted hover:bg-card/80 hover:text-foreground'
                    )}
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{pl.name}</h4>
                      <p className="text-xs text-muted">
                        {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete playlist "${pl.name}"?`)) {
                          deletePlaylist(pl.id)
                          if (selectedPlaylistId === pl.id) setSelectedPlaylistId(null)
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted hover:text-red-400 transition"
                      title="Delete playlist"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="md:col-span-2 rounded-2xl border border-border/40 bg-card/40 p-5 min-h-[300px] backdrop-blur">
                {selectedPlaylist ? (
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-border/40 mb-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-foreground">
                          {selectedPlaylist.name}
                        </h3>
                        <p className="text-xs text-muted">
                          {selectedPlaylist.tracks.length} tracks in playlist
                        </p>
                      </div>
                      {selectedPlaylist.tracks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handlePlayAll(selectedPlaylist.tracks)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
                        >
                          <Play className="size-3.5 fill-current" />
                          Play Playlist
                        </button>
                      )}
                    </div>

                    {selectedPlaylist.tracks.length === 0 ? (
                      <div className="text-center py-12 text-muted text-xs">
                        This playlist is empty. Add tracks from any search result or shelf.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {selectedPlaylist.tracks.map((track, i) => (
                          <MusicTrackRow
                            key={track.id}
                            track={track}
                            index={i}
                            playlistContext={selectedPlaylist.tracks}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-20 text-muted text-xs">
                    Select a playlist to view tracks, or create a new playlist.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Settings Modal / Sheet */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur-xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-accent" />
                <h3 className="font-display text-base font-bold text-foreground">
                  Music Provider Engines
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="grid size-7 place-items-center rounded-lg text-muted hover:text-foreground hover:bg-white/10 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Configure active zero-ad streaming gateways. Searches automatically query the enabled
              providers concurrently and deduplicate matching results.
            </p>

            <div className="space-y-3">
              {/* JioSaavn */}
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-black/20 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">JioSaavn Gateway</span>
                    <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                      320kbps AAC
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Bollywood, Punjabi, regional Indian, and global English music with high-resolution
                    artwork.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={providerSettings.saavn}
                    onChange={(e) => updateProviderSettings({ saavn: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-muted/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                </label>
              </div>

              {/* Piped / YouTube */}
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-black/20 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">YouTube (Piped API)</span>
                    <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                      Full Audio
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Ad-free playback across YouTube's global catalog via decentralized, privacy-respecting
                    Piped instances.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={providerSettings.piped}
                    onChange={(e) => updateProviderSettings({ piped: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-muted/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                </label>
              </div>

              {/* Internet Archive */}
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-black/20 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">Internet Archive Open Audio</span>
                    <span className="rounded bg-muted/30 px-2 py-0.5 text-[10px] font-bold text-muted">
                      Public Domain
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Public domain recordings, Creative Commons live concerts, netlabels, and ambient
                    tracks.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={providerSettings.archive}
                    onChange={(e) => updateProviderSettings({ archive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-muted/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-accent-fg transition hover:brightness-110 active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-display text-base font-bold text-foreground">Create New Playlist</h3>
              <button
                type="button"
                onClick={() => setShowNewPlaylistModal(false)}
                className="grid size-7 place-items-center rounded-lg text-muted hover:text-foreground hover:bg-white/10 transition"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Playlist Name</label>
                <input
                  type="text"
                  autoFocus
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Desi Chill, Bollywood Roadtrip"
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(false)}
                  className="px-3.5 py-1.5 rounded-full text-xs text-muted hover:text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-4 py-1.5 rounded-full bg-accent text-accent-fg disabled:opacity-50 text-xs font-bold shadow-md transition hover:brightness-110 active:scale-95"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
