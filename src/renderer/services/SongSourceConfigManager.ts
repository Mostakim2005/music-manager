/**
 *
 */

import type { Platform } from '@/types/music';

export type SongSourceConfig = {
  sources: Platform[];
  type: 'manual' | 'auto';
  updatedAt: number;
};

const triedSourcesMap = new Map<string, Set<string>>();
const triedSourceDiffsMap = new Map<string, Map<string, number>>();

const STORAGE_KEY_PREFIX = 'song_source_';
const STORAGE_TYPE_KEY_PREFIX = 'song_source_type_';

/**
 */
export class SongSourceConfigManager {
  /**
   */
  static getConfig(songId: number | string): SongSourceConfig | null {
    const id = String(songId);
    const sourcesStr = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    const typeStr = localStorage.getItem(`${STORAGE_TYPE_KEY_PREFIX}${id}`);

    if (!sourcesStr) {
      return null;
    }

    try {
      const sources = JSON.parse(sourcesStr) as Platform[];
      if (!Array.isArray(sources) || sources.length === 0) {
        return null;
      }

      return {
        sources,
        type: typeStr === 'auto' ? 'auto' : 'manual',
        updatedAt: Date.now()
      };
    } catch (error) {
      console.error(`[SongSourceConfigManager] Failed to parse config for song ${id}`, error);
      return null;
    }
  }

  /**
   */
  static setConfig(
    songId: number | string,
    sources: Platform[],
    type: 'manual' | 'auto' = 'manual'
  ): void {
    const id = String(songId);

    if (!sources || sources.length === 0) {
      this.clearConfig(songId);
      return;
    }

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(sources));
      localStorage.setItem(`${STORAGE_TYPE_KEY_PREFIX}${id}`, type);
      console.log(
        `[SongSourceConfigManager] Set sources for song ${id}: ${sources.join('')} (${type})`
      );
    } catch (error) {
      console.error(`[SongSourceConfigManager] Failed to save config for song ${id}`, error);
    }
  }

  /**
   */
  static clearConfig(songId: number | string): void {
    const id = String(songId);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
    localStorage.removeItem(`${STORAGE_TYPE_KEY_PREFIX}${id}`);
    this.clearTriedSources(songId);
    console.log(`[SongSourceConfigManager] Cleared song ${id} config`);
  }

  /**
   */
  static hasConfig(songId: number | string): boolean {
    return this.getConfig(songId) !== null;
  }

  /**
   */
  static isManualConfig(songId: number | string): boolean {
    const config = this.getConfig(songId);
    return config?.type === 'manual';
  }

  /**
   */
  static getTriedSources(songId: number | string): Set<string> {
    const id = String(songId);
    if (!triedSourcesMap.has(id)) {
      triedSourcesMap.set(id, new Set());
    }
    return triedSourcesMap.get(id)!;
  }

  /**
   */
  static addTriedSource(songId: number | string, source: string): void {
    const id = String(songId);
    const tried = this.getTriedSources(id);
    tried.add(source);
    console.log(`[SongSourceConfigManager] Song ${id} Added attempted source: ${source}`);
  }

  /**
   */
  static clearTriedSources(songId: number | string): void {
    const id = String(songId);
    triedSourcesMap.delete(id);
    triedSourceDiffsMap.delete(id);
    console.log(`[SongSourceConfigManager] Cleared song ${id} attempted sources`);
  }

  /**
   */
  static getTriedSourceDiffs(songId: number | string): Map<string, number> {
    const id = String(songId);
    if (!triedSourceDiffsMap.has(id)) {
      triedSourceDiffsMap.set(id, new Map());
    }
    return triedSourceDiffsMap.get(id)!;
  }

  /**
   */
  static setTriedSourceDiff(songId: number | string, source: string, diff: number): void {
    const id = String(songId);
    const diffs = this.getTriedSourceDiffs(id);
    diffs.set(source, diff);
  }

  /**
   */
  static findBestMatchingSource(songId: number | string): { source: string; diff: number } | null {
    const diffs = this.getTriedSourceDiffs(songId);
    if (diffs.size === 0) {
      return null;
    }

    let bestSource = '';
    let minDiff = Infinity;

    for (const [source, diff] of diffs.entries()) {
      if (diff < minDiff) {
        minDiff = diff;
        bestSource = source;
      }
    }

    return bestSource ? { source: bestSource, diff: minDiff } : null;
  }

  /**
   */
  static clearAllMemoryCache(): void {
    triedSourcesMap.clear();
    triedSourceDiffsMap.clear();
    console.log('[SongSourceConfigManager] Cleared all in-memory caches');
  }
}

export const songSourceConfig = SongSourceConfigManager;
