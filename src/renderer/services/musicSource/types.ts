/**
 *
 */
import type { SongResult } from '@/types/music';
import type { MusicSourcePlugin, PluginMediaSource } from '@/types/musicSourcePlugin';

export type MusicSourceKind = 'builtin' | 'plugin';

export type ResolveCallOptions = {
  isDownload?: boolean;
};

export type MusicSourceProvider = {
  /** Provider key: e.g. 'youtube', or 'plugin:<id>' */
  key: string;
  name: string;
  kind: MusicSourceKind;
  icon: string;
  color: string;
  builtin: boolean;
  available: boolean;
  configHint?: string;
  resolve: (
    song: SongResult,
    quality: string,
    options?: ResolveCallOptions
  ) => Promise<PluginMediaSource | null>;
  plugin?: MusicSourcePlugin;
};

export type ResolveAttempt = {
  providerKey: string;
  ok: boolean;
  reason?: 'no-source' | 'timeout' | 'error' | 'skipped';
  detail?: string;
  costMs?: number;
};

export type ResolveSongResult = {
  media: PluginMediaSource;
  providerKey: string;
  providerName: string;
  attempts: ResolveAttempt[];
};
