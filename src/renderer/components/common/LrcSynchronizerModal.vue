<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :z-index="9999999"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="lrc-synchronizer-modal p-6 rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-2xl bg-white/85 dark:bg-neutral-900/85 text-neutral-900 dark:text-neutral-100 max-w-3xl w-[95vw] max-h-[92vh] flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <i class="ri-timer-flash-line text-green-500 text-xl" />
            LRC Lyric Timestamp Synchronizer
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Precision timestamp maker &amp; real-time audio synchronizer. Play, stamp, preview &amp; nudge.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close LRC Synchronizer"
          class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-500 transition"
          @click="emit('update:show', false)"
        >
          <i class="ri-close-line text-xl" />
        </button>
      </div>

      <!-- Embedded Mini Player -->
      <div
        class="mini-player-card mt-3 p-3.5 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50 flex flex-col gap-2.5"
      >
        <div class="flex items-center justify-between gap-3">
          <!-- Play / Pause & Quick Seek Navigation -->
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-md shadow-primary/25 hover:brightness-110 active:scale-95 transition"
              :title="isPlaying ? 'Pause Audio' : 'Play Audio'"
              @click="togglePlayPause"
            >
              <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'" class="text-lg" />
            </button>

            <!-- Back 10s, Back 5s -->
            <button
              type="button"
              class="px-2 py-1 rounded-lg text-xs font-semibold bg-neutral-200/70 dark:bg-neutral-700/60 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
              title="Rewind 10 seconds"
              @click="seekRelative(-10)"
            >
              <i class="ri-replay-10-line mr-0.5" /> -10s
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-lg text-xs font-semibold bg-neutral-200/70 dark:bg-neutral-700/60 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
              title="Rewind 5 seconds"
              @click="seekRelative(-5)"
            >
              <i class="ri-replay-5-line mr-0.5" /> -5s
            </button>

            <!-- Forward 5s, Forward 10s -->
            <button
              type="button"
              class="px-2 py-1 rounded-lg text-xs font-semibold bg-neutral-200/70 dark:bg-neutral-700/60 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
              title="Forward 5 seconds"
              @click="seekRelative(5)"
            >
              +5s <i class="ri-forward-5-line ml-0.5" />
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-lg text-xs font-semibold bg-neutral-200/70 dark:bg-neutral-700/60 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
              title="Forward 10 seconds"
              @click="seekRelative(10)"
            >
              +10s <i class="ri-forward-10-line ml-0.5" />
            </button>
          </div>

          <!-- Time Display & Reset -->
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-300 bg-white/70 dark:bg-neutral-900/60 px-2.5 py-1 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50">
              <span class="text-primary font-bold">{{ formatLrcTimestamp(currentAudioTime) }}</span>
              <span class="text-neutral-400 mx-1">/</span>
              <span>{{ formatLrcTimestamp(totalDuration) }}</span>
            </span>
          </div>
        </div>

        <!-- Scrubber Slider -->
        <div class="flex items-center gap-2 w-full">
          <n-slider
            v-model:value="sliderValue"
            :min="0"
            :max="totalDuration || 100"
            :step="0.1"
            :tooltip="false"
            class="flex-1"
            @update:value="handleSliderSeek"
          />
        </div>
      </div>

      <!-- Mode & Tools Bar (Nudge step, Global Offset, Mode switch) -->
      <div class="mt-3 flex items-center justify-between flex-wrap gap-2.5 py-1">
        <!-- Interactive vs Plain Text Mode Switch -->
        <div class="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-medium">
          <button
            type="button"
            class="px-3 py-1 rounded-lg transition"
            :class="
              mode === 'sync'
                ? 'bg-white dark:bg-neutral-700 text-primary shadow-sm font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
            "
            @click="switchToSync"
          >
            <i class="ri-play-list-2-line mr-1" /> Interactive Synchronizer
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded-lg transition"
            :class="
              mode === 'edit'
                ? 'bg-white dark:bg-neutral-700 text-primary shadow-sm font-semibold'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900'
            "
            @click="switchToEdit"
          >
            <i class="ri-edit-line mr-1" /> Plain Text Editor
          </button>
        </div>

        <!-- Nudge Step Selector & Global Offset Control -->
        <div v-if="mode === 'sync'" class="flex items-center flex-wrap gap-2 text-xs">
          <!-- Step Selector -->
          <div class="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-xl">
            <span class="text-neutral-500 dark:text-neutral-400 font-medium mr-1">Nudge:</span>
            <button
              v-for="st in [0.1, 0.5, 1.0]"
              :key="st"
              type="button"
              class="px-1.5 py-0.5 rounded text-[11px] font-semibold transition"
              :class="
                nudgeStep === st
                  ? 'bg-primary text-white'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              "
              @click="nudgeStep = st"
            >
              {{ st }}s
            </button>
            <div class="flex items-center gap-0.5 ml-1">
              <input
                v-model.number="customNudgeInput"
                type="number"
                step="0.05"
                min="0.01"
                max="10"
                placeholder="cust"
                class="w-12 px-1 py-0.5 text-[11px] rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-center font-mono"
                @focus="nudgeStep = customNudgeInput || 0.25"
                @input="nudgeStep = customNudgeInput || 0.25"
              />
              <span class="text-[10px] text-neutral-400">s</span>
            </div>
          </div>

          <!-- Global Shift Bar -->
          <div class="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-xl">
            <span class="text-neutral-500 dark:text-neutral-400 font-medium">All:</span>
            <button
              type="button"
              class="px-1.5 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
              :title="`Shift all timestamps by -${nudgeStep}s`"
              @click="handleGlobalOffset(-nudgeStep)"
            >
              -{{ nudgeStep }}s
            </button>
            <button
              type="button"
              class="px-1.5 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
              :title="`Shift all timestamps by +${nudgeStep}s`"
              @click="handleGlobalOffset(nudgeStep)"
            >
              +{{ nudgeStep }}s
            </button>
            <input
              v-model.number="customOffsetInputSec"
              type="number"
              step="0.1"
              placeholder="±sec"
              class="w-12 px-1 py-0.5 text-[11px] rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-center font-mono ml-0.5"
            />
            <button
              type="button"
              class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-200 dark:bg-neutral-700 hover:bg-primary hover:text-white transition"
              @click="handleApplyCustomOffset"
            >
              Shift
            </button>
          </div>

          <!-- Reset Timestamps -->
          <button
            type="button"
            class="px-2 py-1 rounded-xl text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition flex items-center gap-1"
            @click="handleResetTimestamps"
          >
            <i class="ri-refresh-line" /> Reset
          </button>
        </div>
      </div>

      <!-- Plain Text Editor Mode -->
      <div v-if="mode === 'edit'" class="mt-3 flex-1 flex flex-col min-h-0">
        <label class="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
          Paste plain lyrics or existing LRC text below. Each row will be loaded into the synchronizer:
        </label>
        <textarea
          v-model="rawInputText"
          class="flex-1 w-full min-h-[300px] p-3 text-xs font-mono rounded-2xl bg-white/70 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 resize-none focus:outline-none focus:border-primary"
          placeholder="[00:01.00] Line one&#10;[00:05.20] Line two..."
        />
        <div class="mt-2 flex justify-end">
          <n-button size="small" type="primary" @click="switchToSync">
            Load into Synchronizer
          </n-button>
        </div>
      </div>

      <!-- Interactive Synchronizer Mode -->
      <div v-else class="mt-3 flex-1 flex flex-col min-h-0">
        <!-- Action Stamping Toolbar -->
        <div
          class="p-2.5 mb-2 rounded-2xl bg-neutral-100/60 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/50 flex flex-wrap items-center justify-between gap-2"
        >
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-4 py-1.5 rounded-xl font-bold text-xs bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition flex items-center gap-1.5"
              @click="handleStamp"
            >
              <i class="ri-timer-line text-sm" /> Stamp Current Time [Space]
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-200/80 dark:bg-neutral-700/70 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-40 transition flex items-center gap-1"
              :disabled="activeIndex <= 0"
              @click="handlePrevLine"
            >
              <i class="ri-arrow-up-line" /> Prev Line
            </button>
          </div>
          <div class="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Line {{ lines.length > 0 ? activeIndex + 1 : 0 }} of {{ lines.length }}
          </div>
        </div>

        <!-- Lyric Lines Table -->
        <div
          ref="lineListContainer"
          class="flex-1 overflow-y-auto space-y-1 pr-1 border border-neutral-200/70 dark:border-neutral-800 rounded-2xl p-2 bg-white/40 dark:bg-neutral-950/40 min-h-[260px] max-h-[380px]"
        >
          <div
            v-if="lines.length === 0"
            class="py-16 text-center text-xs text-neutral-400 dark:text-neutral-500"
          >
            No lyric lines loaded. Switch to "Plain Text Editor" to paste lyrics.
          </div>

          <div
            v-for="(item, index) in lines"
            :key="index"
            :ref="(el) => { if (index === activeIndex) activeElementRef = el as HTMLElement; }"
            class="group flex items-center gap-2 p-1.5 rounded-xl text-xs transition cursor-pointer"
            :class="[
              index === activeIndex
                ? 'bg-primary/15 border border-primary/30 text-neutral-900 dark:text-white font-medium shadow-sm'
                : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300 border border-transparent'
            ]"
            @click="selectIndex(index)"
          >
            <!-- Line Number -->
            <span class="w-6 text-right font-mono text-[11px] text-neutral-400 shrink-0">
              {{ index + 1 }}
            </span>

            <!-- Preview Button ▶ (seeks to timestamp and plays) -->
            <button
              type="button"
              class="w-6 h-6 rounded-md bg-neutral-200/70 dark:bg-neutral-800 hover:bg-primary hover:text-white flex items-center justify-center text-[11px] shrink-0 transition"
              :disabled="!item.timestamp"
              :title="item.timestamp ? `Seek to ${item.timestamp} and preview` : 'No timestamp'"
              @click.stop="handlePreviewLine(item)"
            >
              <i class="ri-play-fill" />
            </button>

            <!-- Nudge − Button -->
            <button
              type="button"
              class="w-5 h-5 rounded bg-neutral-200/50 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center text-[10px] shrink-0 transition"
              :title="`Nudge -${nudgeStep}s`"
              @click.stop="nudgeLine(index, -nudgeStep)"
            >
              −
            </button>

            <!-- Timestamp (Click to edit inline) -->
            <div class="shrink-0" @click.stop>
              <input
                v-if="editingIndex === index"
                v-model="item.timestamp"
                type="text"
                class="w-20 px-1 py-0.5 rounded font-mono text-[11px] bg-white dark:bg-black border border-primary text-center focus:outline-none"
                @blur="commitTimestampEdit(index)"
                @keydown.enter="commitTimestampEdit(index)"
              />
              <span
                v-else
                class="inline-block w-20 text-center px-1.5 py-0.5 rounded font-mono text-[11px] tabular-nums font-semibold cursor-text hover:ring-1 hover:ring-primary/40 transition"
                :class="
                  item.timestamp
                    ? 'bg-primary/20 text-primary dark:text-primary'
                    : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-400'
                "
                title="Click to manually edit timestamp"
                @click="startTimestampEdit(index)"
              >
                {{ item.timestamp || '--:--.--' }}
              </span>
            </div>

            <!-- Nudge + Button -->
            <button
              type="button"
              class="w-5 h-5 rounded bg-neutral-200/50 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center text-[10px] shrink-0 transition"
              :title="`Nudge +${nudgeStep}s`"
              @click.stop="nudgeLine(index, nudgeStep)"
            >
              +
            </button>

            <!-- Line Content -->
            <span class="flex-1 min-w-0 truncate pl-1">
              {{ item.text || '(empty line)' }}
            </span>

            <!-- Active Tag -->
            <span
              v-if="index === activeIndex"
              class="text-[10px] uppercase font-bold text-primary tracking-wider shrink-0 mr-1"
            >
              Active
            </span>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div
        class="mt-4 pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between flex-wrap gap-2"
      >
        <div class="flex items-center gap-2">
          <n-button size="small" secondary @click="handleCopyLrc">
            <template #icon>
              <i :class="copySuccess ? 'ri-check-line text-green-500' : 'ri-file-copy-line'" />
            </template>
            {{ copySuccess ? 'Copied!' : 'Copy LRC' }}
          </n-button>
        </div>

        <div class="flex items-center gap-2">
          <n-button size="small" @click="emit('update:show', false)">
            Cancel
          </n-button>
          <n-button
            size="small"
            type="primary"
            :loading="applying"
            @click="handleApply"
          >
            <template #icon>
              <i class="ri-check-line" />
            </template>
            Apply Synced Lyrics
          </n-button>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script lang="ts">
export {
  formatLrcTimestamp,
  nudgeTimestamp,
  parseLrcTimestamp,
  shiftAllLrcTimestamps,
  shiftLinesTimestamps,
  stampLyricLine,
  stripLrcTimestamps
} from '@/utils/lyrics';
</script>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import {
  formatLrcTimestamp,
  nudgeTimestamp,
  parseLrcTimestamp,
  shiftLinesTimestamps,
  stripLrcTimestamps
} from '@/utils/lyrics';

interface LyricLineState {
  timestamp: string;
  text: string;
}

const props = withDefaults(
  defineProps<{
    show: boolean;
    initialLyrics?: string;
    filePath?: string;
    track?: SongResult;
    currentTimeGetter?: () => number;
  }>(),
  {
    initialLyrics: '',
    filePath: '',
    track: undefined,
    currentTimeGetter: undefined
  }
);

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'apply', syncedLrc: string): void;
}>();

const { message } = createDiscreteApi(['message']);
const playerStore = usePlayerStore();

// ==================== State ====================
const mode = ref<'sync' | 'edit'>('sync');
const rawInputText = ref('');
const lines = ref<LyricLineState[]>([]);
const activeIndex = ref(0);
const activeElementRef = ref<HTMLElement | null>(null);
const lineListContainer = ref<HTMLElement | null>(null);
const currentAudioTime = ref(0);
const totalDuration = ref(0);
const sliderValue = ref(0);
const isPlaying = ref(false);
const copySuccess = ref(false);
const applying = ref(false);

/** Nudge step selector: 0.1, 0.5, 1.0 or custom */
const nudgeStep = ref<number>(0.5);
const customNudgeInput = ref<number | undefined>(undefined);
const customOffsetInputSec = ref<number | undefined>(undefined);
const editingIndex = ref<number | null>(null);

let clockInterval: ReturnType<typeof setInterval> | null = null;

// ==================== Audio Player Helpers ====================
function getCurrentTime(): number {
  if (typeof props.currentTimeGetter === 'function') {
    try {
      const t = props.currentTimeGetter();
      if (typeof t === 'number' && !isNaN(t)) return t;
    } catch {
      // ignore
    }
  }
  return audioService.getCurrentTime() || 0;
}

function updateAudioState() {
  const t = getCurrentTime();
  currentAudioTime.value = t;
  sliderValue.value = t;
  totalDuration.value = audioService.getDuration() || 0;
  isPlaying.value = !audioService.isPaused() && playerStore.isPlay;
}

function togglePlayPause() {
  if (audioService.isPaused()) {
    audioService.play();
    isPlaying.value = true;
  } else {
    audioService.pause();
    isPlaying.value = false;
  }
}

function seekRelative(deltaSeconds: number) {
  const current = getCurrentTime();
  const max = audioService.getDuration() || 9999;
  const nextTime = Math.max(0, Math.min(max, current + deltaSeconds));
  audioService.seek(nextTime);
  currentAudioTime.value = nextTime;
  sliderValue.value = nextTime;
}

function handleSliderSeek(val: number) {
  audioService.seek(val);
  currentAudioTime.value = val;
}

function handlePreviewLine(line: LyricLineState) {
  if (!line.timestamp) return;
  const secs = parseLrcTimestamp(line.timestamp);
  if (!isNaN(secs)) {
    audioService.seek(secs);
    if (audioService.isPaused()) {
      audioService.play();
    }
    currentAudioTime.value = secs;
    sliderValue.value = secs;
    isPlaying.value = true;
  }
}

// ==================== Line & Parsing Helpers ====================
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

function nudgeLine(index: number, deltaSec: number) {
  if (lines.value[index]) {
    lines.value[index].timestamp = nudgeTimestamp(lines.value[index].timestamp, deltaSec);
  }
}

function startTimestampEdit(index: number) {
  editingIndex.value = index;
}

function commitTimestampEdit(index: number) {
  if (editingIndex.value === index) {
    const raw = lines.value[index]?.timestamp || '';
    if (raw && !raw.startsWith('[')) {
      lines.value[index].timestamp = `[${raw.replace(/\]$/, '')}]`;
    }
    editingIndex.value = null;
  }
}

function handleGlobalOffset(deltaSec: number) {
  lines.value = shiftLinesTimestamps(lines.value, deltaSec);
  message.info(`Shifted all timestamps by ${deltaSec > 0 ? '+' : ''}${deltaSec}s`);
}

function handleApplyCustomOffset() {
  const delta = customOffsetInputSec.value;
  if (typeof delta === 'number' && !isNaN(delta) && delta !== 0) {
    handleGlobalOffset(delta);
    customOffsetInputSec.value = undefined;
  }
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
  message.info('Timestamps reset to plain text.');
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
    message.success('LRC content copied to clipboard!');
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy LRC:', error);
  }
}

async function handleApply() {
  const output = buildLrcString();
  emit('apply', output);

  // If a physical file path is provided, save embedded into audio and write .lrc sidecar
  if (props.filePath) {
    applying.value = true;
    try {
      const res = await window.electron.ipcRenderer.invoke('local-music:save-synced-lyrics', {
        filePath: props.filePath,
        lyrics: output,
        saveSidecar: true
      });
      if (res?.ok) {
        message.success('Synced lyrics embedded in audio tags & saved to sidecar .lrc!');
      } else {
        message.warning(`Applied to editor, but disk save notice: ${res?.error || 'Unknown'}`);
      }
    } catch (err: any) {
      console.warn('Auto-save lyrics IPC notice:', err);
    } finally {
      applying.value = false;
    }
  } else {
    message.success('Synced lyrics applied to editor!');
  }

  emit('update:show', false);
}

// ==================== Keyboard Shortcuts ====================
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

// ==================== Watchers & Lifecycle ====================
watch(
  () => [props.show, props.initialLyrics],
  ([show]) => {
    if (show) {
      const initLyrics = props.initialLyrics || '';
      rawInputText.value = initLyrics;
      lines.value = parseInputIntoLines(initLyrics);
      activeIndex.value = 0;
      mode.value = 'sync';
      updateAudioState();

      if (!clockInterval) {
        clockInterval = setInterval(updateAudioState, 150);
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
