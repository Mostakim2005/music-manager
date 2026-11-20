import * as fs from 'fs';
import * as path from 'path';

const MAX_SIDECAR_LRC_BYTES = 128 * 1024;

/**
 * Read a sibling .lrc sidecar file next to an audio file (capped at 128 KB)
 * so Ctrl+K lyric search indexes tracks without embedded lyric tags.
 */
export async function readSidecarLrc(audioFilePath: string): Promise<string | null> {
  if (!audioFilePath) return null;
  const parsed = path.parse(audioFilePath);
  const candidates = [
    path.join(parsed.dir, `${parsed.name}.lrc`),
    path.join(parsed.dir, `${parsed.name}.LRC`)
  ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.promises.stat(candidate);
      if (!stat.isFile() || stat.size === 0 || stat.size > MAX_SIDECAR_LRC_BYTES) {
        continue;
      }
      const content = await fs.promises.readFile(candidate, 'utf8');
      const trimmed = content.trim();
      if (trimmed) return trimmed;
    } catch {
      // sidecar file does not exist or is unreadable; try next candidate
    }
  }
  return null;
}
