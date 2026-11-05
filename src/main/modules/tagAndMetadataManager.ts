// Multi-Source Lyrics, Artwork & Metadata Auto-Fetcher, and Local Tag / Artwork / Filename Editor
// Handles online metadata fetching (iTunes + MusicBrainz), multi-source synced lyrics (LRCLIB),
// automatic phonetic romanization (romalrc), and atomic ID3/FLAC tag writing with physical renaming.

import axios from 'axios';
import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import { app, dialog, ipcMain } from 'electron';
import type { FlacTags } from 'flac-tagger';
import { PictureType, readFlacTags, writeFlacTags } from 'flac-tagger';
import * as fs from 'fs';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import * as path from 'path';

import { generateRomanizedLyricLrc } from '../../shared/transliteration';
import { getFfmpegPath } from './youtube';

async function safeRename(
  source: string,
  target: string,
  retries = 5,
  delayMs = 200
): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await fs.promises.rename(source, target);
      return;
    } catch (err: any) {
      if ((err?.code === 'EBUSY' || err?.code === 'EPERM') && attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

async function safeReplaceFile(source: string, target: string): Promise<void> {
  try {
    await safeRename(source, target);
  } catch (renameErr) {
    try {
      await fs.promises.copyFile(source, target);
      await fs.promises.unlink(source).catch(() => {});
    } catch (copyErr) {
      throw renameErr;
    }
  }
}

/**
 */
async function writeFfmpegTags(
  filePath: string,
  payload: {
    title: string;
    artist: string;
    album: string;
    year?: string;
    genre?: string;
    lyrics?: string;
  },
  coverResolved: { buffer: Buffer; mime: string } | null
): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg || !fs.existsSync(ffmpeg)) {
    throw new Error('FFmpeg binary not available for writing tags');
  }

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const tempOut = path.join(
    dir,
    `.tmp_tag_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
  );
  let coverTemp: string | null = null;

  try {
    const args = ['-y', '-i', filePath];

    if (coverResolved) {
      const coverExt = extToMime(coverResolved.mime) === 'image/png' ? '.png' : '.jpg';
      coverTemp = path.join(
        dir,
        `.tmp_covr_${Date.now()}_${Math.random().toString(36).slice(2)}${coverExt}`
      );
      await fs.promises.writeFile(coverTemp, coverResolved.buffer);
      args.push('-i', coverTemp);
      args.push('-map', '0:a');
      args.push('-map', '1:0');
      args.push('-c', 'copy');
      args.push('-disposition:v:0', 'attached_pic');
    } else {
      args.push('-map', '0');
      args.push('-c', 'copy');
    }

    args.push('-metadata', `title=${payload.title}`);
    args.push('-metadata', `artist=${payload.artist}`);
    args.push('-metadata', `album=${payload.album}`);
    if (payload.year && payload.year.trim()) {
      args.push('-metadata', `date=${payload.year.trim()}`);
    }
    if (payload.genre && payload.genre.trim()) {
      args.push('-metadata', `genre=${payload.genre.trim()}`);
    }
    if (payload.lyrics && payload.lyrics.trim()) {
      args.push('-metadata', `lyrics=${payload.lyrics.trim()}`);
      args.push('-metadata', `©lyr=${payload.lyrics.trim()}`);
    }

    args.push(tempOut);

    const res = spawnSync(ffmpeg, args, { stdio: 'pipe' });
    if (res.status !== 0) {
      const errOut = res.stderr ? res.stderr.toString('utf8') : 'Unknown error';
      throw new Error(
        `FFmpeg tagging failed with exit code ${res.status}: ${errOut.slice(0, 300)}`
      );
    }

    await safeReplaceFile(tempOut, filePath);
  } finally {
    if (coverTemp && fs.existsSync(coverTemp)) {
      await fs.promises.unlink(coverTemp).catch(() => {});
    }
    if (fs.existsSync(tempOut)) {
      await fs.promises.unlink(tempOut).catch(() => {});
    }
  }
}

export interface LocalTrackEditPayload {
  filePath: string;
  newFileName?: string; // physical filename on disk (with or without extension)
  title: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  lyrics?: string;
  coverDataUrlOrPath?: string; // http(s) URL, data:image/... base64, local:// URL, or file path
  saveSidecarLrc?: boolean;
}

export interface MetadataOnlineResult {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  trackNumber: number;
  coverUrl: string;
  source: 'iTunes' | 'MusicBrainz';
}

export interface LyricCandidate {
  id: number | string;
  trackName: string;
  artistName: string;
  albumName: string;
  syncedLyrics: string;
  plainLyrics: string;
  source: string;
  /** Track duration reported by the lyric source (seconds). */
  duration?: number;
  /** candidate.duration minus the file's duration (seconds; negative = shorter). */
  durationDelta?: number;
  /** First lyric timestamp (seconds) — the offset at which singing starts. */
  offsetSec?: number;
  /** Last lyric timestamp (seconds) — how far the lyrics span. */
  spanSec?: number;
  /** True when the candidate's length is within 3s of the file's length. */
  durationMatch?: boolean;
}

/** First and last "[mm:ss.xx]" timestamps in an LRC string, in seconds. */
function lrcTimeBounds(lrc: string): { first: number | null; last: number | null } {
  let first: number | null = null;
  let last: number | null = null;
  const re = /\[(\d{1,3}):(\d{2})(?:[.,](\d{1,3}))?\]/g;
  for (const line of String(lrc || '').split(/\r?\n/)) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const fracRaw = (match[3] || '0').slice(0, 3).padEnd(3, '0');
      const seconds =
        parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + parseInt(fracRaw, 10) / 1000;
      if (first === null || seconds < first) first = seconds;
      if (last === null || seconds > last) last = seconds;
    }
  }
  return { first, last };
}

export interface MultiSourceLyricsResult {
  lrc: string;
  tlyric: string;
  romalrc: string;
  source: string;
  candidates: LyricCandidate[];
}

const HTTP_USER_AGENT = 'MusicManager/5.1.0 (https://github.com/music-manager)';
const REQUEST_TIMEOUT_MS = 10000;

function extToMime(extWithDot: string): string {
  const ext = extWithDot.toLowerCase().replace(/^\./, '');
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function resolveLocalUrlToFilePath(url: string): string {
  let filePath = decodeURIComponent(url.replace(/^local:\/\/\/?/, ''));
  if (/^\/[a-zA-Z]:\//.test(filePath)) {
    filePath = filePath.slice(1);
  }
  if (process.platform !== 'win32' && !filePath.startsWith('/')) {
    filePath = '/' + filePath;
  }
  return path.normalize(filePath);
}

async function resolveCoverBuffer(
  coverSource: string | undefined
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!coverSource || typeof coverSource !== 'string' || !coverSource.trim()) {
    return null;
  }

  const trimmed = coverSource.trim();

  // 1. HTTP(S) URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const response = await axios.get<ArrayBuffer>(trimmed, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': HTTP_USER_AGENT }
      });
      const rawContentType = response.headers['content-type'];
      const mime =
        typeof rawContentType === 'string'
          ? rawContentType.split(';')[0]?.trim() || 'image/jpeg'
          : 'image/jpeg';
      return { buffer: Buffer.from(response.data), mime };
    } catch (error) {
      console.warn('Failed to download online cover:', trimmed, error);
      return null;
    }
  }

  // 2. Data URL (data:image/...;base64,...)
  if (trimmed.startsWith('data:')) {
    try {
      const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1] || 'image/jpeg';
        const buffer = Buffer.from(match[2], 'base64');
        return { buffer, mime };
      }
    } catch (error) {
      console.warn('Failed to parse base64 cover:', error);
      return null;
    }
  }

  if (trimmed.startsWith('local://')) {
    try {
      const diskPath = resolveLocalUrlToFilePath(trimmed);
      if (fs.existsSync(diskPath)) {
        const buffer = await fs.promises.readFile(diskPath);
        const mime = extToMime(path.extname(diskPath));
        return { buffer, mime };
      }
    } catch (error) {
      console.warn('Failed to read local:// cover:', trimmed, error);
      return null;
    }
  }

  try {
    const normalizedPath = path.normalize(trimmed);
    if (fs.existsSync(normalizedPath)) {
      const buffer = await fs.promises.readFile(normalizedPath);
      const mime = extToMime(path.extname(normalizedPath));
      return { buffer, mime };
    }
  } catch (error) {
    console.warn('Failed to read local cover file:', trimmed, error);
  }

  return null;
}

async function fetchFromITunes(title: string, artist?: string): Promise<MetadataOnlineResult[]> {
  try {
    const term = [title, artist].filter(Boolean).join(' ').trim();
    let url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&media=music&limit=5`;
    let res = await axios.get<{ resultCount: number; results: any[] }>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'User-Agent': HTTP_USER_AGENT }
    });

    let items = res.data?.results || [];

    if (items.length === 0) {
      const stripped = title
        .replace(/\s*[\(\[][^\)\]]*(?:feat|ft|remix|version|mix)[^\)\]]*[\)\]]/gi, '')
        .trim();
      if (stripped && stripped !== title) {
        const fallbackTerm = [stripped, artist].filter(Boolean).join(' ').trim();
        url = `https://itunes.apple.com/search?term=${encodeURIComponent(fallbackTerm)}&media=music&limit=5`;
        res = await axios.get<{ resultCount: number; results: any[] }>(url, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { 'User-Agent': HTTP_USER_AGENT }
        });
        items = res.data?.results || [];
      }
    }

    return items.map((item) => {
      const rawCover: string = item.artworkUrl100 || '';
      const coverUrl = rawCover ? rawCover.replace('100x100bb', '1000x1000bb') : '';
      const year = item.releaseDate ? String(item.releaseDate).slice(0, 4) : '';

      return {
        title: item.trackName || title,
        artist: item.artistName || artist || '',
        album: item.collectionName || '',
        year,
        genre: item.primaryGenreName || '',
        trackNumber: typeof item.trackNumber === 'number' ? item.trackNumber : 1,
        coverUrl,
        source: 'iTunes' as const
      };
    });
  } catch (err: any) {
    console.warn('iTunes metadata search failed:', err?.message || err);
    return [];
  }
}

async function fetchFromMusicBrainz(
  title: string,
  artist?: string
): Promise<MetadataOnlineResult[]> {
  try {
    const cleanTitle = title
      .replace(/[+\-!(){}\[\]^"~*?:\\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanArtist = (artist || '')
      .replace(/[+\-!(){}\[\]^"~*?:\\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let query = `recording:"${cleanTitle || title}"`;
    if (cleanArtist) {
      query += ` AND artist:"${cleanArtist}"`;
    }

    const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(
      query
    )}&fmt=json&limit=5`;
    const res = await axios.get<{ recordings?: any[] }>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': HTTP_USER_AGENT,
        Accept: 'application/json'
      }
    });

    const recordings = res.data?.recordings || [];
    return recordings.map((rec) => {
      const recTitle: string = rec.title || title;
      const artistCredit =
        rec['artist-credit']?.[0]?.name || rec['artist-credit']?.[0]?.artist?.name || artist || '';
      const firstRelease = rec.releases?.[0];
      const recAlbum: string = firstRelease?.title || '';
      const recYear: string =
        firstRelease?.date?.slice(0, 4) || rec['first-release-date']?.slice(0, 4) || '';
      const recGenre: string = rec.tags?.[0]?.name || '';
      const releaseId: string | undefined = firstRelease?.id;
      const coverUrl = releaseId
        ? `https://coverartarchive.org/release/${releaseId}/front-500`
        : '';

      return {
        title: recTitle,
        artist: artistCredit,
        album: recAlbum,
        year: recYear,
        genre: recGenre,
        trackNumber: 1,
        coverUrl,
        source: 'MusicBrainz' as const
      };
    });
  } catch (err: any) {
    console.warn('MusicBrainz metadata search failed:', err?.message || err);
    return [];
  }
}

/**
 */
export function generateM3u8Content(
  tracks: Array<{ filePath: string; title?: string; artist?: string; duration?: number }>
): string {
  const lines: string[] = ['#EXTM3U'];
  for (const track of tracks || []) {
    if (!track || !track.filePath) continue;
    const durationSec = Math.round((track.duration || 0) / 1000);
    const artist = track.artist || 'Unknown Artist';
    const title = track.title || path.basename(track.filePath);
    lines.push(`#EXTINF:${durationSec},${artist} - ${title}`);
    lines.push(track.filePath);
  }
  return lines.join('\n');
}

/**
 */
export function parseM3u8Content(content: string, baseDir?: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const cleanContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = cleanContent.split(/\r?\n/);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    if (
      (line.startsWith('"') && line.endsWith('"')) ||
      (line.startsWith("'") && line.endsWith("'"))
    ) {
      line = line.slice(1, -1).trim();
    }

    if (line.startsWith('file://')) {
      try {
        const fileUrl = new URL(line);
        line = decodeURIComponent(fileUrl.pathname);
        if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(line)) {
          line = line.slice(1);
        }
      } catch {
        line = line.replace(/^file:\/\/\/?/, '');
      }
    }

    let resolvedPath: string;
    if (path.isAbsolute(line)) {
      resolvedPath = path.normalize(line);
    } else if (baseDir && baseDir.trim()) {
      resolvedPath = path.resolve(baseDir.trim(), line);
    } else {
      resolvedPath = path.resolve(line);
    }

    const dedupeKey = process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      result.push(resolvedPath);
    }
  }

  return result;
}

/**
 */
export function initializeTagAndMetadataManager(): void {
  // Remove a single downloaded/local variant file from disk.
  ipcMain.handle('library:delete-variant-file', async (_, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: true, deleted: false };
      }
      await fs.promises.unlink(filePath);
      return { ok: true, deleted: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle(
    'metadata:fetch-online',
    async (
      _,
      params: { title: string; artist?: string; album?: string }
    ): Promise<{ results: MetadataOnlineResult[] }> => {
      const { title, artist } = params || {};
      if (!title || !title.trim()) {
        return { results: [] };
      }

      const [itunesRes, mbRes] = await Promise.allSettled([
        fetchFromITunes(title.trim(), artist?.trim()),
        fetchFromMusicBrainz(title.trim(), artist?.trim())
      ]);

      const itunesList = itunesRes.status === 'fulfilled' ? itunesRes.value : [];
      const mbList = mbRes.status === 'fulfilled' ? mbRes.value : [];

      const combined = [...itunesList, ...mbList];
      return { results: combined };
    }
  );

  ipcMain.handle(
    'lyrics:fetch-multi-source',
    async (
      _,
      params: {
        title: string;
        artist?: string;
        album?: string;
        durationSec?: number;
      }
    ): Promise<MultiSourceLyricsResult> => {
      const { title, artist, durationSec } = params || {};
      if (!title || !title.trim()) {
        return {
          lrc: '',
          tlyric: '',
          romalrc: '',
          source: 'LRCLIB',
          candidates: []
        };
      }

      try {
        const queryTerm = [title, artist].filter(Boolean).join(' ').trim();
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(queryTerm)}`;
        const res = await axios.get<any[]>(url, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { 'User-Agent': HTTP_USER_AGENT }
        });

        const rawList = Array.isArray(res.data) ? res.data : [];
        const candidates: Array<LyricCandidate & { duration?: number }> = rawList.map((item) => {
          const duration = typeof item.duration === 'number' ? item.duration : 0;
          const bounds = lrcTimeBounds(item.syncedLyrics || '');
          const durationDelta =
            durationSec && durationSec > 0 && duration > 0 ? duration - durationSec : undefined;
          return {
            id: item.id,
            trackName: item.trackName || item.name || '',
            artistName: item.artistName || '',
            albumName: item.albumName || '',
            syncedLyrics: item.syncedLyrics || '',
            plainLyrics: item.plainLyrics || '',
            duration,
            durationDelta,
            offsetSec: bounds.first ?? undefined,
            spanSec: bounds.last ?? undefined,
            durationMatch:
              typeof durationDelta === 'number' ? Math.abs(durationDelta) <= 3 : undefined,
            source: 'LRCLIB'
          };
        });

        candidates.sort((a, b) => {
          const aSynced = Boolean(a.syncedLyrics);
          const bSynced = Boolean(b.syncedLyrics);
          if (aSynced !== bSynced) return aSynced ? -1 : 1;

          if (durationSec && durationSec > 0 && a.duration && b.duration) {
            const aDiff = Math.abs(a.duration - durationSec);
            const bDiff = Math.abs(b.duration - durationSec);
            if (Math.abs(aDiff - bDiff) > 3) {
              return aDiff - bDiff;
            }
          }
          return 0;
        });

        const best = candidates[0] || null;
        const lrc = best ? best.syncedLyrics || best.plainLyrics || '' : '';
        const romalrc = lrc ? generateRomanizedLyricLrc(lrc) : '';

        return {
          lrc,
          tlyric: '',
          romalrc,
          source: 'LRCLIB',
          candidates: candidates.map((c) => ({
            id: c.id,
            trackName: c.trackName,
            artistName: c.artistName,
            albumName: c.albumName,
            syncedLyrics: c.syncedLyrics,
            plainLyrics: c.plainLyrics,
            duration: c.duration,
            durationDelta: c.durationDelta,
            offsetSec: c.offsetSec,
            spanSec: c.spanSec,
            durationMatch: c.durationMatch,
            source: 'LRCLIB'
          }))
        };
      } catch (err: any) {
        console.warn('LRCLIB search failed:', err?.message || err);
        return {
          lrc: '',
          tlyric: '',
          romalrc: '',
          source: 'LRCLIB',
          candidates: []
        };
      }
    }
  );

  ipcMain.handle(
    'local-music:update-tags-and-file',
    async (
      _,
      payload: LocalTrackEditPayload
    ): Promise<{ ok: boolean; updatedEntry?: any; error?: string }> => {
      try {
        const { filePath } = payload;
        if (!filePath || !fs.existsSync(filePath)) {
          return { ok: false, error: `Audio file not found: ${filePath}` };
        }

        const ext = path.extname(filePath).toLowerCase();

        const coverResolved = await resolveCoverBuffer(payload.coverDataUrlOrPath);

        if (ext === '.mp3') {
          const id3Tags: NodeID3.Tags = {
            title: payload.title,
            artist: payload.artist,
            album: payload.album
          };

          if (payload.year && payload.year.trim()) {
            id3Tags.year = payload.year.trim();
          }
          if (payload.genre && payload.genre.trim()) {
            id3Tags.genre = payload.genre.trim();
          }
          if (payload.lyrics && payload.lyrics.trim()) {
            id3Tags.unsynchronisedLyrics = {
              language: 'eng',
              text: payload.lyrics.trim()
            };
          }
          if (coverResolved) {
            id3Tags.image = {
              mime: coverResolved.mime,
              type: { id: 3, name: 'front cover' },
              description: 'Cover',
              imageBuffer: coverResolved.buffer
            };
          }

          await NodeID3.Promise.update(id3Tags, filePath);
        } else if (ext === '.flac') {
          const existing: Partial<FlacTags> = await readFlacTags(filePath).catch(() => ({
            tagMap: {}
          }));
          const tagMap: Record<string, string[] | string> = {
            ...(existing.tagMap || {})
          };

          tagMap['TITLE'] = payload.title;
          tagMap['ARTIST'] = payload.artist;
          tagMap['ALBUM'] = payload.album;

          if (payload.year && payload.year.trim()) {
            tagMap['DATE'] = payload.year.trim();
          }
          if (payload.genre && payload.genre.trim()) {
            tagMap['GENRE'] = payload.genre.trim();
          }
          if (payload.lyrics && payload.lyrics.trim()) {
            tagMap['LYRICS'] = payload.lyrics.trim();
            tagMap['UNSYNCEDLYRICS'] = payload.lyrics.trim();
          }

          const flacTags: FlacTags = { tagMap };

          if (coverResolved) {
            flacTags.picture = {
              buffer: coverResolved.buffer,
              pictureType: PictureType.FrontCover,
              mime: coverResolved.mime
            };
          } else if (existing.picture) {
            flacTags.picture = existing.picture;
          }

          await writeFlacTags(flacTags, filePath);
        } else if (
          ext === '.m4a' ||
          ext === '.mp4' ||
          ext === '.opus' ||
          ext === '.ogg' ||
          ext === '.wav' ||
          ext === '.webm'
        ) {
          await writeFfmpegTags(
            filePath,
            {
              title: payload.title,
              artist: payload.artist,
              album: payload.album,
              year: payload.year,
              genre: payload.genre,
              lyrics: payload.lyrics
            },
            coverResolved
          );
        }

        if (payload.saveSidecarLrc !== false && payload.lyrics?.trim()) {
          const sidecarLrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
          await fs.promises.writeFile(sidecarLrcPath, payload.lyrics.trim(), 'utf8');
        }

        let finalPath = filePath;
        if (payload.newFileName && payload.newFileName.trim()) {
          const origExt = path.extname(filePath);
          let sanitized = payload.newFileName
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, ' ');

          if (!sanitized.toLowerCase().endsWith(origExt.toLowerCase())) {
            sanitized += origExt;
          }

          const currentBase = path.basename(filePath);
          if (sanitized !== currentBase) {
            const dir = path.dirname(filePath);
            const targetPath = path.join(dir, sanitized);

            if (targetPath.toLowerCase() !== filePath.toLowerCase() && fs.existsSync(targetPath)) {
              return {
                ok: false,
                error: `Target file name already exists: ${sanitized}`
              };
            }

            await safeRename(filePath, targetPath);

            const oldLrc = filePath.replace(/\.[^.]+$/, '.lrc');
            const newLrc = targetPath.replace(/\.[^.]+$/, '.lrc');
            if (fs.existsSync(oldLrc)) {
              await safeRename(oldLrc, newLrc);
            }

            finalPath = targetPath;
          }
        }

        const coverDir = path.join(app.getPath('userData'), 'AudioCovers');
        await fs.promises.mkdir(coverDir, { recursive: true });
        const hash = crypto.createHash('sha256').update(finalPath).digest('hex');
        let coverPath: string | null = null;

        if (coverResolved) {
          const cachedCoverFile = path.join(coverDir, `${hash}.jpg`);
          await fs.promises.writeFile(cachedCoverFile, coverResolved.buffer);
          coverPath = cachedCoverFile;
        } else {
          const possibleJpg = path.join(coverDir, `${hash}.jpg`);
          const possiblePng = path.join(coverDir, `${hash}.png`);
          if (fs.existsSync(possibleJpg)) {
            coverPath = possibleJpg;
          } else if (fs.existsSync(possiblePng)) {
            coverPath = possiblePng;
          }
        }

        const stat = await fs.promises.stat(finalPath);
        let duration = 0;
        try {
          const parsed = await mm.parseFile(finalPath);
          duration = parsed.format.duration ? Math.round(parsed.format.duration * 1000) : 0;
        } catch {
          // Ignore a partially written tag
        }

        const updatedEntry = {
          filePath: finalPath,
          title: payload.title,
          artist: payload.artist,
          album: payload.album,
          duration,
          coverPath,
          lyrics: payload.lyrics ?? null,
          fileSize: stat.size,
          modifiedTime: stat.mtimeMs
        };

        return { ok: true, updatedEntry };
      } catch (err: any) {
        console.error('Failed to update local music metadata: ', err);
        return { ok: false, error: err?.message || 'Failed to update tags' };
      }
    }
  );

  ipcMain.handle(
    'local-music:save-synced-lyrics',
    async (
      _,
      params: { filePath: string; lyrics: string; saveSidecar?: boolean }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { filePath, lyrics, saveSidecar = true } = params || {};
        if (!filePath || !fs.existsSync(filePath)) {
          return { ok: false, error: `Audio file does not exist: ${filePath}` };
        }
        if (!lyrics || !lyrics.trim()) {
          return { ok: false, error: 'Lyrics content cannot be empty' };
        }

        const trimmed = lyrics.trim();
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.mp3') {
          await NodeID3.Promise.update(
            {
              unsynchronisedLyrics: {
                language: 'eng',
                text: trimmed
              }
            },
            filePath
          );
        } else if (ext === '.flac') {
          const existing = await readFlacTags(filePath).catch(() => ({ tagMap: {} }));
          const tagMap: Record<string, string[] | string> = {
            ...(existing.tagMap || {}),
            LYRICS: trimmed,
            UNSYNCEDLYRICS: trimmed
          };
          await writeFlacTags({ tagMap, picture: (existing as any).picture }, filePath);
        } else if (
          ext === '.m4a' ||
          ext === '.mp4' ||
          ext === '.opus' ||
          ext === '.ogg' ||
          ext === '.wav'
        ) {
          const meta = await mm.parseFile(filePath).catch(() => null);
          const title = meta?.common.title || path.basename(filePath, ext);
          const artist = meta?.common.artist || '';
          const album = meta?.common.album || '';
          await writeFfmpegTags(
            filePath,
            {
              title,
              artist,
              album,
              lyrics: trimmed
            },
            null
          );
        }

        if (saveSidecar) {
          const sidecarLrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
          await fs.promises.writeFile(sidecarLrcPath, trimmed, 'utf8');
        }

        return { ok: true };
      } catch (err: any) {
        console.error('Failed to save synced lyrics:', err);
        return { ok: false, error: err?.message || 'Failed to save synced lyrics' };
      }
    }
  );

  ipcMain.handle(
    'local-music:select-cover-file',
    async (): Promise<{
      canceled: boolean;
      filePath: string | null;
      dataUrl: string | null;
    }> => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Choose cover image',
          properties: ['openFile'],
          filters: [
            {
              name: 'Image file',
              extensions: ['jpg', 'jpeg', 'png', 'webp']
            }
          ]
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { canceled: true, filePath: null, dataUrl: null };
        }

        const selectedPath = result.filePaths[0];
        const buffer = await fs.promises.readFile(selectedPath);
        const mime = extToMime(path.extname(selectedPath));
        const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

        return {
          canceled: false,
          filePath: selectedPath,
          dataUrl
        };
      } catch (err: any) {
        console.error('Failed to choose cover image:', err);
        return { canceled: true, filePath: null, dataUrl: null };
      }
    }
  );

  ipcMain.handle(
    'library:export-m3u8',
    async (
      _,
      params: {
        tracks: Array<{ filePath: string; title?: string; artist?: string; duration?: number }>;
        defaultName?: string;
      }
    ): Promise<{ ok?: boolean; canceled?: boolean; filePath?: string; error?: string }> => {
      try {
        const { tracks = [], defaultName } = params || {};
        const result = await dialog.showSaveDialog({
          defaultPath: defaultName || 'playlist.m3u8',
          filters: [{ name: 'M3U8 Playlist', extensions: ['m3u8', 'm3u'] }]
        });

        if (result.canceled || !result.filePath) {
          return { canceled: true };
        }

        const m3u8Content = generateM3u8Content(tracks);
        await fs.promises.writeFile(result.filePath, m3u8Content, 'utf8');

        return { ok: true, filePath: result.filePath };
      } catch (err: any) {
        console.error('Failed to export M3U8 playlist:', err);
        return { ok: false, error: err?.message || 'Failed to export playlist' };
      }
    }
  );

  ipcMain.handle(
    'library:import-m3u8',
    async (): Promise<{
      ok?: boolean;
      canceled?: boolean;
      filePaths?: string[];
      playlistFilePath?: string;
      error?: string;
    }> => {
      try {
        const result = await dialog.showOpenDialog({
          filters: [{ name: 'M3U / M3U8 Playlist', extensions: ['m3u8', 'm3u'] }],
          properties: ['openFile']
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return { canceled: true, filePaths: [] };
        }

        const selectedFile = result.filePaths[0];
        const content = await fs.promises.readFile(selectedFile, 'utf8');
        const parsed = parseM3u8Content(content, path.dirname(selectedFile));
        const filePaths = parsed.filter((p) => fs.existsSync(p));

        return {
          ok: true,
          filePaths,
          playlistFilePath: selectedFile
        };
      } catch (err: any) {
        console.error('Failed to import M3U8 playlist:', err);
        return { ok: false, filePaths: [], error: err?.message || 'Failed to import playlist' };
      }
    }
  );

  ipcMain.handle(
    'library:export-backup-json',
    async (
      _,
      params: {
        payload: Record<string, any>;
        defaultName?: string;
      }
    ): Promise<{ ok?: boolean; canceled?: boolean; filePath?: string; error?: string }> => {
      try {
        const { payload = {}, defaultName } = params || {};
        const result = await dialog.showSaveDialog({
          defaultPath: defaultName || 'music-manager-backup.json',
          filters: [{ name: 'JSON Backup', extensions: ['json'] }]
        });

        if (result.canceled || !result.filePath) {
          return { canceled: true };
        }

        const backupData = {
          app: 'Music Manager',
          exportedAt: new Date().toISOString(),
          ...payload
        };

        await fs.promises.writeFile(result.filePath, JSON.stringify(backupData, null, 2), 'utf8');

        return { ok: true, filePath: result.filePath };
      } catch (err: any) {
        console.error('Failed to export JSON backup:', err);
        return { ok: false, error: err?.message || 'Failed to export backup' };
      }
    }
  );

  ipcMain.handle(
    'library:import-backup-json',
    async (): Promise<{
      ok?: boolean;
      canceled?: boolean;
      data?: any;
      filePath?: string;
      error?: string;
    }> => {
      try {
        const result = await dialog.showOpenDialog({
          filters: [{ name: 'JSON Backup', extensions: ['json'] }],
          properties: ['openFile']
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return { canceled: true };
        }

        const selectedFile = result.filePaths[0];
        const content = await fs.promises.readFile(selectedFile, 'utf8');
        const parsedJson = JSON.parse(content);

        return {
          ok: true,
          data: parsedJson,
          filePath: selectedFile
        };
      } catch (err: any) {
        console.error('Failed to import JSON backup:', err);
        return { ok: false, error: err?.message || 'Failed to import backup' };
      }
    }
  );
}
