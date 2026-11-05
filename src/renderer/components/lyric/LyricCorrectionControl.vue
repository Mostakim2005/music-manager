<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  correctionTime: number;
  forceVisible?: boolean;
}>();

const emit = defineEmits<{
  (e: 'adjust', delta: number): void;
  (e: 'set', value: number): void;
}>();

const formatOffset = (value: number): string => {
  const rounded = Math.round((value ?? 0) * 1000) / 1000;
  return `${rounded > 0 ? '+' : ''}${rounded}`;
};

const draft = ref(formatOffset(props.correctionTime));

watch(
  () => props.correctionTime,
  (value) => {
    draft.value = formatOffset(value);
  }
);

const applyDraft = () => {
  const parsed = Number(draft.value.replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(parsed)) {
    draft.value = formatOffset(props.correctionTime);
    return;
  }
  const clamped = Math.max(-30, Math.min(30, parsed));
  draft.value = formatOffset(clamped);
  emit('set', clamped);
};

const nudge = (delta: number) => {
  emit('adjust', delta);
};
</script>

<template>
  <div
    class="lyric-correction"
    :class="{ 'is-forced-visible': props.forceVisible }"
    role="group"
    aria-label="Lyric timing offset control"
  >
    <n-tooltip placement="left">
      <template #trigger>
        <button
          type="button"
          class="lyric-correction-btn"
          aria-label="Shift lyrics 0.1 seconds earlier"
          @click="nudge(-0.1)"
        >
          <i class="ri-subtract-line text-base"></i>
        </button>
      </template>
      <span>-0.10 s (lyrics earlier)</span>
    </n-tooltip>

    <n-tooltip placement="left">
      <template #trigger>
        <button
          type="button"
          class="lyric-correction-value"
          aria-label="Reset lyric offset to zero"
          @click="nudge(-props.correctionTime)"
        >
          {{ formatOffset(props.correctionTime) }}s
        </button>
      </template>
      <span>Click to reset offset (0 s)</span>
    </n-tooltip>

    <n-tooltip placement="left">
      <template #trigger>
        <button
          type="button"
          class="lyric-correction-btn"
          aria-label="Shift lyrics 0.1 seconds later"
          @click="nudge(0.1)"
        >
          <i class="ri-add-line text-base"></i>
        </button>
      </template>
      <span>+0.10 s (lyrics later)</span>
    </n-tooltip>

    <div class="lyric-correction-input-row">
      <input
        v-model="draft"
        class="lyric-correction-input"
        type="text"
        inputmode="decimal"
        placeholder="+0.25"
        aria-label="Custom lyric offset in seconds"
        title="Type any offset in seconds, e.g. +0.01, -0.7, +1.3"
        @keydown.enter.prevent="applyDraft"
        @blur="applyDraft"
      />
      <button
        type="button"
        class="lyric-correction-btn lyric-correction-apply"
        aria-label="Apply lyric offset"
        title="Apply offset"
        @click="applyDraft"
      >
        <i class="ri-check-line text-base"></i>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lyric-correction {
  /* Keep clear of the pinned PlayBar (80px) and the video pill. */
  @apply absolute right-0 bottom-28 flex flex-col items-center gap-1 z-50 select-none transition-opacity duration-200 opacity-0 pointer-events-none;

  &.is-forced-visible {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  &:hover {
    opacity: 1;
    pointer-events: auto;
  }
}

.lyric-correction-btn {
  @apply w-7 h-7 flex items-center justify-center rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-white/20 dark:border-neutral-700/40 shadow-md backdrop-blur-2xl cursor-pointer transition-all duration-150 text-gray-700 dark:text-gray-200 hover:bg-green-500/80 hover:text-white hover:border-green-400/60 active:scale-95;
}

.lyric-correction-value {
  @apply min-w-[3.5rem] text-xs py-0.5 px-1.5 rounded bg-white/80 dark:bg-neutral-800/80 shadow font-mono tabular-nums tracking-wide text-gray-700 dark:text-gray-200 backdrop-blur-2xl cursor-pointer hover:bg-emerald-500/20 transition-colors;
}

.lyric-correction-input-row {
  @apply flex items-center gap-1 opacity-0 transition-opacity duration-150;

  .lyric-correction:hover &,
  .lyric-correction.is-forced-visible & {
    opacity: 1;
  }
}

.lyric-correction-input {
  @apply w-[3.5rem] text-xs text-center py-1 px-1 rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-white/20 dark:border-neutral-700/40 shadow text-gray-700 dark:text-gray-200 font-mono tabular-nums outline-none focus:border-emerald-400/70;
}

.lyric-correction-apply {
  @apply w-6 h-6;
}

.mobile {
  .lyric-correction {
    @apply opacity-100;
  }
}
</style>
