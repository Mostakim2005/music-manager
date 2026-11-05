import type { LocalMusicEntry, LocalMusicMeta } from '@/types/localMusic';
import { SUPPORTED_AUDIO_FORMATS } from '@/types/localMusic';
import type { ILyric, ILyricText, IWordData, SongResult } from '@/types/music';
import { detectScriptAndRomanize } from '@/utils/transliteration';
import { parseLyrics as parseYrcLyrics } from '@/utils/yrcParser';

import { filePathToLocalUrl } from '../../shared/localUrl';

export { filePathToLocalUrl };

/**
 */
export function isSupportedAudioFormat(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return (SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(ext);
}

/**
 */
export function extractTitleFromFilename(filePath: string): string {
  const separator = filePath.includes('\\') ? '\\' : '/';
  const filename = filePath.split(separator).pop() || filePath;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex > 0) {
    return filename.slice(0, dotIndex);
  }
  return filename;
}

/**
 */
export function buildFallbackMeta(filePath: string): LocalMusicMeta {
  return {
    filePath,
    title: extractTitleFromFilename(filePath),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 0,
    coverPath: null,
    lyrics: null,
    fileSize: 0,
    modifiedTime: 0
  };
}

/**
 */
export function parseLrcToILyric(lrcString: string | null): ILyric | null {
  if (!lrcString || typeof lrcString !== 'string') {
    return null;
  }

  try {
    const parseResult = parseYrcLyrics(lrcString);
    if (!parseResult.success) {
      return null;
    }

    const { lyrics: parsedLyrics } = parseResult.data;
    const lrcArray: ILyricText[] = [];
    const lrcTimeArray: number[] = [];
    let hasWordByWord = false;

    for (const line of parsedLyrics) {
      const hasWords = line.words && line.words.length > 0;
      if (hasWords) hasWordByWord = true;

      lrcArray.push({
        text: line.fullText,
        trText: '',
        romaText: detectScriptAndRomanize(line.fullText) || '',
        words: hasWords ? (line.words as IWordData[]) : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      lrcTimeArray.push(line.startTime / 1000);
    }

    if (lrcArray.length === 0) {
      return null;
    }

    return { lrcTimeArray, lrcArray, hasWordByWord };
  } catch {
    return null;
  }
}

/**
 */
export function parseMultiArtists(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return ['Unknown Artist'];
  const parts = raw
    .split(/\s*(?:feat\.?|ft\.?|&|;|,|\/|\x00)\s*/i)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length > 0 ? Array.from(new Set(parts)) : [raw.trim() || 'Unknown Artist'];
}

export function parseMultiGenres(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return Array.from(
    new Set(
      raw
        .split(/\s*(?:;|,|\/|&|\x00)\s*/i)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

/**
 */
export function toSongResult(entry: LocalMusicEntry): SongResult {
  const lyric = parseLrcToILyric(entry.lyrics);

  const coverUrl = entry.coverPath ? filePathToLocalUrl(entry.coverPath) : '';
  const parsedArtists = parseMultiArtists(entry.artist);
  const localMediaUrl = filePathToLocalUrl(entry.filePath);
  const lowerPath = entry.filePath.toLowerCase();
  const isVideoFile = lowerPath.endsWith('.mp4') || lowerPath.endsWith('.webm');

  return {
    id: entry.id,
    name: entry.title,
    picUrl: coverUrl,
    videoUrl: isVideoFile ? localMediaUrl : undefined,
    ar: parsedArtists.map((artistName, index) => ({
      name: artistName,
      id: index,
      picId: 0,
      img1v1Id: 0,
      briefDesc: '',
      picUrl: '',
      img1v1Url: '',
      albumSize: 0,
      alias: [],
      trans: '',
      musicSize: 0,
      topicPerson: 0
    })),
    al: {
      name: entry.album,
      id: 0,
      type: '',
      size: 0,
      picId: 0,
      blurPicUrl: '',
      companyId: 0,
      pic: 0,
      picUrl: coverUrl,
      publishTime: 0,
      description: '',
      tags: '',
      company: '',
      briefDesc: '',
      artist: {
        name: parsedArtists[0] || entry.artist,
        id: 0,
        picId: 0,
        img1v1Id: 0,
        briefDesc: '',
        picUrl: '',
        img1v1Url: '',
        albumSize: 0,
        alias: [],
        trans: '',
        musicSize: 0,
        topicPerson: 0
      },
      songs: [],
      alias: [],
      status: 0,
      copyrightId: 0,
      commentThreadId: '',
      artists: [],
      subType: '',
      transName: null,
      onSale: false,
      mark: 0,
      picId_str: ''
    },
    song: {
      artists: parsedArtists.map((artistName) => ({ name: artistName })),
      album: { name: entry.album }
    },
    playMusicUrl: localMediaUrl,
    duration: entry.duration,
    dt: entry.duration,
    source: 'local' as any,
    count: 0,
    lyric: lyric ?? undefined,
    createdAt: Date.now(),
    expiredAt: Date.now() + 365 * 24 * 60 * 60 * 1000
  };
}

/**
 */
export function filterByKeyword(list: LocalMusicEntry[], keyword: string): LocalMusicEntry[] {
  if (!keyword || keyword.trim() === '') {
    return list;
  }
  const lowerKeyword = keyword.toLowerCase();
  return list.filter((entry) => {
    return (
      entry.title.toLowerCase().includes(lowerKeyword) ||
      entry.artist.toLowerCase().includes(lowerKeyword)
    );
  });
}

/**
 */
export function getChangedFiles(
  files: { path: string; modifiedTime: number }[],
  cached: LocalMusicEntry[]
): string[] {
  const cachedMap = new Map<string, number>();
  for (const entry of cached) {
    cachedMap.set(entry.filePath, entry.modifiedTime);
  }

  return files
    .filter((file) => {
      const cachedTime = cachedMap.get(file.path);
      return cachedTime === undefined || cachedTime !== file.modifiedTime;
    })
    .map((file) => file.path);
}

/**
 */
export function removeStaleEntries(
  entries: LocalMusicEntry[],
  existsMap: Record<string, boolean>
): LocalMusicEntry[] {
  return entries.filter((entry) => existsMap[entry.filePath] === true);
}

/**
 * Debounced background ingestion of local tracks into songLibrary
 */
let ingestTimer: any = null;
export function debounceIngestLocalTracks(
  entries: LocalMusicEntry[],
  onFuzzyMatch?: (entry: LocalMusicEntry, candidate: any) => void
): void {
  if (ingestTimer) clearTimeout(ingestTimer);
  ingestTimer = setTimeout(async () => {
    try {
      const { ingestLocalTrack } = await import('@/services/songLibrary');
      let index = 0;
      const CHUNK_SIZE = 15;

      const processNextChunk = async () => {
        const slice = entries.slice(index, index + CHUNK_SIZE);
        if (slice.length === 0) return;

        for (const entry of slice) {
          try {
            const ext = entry.filePath.split('.').pop()?.toLowerCase();
            const res = await ingestLocalTrack({
              path: entry.filePath,
              title: entry.title || (entry as any).name || extractTitleFromFilename(entry.filePath),
              artist: entry.artist || '',
              album: entry.album || '',
              durationSec: Math.round(
                (entry.duration || 0) > 1000 ? entry.duration / 1000 : entry.duration || 0
              ),
              bitrate: (entry as any).bitrate,
              container: ext,
              hasVideo: /\.(mp4|mkv|webm|avi|mov)$/i.test(entry.filePath),
              fingerprint: entry.fingerprint,
              fingerprintDurationSec: entry.fingerprintDurationSec
            });

            if (res.matched === 'fuzzy' && res.candidates?.length) {
              onFuzzyMatch?.(entry, res.candidates[0]);
            }
          } catch {
            // ignore per-track ingestion failure
          }
        }

        index += CHUNK_SIZE;
        if (index < entries.length) {
          setTimeout(processNextChunk, 30);
        }
      };

      await processNextChunk();
    } catch (err) {
      console.warn('[songLibrary] Batch ingest error:', err);
    }
  }, 400);
}
