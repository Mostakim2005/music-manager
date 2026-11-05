import youtubeService, { type YtSearchResult } from '@/services/youtubeService';
import type { SongResult } from '@/types/music';

export function ytResultToSong(item: YtSearchResult): SongResult {
  const videoId = item.id;
  const channel = item.channel || 'YouTube';
  const durationSec = item.durationSec || 0;
  const durationMs = durationSec * 1000;
  const thumbnail = item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    id: videoId,
    name: item.title,
    picUrl: thumbnail,
    source: 'youtube' as any,
    ar: [{ id: 0, name: channel }] as any,
    artists: [{ id: 0, name: channel }] as any,
    al: { id: 0, name: channel, picUrl: thumbnail } as any,
    album: { id: 0, name: channel, picUrl: thumbnail } as any,
    duration: durationMs,
    dt: durationMs,
    count: 0
  };
}

export interface SearchParams {
  keywords: string;
  type?: 'music' | 'video' | number | string;
  limit?: number;
  offset?: number;
}

export const getSearch = async (params: SearchParams) => {
  const searchType =
    params.type === 'video' || params.type === 1004 || params.type === '1004' ? 'video' : 'music';

  try {
    const rawResults = await youtubeService.search(params.keywords, {
      type: searchType,
      limit: params.limit || 30
    });

    const songs = (rawResults || []).map(ytResultToSong);
    return {
      data: {
        code: 200,
        result: {
          songs,
          rawResults
        }
      }
    };
  } catch (error) {
    console.error('[API] getSearch failed:', error);
    return {
      data: {
        code: 500,
        result: {
          songs: [],
          rawResults: []
        }
      }
    };
  }
};

export const getSearchSuggestions = async (keyword: string): Promise<string[]> => {
  if (!keyword || !keyword.trim()) return [];
  try {
    if (typeof window !== 'undefined' && window.api?.getSearchSuggestions) {
      const responseData = await window.api.getSearchSuggestions(keyword);
      if (responseData && Array.isArray(responseData.data)) {
        return responseData.data.map((item: any) => item.keyword).slice(0, 10);
      }
    }
    return [];
  } catch {
    return [];
  }
};
