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
      const durationSec = ((song?.duration || song?.dt || 0) / 1000) || undefined;

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
      console.warn('保存歌词缓存失败:', error);
    }

    return { data: lyricPayload };
  } catch (error) {
    console.error('获取歌词失败:', error);
    return { data: { lrc: { lyric: '' }, tlyric: { lyric: '' }, romalrc: { lyric: '' } } };
  }
};

/**
 * 获取解析后的音乐URL（内部走统一解析器）
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

// Safe local stubs for removed Netease features
export const likeSong = async (_id: number | string, _like: boolean = true) => {
  return { data: { code: 200 } };
};

export const dislikeRecommendedSong = async (
  _id: number | string
): Promise<{ data: { code: number; data?: any } }> => {
  return { data: { code: 200, data: null } };
};

export const getLikedList = async (_uid?: number) => {
  const local = localStorage.getItem('favoriteList');
  const ids = local ? JSON.parse(local) : [];
  return { data: { ids, code: 200 } };
};

export const getMusicDetail = async (_ids: Array<number | string>) => {
  return { data: { songs: [], code: 200 } };
};

export const createPlaylist = async (params: { name: string; privacy: number }) => {
  return { data: { code: 200, id: Date.now(), ...params } };
};

export const updatePlaylistTracks = async (_params: { op: 'add' | 'del'; pid: number; tracks: string }) => {
  return { data: { code: 200 } };
};

export const getAlbumDetail = async (_id: string) => {
  return { data: { album: {}, songs: [], code: 200 } };
};

export const getPlaylistDetail = async (_id: string) => {
  return { data: { playlist: { tracks: [] }, code: 200 } };
};

export const getMusicListByType = async (type: string, id: string) => {
  if (type === 'album') return getAlbumDetail(id);
  return getPlaylistDetail(id);
};
