<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :z-index="9999999"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="ab-loop-modal p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl max-w-lg w-[92vw]"
    >
      <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <i class="ri-repeat-2-line text-green-500" />
            A-B Loop Repeat &amp; Track Bookmarks
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-sm">
            {{ playMusic?.name || 'No track selected' }}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close A-B Loop Modal"
          class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
          @click="emit('update:show', false)"
        >
          <i class="ri-close-line text-xl" />
        </button>
      </div>

      <!-- A-B Segment Controls -->
      <div class="mt-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            A-B Segment Loop
          </span>
          <span
            class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
            :class="
              abState.enabled
                ? 'bg-green-500/15 text-green-500'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
            "
          >
            {{ abState.enabled ? 'Looping A → B' : 'Inactive' }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <n-button size="small" secondary type="primary" @click="handleSetA">
            Set A ({{ abState.pointA !== null ? formatSec(abState.pointA) : '--:--' }})
          </n-button>
          <n-button size="small" secondary type="info" @click="handleSetB">
            Set B ({{ abState.pointB !== null ? formatSec(abState.pointB) : '--:--' }})
          </n-button>
          <n-button size="small" secondary type="error" @click="handleClearAb">
            Clear A-B
          </n-button>
        </div>
      </div>

      <!-- Timestamp Bookmarks -->
      <div class="mt-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            Track Bookmarks ({{ bookmarks.length }})
          </span>
        </div>

        <div class="flex items-center gap-2 mb-3">
          <n-input
            v-model:value="bookmarkLabel"
            size="small"
            placeholder="Bookmark note (e.g. Guitar Solo, Chorus)..."
            @keyup.enter="handleAddBookmark"
          />
          <n-button size="small" type="primary" @click="handleAddBookmark">
            + Bookmark Now
          </n-button>
        </div>

        <div class="max-h-48 overflow-y-auto space-y-1.5">
          <div
            v-if="bookmarks.length === 0"
            class="py-6 text-center text-xs text-neutral-400"
          >
            No bookmarks saved for this track yet.
          </div>
          <div
            v-for="bm in bookmarks"
            :key="bm.id"
            class="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-green-500/10 transition group"
          >
            <button
              type="button"
              class="flex items-center gap-2.5 text-left flex-1 min-w-0"
              @click="jumpToBookmark(bm.time)"
            >
              <span class="px-2 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400 font-mono text-xs">
                {{ formatSec(bm.time) }}
              </span>
              <span class="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                {{ bm.label }}
              </span>
            </button>
            <button
              type="button"
              aria-label="Delete Bookmark"
              class="text-neutral-400 hover:text-red-500 px-1.5"
              @click="handleRemoveBookmark(bm.id)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import { nowTime, playMusic } from '@/hooks/MusicHook';
import { audioService } from '@/services/audioService';
import { secondToMinute } from '@/utils';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const abState = ref(audioService.getAbLoop());
const bookmarks = ref<Array<{ id: string; time: number; label: string }>>([]);
const bookmarkLabel = ref('');

function formatSec(sec: number): string {
  return secondToMinute(Math.floor(sec));
}

function refreshState() {
  abState.value = audioService.getAbLoop();
  if (playMusic.value?.id) {
    bookmarks.value = audioService.getBookmarks(playMusic.value.id);
  } else {
    bookmarks.value = [];
  }
}

watch(
  () => [props.show, playMusic.value?.id],
  () => {
    if (props.show) {
      refreshState();
    }
  },
  { immediate: true }
);

function handleSetA() {
  abState.value = audioService.setAbLoopPointA(audioService.getCurrentTime() || nowTime.value);
}

function handleSetB() {
  abState.value = audioService.setAbLoopPointB(audioService.getCurrentTime() || nowTime.value);
}

function handleClearAb() {
  abState.value = audioService.clearAbLoop();
}

function handleAddBookmark() {
  if (!playMusic.value?.id) return;
  const t = audioService.getCurrentTime() || nowTime.value;
  bookmarks.value = audioService.addBookmark(playMusic.value.id, t, bookmarkLabel.value);
  bookmarkLabel.value = '';
}

function jumpToBookmark(timeSec: number) {
  audioService.seek(timeSec);
  nowTime.value = Math.floor(timeSec);
}

function handleRemoveBookmark(id: string) {
  if (!playMusic.value?.id) return;
  bookmarks.value = audioService.removeBookmark(playMusic.value.id, id);
}
</script>
