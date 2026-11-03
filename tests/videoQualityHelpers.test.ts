import { describe, expect, it } from 'vitest';
import {
  buildSearchQuery,
  formatBitrate,
  formatBytes,
  formatQualityRow,
  formatVideoTime,
  formatViewCount,
  getUniqueVideoHeights,
  isAudioDownloaded,
  isHeightDownloaded
} from '../src/renderer/utils/videoQualityHelpers';

describe('videoQualityHelpers', () => {
  it('formats bytes and bitrates cleanly', () => {
    expect(formatBytes(15_000_000)).toBe('14.3 MB');
    expect(formatBytes(500_000)).toBe('488 KB');
    expect(formatBytes(0)).toBe('-- MB');

    expect(formatBitrate(2500)).toBe('2500 kb/s');
    expect(formatBitrate(0)).toBe('-- kb/s');
  });

  it('formats quality row matching spec (mp4 • <kbps> kb/s • <size MB>)', () => {
    const row = formatQualityRow({
      height: 1080,
      vbr: 2500,
      sizeBytes: 45 * 1024 * 1024,
      container: 'mp4'
    });
    expect(row.label).toBe('1080p');
    expect(row.detail).toBe('mp4 • 2500 kb/s • 45.0 MB');
  });

  it('groups formats and extracts unique video heights descending', () => {
    const mockFormats = [
      { formatId: '1', height: 720, vbr: 1200, sizeBytes: 20_000_000, container: 'mp4' },
      { formatId: '2', height: 1080, vbr: 2500, sizeBytes: 45_000_000, container: 'mp4' },
      { formatId: '3', height: 720, vbr: 800, sizeBytes: 15_000_000, container: 'mp4' },
      { formatId: '4', height: 360, vbr: 400, sizeBytes: 8_000_000, container: 'mp4' }
    ] as any;

    const heights = getUniqueVideoHeights(mockFormats);
    expect(heights.map((h) => h.height)).toEqual([1080, 720, 360]);
    // For 720, it should have picked the higher score format (formatId '1' with size 20_000_000)
    expect(heights[1].sizeFormatted).toBe('19.1 MB');
  });

  it('checks if height or audio is downloaded in variants', () => {
    const variants = [
      { kind: 'audio', path: '/music/song.mp3' },
      { kind: 'video', height: 720, path: '/music/song-720p.mp4' },
      { kind: 'video', height: 1080 } // not downloaded locally
    ] as any;

    expect(isHeightDownloaded(variants, 720)).toBe(true);
    expect(isHeightDownloaded(variants, 1080)).toBe(false);
    expect(isHeightDownloaded(variants, 480)).toBe(false);
    expect(isAudioDownloaded(variants)).toBe(true);
  });

  it('builds clean search queries from title, album, artist', () => {
    expect(buildSearchQuery('Blinding Lights', 'After Hours', 'The Weeknd')).toBe(
      'Blinding Lights After Hours The Weeknd'
    );
    // Deduplicates if album is identical to title
    expect(buildSearchQuery('Hello', 'Hello', 'Adele')).toBe('Hello Adele');
    expect(buildSearchQuery('Song', '', '')).toBe('Song');
  });

  it('formats video time and view count', () => {
    expect(formatVideoTime(65)).toBe('01:05');
    expect(formatVideoTime(3665)).toBe('01:01:05');
    expect(formatViewCount(1_250_000)).toBe('1.3M views');
    expect(formatViewCount(450_000)).toBe('450K views');
  });
});
