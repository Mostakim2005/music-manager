// Multi-Source Lyrics, Artwork & Metadata Auto-Fetcher, and Local Tag / Artwork / Filename Editor
// Handles online metadata fetching (iTunes + MusicBrainz), multi-source synced lyrics (LRCLIB),
// automatic phonetic romanization (romalrc), and atomic ID3/FLAC tag writing with physical renaming.

import axios from 'axios';
import * as crypto from 'crypto';
import { app, dialog, ipcMain } from 'electron';
import type { FlacTags } from 'flac-tagger';
import { PictureType, readFlacTags, writeFlacTags } from 'flac-tagger';
import * as fs from 'fs';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import * as path from 'path';

import { generateRomanizedLyricLrc } from '../../shared/transliteration';

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

/** 从文件扩展名推断 MIME 类型 */
function extToMime(extWithDot: string): string {
  const ext = extWithDot.toLowerCase().replace(/^\./, '');
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** 规范化 local:// 协议 URL 还原为本地文件路径 */
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

/** 将封面来源解析为 Buffer */
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
      console.warn('下载在线封面失败:', trimmed, error);
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
      console.warn('解析 base64 封面失败:', error);
      return null;
    }
  }

  // 3. local:// 协议 URL
  if (trimmed.startsWith('local://')) {
    try {
      const diskPath = resolveLocalUrlToFilePath(trimmed);
      if (fs.existsSync(diskPath)) {
        const buffer = await fs.promises.readFile(diskPath);
        const mime = extToMime(path.extname(diskPath));
        return { buffer, mime };
      }
    } catch (error) {
      console.warn('读取 local:// 协议封面失败:', trimmed, error);
      return null;
    }
  }

  // 4. 普通本地文件路径
  try {
    const normalizedPath = path.normalize(trimmed);
    if (fs.existsSync(normalizedPath)) {
      const buffer = await fs.promises.readFile(normalizedPath);
      const mime = extToMime(path.extname(normalizedPath));
      return { buffer, mime };
    }
  } catch (error) {
    console.warn('读取本地封面文件失败:', trimmed, error);
  }

  return null;
}

/** 查询 iTunes Search API */
async function fetchFromITunes(
  title: string,
  artist?: string
): Promise<MetadataOnlineResult[]> {
  try {
    const term = [title, artist].filter(Boolean).join(' ').trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&media=music&limit=5`;
    const res = await axios.get<{ resultCount: number; results: any[] }>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'User-Agent': HTTP_USER_AGENT }
    });

    const items = res.data?.results || [];
    return items.map((item) => {
      const rawCover: string = item.artworkUrl100 || '';
      // 提取 1000x1000 高清大图
      const coverUrl = rawCover
        ? rawCover.replace('100x100bb', '1000x1000bb')
        : '';
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

/** 查询 MusicBrainz API + Cover Art Archive */
async function fetchFromMusicBrainz(
  title: string,
  artist?: string
): Promise<MetadataOnlineResult[]> {
  try {
    let query = `recording:"${title}"`;
    if (artist && artist.trim()) {
      query += ` AND artist:"${artist.trim()}"`;
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
        rec['artist-credit']?.[0]?.name ||
        rec['artist-credit']?.[0]?.artist?.name ||
        artist ||
        '';
      const firstRelease = rec.releases?.[0];
      const recAlbum: string = firstRelease?.title || '';
      const recYear: string =
        firstRelease?.date?.slice(0, 4) ||
        rec['first-release-date']?.slice(0, 4) ||
        '';
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
 * 生成符合 M3U8 标准规范的播放列表文件内容 (UTF-8)
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
 * 解析 M3U / M3U8 文件内容并提取去重后的有效绝对路径
 */
export function parseM3u8Content(content: string, baseDir?: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // 剔除可能存在的 UTF-8 BOM
  const cleanContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = cleanContent.split(/\r?\n/);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    // 去除双引号或单引号包裹
    if (
      (line.startsWith('"') && line.endsWith('"')) ||
      (line.startsWith("'") && line.endsWith("'"))
    ) {
      line = line.slice(1, -1).trim();
    }

    // 处理 file:// 协议本地文件路径
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
 * 初始化音频元数据与标签管理模块
 */
export function initializeTagAndMetadataManager(): void {
  // 1. 在线元数据与封面检索
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

      const itunesList =
        itunesRes.status === 'fulfilled' ? itunesRes.value : [];
      const mbList = mbRes.status === 'fulfilled' ? mbRes.value : [];

      // iTunes 结果优先（封面高清且命中率高），MusicBrainz 补充
      const combined = [...itunesList, ...mbList];
      return { results: combined };
    }
  );

  // 2. 多源歌词检索（LRCLIB 全球开源歌词库 + 自动生成罗马音音译）
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
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(
          queryTerm
        )}`;
        const res = await axios.get<any[]>(url, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { 'User-Agent': HTTP_USER_AGENT }
        });

        const rawList = Array.isArray(res.data) ? res.data : [];
        const candidates: Array<LyricCandidate & { duration?: number }> =
          rawList.map((item) => ({
            id: item.id,
            trackName: item.trackName || item.name || '',
            artistName: item.artistName || '',
            albumName: item.albumName || '',
            syncedLyrics: item.syncedLyrics || '',
            plainLyrics: item.plainLyrics || '',
            duration: typeof item.duration === 'number' ? item.duration : 0,
            source: 'LRCLIB'
          }));

        // 排序规则：优先有时间轴歌词的候选项；如果有传入时长，优先匹配误差在 5 秒内的条目
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
        // 自动为日语假名和孟加拉语歌词生成罗马音音轨 (romalrc)
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

  // 3. 本地音频标签更新、内嵌封面写入、侧车歌词落盘与物理文件重命名
  ipcMain.handle(
    'local-music:update-tags-and-file',
    async (
      _,
      payload: LocalTrackEditPayload
    ): Promise<{ ok: boolean; updatedEntry?: any; error?: string }> => {
      try {
        const { filePath } = payload;
        if (!filePath || !fs.existsSync(filePath)) {
          return { ok: false, error: `音频文件不存在: ${filePath}` };
        }

        const ext = path.extname(filePath).toLowerCase();

        // 1. 解析传入封面（HTTP URL / base64 DataURL / local:// / 本地文件路径）
        const coverResolved = await resolveCoverBuffer(
          payload.coverDataUrlOrPath
        );

        // 2. 根据文件格式写入 ID3v2 / FLAC Vorbis 标签
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
        }

        // 3. 写入同名侧车 .lrc 文件（默认为 true）
        if (payload.saveSidecarLrc !== false && payload.lyrics?.trim()) {
          const sidecarLrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
          await fs.promises.writeFile(
            sidecarLrcPath,
            payload.lyrics.trim(),
            'utf8'
          );
        }

        // 4. 物理文件重命名（若提供了 newFileName 且与当前文件名不同）
        let finalPath = filePath;
        if (payload.newFileName && payload.newFileName.trim()) {
          const origExt = path.extname(filePath);
          let sanitized = payload.newFileName
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, ' ');

          // 保持原文件扩展名
          if (!sanitized.toLowerCase().endsWith(origExt.toLowerCase())) {
            sanitized += origExt;
          }

          const currentBase = path.basename(filePath);
          if (sanitized !== currentBase) {
            const dir = path.dirname(filePath);
            const targetPath = path.join(dir, sanitized);

            if (
              targetPath.toLowerCase() !== filePath.toLowerCase() &&
              fs.existsSync(targetPath)
            ) {
              return {
                ok: false,
                error: `目标文件名已存在: ${sanitized}`
              };
            }

            await fs.promises.rename(filePath, targetPath);

            // 同时迁移同名 sidecar .lrc 文件
            const oldLrc = filePath.replace(/\.[^.]+$/, '.lrc');
            const newLrc = targetPath.replace(/\.[^.]+$/, '.lrc');
            if (fs.existsSync(oldLrc)) {
              await fs.promises.rename(oldLrc, newLrc);
            }

            finalPath = targetPath;
          }
        }

        // 5. 将封面缓存落盘到 userData/AudioCovers/<sha256>.jpg，保证本地音乐库立即刷新显示
        const coverDir = path.join(app.getPath('userData'), 'AudioCovers');
        await fs.promises.mkdir(coverDir, { recursive: true });
        const hash = crypto
          .createHash('sha256')
          .update(finalPath)
          .digest('hex');
        let coverPath: string | null = null;

        if (coverResolved) {
          const cachedCoverFile = path.join(coverDir, `${hash}.jpg`);
          await fs.promises.writeFile(cachedCoverFile, coverResolved.buffer);
          coverPath = cachedCoverFile;
        } else {
          // 查找是否已存在该文件的封面缓存
          const possibleJpg = path.join(coverDir, `${hash}.jpg`);
          const possiblePng = path.join(coverDir, `${hash}.png`);
          if (fs.existsSync(possibleJpg)) {
            coverPath = possibleJpg;
          } else if (fs.existsSync(possiblePng)) {
            coverPath = possiblePng;
          }
        }

        // 6. 重新解析文件时长与大小以返回完整的 LocalMusicMeta
        const stat = await fs.promises.stat(finalPath);
        let duration = 0;
        try {
          const parsed = await mm.parseFile(finalPath);
          duration = parsed.format.duration
            ? Math.round(parsed.format.duration * 1000)
            : 0;
        } catch {
          // 忽略格式解析错误
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
        console.error('更新本地音乐元数据失败:', err);
        return { ok: false, error: err?.message || '更新标签失败' };
      }
    }
  );

  // 4. 打开对话框选择本地封面图片并返回 Data URL
  ipcMain.handle(
    'local-music:select-cover-file',
    async (): Promise<{
      canceled: boolean;
      filePath: string | null;
      dataUrl: string | null;
    }> => {
      try {
        const result = await dialog.showOpenDialog({
          title: '选择封面图片',
          properties: ['openFile'],
          filters: [
            {
              name: '图片文件',
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
        console.error('选择封面图片失败:', err);
        return { canceled: true, filePath: null, dataUrl: null };
      }
    }
  );

  // 5. 导出 M3U8 播放列表
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
        console.error('导出 M3U8 播放列表失败:', err);
        return { ok: false, error: err?.message || '导出播放列表失败' };
      }
    }
  );

  // 6. 导入 M3U / M3U8 播放列表
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
        console.error('导入 M3U8 播放列表失败:', err);
        return { ok: false, filePaths: [], error: err?.message || '导入播放列表失败' };
      }
    }
  );

  // 7. 导出完整音乐库 JSON 备份
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

        await fs.promises.writeFile(
          result.filePath,
          JSON.stringify(backupData, null, 2),
          'utf8'
        );

        return { ok: true, filePath: result.filePath };
      } catch (err: any) {
        console.error('导出 JSON 备份失败:', err);
        return { ok: false, error: err?.message || '导出备份失败' };
      }
    }
  );

  // 8. 导入完整音乐库 JSON 备份
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
        console.error('导入 JSON 备份失败:', err);
        return { ok: false, error: err?.message || '导入备份失败' };
      }
    }
  );
}
