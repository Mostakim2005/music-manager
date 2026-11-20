/**
 * SponsorBlock & YouTube Description Chapters Service
 * Fetches non-music segments from SponsorBlock API (with 4s AbortController timeout & cache)
 * and parses timestamped chapters from track descriptions.
 */

export interface SponsorBlockSegment {
  UUID?: string;
  category: string;
  startTime: number;
  endTime: number;
  label?: string;
}

export interface TrackChapter {
  title: string;
  startTime: number;
  endTime: number;
}

const SPONSORBLOCK_API_BASE = 'https://sponsor.ajay.app/api/skipSegments';
const SPONSORBLOCK_DEFAULT_CATEGORIES = ['music_offtopic', 'sponsor', 'intro', 'outro'];
const SPONSORBLOCK_AUTO_SKIP_KEY = 'music_manager_sponsorblock_autoskip_v1';
const FETCH_TIMEOUT_MS = 4000;

const segmentCache = new Map<string, SponsorBlockSegment[]>();
let memoryAutoSkipFlag: boolean | null = null;

function readStorageBool(key: string): boolean | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      return val === null ? null : val === 'true';
    }
    if (
      typeof localStorage !== 'undefined' &&
      localStorage &&
      typeof localStorage.getItem === 'function'
    ) {
      const val = localStorage.getItem(key);
      return val === null ? null : val === 'true';
    }
  } catch {
    // fallback to in-memory flag when storage is unavailable
  }
  return memoryAutoSkipFlag;
}

function writeStorageBool(key: string, enabled: boolean): void {
  memoryAutoSkipFlag = enabled;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, String(enabled));
      return;
    }
    if (
      typeof localStorage !== 'undefined' &&
      localStorage &&
      typeof localStorage.setItem === 'function'
    ) {
      localStorage.setItem(key, String(enabled));
    }
  } catch {
    // ignore storage errors in restricted environments
  }
}

export function isAutoSkipSponsorBlockEnabled(): boolean {
  return readStorageBool(SPONSORBLOCK_AUTO_SKIP_KEY) ?? false;
}

export function setAutoSkipSponsorBlockEnabled(enabled: boolean): void {
  writeStorageBool(SPONSORBLOCK_AUTO_SKIP_KEY, Boolean(enabled));
}

export function clearSponsorBlockCache(): void {
  segmentCache.clear();
}

export async function fetchSponsorBlockSegments(
  videoId: string,
  categories: string[] = SPONSORBLOCK_DEFAULT_CATEGORIES
): Promise<SponsorBlockSegment[]> {
  const cleanId = String(videoId || '').trim();
  if (!cleanId) return [];

  const sortedCategories = [...new Set(categories.map((c) => c.trim()).filter(Boolean))].sort();
  const cacheKey = `${cleanId}::${sortedCategories.join(',')}`;
  if (segmentCache.has(cacheKey)) {
    return segmentCache.get(cacheKey)!;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const queryCategories = encodeURIComponent(JSON.stringify(sortedCategories));
    const url = `${SPONSORBLOCK_API_BASE}?videoID=${encodeURIComponent(cleanId)}&categories=${queryCategories}`;
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });

    if (!response.ok) {
      segmentCache.set(cacheKey, []);
      return [];
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      segmentCache.set(cacheKey, []);
      return [];
    }

    const normalized: SponsorBlockSegment[] = payload
      .filter(
        (item: any) =>
          item &&
          Array.isArray(item.segment) &&
          item.segment.length >= 2 &&
          Number.isFinite(Number(item.segment[0])) &&
          Number.isFinite(Number(item.segment[1])) &&
          Number(item.segment[1]) > Number(item.segment[0])
      )
      .map((item: any) => ({
        UUID: typeof item.UUID === 'string' ? item.UUID : undefined,
        category: String(item.category || 'music_offtopic'),
        startTime: Number(item.segment[0]),
        endTime: Number(item.segment[1]),
        label: String(item.category || 'skip').replace(/_/g, ' ')
      }))
      .sort((a, b) => a.startTime - b.startTime);

    segmentCache.set(cacheKey, normalized);
    return normalized;
  } catch {
    // network error, timeout, or aborted fetch returns empty safely
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function parseTimestampToSeconds(raw: string): number | null {
  const parts = raw
    .trim()
    .split(':')
    .map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export function parseChaptersFromDescription(
  text: string,
  totalDurationSec?: number
): TrackChapter[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const rawMatches: Array<{ startTime: number; title: string }> = [];
  const leadingRe = /^\s*(?:\[|\()?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\]|\))?\s*[-–—:|]?\s*(.+?)\s*$/;
  const trailingRe = /^\s*(.+?)\s*[-–—:|]?\s*(?:\[|\()?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\]|\))?\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let tsRaw = '';
    let title = '';
    const lead = leadingRe.exec(trimmed);
    if (lead) {
      tsRaw = lead[1];
      title = lead[2];
    } else {
      const trail = trailingRe.exec(trimmed);
      if (trail) {
        title = trail[1];
        tsRaw = trail[2];
      }
    }

    if (!tsRaw || !title) continue;
    const startTime = parseTimestampToSeconds(tsRaw);
    if (startTime === null) continue;

    const cleanTitle = title.replace(/^[-–—:|\s]+|[-–—:|\s]+$/g, '').trim();
    if (!cleanTitle) continue;
    rawMatches.push({ startTime, title: cleanTitle });
  }

  if (rawMatches.length === 0) return [];

  rawMatches.sort((a, b) => a.startTime - b.startTime);

  const deduped: Array<{ startTime: number; title: string }> = [];
  for (const item of rawMatches) {
    if (deduped.length > 0 && deduped[deduped.length - 1].startTime === item.startTime) {
      continue;
    }
    deduped.push(item);
  }

  const chapters: TrackChapter[] = [];
  for (let i = 0; i < deduped.length; i++) {
    const cur = deduped[i];
    const next = deduped[i + 1];
    const fallbackEnd =
      typeof totalDurationSec === 'number' &&
      Number.isFinite(totalDurationSec) &&
      totalDurationSec > cur.startTime
        ? totalDurationSec
        : cur.startTime;
    const endTime = next ? next.startTime : fallbackEnd;
    chapters.push({
      title: cur.title,
      startTime: cur.startTime,
      endTime
    });
  }

  return chapters;
}

export function findActiveSkipSegment(
  currentTimeSec: number,
  segments: SponsorBlockSegment[]
): SponsorBlockSegment | null {
  if (!Number.isFinite(currentTimeSec) || !Array.isArray(segments) || segments.length === 0) {
    return null;
  }
  for (const seg of segments) {
    if (!seg || seg.category === 'chapter') continue;
    if (
      Number.isFinite(seg.startTime) &&
      Number.isFinite(seg.endTime) &&
      seg.endTime > seg.startTime &&
      currentTimeSec >= seg.startTime &&
      currentTimeSec < seg.endTime - 0.25
    ) {
      return seg;
    }
  }
  return null;
}
