<template>
  <div
    class="search-result-page h-full w-full bg-white dark:bg-black transition-colors duration-500"
  >
    <n-scrollbar class="h-full">
      <div class="search-result-content pb-32 max-w-6xl mx-auto page-padding-x pt-8">
        <!-- Header Section -->
        <section class="header-section pb-6 border-b border-neutral-100 dark:border-neutral-800/60">
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div>
                <h1
                  class="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white"
                >
                  {{ currentKeyword }}
                </h1>
                <p class="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  YouTube Online Search Results
                </p>
              </div>
              <button
                v-if="results.length > 0 && currentTab === 'music'"
                class="flex items-center gap-2 px-5 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-xs md:text-sm transition-all duration-200 shadow-md hover:scale-105 active:scale-95"
                @click="handlePlayAll"
              >
                <i class="ri-play-circle-line text-lg" />
                <span>Play All</span>
              </button>
            </div>

            <!-- Tabs: Songs vs Videos -->
            <div class="flex items-center gap-2 pt-2">
              <button
                v-for="tab in searchTabs"
                :key="tab.key"
                class="px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                :class="
                  currentTab === tab.key
                    ? 'bg-primary text-white shadow-md shadow-primary/25 scale-105'
                    : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                "
                @click="switchTab(tab.key)"
              >
                <i :class="tab.icon" class="mr-1.5" />
                {{ tab.label }}
              </button>
            </div>
          </div>
        </section>

        <!-- Results Section -->
        <section class="results-section mt-6">
          <n-spin :show="loading">
            <!-- Loading Skeleton -->
            <div v-if="loading && results.length === 0" class="space-y-4">
              <div
                v-for="i in 8"
                :key="i"
                class="flex items-center gap-4 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 animate-pulse"
              >
                <div
                  class="w-16 h-16 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex-shrink-0"
                />
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
                  <div class="h-3 w-1/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
                </div>
              </div>
            </div>

            <!-- Result Rows -->
            <div v-else-if="results.length > 0" class="space-y-2">
              <div
                v-for="item in results"
                :key="item.id"
                class="result-row group flex items-center justify-between p-3 rounded-2xl bg-neutral-50/60 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border border-neutral-100 dark:border-neutral-800/50 transition-all duration-200"
              >
                <!-- Left: Thumbnail & Info -->
                <div class="flex items-center gap-4 min-w-0 flex-1 pr-4">
                  <div
                    class="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-200 dark:bg-neutral-800 cursor-pointer shadow-sm group-hover:shadow"
                    @click="handlePlay(item)"
                  >
                    <img
                      :src="item.thumbnail || getFallbackThumbnail(item.id)"
                      :alt="item.title"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div
                      class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <i class="ri-play-fill text-white text-2xl" />
                    </div>
                    <span
                      v-if="item.durationSec"
                      class="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 text-[10px] text-white font-mono leading-none"
                    >
                      {{ formatDuration(item.durationSec) }}
                    </span>
                  </div>

                  <!-- Details -->
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-sm font-bold text-neutral-900 dark:text-white truncate cursor-pointer hover:text-primary transition-colors"
                      :title="item.title"
                      @click="handlePlay(item)"
                    >
                      {{ item.title }}
                    </div>
                    <div
                      class="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1"
                    >
                      <span class="truncate max-w-[200px] flex items-center gap-1 font-medium">
                        <i class="ri-user-line text-[11px]" />
                        {{ item.channel || 'YouTube' }}
                      </span>
                      <span v-if="item.viewCount" class="flex items-center gap-1 flex-shrink-0">
                        <i class="ri-eye-line text-[11px]" />
                        {{ formatViews(item.viewCount) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Right: Actions -->
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <!-- Play -->
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <button
                        class="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors"
                        @click="handlePlay(item)"
                      >
                        <i class="ri-play-line text-lg" />
                      </button>
                    </template>
                    Play
                  </n-tooltip>

                  <!-- Play Next -->
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <button
                        class="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors"
                        @click="handlePlayNext(item)"
                      >
                        <i class="ri-play-list-add-line text-lg" />
                      </button>
                    </template>
                    Play Next
                  </n-tooltip>

                  <!-- Add to Favorites -->
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <button
                        class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                        :class="
                          isFavorite(item.id)
                            ? 'text-rose-500 bg-rose-500/10'
                            : 'text-neutral-600 dark:text-neutral-300 hover:text-rose-500 hover:bg-neutral-200/70 dark:hover:bg-neutral-700'
                        "
                        @click="toggleFavorite(item)"
                      >
                        <i
                          :class="isFavorite(item.id) ? 'ri-heart-fill' : 'ri-heart-line'"
                          class="text-lg"
                        />
                      </button>
                    </template>
                    {{ isFavorite(item.id) ? 'Remove Favorite' : 'Add to Favorites' }}
                  </n-tooltip>

                  <!-- Download Button -->
                  <!-- Audio Download (Songs tab) -->
                  <n-tooltip v-if="currentTab === 'music'" trigger="hover">
                    <template #trigger>
                      <button
                        class="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors"
                        @click="handleAudioDownload(item)"
                      >
                        <i class="ri-download-2-line text-lg" />
                      </button>
                    </template>
                    Download Audio (M4A)
                  </n-tooltip>

                  <!-- Video Quality Picker & Download (Videos tab) -->
                  <n-popover
                    v-else
                    trigger="click"
                    placement="bottom-end"
                    @update:show="(show) => show && loadVideoFormats(item.id)"
                  >
                    <template #trigger>
                      <button
                        class="w-9 h-9 rounded-full flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-primary hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <i class="ri-download-2-line text-lg" />
                      </button>
                    </template>
                    <div class="quality-picker-popover p-2 min-w-[200px]">
                      <div
                        class="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-2 uppercase tracking-wider"
                      >
                        Select Video Quality
                      </div>
                      <div v-if="formatsLoading[item.id]" class="py-4 flex justify-center">
                        <n-spin size="small" />
                      </div>
                      <div v-else-if="availableFormats[item.id]?.length" class="space-y-1">
                        <button
                          v-for="fmt in availableFormats[item.id]"
                          :key="fmt.formatId || fmt.height"
                          class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors text-left"
                          @click="handleVideoDownload(item, fmt.height)"
                        >
                          <span class="font-bold">{{
                            `${fmt.height}p${fmt.fps > 30 ? fmt.fps : ''}`
                          }}</span>
                          <span class="text-neutral-400 text-[11px]">{{
                            formatFileSize(fmt.sizeBytes)
                          }}</span>
                        </button>
                      </div>
                      <div v-else class="text-xs text-neutral-400 px-2 py-1">
                        No qualities found
                      </div>
                    </div>
                  </n-popover>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="!loading"
              class="empty-state py-24 flex flex-col items-center justify-center text-center text-neutral-400"
            >
              <div
                class="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mb-4"
              >
                <i class="ri-search-line text-2xl opacity-40" />
              </div>
              <p class="text-base font-semibold text-neutral-600 dark:text-neutral-300">
                No results found for "{{ currentKeyword }}"
              </p>
              <p class="text-xs text-neutral-400 mt-1">
                Try different keywords or switch between Songs and Videos.
              </p>
            </div>
          </n-spin>
        </section>
      </div>
    </n-scrollbar>
    <play-bottom />
  </div>
</template>

<script lang="ts" setup>
import { NPopover, NScrollbar, NSpin, NTooltip, useMessage } from 'naive-ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import PlayBottom from '@/components/common/PlayBottom.vue';
import youtubeService, { type YtSearchResult, type YtVideoFormat } from '@/services/youtubeService';
import { useFavoriteStore } from '@/store/modules/favorite';
import { usePlayerStore } from '@/store/modules/player';
import { usePlaylistStore } from '@/store/modules/playlist';
import { useSearchStore } from '@/store/modules/search';
import type { SongResult } from '@/types/music';

defineOptions({
  name: 'SearchResult'
});

const route = useRoute();
const router = useRouter();
const message = useMessage();
const playerStore = usePlayerStore();
const playlistStore = usePlaylistStore();
const favoriteStore = useFavoriteStore();
const searchStore = useSearchStore();

const currentKeyword = computed(
  () => (route.query.keyword as string) || searchStore.searchValue || ''
);
const currentTab = ref<'music' | 'video'>('music');

const searchTabs = [
  { label: 'Songs', key: 'music' as const, icon: 'ri-music-2-line' },
  { label: 'Videos', key: 'video' as const, icon: 'ri-movie-line' }
];

const results = ref<YtSearchResult[]>([]);
const loading = ref(false);

const formatsLoading = reactive<Record<string, boolean>>({});
const availableFormats = reactive<Record<string, YtVideoFormat[]>>({});

const getFallbackThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatViews = (views?: number): string => {
  if (!views) return '';
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B views`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
};

const convertToSong = (item: YtSearchResult): SongResult => {
  const channel = item.channel || 'YouTube';
  const durationMs = (item.durationSec || 0) * 1000;
  const thumbnail = item.thumbnail || getFallbackThumbnail(item.id);

  return {
    id: item.id,
    name: item.title,
    picUrl: thumbnail,
    source: 'youtube' as any,
    ar: [{ id: 0, name: channel }] as any,
    artists: [{ id: 0, name: channel }] as any,
    al: { id: 0, name: channel, picUrl: thumbnail } as any,
    album: { id: 0, name: channel, picUrl: thumbnail } as any,
    duration: durationMs,
    dt: durationMs,
    count: 0
  };
};

const performSearch = async () => {
  const kw = currentKeyword.value.trim();
  if (!kw) {
    results.value = [];
    return;
  }

  loading.value = true;
  try {
    const list = await youtubeService.search(kw, {
      type: currentTab.value,
      limit: 30
    });
    // Race guard
    if (kw === currentKeyword.value.trim()) {
      results.value = list || [];
    }
  } catch (err: any) {
    console.error('YouTube search failed:', err);
    message.error(`Search error: ${err?.message || 'Failed to search YouTube'}`);
    results.value = [];
  } finally {
    loading.value = false;
  }
};

const switchTab = (tab: 'music' | 'video') => {
  if (currentTab.value === tab) return;
  currentTab.value = tab;
  searchStore.searchType = tab;
  router.replace({
    path: '/search-result',
    query: { keyword: currentKeyword.value, type: tab }
  });
  performSearch();
};

const handlePlay = (item: YtSearchResult) => {
  const song = convertToSong(item);
  playerStore.setPlayMusic(song);
};

const handlePlayAll = () => {
  if (results.value.length === 0) return;
  const songs = results.value.map(convertToSong);
  playlistStore.setPlayList(songs, true);
  playerStore.setPlayMusic(songs[0]);
  message.success(`Playing all ${songs.length} tracks`);
};

const handlePlayNext = (item: YtSearchResult) => {
  const song = convertToSong(item);
  playlistStore.addToNextPlay(song);
  message.success(`"${item.title}" will play next`);
};

const isFavorite = (id: string): boolean => {
  return favoriteStore.isFavorite(id);
};

const toggleFavorite = (item: YtSearchResult) => {
  if (isFavorite(item.id)) {
    favoriteStore.removeFromFavorite(item.id);
    message.info('Removed from Favorites');
  } else {
    favoriteStore.addToFavorite(item.id);
    message.success('Added to Favorites');
  }
};

const handleAudioDownload = async (item: YtSearchResult) => {
  try {
    message.loading(`Starting download: "${item.title}"...`, { duration: 2500 });
    const jobId = await youtubeService.download(item.id, {
      kind: 'audio',
      audioFormat: 'm4a',
      fileBaseName: `${item.title} - ${item.channel || 'YouTube'}`
    });
    message.success(`Download queued (ID: ${jobId.slice(0, 8)})`);
  } catch (err: any) {
    console.error('Audio download failed:', err);
    message.error(`Download failed: ${err.message || String(err)}`);
  }
};

const loadVideoFormats = async (id: string) => {
  if (availableFormats[id]?.length || formatsLoading[id]) return;
  formatsLoading[id] = true;
  try {
    const res = await youtubeService.getFormats(id);
    availableFormats[id] = res.video || [];
  } catch (err) {
    console.error('Failed to load video formats:', err);
  } finally {
    formatsLoading[id] = false;
  }
};

const handleVideoDownload = async (item: YtSearchResult, height?: number) => {
  try {
    message.loading(`Starting video download (${height || 'best'}p)...`, { duration: 2500 });
    const jobId = await youtubeService.download(item.id, {
      kind: 'video',
      height,
      fileBaseName: `${item.title} - ${item.channel || 'YouTube'}`
    });
    message.success(`Video download queued (ID: ${jobId.slice(0, 8)})`);
  } catch (err: any) {
    console.error('Video download failed:', err);
    message.error(`Download failed: ${err.message || String(err)}`);
  }
};

watch(
  () => route.query,
  (newQuery) => {
    const newKw = (newQuery.keyword as string) || '';
    const newType = (newQuery.type as string) || 'music';
    currentTab.value = newType === 'video' || newType === '1004' ? 'video' : 'music';
    if (newKw) {
      searchStore.searchValue = newKw;
      performSearch();
    }
  },
  { immediate: false }
);

onMounted(() => {
  const queryType = route.query.type as string;
  if (queryType === 'video' || queryType === '1004') {
    currentTab.value = 'video';
  } else {
    currentTab.value = 'music';
  }
  performSearch();
});
</script>

<style scoped>
.search-result-page {
  position: relative;
}
.result-row {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
