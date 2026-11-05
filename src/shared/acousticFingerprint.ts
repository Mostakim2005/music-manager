/**
 * Acoustic fingerprint comparison shared by the main process (which derives
 * fingerprints from decoded PCM) and the renderer library (which matches them).
 *
 * The signature is a coarse loudness envelope: 0.5 s windows, 16 levels. It is
 * robust to re-encoding, container changes and modest volume differences, which
 * is what lets different qualities of the same recording resolve to one song.
 */

export const FINGERPRINT_WINDOW_SECONDS = 0.5;
export const FINGERPRINT_LEVELS = 16;
export const FINGERPRINT_MAX_SECONDS = 120;

export interface AudioFingerprint {
  /** One hex character per 0.5 s window. */
  fingerprint: string;
  /** Decoded audio duration in seconds (capped at FINGERPRINT_MAX_SECONDS). */
  durationSec: number;
  /** Number of analysed windows. */
  windows: number;
}

/** Quantizes a normalized envelope (0..1) into a single hex digit. */
export function quantizeLevel(normalized: number): number {
  const clamped = Number.isFinite(normalized) ? Math.max(0, Math.min(1, normalized)) : 0;
  return Math.round(Math.sqrt(clamped) * (FINGERPRINT_LEVELS - 1));
}

/**
 * Similarity of two fingerprints in the range 0..1.
 * Returns 0 when the lengths differ too much to be the same recording excerpt.
 */
export function compareFingerprints(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const minLength = Math.min(a.length, b.length);
  const maxLength = Math.max(a.length, b.length);
  if (minLength < 8) return 0;
  // A 6-window difference is ~3 s, enough for encoder padding/trim differences.
  if (maxLength - minLength > 6) return 0;

  let matches = 0;
  for (let i = 0; i < minLength; i += 1) {
    if (a[i] === b[i]) matches += 1;
  }
  return matches / maxLength;
}

/** True when two fingerprints are confidently the same recording. */
export function isSameRecording(a?: string | null, b?: string | null): boolean {
  return compareFingerprints(a, b) >= 0.8;
}
