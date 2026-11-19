import { toPlayableMediaUrl } from '../utils/localMediaUrl';

export function bindOsMediaSessionHandlers(handlers: {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekTo: (seconds: number) => void;
}) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !navigator.mediaSession) {
    return;
  }
  try {
    navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        handlers.onSeekTo(details.seekTime);
      }
    });
  } catch {
    // Ignore unsupported action handler errors in headless environments
  }
}

export function updateOsMediaMetadata(track: {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  durationSec?: number;
  positionSec?: number;
  playbackRate?: number;
  isPlaying?: boolean;
}) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !navigator.mediaSession) {
    return;
  }

  try {
    const artworkSrc = track.coverUrl ? toPlayableMediaUrl(track.coverUrl) : '';

    if (typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Music Manager',
        artwork: artworkSrc ? [{ src: artworkSrc, sizes: '512x512', type: 'image/jpeg' }] : []
      });
    }

    if (typeof track.isPlaying === 'boolean') {
      navigator.mediaSession.playbackState = track.isPlaying ? 'playing' : 'paused';
    }

    if (
      track.durationSec &&
      track.durationSec > 0 &&
      Number.isFinite(track.durationSec) &&
      typeof navigator.mediaSession.setPositionState === 'function'
    ) {
      const rate =
        typeof track.playbackRate === 'number' &&
        Number.isFinite(track.playbackRate) &&
        track.playbackRate > 0
          ? track.playbackRate
          : 1.0;

      navigator.mediaSession.setPositionState({
        duration: track.durationSec,
        playbackRate: rate,
        position: Math.min(track.durationSec, Math.max(0, track.positionSec ?? 0))
      });
    }
  } catch {
    // Ignore transient position/metadata state errors during track load
  }
}
