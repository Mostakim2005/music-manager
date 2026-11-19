import { describe, expect, it } from 'vitest';

import { bakeArtworkGlow } from '../src/renderer/composables/useBakedArtworkGlow';
import { computeSeekPokeScale, dedupeArtworkCovers } from '../src/renderer/utils/waveformHelpers';

describe('Milestone B: Widescreen Player, Seek-Poke, Baked Glow & Multi-Artwork Helpers', () => {
  it('computes Seek-Poke spring scale decay across neighbor bars', () => {
    expect(computeSeekPokeScale(10, null)).toBe(1);
    expect(computeSeekPokeScale(10, -1)).toBe(1);
    expect(computeSeekPokeScale(10, 10)).toBe(1.18);
    expect(computeSeekPokeScale(9, 10)).toBe(1.1);
    expect(computeSeekPokeScale(11, 10)).toBe(1.1);
    expect(computeSeekPokeScale(8, 10)).toBe(1.04);
    expect(computeSeekPokeScale(12, 10)).toBe(1.04);
    expect(computeSeekPokeScale(13, 10)).toBe(1);
  });

  it('deduplicates artwork URLs up to 4 tiles for 2x2 collage cards', () => {
    const covers = dedupeArtworkCovers([
      '',
      null,
      'local://a.jpg',
      'local://b.jpg',
      'local://a.jpg',
      '  ',
      'local://c.jpg',
      'local://d.jpg',
      'local://e.jpg'
    ]);
    expect(covers).toEqual(['local://a.jpg', 'local://b.jpg', 'local://c.jpg', 'local://d.jpg']);
  });

  it('returns empty glow data URL gracefully in headless Node environment', async () => {
    const result = await bakeArtworkGlow('local://cover.jpg');
    expect(result).toBe('');
  });
});
