import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteSavedQueue,
  deleteSmartPlaylist,
  evaluateSmartPlaylist,
  getLibraryDB,
  getSongAnnotationMap,
  ingestLocalTrack,
  listSavedQueues,
  listSmartPlaylists,
  resetLibraryDBInstance,
  saveNamedQueue,
  saveSmartPlaylist,
  updateSongTagsAndRating
} from '../src/renderer/services/songLibrary';
import {
  DEFAULT_ARTIST_EXCEPTIONS,
  getArtistSplitExceptions,
  parseMultiArtists,
  parseMultiGenres,
  setArtistSplitExceptions
} from '../src/renderer/utils/localMusicUtils';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear()
  };
}

describe('Milestone D: Lateral Library, Dexie v4 Multi-Queues, Smart Playlists, Ratings/Tags & Artist Allowlist', () => {
  const origLocalStorage = globalThis.localStorage;

  beforeEach(async () => {
    (globalThis as any).localStorage = createMemoryStorage();
    resetLibraryDBInstance();
    const db = getLibraryDB();
    await db.songs.clear();
    await db.variants.clear();
    await db.queues.clear();
    await db.smartPlaylists.clear();
  });

  afterEach(() => {
    resetLibraryDBInstance();
    (globalThis as any).localStorage = origLocalStorage;
  });

  it('preserves DEFAULT_ARTIST_EXCEPTIONS and user allowlist entries while splitting genuine features', () => {
    expect(DEFAULT_ARTIST_EXCEPTIONS).toContain('Tyler, The Creator');
    expect(DEFAULT_ARTIST_EXCEPTIONS).toContain('Earth, Wind & Fire');

    expect(parseMultiArtists('Tyler, The Creator feat. Frank Ocean & Kali Uchis')).toEqual([
      'Tyler, The Creator',
      'Frank Ocean',
      'Kali Uchis'
    ]);

    expect(parseMultiArtists('Earth, Wind & Fire; Simon & Garfunkel / AC/DC')).toEqual([
      'Earth, Wind & Fire',
      'Simon & Garfunkel',
      'AC/DC'
    ]);

    // Custom persisted user exception
    setArtistSplitExceptions(['Crosby & Stills']);
    expect(getArtistSplitExceptions()).toEqual(['Crosby & Stills']);
    expect(parseMultiArtists('Crosby & Stills feat. Neil Young')).toEqual([
      'Crosby & Stills',
      'Neil Young'
    ]);

    expect(parseMultiGenres('Synthpop; Indie Rock / Electronic, Dream Pop')).toEqual([
      'Synthpop',
      'Indie Rock',
      'Electronic',
      'Dream Pop'
    ]);
  });

  it('persists and manages multiple named queues in Dexie v4 queues table', async () => {
    const q1 = await saveNamedQueue({
      name: 'Morning Run',
      songs: [
        { id: '1', name: 'Track A' },
        { id: '2', name: 'Track B' }
      ],
      currentIndex: 1
    });
    const q2 = await saveNamedQueue({
      name: 'Late Focus',
      songs: [{ id: '3', name: 'Ambient One' }],
      currentIndex: 0
    });

    const listed = await listSavedQueues();
    expect(listed.length).toBe(2);
    expect(listed.map((q) => q.name).sort()).toEqual(['Late Focus', 'Morning Run']);

    await deleteSavedQueue(q1.id);
    const remaining = await listSavedQueues();
    expect(remaining.map((q) => q.id)).toEqual([q2.id]);
  });

  it('persists track ratings, moods, tags and evaluates Smart Playlists with all/any rules', async () => {
    const ing = await ingestLocalTrack({
      path: 'C:/Music/starlight.flac',
      title: 'Starlight',
      artist: 'Muse',
      album: 'Black Holes',
      durationSec: 240,
      bitrate: 1020
    });

    await updateSongTagsAndRating({
      songId: ing.songId,
      filePath: 'C:/Music/starlight.flac',
      rating: 5,
      moods: ['Energetic', 'Spacey'],
      tags: ['Live', 'Favorite']
    });

    // Also test direct path creation when song was not pre-ingested
    await updateSongTagsAndRating({
      filePath: 'C:/Music/rain.mp3',
      title: 'Rain',
      artist: 'Aimer',
      durationSec: 195,
      rating: 4,
      moods: ['Chill'],
      tags: ['Acoustic']
    });

    const annotations = await getSongAnnotationMap();
    expect(annotations.byPath['C:/Music/starlight.flac']?.rating).toBe(5);
    expect(annotations.byPath['C:/Music/starlight.flac']?.moods).toEqual(['Energetic', 'Spacey']);
    expect(annotations.byPath['C:/Music/rain.mp3']?.rating).toBe(4);
    expect(annotations.bySongId[ing.songId]?.tags).toEqual(['Live', 'Favorite']);

    const savedSp = await saveSmartPlaylist({
      name: 'High Rated Live or Chill',
      matchMode: 'any',
      rules: [
        { field: 'mood', operator: 'contains', value: 'chill' },
        { field: 'rating', operator: 'eq', value: 5 }
      ],
      sortBy: 'rating'
    });

    const playlists = await listSmartPlaylists();
    expect(playlists).toHaveLength(1);
    expect(playlists[0].id).toBe(savedSp.id);

    const tracks = [
      {
        id: 't1',
        filePath: 'C:/Music/starlight.flac',
        title: 'Starlight',
        artist: 'Muse',
        genre: 'Alt Rock; Arena',
        duration: 240000,
        rating: 5,
        moods: ['Energetic', 'Spacey'],
        tags: ['Live']
      },
      {
        id: 't2',
        filePath: 'C:/Music/rain.mp3',
        title: 'Rain',
        artist: 'Aimer',
        genre: 'J-Pop; Ballad',
        duration: 195000,
        rating: 4,
        moods: ['Chill'],
        tags: ['Acoustic']
      },
      {
        id: 't3',
        filePath: 'C:/Music/noise.mp4',
        title: 'Interlude',
        artist: 'Unknown',
        genre: 'Ambient',
        duration: 20000,
        rating: 2,
        moods: ['Short'],
        tags: [],
        hasVideo: true
      }
    ];

    const anyMatches = evaluateSmartPlaylist(tracks, savedSp, { t1: 12, t2: 3, t3: 1 });
    expect(anyMatches.map((t) => t.id)).toEqual(['t1', 't2']);

    const strictSp = await saveSmartPlaylist({
      name: 'Long Popular Favorites',
      matchMode: 'all',
      rules: [
        { field: 'minDurationSec', operator: 'gte', value: 180 },
        { field: 'playCount', operator: 'gte', value: 5 }
      ],
      sortBy: 'playCount',
      limit: 1
    });

    const strictMatches = evaluateSmartPlaylist(tracks, strictSp, { t1: 12, t2: 3, t3: 1 });
    expect(strictMatches.map((t) => t.id)).toEqual(['t1']);

    await deleteSmartPlaylist(savedSp.id);
    await deleteSmartPlaylist(strictSp.id);
    expect(await listSmartPlaylists()).toHaveLength(0);
  });
});
