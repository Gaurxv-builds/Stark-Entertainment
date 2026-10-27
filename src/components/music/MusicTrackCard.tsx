import React from 'react';
import { Play, Pause, Heart, ListPlus, Music as MusicIcon, Disc } from 'lucide-react';
import type { MusicTrack } from '../../types/music';
import { useMusic } from '../../context/MusicContext';

interface MusicTrackCardProps {
  track: MusicTrack;
  onPlay?: (track: MusicTrack) => void;
  playlistContext?: MusicTrack[];
}

export const MusicTrackCard: React.FC<MusicTrackCardProps> = ({
  track,
  onPlay,
  playlistContext,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, isFavorite, toggleFavorite, addToQueue } = useMusic();

  const isCurrent = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrent && isPlaying;
  const favorited = isFavorite(track.id);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlay();
    } else if (onPlay) {
      onPlay(track);
    } else {
      playTrack(track, playlistContext);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(track);
  };

  const handleQueueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={handlePlayClick}
      className={`group relative flex flex-col p-3 rounded-2xl bg-[#14151b]/80 border transition-all duration-300 cursor-pointer hover:bg-[#1c1d27] hover:shadow-xl hover:shadow-purple-950/20 hover:-translate-y-1 ${
        isCurrent
          ? 'border-purple-500/60 shadow-lg shadow-purple-900/30'
          : 'border-white/5 hover:border-purple-500/30'
      }`}
    >
      {/* Artwork container */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 mb-3 group/cover">
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt={track.title}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              isCurrentlyPlaying ? 'brightness-90' : ''
            }`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              e.currentTarget.parentElement?.querySelector('.fallback-art')?.classList.remove('hidden');
            }}
          />
        ) : null}

        {/* Fallback Artwork */}
        <div
          className={`fallback-art ${track.artworkUrl ? 'hidden' : ''} absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/40 via-neutral-900 to-neutral-950 text-purple-400`}
        >
          <Disc className={`w-12 h-12 opacity-40 ${isCurrentlyPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
        </div>

        {/* Playing Indicator Overlay */}
        {isCurrent && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-purple-500/90 text-white text-[10px] font-semibold tracking-wide flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {isCurrentlyPlaying ? 'Playing' : 'Paused'}
          </div>
        )}

        {/* Hover / Active Play Button Overlay */}
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-200 ${
            isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            onClick={handlePlayClick}
            aria-label={isCurrentlyPlaying ? 'Pause' : 'Play'}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-900/50 transform transition-transform hover:scale-110 active:scale-95"
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Quick action buttons floating on artwork */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleFavoriteClick}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-2 rounded-full backdrop-blur-md transition-all ${
              favorited
                ? 'bg-rose-500/80 text-white'
                : 'bg-black/60 text-white/80 hover:text-white hover:bg-black/80'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={handleQueueClick}
            aria-label="Add to queue"
            title="Add to queue"
            className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/80 transition-all"
          >
            <ListPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Track Info */}
      <div className="flex flex-col flex-1 min-w-0">
        <h4
          title={track.title}
          className={`text-sm font-semibold truncate transition-colors ${
            isCurrent ? 'text-purple-400' : 'text-neutral-100 group-hover:text-purple-300'
          }`}
        >
          {track.title}
        </h4>
        <p title={track.artist} className="text-xs text-neutral-400 truncate mt-0.5">
          {track.artist}
        </p>

        {/* Footer info: Provider pill + duration */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1 uppercase tracking-wider text-[10px] font-medium text-purple-400/80">
            <MusicIcon className="w-2.5 h-2.5" />
            {track.provider}
          </span>
          {track.duration ? (
            <span>{formatDuration(track.duration)}</span>
          ) : (
            <span className="text-[10px] text-neutral-600">Full</span>
          )}
        </div>
      </div>
    </div>
  );
};
