<template>
  <div class="home-container h-full w-full bg-white dark:bg-black transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="home-content w-full pb-32 pt-8 page-padding max-w-6xl mx-auto space-y-10">
        <!-- Greeting Header -->
        <div class="greeting-header">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <i class="ri-music-2-fill text-xl" />
            </div>
            <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              {{ greeting }}
            </h1>
          </div>
          <p class="text-neutral-500 dark:text-neutral-400 text-sm md:text-base">
            Enjoy your local music collection, manage tags, and search for your favorite tunes.
          </p>
        </div>

        <!-- Quick Links -->
        <section class="quick-links-section">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-4">
            Quick Access
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Local Music Card -->
            <div
              class="quick-card group cursor-pointer p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/60 hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              @click="router.push('/local-music')"
            >
              <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <i class="ri-folder-music-fill text-2xl" />
              </div>
              <h3 class="text-base font-bold text-neutral-900 dark:text-white group-hover:text-primary transition-colors">
                Local Music
              </h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Browse your library, albums & folders
              </p>
            </div>

            <!-- Search Card -->
            <div
              class="quick-card group cursor-pointer p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/60 hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              @click="router.push('/search')"
            >
              <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <i class="ri-search-line text-2xl" />
              </div>
              <h3 class="text-base font-bold text-neutral-900 dark:text-white group-hover:text-primary transition-colors">
                Search
              </h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Find songs, artists and tracks
              </p>
            </div>

            <!-- Favorites Card -->
            <div
              class="quick-card group cursor-pointer p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/60 hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              @click="router.push('/favorite')"
            >
              <div class="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <i class="ri-heart-fill text-2xl" />
              </div>
              <h3 class="text-base font-bold text-neutral-900 dark:text-white group-hover:text-primary transition-colors">
                Favorites
              </h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Quickly play your starred tracks
              </p>
            </div>

            <!-- History Card -->
            <div
              class="quick-card group cursor-pointer p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/60 hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              @click="router.push('/history')"
            >
              <div class="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <i class="ri-history-line text-2xl" />
              </div>
              <h3 class="text-base font-bold text-neutral-900 dark:text-white group-hover:text-primary transition-colors">
                History
              </h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                View your recent listening history
              </p>
            </div>
          </div>
        </section>

        <!-- Continue Listening Section -->
        <section class="continue-listening-section">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white">
                Continue Listening
              </h2>
              <p class="text-xs md:text-sm text-neutral-500 dark:text-neutral-400">
                Pick up where you left off from your recent plays
              </p>
            </div>
            <button
              v-if="recentTracks.length > 0"
              class="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              @click="router.push('/history')"
            >
              <span>View all</span>
              <i class="ri-arrow-right-line" />
            </button>
          </div>

          <!-- Recent Tracks Grid -->
          <div v-if="recentTracks.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div
              v-for="(item, index) in recentTracks"
              :key="item.id || index"
              class="track-card group relative flex items-center gap-3.5 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/40 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 transition-all duration-200 cursor-pointer"
              @click="handlePlayTrack(item)"
            >
              <!-- Artwork -->
              <div class="relative w-14 h-14 rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex-shrink-0">
                <img
                  v-if="getCoverUrl(item)"
                  :src="getCoverUrl(item)"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  alt="cover"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-neutral-400">
                  <i class="ri-music-2-line text-2xl" />
                </div>
                <!-- Play overlay icon -->
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div class="w-8 h-8 rounded-full bg-white text-neutral-900 flex items-center justify-center shadow-md">
                    <i class="ri-play-fill text-lg ml-0.5" />
                  </div>
                </div>
              </div>

              <!-- Track Info -->
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-neutral-900 dark:text-white truncate group-hover:text-primary transition-colors">
                  {{ item.name || 'Unknown Track' }}
                </p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                  {{ getArtistName(item) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="empty-state p-10 rounded-2xl bg-neutral-50 dark:bg-neutral-900/30 border border-dashed border-neutral-200 dark:border-neutral-800 text-center flex flex-col items-center justify-center"
          >
            <div class="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3">
              <i class="ri-headphone-line text-2xl" />
            </div>
            <h3 class="text-base font-semibold text-neutral-900 dark:text-white mb-1">
              No recent playback yet
            </h3>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mb-4">
              Play songs from your local folders or search for music to build your listening history.
            </p>
            <button
              class="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-xs transition-colors shadow-sm"
              @click="router.push('/local-music')"
            >
              Open Local Music
            </button>
          </div>
        </section>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { NScrollbar } from 'naive-ui';

import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { getImgUrl } from '@/utils';

defineOptions({
  name: 'Home'
});

const router = useRouter();
const playerStore = usePlayerStore();
const playHistoryStore = usePlayHistoryStore();

// Time-based greeting
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
});

// Recent tracks from local playback history (up to 12)
const recentTracks = computed(() => {
  const history = playHistoryStore.musicHistory || [];
  return history.slice(0, 12);
});

const getCoverUrl = (item: any): string => {
  const url = item?.picUrl || item?.al?.picUrl || item?.coverImgUrl || item?.cover;
  if (!url) return '';
  return getImgUrl(url, '120y120');
};

const getArtistName = (item: any): string => {
  if (item?.ar && Array.isArray(item.ar)) {
    return item.ar.map((a: any) => a.name).join(' / ');
  }
  if (item?.artists && Array.isArray(item.artists)) {
    return item.artists.map((a: any) => a.name).join(' / ');
  }
  return item?.artist || 'Unknown Artist';
};

const handlePlayTrack = (track: any) => {
  const list = recentTracks.value;
  playerStore.prepareSongPlayback(track as any, list as any);
};
</script>

<style lang="scss" scoped>
.home-container {
  position: relative;
}
</style>
