import { cloneDeep } from 'lodash';
import { createDiscreteApi } from 'naive-ui';

import i18n from '@/../i18n/renderer';
import { getMusicLrc } from '@/api/music';
import { useMusicSourceRegistry } from '@/services/musicSource/registry';
import { resolveSong } from '@/services/musicSource/resolver';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { useSettingsStore } from '@/store';
import type { ILyric, ILyricText, IWordData, SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import {
  cacheLyric,
  cacheTrackDetail,
  cacheTrackSource,
  getAudioSourceBlobURL,
  getLyricFromCache,
  getTrackSource
} from '@/utils/db';
import { alignSubLyrics, copyLyric, lyricParser, parseLyric } from '@/utils/lyrics';
import { detectScriptAndRomanize } from '@/utils/transliteration';
import { parseLyrics as parseYrcLyrics } from '@/utils/yrcParser';

export { copyLyric, lyricParser, parseLyric };

const { message } = createDiscreteApi(['message']);

let noSourceHintAt = 0;
const NO_SOURCE_HINT_INTERVAL = 5 * 60 * 1000;

/**
 */
const warnIfNoSourceConfigured = (): void => {
  if (Date.now() - noSourceHintAt < NO_SOURCE_HINT_INTERVAL) return;
  try {
    const settingsStore = useSettingsStore();
    const { orderedProviders } = useMusicSourceRegistry();
    const enabled = settingsStore.setData?.enabledMusicSources || [];
    const hasResolvable = orderedProviders(enabled).length > 0;
    if (!hasResolvable) {
      noSourceHintAt = Date.now();
      message.warning(i18n.global.t('player.reparse.noSourceConfigured'), { duration: 6000 });
    }
  } catch {
    // Ignore cache read errors
  }
};

type DiskCacheResolveResult = {
  url?: string;
  cached?: boolean;
  queued?: boolean;
};

const getSongArtistText = (songData: SongResult): string => {
  if (songData?.ar?.length) {
    return songData.ar.map((artist) => artist.name).join(' / ');
  }

  if (songData?.song?.artists?.length) {
    return songData.song.artists.map((artist) => artist.name).join(' / ');
  }

  return '';
};

const resolveCachedPlaybackUrl = async (
  url: string | null | undefined,
  songData: SongResult
): Promise<string | null | undefined> => {
  if (!url || !isElectron || !/^https?:\/\//i.test(url)) {
    return url;
  }

  try {
    const result = (await window.electron.ipcRenderer.invoke('resolve-cached-music-url', {
      songId: Number(songData.id),
      source: songData.source,
      url,
      title: songData.name,
      artist: getSongArtistText(songData)
    })) as DiskCacheResolveResult;

    if (result?.url) {
      return result.url;
    }
  } catch (error) {
    console.warn('Failed to resolve cached playback URL, falling back to online URL:', error);
  }

  return url;
};

/**
 *
 */
export const getSongUrl = async (
  id: string | number,
  songData: SongResult,
  isDownloaded: boolean = false,
  requestId?: string
) => {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  const ensureRequestValid = () => {
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongUrl] Request expired: ${requestId}`);
      throw new Error('Request cancelled');
    }
  };

  try {
    ensureRequestValid();

    // 1. Check Dexie IndexedDB audio blob cache for instant sub-ms local playback
    if (!isDownloaded && numericId) {
      const cachedBlobRecord = await getTrackSource(numericId);
      if (cachedBlobRecord?.source?.byteLength) {
        return getAudioSourceBlobURL(cachedBlobRecord.source);
      }
    }

    if (songData.playMusicUrl) {
      if (isDownloaded) return songData.playMusicUrl;
      return await resolveCachedPlaybackUrl(songData.playMusicUrl, songData);
    }

    const result = await resolveSong(cloneDeep(songData), { isDownload: isDownloaded });
    ensureRequestValid();

    if (!result) {
      console.warn(`[getSongUrl] No source matched: ${songData.name}(${numericId})`);
      warnIfNoSourceConfigured();
      return null;
    }

    console.log(
      `[getSongUrl] Resolved: ${result.providerName} → ${result.media.url.slice(0, 60)}…`
    );
    if (isDownloaded) {
      return { url: result.media.url, type: result.media.format, br: result.media.br } as any;
    }
    const finalUrl = await resolveCachedPlaybackUrl(result.media.url, songData);
    if (finalUrl && /^https?:\/\//i.test(finalUrl)) {
      void cacheTrackSource(
        songData,
        finalUrl,
        result.media.br || 320000,
        result.providerName || 'youtube'
      );
    }
    cacheTrackDetail(songData);
    return finalUrl;
  } catch (error) {
    if ((error as Error).message === 'Request cancelled') {
      throw error;
    }
    console.error(`[getSongUrl] Resolve error: ${songData.name}(${numericId})`, error);
    return null;
  }
};

/**
 */
export const useSongUrl = () => {
  return { getSongUrl };
};

/**
 */
const parseLyrics = (lyricsString: string): { lyrics: ILyricText[]; times: number[] } => {
  if (!lyricsString || typeof lyricsString !== 'string') {
    return { lyrics: [], times: [] };
  }

  try {
    const parseResult = parseYrcLyrics(lyricsString);

    if (!parseResult.success) {
      console.error('Failed to parse lyrics:', parseResult.error.message);
      return { lyrics: [], times: [] };
    }

    const { lyrics: parsedLyrics } = parseResult.data;
    const lyrics: ILyricText[] = [];
    const times: number[] = [];

    for (const line of parsedLyrics) {
      const hasWords = line.words && line.words.length > 0;

      lyrics.push({
        text: line.fullText,
        trText: '',
        words: hasWords ? (line.words as IWordData[]) : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      times.push(line.startTime / 1000);
    }

    return { lyrics, times };
  } catch (error) {
    console.error('Error while parsing lyrics:', error);
    return { lyrics: [], times: [] };
  }
};

/**
 */
export const loadLrc = async (id: string | number, song?: SongResult): Promise<ILyric> => {
  try {
    const cacheKey = id;
    let lyricData: any;

    if (isElectron) {
      try {
        lyricData = await window.electron.ipcRenderer.invoke('get-cached-lyric', cacheKey);
      } catch (error) {
        console.warn('Failed to read disk lyric cache:', error);
      }
    }

    if (!lyricData) {
      lyricData = await getLyricFromCache(cacheKey as any);
    }

    if (!lyricData) {
      const { data } = await getMusicLrc(cacheKey, song);
      lyricData = data;

      if (lyricData) {
        cacheLyric(cacheKey as any, lyricData);
      }

      if (isElectron && lyricData) {
        void window.electron.ipcRenderer
          .invoke('cache-lyric', cacheKey, lyricData)
          .catch((error) => console.warn('Failed to write disk lyric cache:', error));
      }
    }

    const data = lyricData ?? {};
    const parsedFromYesPlay = lyricParser(data);
    const { lyrics, times } = parseLyrics(data?.yrc?.lyric || data?.lrc?.lyric);

    // Fallback to YesPlayMusic parseLyric if yrcParser returned empty on multi-timestamp lines
    if (lyrics.length === 0 && parsedFromYesPlay.lyric.length > 0) {
      for (const item of parsedFromYesPlay.lyric) {
        lyrics.push({
          text: item.content,
          trText: '',
          romaText: '',
          hasWordByWord: false,
          startTime: Math.round(item.time * 1000),
          duration: 0
        });
        times.push(item.time);
      }
    }

    let hasWordByWord = false;
    for (const lyric of lyrics) {
      if (lyric.hasWordByWord) {
        hasWordByWord = true;
        break;
      }
    }

    const primaryTexts = lyrics.map((item) => item.text);

    // 1. Align translated lyrics (tlyric / ytlrc)
    const rawTlyricStr = data?.tlyric?.lyric || data?.ytlrc?.lyric || '';
    if (rawTlyricStr) {
      const { lyrics: yrcTLyrics } = parseLyrics(rawTlyricStr);
      const tSubList =
        parsedFromYesPlay.tlyric.length > 0
          ? parsedFromYesPlay.tlyric
          : yrcTLyrics.map((l) => ({
              time: (l.startTime ?? 0) / 1000,
              content: l.text
            }));
      const alignedTr = alignSubLyrics(times, primaryTexts, tSubList);
      lyrics.forEach((item, index) => {
        item.trText = alignedTr[index] || '';
      });
    } else {
      lyrics.forEach((item) => {
        item.trText = '';
      });
    }

    // 2. Align Romanized lyrics (romalrc / yromalrc) for non-Latin phonetic subtitles
    const rawRomaStr = data?.romalrc?.lyric || data?.yromalrc?.lyric || '';
    if (rawRomaStr) {
      const { lyrics: yrcRomaLyrics } = parseLyrics(rawRomaStr);
      const romaSubList =
        parsedFromYesPlay.romalyric.length > 0
          ? parsedFromYesPlay.romalyric
          : yrcRomaLyrics.map((l) => ({
              time: (l.startTime ?? 0) / 1000,
              content: l.text
            }));
      const alignedRoma = alignSubLyrics(times, primaryTexts, romaSubList);
      lyrics.forEach((item, index) => {
        item.romaText = alignedRoma[index] || detectScriptAndRomanize(item.text) || '';
      });
    } else {
      lyrics.forEach((item) => {
        item.romaText = detectScriptAndRomanize(item.text) || '';
      });
    }

    return {
      lrcTimeArray: times,
      lrcArray: lyrics,
      hasWordByWord
    };
  } catch (err) {
    console.error('Error loading lyrics:', err);
    return {
      lrcTimeArray: [],
      lrcArray: [],
      hasWordByWord: false
    };
  }
};

/**
 */
export const useLyrics = () => {
  return { loadLrc, parseLyrics };
};

/**
 */
export const useSongDetail = () => {
  const getSongDetail = async (playMusic: SongResult, requestId?: string) => {
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongDetail] Request expired: ${requestId}`);
      throw new Error('Request cancelled');
    }

    if (playMusic.expiredAt && playMusic.expiredAt < Date.now()) {
      if (!playMusic.playMusicUrl?.startsWith('local://')) {
        console.info(`Song expired, refetching: ${playMusic.name}`);
        playMusic.playMusicUrl = undefined;
      }
    }

    try {
      const playMusicUrl =
        playMusic.playMusicUrl || (await getSongUrl(playMusic.id, playMusic, false, requestId));

      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        console.log(`[getSongDetail] Request expired after URL fetch: ${requestId}`);
        throw new Error('Request cancelled');
      }

      playMusic.createdAt = Date.now();
      playMusic.expiredAt = playMusic.createdAt + 1800000;

      playMusic.playLoading = false;
      return { ...playMusic, playMusicUrl } as SongResult;
    } catch (error) {
      if ((error as Error).message === 'Request cancelled') {
        throw error;
      }
      console.error('Failed to fetch audio URL:', error);
      playMusic.playLoading = false;
      throw error;
    }
  };

  return { getSongDetail };
};
