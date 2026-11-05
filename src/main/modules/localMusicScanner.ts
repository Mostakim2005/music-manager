import * as crypto from 'crypto';
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as mm from 'music-metadata';
import * as os from 'os';
import * as path from 'path';

import { computeAudioFingerprint } from './audioFingerprint';

const SUPPORTED_AUDIO_FORMATS = [
  '.mp3',
  '.flac',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.opus',
  '.mp4',
  '.webm'
] as const;
const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '$RECYCLE.BIN',
  'System Volume Information'
]);
const METADATA_PARSE_CONCURRENCY = Math.min(8, Math.max(2, os.cpus().length));
const MAX_COVER_BYTES = 8 * 1024 * 1024;

const COVER_DIR_NAME = 'AudioCovers';
let cachedCoverDir: string | null = null;

function getCoverDir(): string {
  if (cachedCoverDir) return cachedCoverDir;
  const dir = path.join(app.getPath('userData'), COVER_DIR_NAME);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    console.error('Failed to create cover directory:', error);
  }
  cachedCoverDir = dir;
  return dir;
}

function extFromMime(mime: string | undefined): string {
  if (!mime) return 'jpg';
  const clean = mime.toLowerCase();
  if (clean.includes('png')) return 'png';
  if (clean.includes('webp')) return 'webp';
  if (clean.includes('gif')) return 'gif';
  return 'jpg';
}

const FOLDER_COVER_NAMES = [
  'cover.jpg',
  'cover.jpeg',
  'cover.png',
  'cover.webp',
  'folder.jpg',
  'folder.jpeg',
  'folder.png',
  'folder.webp',
  'front.jpg',
  'front.jpeg',
  'front.png',
  'front.webp'
];

function extractNativePicture(metadata: mm.IAudioMetadata): mm.IPicture | undefined {
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    return metadata.common.picture[0];
  }
  if (!metadata.native) return undefined;

  for (const tagList of Object.values(metadata.native)) {
    if (!Array.isArray(tagList)) continue;
    for (const tag of tagList) {
      if (!tag || !tag.value) continue;
      // MP4 iTunes / QuickTime 'covr'
      if (tag.id === 'covr') {
        if (Buffer.isBuffer(tag.value)) {
          return {
            format: 'image/jpeg',
            data: tag.value,
            type: 'Cover (front)',
            description: ''
          };
        }
        const val = tag.value as any;
        if (val && val.data && Buffer.isBuffer(val.data)) {
          return {
            format: val.format || 'image/jpeg',
            data: val.data,
            type: val.type || 'Cover (front)',
            description: ''
          };
        }
      }
      // FLAC / Vorbis METADATA_BLOCK_PICTURE
      if (tag.id === 'METADATA_BLOCK_PICTURE' || tag.id === 'PICTURE') {
        const val = tag.value as any;
        if (val && Buffer.isBuffer(val.data)) {
          return {
            format: val.format || 'image/jpeg',
            data: val.data,
            type: val.type || 'Cover (front)',
            description: val.description || ''
          };
        }
      }
    }
  }
  return undefined;
}

async function findFolderCoverFile(audioFilePath: string): Promise<string | null> {
  try {
    const dir = path.dirname(audioFilePath);
    const files = await fs.promises.readdir(dir).catch(() => []);
    const fileMap = new Map<string, string>();
    for (const f of files) {
      fileMap.set(f.toLowerCase(), f);
    }
    for (const name of FOLDER_COVER_NAMES) {
      const match = fileMap.get(name);
      if (match) {
        return path.join(dir, match);
      }
    }
  } catch {
    // Ignore unreadable directories
  }
  return null;
}

/**
 */
type LocalMusicMeta = {
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverPath: string | null;
  lyrics: string | null;
  fileSize: number;
  modifiedTime: number;
  /** Acoustic fingerprint (loudness envelope) for cross-format matching. */
  fingerprint?: string;
  /** Duration covered by the fingerprint, in seconds. */
  fingerprintDurationSec?: number;
};

type ScannedMusicFile = {
  path: string;
  modifiedTime: number;
};

/**
 */
function isSupportedFormat(ext: string): boolean {
  return (SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(ext.toLowerCase());
}

/**
 */
function extractTitleFromFilename(filePath: string): string {
  const basename = path.basename(filePath);
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex > 0) {
    return basename.slice(0, dotIndex);
  }
  return basename;
}

/**
 */
async function extractCoverToFile(
  picture: mm.IPicture | undefined,
  sourceFilePath: string
): Promise<string | null> {
  const hash = crypto.createHash('sha256').update(sourceFilePath).digest('hex');
  const coverDir = getCoverDir();

  if (picture && picture.data && picture.data.length > 0) {
    try {
      if (picture.data.length > MAX_COVER_BYTES) {
        console.warn(
          `Cover skipped for exceeding size limit: ${sourceFilePath} (${picture.data.length} bytes > ${MAX_COVER_BYTES})`
        );
      } else {
        const ext = extFromMime(picture.format);
        const coverFile = path.join(coverDir, `${hash}.${ext}`);
        await fs.promises.writeFile(coverFile, Buffer.from(picture.data));
        return coverFile;
      }
    } catch (error) {
      console.error('Failed to write embedded cover:', error);
    }
  }

  const folderCover = await findFolderCoverFile(sourceFilePath);
  if (folderCover) {
    try {
      const ext = path.extname(folderCover).replace(/^\./, '').toLowerCase() || 'jpg';
      const coverFile = path.join(coverDir, `${hash}.${ext}`);
      await fs.promises.copyFile(folderCover, coverFile);
      return coverFile;
    } catch (err) {
      console.warn('Failed to copy folder cover:', folderCover, err);
      return folderCover;
    }
  }

  return null;
}

/**
 */
function extractLyrics(lyrics: mm.ILyricsTag[] | undefined): string | null {
  if (!lyrics || lyrics.length === 0) {
    return null;
  }
  try {
    const firstLyric = lyrics[0];
    return firstLyric?.text ?? null;
  } catch (error) {
    console.error('Failed to extract lyrics:', error);
    return null;
  }
}

/**
 */
async function scanMusicFiles(folderPath: string): Promise<string[]> {
  const results: string[] = [];

  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder does not exist: ${folderPath}`);
  }

  const stat = await fs.promises.stat(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a folder: ${folderPath}`);
  }

  /**
   */
  async function walkDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (DEFAULT_EXCLUDED_DIRS.has(entry.name)) {
            continue;
          }
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (isSupportedFormat(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory: ${dirPath}`, error);
    }
  }

  await walkDirectory(folderPath);
  return results;
}

/**
 */
async function scanMusicFilesWithStats(folderPath: string): Promise<ScannedMusicFile[]> {
  const results: ScannedMusicFile[] = [];

  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder does not exist: ${folderPath}`);
  }

  const stat = await fs.promises.stat(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a folder: ${folderPath}`);
  }

  async function walkDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (DEFAULT_EXCLUDED_DIRS.has(entry.name)) {
            continue;
          }
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (!isSupportedFormat(ext)) {
            continue;
          }

          try {
            const fileStat = await fs.promises.stat(fullPath);
            results.push({
              path: fullPath,
              modifiedTime: fileStat.mtimeMs
            });
          } catch (error) {
            console.error(`Failed to read file info: ${fullPath}`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory: ${dirPath}`, error);
    }
  }

  await walkDirectory(folderPath);
  return results;
}

/**
 */
async function parseMetadata(filePath: string): Promise<LocalMusicMeta> {
  let fileSize = 0;
  let modifiedTime = 0;
  try {
    const stat = await fs.promises.stat(filePath);
    fileSize = stat.size;
    modifiedTime = stat.mtimeMs;
  } catch (error) {
    console.error(`Failed to read file info: ${filePath}`, error);
  }

  const fallback: LocalMusicMeta = {
    filePath,
    title: extractTitleFromFilename(filePath),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 0,
    coverPath: null,
    lyrics: null,
    fileSize,
    modifiedTime
  };

  try {
    const metadata = await mm.parseFile(filePath);
    const { common, format } = metadata;
    const picture = extractNativePicture(metadata);

    // Fingerprint up to 15-minute tracks. This is what lets the library
    // recognise the same recording across bitrates, containers and file names.
    let fingerprint: string | undefined;
    let fingerprintDurationSec: number | undefined;
    if ((format.duration || 0) > 0 && (format.duration || 0) <= 900) {
      const result = await computeAudioFingerprint(filePath);
      if (result) {
        fingerprint = result.fingerprint;
        fingerprintDurationSec = result.durationSec;
      }
    }

    return {
      filePath,
      title: common.title || fallback.title,
      artist: common.artist || fallback.artist,
      album: common.album || fallback.album,
      duration: format.duration ? Math.round(format.duration * 1000) : 0,
      coverPath: await extractCoverToFile(picture, filePath),
      lyrics: extractLyrics(common.lyrics),
      fileSize,
      modifiedTime,
      fingerprint,
      fingerprintDurationSec
    };
  } catch (error) {
    console.warn(`Metadata parse failed, using fallback and folder cover: ${filePath}`, error);
    const folderCover = await findFolderCoverFile(filePath);
    return {
      ...fallback,
      coverPath: folderCover
    };
  }
}

/**
 */
async function batchParseMetadata(filePaths: string[]): Promise<LocalMusicMeta[]> {
  if (filePaths.length === 0) {
    return [];
  }

  const results = new Array<LocalMusicMeta>(filePaths.length);
  const workerCount = Math.min(METADATA_PARSE_CONCURRENCY, filePaths.length);
  let index = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (index < filePaths.length) {
      const current = index;
      index += 1;
      results[current] = await parseMetadata(filePaths[current]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 */
export function initializeLocalMusicScanner(): void {
  ipcMain.handle('scan-local-music', async (_, folderPath: string) => {
    try {
      const files = await scanMusicFiles(folderPath);
      return { files, count: files.length };
    } catch (error: any) {
      console.error('Failed to scan local music:', error);
      return { error: error.message || 'Scan failed' };
    }
  });

  ipcMain.handle('scan-local-music-with-stats', async (_, folderPath: string) => {
    try {
      const files = await scanMusicFilesWithStats(folderPath);
      return { files, count: files.length };
    } catch (error: any) {
      console.error('Failed to scan local music (with file info):', error);
      return { error: error.message || 'Scan failed' };
    }
  });

  ipcMain.handle('local-music:fingerprint', async (_, filePath: string) => {
    try {
      return await computeAudioFingerprint(filePath);
    } catch (error) {
      console.warn('[fingerprint] ipc failed:', error);
      return null;
    }
  });

  ipcMain.handle('parse-local-music-metadata', async (_, filePaths: string[]) => {
    try {
      const metadataList = await batchParseMetadata(filePaths);
      return metadataList;
    } catch (error: any) {
      console.error('Failed to parse local music metadata: ', error);
      return [];
    }
  });
}
