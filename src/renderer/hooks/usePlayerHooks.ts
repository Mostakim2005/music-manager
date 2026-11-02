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

/** 未配置音源提醒节流：切歌连播时不要每首都弹 */
let noSourceHintAt = 0;
const NO_SOURCE_HINT_INTERVAL = 5 * 60 * 1000;

/**
 * VIP/无版权歌曲播放失败且没有任何可用的解析音源时提醒用户。
 * 判定：启用集合里除「网易云官方」外没有任何可用 provider（没装插件、
 * 也没启用 gdmusic/pyncmd/自定义API）—— 这时官方受限歌曲必然无法播放。
 */
const warnIfNoSourceConfigured = (): void => {
  if (Date.now() - noSourceHintAt < NO_SOURCE_HINT_INTERVAL) return;
  try {
    const settingsStore = useSettingsStore();
    const { orderedProviders } = useMusicSourceRegistry();
    const enabled = settingsStore.setData?.enabledMusicSources || [];
    const hasResolvable = orderedProviders(enabled).some((p) => p.key !== 'netease');
    if (!hasResolvable) {
      noSourceHintAt = Date.now();
      message.warning(i18n.global.t('player.reparse.noSourceConfigured'), { duration: 6000 });
    }
  } catch {
    // store 未就绪等场景不打扰播放链路
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
    console.warn('解析缓存播放地址失败，回退到在线地址:', error);
  }

  return url;
};

/**
 * 获取歌曲播放URL（独立函数）
 *
 * 重构后唯一的编排：本地直通 → resolveSong（统一注册表按用户排序逐源
 * 尝试：自定义API/网易云官方/插件/GD/unblock 同一条链）→ 磁盘播放缓存。
 * 旧的「内联降级 + MusicParser 策略工厂」双轨编排已收敛进 resolver。
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
      console.log(`[getSongUrl] 请求已失效: ${requestId}`);
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
      console.warn(`[getSongUrl] 全部音源未命中: ${songData.name}(${numericId})`);
      // 官方受限歌曲 + 没有任何可用解析源：提醒用户去配置音源
      warnIfNoSourceConfigured();
      return null;
    }

    console.log(
      `[getSongUrl] 解析成功: ${result.providerName} → ${result.media.url.slice(0, 60)}…`
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
        result.providerName || 'netease'
      );
    }
    cacheTrackDetail(songData);
    return finalUrl;
  } catch (error) {
    if ((error as Error).message === 'Request cancelled') {
      throw error;
    }
    console.error(`[getSongUrl] 解析异常: ${songData.name}(${numericId})`, error);
    return null;
  }
};

/**
 * useSongUrl hook（兼容旧代码）
 */
export const useSongUrl = () => {
  return { getSongUrl };
};

/**
 * 使用新的yrcParser解析歌词（独立函数）
 */
const parseLyrics = (lyricsString: string): { lyrics: ILyricText[]; times: number[] } => {
  if (!lyricsString || typeof lyricsString !== 'string') {
    return { lyrics: [], times: [] };
  }

  try {
    const parseResult = parseYrcLyrics(lyricsString);

    if (!parseResult.success) {
      console.error('歌词解析失败:', parseResult.error.message);
      return { lyrics: [], times: [] };
    }

    const { lyrics: parsedLyrics } = parseResult.data;
    const lyrics: ILyricText[] = [];
    const times: number[] = [];

    for (const line of parsedLyrics) {
      // 检查是否有逐字歌词
      const hasWords = line.words && line.words.length > 0;

      lyrics.push({
        text: line.fullText,
        trText: '', // 翻译文本稍后处理
        words: hasWords ? (line.words as IWordData[]) : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      // 时间数组使用秒为单位（与原有逻辑保持一致）
      times.push(line.startTime / 1000);
    }

    return { lyrics, times };
  } catch (error) {
    console.error('解析歌词时发生错误:', error);
    return { lyrics: [], times: [] };
  }
};

/**
 * 加载歌词（独立函数）
 */
export const loadLrc = async (id: string | number): Promise<ILyric> => {
  try {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    let lyricData: any;

    if (isElectron) {
      try {
        lyricData = await window.electron.ipcRenderer.invoke('get-cached-lyric', numericId);
      } catch (error) {
        console.warn('读取磁盘歌词缓存失败:', error);
      }
    }

    if (!lyricData) {
      lyricData = await getLyricFromCache(numericId);
    }

    if (!lyricData) {
      const { data } = await getMusicLrc(numericId);
      lyricData = data;

      if (lyricData) {
        cacheLyric(numericId, lyricData);
      }

      if (isElectron && lyricData) {
        void window.electron.ipcRenderer
          .invoke('cache-lyric', numericId, lyricData)
          .catch((error) => console.warn('写入磁盘歌词缓存失败:', error));
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

    // 检查是否有逐字歌词
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
 * useLyrics hook（兼容旧代码）
 */
export const useLyrics = () => {
  return { loadLrc, parseLyrics };
};

/**
 * 获取歌曲详情（优化版 - 只获取URL，背景色在播放后异步获取）
 */
export const useSongDetail = () => {
  const getSongDetail = async (playMusic: SongResult, requestId?: string) => {
    // 验证请求
    if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
      console.log(`[getSongDetail] 请求已失效: ${requestId}`);
      throw new Error('Request cancelled');
    }

    if (playMusic.expiredAt && playMusic.expiredAt < Date.now()) {
      // 本地音乐（local:// 协议）不会过期，跳过清除
      if (!playMusic.playMusicUrl?.startsWith('local://')) {
        console.info(`歌曲已过期，重新获取: ${playMusic.name}`);
        playMusic.playMusicUrl = undefined;
      }
    }

    try {
      const playMusicUrl =
        playMusic.playMusicUrl || (await getSongUrl(playMusic.id, playMusic, false, requestId));

      // 验证请求
      if (requestId && !playbackRequestManager.isRequestValid(requestId)) {
        console.log(`[getSongDetail] URL获取后请求已失效: ${requestId}`);
        throw new Error('Request cancelled');
      }

      playMusic.createdAt = Date.now();
      // 半小时后过期
      playMusic.expiredAt = playMusic.createdAt + 1800000;

      playMusic.playLoading = false;
      // 返回歌曲信息，背景色和歌词将在播放后异步加载
      return { ...playMusic, playMusicUrl } as SongResult;
    } catch (error) {
      if ((error as Error).message === 'Request cancelled') {
        throw error;
      }
      console.error('获取音频URL失败:', error);
      playMusic.playLoading = false;
      throw error;
    }
  };

  return { getSongDetail };
};
