import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Flame,
  Sparkles,
  Heart,
  ListMusic,
  Radio,
  Sliders,
  Play,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Disc,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { MusicTrackCard } from '../components/music/MusicTrackCard';
import { MusicTrackRow } from '../components/music/MusicTrackRow';
import { fetchMusicShelves, searchAllMusic } from '../services/music';
import type { MusicTrack, MusicShelf } from '../types/music';
import { pageTitle } from '../lib/brand';

const GENRE_PILLS = [
  'All',
  'Lo-Fi',
  'Electronic',
  'Synthwave',
  'Chillhop',
  'Hip-Hop',
  'Ambient',
  'Classical',
  'Rock',
];

export default function MusicPage() {
  const {
    playTrack,
    favorites,
    playlists,
    createPlaylist,
    deletePlaylist,
    providerSettings,
    updateProviderSettings,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'discover' | 'favorites' | 'playlists' | 'sources'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [shelves, setShelves] = useState<MusicShelf[]>([]);
  const [isLoadingShelves, setIsLoadingShelves] = useState(true);
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Playlist creation modal
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    document.title = pageTitle('Music');
  }, []);

  // Load curated shelves on mount
  useEffect(() => {
    let isMounted = true;
    async function loadShelves() {
      setIsLoadingShelves(true);
      try {
        const data = await fetchMusicShelves();
        if (isMounted) {
          setShelves(data);
        }
      } catch (err) {
        console.error('Failed to load music shelves:', err);
      } finally {
        if (isMounted) setIsLoadingShelves(false);
      }
    }
    loadShelves();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Search Execution
  const handleSearch = async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchAllMusic(q, providerSettings);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search trigger when typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery, providerSettings]);

  // Filter shelves by selected genre if not "All"
  const filteredShelves = useMemo(() => {
    if (selectedGenre === 'All') return shelves;
    return shelves.filter((s) =>
      s.title.toLowerCase().includes(selectedGenre.toLowerCase()) ||
      s.id.toLowerCase().includes(selectedGenre.toLowerCase())
    );
  }, [shelves, selectedGenre]);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handlePlayAll = (tracks: MusicTrack[]) => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const playlist = createPlaylist(newPlaylistName.trim());
    setSelectedPlaylistId(playlist.id);
    setNewPlaylistName('');
    setShowNewPlaylistModal(false);
  };

  return (
    <main className="min-h-screen bg-[#08080c] text-neutral-100 pb-32">
      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-fuchsia-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28">
        {/* Header / Hero */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Headphones className="w-3.5 h-3.5" />
              <span>Gaurxv Verse Music</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-purple-300 bg-clip-text text-transparent">
              Sound Without Limits.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 max-w-2xl">
              Stream complete, ad-free music tracks with synchronized lyrics and zero commercial interruptions.
            </p>
          </div>

          {/* Quick Engine Status Indicator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('sources')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/30 text-xs text-neutral-300 transition-all"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>Engine: Audius & LRCLIB</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                0 Ads
              </span>
            </button>
          </div>
        </div>

        {/* Search Bar & Genre Filter */}
        <div className="mt-8 space-y-4">
          <div className="relative max-w-2xl">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracks, artists, genres, remixes..."
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[#12131a] border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-lg shadow-black/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Genre Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {GENRE_PILLS.map((genre) => (
              <button
                key={genre}
                onClick={() => {
                  setSelectedGenre(genre);
                  if (genre !== 'All' && searchQuery) {
                    setSearchQuery(genre);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedGenre === genre
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                    : 'bg-white/5 border border-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'discover'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Discover</span>
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'favorites'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Favorites ({favorites.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('playlists')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'playlists'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span>Playlists ({playlists.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'sources'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Sources & Transparency</span>
            </button>
          </div>

          {/* View toggle (Grid / List) */}
          <div className="hidden sm:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 text-xs text-neutral-400">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'hover:text-white'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-purple-600 text-white' : 'hover:text-white'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* TAB 1: DISCOVER / SEARCH RESULTS */}
        {activeTab === 'discover' && (
          <div className="mt-8 space-y-12">
            {/* Live Search Results if search query is active */}
            {searchQuery.trim() ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Search className="w-5 h-5 text-purple-400" />
                      Results for "{searchQuery}"
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      {isSearching
                        ? 'Searching free music catalogs...'
                        : `Found ${searchResults.length} tracks`}
                    </p>
                  </div>
                  {searchResults.length > 0 && (
                    <button
                      onClick={() => handlePlayAll(searchResults)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Play All
                    </button>
                  )}
                </div>

                {isSearching ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse bg-white/5 rounded-2xl p-3 h-56 flex flex-col justify-between"
                      >
                        <div className="bg-white/10 aspect-square rounded-xl w-full" />
                        <div className="space-y-2 mt-3">
                          <div className="h-3.5 bg-white/10 rounded w-3/4" />
                          <div className="h-2.5 bg-white/5 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-16 bg-[#12131a]/50 rounded-2xl border border-white/5">
                    <Disc className="w-12 h-12 text-neutral-600 mx-auto mb-3 animate-spin-slow" />
                    <h3 className="text-base font-semibold text-neutral-200">No tracks found</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                      Try searching for different keywords or explore popular genres like Lo-Fi, Electronic, or Synthwave.
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
                  <div className="space-y-1 bg-[#101117] rounded-2xl p-2 border border-white/5">
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
              /* Curated Shelves */
              <>
                {isLoadingShelves ? (
                  <div className="space-y-10">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="space-y-4">
                        <div className="h-6 bg-white/10 rounded w-48 animate-pulse" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} className="h-56 bg-white/5 rounded-2xl animate-pulse" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredShelves.length === 0 ? (
                  <div className="text-center py-16 text-neutral-500">
                    No shelves matching "{selectedGenre}".
                  </div>
                ) : (
                  filteredShelves.map((shelf) => (
                    <section key={shelf.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {shelf.id === 'trending' ? (
                              <Flame className="w-5 h-5 text-amber-400" />
                            ) : (
                              <Sparkles className="w-5 h-5 text-purple-400" />
                            )}
                            {shelf.title}
                          </h2>
                          {shelf.description && (
                            <p className="text-xs text-neutral-400 mt-0.5">{shelf.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handlePlayAll(shelf.tracks)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-purple-600 text-neutral-300 hover:text-white text-xs font-semibold border border-white/10 hover:border-purple-500 transition-all active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Play Shelf
                        </button>
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
                        <div className="space-y-1 bg-[#101117] rounded-2xl p-2 border border-white/5">
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
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-current" />
                  Your Favorites
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  {favorites.length} saved track{favorites.length === 1 ? '' : 's'}
                </p>
              </div>

              {favorites.length > 0 && (
                <button
                  onClick={() => handlePlayAll(favorites)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play All Favorites
                </button>
              )}
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-20 bg-[#12131a]/50 rounded-2xl border border-white/5">
                <Heart className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-neutral-200">No favorites yet</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
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
              <div className="space-y-1 bg-[#101117] rounded-2xl p-2 border border-white/5">
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
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-purple-400" />
                  Your Playlists
                </h2>
                <p className="text-xs text-neutral-400 mt-1">Create and manage personal mixes</p>
              </div>

              <button
                onClick={() => setShowNewPlaylistModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                New Playlist
              </button>
            </div>

            {/* Playlists Horizontal Bar / List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedPlaylistId === pl.id
                        ? 'bg-purple-900/30 border-purple-500 text-white shadow-md'
                        : 'bg-[#12131a] border-white/5 text-neutral-300 hover:bg-[#181922]'
                    }`}
                  >
                    <div>
                      <h4 className="text-sm font-semibold">{pl.name}</h4>
                      <p className="text-xs text-neutral-500">
                        {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete playlist "${pl.name}"?`)) {
                          deletePlaylist(pl.id);
                          if (selectedPlaylistId === pl.id) setSelectedPlaylistId(null);
                        }
                      }}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 transition-colors"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Selected Playlist Details */}
              <div className="md:col-span-2 bg-[#12131a] border border-white/5 rounded-2xl p-5 min-h-[300px]">
                {selectedPlaylist ? (
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">{selectedPlaylist.name}</h3>
                        <p className="text-xs text-neutral-400">
                          {selectedPlaylist.tracks.length} tracks in playlist
                        </p>
                      </div>
                      {selectedPlaylist.tracks.length > 0 && (
                        <button
                          onClick={() => handlePlayAll(selectedPlaylist.tracks)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Play Playlist
                        </button>
                      )}
                    </div>

                    {selectedPlaylist.tracks.length === 0 ? (
                      <div className="text-center py-12 text-neutral-500 text-xs">
                        This playlist is empty. Click "+ Add to queue" or drag tracks to add them.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {selectedPlaylist.tracks.map((track: MusicTrack, i: number) => (
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
                  <div className="text-center py-20 text-neutral-500 text-xs">
                    Select a playlist to view tracks, or create a new playlist.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOURCES & TRANSPARENCY */}
        {activeTab === 'sources' && (
          <div className="mt-8 space-y-8 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                Playback Engines & Architectural Transparency
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Gaurxv Verse operates strictly with verified zero-ad, free-access music providers. Below is an honest audit of available sources.
              </p>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Audius */}
              <div className="p-5 rounded-2xl bg-[#12131a] border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white">Audius Protocol</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    ACTIVE (PRIMARY)
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Decentralized music catalog of over 1,000,000+ indie and electronic tracks. Provides full-length 320kbps MP3 audio, HTTP 206 range seeking, and authentic zero ads.
                </p>
                <div className="text-[11px] text-neutral-500 font-mono">
                  Capabilities: Full playback, HTTP Range Seek, Zero Pre-Roll Ads
                </div>
              </div>

              {/* LRCLIB */}
              <div className="p-5 rounded-2xl bg-[#12131a] border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white">LRCLIB Synchronized Lyrics</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Community-driven open lyrics database. Delivers precise millisecond-accurate synchronized lyrics with active karaoke scrolling and plain lyrics fallback.
                </p>
                <div className="text-[11px] text-neutral-500 font-mono">
                  Capabilities: Synced LRC timestamps, Zero API key required
                </div>
              </div>

              {/* Internet Archive */}
              <div className="p-5 rounded-2xl bg-[#12131a] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white">Internet Archive Open Audio</h3>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={providerSettings.archive}
                      onChange={(e) =>
                        updateProviderSettings({ archive: e.target.checked })
                      }
                      className="rounded bg-neutral-900 border-white/20 text-purple-600 focus:ring-0"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Historical audio, public domain classical music, netlabels, and Creative Commons live concert recordings.
                </p>
                <div className="text-[11px] text-neutral-500 font-mono">
                  Capabilities: Public domain & Creative Commons audio
                </div>
              </div>

              {/* YouTube / ViMusic / StreamX notice */}
              <div className="p-5 rounded-2xl bg-[#12131a] border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-white">YouTube Music & ViMusic Engine</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] font-mono">
                    EXPERIMENTAL / DISABLED
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Browser clients cannot directly stream YouTube <code className="text-purple-300">googlevideo.com</code> media URLs without a specialized backend proxy due to strict CORS barriers, ciphered <code className="text-purple-300">n-token</code> challenges, and Google Botguard <code className="text-purple-300">po-token</code> verification.
                </p>
                <div className="text-[11px] text-neutral-500 font-mono">
                  Status: Disabled by default to prevent playback errors
                </div>
              </div>
            </div>

            {/* Disclaimer & Policy Notice */}
            <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/20 text-xs text-neutral-400 space-y-2">
              <h4 className="font-semibold text-purple-300 text-sm">Honest Availability Notice</h4>
              <p>
                We do not claim universal music availability. Because we strictly respect free-access principles and avoid ad-injection, commercial Top-40 Billboard songs not published to open networks like Audius or Archive are not artificially previewed. You receive 100% full songs without 30-second truncation or advertising.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#15161f] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Create New Playlist</h3>
              <button
                onClick={() => setShowNewPlaylistModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">Playlist Name</label>
                <input
                  type="text"
                  autoFocus
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Midnight Beats"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
