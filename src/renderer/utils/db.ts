/**
 * IndexedDB Offline Metadata & Audio Cache (Dexie)
 * Ported from YesPlayMusic/src/utils/db.js
 * Provides sub-millisecond local retrieval of cached audio blobs, track details, lyrics, and albums.
 */
import axios from 'axios';
import Dexie, { type Table } from 'dexie';

export interface TrackSourceRecord {
  id: number | string;
  source: ArrayBuffer;
  bitRate: number;
  from: string;
  name: string;
  artist: string;
  createTime: number;
}

export interface TrackDetailRecord {
  id: number | string;
  detail: any;
  privileges: any;
  updateTime: number;
}

export interface LyricRecord {
  id: number | string;
  lyrics: any;
  updateTime: number;
}

export interface AlbumRecord {
  id: number | string;
  album: any;
  updateTime: number;
}

export class AlgerMusicDexieDB extends Dexie {
  trackSources!: Table<TrackSourceRecord, number | string>;
  trackDetail!: Table<TrackDetailRecord, number | string>;
  lyric!: Table<LyricRecord, number | string>;
  album!: Table<AlbumRecord, number | string>;

  constructor() {
    super('yesplaymusic');

    this.version(4).stores({
      trackDetail: '&id, updateTime',
      lyric: '&id, updateTime',
      album: '&id, updateTime',
      trackSources: '&id, createTime'
    });

    this.version(3)
      .stores({
        trackSources: '&id, createTime'
      })
      .upgrade((tx) =>
        tx
          .table('trackSources')
          .toCollection()
          .modify(
            (track: TrackSourceRecord) =>
              !track.createTime && (track.createTime = new Date().getTime())
          )
      );

    this.version(1).stores({
      trackSources: '&id'
    });
  }
}

const db = new AlgerMusicDexieDB();

let tracksCacheBytes = 0;
let createdBlobRecords: string[] = [];

/** Default cache limit in MB (configurable via localStorage 'dexie-cache-limit-mb', default 512MB) */
function getCacheLimitMB(): number | false {
  try {
    const raw = localStorage.getItem('dexie-cache-limit-mb');
    if (raw === 'false') return false;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 512;
  } catch {
    return 512;
  }
}

async function deleteExcessCache(): Promise<void> {
  const limitMB = getCacheLimitMB();
  if (limitMB === false || tracksCacheBytes < limitMB * Math.pow(1024, 2)) {
    return;
  }
  try {
    const delCache = await db.trackSources.orderBy('createTime').first();
    if (!delCache) return;
    await db.trackSources.delete(delCache.id);
    tracksCacheBytes -= delCache.source?.byteLength || 0;
    await deleteExcessCache();
  } catch (error) {
    console.debug('[db.ts] deleteExcessCache failed', error);
  }
}

export async function initTracksCacheBytes(): Promise<void> {
  try {
    const all = await db.trackSources.toArray();
    tracksCacheBytes = all.reduce((sum, t) => sum + (t?.source?.byteLength || 0), 0);
    await deleteExcessCache();
  } catch (err) {
    console.debug('[db.ts] initTracksCacheBytes failed', err);
  }
}

// Kick off background cache byte calculation on load
void initTracksCacheBytes();

/**
 * Convert an ArrayBuffer audio source into a playable Object URL and revoke stale Blob URLs.
 */
export function getAudioSourceBlobURL(data: ArrayBuffer): string {
  const source = URL.createObjectURL(new Blob([data]));
  for (const url of createdBlobRecords) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore revocation errors
    }
  }
  createdBlobRecords = [source];
  return source;
}

/**
 * Cache an audio track's binary ArrayBuffer and prefetch cover thumbnails in IndexedDB.
 */
export async function cacheTrackSource(
  trackInfo: any,
  url: string,
  bitRate: number = 320000,
  from: string = 'netease'
): Promise<{ trackID: number | string; source: ArrayBuffer; bitRate: number } | undefined> {
  if (!trackInfo?.id || !url || url.startsWith('local://') || url.startsWith('blob:')) {
    return undefined;
  }
  try {
    const name = trackInfo.name || 'Unknown';
    const artist =
      (trackInfo.ar && trackInfo.ar[0]?.name) ||
      (trackInfo.artists && trackInfo.artists[0]?.name) ||
      (trackInfo.song?.artists && trackInfo.song.artists[0]?.name) ||
      'Unknown';
    let cover: string | undefined = trackInfo.al?.picUrl || trackInfo.picUrl;
    if (cover && cover.startsWith('http://')) {
      cover = 'https' + cover.slice(4);
    }
    if (cover && /^https?:\/\//i.test(cover)) {
      void axios.get(`${cover}?param=512y512`).catch(() => {});
      void axios.get(`${cover}?param=224y224`).catch(() => {});
      void axios.get(`${cover}?param=1024y1024`).catch(() => {});
    }

    const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
    const id = Number.isNaN(Number(trackInfo.id)) ? trackInfo.id : Number(trackInfo.id);
    await db.trackSources.put({
      id,
      source: response.data,
      bitRate,
      from,
      name,
      artist,
      createTime: new Date().getTime()
    });
    tracksCacheBytes += response.data.byteLength;
    await deleteExcessCache();
    return { trackID: id, source: response.data, bitRate };
  } catch (error) {
    console.debug('[db.ts] cacheTrackSource failed:', error);
    return undefined;
  }
}

/**
 * Retrieve a cached audio binary source from IndexedDB in sub-millisecond time.
 */
export async function getTrackSource(
  id: number | string
): Promise<TrackSourceRecord | null> {
  try {
    const lookupId = Number.isNaN(Number(id)) ? id : Number(id);
    const track = await db.trackSources.get(lookupId);
    if (!track) return null;
    return track;
  } catch {
    return null;
  }
}

/**
 * Cache track metadata and privilege details.
 */
export function cacheTrackDetail(track: any, privileges?: any): void {
  if (!track?.id) return;
  const id = Number.isNaN(Number(track.id)) ? track.id : Number(track.id);
  void db.trackDetail
    .put({
      id,
      detail: track,
      privileges: privileges ?? track.privilege ?? null,
      updateTime: new Date().getTime()
    })
    .catch(() => {});
}

/**
 * Retrieve cached track metadata for a list of track IDs.
 */
export async function getTrackDetailFromCache(
  ids: Array<string | number>
): Promise<{ songs: any[]; privileges: any[] } | undefined> {
  try {
    const stringIds = ids.map((id) => String(id));
    const tracks = await db.trackDetail
      .filter((track) => stringIds.includes(String(track.id)))
      .toArray();
    const result: { songs: any[]; privileges: any[] } = { songs: [], privileges: [] };
    stringIds.forEach((id) => {
      const one = tracks.find((t) => String(t.id) === id);
      result.songs.push(one?.detail);
      result.privileges.push(one?.privileges);
    });
    if (result.songs.includes(undefined)) {
      return undefined;
    }
    return result;
  } catch {
    return undefined;
  }
}

/**
 * Cache raw lyric API response in IndexedDB.
 */
export function cacheLyric(id: number | string, lyrics: any): void {
  if (id === undefined || id === null || !lyrics) return;
  const lookupId = Number.isNaN(Number(id)) ? id : Number(id);
  void db.lyric
    .put({
      id: lookupId,
      lyrics,
      updateTime: new Date().getTime()
    })
    .catch(() => {});
}

/**
 * Retrieve cached raw lyric API response from IndexedDB.
 */
export async function getLyricFromCache(id: number | string): Promise<any | undefined> {
  try {
    const lookupId = Number.isNaN(Number(id)) ? id : Number(id);
    const result = await db.lyric.get(lookupId);
    if (!result) return undefined;
    return result.lyrics;
  } catch {
    return undefined;
  }
}

/**
 * Cache album details in IndexedDB.
 */
export function cacheAlbum(id: number | string, album: any): void {
  if (id === undefined || id === null || !album) return;
  const lookupId = Number.isNaN(Number(id)) ? id : Number(id);
  void db.album
    .put({
      id: lookupId,
      album,
      updateTime: new Date().getTime()
    })
    .catch(() => {});
}

/**
 * Retrieve cached album details from IndexedDB.
 */
export async function getAlbumFromCache(id: number | string): Promise<any | undefined> {
  try {
    const lookupId = Number.isNaN(Number(id)) ? id : Number(id);
    const result = await db.album.get(lookupId);
    if (!result) return undefined;
    return result.album;
  } catch {
    return undefined;
  }
}

/**
 * Compute total bytes and number of cached audio tracks in IndexedDB.
 */
export async function countDBSize(): Promise<{ bytes: number; length: number }> {
  const trackSizes: number[] = [];
  try {
    await db.trackSources.each((track) => {
      if (track?.source?.byteLength) {
        trackSizes.push(track.source.byteLength);
      }
    });
    const res = {
      bytes: trackSizes.reduce((s1, s2) => s1 + s2, 0),
      length: trackSizes.length
    };
    tracksCacheBytes = res.bytes;
    return res;
  } catch {
    return { bytes: 0, length: 0 };
  }
}

/**
 * Clear all Dexie IndexedDB tables.
 */
export function clearDB(): Promise<void> {
  return new Promise((resolve) => {
    Promise.all(db.tables.map((table) => table.clear()))
      .then(() => {
        tracksCacheBytes = 0;
        resolve();
      })
      .catch(() => resolve());
  });
}

export default db;
