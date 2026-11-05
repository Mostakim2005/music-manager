/**
 * Pure helper functions for YouTube video qualities, variant status mapping,
 * search query building, and time/metric formatting.
 */

import type { YtVideoFormat } from '../../main/modules/youtubeFormats';

export interface FormattedQualityRow {
  height: number;
  label: string; // e.g. "1080p"
  container: string; // e.g. "mp4"
  bitrateFormatted: string; // e.g. "2500 kb/s"
  sizeFormatted: string; // e.g. "45.2 MB"
  displaySize: string; // size with ~ prefix when it is an estimate
  detail: string; // e.g. "mp4 • 2500 kb/s • 45.2 MB"
  rawFormat?: YtVideoFormat;
}

/**
 * Format bytes into human-readable size (e.g. "14.5 MB", "950 KB")
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '-- MB';
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}

/**
 * Format bitrate into kb/s (e.g. "2500 kb/s", "128 kb/s")
 */
export function formatBitrate(kbps?: number): string {
  if (!kbps || !Number.isFinite(kbps) || kbps <= 0) return '-- kb/s';
  return `${Math.round(kbps)} kb/s`;
}

/**
 * Maps a single video format into a standard row representation:
 * "mp4 • <kbps> kb/s • <size MB>"
 */
export function formatQualityRow(format: {
  height?: number;
  vbrKbps?: number;
  vbr?: number;
  tbr?: number;
  sizeBytes?: number;
  container?: string;
  ext?: string;
}): FormattedQualityRow {
  const height = format.height || 0;
  const label = height > 0 ? `${height}p` : 'Auto';
  const container = (format.container || format.ext || 'mp4').toLowerCase();
  const bitrate = format.vbrKbps || format.vbr || format.tbr;
  const bitrateFormatted = formatBitrate(bitrate);
  // yt-dlp exposes `filesize` / `filesize_approx` for many formats; the
  // grouped rows use `sizeBytes`. Accept all so every quality can show a size.
  const rawSize =
    format.sizeBytes ||
    (format as any).filesize ||
    (format as any).filesize_approx ||
    (format as any).contentLength ||
    0;
  const sizeFormatted = formatBytes(rawSize);
  // `filesize` is the real byte count reported by YouTube; `filesize_approx`
  // and bitrate-derived values are estimates and are marked with a tilde.
  const exactSize = Number((format as any).filesize) || Number(format.sizeBytes) || 0;
  const displaySize = rawSize > 0 && !exactSize ? `~${sizeFormatted}` : sizeFormatted;

  let detail = container;
  if (bitrate && bitrate > 0) {
    detail += ` • ${bitrateFormatted}`;
  }
  if (rawSize > 0) {
    detail += ` • ${sizeFormatted}`;
  }

  return {
    height,
    label,
    container,
    bitrateFormatted,
    sizeFormatted,
    displaySize,
    detail
  };
}

/**
 * Filters and groups available video formats into unique heights descending:
 * 1080p, 720p, 480p, 360p, 240p, 144p
 */
export function getUniqueVideoHeights(formats: YtVideoFormat[]): FormattedQualityRow[] {
  if (!Array.isArray(formats) || formats.length === 0) {
    // Return standard fallback ladder if no raw formats provided
    const standardHeights = [1080, 720, 480, 360, 240, 144];
    return standardHeights.map((h) => formatQualityRow({ height: h, container: 'mp4' }));
  }

  const byHeight = new Map<number, YtVideoFormat>();
  for (const fmt of formats) {
    if (!fmt.height || fmt.height <= 0) continue;
    const existing = byHeight.get(fmt.height);
    // Prefer format with sizeBytes or higher bitrate
    if (!existing) {
      byHeight.set(fmt.height, fmt);
    } else {
      const existingBitrate =
        existing.vbrKbps || (existing as any).vbr || (existing as any).tbr || 0;
      const currentBitrate = fmt.vbrKbps || (fmt as any).vbr || (fmt as any).tbr || 0;
      const existingScore = (existing.sizeBytes || 0) + existingBitrate * 1000;
      const currentScore = (fmt.sizeBytes || 0) + currentBitrate * 1000;
      if (currentScore > existingScore) {
        byHeight.set(fmt.height, fmt);
      }
    }
  }

  const sortedHeights = Array.from(byHeight.keys()).sort((a, b) => b - a);

  return sortedHeights.map((h) => {
    const raw = byHeight.get(h)!;
    const row = formatQualityRow(raw);
    row.rawFormat = raw;
    return row;
  });
}

/**
 * Checks whether a given video height is already downloaded in variants.
 */
export function isHeightDownloaded(
  variants: Array<{ kind: string; height?: number; path?: string }>,
  height: number
): boolean {
  if (!Array.isArray(variants) || !height) return false;
  return variants.some((v) => v.kind === 'video' && v.height === height && Boolean(v.path));
}

/**
 * Checks whether any audio variant is already downloaded.
 */
export function isAudioDownloaded(variants: Array<{ kind: string; path?: string }>): boolean {
  if (!Array.isArray(variants)) return false;
  return variants.some((v) => v.kind === 'audio' && Boolean(v.path));
}

/**
 * Builds search query pre-filled with "<title> <album> <artist>",
 * avoiding redundant tokens and trimming.
 */
export function buildSearchQuery(title?: string, album?: string, artist?: string): string {
  const parts: string[] = [];
  const clean = (s?: string) => (s ? s.trim() : '');

  const cTitle = clean(title);
  const cAlbum = clean(album);
  const cArtist = clean(artist);

  if (cTitle) parts.push(cTitle);
  if (cAlbum && cAlbum.toLowerCase() !== cTitle.toLowerCase()) {
    parts.push(cAlbum);
  }
  if (
    cArtist &&
    cArtist.toLowerCase() !== cTitle.toLowerCase() &&
    cArtist.toLowerCase() !== cAlbum.toLowerCase()
  ) {
    parts.push(cArtist);
  }

  return parts.join(' ').trim();
}

/**
 * Formats time in seconds to mm:ss or hh:mm:ss with tabular numeric padding
 */
export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats views count (e.g. 1.5M, 230K)
 */
export function formatViewCount(views?: number): string {
  if (!views || views <= 0) return '';
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M views`;
  }
  if (views >= 1_000) {
    return `${Math.round(views / 1_000)}K views`;
  }
  return `${views} views`;
}
