import type { GlobalThemeOverrides } from 'naive-ui';
import { computed, ref, watch } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl } from '@/utils';
import {
  buildNaiveThemeOverrides,
  clampPitchLevel,
  clampRadiusMultiplier,
  computeNamidaCssVars,
  DEFAULT_NAMIDA_SEED,
  extractSeedRgbFromImageData,
  parseColorToRgb,
  type RgbTuple
} from '@/utils/namidaThemeEngine';

export {
  buildNaiveThemeOverrides,
  clampPitchLevel,
  clampRadiusMultiplier,
  computeNamidaCssVars,
  DEFAULT_NAMIDA_SEED,
  extractSeedRgbFromImageData,
  parseColorToRgb,
  type RgbTuple
};

const seedCache = new Map<string, RgbTuple>();

/**
 * Extracts a Namida seed RGB color from an artwork URL, preserving monochrome
 * covers without false saturation and falling back to Vibrant on CORS taint.
 */
export async function extractSeedRgbFromUrl(imageSrc: string): Promise<RgbTuple | null> {
  if (!imageSrc || typeof window === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  const cached = seedCache.get(imageSrc);
  if (cached) return cached;

  const fromCanvas = await new Promise<RgbTuple | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, 32, 32);
        const pixels = ctx.getImageData(0, 0, 32, 32).data;
        resolve(extractSeedRgbFromImageData(pixels));
      } catch {
        // Canvas may be CORS-tainted; fall back below
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });

  if (fromCanvas) {
    if (seedCache.size > 64) {
      const oldest = seedCache.keys().next().value;
      if (oldest) seedCache.delete(oldest);
    }
    seedCache.set(imageSrc, fromCanvas);
    return fromCanvas;
  }

  try {
    const { extractVibrantPalette } = await import('@/utils/linearColor');
    const palette = await extractVibrantPalette(imageSrc);
    if (palette?.vibrant) {
      const parsed = parseColorToRgb(palette.vibrant);
      if (parsed) {
        seedCache.set(imageSrc, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore fallback extraction error
  }

  return null;
}

export function applyNamidaThemeToDocument(
  seedRgb: RgbTuple,
  mode: 'dark' | 'light',
  pitchLevel: number,
  radiusMult: number
): void {
  if (typeof document === 'undefined' || !document.documentElement?.style) return;
  const rootStyle = document.documentElement.style;
  rootStyle.colorScheme = mode;
  const vars = computeNamidaCssVars(seedRgb, mode, pitchLevel, radiusMult);
  for (const [prop, val] of Object.entries(vars)) {
    rootStyle.setProperty(prop, val);
  }
}

export function useNamidaTheme() {
  const settingsStore = useSettingsStore();
  const playerStore = usePlayerStore();
  const seedRgb = ref<RgbTuple>([...DEFAULT_NAMIDA_SEED]);

  const mode = computed<'dark' | 'light'>(() =>
    settingsStore.theme === 'dark' ? 'dark' : 'light'
  );
  const pitchLevel = computed(() => clampPitchLevel(settingsStore.setData?.namidaPitchLevel ?? 0));
  const radiusMult = computed(() =>
    clampRadiusMultiplier(settingsStore.setData?.namidaRadiusMult ?? 1)
  );
  const dynamicEnabled = computed(() => settingsStore.setData?.enableDynamicPalette !== false);

  let latestExtractionSeq = 0;

  watch(
    () => [
      dynamicEnabled.value,
      playerStore.playMusic?.picUrl,
      (playerStore.playMusic as any)?.primaryColor
    ],
    async ([enabled, picUrl, primaryColor]) => {
      const seq = ++latestExtractionSeq;
      if (!enabled) {
        seedRgb.value = [...DEFAULT_NAMIDA_SEED];
        return;
      }

      const rawUrl = typeof picUrl === 'string' && picUrl ? getImgUrl(picUrl, '100y100') : '';
      if (rawUrl) {
        const extracted = await extractSeedRgbFromUrl(rawUrl);
        if (seq !== latestExtractionSeq) return;
        if (extracted) {
          seedRgb.value = extracted;
          return;
        }
      }

      const fromPrimary = parseColorToRgb(typeof primaryColor === 'string' ? primaryColor : null);
      seedRgb.value = fromPrimary || [...DEFAULT_NAMIDA_SEED];
    },
    { immediate: true }
  );

  watch(
    [seedRgb, mode, pitchLevel, radiusMult],
    ([seed, currentMode, pitch, radius]) => {
      applyNamidaThemeToDocument(seed, currentMode, pitch, radius);
    },
    { immediate: true, deep: true }
  );

  const themeOverrides = computed<GlobalThemeOverrides>(() =>
    buildNaiveThemeOverrides(seedRgb.value, mode.value, pitchLevel.value, radiusMult.value)
  );

  return {
    seedRgb,
    mode,
    pitchLevel,
    radiusMult,
    themeOverrides
  };
}
