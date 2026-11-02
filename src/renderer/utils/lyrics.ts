/**
 * Romanized & Translated Lyrics Engine
 * Ported from YesPlayMusic/src/utils/lyrics.js with TypeScript support
 * Supports standard LRC, tlyric (translation), and romalyric (Romanization / phonetic subtitles)
 */

export interface ParsedLyric {
  time: number;
  rawTime: string;
  content: string;
}

export interface RawLyricField {
  version?: number;
  lyric?: string;
}

export interface RawLyricResponse {
  lrc?: RawLyricField;
  tlyric?: RawLyricField;
  romalrc?: RawLyricField;
  yrc?: RawLyricField;
  ytlrc?: RawLyricField;
  yromalrc?: RawLyricField;
  lyricUser?: unknown;
  transUser?: unknown;
}

export interface LyricParserResult {
  lyric: ParsedLyric[];
  tlyric: ParsedLyric[];
  romalyric: ParsedLyric[];
  lyricuser?: unknown;
  transuser?: unknown;
}

// regexr.com/6e52n
const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm;
const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g;

/**
 * Parse a raw lyric response object into structured lyric, tlyric, and romalyric arrays.
 */
export function lyricParser(lrc: RawLyricResponse | null | undefined): LyricParserResult {
  return {
    lyric: parseLyric(lrc?.lrc?.lyric || ''),
    tlyric: parseLyric(lrc?.tlyric?.lyric || lrc?.ytlrc?.lyric || ''),
    romalyric: parseLyric(lrc?.romalrc?.lyric || lrc?.yromalrc?.lyric || ''),
    lyricuser: lrc?.lyricUser,
    transuser: lrc?.transUser
  };
}

/**
 * Parse an LRC formatted string into a time-sorted array of ParsedLyric items.
 *
 * @param lrc The raw LRC string input.
 * @returns Sorted array of ParsedLyric items.
 * @example parseLyric("[00:00.00] Hello, World!\n[00:00.10] Test\n");
 */
export function parseLyric(lrc: string): ParsedLyric[] {
  if (!lrc || typeof lrc !== 'string') {
    return [];
  }

  const parsedLyrics: ParsedLyric[] = [];

  const binarySearch = (lyric: ParsedLyric): number => {
    const time = lyric.time;

    let low = 0;
    let high = parsedLyrics.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midTime = parsedLyrics[mid].time;
      if (midTime === time) {
        return mid;
      } else if (midTime < time) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return low;
  };

  for (const line of lrc.trim().matchAll(extractLrcRegex)) {
    const groups = line.groups;
    if (!groups) continue;
    const { lyricTimestamps, content } = groups;

    for (const timestamp of lyricTimestamps.matchAll(extractTimestampRegex)) {
      const tsGroups = timestamp.groups;
      if (!tsGroups) continue;
      const { min, sec, ms } = tsGroups;
      const validMs = ms?.slice(0, 2) ?? '00';
      const rawTime = `[${min}:${sec}.${validMs}]`;
      const time = Number(min) * 60 + Number(sec) + Number(validMs) * 0.01;

      const parsedLyric: ParsedLyric = { rawTime, time, content: trimContent(content) };
      parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric);
    }
  }

  return parsedLyrics;
}

function trimContent(content: string): string {
  const t = content.trim();
  return t.length < 1 ? content : t;
}

/**
 * Align secondary lyrics (translation or romanization) to primary lyric timestamps.
 * Supports 1:1 index matching when line counts match and fuzzy timestamp matching (<= 2.0s tolerance).
 */
export function alignSubLyrics(
  primaryTimes: number[],
  primaryTexts: string[],
  subLyrics: Array<{ time: number; content: string }>
): string[] {
  if (!subLyrics.length || !primaryTimes.length) {
    return primaryTimes.map(() => '');
  }

  if (subLyrics.length === primaryTimes.length) {
    return primaryTexts.map((text, index) => (text && subLyrics[index] ? subLyrics[index].content : ''));
  }

  const subMap = new Map<number, string>();
  for (const item of subLyrics) {
    if (item.content && Number.isFinite(item.time)) {
      subMap.set(item.time, item.content);
    }
  }

  return primaryTimes.map((currentTime, index) => {
    if (!primaryTexts[index]) return '';
    let closestTime = -1;
    let minDiff = 2.0;

    for (const [sTime] of subMap.entries()) {
      const diff = Math.abs(sTime - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestTime = sTime;
      }
    }

    return closestTime !== -1 ? subMap.get(closestTime) || '' : '';
  });
}

/**
 * Copy lyric text to the system clipboard with fallback support.
 */
export async function copyLyric(lyric: string): Promise<boolean> {
  const textToCopy = lyric;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      return true;
    } catch {
      return false;
    }
  } else {
    const tempInput = document.createElement('textarea');
    tempInput.value = textToCopy;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(tempInput);
    return ok;
  }
}

/**
 * Format raw seconds into standard LRC timestamp string "[mm:ss.xx]"
 * Example: 65.34 -> "[01:05.34]"
 */
export function formatLrcTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  const wholeSecs = Math.floor(remSecs);
  let hundredths = Math.round((remSecs - wholeSecs) * 100);
  let finalSecs = wholeSecs;
  let finalMins = mins;

  if (hundredths >= 100) {
    hundredths = 0;
    finalSecs += 1;
  }
  if (finalSecs >= 60) {
    finalSecs = 0;
    finalMins += 1;
  }

  const mStr = String(finalMins).padStart(2, '0');
  const sStr = String(finalSecs).padStart(2, '0');
  const msStr = String(hundredths).padStart(2, '0');
  return `[${mStr}:${sStr}.${msStr}]`;
}

/**
 * Stamp a timestamp onto a lyric line, replacing any existing leading timestamp.
 */
export function stampLyricLine(line: string, timestampOrSeconds: string | number): string {
  const ts =
    typeof timestampOrSeconds === 'number'
      ? formatLrcTimestamp(timestampOrSeconds)
      : timestampOrSeconds;
  const cleanLine = line.replace(/^(?:\[\d+:\d+(?:\.\d+)?\]\s*)+/g, '').trimStart();
  return `${ts}${cleanLine}`;
}

/**
 * Strip all leading timestamps from lyric lines.
 */
export function stripLrcTimestamps(lrcText: string): string {
  if (!lrcText) return '';
  return lrcText
    .split('\n')
    .map((line) => line.replace(/^(?:\[\d+:\d+(?:\.\d+)?\]\s*)+/g, '').trim())
    .join('\n');
}

