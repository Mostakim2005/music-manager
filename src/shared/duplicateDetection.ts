/**
 * Pure helpers for finding the same recording stored more than once.
 *
 * The library already prevents most duplicates at ingest time; this pass is for
 * libraries that were built before fingerprints existed, or where files were
 * added with wildly different metadata. A pair is only reported when the
 * acoustic signature agrees AND the durations are close, so two different songs
 * that happen to share a loudness curve are not merged.
 */
import { compareFingerprints } from './acousticFingerprint';

export interface DuplicateCandidate {
  id: string;
  fingerprint?: string;
  durationSec?: number;
  normKey?: string;
  variantCount?: number;
  createdAt?: number;
}

export interface DuplicatePair {
  keepId: string;
  dropId: string;
  score: number;
}

export interface DuplicateDetectionOptions {
  /** Minimum fingerprint similarity (0..1). */
  minScore?: number;
  /** Maximum allowed duration difference in seconds. */
  maxDurationDiffSec?: number;
}

/**
 * Returns pairs to merge, choosing the record with more attached variants (and
 * then the older record) as the survivor. Each dropped record appears at most
 * once, and a survivor may absorb several duplicates.
 */
export function findFingerprintDuplicatePairs(
  songs: DuplicateCandidate[],
  options: DuplicateDetectionOptions = {}
): DuplicatePair[] {
  const minScore = options.minScore ?? 0.8;
  const maxDurationDiffSec = options.maxDurationDiffSec ?? 3;

  const candidates = songs.filter((song) => (song.fingerprint?.length ?? 0) >= 8);
  const consumed = new Set<string>();
  const pairs: DuplicatePair[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const a = candidates[i];
    if (consumed.has(a.id)) continue;

    for (let j = i + 1; j < candidates.length; j += 1) {
      const b = candidates[j];
      if (consumed.has(b.id)) continue;

      const score = compareFingerprints(a.fingerprint, b.fingerprint);
      if (score < minScore) continue;

      const da = a.durationSec ?? 0;
      const db = b.durationSec ?? 0;
      if (da > 0 && db > 0 && Math.abs(da - db) > maxDurationDiffSec) continue;

      const [keep, drop] = pickSurvivor(a, b);
      pairs.push({ keepId: keep.id, dropId: drop.id, score });
      consumed.add(drop.id);
    }
  }

  return pairs;
}

function pickSurvivor(a: DuplicateCandidate, b: DuplicateCandidate): [DuplicateCandidate, DuplicateCandidate] {
  const variantsA = a.variantCount ?? 0;
  const variantsB = b.variantCount ?? 0;
  if (variantsA !== variantsB) {
    return variantsA > variantsB ? [a, b] : [b, a];
  }
  const createdA = a.createdAt ?? Number.MAX_SAFE_INTEGER;
  const createdB = b.createdAt ?? Number.MAX_SAFE_INTEGER;
  if (createdA !== createdB) {
    return createdA <= createdB ? [a, b] : [b, a];
  }
  return a.id <= b.id ? [a, b] : [b, a];
}
