import { beforeEach, describe, expect, it } from 'vitest';

import {
  addListeningSeconds,
  clearListeningStats,
  exportListeningStatsRaw,
  getListeningStatsSummary,
  importListeningStatsRaw,
  recordTrackPlay
} from '@/services/listeningStatsService';
import {
  formatLrcTimestamp,
  stampLyricLine,
  stripLrcTimestamps
} from '@/utils/lyrics';

describe('listeningStatsService', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.clear === 'function') {
      localStorage.clear();
    }
    clearListeningStats();
  });

  it('records a track play and adds listening seconds', () => {
    const song = {
      id: 101,
      name: 'Starlight',
      ar: [{ name: 'Muse' }],
      al: { picUrl: 'https://example.com/cover.jpg' }
    };

    recordTrackPlay(song);
    addListeningSeconds(song, 120);

    const summary = getListeningStatsSummary();
    expect(summary.totalPlays).toBe(1);
    expect(summary.totalListenSeconds).toBe(120);
    expect(summary.topTracks.length).toBe(1);
    expect(summary.topTracks[0].name).toBe('Starlight');
    expect(summary.topTracks[0].artist).toBe('Muse');
    expect(summary.topTracks[0].plays).toBe(1);
    expect(summary.topTracks[0].seconds).toBe(120);
    expect(summary.topTracks[0].picUrl).toBe('https://example.com/cover.jpg');

    expect(summary.topArtists.length).toBe(1);
    expect(summary.topArtists[0].name).toBe('Muse');
    expect(summary.topArtists[0].plays).toBe(1);
    expect(summary.topArtists[0].seconds).toBe(120);

    expect(summary.recentScrobbles.length).toBe(1);
    expect(summary.recentScrobbles[0].name).toBe('Starlight');
  });

  it('handles multiple tracks and ranks top tracks and artists', () => {
    const song1 = { id: 1, name: 'Song 1', ar: [{ name: 'Artist A' }] };
    const song2 = { id: 2, name: 'Song 2', ar: [{ name: 'Artist B' }] };

    recordTrackPlay(song1);
    recordTrackPlay(song1);
    addListeningSeconds(song1, 200);

    recordTrackPlay(song2);
    addListeningSeconds(song2, 50);

    const summary = getListeningStatsSummary();
    expect(summary.totalPlays).toBe(3);
    expect(summary.totalListenSeconds).toBe(250);
    expect(summary.topTracks[0].id).toBe(1);
    expect(summary.topTracks[0].plays).toBe(2);
    expect(summary.topArtists[0].name).toBe('Artist A');
    expect(summary.topArtists[0].plays).toBe(2);
  });

  it('exports, imports, and clears stats correctly', () => {
    const song = { id: 50, name: 'Test Song', artist: 'Test Singer' };
    recordTrackPlay(song);
    addListeningSeconds(song, 30);

    const exported = exportListeningStatsRaw();
    expect(exported.totalPlays).toBe(1);
    expect(exported.totalListenSeconds).toBe(30);

    clearListeningStats();
    expect(getListeningStatsSummary().totalPlays).toBe(0);
    expect(getListeningStatsSummary().totalListenSeconds).toBe(0);

    importListeningStatsRaw(exported);
    const reloaded = getListeningStatsSummary();
    expect(reloaded.totalPlays).toBe(1);
    expect(reloaded.totalListenSeconds).toBe(30);
  });
});

describe('lyrics utils (formatLrcTimestamp, stampLyricLine, stripLrcTimestamps)', () => {
  it('formats seconds into [mm:ss.xx]', () => {
    expect(formatLrcTimestamp(0)).toBe('[00:00.00]');
    expect(formatLrcTimestamp(65.34)).toBe('[01:05.34]');
    expect(formatLrcTimestamp(125.05)).toBe('[02:05.05]');
    expect(formatLrcTimestamp(3600)).toBe('[60:00.00]');
  });

  it('stamps timestamp onto plain or previously stamped line', () => {
    expect(stampLyricLine('Hold on to the night', 65.34)).toBe('[01:05.34]Hold on to the night');
    expect(stampLyricLine('[00:12.34] Replace existing timestamp', 65.34)).toBe('[01:05.34]Replace existing timestamp');
  });

  it('strips timestamps from multi-line LRC text', () => {
    const raw = '[00:01.20] First line\n[00:05.80] Second line\nPlain line';
    const stripped = stripLrcTimestamps(raw);
    expect(stripped).toBe('First line\nSecond line\nPlain line');
  });
});
