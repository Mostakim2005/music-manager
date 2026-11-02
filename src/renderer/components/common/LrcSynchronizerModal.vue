<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :z-index="9999999"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="lrc-synchronizer-modal p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl max-w-2xl w-[94vw] max-h-[90vh] flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <i class="ri-timer-flash-line text-green-500" />
            LRC Lyric Timestamp Synchronizer
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Real-time interactive lyric stamping tool. Play audio and press Space or Stamp to set timestamps.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close LRC Synchronizer"
          class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
          @click="emit('update:show', false)"
        >
          <i class="ri-close-line text-xl" />
        </button>
      </div>

      <!-- Mode Selector & Live Audio Clock -->
      <div class="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-medium">
          <button
            type="button"
            class="px-3 py-1 rounded-lg transition"
            :class="mode === 'sync' ? 'bg-white dark:bg-neutral-700 text-green-600 dark:text-green-400 shadow-sm font-semibold' : 'text-neutral-600 dark:text-neutral-300'"
            @click="switchToSync"
          >
            <i class="ri-play-list-2-line mr-1" /> Interactive Synchronizer
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded-lg transition"
            :class="mode === 'edit' ? 'bg-white dark:bg-neutral-700 text-green-600 dark:text-green-400 shadow-sm font-semibold' : 'text-neutral-600 dark:text-neutral-300'"
            @click="switchToEdit"
          >
            <i class="ri-edit-line mr-1" /> Plain Text Editor
          </button>
        </div>

        <div class="flex items-center gap-2">
          <div class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
            Current Audio: <span class="text-green-500 font-bold">{{ formatLrcTimestamp(currentAudioTime) }}</span>
          </div>
          <n-button size="tiny" secondary type="warning" @click="handleResetTimestamps">
            <i class="ri-refresh-line mr-1" /> Reset Timestamps
          </n-button>
        </div>
      </div>

      <!-- Edit Plain Text Mode -->
      <div v-if="mode === 'edit'" class="mt-4 flex-1 flex flex-col min-h-0">
        <label class="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
          Paste plain lyrics or existing LRC text below. Each line will become a synchronizer row.
        </label>
        <textarea
          v-model="rawInputText"
          class="flex-1 w-full min-h-[300px] p-3 text-xs font-mono rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 resize-none focus:outline-none focus:border-green-500"
          placeholder="Paste lyrics here (one line per lyric)..."
        />
        <div class="mt-2 flex justify-end">
          <n-button size="small" type="primary" @click="switchToSync">
            Load into Synchronizer
          </n-button>
        </div>
      </div>

      <!-- Interactive Sync Mode -->
      <div v-else class="mt-4 flex-1 flex flex-col min-h-0">
        <!-- Interactive Controls Bar -->
        <div class="p-3 mb-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <n-button
              type="primary"
              size="medium"
              class="font-semibold shadow-md shadow-green-500/20"
              @click="handleStamp"
            >
              <i class="ri-timer-line mr-1.5" /> Stamp Current Time [Space]
            </n-button>
            <n-button size="medium" secondary @click="handlePrevLine" :disabled="activeIndex <= 0">
              <i class="ri-arrow-up-line mr-1" /> Previous Line
            </n-button>
            <n-button size="medium" secondary @click="handleRewindTwoSeconds">
              <i class="ri-rewind-line mr-1" /> -2s Rewind Audio
            </n-button>
          </div>
          <div class="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Line {{ lines.length > 0 ? activeIndex + 1 : 0 }} of {{ lines.length }}
          </div>
        </div>

        <!-- Lyric Lines Table / Scroller -->
        <div
          ref="lineListContainer"
          class="flex-1 overflow-y-auto space-y-1 pr-1 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-2 bg-neutral-50/50 dark:bg-neutral-950/40 min-h-[260px] max-h-[380px]"
        >
          <div
            v-if="lines.length === 0"
            class="py-12 text-center text-xs text-neutral-400 dark:text-neutral-500"
          >
            No lyric lines loaded. Switch to "Plain Text Editor" to paste lyrics.
          </div>

          <div
            v-for="(item, index) in lines"
            :key="index"
            :ref="(el) => { if (index === activeIndex) activeElementRef = el as HTMLElement; }"
            class="flex items-center gap-3 p-2 rounded-xl text-xs transition cursor-pointer"
            :class="[
              index === activeIndex
                ? 'bg-green-500/15 border border-green-500/30 text-neutral-900 dark:text-white font-medium shadow-sm'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 border border-transparent'
            ]"
            @click="selectIndex(index)"
          >
            <span class="w-6 text-right font-mono text-[11px] text-neutral-400">
              {{ index + 1 }}
            </span>
            <span
              class="px-2 py-0.5 rounded font-mono text-[11px] tabular-nums font-semibold shrink-0"
              :class="item.timestamp ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400'"
            >
              {{ item.timestamp || '--:--.--' }}
            </span>
            <span class="flex-1 min-w-0 truncate">
              {{ item.text || '(empty line)' }}
            </span>
            <span v-if="index === activeIndex" class="text-[10px] uppercase font-bold text-green-500 tracking-wider">
              Active
            </span>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <n-button size="small" secondary @click="handleCopyLrc">
            <i class="ri-file-copy-line mr-1" />
            {{ copySuccess ? 'Copied!' : 'Copy LRC' }}
          </n-button>
        </div>

        <div class="flex items-center gap-2">
          <n-button size="small" secondary @click="emit('update:show', false)">
            Cancel
          </n-button>
          <n-button size="small" type="primary" @click="handleApply">
            <i class="ri-check-line mr-1" /> Apply Synced Lyrics
          </n-button>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script lang="ts">
export { formatLrcTimestamp, stampLyricLine, stripLrcTimestamps } from '@/utils/lyrics';
</script>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { audioService } from '@/services/audioService';
import { formatLrcTimestamp, stripLrcTimestamps } from '@/utils/lyrics';

interface LyricLineState {
  timestamp: string;
  text: string;
}

const props = withDefaults(
  defineProps<{
    show: boolean;
    initialLyrics?: string;
    currentTimeGetter?: () => number;
  }>(),
  {
    initialLyrics: '',
    currentTimeGetter: undefined
  }
);

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'apply', syncedLrc: string): void;
}>();

const mode = ref<'sync' | 'edit'>('sync');
const rawInputText = ref('');
const lines = ref<LyricLineState[]>([]);
const activeIndex = ref(0);
const activeElementRef = ref<HTMLElement | null>(null);
const lineListContainer = ref<HTMLElement | null>(null);
const currentAudioTime = ref(0);
const copySuccess = ref(false);

let clockInterval: ReturnType<typeof setInterval> | null = null;

function getCurrentTime(): number {
  if (typeof props.currentTimeGetter === 'function') {
    try {
      const t = props.currentTimeGetter();
      if (typeof t === 'number' && !isNaN(t)) return t;
    } catch {
      // fallback
    }
  }
  return audioService.getCurrentTime() || 0;
}

function updateAudioTime() {
  currentAudioTime.value = getCurrentTime();
}

function parseInputIntoLines(text: string): LyricLineState[] {
  if (!text) return [];
  const rawLines = text.split(/\r?\n/);
  return rawLines
    .map((line) => {
      const match = line.match(/^(\[\d{1,2}:\d{1,2}(?:\.\d+)?\])\s*(.*)$/);
      if (match) {
        return {
          timestamp: match[1],
          text: match[2].trim()
        };
      }
      return {
        timestamp: '',
        text: line.trim()
      };
    })
    .filter((l) => l.text.length > 0 || l.timestamp.length > 0);
}

function buildLrcString(): string {
  return lines.value
    .map((l) => (l.timestamp ? `${l.timestamp}${l.text}` : l.text))
    .join('\n');
}

function scrollToActive() {
  nextTick(() => {
    if (activeElementRef.value && lineListContainer.value) {
      activeElementRef.value.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  });
}

function switchToSync() {
  if (mode.value === 'edit') {
    lines.value = parseInputIntoLines(rawInputText.value);
    activeIndex.value = 0;
  }
  mode.value = 'sync';
}

function switchToEdit() {
  rawInputText.value = buildLrcString();
  mode.value = 'edit';
}

function selectIndex(index: number) {
  if (index >= 0 && index < lines.value.length) {
    activeIndex.value = index;
    scrollToActive();
  }
}

function handleStamp() {
  if (lines.value.length === 0) return;
  const time = getCurrentTime();
  const ts = formatLrcTimestamp(time);
  if (lines.value[activeIndex.value]) {
    lines.value[activeIndex.value].timestamp = ts;
  }
  if (activeIndex.value < lines.value.length - 1) {
    activeIndex.value += 1;
    scrollToActive();
  }
}

function handlePrevLine() {
  if (activeIndex.value > 0) {
    activeIndex.value -= 1;
    scrollToActive();
  }
}

function handleRewindTwoSeconds() {
  const t = getCurrentTime();
  const nextTime = Math.max(0, t - 2);
  audioService.seek(nextTime);
  currentAudioTime.value = nextTime;
}

function handleResetTimestamps() {
  if (mode.value === 'edit') {
    rawInputText.value = stripLrcTimestamps(rawInputText.value);
  } else {
    lines.value.forEach((l) => {
      l.timestamp = '';
    });
    activeIndex.value = 0;
  }
}

async function handleCopyLrc() {
  const output = buildLrcString();
  if (!output) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(output);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = output;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy LRC:', error);
  }
}

function handleApply() {
  const output = buildLrcString();
  emit('apply', output);
  emit('update:show', false);
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (!props.show || mode.value !== 'sync') return;
  const target = e.target as HTMLElement | null;
  const isInputActive =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable);

  if (isInputActive) return;

  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    handleStamp();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    handlePrevLine();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (activeIndex.value < lines.value.length - 1) {
      activeIndex.value += 1;
      scrollToActive();
    }
  }
}

watch(
  () => [props.show, props.initialLyrics],
  ([show]) => {
    if (show) {
      const initLyrics = props.initialLyrics || '';
      rawInputText.value = initLyrics;
      lines.value = parseInputIntoLines(initLyrics);
      activeIndex.value = 0;
      mode.value = 'sync';
      updateAudioTime();

      if (!clockInterval) {
        clockInterval = setInterval(updateAudioTime, 100);
      }
    } else {
      if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
      }
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
});
</script>

<style scoped>
.lrc-synchronizer-modal {
  user-select: none;
}
</style>
