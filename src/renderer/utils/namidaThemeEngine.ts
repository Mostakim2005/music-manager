import type { GlobalThemeOverrides } from 'naive-ui';
import tinycolor from 'tinycolor2';

export type RgbTuple = [number, number, number];

export const DEFAULT_NAMIDA_SEED: RgbTuple = [139, 92, 246];

const DARK_SCAFFOLD_LEVELS = [
  '#0e0e11', // 0: Material dark
  '#0b0b0e', // 1
  '#08080a', // 2
  '#050507', // 3
  '#020203', // 4
  '#000000' // 5: Pure AMOLED pitch black
] as const;

export function clampPitchLevel(level: unknown): number {
  const n = Number(level);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

export function clampRadiusMultiplier(mult: unknown): number {
  const n = Number(mult);
  if (!Number.isFinite(n)) return 1;
  return Math.round(Math.max(0.5, Math.min(1.5, n)) * 100) / 100;
}

/**
 * Parses a hex, rgb(), or rgba() CSS color string into an [r, g, b] tuple.
 */
export function parseColorToRgb(colorStr: string | undefined | null): RgbTuple | null {
  if (!colorStr || typeof colorStr !== 'string') return null;
  const parsed = tinycolor(colorStr.trim());
  if (!parsed.isValid()) return null;
  const { r, g, b } = parsed.toRgb();
  return [Math.round(r), Math.round(g), Math.round(b)];
}

/**
 * Extracts a dynamic seed RGB tuple from RGBA pixel data.
 * Preserves monochrome/desaturated artwork (weighted average saturation < 0.12)
 * without artificially oversaturating it into a false hue.
 */
export function extractSeedRgbFromImageData(data: Uint8ClampedArray): RgbTuple {
  if (!data || data.length < 4) {
    return [...DEFAULT_NAMIDA_SEED];
  }

  let totalWeight = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumSat = 0;

  let chromaWeight = 0;
  let chromaR = 0;
  let chromaG = 0;
  let chromaB = 0;

  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 32) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

    // Down-weight crushed blacks and blown highlights so midtones dominate
    const lumWeight = l > 0.08 && l < 0.92 ? 1.0 : 0.25;
    const alphaWeight = a / 255;
    const weight = lumWeight * alphaWeight;

    totalWeight += weight;
    sumR += r * weight;
    sumG += g * weight;
    sumB += b * weight;
    sumSat += s * weight;

    if (s >= 0.12) {
      const cWeight = weight * (0.35 + s * 1.65);
      chromaWeight += cWeight;
      chromaR += r * cWeight;
      chromaG += g * cWeight;
      chromaB += b * cWeight;
    }
  }

  if (totalWeight <= 0) {
    return [...DEFAULT_NAMIDA_SEED];
  }

  const avgSat = sumSat / totalWeight;
  if (avgSat < 0.12 || chromaWeight <= 0) {
    // Monochrome / desaturated cover: keep neutral grayscale clamped to readable midtone luminance
    const mono = tinycolor({
      r: Math.round(sumR / totalWeight),
      g: Math.round(sumG / totalWeight),
      b: Math.round(sumB / totalWeight)
    });
    const hsl = mono.toHsl();
    const clampedL = Math.max(0.38, Math.min(0.68, hsl.l));
    const adjusted = tinycolor({ h: hsl.h, s: Math.min(hsl.s, 0.08), l: clampedL }).toRgb();
    return [Math.round(adjusted.r), Math.round(adjusted.g), Math.round(adjusted.b)];
  }

  const rawRgb = tinycolor({
    r: Math.round(chromaR / chromaWeight),
    g: Math.round(chromaG / chromaWeight),
    b: Math.round(chromaB / chromaWeight)
  });
  const hsl = rawRgb.toHsl();
  const safeL = Math.max(0.36, Math.min(0.68, hsl.l));
  const balanced = tinycolor({ h: hsl.h, s: Math.min(0.88, hsl.s), l: safeL }).toRgb();
  return [Math.round(balanced.r), Math.round(balanced.g), Math.round(balanced.b)];
}

/**
 * Computes all Namida theme CSS variables for `:root` using `in srgb` color mixing.
 */
export function computeNamidaCssVars(
  seedRgb: RgbTuple,
  mode: 'dark' | 'light',
  pitchLevelInput = 0,
  radiusMultInput = 1
): Record<string, string> {
  const pitchLevel = clampPitchLevel(pitchLevelInput);
  const radiusMult = clampRadiusMultiplier(radiusMultInput);
  const [r, g, b] = seedRgb.map((v) => Math.max(0, Math.min(255, Math.round(v)))) as RgbTuple;
  const seedStr = `${r}, ${g}, ${b}`;

  const baseVars: Record<string, string> = {
    '--namida-seed': seedStr,
    '--namida-pitch-level': String(pitchLevel),
    '--namida-radius-mult': String(radiusMult),
    '--namida-radius-card': `${Math.round(14 * radiusMult * 100) / 100}px`,
    '--namida-radius-settings': `${Math.round(20 * radiusMult * 100) / 100}px`,
    '--namida-radius-art': `${Math.round(12 * radiusMult * 100) / 100}px`,
    '--color-primary': `rgb(${seedStr})`
  };

  if (mode === 'light') {
    return {
      ...baseVars,
      '--namida-card-base': '255, 255, 255',
      '--namida-tint-mult': '1',
      '--namida-bg-scaffold': `color-mix(in srgb, rgb(${seedStr}) 24%, #ffffff)`,
      '--namida-surface-topbar': `color-mix(in srgb, rgb(${seedStr}) 10%, #ffffff)`,
      '--namida-surface-card': `color-mix(in srgb, rgb(${seedStr}) 14%, #ffffff)`,
      '--namida-surface-elevated': `color-mix(in srgb, rgb(${seedStr}) 18%, #ffffff)`,
      '--namida-icon-default': `color-mix(in srgb, rgb(${seedStr}) 47%, rgba(0, 0, 0, 0.78))`,
      '--namida-nav-indicator': `color-mix(in srgb, rgb(${seedStr}) 28%, #ffffff)`
    };
  }

  // Dark mode with 5-level Pitch Black blending (level 0: rgb(35,35,35), tint 0.8 -> level 5: rgb(20,20,20), tint 0.1)
  const cardBaseChannel = Math.round(35 - (pitchLevel / 5) * 15);
  const tintMult = Math.round((0.8 - (pitchLevel / 5) * 0.7) * 1000) / 1000;
  const scaffoldHex = DARK_SCAFFOLD_LEVELS[pitchLevel];
  const cardMixPct = Math.round(14 * tintMult * 100) / 100;
  const elevatedMixPct = Math.round(18 * tintMult * 100) / 100;
  const topbarMixPct = Math.round(10 * tintMult * 100) / 100;
  const cardBaseStr = `${cardBaseChannel}, ${cardBaseChannel}, ${cardBaseChannel}`;

  return {
    ...baseVars,
    '--namida-card-base': cardBaseStr,
    '--namida-tint-mult': String(tintMult),
    '--namida-bg-scaffold': scaffoldHex,
    '--namida-surface-topbar': `color-mix(in srgb, rgb(${seedStr}) ${topbarMixPct}%, rgb(${cardBaseStr}))`,
    '--namida-surface-card': `color-mix(in srgb, rgb(${seedStr}) ${cardMixPct}%, rgb(${cardBaseStr}))`,
    '--namida-surface-elevated': `color-mix(in srgb, rgb(${seedStr}) ${elevatedMixPct}%, rgb(${cardBaseStr}))`,
    '--namida-icon-default': `color-mix(in srgb, rgb(${seedStr}) 47%, rgba(255, 255, 255, 0.85))`,
    '--namida-nav-indicator': `color-mix(in srgb, rgb(${seedStr}) 47%, #000000)`
  };
}

/**
 * Generates Naive UI GlobalThemeOverrides synchronized with the active Namida seed, mode, pitch level, and radius.
 */
export function buildNaiveThemeOverrides(
  seedRgb: RgbTuple,
  mode: 'dark' | 'light',
  pitchLevelInput = 0,
  radiusMultInput = 1
): GlobalThemeOverrides {
  const pitchLevel = clampPitchLevel(pitchLevelInput);
  const radiusMult = clampRadiusMultiplier(radiusMultInput);
  const seedColor = tinycolor({ r: seedRgb[0], g: seedRgb[1], b: seedRgb[2] });
  const primaryHex = seedColor.toHexString();
  const hoverHex =
    mode === 'dark'
      ? seedColor.clone().lighten(8).toHexString()
      : seedColor.clone().darken(6).toHexString();
  const pressedHex =
    mode === 'dark'
      ? seedColor.clone().darken(8).toHexString()
      : seedColor.clone().darken(14).toHexString();

  const cardBaseChannel = Math.round(35 - (pitchLevel / 5) * 15);
  const tintMult = 0.8 - (pitchLevel / 5) * 0.7;

  const bodyColor =
    mode === 'dark'
      ? DARK_SCAFFOLD_LEVELS[pitchLevel]
      : tinycolor.mix('#ffffff', primaryHex, 24).toHexString();

  const cardColor =
    mode === 'dark'
      ? tinycolor
          .mix(
            { r: cardBaseChannel, g: cardBaseChannel, b: cardBaseChannel },
            primaryHex,
            Math.round(14 * tintMult)
          )
          .toHexString()
      : tinycolor.mix('#ffffff', primaryHex, 14).toHexString();

  const modalColor =
    mode === 'dark'
      ? tinycolor
          .mix(
            { r: cardBaseChannel, g: cardBaseChannel, b: cardBaseChannel },
            primaryHex,
            Math.round(18 * tintMult)
          )
          .toHexString()
      : tinycolor.mix('#ffffff', primaryHex, 10).toHexString();

  const borderRadius = `${Math.round(12 * radiusMult)}px`;

  return {
    common: {
      fontFamily: "'Lexend Deca', sans-serif, Roboto",
      primaryColor: primaryHex,
      primaryColorHover: hoverHex,
      primaryColorPressed: pressedHex,
      primaryColorSuppl: hoverHex,
      borderRadius,
      bodyColor,
      cardColor,
      modalColor,
      popoverColor: modalColor
    },
    Slider: {
      fillColor: primaryHex,
      fillColorHover: hoverHex,
      dotBorderActive: `2px solid ${primaryHex}`
    },
    Switch: {
      railColorActive: primaryHex
    }
  };
}
