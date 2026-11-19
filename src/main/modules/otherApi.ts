import axios from 'axios';
import { ipcMain } from 'electron';

export async function fetchYouTubeSuggestions(
  keyword: string
): Promise<{ data: Array<{ keyword: string }> }> {
  const clean = String(keyword || '').trim();
  if (!clean) {
    return { data: [] };
  }
  try {
    const response = await axios.get('https://suggestqueries.google.com/complete/search', {
      params: {
        client: 'firefox',
        ds: 'yt',
        q: clean
      },
      timeout: 4000
    });
    const rawList = Array.isArray(response.data?.[1]) ? response.data[1] : [];
    const suggestions = rawList
      .filter((entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .slice(0, 10)
      .map((item: string) => ({ keyword: item.trim() }));
    return { data: suggestions };
  } catch (error: any) {
    console.warn('[Main Process Proxy] Failed to fetch HTTPS YouTube search suggestions:', error?.message);
    return { data: [] };
  }
}

export function initializeOtherApi() {
  ipcMain.handle('get-search-suggestions', async (_, keyword: string) => {
    return fetchYouTubeSuggestions(keyword);
  });
}
