import { createDiscreteApi } from 'naive-ui';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import useIndexedDB from '@/hooks/IndexDBHook';
import {
  backfillLibraryFingerprints,
  findDuplicateRecordings,
  mergeSongs,
  setFingerprintForPath
} from '@/services/songLibrary';
import type { LocalMusicEntry, LocalMusicMeta } from '@/types/localMusic';
import { selectEntriesNeedingRepair, toMetadataSearchTitle } from '@/utils/localMusicRepair';
import { removeStaleEntries } from '@/utils/localMusicUtils';

const { message } = createDiscreteApi(['message']);

const LOCAL_MUSIC_STORE = 'local_music' as const;

type LocalMusicDBStores = {
  local_music: LocalMusicEntry;
};

/**
 */
function generateId(filePath: string): string {
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 */
function isUnderFolder(filePath: string, folder: string): boolean {
  if (!filePath.startsWith(folder)) return false;
  if (folder.endsWith('/') || folder.endsWith('\\')) return true;
  const next = filePath.charAt(folder.length);
  return next === '/' || next === '\\';
}

/**
 */
async function initLocalMusicDB() {
  return await useIndexedDB<typeof LOCAL_MUSIC_STORE, LocalMusicDBStores>(
    'localMusicDB',
    [{ name: LOCAL_MUSIC_STORE, keyPath: 'id' }],
    1
  );
}

/**
 */
export const useLocalMusicStore = defineStore(
  'localMusic',
  () => {
    const folderPaths = ref<string[]>([]);
    const musicList = ref<LocalMusicEntry[]>([]);
    const scanning = ref(false);
    const scanProgress = ref(0);
    /** Acoustic index build state */
    const buildingFingerprints = ref(false);
    const fingerprintProgress = ref(0);
    const fingerprintTotal = ref(0);
    /** Automatic metadata repair state */
    const autoTagging = ref(false);
    const autoTagProgress = ref(0);
    const autoTagTotal = ref(0);

    let db: Awaited<ReturnType<typeof initLocalMusicDB>> | null = null;

    /**
     */
    async function getDB() {
      if (!db) {
        db = await initLocalMusicDB();
      }
      return db;
    }

    /**
     */
    function addFolder(path: string): void {
      if (!path || folderPaths.value.includes(path)) {
        return;
      }
      folderPaths.value.push(path);
    }

    /**
     */
    async function removeFolder(path: string): Promise<void> {
      const index = folderPaths.value.indexOf(path);
      if (index === -1) {
        return;
      }
      folderPaths.value.splice(index, 1);

      try {
        const localDB = await getDB();
        const entries = await localDB.getAllData(LOCAL_MUSIC_STORE);
        for (const entry of entries) {
          const stillConfigured = folderPaths.value.some((folder) =>
            isUnderFolder(entry.filePath, folder)
          );
          if (isUnderFolder(entry.filePath, path) && !stillConfigured) {
            await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
          }
        }
        musicList.value = await localDB.getAllData(LOCAL_MUSIC_STORE);
      } catch (error) {
        console.error('Failed to purge cache after removing folder:', error);
      }
    }

    /**
     */
    async function clearAllEntries(): Promise<void> {
      try {
        const localDB = await getDB();
        const entries = await localDB.getAllData(LOCAL_MUSIC_STORE);
        for (const entry of entries) {
          await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
        }
        musicList.value = [];
      } catch (error) {
        console.error('Failed to clear local music cache:', error);
      }
    }

    /**
     */
    async function scanFolders(): Promise<void> {
      if (scanning.value) {
        return;
      }

      if (folderPaths.value.length === 0) {
        await clearAllEntries();
        return;
      }

      scanning.value = true;
      scanProgress.value = 0;

      try {
        const localDB = await getDB();

        const cachedEntries = await localDB.getAllData(LOCAL_MUSIC_STORE);
        const cachedMap = new Map<string, LocalMusicEntry>();
        for (const entry of cachedEntries) {
          cachedMap.set(entry.filePath, entry);
        }

        const diskFilePaths = new Set<string>();
        const unreadableFolders: string[] = [];

        for (const folderPath of folderPaths.value) {
          let files: { path: string; modifiedTime: number }[];
          try {
            const result = await window.api.scanLocalMusicWithStats(folderPath);

            if ((result as any).error) {
              console.error(`Failed to scan folder: ${folderPath}`, (result as any).error);
              message.error(`Scan failed: ${(result as any).error}`);
              unreadableFolders.push(folderPath);
              continue;
            }
            files = result.files;
          } catch (error) {
            console.error(`Error scanning folder: ${folderPath}`, error);
            message.error(`Error scanning folder: ${folderPath}`);
            unreadableFolders.push(folderPath);
            continue;
          }

          scanProgress.value += files.length;

          for (const file of files) {
            diskFilePaths.add(file.path);
          }

          const parseTargets: string[] = [];
          for (const file of files) {
            const cached = cachedMap.get(file.path);
            if (!cached || cached.modifiedTime !== file.modifiedTime || !('coverPath' in cached)) {
              parseTargets.push(file.path);
            }
          }

          if (parseTargets.length > 0) {
            try {
              const metas = await window.api.parseLocalMusicMetadata(parseTargets);
              for (const meta of metas) {
                const entry: LocalMusicEntry = {
                  ...meta,
                  id: generateId(meta.filePath)
                };
                await localDB.saveData(LOCAL_MUSIC_STORE, entry);
                cachedMap.set(entry.filePath, entry);
              }
            } catch (error) {
              console.error(`Failed to parse music metadata: ${folderPath}`, error);
              message.error(`Failed to parse music metadata: ${folderPath}`);
            }
          }
        }

        const isUnderUnreadableFolder = (filePath: string): boolean =>
          unreadableFolders.some((folder) => isUnderFolder(filePath, folder));

        for (const [filePath, entry] of cachedMap) {
          if (diskFilePaths.has(filePath) || isUnderUnreadableFolder(filePath)) {
            continue;
          }
          await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
        }

        musicList.value = await localDB.getAllData(LOCAL_MUSIC_STORE);
      } catch (error) {
        console.error('Failed to scan local music:', error);
        message.error('Failed to scan local music');
      } finally {
        scanning.value = false;
      }
    }

    /**
     */
    async function loadFromCache(): Promise<void> {
      try {
        const localDB = await getDB();
        musicList.value = await localDB.getAllData(LOCAL_MUSIC_STORE);
      } catch (error) {
        console.error('Failed to load local music from cache:', error);
        musicList.value = [];
      }
    }

    /**
     */
    async function removeEntry(id: string): Promise<void> {
      const localDB = await getDB();
      await localDB.deleteData(LOCAL_MUSIC_STORE, id);
      const index = musicList.value.findIndex((entry) => entry.id === id);
      if (index !== -1) {
        musicList.value.splice(index, 1);
      }
    }

    /**
     */
    async function updateEntry(
      updatedMeta: LocalMusicMeta,
      oldId?: string
    ): Promise<LocalMusicEntry> {
      const localDB = await getDB();
      const newId = generateId(updatedMeta.filePath);
      const newEntry: LocalMusicEntry = {
        ...updatedMeta,
        id: newId
      };
      if (oldId && oldId !== newId) {
        await localDB.deleteData(LOCAL_MUSIC_STORE, oldId);
      }
      await localDB.saveData(LOCAL_MUSIC_STORE, newEntry);
      const idx = musicList.value.findIndex((e) => e.id === (oldId || newId));
      if (idx !== -1) {
        musicList.value.splice(idx, 1, newEntry);
      } else {
        musicList.value.push(newEntry);
      }
      return newEntry;
    }

    /**
     */
    async function clearCache(): Promise<void> {
      try {
        const localDB = await getDB();
        const allEntries = await localDB.getAllData(LOCAL_MUSIC_STORE);

        if (allEntries.length === 0) {
          return;
        }

        const existsMap: Record<string, boolean> = {};
        for (const entry of allEntries) {
          try {
            const exists = await window.electron.ipcRenderer.invoke(
              'check-file-exists',
              entry.filePath
            );
            existsMap[entry.filePath] = exists !== false;
          } catch {
            existsMap[entry.filePath] = true;
          }
        }

        const validEntries = removeStaleEntries(allEntries, existsMap);
        const removedEntries = allEntries.filter(
          (entry) => !validEntries.some((v) => v.id === entry.id)
        );

        for (const entry of removedEntries) {
          await localDB.deleteData(LOCAL_MUSIC_STORE, entry.id);
        }

        musicList.value = validEntries;
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }

    /**
     * Compute acoustic fingerprints for entries that do not have one yet and
     * store them on both the local entry and the unified song library record.
     * Files are processed three at a time; each FFmpeg decode is short (the
     * extractor caps analysis at two minutes) but a large library still takes a
     * while, so the caller gets progress through the exposed refs.
     */
    async function buildFingerprintIndex(): Promise<{
      indexed: number;
      failed: number;
      skipped: number;
    }> {
      if (buildingFingerprints.value) {
        return { indexed: 0, failed: 0, skipped: 0 };
      }
      const extract = window.api?.getAudioFingerprint;
      if (typeof extract !== 'function') {
        throw new Error('Acoustic fingerprint extraction is unavailable in this build.');
      }

      const targets = musicList.value.filter((entry) => !entry.fingerprint);
      const skipped = musicList.value.length - targets.length;
      if (targets.length === 0) {
        return { indexed: 0, failed: 0, skipped };
      }

      buildingFingerprints.value = true;
      fingerprintProgress.value = 0;
      fingerprintTotal.value = targets.length;
      let indexed = 0;
      let failed = 0;

      const queue = [...targets];
      const worker = async () => {
        while (queue.length > 0) {
          const entry = queue.shift();
          if (!entry) break;
          try {
            const result = await extract(entry.filePath);
            if (result?.fingerprint) {
              await updateEntry({
                ...entry,
                fingerprint: result.fingerprint,
                fingerprintDurationSec: result.durationSec
              });
              await setFingerprintForPath(entry.filePath, result.fingerprint, result.durationSec);
              indexed += 1;
            } else {
              failed += 1;
            }
          } catch (error) {
            console.debug('[localMusic] fingerprint failed:', entry.filePath, error);
            failed += 1;
          } finally {
            fingerprintProgress.value += 1;
          }
        }
      };

      try {
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));

        // Library-only songs (downloads outside scanned folders) are not part of
        // musicList, so index them separately through the unified database.
        const libraryResult = await backfillLibraryFingerprints(extract, { concurrency: 2 });
        indexed += libraryResult.indexed;
        failed += libraryResult.failed;
        fingerprintTotal.value += libraryResult.indexed + libraryResult.failed;
        fingerprintProgress.value += libraryResult.indexed + libraryResult.failed;
      } finally {
        buildingFingerprints.value = false;
      }

      return { indexed, failed, skipped };
    }

    /**
     * Merge songs that the acoustic index proves are the same recording.
     * Metadata-based matching is intentionally not used here.
     */
    async function mergeDuplicateRecordings(): Promise<{ merged: number }> {
      const pairs = await findDuplicateRecordings();
      for (const pair of pairs) {
        await mergeSongs(pair.keepId, pair.dropId);
      }
      return { merged: pairs.length };
    }

    /**
     * Look up missing metadata online and write it into the files themselves.
     * Only entries with a placeholder artist or a file-name title are touched,
     * unless `force` is requested.
     */
    async function autoFixMetadata(options?: {
      force?: boolean;
    }): Promise<{ fixed: number; skipped: number; failed: number }> {
      if (autoTagging.value) {
        return { fixed: 0, skipped: 0, failed: 0 };
      }
      const fetchMetadata = window.api?.fetchOnlineMetadata;
      const writeTags = window.api?.updateLocalMusicTagsAndFile;
      if (typeof fetchMetadata !== 'function' || typeof writeTags !== 'function') {
        throw new Error('Automatic metadata repair is unavailable in this build.');
      }

      const targets = options?.force
        ? [...musicList.value]
        : selectEntriesNeedingRepair(musicList.value);
      if (targets.length === 0) {
        return { fixed: 0, skipped: 0, failed: 0 };
      }

      autoTagging.value = true;
      autoTagProgress.value = 0;
      autoTagTotal.value = targets.length;
      let fixed = 0;
      let skipped = 0;
      let failed = 0;

      try {
        for (const entry of targets) {
          try {
            const rawArtist = (entry.artist || '').trim();
            const artist = /^unknown/i.test(rawArtist) ? '' : rawArtist;
            const search = await fetchMetadata({
              title: toMetadataSearchTitle(entry.title, entry.filePath),
              artist: artist || undefined,
              album: entry.album || undefined
            });
            const best = search?.results?.[0];
            if (!best) {
              skipped += 1;
              continue;
            }

            const write = await writeTags({
              filePath: entry.filePath,
              title: best.title || entry.title,
              artist: best.artist || entry.artist,
              album: best.album || entry.album,
              year: best.year || undefined,
              genre: best.genre || undefined,
              coverDataUrlOrPath: best.coverUrl || undefined,
              saveSidecarLrc: false
            });

            if (write?.ok && write.updatedEntry) {
              await updateEntry(write.updatedEntry, entry.id);
              fixed += 1;
            } else {
              failed += 1;
            }
          } catch (error) {
            console.debug('[localMusic] metadata repair failed:', entry.filePath, error);
            failed += 1;
          } finally {
            autoTagProgress.value += 1;
          }
          // Be gentle with the public metadata APIs.
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      } finally {
        autoTagging.value = false;
      }

      return { fixed, skipped, failed };
    }

    return {
      folderPaths,
      musicList,
      scanning,
      scanProgress,
      buildingFingerprints,
      fingerprintProgress,
      fingerprintTotal,
      autoTagging,
      autoTagProgress,
      autoTagTotal,

      addFolder,
      removeFolder,
      scanFolders,
      loadFromCache,
      removeEntry,
      updateEntry,
      clearCache,
      buildFingerprintIndex,
      mergeDuplicateRecordings,
      autoFixMetadata
    };
  },
  {
    persist: {
      key: 'local-music-store',
      storage: localStorage,
      pick: ['folderPaths']
    }
  }
);
