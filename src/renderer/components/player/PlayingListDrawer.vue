<template>
  <div v-if="internalVisible" class="fixed-overlay" @click="closePanel"></div>

  <div
    v-if="internalVisible"
    class="playlist-panel"
    :class="[
      'animate__animated',
      closing
        ? isMobile
          ? 'animate__slideOutDown'
          : 'animate__slideOutRight'
        : isMobile
          ? 'animate__slideInUp'
          : 'animate__slideInRight'
    ]"
    @animationend="onAnimationEnd"
  >
    <div class="playlist-panel-header">
      <div class="title">{{ t('player.playBar.playList') }}</div>
      <div class="header-actions">
        <n-tooltip v-if="playList.length > 0" trigger="hover">
          <template #trigger>
            <div class="action-btn" @click="showSaveQueueInput = !showSaveQueueInput">
              <i class="iconfont ri-bookmark-line"></i>
            </div>
          </template>
          Save Queue Snapshot
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <div class="action-btn" @click="handleClearPlaylist">
              <i class="iconfont ri-delete-bin-line"></i>
            </div>
          </template>
          {{ t('player.playList.clearAll') }}
        </n-tooltip>
        <div class="close-btn" @click="closePanel">
          <i class="iconfont ri-close-line"></i>
        </div>
      </div>
    </div>

    <!-- Saved Queues Bar -->
    <div
      v-if="showSaveQueueInput || savedQueues.length > 0"
      class="px-3 py-2 border-b border-gray-100 dark:border-gray-800 space-y-2 text-xs shrink-0"
    >
      <div v-if="showSaveQueueInput && playList.length > 0" class="flex items-center gap-1.5">
        <n-input
          v-model:value="newQueueName"
          size="tiny"
          placeholder="Queue name..."
          clearable
          @keydown.enter="handleSaveCurrentQueue"
        />
        <n-button size="tiny" type="primary" @click="handleSaveCurrentQueue">Save</n-button>
      </div>
      <n-scrollbar v-if="savedQueues.length > 0" x-scrollable>
        <div class="flex items-center gap-1.5 whitespace-nowrap pb-0.5">
          <div
            v-for="q in savedQueues"
            :key="q.id"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-primary/15 transition-colors"
            @click="loadSavedQueue(q)"
          >
            <i class="ri-play-list-2-line text-[11px] text-primary" />
            <span>{{ q.name }} ({{ q.songs.length }})</span>
            <button
              type="button"
              class="ml-0.5 text-gray-400 hover:text-red-500"
              title="Delete Saved Queue"
              @click.stop="removeSavedQueue(q.id)"
            >
              <i class="ri-close-line text-[11px]" />
            </button>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <!-- Undo Clear Banner -->
    <div
      v-if="lastClearedCount > 0"
      class="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-600 dark:text-amber-300 shrink-0"
    >
      <span>Queue cleared ({{ lastClearedCount }} tracks)</span>
      <n-button size="tiny" type="warning" secondary @click="handleUndoClear">
        Undo Clear
      </n-button>
    </div>

    <div class="playlist-panel-content">
      <div v-if="playList.length === 0" class="empty-playlist">
        <i class="iconfont ri-music-2-line"></i>
        <p>{{ t('player.playList.empty') }}</p>
      </div>
      <n-virtual-list
        v-else
        ref="playListRef"
        style="height: 100%"
        :item-size="62"
        item-resizable
        :items="playList"
      >
        <template #default="{ item }">
          <div class="music-play-list-content">
            <div class="flex items-center justify-between">
              <song-item :key="item.id" class="flex-1" :item="item" mini></song-item>
              <div class="delete-btn" @click.stop="handleDeleteSong(item)">
                <i
                  class="iconfont ri-delete-bin-line text-gray-400 hover:text-red-500 transition-colors"
                ></i>
              </div>
            </div>
          </div>
        </template>
      </n-virtual-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import SongItem from '@/components/common/SongItem.vue';
import {
  deleteSavedQueue,
  listSavedQueues,
  type SavedQueueRecord,
  saveNamedQueue
} from '@/services/songLibrary';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { isMobile } from '@/utils';
import { minifySongList } from '@/utils/persistedSong';

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const playerStore = usePlayerStore();

const internalVisible = ref(false);
const closing = ref(false);
const savedQueues = ref<SavedQueueRecord[]>([]);
const showSaveQueueInput = ref(false);
const newQueueName = ref('');

async function refreshSavedQueues() {
  try {
    savedQueues.value = await listSavedQueues();
  } catch {
    savedQueues.value = [];
  }
}

watch(
  () => playerStore.playListDrawerVisible,
  (val) => {
    if (val) {
      void refreshSavedQueues();
    }
  },
  { immediate: true }
);

const lastClearedCount = computed(() => playerStore.lastClearedQueue?.list?.length || 0);

async function handleSaveCurrentQueue() {
  if (playList.value.length === 0) return;
  const label = newQueueName.value.trim() || `Queue (${playList.value.length})`;
  await saveNamedQueue({
    name: label,
    songs: minifySongList(playList.value),
    currentIndex: playerStore.playListIndex
  });
  newQueueName.value = '';
  showSaveQueueInput.value = false;
  await refreshSavedQueues();
  message.success(`Saved queue "${label}".`);
}

function loadSavedQueue(q: SavedQueueRecord) {
  if (!Array.isArray(q.songs) || q.songs.length === 0) {
    message.info('Saved queue is empty.');
    return;
  }
  playerStore.setPlayList(q.songs as SongResult[], false, false, true);
  const idx = Math.min(Math.max(0, q.currentIndex || 0), q.songs.length - 1);
  if (q.songs[idx]) {
    void playerStore.setPlayMusic(q.songs[idx] as SongResult);
  }
  message.success(`Loaded "${q.name}" (${q.songs.length} tracks).`);
}

async function removeSavedQueue(id: string) {
  await deleteSavedQueue(id);
  await refreshSavedQueues();
}

function handleUndoClear() {
  if (playerStore.undoClearPlayAll()) {
    message.success('Restored cleared queue.');
  }
}

const show = computed({
  get: () => playerStore.playListDrawerVisible,
  set: (value) => {
    playerStore.setPlayListDrawerVisible(value);
  }
});

watch(
  show,
  (newValue) => {
    if (newValue) {
      internalVisible.value = true;
      closing.value = false;
      nextTick(() => {
        scrollToCurrentSong();
      });
    } else {
      if (!internalVisible.value) return;

      closing.value = true;
    }
  },
  { immediate: true }
);

const playList = computed(() => playerStore.playList as SongResult[]);

const playListRef = ref<any>(null);

const closePanel = () => {
  show.value = false;
};

const onAnimationEnd = () => {
  if (closing.value) {
    internalVisible.value = false;
  }
};

const handleClearPlaylist = () => {
  if (playList.value.length === 0) {
    message.info(t('player.playList.alreadyEmpty'));
    return;
  }

  if (isMobile.value) {
    closePanel();
  }

  dialog.warning({
    title: t('player.playList.clearConfirmTitle'),
    content: t('player.playList.clearConfirmContent'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    style: { zIndex: 999999999 },
    onPositiveClick: () => {
      playerStore.clearPlayAll();
      message.success(t('player.playList.cleared'));
    }
  });
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && internalVisible.value) {
    closePanel();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

const scrollToCurrentSong = () => {
  setTimeout(() => {
    if (playListRef.value && playList.value.length > 0) {
      const index = playerStore.playListIndex;
      console.log('Scrolled to song index:', index);
      playListRef.value.scrollTo({
        top: (index > 3 ? index - 3 : 0) * 62
      });
    }
  }, 100);
};

const handleDeleteSong = (song: SongResult) => {
  playerStore.removeFromPlayList(song.id as number);
};
</script>

<style lang="scss" scoped>
.fixed-overlay {
  @apply fixed inset-0 z-[999999];
  pointer-events: auto;
  cursor: default;
}

.playlist-panel {
  @apply fixed right-0 z-[9999999] rounded-l-xl overflow-hidden flex flex-col;
  width: 350px;
  height: 70vh;
  top: 15vh;
  animation-duration: 0.4s !important;

  @apply bg-light dark:bg-dark shadow-2xl dark:border dark:border-gray-700;

  &-header {
    @apply flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-900 shrink-0;
    backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.7);

    .dark & {
      background-color: rgba(18, 18, 18, 0.7);
    }

    .title {
      @apply text-base font-medium text-gray-800 dark:text-gray-200;
    }

    .header-actions {
      @apply flex items-center;
    }

    .action-btn,
    .close-btn {
      @apply w-8 h-8 flex items-center justify-center rounded-full cursor-pointer mx-1 text-gray-800 dark:text-gray-200;
      @apply hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;

      .iconfont {
        @apply text-xl;
      }
    }

    .action-btn {
      @apply text-gray-500 dark:text-gray-400;
      &:hover {
        @apply text-red-500 dark:text-red-400;
      }
    }
  }

  &-content {
    @apply flex-1 min-h-0 overflow-hidden;
  }
}

.empty-playlist {
  @apply flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500;

  .iconfont {
    @apply text-5xl mb-4;
  }

  p {
    @apply text-sm;
  }
}

.music-play-list-content {
  @apply pr-2 hover:bg-light-100 dark:hover:bg-dark-100;
  &:hover {
    .delete-btn {
      @apply visible;
    }
  }
  .delete-btn {
    @apply pr-2 cursor-pointer invisible;
    .iconfont {
      @apply text-lg;
    }
  }
}

@media (max-width: 768px) {
  .playlist-panel {
    position: fixed;
    width: 100%;
    height: 80vh;
    top: auto;
    bottom: 0;
    border-radius: 30px 30px 0 0;
    border-left: none;
    border-top: 1px solid theme('colors.gray.200');
    box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.1);

    &-header {
      @apply text-center relative px-4;

      &::before {
        content: '';
        position: absolute;
        top: -15px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 5px;
        border-radius: 5px;
        background-color: rgba(150, 150, 150, 0.3);
      }
    }

    &-content {
      height: auto;
      @apply px-4 flex-1 min-h-0;
      .delete-btn {
        @apply visible;
      }
    }
  }
}
</style>
