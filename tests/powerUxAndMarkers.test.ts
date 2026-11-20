import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addListeningSeconds,
  clearListeningStats,
  getListeningStatsSummary,
  getListenThresholdConfig,
  recordTrackPlay,
  removeScrobbleEntry,
  removeTrackStat,
  setListenThresholdConfig,
  shouldRecordPlayThreshold
} from '@/services/listeningStatsService';
import {
  clearSponsorBlockCache,
  fetchSponsorBlockSegments,
  findActiveSkipSegment,
  parseChaptersFromDescription
} from '@/services/sponsorBlockService';
import {
  type CommandPaletteItem,
  type CommandPaletteTrackInput,
  extractLyricSnippet,
  searchCommandPaletteItems} from '@/utils/commandPaletteHelpers';

import { readSidecarLrc } from '../src/main/modules/sidecarLyrics';

describe('sponsorBlockService', () => {
  beforeEach(() => {
    clearSponsorBlockCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses leading and trailing YouTube description chapters with computed end times', () => {
    const desc = ['0:00 Intro', '01:15 - Verse One', 'Chorus 2:30', '01:00:05 Finale'].join('\n');

    const chapters = parseChaptersFromDescription(desc, 3700);
    expect(chapters).toEqual([
      { title: 'Intro', startTime: 0, endTime: 75 },
      { title: 'Verse One', startTime: 75, endTime: 150 },
      { title: 'Chorus', startTime: 150, endTime: 3605 },
      { title: 'Finale', startTime: 3605, endTime: 3700 }
    ]);
  });

  it('finds active skip segments and ignores chapter markers', () => {
    const segments = [
      { category: 'chapter', startTime: 0, endTime: 60 },
      { category: 'music_offtopic', startTime: 10, endTime: 25 }
    ];

    expect(findActiveSkipSegment(5, segments)).toBeNull();
    expect(findActiveSkipSegment(12, segments)?.category).toBe('music_offtopic');
    expect(findActiveSkipSegment(24.9, segments)).toBeNull();
  });

  it('fetches, normalizes, and caches SponsorBlock segments and handles 404 fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { UUID: 'u1', category: 'music_offtopic', segment: [12.5, 30.0] },
        { UUID: 'u2', category: 'intro', segment: [0, 5.2] }
      ]
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchSponsorBlockSegments('abc123XYZ');
    expect(first.length).toBe(2);
    expect(first[0].category).toBe('intro');
    expect(first[1].startTime).toBe(12.5);

    const cached = await fetchSponsorBlockSegments('abc123XYZ');
    expect(cached).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const missing = await fetchSponsorBlockSegments('notFoundId');
    expect(missing).toEqual([]);
  });
});

describe('listeningStatsService thresholds and history deletion', () => {
  beforeEach(() => {
    clearListeningStats();
    setListenThresholdConfig({ minSeconds: 30, minPercent: 50 });
  });

  it('evaluates listen-threshold scrobbling rules accurately', () => {
    const cfg = { minSeconds: 30, minPercent: 50 };
    expect(shouldRecordPlayThreshold(0, 180, cfg)).toBe(false);
    expect(shouldRecordPlayThreshold(29, 180, cfg)).toBe(false);
    expect(shouldRecordPlayThreshold(30, 180, cfg)).toBe(true);
    // Short 40s track reaches 50% at 20s even before 30s
    expect(shouldRecordPlayThreshold(20, 40, cfg)).toBe(true);
    expect(shouldRecordPlayThreshold(19, 40, cfg)).toBe(false);

    const updated = setListenThresholdConfig({ minSeconds: 45, minPercent: 60 });
    expect(updated).toEqual({ minSeconds: 45, minPercent: 60 });
    expect(getListenThresholdConfig()).toEqual({ minSeconds: 45, minPercent: 60 });
  });

  it('deletes individual scrobble entries and full track stats cleanly', () => {
    const songA = { id: 't1', name: 'Aurora', ar: [{ name: 'Artist One' }] };
    const songB = { id: 't2', name: 'Solstice', ar: [{ name: 'Artist Two' }] };

    recordTrackPlay(songA);
    addListeningSeconds(songA, 120);
    recordTrackPlay(songB);
    addListeningSeconds(songB, 90);

    let summary = getListeningStatsSummary();
    expect(summary.totalPlays).toBe(2);
    expect(summary.recentScrobbles.length).toBe(2);

    const removedScrobble = removeScrobbleEntry(summary.recentScrobbles[0].playedAt);
    expect(removedScrobble).toBe(true);
    summary = getListeningStatsSummary();
    expect(summary.recentScrobbles.length).toBe(1);
    expect(summary.totalPlays).toBe(1);

    const removedTrack = removeTrackStat('t1');
    expect(removedTrack).toBe(true);
    summary = getListeningStatsSummary();
    expect(summary.topTracks.find((t) => t.id === 't1')).toBeUndefined();
    expect(summary.topArtists.find((a) => a.name === 'Artist One')).toBeUndefined();
  });
});

describe('commandPaletteHelpers', () => {
  const actions: CommandPaletteItem[] = [
    {
      id: 'nav:set',
      category: 'navigation',
      title: 'Open Settings',
      subtitle: 'Preferences',
      keywords: ['config']
    },
    {
      id: 'dsp:mono',
      category: 'dsp',
      title: 'Toggle Mono Downmix (OFF)',
      subtitle: 'Mix stereo to mono',
      keywords: ['channel']
    }
  ];

  const tracks: CommandPaletteTrackInput[] = [
    {
      id: 'trk-1',
      title: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up',
      lyrics: '[00:12.00] Waiting in a car\n[00:16.50] Waiting for a ride in the dark'
    }
  ];

  it('extracts clean lyric snippets with LRC timestamps stripped', () => {
    const snippet = extractLyricSnippet(tracks[0].lyrics || '', 'ride in the dark');
    expect(snippet).toBe('Waiting for a ride in the dark');
  });

  it('ranks matching actions and returns lyric-matched tracks with snippet subtitles', () => {
    const dspMatches = searchCommandPaletteItems('mono', actions, tracks);
    expect(dspMatches[0]?.id).toBe('dsp:mono');

    const lyricMatches = searchCommandPaletteItems('ride in the dark', actions, tracks);
    expect(lyricMatches.length).toBe(1);
    expect(lyricMatches[0].id).toBe('track:trk-1');
    expect(lyricMatches[0].badge).toBe('Lyric Match');
    expect(lyricMatches[0].subtitle).toContain('Waiting for a ride in the dark');
  });

  it('reads sibling sidecar .lrc files so local tracks without embedded lyrics are searchable', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-lrc-test-'));
    try {
      const audioPath = path.join(tmpDir, 'Track One.flac');
      const lrcPath = path.join(tmpDir, 'Track One.lrc');
      fs.writeFileSync(audioPath, 'dummy-audio');
      fs.writeFileSync(lrcPath, '[00:05.00] Sidecar lyric line for command palette\n', 'utf8');

      const loaded = await readSidecarLrc(audioPath);
      expect(loaded).toContain('Sidecar lyric line for command palette');

      const matches = searchCommandPaletteItems(
        'command palette',
        [],
        [{ id: 'sidecar-1', title: 'Track One', artist: 'Local Artist', lyrics: loaded || '' }]
      );
      expect(matches.length).toBe(1);
      expect(matches[0].badge).toBe('Lyric Match');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
