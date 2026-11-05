/**
 * Builtin Media Providers
 *
 * In Music Manager v5.2, YouTube is the primary online media provider.
 * Resolves songs with source 'youtube' or YouTube video IDs to playable audio streams.
 */
import type { SongResult } from '@/types/music';
import type { PluginMediaSource } from '@/types/musicSourcePlugin';

import youtubeService from '../../youtubeService';
import type { MusicSourceProvider } from '../types';

export const youtubeProvider: MusicSourceProvider = {
  key: 'youtube',
  name: 'YouTube',
  kind: 'builtin',
  icon: 'ri-youtube-fill',
  color: '#ff0000',
  builtin: true,
  available: true,
  resolve: async (
    song: SongResult,
    _quality: string,
    _options
  ): Promise<PluginMediaSource | null> => {
    try {
      const rawId = String(song.id || '');
      const videoId = youtubeService.extractVideoId(rawId) || rawId;
      if (!videoId) return null;

      const stream = await youtubeService.getStreamUrl(videoId, { kind: 'audio' });
      const streamUrl = stream?.audioUrl || stream?.videoUrl;
      if (!streamUrl) return null;

      return {
        url: streamUrl,
        format: 'm4a',
        br: 160000,
        headers: stream?.headers
      };
    } catch (err) {
      console.error('[youtubeProvider] Failed to resolve stream URL:', err);
      return null;
    }
  }
};

export const builtinProviders: MusicSourceProvider[] = [youtubeProvider];
