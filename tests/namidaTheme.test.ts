import { describe, expect, it } from 'vitest';

import {
  buildNaiveThemeOverrides,
  computeNamidaCssVars,
  DEFAULT_NAMIDA_SEED,
  extractSeedRgbFromImageData,
  parseColorToRgb
} from '../src/renderer/utils/namidaThemeEngine';

describe('Milestone A: Namida Theme Engine & Dynamic Artwork Colors', () => {
  it('parses valid hex and rgb color strings and rejects invalid values', () => {
    expect(parseColorToRgb('#8b5cf6')).toEqual([139, 92, 246]);
    expect(parseColorToRgb('rgb(16, 185, 129)')).toEqual([16, 185, 129]);
    expect(parseColorToRgb('not-a-color')).toBeNull();
    expect(parseColorToRgb('')).toBeNull();
  });

  it('preserves monochrome/desaturated artwork without false color saturation', () => {
    // 4x4 grayscale pixels (R=G=B=120)
    const monoPixels = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i += 1) {
      monoPixels[i * 4] = 120;
      monoPixels[i * 4 + 1] = 120;
      monoPixels[i * 4 + 2] = 120;
      monoPixels[i * 4 + 3] = 255;
    }

    const [r, g, b] = extractSeedRgbFromImageData(monoPixels);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
    expect(r).toBeGreaterThanOrEqual(90);
    expect(r).toBeLessThanOrEqual(180);
  });

  it('extracts vibrant chromatic seed from colorful artwork pixels', () => {
    const emeraldPixels = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i += 1) {
      emeraldPixels[i * 4] = 16;
      emeraldPixels[i * 4 + 1] = 185;
      emeraldPixels[i * 4 + 2] = 129;
      emeraldPixels[i * 4 + 3] = 255;
    }

    const [r, g, b] = extractSeedRgbFromImageData(emeraldPixels);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('computes 5-level Pitch Black dark mode variables and radius multiplier scaling', () => {
    const level0 = computeNamidaCssVars([16, 185, 129], 'dark', 0, 1);
    expect(level0['--namida-bg-scaffold']).toBe('#0e0e11');
    expect(level0['--namida-card-base']).toBe('35, 35, 35');
    expect(level0['--namida-tint-mult']).toBe('0.8');
    expect(level0['--namida-radius-card']).toBe('14px');
    expect(level0['--namida-radius-settings']).toBe('20px');

    const level5 = computeNamidaCssVars([16, 185, 129], 'dark', 5, 1.5);
    expect(level5['--namida-bg-scaffold']).toBe('#000000');
    expect(level5['--namida-card-base']).toBe('20, 20, 20');
    expect(level5['--namida-tint-mult']).toBe('0.1');
    expect(level5['--namida-radius-card']).toBe('21px');
    expect(level5['--namida-radius-settings']).toBe('30px');
    expect(level5['--namida-surface-card']).toContain('color-mix(in srgb');
  });

  it('computes light mode blended surfaces matching Namida surface math', () => {
    const lightVars = computeNamidaCssVars(DEFAULT_NAMIDA_SEED, 'light', 3, 0.5);
    expect(lightVars['--namida-bg-scaffold']).toBe(
      'color-mix(in srgb, rgb(139, 92, 246) 24%, #ffffff)'
    );
    expect(lightVars['--namida-surface-topbar']).toBe(
      'color-mix(in srgb, rgb(139, 92, 246) 10%, #ffffff)'
    );
    expect(lightVars['--namida-surface-card']).toBe(
      'color-mix(in srgb, rgb(139, 92, 246) 14%, #ffffff)'
    );
    expect(lightVars['--namida-surface-elevated']).toBe(
      'color-mix(in srgb, rgb(139, 92, 246) 18%, #ffffff)'
    );
    expect(lightVars['--namida-radius-art']).toBe('6px');
  });

  it('builds Naive UI theme overrides with Lexend Deca and pitch black scaffold color', () => {
    const overrides = buildNaiveThemeOverrides([139, 92, 246], 'dark', 5, 1.2);
    expect(overrides.common?.fontFamily).toContain('Lexend Deca');
    expect(overrides.common?.primaryColor).toBe('#8b5cf6');
    expect(overrides.common?.bodyColor).toBe('#000000');
    expect(overrides.common?.borderRadius).toBe('14px');
    expect(overrides.Slider?.fillColor).toBe('#8b5cf6');
    expect(overrides.Switch?.railColorActive).toBe('#8b5cf6');
  });
});
