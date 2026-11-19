import { ref, type Ref, watch } from 'vue';

const MAX_CACHE_ENTRIES = 24;
const glowCache = new Map<string, string>();

/**
 * Pre-bakes a small 64x64 blurred artwork image once per track URL so the UI can
 * render a cheap scaled glow behind artwork instead of an expensive live CSS blur.
 */
export async function bakeArtworkGlow(imageSrc: string): Promise<string> {
  if (!imageSrc || typeof window === 'undefined' || typeof Image === 'undefined') {
    return '';
  }

  const cached = glowCache.get(imageSrc);
  if (cached !== undefined) {
    return cached;
  }

  const dataUrl = await new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.clearRect(0, 0, 64, 64);
        ctx.filter = 'blur(8px)';
        ctx.drawImage(img, 8, 8, 48, 48);
        let out = '';
        try {
          out = canvas.toDataURL('image/webp', 0.65);
        } catch {
          out = '';
        }
        if (!out || !out.startsWith('data:image/')) {
          try {
            out = canvas.toDataURL('image/png');
          } catch {
            out = '';
          }
        }
        resolve(out);
      } catch {
        // CORS-tainted canvas or unsupported context; fail gracefully
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = imageSrc;
  });

  if (glowCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = glowCache.keys().next().value;
    if (oldest !== undefined) {
      glowCache.delete(oldest);
    }
  }
  glowCache.set(imageSrc, dataUrl);
  return dataUrl;
}

export function clearBakedGlowCache(): void {
  glowCache.clear();
}

export function useBakedArtworkGlow(srcRef: Ref<string | undefined | null>) {
  const glowDataUrl = ref('');
  let requestSeq = 0;

  watch(
    srcRef,
    async (src) => {
      const seq = ++requestSeq;
      if (!src) {
        glowDataUrl.value = '';
        return;
      }
      const baked = await bakeArtworkGlow(src);
      if (seq !== requestSeq) return;
      glowDataUrl.value = baked;
    },
    { immediate: true }
  );

  return { glowDataUrl };
}
