/**
 * Unified Song Library (B1–B4)
 * Dexie database: 'musicManagerLibrary'
 * Lazy initialization (no top-level await to prevent white-screen TDZ).
 */
import Dexie, { type Table } from 'dexie';

import { compareFingerprints } from '../../shared/acousticFingerprint';
import { type DuplicatePair, findFingerprintDuplicatePairs } from '../../shared/duplicateDetection';

let currentTrackProvider: (() => any) | null = null;

/**
 * Registers a synchronous getter for the currently playing track (wired by audioService)
 * so `getCurrentSongKey()` works in ESM without circular imports or Node-only `require()`.
 */
export function registerCurrentTrackProvider(getter: () => any): void {
  currentTrackProvider = getter;
}

export interface Song {
  id: string; // uuid
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  normKey: string;
  youtubeId?: string;
  coverPath?: string;
  primaryColor?: string;
  backgroundColor?: string;
  /** Acoustic fingerprint (loudness envelope) used to recognise the recording. */
  fingerprint?: string;
  fingerprintDurationSec?: number;
  lastPositionSec?: number;
  lastPlayedAt?: number;
  rating?: number;
  moods?: string[];
  tags?: string[];
  artistsSplit?: string[];
  genresSplit?: string[];
  bitrateKbps?: number;
  codec?: string;
  createdAt: number;
}

export interface Variant {
  id: string;
  songId: string;
  kind: 'audio' | 'video' | 'lyrics';
  source: 'local' | 'youtube' | 'download';
  path?: string;
  url?: string;
  container?: string;
  bitrateKbps?: number;
  height?: number;
  /** Normalized codec name (h264, av01, vp9, aac, opus, …). */
  codec?: string;
  /** Exact yt-dlp format id this variant was downloaded from. */
  formatId?: string;
  sizeBytes?: number;
  addedAt: number;
}

export interface PlaybackPositionRecord {
  key: string;
  positionSec: number;
  updatedAt: number;
}

export interface WaveformCacheRecord {
  filePath: string;
  peaks: number[];
  updatedAt: number;
}

export interface SavedQueueRecord {
  id: string;
  name: string;
  trackIds: Array<string | number>;
  songs: any[];
  currentIndex: number;
  updatedAt: number;
}

export type SmartPlaylistField =
  | 'rating'
  | 'mood'
  | 'tag'
  | 'genre'
  | 'artist'
  | 'minDurationSec'
  | 'maxDurationSec'
  | 'hasVideo'
  | 'playCount';

export type SmartPlaylistOperator = 'eq' | 'gte' | 'lte' | 'includes' | 'contains';

export interface SmartPlaylistRule {
  field: SmartPlaylistField;
  operator: SmartPlaylistOperator;
  value: string | number | boolean;
}

export interface SmartPlaylistRecord {
  id: string;
  name: string;
  matchMode: 'all' | 'any';
  rules: SmartPlaylistRule[];
  sortBy?: 'recent' | 'title' | 'artist' | 'rating' | 'playCount' | 'duration';
  limit?: number;
  updatedAt: number;
}

export interface SongAnnotationRecord {
  rating: number;
  moods: string[];
  tags: string[];
}

export interface IngestTrackInput {
  path: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  bitrate?: number;
  container?: string;
  hasVideo?: boolean;
  youtubeId?: string;
  fingerprint?: string;
  fingerprintDurationSec?: number;
}

export interface IngestResult {
  songId: string;
  matched: 'exact' | 'fuzzy' | 'fingerprint' | 'new';
  candidates?: Song[];
}

export class MusicManagerLibraryDB extends Dexie {
  songs!: Table<Song, string>;
  variants!: Table<Variant, string>;
  playbackPositions!: Table<PlaybackPositionRecord, string>;
  waveforms!: Table<WaveformCacheRecord, string>;
  queues!: Table<SavedQueueRecord, string>;
  smartPlaylists!: Table<SmartPlaylistRecord, string>;

  constructor(customIndexedDB?: any) {
    super('musicManagerLibrary', customIndexedDB ? { indexedDB: customIndexedDB } : undefined);

    this.version(2).stores({
      songs: '&id, normKey, youtubeId, fingerprint, createdAt',
      variants: '&id, songId, path, kind, addedAt',
      playbackPositions: '&key, updatedAt'
    });

    this.version(3).stores({
      songs: '&id, normKey, youtubeId, fingerprint, createdAt',
      variants: '&id, songId, path, kind, addedAt',
      playbackPositions: '&key, updatedAt',
      waveforms: '&filePath, updatedAt'
    });

    this.version(4).stores({
      songs:
        '&id, normKey, youtubeId, fingerprint, createdAt, rating, *artistsSplit, *genresSplit, *moods, *tags',
      variants: '&id, songId, path, kind, addedAt',
      playbackPositions: '&key, updatedAt',
      waveforms: '&filePath, updatedAt',
      queues: '&id, updatedAt',
      smartPlaylists: '&id, updatedAt'
    });
  }
}

let dbInstance: MusicManagerLibraryDB | null = null;

export function getLibraryDB(customIndexedDB?: any): MusicManagerLibraryDB {
  if (customIndexedDB) {
    return new MusicManagerLibraryDB(customIndexedDB);
  }
  if (!dbInstance) {
    dbInstance = new MusicManagerLibraryDB();
  }
  return dbInstance;
}

export function resetLibraryDBInstance(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * UUID generator with fallback
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Strip bracketed tags such as (Official Video), (Lyrics), [HD], (Remastered 2011)
 * and featuring credits like (feat. Artist), [ft. Artist].
 */
export function stripBracketsAndTags(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Bracket keywords to strip when inside (), [], or {}
  const bracketKeywords = [
    'official\\s*video',
    'official\\s*music\\s*video',
    'official\\s*audio',
    'official\\s*lyric\\s*video',
    'official',
    'music\\s*video',
    'video',
    'audio',
    'lyrics?',
    'lyric\\s*video',
    'hd',
    'hq',
    '4k',
    '1080p',
    'remaster(?:ed)?(?:\\s*\\d+)?',
    '\\d+\\s*remaster(?:ed)?',
    'mv',
    'visualizer',
    'live(?:\\s+at\\s+.*)?',
    'clip',
    'version',
    'edit',
    'deluxe(?:\\s+edition)?',
    'bonus(?:\\s+track)?',
    'explicit',
    'clean',
    'feat\\.?',
    'ft\\.?',
    'featuring'
  ].join('|');

  const bracketRegex = new RegExp(
    `[\\(\\[\\{][^\\)\\]\\}]*?(?:${bracketKeywords})[^\\)\\]\\}]*?[\\)\\]\\}]`,
    'gi'
  );

  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(bracketRegex, ' ');
  }

  // Strip trailing hyphen/dash suffixes like "- Remastered 2011", "- Official Video", "- Lyrics"
  cleaned = cleaned.replace(
    /\s*[-–—]\s*(?:official\s*(?:video|audio|music\s*video|track)?|lyrics?|remaster(?:ed)?(?:\s*\d+)?|\d+\s*remaster(?:ed)?|hd|4k|mv|audio)\s*$/gi,
    ' '
  );

  // Strip remaining unbracketed featuring credits, e.g. "feat. Rihanna", "ft. DaBaby", "featuring Drake"
  cleaned = cleaned.replace(/\s*(?:feat\.?|ft\.?|featuring)\b.*$/gi, ' ');

  return cleaned;
}

/**
 * Remove punctuation, normalize whitespace and lowercase
 */
export function cleanString(text: string): string {
  if (!text) return '';
  const withoutBrackets = stripBracketsAndTags(text);
  // Replace punctuation characters with space
  const noPunct = withoutBrackets.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  // Collapse whitespace and trim, lowercase
  return noPunct.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Compute normalized normKey in format "artist|title"
 */
export function computeNormKey(artist: string, title: string): string {
  const normArtist = cleanString(artist || '');
  const normTitle = cleanString(title || '');
  return `${normArtist}|${normTitle}`;
}

/**
 * Token Jaccard similarity across two normKeys
 */
export function tokenJaccardSimilarity(key1: string, key2: string): number {
  const tokenize = (k: string) =>
    new Set(
      k
        .toLowerCase()
        .split(/[\s|]+/)
        .filter((tok) => tok.length > 0)
    );
  const t1 = tokenize(key1);
  const t2 = tokenize(key2);
  if (t1.size === 0 && t2.size === 0) return 1.0;
  if (t1.size === 0 || t2.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of t1) {
    if (t2.has(token)) {
      intersectionCount++;
    }
  }
  const unionCount = t1.size + t2.size - intersectionCount;
  return unionCount === 0 ? 1.0 : intersectionCount / unionCount;
}

function getExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex !== -1 && dotIndex < filePath.length - 1) {
    return filePath.slice(dotIndex + 1).toLowerCase();
  }
  return 'mp3';
}

/**
 * Ingest a local track into the unified song library.
 * Matching:
 *  - same path -> exact match to that variant
 *  - else same youtubeId -> exact match to that song
 *  - else same normKey & |duration diff| <= 3s -> merge exact match
 *  - if normKey is similar (token Jaccard >= 0.8) & |duration diff| <= 3s -> fuzzy match with candidates (do not auto-merge)
 *  - else create new Song and Variant -> 'new'
 */
export async function ingestLocalTrack(
  track: IngestTrackInput,
  options?: { forceNew?: boolean }
): Promise<IngestResult> {
  const db = getLibraryDB();

  // 1. Same path -> existing variant
  const existingVariant = await db.variants.where('path').equals(track.path).first();
  if (existingVariant) {
    return { songId: existingVariant.songId, matched: 'exact' };
  }

  // 2. Same youtubeId
  if (track.youtubeId) {
    const matchByYt = await db.songs.where('youtubeId').equals(track.youtubeId).first();
    if (matchByYt) {
      await linkVariant(matchByYt.id, {
        kind: track.hasVideo ? 'video' : 'audio',
        source: 'local',
        path: track.path,
        container: track.container || getExtension(track.path),
        bitrateKbps: track.bitrate,
        addedAt: Date.now()
      });
      return { songId: matchByYt.id, matched: 'exact' };
    }
  }

  // 3. Same normKey and |duration diff| <= 3s
  const normKey = computeNormKey(track.artist, track.title);

  // 3a. Acoustic fingerprint: recognises the same recording across qualities,
  // containers and renamed files even when metadata was rewritten.
  if (track.fingerprint) {
    const fingerprinted = await db.songs.filter((s) => Boolean(s.fingerprint)).toArray();
    let best: { song: Song; score: number } | null = null;
    for (const candidate of fingerprinted) {
      const score = compareFingerprints(candidate.fingerprint, track.fingerprint);
      if (!best || score > best.score) {
        best = { song: candidate, score };
      }
    }

    if (best && best.score >= 0.8) {
      await linkVariant(best.song.id, {
        kind: track.hasVideo ? 'video' : 'audio',
        source: 'local',
        path: track.path,
        container: track.container || getExtension(track.path),
        bitrateKbps: track.bitrate,
        addedAt: Date.now()
      });
      const updates: Partial<Song> = {};
      if (!best.song.fingerprint) updates.fingerprint = track.fingerprint;
      if (track.fingerprintDurationSec && !best.song.fingerprintDurationSec) {
        updates.fingerprintDurationSec = track.fingerprintDurationSec;
      }
      if (track.youtubeId && !best.song.youtubeId) updates.youtubeId = track.youtubeId;
      if (Object.keys(updates).length > 0) {
        await db.songs.update(best.song.id, updates);
      }
      return { songId: best.song.id, matched: 'fingerprint' };
    }
  }

  const sameKeySongs = await db.songs.where('normKey').equals(normKey).toArray();
  const exactCandidate = sameKeySongs.find((s) => Math.abs(s.durationSec - track.durationSec) <= 3);

  if (exactCandidate) {
    await linkVariant(exactCandidate.id, {
      kind: track.hasVideo ? 'video' : 'audio',
      source: 'local',
      path: track.path,
      container: track.container || getExtension(track.path),
      bitrateKbps: track.bitrate,
      addedAt: Date.now()
    });
    if (track.youtubeId && !exactCandidate.youtubeId) {
      await db.songs.update(exactCandidate.id, { youtubeId: track.youtubeId });
    }
    return { songId: exactCandidate.id, matched: 'exact' };
  }

  // 4. Fuzzy match: token Jaccard >= 0.8 and duration diff <= 3s
  if (!options?.forceNew) {
    const allSongs = await db.songs.toArray();
    const fuzzyCandidates: Song[] = [];
    for (const s of allSongs) {
      if (Math.abs(s.durationSec - track.durationSec) <= 3) {
        if (tokenJaccardSimilarity(s.normKey, normKey) >= 0.8) {
          fuzzyCandidates.push(s);
        }
      }
    }

    if (fuzzyCandidates.length > 0) {
      return {
        songId: '',
        matched: 'fuzzy',
        candidates: fuzzyCandidates
      };
    }
  }

  // 5. New song and variant
  const newSongId = generateUUID();
  const newSong: Song = {
    id: newSongId,
    title: track.title,
    artist: track.artist,
    album: track.album || '',
    durationSec: track.durationSec,
    normKey,
    youtubeId: track.youtubeId,
    fingerprint: track.fingerprint,
    fingerprintDurationSec: track.fingerprintDurationSec,
    createdAt: Date.now()
  };
  await db.songs.add(newSong);

  const newVariant: Variant = {
    id: generateUUID(),
    songId: newSongId,
    kind: track.hasVideo ? 'video' : 'audio',
    source: 'local',
    path: track.path,
    container: track.container || getExtension(track.path),
    bitrateKbps: track.bitrate,
    addedAt: Date.now()
  };
  await db.variants.add(newVariant);

  return { songId: newSongId, matched: 'new' };
}

/**
 * Link a new or existing variant to a Song record
 */
export async function linkVariant(
  songId: string,
  variant: Omit<Variant, 'id' | 'songId' | 'addedAt'> & { id?: string; addedAt?: number }
): Promise<Variant> {
  const db = getLibraryDB();
  const variantRecord: Variant = {
    id: variant.id || generateUUID(),
    songId,
    kind: variant.kind,
    source: variant.source,
    path: variant.path,
    url: variant.url,
    container: variant.container,
    bitrateKbps: variant.bitrateKbps,
    height: variant.height,
    codec: variant.codec,
    formatId: variant.formatId,
    sizeBytes: variant.sizeBytes,
    addedAt: variant.addedAt || Date.now()
  };
  await db.variants.put(variantRecord);
  return variantRecord;
}

/**
 * Merge two songs: moves all variants of dropId to keepId, carries metadata, then removes dropId
 */
export async function mergeSongs(keepId: string, dropId: string): Promise<void> {
  const db = getLibraryDB();
  const [keepSong, dropSong] = await Promise.all([db.songs.get(keepId), db.songs.get(dropId)]);
  if (!keepSong || !dropSong) return;

  const dropVariants = await db.variants.where('songId').equals(dropId).toArray();
  for (const variant of dropVariants) {
    await db.variants.update(variant.id, { songId: keepId });
  }

  const updates: Partial<Song> = {};
  if (!keepSong.youtubeId && dropSong.youtubeId) {
    updates.youtubeId = dropSong.youtubeId;
  }
  if (!keepSong.coverPath && dropSong.coverPath) {
    updates.coverPath = dropSong.coverPath;
  }
  if (
    (dropSong.lastPlayedAt ?? 0) > (keepSong.lastPlayedAt ?? 0) &&
    dropSong.lastPositionSec !== undefined
  ) {
    updates.lastPositionSec = dropSong.lastPositionSec;
    updates.lastPlayedAt = dropSong.lastPlayedAt;
  }

  if (Object.keys(updates).length > 0) {
    await db.songs.update(keepId, updates);
  }

  await db.songs.delete(dropId);
}

/**
 * Unlink (delete) a variant
 */
export async function unlinkVariant(variantId: string): Promise<void> {
  const db = getLibraryDB();
  await db.variants.delete(variantId);
}

/**
 * Retrieve a song by ID
 */
export async function getSong(songId: string): Promise<Song | undefined> {
  const db = getLibraryDB();
  return db.songs.get(songId);
}

/**
 * Retrieve all variants of a song, sorted:
 *  - video variants first, sorted by height descending
 *  - audio variants second, sorted by bitrateKbps descending
 */
export async function getVariants(songId: string): Promise<Variant[]> {
  const db = getLibraryDB();
  const list = await db.variants.where('songId').equals(songId).toArray();
  return list.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'video' ? -1 : 1;
    }
    if (a.kind === 'video') {
      return (b.height ?? 0) - (a.height ?? 0);
    }
    return (b.bitrateKbps ?? 0) - (a.bitrateKbps ?? 0);
  });
}

/**
 * Find a variant and its parent Song by file path
 */
export async function findSongByPath(
  path: string
): Promise<{ song: Song; variant: Variant } | undefined> {
  const db = getLibraryDB();
  const variant = await db.variants.where('path').equals(path).first();
  if (!variant) return undefined;
  const song = await db.songs.get(variant.songId);
  if (!song) return undefined;
  return { song, variant };
}

/**
 * Store/replace the acoustic fingerprint for a song.
 */
export async function setSongFingerprint(
  songId: string,
  fingerprint: string,
  durationSec?: number
): Promise<void> {
  const db = getLibraryDB();
  const updates: Partial<Song> = { fingerprint };
  if (typeof durationSec === 'number' && durationSec > 0) {
    updates.fingerprintDurationSec = durationSec;
  }
  await db.songs.update(songId, updates);
}

/**
 * Store a fingerprint on whichever Song owns the given file path.
 * Returns the song ID when the path is linked, otherwise undefined.
 */
export async function setFingerprintForPath(
  filePath: string,
  fingerprint: string,
  durationSec?: number
): Promise<string | undefined> {
  const match = await findSongByPath(filePath);
  if (!match) return undefined;
  await setSongFingerprint(match.song.id, fingerprint, durationSec);
  return match.song.id;
}

export type FingerprintExtractor = (
  filePath: string
) => Promise<{ fingerprint: string; durationSec: number } | null>;

/**
 * Backfill fingerprints for library songs that were added before the acoustic
 * index existed (for example downloads that are not part of a scanned folder).
 * Prefers an audio variant, then falls back to any variant with a local path.
 */
export async function backfillLibraryFingerprints(
  extract: FingerprintExtractor,
  options: { concurrency?: number } = {}
): Promise<{ indexed: number; failed: number; skipped: number }> {
  const db = getLibraryDB();
  const [songs, variants] = await Promise.all([db.songs.toArray(), db.variants.toArray()]);
  const variantsBySong = new Map<string, Variant[]>();
  for (const variant of variants) {
    if (!variant.path) continue;
    const list = variantsBySong.get(variant.songId) || [];
    list.push(variant);
    variantsBySong.set(variant.songId, list);
  }

  const queue: Array<{ songId: string; path: string }> = [];
  let skipped = 0;
  for (const song of songs) {
    if (song.fingerprint) continue;
    const candidates = variantsBySong.get(song.id) || [];
    const preferred = candidates.find((v) => v.kind === 'audio') || candidates[0];
    if (!preferred?.path) {
      skipped += 1;
      continue;
    }
    queue.push({ songId: song.id, path: preferred.path });
  }

  let indexed = 0;
  let failed = 0;
  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const result = await extract(item.path);
        if (result?.fingerprint) {
          await setSongFingerprint(item.songId, result.fingerprint, result.durationSec);
          indexed += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency ?? 2, queue.length || 1) }, worker)
  );
  return { indexed, failed, skipped };
}

/**
 * Find songs whose acoustic fingerprints identify the same recording.
 * The pair always names the record with more variants as the survivor.
 */
export async function findDuplicateRecordings(): Promise<DuplicatePair[]> {
  const db = getLibraryDB();
  const [songs, variants] = await Promise.all([db.songs.toArray(), db.variants.toArray()]);
  const variantCounts = new Map<string, number>();
  for (const variant of variants) {
    variantCounts.set(variant.songId, (variantCounts.get(variant.songId) ?? 0) + 1);
  }

  return findFingerprintDuplicatePairs(
    songs.map((song) => ({
      ...song,
      variantCount: variantCounts.get(song.id) ?? 0
    }))
  );
}

/**
 * Set or update the YouTube ID associated with a Song
 */
export async function setYoutubeId(songId: string, id: string): Promise<void> {
  const db = getLibraryDB();
  await db.songs.update(songId, { youtubeId: id });
}

/**
 * Save playback position for a song key.
 * Works for local files (paths), unified song IDs, and online keys (yt:<id>, netease:<id>).
 */
export async function savePosition(songKey: string, sec: number): Promise<void> {
  if (!songKey || typeof indexedDB === 'undefined' || !Number.isFinite(sec) || sec < 0) return;
  try {
    const db = getLibraryDB();
    const roundedSec = Math.round(sec * 100) / 100;
    const now = Date.now();

    await db.playbackPositions.put({
      key: songKey,
      positionSec: roundedSec,
      updatedAt: now
    });

    // If songKey maps to a song in songs table
    let song = await db.songs.get(songKey);
    if (!song) {
      const match = await findSongByPath(songKey);
      if (match) song = match.song;
    }
    if (song) {
      await db.songs.update(song.id, {
        lastPositionSec: roundedSec,
        lastPlayedAt: now
      });
    }
  } catch (err) {
    console.debug('[songLibrary] savePosition failed:', err);
  }
}

/**
 * Retrieve saved playback position for a song key.
 */
export async function getPosition(songKey: string): Promise<number> {
  if (!songKey || typeof indexedDB === 'undefined') return 0;
  try {
    const db = getLibraryDB();
    const rec = await db.playbackPositions.get(songKey);
    if (rec && Number.isFinite(rec.positionSec)) {
      return rec.positionSec;
    }

    let song = await db.songs.get(songKey);
    if (!song) {
      const match = await findSongByPath(songKey);
      if (match) song = match.song;
    }
    if (song && Number.isFinite(song.lastPositionSec)) {
      return song.lastPositionSec!;
    }
  } catch (err) {
    console.debug('[songLibrary] getPosition failed:', err);
  }
  return 0;
}

/**
 * Resolve a uniform song key from a song object / path / online ID.
 */
export function getSongKey(track: any): string {
  if (!track) return '';
  if (track.path) return String(track.path);
  if (track.localPath) return String(track.localPath);
  if (typeof track.playMusicUrl === 'string' && track.playMusicUrl.startsWith('local://')) {
    try {
      return decodeURIComponent(track.playMusicUrl.replace(/^local:\/\//, ''));
    } catch {
      return track.playMusicUrl.replace(/^local:\/\//, '');
    }
  }
  if (track.youtubeId) return `yt:${track.youtubeId}`;
  if (track.source === 'youtube') return `yt:${track.id}`;
  if (track.source === 'netease') return `netease:${track.id}`;
  if (
    typeof track.id === 'string' &&
    (track.id.startsWith('yt:') || track.id.startsWith('netease:'))
  ) {
    return track.id;
  }
  if (track.id !== undefined && track.id !== null) {
    return String(track.id);
  }
  return '';
}

/**
 * Helper to get the current song key from audioService
 */
export function getCurrentSongKey(trackOverride?: any): string {
  try {
    const track = trackOverride !== undefined ? trackOverride : currentTrackProvider?.();
    return getSongKey(track);
  } catch {
    return '';
  }
}

function buildProceduralWaveformFallback(filePath: string, buckets = 140): number[] {
  let hash = 2166136261;
  for (let i = 0; i < filePath.length; i += 1) {
    hash ^= filePath.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seed = (Math.abs(hash) % 97) + 13;
  return Array.from({ length: buckets }, (_, i) => {
    const val = 0.22 + 0.68 * Math.abs(Math.sin((i + 1) * seed * 0.019) * Math.cos(i * 0.07));
    return Math.round(val * 1000) / 1000;
  });
}

/**
 * Retrieves cached acoustic waveform peaks from Dexie (`waveforms` table), or
 * computes and caches them via bundled FFmpeg (`local-music:waveform-peaks`).
 */
export async function getOrComputeWaveformPeaks(
  filePath: string,
  buckets = 140,
  customIndexedDB?: any
): Promise<number[]> {
  let cleanPath = String(filePath || '').trim();
  if (!cleanPath || cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return buildProceduralWaveformFallback(cleanPath || 'stream', buckets);
  }
  if (cleanPath.startsWith('local://')) {
    try {
      cleanPath = decodeURIComponent(cleanPath.replace(/^local:\/\/\/?/, ''));
      if (/^\/[a-zA-Z]:\//.test(cleanPath)) cleanPath = cleanPath.slice(1);
    } catch {
      cleanPath = cleanPath.replace(/^local:\/\/\/?/, '');
    }
  }

  try {
    const db = getLibraryDB(customIndexedDB);
    const cached = await db.waveforms.get(cleanPath);
    if (cached && Array.isArray(cached.peaks) && cached.peaks.length === buckets) {
      return cached.peaks;
    }

    let computedPeaks: number[] | null = null;
    if (typeof window !== 'undefined' && window.api?.getWaveformPeaks) {
      computedPeaks = await window.api.getWaveformPeaks(cleanPath, buckets);
    }

    if (computedPeaks && Array.isArray(computedPeaks) && computedPeaks.length > 0) {
      await db.waveforms.put({
        filePath: cleanPath,
        peaks: computedPeaks,
        updatedAt: Date.now()
      });
      return computedPeaks;
    }
  } catch (err) {
    console.debug('[songLibrary] getOrComputeWaveformPeaks fallback:', err);
  }

  return buildProceduralWaveformFallback(cleanPath, buckets);
}

// ==================== Dexie v4 Multi-Queues, Ratings/Tags & Smart Playlists ====================

export async function saveNamedQueue(
  input: {
    id?: string;
    name: string;
    songs: any[];
    currentIndex?: number;
  },
  customIndexedDB?: any
): Promise<SavedQueueRecord> {
  const db = getLibraryDB(customIndexedDB);
  const record: SavedQueueRecord = {
    id: input.id || generateUUID(),
    name: input.name.trim() || 'Saved Queue',
    trackIds: (input.songs || []).map((s) => s?.id ?? s?.filePath ?? '').filter(Boolean),
    songs: Array.isArray(input.songs) ? input.songs.map((s) => ({ ...s })) : [],
    currentIndex: Math.max(0, Math.round(input.currentIndex ?? 0)),
    updatedAt: Date.now()
  };
  await db.queues.put(record);
  return record;
}

export async function listSavedQueues(customIndexedDB?: any): Promise<SavedQueueRecord[]> {
  if (typeof indexedDB === 'undefined' && !customIndexedDB) return [];
  const db = getLibraryDB(customIndexedDB);
  const all = await db.queues.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSavedQueue(id: string, customIndexedDB?: any): Promise<void> {
  if (!id) return;
  const db = getLibraryDB(customIndexedDB);
  await db.queues.delete(id);
}

export async function saveSmartPlaylist(
  input: {
    id?: string;
    name: string;
    matchMode?: 'all' | 'any';
    rules: SmartPlaylistRule[];
    sortBy?: SmartPlaylistRecord['sortBy'];
    limit?: number;
  },
  customIndexedDB?: any
): Promise<SmartPlaylistRecord> {
  const db = getLibraryDB(customIndexedDB);
  const record: SmartPlaylistRecord = {
    id: input.id || generateUUID(),
    name: input.name.trim() || 'Smart Playlist',
    matchMode: input.matchMode === 'any' ? 'any' : 'all',
    rules: Array.isArray(input.rules) ? input.rules.map((r) => ({ ...r })) : [],
    sortBy: input.sortBy || 'recent',
    limit: input.limit && input.limit > 0 ? Math.round(input.limit) : undefined,
    updatedAt: Date.now()
  };
  await db.smartPlaylists.put(record);
  return record;
}

export async function listSmartPlaylists(customIndexedDB?: any): Promise<SmartPlaylistRecord[]> {
  if (typeof indexedDB === 'undefined' && !customIndexedDB) return [];
  const db = getLibraryDB(customIndexedDB);
  const all = await db.smartPlaylists.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSmartPlaylist(id: string, customIndexedDB?: any): Promise<void> {
  if (!id) return;
  const db = getLibraryDB(customIndexedDB);
  await db.smartPlaylists.delete(id);
}

function cleanStringArray(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const val of values) {
    const trimmed = String(val || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export async function updateSongTagsAndRating(
  input: {
    songId?: string;
    filePath?: string;
    title?: string;
    artist?: string;
    album?: string;
    durationSec?: number;
    rating?: number;
    moods?: string[];
    tags?: string[];
  },
  customIndexedDB?: any
): Promise<Song | null> {
  const db = getLibraryDB(customIndexedDB);
  let targetSong: Song | undefined;

  if (input.songId) {
    targetSong = await db.songs.get(input.songId);
  }
  if (!targetSong && input.filePath) {
    const variants = await db.variants.where('path').equals(input.filePath).toArray();
    if (variants[0]) {
      targetSong = await db.songs.get(variants[0].songId);
    }
  }
  if (!targetSong && input.title && input.artist) {
    const nk = computeNormKey(input.artist, input.title);
    const byKey = await db.songs.where('normKey').equals(nk).toArray();
    targetSong = byKey[0];
  }

  const normalizedRating =
    typeof input.rating === 'number' && Number.isFinite(input.rating)
      ? Math.max(0, Math.min(5, Math.round(input.rating)))
      : undefined;
  const normalizedMoods = input.moods ? cleanStringArray(input.moods) : undefined;
  const normalizedTags = input.tags ? cleanStringArray(input.tags) : undefined;

  if (!targetSong) {
    if (!input.filePath && !input.title) return null;
    const newId = input.songId || generateUUID();
    const title = input.title || 'Unknown Title';
    const artist = input.artist || 'Unknown Artist';
    const newSong: Song = {
      id: newId,
      title,
      artist,
      album: input.album || '',
      durationSec: input.durationSec ?? 0,
      normKey: computeNormKey(artist, title),
      rating: normalizedRating ?? 0,
      moods: normalizedMoods ?? [],
      tags: normalizedTags ?? [],
      createdAt: Date.now()
    };
    await db.songs.put(newSong);
    if (input.filePath) {
      await db.variants.put({
        id: generateUUID(),
        songId: newId,
        kind: /\.(mp4|webm)$/i.test(input.filePath) ? 'video' : 'audio',
        source: 'local',
        path: input.filePath,
        container: getExtension(input.filePath),
        addedAt: Date.now()
      });
    }
    return newSong;
  }

  const updates: Partial<Song> = {};
  if (normalizedRating !== undefined) updates.rating = normalizedRating;
  if (normalizedMoods !== undefined) updates.moods = normalizedMoods;
  if (normalizedTags !== undefined) updates.tags = normalizedTags;
  await db.songs.update(targetSong.id, updates);
  return (await db.songs.get(targetSong.id)) || null;
}

export async function getSongAnnotationMap(customIndexedDB?: any): Promise<{
  byPath: Record<string, SongAnnotationRecord>;
  bySongId: Record<string, SongAnnotationRecord>;
}> {
  if (typeof indexedDB === 'undefined' && !customIndexedDB) {
    return { byPath: {}, bySongId: {} };
  }
  const db = getLibraryDB(customIndexedDB);
  const [songs, variants] = await Promise.all([db.songs.toArray(), db.variants.toArray()]);
  const bySongId: Record<string, SongAnnotationRecord> = {};
  const byPath: Record<string, SongAnnotationRecord> = {};

  for (const song of songs) {
    const ann: SongAnnotationRecord = {
      rating: Number(song.rating || 0),
      moods: Array.isArray(song.moods) ? song.moods : [],
      tags: Array.isArray(song.tags) ? song.tags : []
    };
    if (ann.rating > 0 || ann.moods.length > 0 || ann.tags.length > 0) {
      bySongId[song.id] = ann;
    }
  }

  for (const v of variants) {
    if (v.kind === 'lyrics' || !v.path) continue;
    const ann = bySongId[v.songId];
    if (ann) {
      byPath[v.path] = ann;
    }
  }

  return { byPath, bySongId };
}

function resolveTrackDurationSec(track: Record<string, any>): number {
  if (typeof track.durationSec === 'number' && Number.isFinite(track.durationSec)) {
    return track.durationSec;
  }
  const raw = Number(track.duration ?? track.dt ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw / 1000;
}

function resolveTrackArtists(track: Record<string, any>): string[] {
  const out: string[] = [];
  if (Array.isArray(track.artistsSplit)) out.push(...track.artistsSplit);
  if (Array.isArray(track.ar)) {
    for (const a of track.ar) if (a?.name) out.push(String(a.name));
  }
  if (Array.isArray(track.song?.artists)) {
    for (const a of track.song.artists) if (a?.name) out.push(String(a.name));
  }
  if (typeof track.artist === 'string' && track.artist) out.push(track.artist);
  return cleanStringArray(out);
}

function resolveTrackGenres(track: Record<string, any>): string[] {
  if (Array.isArray(track.genresSplit)) return cleanStringArray(track.genresSplit);
  const raw = track.genre || track.meta?.genre;
  if (typeof raw === 'string' && raw.trim()) {
    return cleanStringArray(raw.split(/\s*(?:;|,|\/|\x00)\s*/i));
  }
  return [];
}

function matchStringList(list: string[], op: SmartPlaylistOperator, target: string): boolean {
  const needle = target.trim().toLowerCase();
  if (!needle) return true;
  if (op === 'eq') {
    return list.some((item) => item.toLowerCase() === needle);
  }
  return list.some((item) => item.toLowerCase().includes(needle));
}

function matchNumberRule(actual: number, op: SmartPlaylistOperator, expected: number): boolean {
  if (!Number.isFinite(expected)) return true;
  if (op === 'gte') return actual >= expected;
  if (op === 'lte') return actual <= expected;
  return actual === expected;
}

function evaluateRule(
  track: Record<string, any>,
  rule: SmartPlaylistRule,
  playCounts?: Record<string, number>
): boolean {
  const durationSec = resolveTrackDurationSec(track);
  const trackPlayCount = Number(
    playCounts?.[String(track.id ?? '')] ??
      playCounts?.[String(track.filePath ?? track.path ?? '')] ??
      track.playCount ??
      track.plays ??
      0
  );

  switch (rule.field) {
    case 'rating':
      return matchNumberRule(Number(track.rating ?? 0), rule.operator, Number(rule.value));
    case 'playCount':
      return matchNumberRule(trackPlayCount, rule.operator, Number(rule.value));
    case 'minDurationSec':
      return rule.operator === 'lte' || rule.operator === 'eq'
        ? matchNumberRule(durationSec, rule.operator, Number(rule.value))
        : durationSec >= Number(rule.value);
    case 'maxDurationSec':
      return rule.operator === 'gte' || rule.operator === 'eq'
        ? matchNumberRule(durationSec, rule.operator, Number(rule.value))
        : durationSec <= Number(rule.value);
    case 'hasVideo': {
      const hasVideo = Boolean(
        track.videoUrl ||
          track.hasVideo ||
          /\.(mp4|webm)$/i.test(String(track.filePath || track.path || ''))
      );
      return hasVideo === Boolean(rule.value === true || rule.value === 'true');
    }
    case 'mood':
      return matchStringList(
        cleanStringArray(track.moods),
        rule.operator,
        String(rule.value ?? '')
      );
    case 'tag':
      return matchStringList(
        cleanStringArray(track.tags),
        rule.operator,
        String(rule.value ?? '')
      );
    case 'genre':
      return matchStringList(resolveTrackGenres(track), rule.operator, String(rule.value ?? ''));
    case 'artist':
      return matchStringList(resolveTrackArtists(track), rule.operator, String(rule.value ?? ''));
    default:
      return true;
  }
}

export function evaluateSmartPlaylist<T extends Record<string, any>>(
  tracks: T[],
  playlist: SmartPlaylistRecord,
  playCounts?: Record<string, number>
): T[] {
  const rules = Array.isArray(playlist.rules) ? playlist.rules : [];
  const matched =
    rules.length === 0
      ? [...tracks]
      : tracks.filter((track) => {
          if (playlist.matchMode === 'any') {
            return rules.some((rule) => evaluateRule(track, rule, playCounts));
          }
          return rules.every((rule) => evaluateRule(track, rule, playCounts));
        });

  const sortBy = playlist.sortBy || 'recent';
  matched.sort((a, b) => {
    if (sortBy === 'title') {
      return String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''));
    }
    if (sortBy === 'artist') {
      return (resolveTrackArtists(a)[0] || '').localeCompare(resolveTrackArtists(b)[0] || '');
    }
    if (sortBy === 'rating') {
      return Number(b.rating ?? 0) - Number(a.rating ?? 0);
    }
    if (sortBy === 'playCount') {
      const ca = Number(playCounts?.[String(a.id ?? '')] ?? a.playCount ?? a.plays ?? 0);
      const cb = Number(playCounts?.[String(b.id ?? '')] ?? b.playCount ?? b.plays ?? 0);
      return cb - ca;
    }
    if (sortBy === 'duration') {
      return resolveTrackDurationSec(b) - resolveTrackDurationSec(a);
    }
    return Number(b.modifiedTime ?? b.createdAt ?? 0) - Number(a.modifiedTime ?? a.createdAt ?? 0);
  });

  if (playlist.limit && playlist.limit > 0) {
    return matched.slice(0, playlist.limit);
  }
  return matched;
}
