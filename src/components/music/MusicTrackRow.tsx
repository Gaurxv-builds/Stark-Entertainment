import React from 'react';
import { Play, Pause, Heart, ListPlus, Music as MusicIcon, Disc } from 'lucide-react';
import type { MusicTrack } from '../../types/music';
import { useMusic } from '../../context/MusicContext';

interface MusicTrackRowProps {
  track: MusicTrack;
  index?: number;
  playlistContext?: MusicTrack[];
  onPlay?: (track: MusicTrack) => void;
  showIndex?: boolean;
}

export const MusicTrackRow: React.FC<MusicTrackRowProps> = ({
  track,
  index,
  playlistContext,
  onPlay,
  showIndex = true,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, isFavorite, toggleFavorite, addToQueue } = useMusic();

  const isCurrent = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrent && isPlaying;
  const favorited = isFavorite(track.id);

  const handlePlay = () => {
    if (isCurrent) {
      togglePlay();
    } else if (onPlay) {
      onPlay(track);
    } else {
      playTrack(track, playlistContext);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={handlePlay}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer border ${
        isCurrent
          ? 'bg-purple-950/20 border-purple-500/30'
          : 'bg-transparent hover:bg-white/[0.03] border-transparent hover:border-white/5'
      }`}
    >
      {/* Index or Play icon */}
      <div className="w-7 flex-shrink-0 flex items-center justify-center text-xs text-neutral-500">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          className="group-hover:flex items-center justify-center hidden w-7 h-7 rounded-full bg-purple-600 text-white shadow-sm"
          aria-label={isCurrentlyPlaying ? 'Pause' : 'Play'}
        >
          {isCurrentlyPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>

        <span className="group-hover:hidden font-mono">
          {isCurrentlyPlaying ? (
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse inline-block" />
          ) : showIndex && typeof index === 'number' ? (
            index + 1
          ) : (
            <MusicIcon className="w-3.5 h-3.5 opacity-50" />
          )}
        </span>
      </div>

      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              e.currentTarget.parentElement?.querySelector('.row-fallback-art')?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div
          className={`row-fallback-art ${track.artworkUrl ? 'hidden' : ''} absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-neutral-900 text-purple-400`}
        >
          <Disc className="w-5 h-5 opacity-40" />
        </div>
      </div>

      {/* Title & Artist */}
      <div className="flex-1 min-w-0 pr-2">
        <p
          className={`text-sm font-medium truncate ${
            isCurrent ? 'text-purple-400 font-semibold' : 'text-neutral-200 group-hover:text-white'
          }`}
        >
          {track.title}
        </p>
        <p className="text-xs text-neutral-400 truncate mt-0.5">{track.artist}</p>
      </div>

      {/* Provider Pill (Desktop) */}
      <div className="hidden sm:flex items-center">
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
          {track.provider}
        </span>
      </div>

      {/* Duration */}
      <div className="text-xs font-mono text-neutral-500 w-12 text-right">
        {formatDuration(track.duration)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(track);
          }}
          aria-label={favorited ? 'Remove favorite' : 'Add favorite'}
          className={`p-1.5 rounded-lg transition-colors ${
            favorited ? 'text-rose-500' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            addToQueue(track);
          }}
          aria-label="Add to queue"
          title="Add to queue"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
        >
          <ListPlus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
