/**
 * Personal Listening Stats & Wrapped Service
 * Tracks playback counts, cumulative listening duration, and scrobble history.
 */

export interface TrackStatEntry {
  id: string | number;
  name: string;
  artist: string;
  picUrl?: string;
  plays: number;
  seconds: number;
  lastPlayedAt: number;
}

export interface ArtistStatEntry {
  name: string;
  plays: number;
  seconds: number;
  picUrl?: string;
}

export interface ScrobbleLogEntry {
  id: string | number;
  name: string;
  artist: string;
  playedAt: string;
}

export interface ListeningStatsData {
  totalListenSeconds: number;
  totalPlays: number;
  tracks: Record<string, TrackStatEntry>;
  artists: Record<string, ArtistStatEntry>;
  recentScrobbles: ScrobbleLogEntry[];
}

const STORAGE_KEY = 'music_manager_listening_stats_v1';

let memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (
      typeof localStorage !== 'undefined' &&
      localStorage &&
      typeof localStorage.getItem === 'function'
    ) {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback to memory
  }
  return memoryStorage[key] ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (
      typeof localStorage !== 'undefined' &&
      localStorage &&
      typeof localStorage.setItem === 'function'
    ) {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // fallback to memory
  }
  memoryStorage[key] = value;
}

function createInitialStats(): ListeningStatsData {
  return {
    totalListenSeconds: 0,
    totalPlays: 0,
    tracks: {},
    artists: {},
    recentScrobbles: []
  };
}

function loadStats(): ListeningStatsData {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return createInitialStats();
    const parsed = JSON.parse(raw);
    return {
      totalListenSeconds: Number(parsed.totalListenSeconds) || 0,
      totalPlays: Number(parsed.totalPlays) || 0,
      tracks: parsed.tracks && typeof parsed.tracks === 'object' ? parsed.tracks : {},
      artists: parsed.artists && typeof parsed.artists === 'object' ? parsed.artists : {},
      recentScrobbles: Array.isArray(parsed.recentScrobbles) ? parsed.recentScrobbles : []
    };
  } catch (error) {
    console.warn('[listeningStatsService] Failed to parse stored stats, initializing new:', error);
    return createInitialStats();
  }
}

function saveStats(data: ListeningStatsData): void {
  try {
    setStorageItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[listeningStatsService] Failed to save stats:', error);
  }
}

function extractSongMetadata(song: any): {
  id: string | number;
  name: string;
  artist: string;
  picUrl?: string;
} {
  if (!song) {
    return { id: '', name: 'Unknown Track', artist: 'Unknown Artist', picUrl: '' };
  }

  const id = song.id ?? song._id ?? '';
  const name = song.name || song.title || 'Unknown Track';

  let artist = '';
  if (Array.isArray(song.ar) && song.ar.length > 0) {
    artist = song.ar
      .map((a: any) => a?.name)
      .filter(Boolean)
      .join(', ');
  } else if (Array.isArray(song.artists) && song.artists.length > 0) {
    artist = song.artists
      .map((a: any) => a?.name)
      .filter(Boolean)
      .join(', ');
  } else if (Array.isArray(song.song?.artists) && song.song.artists.length > 0) {
    artist = song.song.artists
      .map((a: any) => a?.name)
      .filter(Boolean)
      .join(', ');
  } else if (typeof song.artist === 'string' && song.artist.trim()) {
    artist = song.artist.trim();
  } else if (typeof song.singer === 'string' && song.singer.trim()) {
    artist = song.singer.trim();
  } else {
    artist = 'Unknown Artist';
  }

  const picUrl =
    song.al?.picUrl || song.album?.picUrl || song.picUrl || song.cover || song.pic || '';

  return { id, name, artist, picUrl };
}

/**
 * Record a single track play event (scrobble).
 */
export function recordTrackPlay(song: any): void {
  if (!song) return;
  const { id, name, artist, picUrl } = extractSongMetadata(song);
  if (!id && (!name || name === 'Unknown Track')) return;

  const data = loadStats();
  data.totalPlays += 1;

  const trackKey = String(id || `${name}::${artist}`);
  if (!data.tracks[trackKey]) {
    data.tracks[trackKey] = {
      id,
      name,
      artist,
      picUrl,
      plays: 1,
      seconds: 0,
      lastPlayedAt: Date.now()
    };
  } else {
    data.tracks[trackKey].plays += 1;
    data.tracks[trackKey].lastPlayedAt = Date.now();
    if (picUrl && !data.tracks[trackKey].picUrl) {
      data.tracks[trackKey].picUrl = picUrl;
    }
  }

  const artistKey = artist || 'Unknown Artist';
  if (!data.artists[artistKey]) {
    data.artists[artistKey] = {
      name: artistKey,
      plays: 1,
      seconds: 0,
      picUrl
    };
  } else {
    data.artists[artistKey].plays += 1;
    if (picUrl && !data.artists[artistKey].picUrl) {
      data.artists[artistKey].picUrl = picUrl;
    }
  }

  data.recentScrobbles.unshift({
    id,
    name,
    artist,
    playedAt: new Date().toISOString()
  });

  if (data.recentScrobbles.length > 200) {
    data.recentScrobbles = data.recentScrobbles.slice(0, 200);
  }

  saveStats(data);
}

/**
 * Accumulate active listening seconds for a track and its artist.
 */
export function addListeningSeconds(song: any, deltaSeconds: number): void {
  if (!song || typeof deltaSeconds !== 'number' || isNaN(deltaSeconds) || deltaSeconds <= 0) {
    return;
  }
  const { id, name, artist, picUrl } = extractSongMetadata(song);
  if (!id && (!name || name === 'Unknown Track')) return;

  const data = loadStats();
  const added = Math.round(deltaSeconds);
  if (added <= 0) return;

  data.totalListenSeconds += added;

  const trackKey = String(id || `${name}::${artist}`);
  if (!data.tracks[trackKey]) {
    data.tracks[trackKey] = {
      id,
      name,
      artist,
      picUrl,
      plays: 0,
      seconds: added,
      lastPlayedAt: Date.now()
    };
  } else {
    data.tracks[trackKey].seconds += added;
  }

  const artistKey = artist || 'Unknown Artist';
  if (!data.artists[artistKey]) {
    data.artists[artistKey] = {
      name: artistKey,
      plays: 0,
      seconds: added,
      picUrl
    };
  } else {
    data.artists[artistKey].seconds += added;
  }

  saveStats(data);
}

/**
 * Get aggregated listening stats summary for reports and Wrapped views.
 */
export function getListeningStatsSummary(): {
  totalListenSeconds: number;
  totalPlays: number;
  topTracks: TrackStatEntry[];
  topArtists: ArtistStatEntry[];
  recentScrobbles: ScrobbleLogEntry[];
} {
  const data = loadStats();

  const topTracks = Object.values(data.tracks)
    .sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays;
      return b.seconds - a.seconds;
    })
    .slice(0, 50);

  const topArtists = Object.values(data.artists)
    .sort((a, b) => {
      if (b.plays !== a.plays) return b.plays - a.plays;
      return b.seconds - a.seconds;
    })
    .slice(0, 50);

  return {
    totalListenSeconds: data.totalListenSeconds,
    totalPlays: data.totalPlays,
    topTracks,
    topArtists,
    recentScrobbles: [...data.recentScrobbles]
  };
}

/**
 * Export raw listening stats data for backup or inspection.
 */
export function exportListeningStatsRaw(): ListeningStatsData {
  return JSON.parse(JSON.stringify(loadStats()));
}

/**
 * Import and merge partial listening stats data.
 */
export function importListeningStatsRaw(data: Partial<ListeningStatsData>): void {
  if (!data || typeof data !== 'object') return;
  const current = loadStats();
  const next: ListeningStatsData = {
    totalListenSeconds:
      typeof data.totalListenSeconds === 'number' && !isNaN(data.totalListenSeconds)
        ? Math.max(0, data.totalListenSeconds)
        : current.totalListenSeconds,
    totalPlays:
      typeof data.totalPlays === 'number' && !isNaN(data.totalPlays)
        ? Math.max(0, data.totalPlays)
        : current.totalPlays,
    tracks:
      data.tracks && typeof data.tracks === 'object'
        ? { ...current.tracks, ...data.tracks }
        : current.tracks,
    artists:
      data.artists && typeof data.artists === 'object'
        ? { ...current.artists, ...data.artists }
        : current.artists,
    recentScrobbles: Array.isArray(data.recentScrobbles)
      ? [...data.recentScrobbles]
      : current.recentScrobbles
  };
  saveStats(next);
}

/**
 * Clear all listening stats data.
 */
export function clearListeningStats(): void {
  const initial = createInitialStats();
  memoryStorage = {};
  saveStats(initial);
}
