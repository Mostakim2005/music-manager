import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findFingerprintDuplicatePairs } from '../src/shared/duplicateDetection';
import {
  findDuplicateRecordings,
  getLibraryDB,
  getVariants,
  ingestLocalTrack,
  mergeSongs,
  resetLibraryDBInstance,
  setFingerprintForPath
} from '@/services/songLibrary';

const fingerprintA = '00001111222233334444555566667777';
const fingerprintB = '0000111122223333444455556666777700'; // 2 extra windows, same shape
const fingerprintOther = 'ffffffffffffffff0000000000000000';

describe('findFingerprintDuplicatePairs', () => {
  it('pairs recordings with the same signature and close duration', () => {
    const pairs = findFingerprintDuplicatePairs([
      { id: 'a', fingerprint: fingerprintA, durationSec: 200, variantCount: 1 },
      { id: 'b', fingerprint: fingerprintB, durationSec: 202, variantCount: 1 }
    ]);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].score).toBeCloseTo(32 / 34, 5);
  });

  it('does not pair different signatures or distant durations', () => {
    expect(
      findFingerprintDuplicatePairs([
        { id: 'a', fingerprint: fingerprintA, durationSec: 200 },
        { id: 'b', fingerprint: fingerprintOther, durationSec: 200 }
      ])
    ).toHaveLength(0);

    expect(
      findFingerprintDuplicatePairs([
        { id: 'a', fingerprint: fingerprintA, durationSec: 200 },
        { id: 'b', fingerprint: fingerprintB, durationSec: 260 }
      ])
    ).toHaveLength(0);
  });

  it('keeps the record with more variants and ignores entries without fingerprints', () => {
    const pairs = findFingerprintDuplicatePairs([
      { id: 'few', fingerprint: fingerprintA, durationSec: 200, variantCount: 1 },
      { id: 'many', fingerprint: fingerprintB, durationSec: 200, variantCount: 4 },
      { id: 'none', durationSec: 200, variantCount: 9 }
    ]);

    expect(pairs).toEqual([
      expect.objectContaining({ keepId: 'many', dropId: 'few' })
    ]);
  });

  it('lets one survivor absorb several duplicates without reusing a dropped record', () => {
    const pairs = findFingerprintDuplicatePairs([
      { id: 'keep', fingerprint: fingerprintA, durationSec: 100, variantCount: 2 },
      { id: 'drop1', fingerprint: fingerprintB, durationSec: 100, variantCount: 1 },
      { id: 'drop2', fingerprint: fingerprintA, durationSec: 101, variantCount: 1 }
    ]);

    expect(pairs).toHaveLength(2);
    expect(pairs.every((pair) => pair.keepId === 'keep')).toBe(true);
    expect(new Set(pairs.map((pair) => pair.dropId)).size).toBe(2);
  });
});

describe('library acoustic duplicates', () => {
  beforeEach(async () => {
    resetLibraryDBInstance();
    const db = getLibraryDB();
    await Promise.all([db.songs.clear(), db.variants.clear(), db.playbackPositions.clear()]);
  });

  afterEach(() => {
    resetLibraryDBInstance();
  });

  it('matches an incoming file by fingerprint even when the metadata was rewritten', async () => {
    const original = await ingestLocalTrack({
      path: '/music/original.flac',
      title: 'Original Title',
      artist: 'Original Artist',
      durationSec: 210,
      fingerprint: fingerprintA,
      fingerprintDurationSec: 120
    });

    const renamed = await ingestLocalTrack({
      path: '/music/renamed_320.mp3',
      title: 'Totally Different Name',
      artist: 'Someone Else',
      durationSec: 211,
      fingerprint: fingerprintB,
      fingerprintDurationSec: 120
    });

    expect(renamed.matched).toBe('fingerprint');
    expect(renamed.songId).toBe(original.songId);
    expect(await getVariants(original.songId)).toHaveLength(2);
  });

  it('backfills a fingerprint by path and finds the duplicate pair', async () => {
    const first = await ingestLocalTrack({
      path: '/music/one.mp3',
      title: 'Song',
      artist: 'Artist',
      durationSec: 180
    });
    const second = await ingestLocalTrack({
      path: '/music/two.mp3',
      title: 'Song (copy)',
      artist: 'Artist',
      durationSec: 181
    });

    await setFingerprintForPath('/music/one.mp3', fingerprintA, 120);
    await setFingerprintForPath('/music/two.mp3', fingerprintB, 120);

    const pairs = await findDuplicateRecordings();
    expect(pairs).toHaveLength(1);
    expect(new Set([pairs[0].keepId, pairs[0].dropId])).toEqual(
      new Set([first.songId, second.songId])
    );

    await mergeSongs(pairs[0].keepId, pairs[0].dropId);
    expect(await getVariants(pairs[0].keepId)).toHaveLength(2);
  });
});
