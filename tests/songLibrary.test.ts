import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cleanString,
  computeNormKey,
  findSongByPath,
  getLibraryDB,
  getPosition,
  getSong,
  getSongKey,
  getVariants,
  ingestLocalTrack,
  linkVariant,
  mergeSongs,
  resetLibraryDBInstance,
  savePosition,
  setYoutubeId,
  stripBracketsAndTags,
  tokenJaccardSimilarity,
  unlinkVariant
} from '@/services/songLibrary';

describe('SongLibrary normalization (normKey)', () => {
  it('strips bracketed tags like (Official Video), (Lyrics), [HD], (Remastered 2011)', () => {
    expect(stripBracketsAndTags('Princess of China (Official Video) [HD]')).toBe('Princess of China    ');
    expect(cleanString('Princess of China (Official Video) [HD]')).toBe('princess of china');

    expect(cleanString('Bohemian Rhapsody (Remastered 2011)')).toBe('bohemian rhapsody');
    expect(cleanString('Bohemian Rhapsody - Remastered 2011')).toBe('bohemian rhapsody');
    expect(cleanString('In the End [Official HD Music Video]')).toBe('in the end');
    expect(cleanString('Love The Way You Lie (Lyrics)')).toBe('love the way you lie');
    expect(cleanString('Yesterday (2015 Remaster)')).toBe('yesterday');
  });

  it('strips feat. / ft. / featuring credits', () => {
    expect(computeNormKey('Coldplay feat. Rihanna', 'Princess of China')).toBe('coldplay|princess of china');
    expect(computeNormKey('Coldplay ft. BTS', 'My Universe (Official Video)')).toBe('coldplay|my universe');
    expect(computeNormKey('Dua Lipa', 'Levitating (feat. DaBaby)')).toBe('dua lipa|levitating');
    expect(computeNormKey('Major Lazer featuring Justin Bieber', 'Cold Water')).toBe('major lazer|cold water');
  });

  it('strips punctuation and extra whitespace and converts to lowercase', () => {
    expect(computeNormKey('  AC/DC!  ', '  Back In Black...  ')).toBe('ac dc|back in black');
    expect(computeNormKey('Panic! At The Disco', 'I Write Sins Not Tragedies')).toBe('panic at the disco|i write sins not tragedies');
  });

  it('calculates token Jaccard similarity accurately', () => {
    const k1 = 'taylor swift|bad blood';
    const k2 = 'taylor swift|bad blood remix';
    // k1 tokens: taylor, swift, bad, blood (4)
    // k2 tokens: taylor, swift, bad, blood, remix (5)
    // Intersection: 4, Union: 5 -> 0.8
    expect(tokenJaccardSimilarity(k1, k2)).toBeCloseTo(0.8, 5);

    // Identical
    expect(tokenJaccardSimilarity(k1, k1)).toBe(1.0);

    // Completely different
    const k3 = 'queen|bohemian rhapsody';
    expect(tokenJaccardSimilarity(k1, k3)).toBe(0.0);
  });
});

describe('SongLibrary DB matching and variants (B1-B3)', () => {
  beforeEach(async () => {
    resetLibraryDBInstance();
    const db = getLibraryDB();
    await Promise.all([db.songs.clear(), db.variants.clear(), db.playbackPositions.clear()]);
  });

  afterEach(async () => {
    resetLibraryDBInstance();
  });

  it('ingests a new track as "new"', async () => {
    const result = await ingestLocalTrack({
      path: '/music/song1.mp3',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      durationSec: 354,
      bitrate: 320,
      container: 'mp3'
    });

    expect(result.matched).toBe('new');
    expect(result.songId).toBeTruthy();

    const song = await getSong(result.songId);
    expect(song).toBeDefined();
    expect(song?.title).toBe('Bohemian Rhapsody');
    expect(song?.normKey).toBe('queen|bohemian rhapsody');

    const variants = await getVariants(result.songId);
    expect(variants).toHaveLength(1);
    expect(variants[0].path).toBe('/music/song1.mp3');
    expect(variants[0].bitrateKbps).toBe(320);
    expect(variants[0].kind).toBe('audio');
  });

  it('returns "exact" when matching by identical file path', async () => {
    const first = await ingestLocalTrack({
      path: '/music/song1.mp3',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      durationSec: 354
    });

    const second = await ingestLocalTrack({
      path: '/music/song1.mp3',
      title: 'Bohemian Rhapsody (Alternate)',
      artist: 'Queen',
      durationSec: 355
    });

    expect(second.matched).toBe('exact');
    expect(second.songId).toBe(first.songId);
  });

  it('returns "exact" when matching by youtubeId and links variant', async () => {
    const first = await ingestLocalTrack({
      path: '/music/track1.mp3',
      title: 'Song One',
      artist: 'Artist A',
      durationSec: 200,
      youtubeId: 'yt-xyz-123'
    });

    const second = await ingestLocalTrack({
      path: '/music/track1_video.mp4',
      title: 'Different Title Text',
      artist: 'Artist A',
      durationSec: 200,
      hasVideo: true,
      container: 'mp4',
      youtubeId: 'yt-xyz-123'
    });

    expect(second.matched).toBe('exact');
    expect(second.songId).toBe(first.songId);

    const variants = await getVariants(first.songId);
    expect(variants).toHaveLength(2);
  });

  it('returns "exact" when matching by same normKey and duration diff <= 3s', async () => {
    const first = await ingestLocalTrack({
      path: '/music/queen_bohemian.mp3',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      durationSec: 354,
      bitrate: 320
    });

    const second = await ingestLocalTrack({
      path: '/music/queen_bohemian_remastered.flac',
      title: 'Bohemian Rhapsody (Remastered 2011)',
      artist: 'Queen',
      durationSec: 355, // diff = 1s <= 3s
      bitrate: 1411,
      container: 'flac'
    });

    expect(second.matched).toBe('exact');
    expect(second.songId).toBe(first.songId);

    const variants = await getVariants(first.songId);
    expect(variants).toHaveLength(2);
  });

  it('returns "fuzzy" with candidates when token Jaccard >= 0.8 and duration within 3s without auto-merging', async () => {
    const first = await ingestLocalTrack({
      path: '/music/bad_blood.mp3',
      title: 'Bad Blood',
      artist: 'Taylor Swift',
      durationSec: 211
    });

    const second = await ingestLocalTrack({
      path: '/music/bad_blood_remix.mp3',
      title: 'Bad Blood Remix',
      artist: 'Taylor Swift',
      durationSec: 212 // diff = 1s <= 3s
    });

    expect(second.matched).toBe('fuzzy');
    expect(second.candidates).toBeDefined();
    expect(second.candidates?.length).toBeGreaterThan(0);
    expect(second.candidates?.[0].id).toBe(first.songId);

    // Variants of original song should NOT have auto-merged
    const originalVariants = await getVariants(first.songId);
    expect(originalVariants).toHaveLength(1);
  });

  it('sorts variants: video by height desc, audio by bitrate desc', async () => {
    const ingest = await ingestLocalTrack({
      path: '/music/song.mp3',
      title: 'Test Song',
      artist: 'Artist',
      durationSec: 180,
      bitrate: 192
    });

    const songId = ingest.songId;

    // Add higher bitrate audio
    await linkVariant(songId, {
      kind: 'audio',
      source: 'local',
      path: '/music/song_hq.flac',
      bitrateKbps: 960
    });

    // Add video 720p
    await linkVariant(songId, {
      kind: 'video',
      source: 'local',
      path: '/music/video_720.mp4',
      height: 720
    });

    // Add video 1080p
    await linkVariant(songId, {
      kind: 'video',
      source: 'local',
      path: '/music/video_1080.mp4',
      height: 1080
    });

    const sorted = await getVariants(songId);
    expect(sorted).toHaveLength(4);

    // Videos first, 1080p then 720p
    expect(sorted[0].height).toBe(1080);
    expect(sorted[1].height).toBe(720);

    // Audios second, 960 then 192
    expect(sorted[2].bitrateKbps).toBe(960);
    expect(sorted[3].bitrateKbps).toBe(192);
  });

  it('merges songs, unlinks variants, and updates youtubeId', async () => {
    const song1 = await ingestLocalTrack({
      path: '/music/s1.mp3',
      title: 'Track A',
      artist: 'Artist',
      durationSec: 180
    });

    const song2 = await ingestLocalTrack({
      path: '/music/s2.mp3',
      title: 'Track B',
      artist: 'Other',
      durationSec: 300,
      youtubeId: 'yt-drop'
    });

    await setYoutubeId(song1.songId, 'yt-keep');
    const updatedSong1 = await getSong(song1.songId);
    expect(updatedSong1?.youtubeId).toBe('yt-keep');

    // Merge song2 into song1
    await mergeSongs(song1.songId, song2.songId);

    const checkDrop = await getSong(song2.songId);
    expect(checkDrop).toBeUndefined();

    const variantsOf1 = await getVariants(song1.songId);
    expect(variantsOf1).toHaveLength(2);

    // Unlink one variant
    await unlinkVariant(variantsOf1[1].id);
    const variantsAfterUnlink = await getVariants(song1.songId);
    expect(variantsAfterUnlink).toHaveLength(1);
  });

  it('finds song and variant by file path', async () => {
    const ingest = await ingestLocalTrack({
      path: '/music/unique_path.mp3',
      title: 'Unique Song',
      artist: 'Unique Artist',
      durationSec: 220
    });

    const match = await findSongByPath('/music/unique_path.mp3');
    expect(match).toBeDefined();
    expect(match?.song.id).toBe(ingest.songId);
    expect(match?.variant.path).toBe('/music/unique_path.mp3');
  });

  it('saves and restores playback position for local paths, song IDs, and online keys (B4)', async () => {
    const ingest = await ingestLocalTrack({
      path: '/music/pos_test.mp3',
      title: 'Position Test',
      artist: 'Artist',
      durationSec: 250
    });

    // 1. Save by local path
    await savePosition('/music/pos_test.mp3', 88.5);
    expect(await getPosition('/music/pos_test.mp3')).toBe(88.5);

    // Song record itself should have updated lastPositionSec
    const song = await getSong(ingest.songId);
    expect(song?.lastPositionSec).toBe(88.5);

    // 2. Query by songId directly
    expect(await getPosition(ingest.songId)).toBe(88.5);

    // 3. Save by online youtube key
    await savePosition('yt:dQw4w9WgXcQ', 45.2);
    expect(await getPosition('yt:dQw4w9WgXcQ')).toBe(45.2);

    // 4. Save by netease online key
    await savePosition('netease:1234567', 120);
    expect(await getPosition('netease:1234567')).toBe(120);

    // 5. Resolving song key
    expect(getSongKey({ path: '/test.mp3' })).toBe('/test.mp3');
    expect(getSongKey({ playMusicUrl: 'local://%2Ftest.mp3' })).toBe('/test.mp3');
    expect(getSongKey({ youtubeId: 'abc' })).toBe('yt:abc');
    expect(getSongKey({ source: 'netease', id: 999 })).toBe('netease:999');
  });
});
