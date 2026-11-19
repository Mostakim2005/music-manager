import { musicDB } from '@/hooks/MusicHook';
import { resolveSong } from '@/services/musicSource/resolver';
import type { SongResult } from '@/types/music';
import request from '@/utils/request';

type MusicParseResult = {
  data: {
    code: number;
    message: string;
    data?: { url: string; type?: string; br?: number; [key: string]: any };
  };
};

const saveData = (...args: Parameters<typeof musicDB.saveData>) => musicDB.saveData(...args);
const getData = (...args: Parameters<typeof musicDB.getData>) => musicDB.getData(...args);

/**
 * Fetch lyrics from cache or LRCLIB via IPC
 */
export const getMusicLrc = async (
  id: number | string,
  song?: SongResult
): Promise<{ data: any }> => {
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

  try {
    const cachedLyric = await getData('music_lyric', id as any);
    if (cachedLyric?.createTime && Date.now() - cachedLyric.createTime < TEN_DAYS_MS) {
      return { ...cachedLyric, data: cachedLyric.data };
    }

    let lyricPayload: any = {
      lrc: { lyric: '' },
      tlyric: { lyric: '' },
      romalrc: { lyric: '' }
    };

    if (typeof window !== 'undefined' && window.api?.fetchMultiSourceLyrics) {
      const title = song?.name || '';
      const artist = song?.ar?.[0]?.name || song?.artists?.[0]?.name || '';
      const durationSec = (song?.duration || song?.dt || 0) / 1000 || undefined;

      if (title) {
        const lrcResult = await window.api.fetchMultiSourceLyrics({
          title,
          artist,
          durationSec
        });
        if (lrcResult) {
          lyricPayload = {
            lrc: { lyric: lrcResult.lrc || '' },
            tlyric: { lyric: lrcResult.tlyric || '' },
            romalrc: { lyric: lrcResult.romalrc || '' }
          };
        }
      }
    } else {
      const res = await request.get<any>('/lyric/new', { params: { id } }).catch(() => null);
      if (res?.data) {
        lyricPayload = res.data;
      }
    }

    try {
      await saveData('music_lyric', { id, data: lyricPayload, createTime: Date.now() });
    } catch (error) {
      console.warn('Failed to save lyric cache:', error);
    }

    return { data: lyricPayload };
  } catch (error) {
    console.error('Failed to fetch lyrics:', error);
    return { data: { lrc: { lyric: '' }, tlyric: { lyric: '' }, romalrc: { lyric: '' } } };
  }
};

/**
 */
export const getParsingMusicUrl = async (
  _id: number | string,
  data: SongResult
): Promise<MusicParseResult> => {
  const result = await resolveSong(data);
  if (!result) {
    return { data: { code: 404, message: 'Source resolution failed', data: undefined } };
  }
  return {
    data: {
      code: 200,
      message: 'success',
      data: {
        url: result.media.url,
        type: result.media.format,
        br: result.media.br,
        pluginName: result.providerName
      }
    }
  };
};

