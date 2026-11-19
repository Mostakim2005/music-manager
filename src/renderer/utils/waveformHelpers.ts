/**
 * Computes the Seek-Poke vertical spring scale factor for a waveform bar at `barIndex`
 * when the user clicks or drags near `pokeIndex`.
 */
export function computeSeekPokeScale(barIndex: number, pokeIndex: number | null): number {
  if (pokeIndex === null || pokeIndex < 0 || !Number.isFinite(pokeIndex)) {
    return 1;
  }
  const distance = Math.abs(barIndex - pokeIndex);
  if (distance === 0) return 1.18;
  if (distance === 1) return 1.1;
  if (distance === 2) return 1.04;
  return 1;
}

/**
 * Deduplicates non-empty artwork URLs up to `max` entries for 2x2 collage cards.
 */
export function dedupeArtworkCovers(
  covers: Array<string | null | undefined>,
  max = 4
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of covers) {
    const clean = typeof raw === 'string' ? raw.trim() : '';
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}
