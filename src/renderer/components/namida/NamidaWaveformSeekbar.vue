<template>
  <div
    ref="containerRef"
    class="namida-waveform-seekbar"
    :class="{ 'is-compact': compact }"
    role="slider"
    tabindex="0"
    aria-label="Seek track"
    :aria-valuemin="0"
    :aria-valuemax="Math.round(duration || 0)"
    :aria-valuenow="Math.round(currentTime || 0)"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="hoverRatio = null"
    @keydown="onKeyDown"
  >
    <div
      v-for="(peak, idx) in normalizedPeaks"
      :key="idx"
      class="waveform-slot"
    >
      <div
        class="waveform-bar"
        :class="{
          'is-played': idx / normalizedPeaks.length <= displayRatio,
          'is-hovered': hoverRatio !== null && idx / normalizedPeaks.length <= hoverRatio
        }"
        :style="{
          height: `${Math.max(12, Math.round(peak * 100))}%`,
          transform: `scaleY(${computeSeekPokeScale(idx, pokeIndex)})`,
          '--bar-accent': accentColor
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { getOrComputeWaveformPeaks } from '../../services/songLibrary';
import { computeSeekPokeScale } from '../../utils/waveformHelpers';

const props = withDefaults(
  defineProps<{
    filePath?: string;
    currentTime: number;
    duration: number;
    accentColor?: string;
    barsCount?: number;
    compact?: boolean;
  }>(),
  {
    filePath: '',
    accentColor: 'rgb(var(--namida-seed, 139, 92, 246))',
    barsCount: 140,
    compact: false
  }
);

const emit = defineEmits<{
  (e: 'seek', targetSeconds: number): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const rawPeaks = ref<number[]>([]);
const isDragging = ref(false);
const dragRatio = ref(0);
const hoverRatio = ref<number | null>(null);
const pokeIndex = ref<number | null>(null);
let pokeTimer: ReturnType<typeof setTimeout> | null = null;

function triggerPoke(ratio: number) {
  const count = normalizedPeaks.value.length;
  if (count <= 0) return;
  pokeIndex.value = Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
  if (pokeTimer) clearTimeout(pokeTimer);
  pokeTimer = setTimeout(() => {
    pokeIndex.value = null;
    pokeTimer = null;
  }, 280);
}

watch(
  () => props.filePath,
  async (newPath) => {
    if (!newPath || newPath.startsWith('http')) {
      rawPeaks.value = Array.from(
        { length: props.barsCount },
        (_, i) => 0.25 + 0.65 * Math.abs(Math.sin(i * 0.21) * Math.cos(i * 0.07))
      );
      return;
    }
    try {
      rawPeaks.value = await getOrComputeWaveformPeaks(newPath, props.barsCount);
    } catch {
      rawPeaks.value = Array(props.barsCount).fill(0.3);
    }
  },
  { immediate: true }
);

const normalizedPeaks = computed(() =>
  rawPeaks.value.length > 0 ? rawPeaks.value : Array(props.barsCount).fill(0.25)
);

const displayRatio = computed(() => {
  if (isDragging.value) return dragRatio.value;
  if (!props.duration || props.duration <= 0) return 0;
  return Math.min(1, Math.max(0, props.currentTime / props.duration));
});

function ratioFromEvent(e: PointerEvent): number {
  const el = containerRef.value;
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  if (!rect.width) return 0;
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

function onPointerDown(e: PointerEvent) {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    // ignore pointer capture issues in synthetic tests
  }
  const r = ratioFromEvent(e);
  isDragging.value = true;
  dragRatio.value = r;
  triggerPoke(r);
}

function onPointerMove(e: PointerEvent) {
  const r = ratioFromEvent(e);
  hoverRatio.value = r;
  if (isDragging.value) {
    dragRatio.value = r;
    triggerPoke(r);
  }
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return;
  const r = ratioFromEvent(e);
  isDragging.value = false;
  triggerPoke(r);
  if (props.duration > 0) {
    emit('seek', r * props.duration);
  }
}

function onPointerCancel() {
  isDragging.value = false;
}

function onKeyDown(e: KeyboardEvent) {
  if (!props.duration || props.duration <= 0) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 5 : -5;
    const target = Math.min(props.duration, Math.max(0, (props.currentTime || 0) + delta));
    triggerPoke(target / props.duration);
    emit('seek', target);
  }
}

onBeforeUnmount(() => {
  if (pokeTimer) {
    clearTimeout(pokeTimer);
    pokeTimer = null;
  }
});
</script>

<style scoped>
.namida-waveform-seekbar {
  position: relative;
  display: flex;
  align-items: center;
  height: clamp(28px, 7.5vh, 64px);
  width: 100%;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  padding: 4px 0;
  outline: none;
}

.namida-waveform-seekbar.is-compact {
  height: 38px;
}

.namida-waveform-seekbar:focus-visible {
  outline: 2px solid rgb(var(--namida-seed, 139, 92, 246));
  outline-offset: 4px;
  border-radius: 8px;
}

.waveform-slot {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.waveform-bar {
  width: 54%;
  min-width: 2px;
  min-height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  transform-origin: center;
  transition:
    height 600ms cubic-bezier(0.77, 0, 0.175, 1),
    background-color 140ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.waveform-bar.is-hovered {
  background: rgba(255, 255, 255, 0.45);
}

.waveform-bar.is-played {
  background: var(--bar-accent, rgb(var(--namida-seed, 139, 92, 246)));
  box-shadow: 0 0 8px color-mix(in srgb, var(--bar-accent, #8b5cf6) 55%, transparent);
}
</style>
