<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  correctionTime: number;
}>();
const emit = defineEmits<{
  (e: 'adjust', delta: number): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="lyric-correction" role="group" aria-label="Lyric timing offset control">
    <n-tooltip placement="right">
      <template #trigger>
        <button
          type="button"
          class="lyric-correction-btn"
          aria-label="Subtract 100ms lyric offset"
          @click="emit('adjust', -0.1)"
          :title="`${t('player.subtractCorrection', { num: 0.1 })} (-100ms)`"
        >
          <i class="ri-subtract-line text-base"></i>
        </button>
      </template>
      <span>-100ms ({{ t('player.subtractCorrection', { num: 0.1 }) }})</span>
    </n-tooltip>
    <n-tooltip placement="right">
      <template #trigger>
        <button
          type="button"
          class="text-xs py-0.5 px-1.5 rounded bg-white/70 dark:bg-neutral-800/70 shadow font-mono tabular-nums tracking-wider text-gray-700 dark:text-gray-200 bg-opacity-40 backdrop-blur-2xl cursor-pointer hover:bg-emerald-500/20 transition-colors"
          aria-label="Reset lyric offset to 0ms"
          @click="emit('adjust', -props.correctionTime)"
        >
          {{ props.correctionTime > 0 ? '+' : '' }}{{ Math.round(props.correctionTime * 1000) }}ms
        </button>
      </template>
      <span>点击重置偏移 (0ms)</span>
    </n-tooltip>
    <n-tooltip placement="right">
      <template #trigger>
        <button
          type="button"
          class="lyric-correction-btn"
          aria-label="Add 100ms lyric offset"
          @click="emit('adjust', 0.1)"
          :title="`${t('player.addCorrection', { num: 0.1 })} (+100ms)`"
        >
          <i class="ri-add-line text-base"></i>
        </button>
      </template>
      <span>+100ms ({{ t('player.addCorrection', { num: 0.1 }) }})</span>
    </n-tooltip>
  </div>
</template>

<style scoped lang="scss">
.lyric-correction {
  /* bottom 需越过全屏态下钉底的 PlayBar（h-20=80px, z-index:9999），否则被遮挡无法点击（#592） */
  @apply absolute right-0 bottom-24 flex flex-col items-center space-y-1 z-50 select-none transition-opacity duration-200 opacity-0 pointer-events-none;
}

.lyric-correction-btn {
  @apply w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-neutral-800 border border-white/20 dark:border-neutral-700/40 shadow-md backdrop-blur-2xl cursor-pointer transition-all duration-150 text-gray-700 dark:text-gray-200 hover:bg-green-500/80 hover:text-white hover:border-green-400/60 active:scale-95 bg-opacity-40 dark:hover:bg-green-500/80 dark:hover:text-white dark:hover:border-green-400/60 dark:hover:bg-opacity-40;
}

.mobile {
  .lyric-correction {
    @apply opacity-100;
  }
}
</style>
