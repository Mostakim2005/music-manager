<template>
  <div class="history-page h-full flex flex-col">
    <!-- Header Section -->
    <div
      class="flex flex-col gap-4 px-6 pt-4 pb-2 flex-shrink-0"
      :class="setAnimationClass('animate__fadeInRight')"
      v-if="!isMobile"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('history.title') }}</h2>

        <button
          class="h-8 px-3 rounded-full bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors flex items-center gap-1.5"
          @click="handleNavigateToHeatmap"
        >
          <i class="ri-calendar-2-line"></i>
          {{ t('history.heatmapTitle') }}
        </button>
      </div>

      <div class="flex items-center justify-between gap-4">
        <!-- Category Tabs -->
        <div
          class="bg-gray-100 dark:bg-neutral-800 p-1 rounded-full inline-flex h-9 items-center overflow-x-auto no-scrollbar max-w-full"
        >
          <div
            v-for="tab in ['songs', 'playlists', 'albums', 'podcasts']"
            :key="tab"
            class="px-4 h-7 rounded-full text-xs font-medium cursor-pointer transition-all duration-300 flex items-center justify-center whitespace-nowrap"
            :class="
              currentCategory === tab
                ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            "
            @click="handleCategoryChange(tab as any)"
          >
            {{ t(`history.categoryTabs.${tab}`) }}
          </div>
        </div>

        <!-- Source Tabs (Local/Cloud) -->
        <div
          v-if="currentCategory !== 'podcasts'"
          class="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-full p-1 h-9 flex-shrink-0"
        >
          <button
            class="px-3 h-7 rounded-full text-xs font-medium transition-all duration-300"
            :class="
              currentTab === 'local'
                ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            "
            @click="handleTabChange('local')"
          >
            {{ t('history.tabs.local') }}
          </button>
          <button
            class="px-3 h-7 rounded-full text-xs font-medium transition-all duration-300"
            :class="
              currentTab === 'cloud'
                ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            "
            @click="handleTabChange('cloud')"
          >
            {{ t('history.tabs.cloud') }}
          </button>
        </div>
      </div>
    </div>

    <!-- List Content -->
    <div class="flex-grow min-h-0 px-2 mt-2" :class="setAnimationClass('animate__bounceInLeft')">
      <n-scrollbar ref="scrollbarRef" class="h-full pr-4" :size="100" @scroll="handleScroll">
        <div class="pb-24 space-y-1">
          <template v-if="currentCategory === 'songs'">
            <div
              v-for="(item, index) in displayList"
              :key="item.id"
              class="group flex items-center justify-between rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors p-1"
              :class="setAnimationClass('animate__bounceInRight')"
              :style="setAnimationDelay(index, 30)"
            >
              <song-item
                class="flex-1 !bg-transparent hover:!bg-transparent"
                :item="item"
                @play="handlePlay"
              />
              <template v-if="!isMobile">
                <div
                  class="px-4 text-xs text-gray-400 dark:text-gray-600 font-medium min-w-[60px] text-right"
                  v-show="currentTab === 'local'"
                >
                  {{ t('history.playCount', { count: item.count }) }}
                </div>
                <div
                  class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                  v-show="currentTab === 'local'"
                  @click="handleDelMusic(item)"
                >
                  <i class="ri-close-line text-lg"></i>
                </div>
              </template>
            </div>
          </template>

          <template v-if="currentCategory === 'playlists'">
            <playlist-item
              v-for="(item, index) in displayList"
              :key="item.id"
              :item="item"
              :show-count="currentTab === 'local'"
              :show-delete="currentTab === 'local'"
              class="rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              :class="setAnimationClass('animate__bounceInRight')"
              :style="setAnimationDelay(index, 30)"
              @click="handlePlaylistClick(item)"
              @delete="handleDelPlaylist(item)"
            />
          </template>

          <template v-if="currentCategory === 'albums'">
            <album-item
              v-for="(item, index) in displayList"
              :key="item.id"
              :item="item"
              :show-count="currentTab === 'local'"
              :show-delete="currentTab === 'local'"
              class="rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              :class="setAnimationClass('animate__bounceInRight')"
              :style="setAnimationDelay(index, 30)"
              @click="handleAlbumClick(item)"
              @delete="handleDelAlbum(item)"
            />
          </template>

          <template v-if="currentCategory === 'podcasts'">
            <div class="mb-4 px-2">
              <div
                class="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-full p-1 w-fit h-8"
              >
                <button
                  class="px-3 h-6 rounded-full text-xs font-medium transition-all duration-300"
                  :class="
                    currentPodcastSubTab === 'episodes'
                      ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  "
                  @click="
                    currentPodcastSubTab = 'episodes';
                    loadHistoryData();
                  "
                >
                  {{ t('history.podcastTabs.episodes') }}
                </button>
                <button
                  class="px-3 h-6 rounded-full text-xs font-medium transition-all duration-300"
                  :class="
                    currentPodcastSubTab === 'radios'
                      ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  "
                  @click="
                    currentPodcastSubTab = 'radios';
                    loadHistoryData();
                  "
                >
                  {{ t('history.podcastTabs.radios') }}
                </button>
              </div>
            </div>

            <div v-if="currentPodcastSubTab === 'episodes'">
              <div
                v-for="(item, index) in displayList"
                :key="item.id"
                class="group flex items-center justify-between rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors p-1"
                :class="setAnimationClass('animate__bounceInRight')"
                :style="setAnimationDelay(index, 30)"
              >
                <song-item
                  class="flex-1 !bg-transparent hover:!bg-transparent"
                  :item="mapDjProgramToSong(item)"
                  @play="handlePlayPodcast(item)"
                />
                <div
                  class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                  @click="handleDelPodcast(item)"
                >
                  <i class="ri-close-line text-lg"></i>
                </div>
              </div>
            </div>

            <div v-else>
              <div
                v-for="(item, index) in displayList"
                :key="item.id"
                class="group flex items-center justify-between rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                :class="setAnimationClass('animate__bounceInRight')"
                :style="setAnimationDelay(index, 30)"
              >
                <playlist-item
                  class="flex-1 !bg-transparent hover:!bg-transparent"
                  :item="mapPodcastRadioToPlaylistItem(item)"
                  @click="handlePodcastRadioClick(item)"
                />
                <div
                  class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-all opacity-0 group-hover:opacity-100 mr-2"
                  @click="handleDelPodcastRadio(item)"
                >
                  <i class="ri-close-line text-lg"></i>
                </div>
              </div>
            </div>
          </template>

          <div v-if="displayList.length === 0 && !loading" class="text-center py-12 text-gray-400">
            <div
              class="w-20 h-20 mx-auto rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4"
            >
              <i class="ri-history-line text-3xl text-gray-300 dark:text-gray-600"></i>
            </div>
            <p>{{ t('history.noData') }}</p>
          </div>

          <div v-if="loading" class="space-y-2 pt-2">
            <div
              v-for="i in 8"
              :key="i"
              class="flex items-center gap-4 rounded-xl p-2 animate-pulse"
            >
              <div class="h-12 w-12 rounded-xl bg-gray-200 dark:bg-neutral-800"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-neutral-800"></div>
                <div class="h-3 w-1/4 rounded bg-gray-200 dark:bg-neutral-800"></div>
              </div>
            </div>
          </div>

          <div
            v-if="noMore && displayList.length > 0"
            class="text-center py-8 text-sm text-gray-400 dark:text-gray-500"
          >
            {{ t('common.noMore') }}
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getRecentAlbums, getRecentPlaylists } from '@/api/user';
import AlbumItem from '@/components/common/AlbumItem.vue';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlaylistItem from '@/components/common/PlaylistItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { useUserStore } from '@/store/modules/user';
import type { SongResult } from '@/types/music';
import { isMobile, setAnimationClass, setAnimationDelay } from '@/utils';
import { mapDjProgramToSongResult } from '@/utils/podcastUtils';

interface HistoryRecord extends Partial<SongResult> {
  id: string | number;
  playTime?: number;
  score?: number;
  source?: string;
  count?: number;
  recordSource?: 'local' | 'cloud';
  sources?: ('local' | 'cloud')[];
}

const { t } = useI18n();
const message = useMessage();
const router = useRouter();
const playHistoryStore = usePlayHistoryStore();
const userStore = useUserStore();
const scrollbarRef = ref();
const loading = ref(false);
const noMore = ref(false);
const displayList = ref<any[]>([]);
const playerStore = usePlayerStore();
const hasLoaded = ref(false);
const currentCategory = ref<'songs' | 'playlists' | 'albums' | 'podcasts'>('songs');
const currentTab = ref<'local' | 'cloud'>('local');
const cloudRecords = ref<HistoryRecord[]>([]);
const cloudPlaylists = ref<any[]>([]);
const cloudAlbums = ref<any[]>([]);
const currentPodcastSubTab = ref<'episodes' | 'radios'>('episodes');

const pageSize = 100;
const currentPage = ref(1);

const getCloudRecords = async () => {
  return [];
};

const getCloudPlaylists = async () => {
  if (!userStore.hasRealAuth) {
    message.warning(t('history.needLogin'));
    return [];
  }

  try {
    const res = await getRecentPlaylists(100);
    if (res.data?.data?.list) {
      return res.data.data.list.map((item: any) => ({
        id: item.data?.id,
        name: item.data?.name,
        coverImgUrl: item.data?.coverImgUrl,
        picUrl: item.data?.picUrl,
        trackCount: item.data?.trackCount,
        playCount: item.data?.playCount,
        creator: item.data?.creator,
        playTime: item.playTime
      }));
    }
    return [];
  } catch (error: any) {
    console.error(t('history.getCloudRecordFailed'), error);
    if (error?.response?.status !== 301 && error?.response?.data?.code !== -2) {
      message.error(t('history.getCloudRecordFailed'));
    }
    return [];
  }
};

const getCloudAlbums = async () => {
  if (!userStore.hasRealAuth) {
    message.warning(t('history.needLogin'));
    return [];
  }

  try {
    const res = await getRecentAlbums(100);
    if (res.data?.data?.list) {
      return res.data.data.list.map((item: any) => ({
        id: item.data?.id,
        name: item.data?.name,
        picUrl: item.data?.picUrl,
        size: item.data?.size,
        artist: item.data?.artist,
        playTime: item.playTime
      }));
    }
    return [];
  } catch (error: any) {
    console.error(t('history.getCloudRecordFailed'), error);
    if (error?.response?.status !== 301 && error?.response?.data?.code !== -2) {
      message.error(t('history.getCloudRecordFailed'));
    }
    return [];
  }
};

const getCurrentList = (): any[] => {
  if (currentCategory.value === 'songs') {
    switch (currentTab.value) {
      case 'local':
        return playHistoryStore.musicHistory;
      case 'cloud':
        return cloudRecords.value.filter((item) => item.id);
    }
  } else if (currentCategory.value === 'playlists') {
    switch (currentTab.value) {
      case 'local':
        return playHistoryStore.playlistHistory;
      case 'cloud':
        return cloudPlaylists.value;
    }
  } else if (currentCategory.value === 'albums') {
    switch (currentTab.value) {
      case 'local':
        return playHistoryStore.albumHistory;
      case 'cloud':
        return cloudAlbums.value;
    }
  } else if (currentCategory.value === 'podcasts') {
    if (currentPodcastSubTab.value === 'episodes') {
      return playHistoryStore.podcastHistory;
    } else {
      return playHistoryStore.podcastRadioHistory;
    }
  }
  return [];
};

const handleCategoryChange = async (value: 'songs' | 'playlists' | 'albums' | 'podcasts') => {
  currentCategory.value = value;
  currentPage.value = 1;
  noMore.value = false;
  displayList.value = [];

  if (value === 'podcasts') {
    currentTab.value = 'local';
  }

  if (currentTab.value === 'cloud') {
    loading.value = true;
    if (value === 'songs' && cloudRecords.value.length === 0) {
      cloudRecords.value = await getCloudRecords();
    } else if (value === 'playlists' && cloudPlaylists.value.length === 0) {
      cloudPlaylists.value = await getCloudPlaylists();
    } else if (value === 'albums' && cloudAlbums.value.length === 0) {
      cloudAlbums.value = await getCloudAlbums();
    }
    loading.value = false;
  }

  await loadHistoryData();
};

const handlePlaylistClick = async (item: any) => {
  try {
    navigateToMusicList(router, {
      id: item.id,
      type: 'playlist',
      name: item.name,
      listInfo: item,
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to open playlist:', error);
    message.error('Failed to open playlist');
  }
};

const handleAlbumClick = async (item: any) => {
  try {
    navigateToMusicList(router, {
      id: item.id,
      type: 'album',
      name: item.name,
      listInfo: {
        ...item,
        coverImgUrl: item.picUrl || item.coverImgUrl
      },
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to open album:', error);
    message.error('Failed to open album');
  }
};

const handleDelPlaylist = (item: any) => {
  playHistoryStore.delPlaylist(item);
  displayList.value = displayList.value.filter((playlist) => playlist.id !== item.id);
};

const handleDelAlbum = (item: any) => {
  playHistoryStore.delAlbum(item);
  displayList.value = displayList.value.filter((album) => album.id !== item.id);
};

const mapDjProgramToSong = (program: any): SongResult => {
  return mapDjProgramToSongResult(program);
};

const mapPodcastRadioToPlaylistItem = (radio: any) => {
  return {
    id: radio.id,
    name: radio.name,
    picUrl: radio.picUrl,
    coverImgUrl: radio.picUrl,
    desc: radio.dj?.nickname || radio.desc,
    type: 'podcast'
  };
};

const handlePlayPodcast = (item: any) => {
  const song = mapDjProgramToSong(item);
  playerStore.prepareSongPlayback(song);
};

const handlePodcastRadioClick = (item: any) => {
  router.push({
    name: 'podcastRadio',
    params: { id: item.id }
  });
};

const handleDelPodcast = (item: any) => {
  playHistoryStore.delPodcast(item);
  displayList.value = displayList.value.filter((p) => p.id !== item.id);
};

const handleDelPodcastRadio = (item: any) => {
  playHistoryStore.delPodcastRadio(item);
  displayList.value = displayList.value.filter((r) => r.id !== item.id);
};

const loadHistoryData = async () => {
  const currentList = getCurrentList();
  if (currentList.length === 0) {
    displayList.value = [];
    return;
  }

  loading.value = true;
  try {
    const startIndex = (currentPage.value - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentPageItems = currentList.slice(startIndex, endIndex);

    if (currentCategory.value === 'songs') {
      // Filter out legacy Netease entries gracefully; keep local and YouTube songs
      const validSongs: SongResult[] = [];

      currentPageItems.forEach((item) => {
        if (typeof item.id === 'string' && item.source !== 'netease') {
          validSongs.push(item as SongResult);
        }
      });

      const newSongs = validSongs;

      if (currentPage.value === 1) {
        displayList.value = newSongs;
      } else {
        displayList.value = [...displayList.value, ...newSongs];
      }
    } else {
      if (currentPage.value === 1) {
        displayList.value = currentPageItems;
      } else {
        displayList.value = [...displayList.value, ...currentPageItems];
      }
    }

    const totalLength = getCurrentList().length;
    noMore.value = displayList.value.length >= totalLength;
  } catch (error) {
    console.error(t('history.getHistoryFailed'), error);
  } finally {
    loading.value = false;
  }
};

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, offsetHeight } = e.target;
  const threshold = 100;

  if (!loading.value && !noMore.value && scrollHeight - (scrollTop + offsetHeight) < threshold) {
    currentPage.value++;
    loadHistoryData();
  }
};

const handlePlay = (song: SongResult) => {
  playerStore.prepareSongPlayback(song, displayList.value);
};

const handleTabChange = async (value: 'local' | 'cloud') => {
  currentTab.value = value;
  currentPage.value = 1;
  noMore.value = false;
  displayList.value = [];

  if (value === 'cloud') {
    loading.value = true;
    if (currentCategory.value === 'songs' && cloudRecords.value.length === 0) {
      cloudRecords.value = await getCloudRecords();
    } else if (currentCategory.value === 'playlists' && cloudPlaylists.value.length === 0) {
      cloudPlaylists.value = await getCloudPlaylists();
    } else if (currentCategory.value === 'albums' && cloudAlbums.value.length === 0) {
      cloudAlbums.value = await getCloudAlbums();
    }
    loading.value = false;
  }

  await loadHistoryData();
};

onMounted(async () => {
  if (!hasLoaded.value) {
    await loadHistoryData();
    hasLoaded.value = true;
  }
});

watch(
  () => [
    playHistoryStore.musicHistory,
    playHistoryStore.playlistHistory,
    playHistoryStore.albumHistory,
    playHistoryStore.podcastHistory,
    playHistoryStore.podcastRadioHistory
  ],
  async () => {
    if (hasLoaded.value) {
      currentPage.value = 1;
      noMore.value = false;
      await loadHistoryData();
    }
  },
  { deep: true }
);

const handleDelMusic = async (item: SongResult) => {
  playHistoryStore.delMusic(item);
  displayList.value = displayList.value.filter((music) => music.id !== item.id);
};

const handleNavigateToHeatmap = () => {
  router.push('/heatmap');
};
</script>

<style scoped lang="scss">
/* Minimal scoped styles */
</style>
