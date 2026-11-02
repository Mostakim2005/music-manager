<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :z-index="9999999"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="listening-stats-modal p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl max-w-3xl w-[94vw] max-h-[88vh] flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <span class="p-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <i class="ri-disc-line text-lg" />
            </span>
            Listening Stats &amp; Replay Wrapped
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Personal listening analytics, top artists &amp; tracks, and playback history.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <n-button size="tiny" secondary type="error" @click="handleReset">
            <i class="ri-delete-bin-line mr-1" /> Reset Stats
          </n-button>
          <button
            type="button"
            aria-label="Close Listening Stats"
            class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition"
            @click="emit('update:show', false)"
          >
            <i class="ri-close-line text-xl" />
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="mt-4 flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl text-xs font-medium self-start">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          :class="activeTab === 'overview' ? 'bg-white dark:bg-neutral-700 text-green-600 dark:text-green-400 shadow-sm font-semibold' : 'text-neutral-600 dark:text-neutral-300'"
          @click="activeTab = 'overview'"
        >
          <i class="ri-pie-chart-line" /> Overview &amp; Cards
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          :class="activeTab === 'tracks' ? 'bg-white dark:bg-neutral-700 text-green-600 dark:text-green-400 shadow-sm font-semibold' : 'text-neutral-600 dark:text-neutral-300'"
          @click="activeTab = 'tracks'"
        >
          <i class="ri-music-2-line" /> Top Tracks ({{ summary.topTracks.slice(0, 10).length }})
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          :class="activeTab === 'artists' ? 'bg-white dark:bg-neutral-700 text-green-600 dark:text-green-400 shadow-sm font-semibold' : 'text-neutral-600 dark:text-neutral-300'"
          @click="activeTab = 'artists'"
        >
          <i class="ri-user-voice-line" /> Top Artists ({{ summary.topArtists.slice(0, 10).length }})
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          :class="activeTab === 'scrobbles' ? 'bg-white dark:bg-neutral-700 text-green-600 dark:text-green-400 shadow-sm font-semibold' : 'text-neutral-600 dark:text-neutral-300'"
          @click="activeTab = 'scrobbles'"
        >
          <i class="ri-history-line" /> Recent History ({{ summary.recentScrobbles.length }})
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="mt-4 flex-1 overflow-y-auto pr-1 min-h-[360px] space-y-4">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="space-y-4">
          <!-- 4 Summary Metric Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
              <span class="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1">
                <i class="ri-time-line text-amber-500" /> Total Time
              </span>
              <div class="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {{ formatListeningTime(summary.totalListenSeconds) }}
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
              <span class="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1">
                <i class="ri-play-circle-line text-green-500" /> Total Plays
              </span>
              <div class="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-green-600 dark:text-green-400">
                {{ summary.totalPlays.toLocaleString() }}
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
              <span class="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1">
                <i class="ri-user-star-line text-blue-500" /> Unique Artists
              </span>
              <div class="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                {{ uniqueArtistsCount.toLocaleString() }}
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
              <span class="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1">
                <i class="ri-file-music-line text-purple-500" /> Unique Tracks
              </span>
              <div class="mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400">
                {{ uniqueTracksCount.toLocaleString() }}
              </div>
            </div>
          </div>

          <!-- Highlight Preview: Top 3 Tracks & Top 3 Artists side-by-side -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Top 3 Tracks -->
            <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                  <i class="ri-trophy-line text-amber-500" /> Top Tracks
                </h4>
                <button
                  type="button"
                  class="text-xs text-green-500 hover:underline"
                  @click="activeTab = 'tracks'"
                >
                  View All (10) &rarr;
                </button>
              </div>

              <div v-if="summary.topTracks.length === 0" class="py-6 text-center text-xs text-neutral-400">
                No track playback stats recorded yet.
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="(t, i) in summary.topTracks.slice(0, 3)"
                  :key="t.id || i"
                  class="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-neutral-800/70 shadow-sm"
                >
                  <span
                    class="w-5 text-center font-bold text-xs"
                    :class="i === 0 ? 'text-amber-500' : i === 1 ? 'text-neutral-400' : 'text-amber-700'"
                  >
                    #{{ i + 1 }}
                  </span>
                  <img
                    v-if="t.picUrl"
                    :src="t.picUrl"
                    class="w-9 h-9 rounded-lg object-cover bg-neutral-200 dark:bg-neutral-700 shrink-0"
                    alt=""
                  />
                  <div v-else class="w-9 h-9 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 text-neutral-400">
                    <i class="ri-music-2-line" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {{ t.name }}
                    </div>
                    <div class="text-[11px] text-neutral-500 truncate">
                      {{ t.artist }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                      {{ t.plays }} plays
                    </div>
                    <div class="text-[10px] text-neutral-400 tabular-nums">
                      {{ formatListeningTime(t.seconds) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top 3 Artists -->
            <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                  <i class="ri-medal-line text-purple-500" /> Top Artists
                </h4>
                <button
                  type="button"
                  class="text-xs text-green-500 hover:underline"
                  @click="activeTab = 'artists'"
                >
                  View All (10) &rarr;
                </button>
              </div>

              <div v-if="summary.topArtists.length === 0" class="py-6 text-center text-xs text-neutral-400">
                No artist playback stats recorded yet.
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="(a, i) in summary.topArtists.slice(0, 3)"
                  :key="a.name || i"
                  class="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-neutral-800/70 shadow-sm"
                >
                  <span
                    class="w-5 text-center font-bold text-xs"
                    :class="i === 0 ? 'text-amber-500' : i === 1 ? 'text-neutral-400' : 'text-amber-700'"
                  >
                    #{{ i + 1 }}
                  </span>
                  <img
                    v-if="a.picUrl"
                    :src="a.picUrl"
                    class="w-9 h-9 rounded-full object-cover bg-neutral-200 dark:bg-neutral-700 shrink-0"
                    alt=""
                  />
                  <div v-else class="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 text-neutral-400">
                    <i class="ri-user-voice-line" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {{ a.name }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                      {{ a.plays }} plays
                    </div>
                    <div class="text-[10px] text-neutral-400 tabular-nums">
                      {{ formatListeningTime(a.seconds) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Tracks Tab -->
        <div v-else-if="activeTab === 'tracks'" class="space-y-2">
          <div v-if="summary.topTracks.length === 0" class="py-12 text-center text-xs text-neutral-400">
            No track playback stats recorded yet.
          </div>

          <div
            v-for="(t, i) in summary.topTracks.slice(0, 10)"
            :key="t.id || i"
            class="flex items-center gap-3 p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <span
              class="w-6 text-center font-bold text-xs font-mono"
              :class="i === 0 ? 'text-amber-500 text-sm' : i === 1 ? 'text-neutral-400' : i === 2 ? 'text-amber-700' : 'text-neutral-500'"
            >
              #{{ i + 1 }}
            </span>
            <img
              v-if="t.picUrl"
              :src="t.picUrl"
              class="w-10 h-10 rounded-xl object-cover bg-neutral-200 dark:bg-neutral-700 shrink-0 shadow-sm"
              alt=""
            />
            <div v-else class="w-10 h-10 rounded-xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 text-neutral-400">
              <i class="ri-music-2-line text-lg" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {{ t.name }}
              </div>
              <div class="text-[11px] text-neutral-500 truncate">
                {{ t.artist }}
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold font-mono tabular-nums">
                {{ t.plays }} {{ t.plays === 1 ? 'play' : 'plays' }}
              </div>
              <div class="text-[10px] text-neutral-400 mt-0.5 font-mono tabular-nums">
                {{ formatListeningTime(t.seconds) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Top Artists Tab -->
        <div v-else-if="activeTab === 'artists'" class="space-y-2">
          <div v-if="summary.topArtists.length === 0" class="py-12 text-center text-xs text-neutral-400">
            No artist playback stats recorded yet.
          </div>

          <div
            v-for="(a, i) in summary.topArtists.slice(0, 10)"
            :key="a.name || i"
            class="flex items-center gap-3 p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <span
              class="w-6 text-center font-bold text-xs font-mono"
              :class="i === 0 ? 'text-amber-500 text-sm' : i === 1 ? 'text-neutral-400' : i === 2 ? 'text-amber-700' : 'text-neutral-500'"
            >
              #{{ i + 1 }}
            </span>
            <img
              v-if="a.picUrl"
              :src="a.picUrl"
              class="w-10 h-10 rounded-full object-cover bg-neutral-200 dark:bg-neutral-700 shrink-0 shadow-sm"
              alt=""
            />
            <div v-else class="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 text-neutral-400">
              <i class="ri-user-voice-line text-lg" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {{ a.name }}
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold font-mono tabular-nums">
                {{ a.plays }} {{ a.plays === 1 ? 'play' : 'plays' }}
              </div>
              <div class="text-[10px] text-neutral-400 mt-0.5 font-mono tabular-nums">
                {{ formatListeningTime(a.seconds) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Scrobbles Tab -->
        <div v-else-if="activeTab === 'scrobbles'" class="space-y-1.5">
          <div v-if="summary.recentScrobbles.length === 0" class="py-12 text-center text-xs text-neutral-400">
            No playback events recorded yet.
          </div>

          <div
            v-for="(s, i) in summary.recentScrobbles"
            :key="i"
            class="flex items-center justify-between gap-3 p-2 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition text-xs"
          >
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <i class="ri-play-fill text-green-500 shrink-0" />
              <div class="truncate">
                <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ s.name }}</span>
                <span class="text-neutral-400 mx-1.5">&bull;</span>
                <span class="text-neutral-500">{{ s.artist }}</span>
              </div>
            </div>
            <div class="text-[11px] text-neutral-400 shrink-0 font-mono tabular-nums">
              {{ formatTimestamp(s.playedAt) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between flex-wrap gap-2">
        <div class="text-xs text-neutral-400">
          Saved locally in browser storage &bull; Private &amp; offline
        </div>
        <div class="flex items-center gap-2">
          <n-button size="small" type="primary" @click="emit('update:show', false)">
            Done
          </n-button>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  clearListeningStats,
  exportListeningStatsRaw,
  getListeningStatsSummary,
  type ListeningStatsData
} from '@/services/listeningStatsService';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
}>();

const activeTab = ref<'overview' | 'tracks' | 'artists' | 'scrobbles'>('overview');

const summary = ref(getListeningStatsSummary());
const rawData = ref<ListeningStatsData>(exportListeningStatsRaw());

const uniqueArtistsCount = computed(() => Object.keys(rawData.value.artists || {}).length);
const uniqueTracksCount = computed(() => Object.keys(rawData.value.tracks || {}).length);

function refreshData() {
  summary.value = getListeningStatsSummary();
  rawData.value = exportListeningStatsRaw();
}

function formatListeningTime(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) {
    return '0m';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatTimestamp(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

function handleReset() {
  if (window.confirm('Are you sure you want to reset all personal listening stats?')) {
    clearListeningStats();
    refreshData();
  }
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      refreshData();
      activeTab.value = 'overview';
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.listening-stats-modal {
  user-select: none;
}
</style>
