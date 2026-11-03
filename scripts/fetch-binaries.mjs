/**
 * fetch-binaries.mjs
 * Ensures required external binaries (yt-dlp and ffmpeg) exist under resources/bin.
 * Runs in postinstall and before portable/win build targets.
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const projectRoot = path.resolve(__dirname, '..');
const binDir = path.join(projectRoot, 'resources', 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// 1. ffmpeg binary resolution
const isWindows = process.platform === 'win32';
const ffmpegBinaryName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegTarget = path.join(binDir, ffmpegBinaryName);

if (!fs.existsSync(ffmpegTarget)) {
  console.log('[fetch-binaries] Checking ffmpeg from ffmpeg-static package...');
  try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      console.log(`[fetch-binaries] Copying ffmpeg from "${ffmpegPath}" to "${ffmpegTarget}"`);
      fs.copyFileSync(ffmpegPath, ffmpegTarget);
      fs.chmodSync(ffmpegTarget, 0o755);
      console.log('[fetch-binaries] ffmpeg copied successfully.');
    } else {
      console.warn('[fetch-binaries] ffmpeg-static binary not found on disk.');
    }
  } catch (err) {
    console.warn('[fetch-binaries] Error locating ffmpeg-static:', err.message);
  }
} else {
  console.log('[fetch-binaries] ffmpeg binary already exists at:', ffmpegTarget);
}

// 2. yt-dlp binary resolution
const ytDlpBinaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpTarget = path.join(binDir, ytDlpBinaryName);

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'MusicManager/5.2.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(downloadFile(res.headers.location, destPath));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download ${url}: HTTP status ${res.statusCode}`));
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            fs.chmodSync(destPath, 0o755);
            resolve();
          });
        });
        file.on('error', (err) => {
          fs.unlink(destPath, () => reject(err));
        });
      })
      .on('error', reject);
  });
}

if (!fs.existsSync(ytDlpTarget)) {
  console.log(`[fetch-binaries] Downloading latest ${ytDlpBinaryName} from GitHub releases...`);
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpBinaryName}`;
  try {
    await downloadFile(downloadUrl, ytDlpTarget);
    console.log(`[fetch-binaries] ${ytDlpBinaryName} downloaded successfully.`);
  } catch (err) {
    console.warn(`[fetch-binaries] Failed to download ${ytDlpBinaryName}:`, err.message);
  }
} else {
  console.log('[fetch-binaries] yt-dlp binary already exists at:', ytDlpTarget);
}
