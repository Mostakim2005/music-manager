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
    <div v-for="(peak, idx) in normalizedPeaks" :key="idx" class="waveform-slot">
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

    <!-- SponsorBlock / Chapter Segment Overlays -->
    <div v-if="renderedSegments.length > 0" class="seekbar-segments-layer" aria-hidden="true">
      <div
        v-for="(seg, sIdx) in renderedSegments"
        :key="`seg-${sIdx}-${seg.startTime}`"
        class="seekbar-segment"
        :class="`seg-${seg.category || 'default'}`"
        :style="{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }"
        :title="seg.label || seg.category || 'Segment'"
      />
    </div>

    <!-- A-B Loop Span & Tick Markers -->
    <template v-if="abLoopOverlay">
      <div
        v-if="abLoopOverlay.spanWidthPct > 0"
        class="ab-loop-span"
        :style="{ left: `${abLoopOverlay.leftPct}%`, width: `${abLoopOverlay.spanWidthPct}%` }"
        aria-hidden="true"
      />
      <span
        v-if="abLoopOverlay.aPct !== null"
        class="ab-tick ab-tick-a"
        :style="{ left: `${abLoopOverlay.aPct}%` }"
        title="Loop Point A"
      >
        A
      </span>
      <span
        v-if="abLoopOverlay.bPct !== null"
        class="ab-tick ab-tick-b"
        :style="{ left: `${abLoopOverlay.bPct}%` }"
        title="Loop Point B"
      >
        B
      </span>
    </template>

    <!-- Clickable Bookmark Pin Markers -->
    <button
      v-for="bm in renderedBookmarks"
      :key="bm.id"
      type="button"
      class="bookmark-pin"
      :style="{ left: `${bm.leftPct}%` }"
      :title="bm.label"
      :aria-label="`Jump to bookmark ${bm.label}`"
      @pointerdown.stop
      @click.stop="emit('seek', bm.time)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { getOrComputeWaveformPeaks } from '../../services/songLibrary';
import { computeSeekPokeScale } from '../../utils/waveformHelpers';

export interface SeekbarAbLoop {
  enabled: boolean;
  pointA: number | null;
  pointB: number | null;
}

export interface SeekbarBookmark {
  id: string;
  time: number;
  label: string;
}

export interface SeekbarSegment {
  startTime: number;
  endTime: number;
  category?: string;
  label?: string;
}

const props = withDefaults(
  defineProps<{
    filePath?: string;
    currentTime: number;
    duration: number;
    accentColor?: string;
    barsCount?: number;
    compact?: boolean;
    abLoop?: SeekbarAbLoop | null;
    bookmarks?: SeekbarBookmark[];
    segments?: SeekbarSegment[];
  }>(),
  {
    filePath: '',
    accentColor: 'rgb(var(--namida-seed, 139, 92, 246))',
    barsCount: 140,
    compact: false,
    abLoop: null,
    bookmarks: () => [],
    segments: () => []
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

function toPct(sec: number): number {
  if (!props.duration || props.duration <= 0 || !Number.isFinite(sec)) return 0;
  return Math.min(100, Math.max(0, (sec / props.duration) * 100));
}

const abLoopOverlay = computed(() => {
  const loop = props.abLoop;
  if (!loop || !props.duration || props.duration <= 0) return null;
  if (loop.pointA === null && loop.pointB === null) return null;
  const aPct = loop.pointA !== null ? toPct(loop.pointA) : null;
  const bPct = loop.pointB !== null ? toPct(loop.pointB) : null;
  const leftPct = aPct !== null && bPct !== null ? Math.min(aPct, bPct) : 0;
  const spanWidthPct = aPct !== null && bPct !== null ? Math.max(0, Math.abs(bPct - aPct)) : 0;
  return { aPct, bPct, leftPct, spanWidthPct };
});

const renderedBookmarks = computed(() => {
  if (!props.duration || props.duration <= 0 || !Array.isArray(props.bookmarks)) return [];
  return props.bookmarks
    .filter((bm) => bm && Number.isFinite(bm.time) && bm.time >= 0)
    .map((bm) => ({
      ...bm,
      leftPct: toPct(bm.time)
    }));
});

const renderedSegments = computed(() => {
  if (!props.duration || props.duration <= 0 || !Array.isArray(props.segments)) return [];
  return props.segments
    .filter(
      (seg) =>
        seg &&
        Number.isFinite(seg.startTime) &&
        Number.isFinite(seg.endTime) &&
        seg.endTime > seg.startTime
    )
    .map((seg) => {
      const leftPct = toPct(seg.startTime);
      const rightPct = toPct(seg.endTime);
      return {
        ...seg,
        leftPct,
        widthPct: Math.max(0.5, rightPct - leftPct)
      };
    });
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

.seekbar-segments-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  pointer-events: none;
  z-index: 2;
}

.seekbar-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  opacity: 0.85;
  background: rgba(148, 163, 184, 0.7);
}

.seekbar-segment.seg-music_offtopic {
  background: rgba(249, 115, 22, 0.9);
}

.seekbar-segment.seg-sponsor {
  background: rgba(34, 197, 94, 0.9);
}

.seekbar-segment.seg-intro,
.seekbar-segment.seg-outro {
  background: rgba(56, 189, 248, 0.85);
}

.seekbar-segment.seg-chapter {
  background: rgba(255, 255, 255, 0.35);
  border-right: 1px solid rgba(0, 0, 0, 0.55);
}

.ab-loop-span {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: rgba(16, 185, 129, 0.22);
  border-left: 2px solid #10b981;
  border-right: 2px solid #10b981;
  border-radius: 4px;
  pointer-events: none;
  z-index: 3;
}

.ab-tick {
  position: absolute;
  top: -8px;
  transform: translateX(-50%);
  padding: 0 4px;
  font-size: 9px;
  line-height: 13px;
  font-weight: 700;
  border-radius: 4px;
  background: #10b981;
  color: #052e16;
  pointer-events: none;
  z-index: 4;
}

.bookmark-pin {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #f59e0b;
  border: 1.5px solid #ffffff;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.8);
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 5;
  padding: 0;
  transition: transform 140ms ease;
}

.bookmark-pin:hover {
  transform: translate(-50%, -50%) scale(1.35);
}
</style>
