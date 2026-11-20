/**
 * Pure search, ranking, and lyric-snippet extraction helpers for the Ctrl+K Command Palette.
 * Kept in a pure .ts module so Vitest can test it directly in Node without Vue SFC compilation.
 */

export type CommandPaletteCategory = 'navigation' | 'player' | 'dsp' | 'track';

export interface CommandPaletteItem {
  id: string;
  category: CommandPaletteCategory;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
  keywords?: string[];
  payload?: unknown;
}

export interface CommandPaletteTrackInput {
  id: string | number;
  title: string;
  artist?: string;
  album?: string;
  lyrics?: string;
  payload?: unknown;
}

function stripLrcBrackets(raw: string): string {
  return raw
    .replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractLyricSnippet(
  lyricsText: string,
  query: string,
  maxLen: number = 88
): string | null {
  if (!lyricsText || !query) return null;
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return null;

  const lines = lyricsText.split(/\r?\n/);
  for (const rawLine of lines) {
    const cleanLine = stripLrcBrackets(rawLine);
    if (!cleanLine) continue;
    const lower = cleanLine.toLowerCase();
    const idx = lower.indexOf(cleanQuery);
    if (idx >= 0) {
      if (cleanLine.length <= maxLen) return cleanLine;
      const start = Math.max(0, idx - Math.floor((maxLen - cleanQuery.length) / 2));
      const end = Math.min(cleanLine.length, start + maxLen);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < cleanLine.length ? '...' : '';
      return `${prefix}${cleanLine.slice(start, end).trim()}${suffix}`;
    }
  }
  return null;
}

function scoreTextMatch(text: string, query: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  if (lower === query) return 100;
  if (lower.startsWith(query)) return 75;
  if (lower.includes(query)) return 45;
  return 0;
}

export function searchCommandPaletteItems(
  query: string,
  actions: CommandPaletteItem[],
  tracks: CommandPaletteTrackInput[] = [],
  limit: number = 25
): CommandPaletteItem[] {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  const safeLimit = Math.max(1, limit);

  if (!q) {
    const defaultTracks: CommandPaletteItem[] = tracks.slice(0, 6).map((t) => ({
      id: `track:${String(t.id)}`,
      category: 'track',
      title: t.title || 'Unknown Track',
      subtitle: [t.artist, t.album].filter(Boolean).join(' - '),
      badge: 'Track',
      icon: 'ri-music-2-line',
      payload: t.payload ?? t
    }));
    return [...actions, ...defaultTracks].slice(0, safeLimit);
  }

  const scored: Array<{ item: CommandPaletteItem; score: number }> = [];

  for (const action of actions) {
    let best = scoreTextMatch(action.title, q);
    if (action.subtitle) {
      best = Math.max(best, scoreTextMatch(action.subtitle, q) * 0.7);
    }
    if (Array.isArray(action.keywords)) {
      for (const kw of action.keywords) {
        best = Math.max(best, scoreTextMatch(kw, q) * 0.8);
      }
    }
    if (best > 0) {
      scored.push({ item: action, score: best + 10 });
    }
  }

  for (const track of tracks) {
    const titleScore = scoreTextMatch(track.title || '', q);
    const artistScore = scoreTextMatch(track.artist || '', q) * 0.85;
    const albumScore = scoreTextMatch(track.album || '', q) * 0.65;
    const lyricSnippet = track.lyrics ? extractLyricSnippet(track.lyrics, q) : null;
    const lyricScore = lyricSnippet ? 55 : 0;

    const best = Math.max(titleScore, artistScore, albumScore, lyricScore);
    if (best > 0) {
      const baseMeta = [track.artist, track.album].filter(Boolean).join(' - ');
      const subtitle = lyricSnippet
        ? `${baseMeta ? `${baseMeta} | ` : ''}Lyric: "${lyricSnippet}"`
        : baseMeta;

      scored.push({
        item: {
          id: `track:${String(track.id)}`,
          category: 'track',
          title: track.title || 'Unknown Track',
          subtitle,
          badge: lyricSnippet ? 'Lyric Match' : 'Track',
          icon: lyricSnippet ? 'ri-file-text-line' : 'ri-music-2-line',
          payload: track.payload ?? track
        },
        score: best
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.slice(0, safeLimit).map((entry) => entry.item);
}
