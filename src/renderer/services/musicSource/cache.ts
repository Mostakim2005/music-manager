/**
 *
 */
import { cloneDeep } from 'lodash';

import { musicDB } from '@/hooks/IndexDBHook';

const saveData = (...args: Parameters<typeof musicDB.saveData>) => musicDB.saveData(...args);
const getData = (...args: Parameters<typeof musicDB.getData>) => musicDB.getData(...args);
const deleteData = (...args: Parameters<typeof musicDB.deleteData>) => musicDB.deleteData(...args);

export type CachedUrlEntry = {
  url: string;
  format?: string;
  br?: number;
  providerKey: string;
  providerName: string;
};

const CACHE_CONFIG = {
  MUSIC_URL_CACHE_TIME: 30 * 60 * 1000,
  FAILED_CACHE_TIME: 60 * 1000
};

const failedCacheMap = new Map<string, number>();

export const MusicResolveCache = {
  async getCachedMusicUrl(
    songId: string | number,
    sourceKeys?: string[]
  ): Promise<CachedUrlEntry | null> {
    try {
      const cached = await getData('music_url_cache', songId);
      if (
        cached?.createTime &&
        Date.now() - cached.createTime < CACHE_CONFIG.MUSIC_URL_CACHE_TIME
      ) {
        const cachedKeys: string[] = cached.sourceKeys || [];
        const currentKeys = [...(sourceKeys || [])].sort();
        if (JSON.stringify([...cachedKeys].sort()) !== JSON.stringify(currentKeys)) {
          await deleteData('music_url_cache', songId);
          return null;
        }
        return cached.entry as CachedUrlEntry;
      }
      if (cached) {
        await deleteData('music_url_cache', songId);
      }
    } catch (error) {
      console.warn('Failed to read resolve cache:', error);
    }
    return null;
  },

  async setCachedMusicUrl(
    songId: string | number,
    entry: CachedUrlEntry,
    sourceKeys?: string[]
  ): Promise<void> {
    try {
      await saveData('music_url_cache', {
        id: songId,
        entry: cloneDeep(entry),
        sourceKeys: cloneDeep(sourceKeys || []),
        createTime: Date.now()
      });
    } catch (error) {
      console.error('Failed to cache resolve result:', error);
    }
  },

  isInFailedCache(songId: string | number, providerKey: string): boolean {
    const cachedTime = failedCacheMap.get(`${songId}:${providerKey}`);
    if (cachedTime && Date.now() - cachedTime < CACHE_CONFIG.FAILED_CACHE_TIME) {
      return true;
    }
    if (cachedTime) failedCacheMap.delete(`${songId}:${providerKey}`);
    return false;
  },

  addFailedCache(songId: string | number, providerKey: string): void {
    failedCacheMap.set(`${songId}:${providerKey}`, Date.now());
  },

  clearFailedCache(songId: string | number): void {
    const prefix = `${songId}:`;
    for (const key of failedCacheMap.keys()) {
      if (key.startsWith(prefix)) failedCacheMap.delete(key);
    }
  },

  async clearMusicCache(songId: string | number): Promise<void> {
    try {
      await deleteData('music_url_cache', songId);
    } catch (error) {
      console.error('Failed to clear resolve cache:', error);
    }
    this.clearFailedCache(songId);
  }
};
