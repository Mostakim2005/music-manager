import { getLibraryDB } from '@/services/songLibrary';
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
  const clean = String(keyword || '').trim();
  if (!clean) return [];
  const lower = clean.toLowerCase();
  const seen = new Set<string>();
  const results: string[] = [];

  const addCandidate = (value?: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!seen.has(key) && results.length < 10) {
      seen.add(key);
      results.push(trimmed);
    }
  };

  try {
    const db = getLibraryDB();
    const localSongs = await db.songs.toArray();
    for (const song of localSongs) {
      if (song.title?.toLowerCase().includes(lower)) {
        addCandidate(song.artist ? `${song.title} - ${song.artist}` : song.title);
      } else if (song.artist?.toLowerCase().includes(lower)) {
        addCandidate(song.artist);
      } else if (song.album?.toLowerCase().includes(lower)) {
        addCandidate(song.album);
      }
      if (results.length >= 6) break;
    }
  } catch {
    // Ignore local IndexedDB errors in headless environments
  }

  try {
    if (typeof window !== 'undefined' && window.api?.getSearchSuggestions) {
      const responseData = await window.api.getSearchSuggestions(clean);
      if (responseData && Array.isArray(responseData.data)) {
        for (const item of responseData.data) {
          addCandidate(typeof item === 'string' ? item : item?.keyword);
        }
      } else if (Array.isArray(responseData)) {
        for (const item of responseData) {
          addCandidate(typeof item === 'string' ? item : item?.keyword);
        }
      }
    }
  } catch {
    // Ignore remote suggestion errors when offline
  }

  return results.slice(0, 10);
};
