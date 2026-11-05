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
  const rounded = Math.round((value ?? 0) * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2)}`;
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

const reset = () => {
  emit('set', 0);
};
</script>

<template>
  <div
    class="lyric-correction"
    :class="{ 'is-forced-visible': props.forceVisible }"
    role="group"
    aria-label="Lyric timing offset control"
  >
    <!-- Uniform 32px controls: minus / reset / plus, then the manual input -->
    <div class="lyric-correction-row">
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
      <span class="lyric-correction-label">Remove</span>
    </div>

    <div class="lyric-correction-row">
      <n-tooltip placement="left">
        <template #trigger>
          <button
            type="button"
            class="lyric-correction-btn"
            aria-label="Reset lyric offset to zero"
            @click="reset"
          >
            <i class="ri-refresh-line text-base"></i>
          </button>
        </template>
        <span>Reset offset to 0 s</span>
      </n-tooltip>
      <span class="lyric-correction-value">{{ formatOffset(props.correctionTime) }}s</span>
    </div>

    <div class="lyric-correction-row">
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
      <span class="lyric-correction-label">Add</span>
    </div>

    <div class="lyric-correction-row">
      <input
        v-model="draft"
        class="lyric-correction-input"
        type="text"
        inputmode="decimal"
        placeholder="0.00"
        aria-label="Manual lyric offset in seconds"
        title="Offset in seconds: 0.1 = 0.1 s, 1 = 1 s, negative = earlier"
        @keydown.enter.prevent="applyDraft"
        @blur="applyDraft"
      />
      <n-tooltip placement="left">
        <template #trigger>
          <button
            type="button"
            class="lyric-correction-btn"
            aria-label="Apply lyric offset"
            @click="applyDraft"
          >
            <i class="ri-check-line text-base"></i>
          </button>
        </template>
        <span>Apply offset</span>
      </n-tooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lyric-correction {
  /* Keep clear of the pinned PlayBar (80px) and the video pill. */
  @apply absolute right-0 bottom-28 flex flex-col items-stretch gap-1 z-50 select-none transition-opacity duration-200 opacity-0 pointer-events-none;

  &.is-forced-visible {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  &:hover {
    opacity: 1;
    pointer-events: auto;
  }
}

.lyric-correction-row {
  @apply flex items-center gap-2 justify-end;
}

/* Every interactive control is the same 32x32 size. */
.lyric-correction-btn {
  @apply w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-white/20 dark:border-neutral-700/40 shadow-md backdrop-blur-2xl cursor-pointer transition-all duration-150 text-gray-700 dark:text-gray-200 hover:bg-green-500/80 hover:text-white hover:border-green-400/60 active:scale-95;
}

.lyric-correction-label {
  @apply text-[11px] font-medium uppercase tracking-wide text-white/70 w-12 text-left;
}

.lyric-correction-value {
  @apply w-12 text-xs text-left font-mono tabular-nums text-white/90;
}

.lyric-correction-input {
  @apply w-16 h-8 shrink-0 text-xs text-center rounded-lg bg-white/80 dark:bg-neutral-800/80 border border-white/20 dark:border-neutral-700/40 shadow text-gray-700 dark:text-gray-200 font-mono tabular-nums outline-none focus:border-emerald-400/70;
}

.mobile {
  .lyric-correction {
    @apply opacity-100;
  }
}
</style>
