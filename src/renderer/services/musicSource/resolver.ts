/**
 *
 */
import { SongSourceConfigManager } from '@/services/SongSourceConfigManager';
import { useSettingsStore } from '@/store';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import { remoteMediaProxyUrl } from '@/utils/localMediaUrl';

import { validatePluginMediaSource } from '../../../shared/musicSourcePlugin';
import { inferPluginAudioFormat, qualityToBitrate } from '../musicSourcePluginProtocol';
import { MusicResolveCache } from './cache';
import { useMusicSourceRegistry } from './registry';
import type { ResolveAttempt, ResolveSongResult } from './types';

const STAGE_BUDGET_MS = 15_000;
const CHAIN_BUDGET_MS = 30_000;

export type ResolveSongOptions = {
  sourceKeys?: string[];
  quality?: string;
  isDownload?: boolean;
  force?: boolean;
};

/**
 *
 *
 */
const verifyMediaUrl = async (
  url: string,
  headers?: Record<string, string>,
  depth = 0
): Promise<string | null> => {
  if (!url) return null;
  if (url.includes('googlevideo.com') || url.includes('127.0.0.1') || url.includes('localhost')) {
    return url;
  }
  if (!isElectron || typeof window.api?.lxMusicHttpRequest !== 'function') return url;
  if (depth > 2) return url;

  try {
    const requestId = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const response = await window.api.lxMusicHttpRequest({
      url,
      options: {
        method: 'GET',
        headers: { ...(headers || {}), Range: 'bytes=0-8191' },
        timeout: 10000
      },
      requestId
    });

    const status = response?.statusCode ?? 0;
    if (status < 200 || status >= 400) return null;

    const contentType = String(response?.headers?.['content-type'] || '');
    if (/audio\/|octet-stream|video\/|mpeg/i.test(contentType)) {
      return url;
    }

    const body = response?.body;
    if (body && typeof body === 'object') {
      const raw = body as Record<string, any>;
      const inner = raw.url || raw.data?.url || raw.audio_url || raw.link || raw.src;
      if (typeof inner === 'string' && /^https?:\/\//i.test(inner) && inner !== url) {
        return verifyMediaUrl(inner, undefined, depth + 1);
      }
    }
    return null;
  } catch {
    return null;
  }
};

const effectiveSourceKeys = (songId: string | number): string[] | undefined => {
  const numericId = typeof songId === 'number' ? songId : parseInt(songId, 10);
  if (!Number.isNaN(numericId)) {
    const songConfig = SongSourceConfigManager.getConfig(numericId);
    if (songConfig && songConfig.sources.length > 0) return songConfig.sources;
  }
  return undefined;
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

/**
 */
export const resolveSong = async (
  song: SongResult,
  options: ResolveSongOptions = {}
): Promise<ResolveSongResult | null> => {
  if (!isElectron) return null;

  const settingsStore = useSettingsStore();
  const { orderedProviders } = useMusicSourceRegistry();

  const sourceKeys = options.sourceKeys ?? effectiveSourceKeys(song.id);
  const quality = options.quality || settingsStore.setData?.musicQuality || 'higher';
  const globalKeys: string[] = settingsStore.setData?.enabledMusicSources || [];

  const songId = song.id;

  if (!options.force) {
    const cached = await MusicResolveCache.getCachedMusicUrl(songId, sourceKeys ?? globalKeys);
    if (cached) {
      return {
        media: validatePluginMediaSource({
          url: cached.url,
          format: cached.format,
          br: cached.br
        })!,
        providerKey: cached.providerKey,
        providerName: cached.providerName,
        attempts: [
          { providerKey: cached.providerKey, ok: true, reason: 'no-source', detail: 'cache-hit' }
        ]
      };
    }
  }

  const candidates = orderedProviders(sourceKeys);
  const attempts: ResolveAttempt[] = [];
  const chainStart = Date.now();
  const chainDeadline = chainStart + CHAIN_BUDGET_MS;

  for (const provider of candidates) {
    const stageStart = Date.now();
    if (stageStart >= chainDeadline) {
      attempts.push({
        providerKey: provider.key,
        ok: false,
        reason: 'timeout',
        detail: 'chain-budget'
      });
      continue;
    }

    if (MusicResolveCache.isInFailedCache(songId, provider.key)) {
      attempts.push({ providerKey: provider.key, ok: false, reason: 'skipped' });
      continue;
    }

    try {
      const raw = await withTimeout(
        provider.resolve(song, quality, { isDownload: options.isDownload }),
        STAGE_BUDGET_MS
      );
      if (!raw) {
        attempts.push({
          providerKey: provider.key,
          ok: false,
          reason: 'no-source',
          costMs: Date.now() - stageStart
        });
        MusicResolveCache.addFailedCache(songId, provider.key);
        continue;
      }

      const resolvedUrl = await withTimeout(verifyMediaUrl(raw.url, raw.headers), STAGE_BUDGET_MS);
      const media = resolvedUrl ? validatePluginMediaSource({ ...raw, url: resolvedUrl }) : null;
      if (!media) {
        attempts.push({
          providerKey: provider.key,
          ok: false,
          reason: 'no-source',
          detail: 'invalid-url',
          costMs: Date.now() - stageStart
        });
        MusicResolveCache.addFailedCache(songId, provider.key);
        continue;
      }

      attempts.push({ providerKey: provider.key, ok: true, costMs: Date.now() - stageStart });
      const result: ResolveSongResult = {
        media: {
          url: remoteMediaProxyUrl(media.url, media.headers),
          format: media.format || inferPluginAudioFormat(media.url, media.br),
          br: media.br ?? qualityToBitrate(quality),
          headers: media.headers
        },
        providerKey: provider.key,
        providerName: provider.name,
        attempts
      };
      await MusicResolveCache.setCachedMusicUrl(
        songId,
        {
          url: media.url,
          format: result.media.format,
          br: result.media.br,
          providerKey: provider.key,
          providerName: provider.name
        },
        sourceKeys ?? globalKeys
      );
      return result;
    } catch (error) {
      const isTimeout = (error as Error).message === 'timeout';
      attempts.push({
        providerKey: provider.key,
        ok: false,
        reason: isTimeout ? 'timeout' : 'error',
        detail: (error as Error).message?.slice(0, 120),
        costMs: Date.now() - stageStart
      });
      MusicResolveCache.addFailedCache(songId, provider.key);
    }
  }

  if (attempts.length) {
    console.warn(
      `[resolver] No source matched: ${song.name}(${songId})`,
      attempts.map((a) => `${a.providerKey}:${a.reason}`).join(', ')
    );
  }
  return null;
};

export { MusicResolveCache };
