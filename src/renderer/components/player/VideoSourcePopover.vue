<template>
  <div
    v-if="visible"
    class="video-source-popover-backdrop fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
    @click.self="close"
  >
    <div
      class="video-source-popover w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-neutral-900/95 text-white/90 border border-white/10 shadow-2xl backdrop-blur-2xl overflow-hidden transition-all duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-popover-title"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-xl">🎬</span>
          <h2 id="video-popover-title" class="text-base font-semibold tracking-tight text-white">
            Video Source & Media
          </h2>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
          @click="close"
        >
          <i class="ri-close-line text-lg"></i>
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="px-6 pt-3 pb-2 border-b border-white/5 shrink-0">
        <nav class="flex gap-1 p-1 bg-black/30 rounded-xl" aria-label="Popover tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
            :class="
              currentTab === tab.key
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            "
            @click="currentTab = tab.key as any"
          >
            <i :class="tab.icon"></i>
            <span>{{ tab.label }}</span>
            <span
              v-if="tab.badge !== undefined"
              class="px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 text-white font-mono"
            >
              {{ tab.badge }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Body / Tab Content -->
      <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm overscroll-contain">
        <!-- 1. PLAYBACK TAB -->
        <div v-show="currentTab === 'playback'" class="space-y-4">
          <div class="p-4 rounded-xl bg-white/5 border border-white/5 flex items-start gap-4">
            <div class="w-16 h-16 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
              <img
                v-if="activeThumbnail"
                :src="activeThumbnail"
                alt="Track art"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-2xl">🎵</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-white truncate">{{ song?.name || 'No track' }}</div>
              <div class="text-xs text-white/60 truncate mt-0.5">
                {{ songArtist }}
              </div>
              <div class="flex items-center gap-2 mt-2">
                <span
                  class="px-2 py-0.5 rounded text-[11px] font-medium"
                  :class="isVideoMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/70'"
                >
                  Mode: {{ isVideoMode ? 'Video' : 'Audio' }}
                </span>
                <span
                  v-if="currentYoutubeId"
                  class="px-2 py-0.5 rounded text-[11px] bg-red-500/20 text-red-300 font-mono"
                >
                  YT: {{ currentYoutubeId }}
                </span>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white/50">Playback Mode Switch</h3>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="p-3 rounded-xl border flex items-center justify-center gap-2 font-medium transition cursor-pointer"
                :class="
                  !isVideoMode
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                "
                @click="setAudioMode"
              >
                <i class="ri-music-2-line text-base"></i>
                <span>Audio Mode</span>
              </button>
              <button
                type="button"
                class="p-3 rounded-xl border flex items-center justify-center gap-2 font-medium transition cursor-pointer"
                :class="
                  isVideoMode
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                "
                @click="setVideoMode"
              >
                <i class="ri-video-line text-base"></i>
                <span>Video Mode</span>
              </button>
            </div>
          </div>

          <!-- Active link indicator or Quick Action -->
          <div v-if="!currentYoutubeId && !hasLocalVideoVariant" class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="ri-information-line text-base text-amber-400"></i>
              <span>No video source is currently linked to this track.</span>
            </div>
            <button
              type="button"
              class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition"
              @click="currentTab = 'search'"
            >
              Search
            </button>
          </div>
        </div>

        <!-- 2. SEARCH TAB -->
        <div v-show="currentTab === 'search'" class="space-y-4">
          <div>
            <label for="yt-search-input" class="block text-xs font-medium text-white/70 mb-1.5">
              Search YouTube
            </label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input
                  id="yt-search-input"
                  v-model="searchQuery"
                  type="text"
                  placeholder="Song title, artist or album..."
                  class="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40"
                  @keydown.enter="handleSearch"
                />
                <i class="ri-search-line absolute left-3 top-2.5 text-white/40 text-sm"></i>
              </div>
              <button
                type="button"
                class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                :disabled="isSearching || !searchQuery.trim()"
                @click="handleSearch"
              >
                <i v-if="isSearching" class="ri-loader-4-line animate-spin text-sm"></i>
                <span>{{ isSearching ? 'Searching...' : 'Search' }}</span>
              </button>
            </div>
          </div>

          <!-- Search results list -->
          <div class="space-y-2">
            <div v-if="isSearching" class="py-8 flex flex-col items-center justify-center text-white/50 gap-2">
              <i class="ri-loader-4-line animate-spin text-2xl text-emerald-400"></i>
              <span class="text-xs">Searching YouTube...</span>
            </div>

            <div v-else-if="searchResults.length > 0" class="space-y-2">
              <div
                v-for="item in searchResults"
                :key="item.id"
                class="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition flex items-center gap-3 cursor-pointer group"
                @click="linkSearchResult(item)"
              >
                <div class="relative w-24 aspect-video rounded-lg bg-black/50 overflow-hidden shrink-0">
                  <img
                    v-if="item.thumbnail"
                    :src="item.thumbnail"
                    alt=""
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span
                    v-if="item.durationSec"
                    class="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[10px] text-white/90 font-mono"
                  >
                    {{ formatVideoTime(item.durationSec) }}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-white/90 group-hover:text-emerald-400 transition truncate line-clamp-2">
                    {{ item.title }}
                  </div>
                  <div class="text-xs text-white/50 truncate mt-1 flex items-center gap-2">
                    <span>{{ item.channel || 'YouTube' }}</span>
                    <span v-if="item.viewCount">• {{ formatViews(item.viewCount) }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white transition shrink-0"
                  @click.stop="linkSearchResult(item)"
                >
                  {{ currentYoutubeId === item.id ? 'Linked' : 'Link' }}
                </button>
              </div>
            </div>

            <div v-else-if="hasSearched && searchResults.length === 0" class="py-6 text-center text-white/40 text-xs">
              No results found for "{{ searchQuery }}".
            </div>
          </div>
        </div>

        <!-- 3. LINK TAB -->
        <div v-show="currentTab === 'link'" class="space-y-4">
          <div>
            <label for="yt-link-input" class="block text-xs font-medium text-white/70 mb-1.5">
              Paste YouTube Video URL or ID
            </label>
            <div class="flex gap-2">
              <input
                id="yt-link-input"
                v-model="pastedUrl"
                type="text"
                placeholder="https://www.youtube.com/watch?v=... or Video ID"
                class="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-white/40 font-mono"
                @keydown.enter="handleLinkPasted"
              />
              <button
                type="button"
                class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
                :disabled="!extractedIdFromPaste"
                @click="handleLinkPasted"
              >
                Link Video
              </button>
            </div>
            <p v-if="extractedIdFromPaste" class="text-xs text-emerald-400 mt-1 font-mono">
              ✓ Valid YouTube ID: {{ extractedIdFromPaste }}
            </p>
          </div>

          <div v-if="currentYoutubeId" class="p-4 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
            <div class="text-white/50 uppercase tracking-wider text-[11px] font-semibold">Currently Linked</div>
            <div class="font-mono text-emerald-300 text-sm">https://youtu.be/{{ currentYoutubeId }}</div>
          </div>
        </div>

        <!-- 4. QUALITIES TAB -->
        <div v-show="currentTab === 'qualities'" class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wider text-white/60">Available Video Heights</h3>
              <p class="text-[11px] text-white/40">Click row to stream, or download for offline playback</p>
            </div>
            <button
              v-if="currentYoutubeId"
              type="button"
              class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
              :disabled="isLoadingFormats"
              @click="loadFormats"
            >
              <i class="ri-refresh-line" :class="{ 'animate-spin': isLoadingFormats }"></i>
              <span>Refresh</span>
            </button>
          </div>

          <div v-if="isLoadingFormats" class="py-8 flex flex-col items-center justify-center text-white/50 gap-2">
            <i class="ri-loader-4-line animate-spin text-2xl text-emerald-400"></i>
            <span class="text-xs">Inspecting stream qualities...</span>
          </div>

          <div v-else-if="!currentYoutubeId" class="py-6 text-center text-white/40 text-xs">
            Link a YouTube video first to inspect available stream qualities.
          </div>

          <div v-else class="space-y-2">
            <!-- Video Qualities -->
            <div
              v-for="row in qualityRows"
              :key="row.height"
              class="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between transition cursor-pointer group"
              :class="{
                'ring-1 ring-emerald-500 bg-emerald-500/10': selectedHeight === row.height
              }"
              @click="selectQualityRow(row)"
            >
              <div class="flex items-center gap-3">
                <span
                  class="px-2 py-1 rounded text-xs font-semibold font-mono"
                  :class="
                    selectedHeight === row.height
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/10 text-white/80 group-hover:bg-white/20'
                  "
                >
                  {{ row.label }}
                </span>
                <div>
                  <div class="text-xs text-white/80 font-mono">{{ row.detail }}</div>
                </div>
                <span
                  v-if="row.displaySize && row.displaySize !== '-- MB'"
                  class="px-2 py-0.5 rounded-md text-[11px] font-mono text-white/70 bg-black/30"
                  title="File size for this quality ( ~ marks an estimate )"
                >
                  {{ row.displaySize }}
                </span>
              </div>

              <div class="flex items-center gap-2" @click.stop>
                <!-- Downloaded indicator -->
                <span
                  v-if="isHeightDownloaded(row.height)"
                  class="px-2 py-0.5 rounded text-xs font-medium text-emerald-400 bg-emerald-500/10 flex items-center gap-1"
                >
                  <i class="ri-check-line"></i>
                  <span>downloaded</span>
                </span>

                <!-- Active download progress ring -->
                <div
                  v-else-if="downloadProgressMap[`video-${row.height}`]"
                  class="flex items-center gap-2 text-xs font-mono text-emerald-400"
                >
                  <i class="ri-loader-4-line animate-spin text-sm"></i>
                  <span>{{ downloadProgressMap[`video-${row.height}`].percent }}%</span>
                </div>

                <!-- Download button -->
                <button
                  v-else
                  type="button"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Download this quality to disk"
                  @click="downloadVideoQuality(row)"
                >
                  <i class="ri-download-line text-base"></i>
                </button>
              </div>
            </div>

            <!-- Audio Sub-list -->
            <div class="pt-4 border-t border-white/5 space-y-2">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-white/50">Audio Formats</h4>
              <div
                class="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between transition"
              >
                <div class="flex items-center gap-3">
                  <span class="px-2 py-1 rounded text-xs font-semibold font-mono bg-white/10 text-white/80">
                    Audio
                  </span>
                  <div class="text-xs text-white/80 font-mono">
                    m4a / opus • high bitrate
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    v-if="hasLocalAudioVariant"
                    class="px-2 py-0.5 rounded text-xs font-medium text-emerald-400 bg-emerald-500/10 flex items-center gap-1"
                  >
                    <i class="ri-check-line"></i>
                    <span>downloaded</span>
                  </span>
                  <div
                    v-else-if="downloadProgressMap['audio']"
                    class="flex items-center gap-2 text-xs font-mono text-emerald-400"
                  >
                    <i class="ri-loader-4-line animate-spin text-sm"></i>
                    <span>{{ downloadProgressMap['audio'].percent }}%</span>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Download audio only"
                    @click="downloadAudioOnly"
                  >
                    <i class="ri-download-line text-base"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. LINKED FILES TAB -->
        <div v-show="currentTab === 'linked'" class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white/60">
              Song Variants & Linked Files
            </h3>
            <span class="text-xs text-white/40 font-mono">{{ variants.length }} files</span>
          </div>

          <div v-if="variants.length === 0" class="py-6 text-center text-white/40 text-xs">
            No local or downloaded variants linked to this track.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="v in variants"
              :key="v.id"
              class="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 text-xs"
            >
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <i
                  class="text-base shrink-0"
                  :class="v.kind === 'video' ? 'ri-video-line text-blue-400' : 'ri-music-2-line text-emerald-400'"
                ></i>
                <div class="min-w-0 flex-1">
                  <div class="font-medium text-white truncate flex items-center gap-2">
                    <span class="uppercase font-mono">{{ v.container || v.kind }}</span>
                    <span v-if="v.height" class="font-mono text-white/60">{{ v.height }}p</span>
                    <span v-if="v.bitrateKbps" class="font-mono text-white/60">{{ v.bitrateKbps }} kbps</span>
                    <span class="px-1.5 py-0.2 rounded bg-white/10 text-[10px] text-white/60">{{ v.source }}</span>
                  </div>
                  <div v-if="v.path" class="text-[11px] text-white/40 truncate font-mono mt-0.5" :title="v.path">
                    {{ v.path }}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-white/10 hover:bg-emerald-500 hover:text-white text-white/80 transition"
                  title="Play this variant"
                  @click="playVariant(v)"
                >
                  Play
                </button>
                <button
                  v-if="v.path"
                  type="button"
                  class="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition"
                  title="Reveal in folder"
                  @click="revealFile(v.path)"
                >
                  <i class="ri-folder-open-line text-sm"></i>
                </button>
                <button
                  type="button"
                  class="p-1 rounded text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition"
                  title="Unlink variant"
                  @click="unlinkVariant(v.id)"
                >
                  <i class="ri-delete-bin-line text-sm"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  type Song,
  type Variant,
  linkVariant,
  setYoutubeId,
  unlinkVariant as dbUnlinkVariant
} from '@/services/songLibrary';
import {
  type YtSearchResult,
  type YtVideoFormat,
  youtubeService
} from '@/services/youtubeService';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import {
  buildSearchQuery,
  formatVideoTime,
  formatViewCount,
  getUniqueVideoHeights
} from '@/utils/videoQualityHelpers';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    initialTab?: 'playback' | 'search' | 'link' | 'qualities' | 'linked';
    song: SongResult;
    isVideoMode?: boolean;
    selectedHeight?: number;
    currentYoutubeId?: string;
    variants?: Variant[];
    songRecord?: Song;
  }>(),
  {
    visible: false,
    initialTab: 'playback',
    isVideoMode: false,
    selectedHeight: 720,
    currentYoutubeId: '',
    variants: () => []
  }
);

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'setMode', mode: 'song' | 'video'): void;
  (e: 'selectQuality', height: number): void;
  (e: 'linkedYoutube', youtubeId: string): void;
  (e: 'playVariant', variant: Variant): void;
  (e: 'variantsUpdated'): void;
}>();

const currentTab = ref<'playback' | 'search' | 'link' | 'qualities' | 'linked'>('playback');

watch(
  () => props.initialTab,
  (newTab) => {
    if (newTab) currentTab.value = newTab;
  },
  { immediate: true }
);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.initialTab) currentTab.value = props.initialTab;
      initSearchQuery();
      if (props.currentYoutubeId) {
        loadFormats();
      }
    }
  }
);

// Navigation tabs
const tabs = computed(() => [
  { key: 'playback', label: 'Playback', icon: 'ri-play-circle-line' },
  { key: 'search', label: 'Search', icon: 'ri-search-line' },
  { key: 'link', label: 'Link', icon: 'ri-link' },
  { key: 'qualities', label: 'Qualities', icon: 'ri-hd-line' },
  {
    key: 'linked',
    label: 'Files',
    icon: 'ri-folder-music-line',
    badge: props.variants.length > 0 ? props.variants.length : undefined
  }
]);

// Song metadata display
const songArtist = computed(() => {
  if (Array.isArray(props.song?.ar)) {
    return props.song.ar.map((a: any) => a.name).join(' / ');
  }
  if (Array.isArray((props.song as any)?.artists)) {
    return (props.song as any).artists.map((a: any) => a.name).join(' / ');
  }
  if ((props.song as any)?.artist) return (props.song as any).artist;
  return 'Unknown Artist';
});

const activeThumbnail = computed(() => {
  return getImgUrl(props.song?.picUrl, '100y100');
});

const hasLocalVideoVariant = computed(() => {
  return props.variants.some((v) => v.kind === 'video' && Boolean(v.path));
});

const hasLocalAudioVariant = computed(() => {
  return props.variants.some((v) => v.kind === 'audio' && Boolean(v.path));
});

const close = () => {
  emit('update:visible', false);
};

const setAudioMode = () => {
  emit('setMode', 'song');
};

const setVideoMode = () => {
  emit('setMode', 'video');
};

// ----------------------------------------------------
// Search state & actions
// ----------------------------------------------------
const searchQuery = ref('');
const searchResults = ref<YtSearchResult[]>([]);
const isSearching = ref(false);
const hasSearched = ref(false);

const initSearchQuery = () => {
  if (!searchQuery.value) {
    searchQuery.value = buildSearchQuery(
      props.song?.name,
      props.song?.al?.name || (props.song as any)?.album,
      songArtist.value
    );
  }
};

const handleSearch = async () => {
  const query = searchQuery.value.trim();
  if (!query) return;

  isSearching.value = true;
  hasSearched.value = true;
  try {
    const results = await youtubeService.search(query, { type: 'video', limit: 12 });
    searchResults.value = results || [];
  } catch (err) {
    console.error('[VideoSourcePopover] Search failed:', err);
    window.$message?.error?.('YouTube search failed. Check your network or binary.');
  } finally {
    isSearching.value = false;
  }
};

const linkSearchResult = async (item: YtSearchResult) => {
  if (!item.id) return;
  await linkVideoId(item.id);
};

// ----------------------------------------------------
// Link pasted state & actions
// ----------------------------------------------------
const pastedUrl = ref('');

const extractedIdFromPaste = computed(() => {
  return youtubeService.extractVideoId(pastedUrl.value);
});

const handleLinkPasted = async () => {
  const id = extractedIdFromPaste.value;
  if (!id) return;
  await linkVideoId(id);
  pastedUrl.value = '';
};

const linkVideoId = async (id: string) => {
  try {
    const songId = props.songRecord?.id || (props.song as any)?.songId || props.song?.id;
    if (songId) {
      await setYoutubeId(String(songId), id);
    }

    const localPath = (props.song as any)?.localPath || (props.song as any)?.path;
    if (localPath) {
      await youtubeService.writeLink(localPath, `https://youtu.be/${id}`);
    }

    window.$message?.success?.('Linked to YouTube');
    emit('linkedYoutube', id);
    loadFormats();
    currentTab.value = 'qualities';
  } catch (err: any) {
    console.error('[VideoSourcePopover] Failed to link video:', err);
    window.$message?.error?.(err.message || 'Failed to link video');
  }
};

// ----------------------------------------------------
// Formats & Qualities
// ----------------------------------------------------
const rawVideoFormats = ref<YtVideoFormat[]>([]);
const isLoadingFormats = ref(false);

const qualityRows = computed(() => {
  return getUniqueVideoHeights(rawVideoFormats.value);
});

const loadFormats = async () => {
  const id = props.currentYoutubeId;
  if (!id) return;

  isLoadingFormats.value = true;
  try {
    const res = await youtubeService.getFormats(id);
    rawVideoFormats.value = res.video || [];
  } catch (err) {
    console.error('[VideoSourcePopover] Failed to fetch formats:', err);
    // Provide standard ladder fallback
    rawVideoFormats.value = [];
  } finally {
    isLoadingFormats.value = false;
  }
};

const selectQualityRow = (row: { height: number }) => {
  emit('selectQuality', row.height);
};

const isHeightDownloaded = (height: number) => {
  return props.variants.some((v) => v.kind === 'video' && v.height === height && Boolean(v.path));
};

// Download tracking
const downloadProgressMap = ref<Record<string, { percent: number; speed: string; state: string }>>({});

const downloadVideoQuality = async (row: { height: number; rawFormat?: YtVideoFormat }) => {
  const id = props.currentYoutubeId;
  if (!id) return;

  const key = `video-${row.height}`;
  downloadProgressMap.value[key] = { percent: 0, speed: '0B/s', state: 'downloading' };

  try {
    const localPath = (props.song as any)?.localPath || (props.song as any)?.path;
    const targetDir = await youtubeService.resolveDownloadDir(localPath);

    const { unsubscribe } = await youtubeService.downloadWithProgress(
      id,
      {
        kind: 'video',
        height: row.height,
        targetDir,
        embedLink: true
      },
      async (progress) => {
        downloadProgressMap.value[key] = {
          percent: progress.percent,
          speed: progress.speed,
          state: progress.state
        };

        if (progress.state === 'completed' && progress.filePath) {
          unsubscribe();
          delete downloadProgressMap.value[key];

          const songId = props.songRecord?.id || (props.song as any)?.songId || String(props.song?.id);
          if (songId) {
            await linkVariant(songId, {
              kind: 'video',
              source: 'download',
              path: progress.filePath,
              height: row.height,
              container: 'mp4',
              sizeBytes: row.rawFormat?.sizeBytes
            });
            emit('variantsUpdated');
            window.$message?.success?.(`Downloaded ${row.height}p video successfully`);
          }
        } else if (progress.state === 'error') {
          unsubscribe();
          delete downloadProgressMap.value[key];
          window.$message?.error?.(`Download failed: ${progress.error || 'Unknown error'}`);
        }
      }
    );
  } catch (err: any) {
    delete downloadProgressMap.value[key];
    window.$message?.error?.(err.message || 'Download initiation failed');
  }
};

const downloadAudioOnly = async () => {
  const id = props.currentYoutubeId;
  if (!id) return;

  const key = 'audio';
  downloadProgressMap.value[key] = { percent: 0, speed: '0B/s', state: 'downloading' };

  try {
    const localPath = (props.song as any)?.localPath || (props.song as any)?.path;
    const targetDir = await youtubeService.resolveDownloadDir(localPath);

    const { unsubscribe } = await youtubeService.downloadWithProgress(
      id,
      {
        kind: 'audio',
        audioFormat: 'm4a',
        targetDir,
        embedLink: true
      },
      async (progress) => {
        downloadProgressMap.value[key] = {
          percent: progress.percent,
          speed: progress.speed,
          state: progress.state
        };

        if (progress.state === 'completed' && progress.filePath) {
          unsubscribe();
          delete downloadProgressMap.value[key];

          const songId = props.songRecord?.id || (props.song as any)?.songId || String(props.song?.id);
          if (songId) {
            await linkVariant(songId, {
              kind: 'audio',
              source: 'download',
              path: progress.filePath,
              container: 'm4a'
            });
            emit('variantsUpdated');
            window.$message?.success?.('Downloaded audio variant successfully');
          }
        } else if (progress.state === 'error') {
          unsubscribe();
          delete downloadProgressMap.value[key];
          window.$message?.error?.(`Audio download failed: ${progress.error || 'Unknown error'}`);
        }
      }
    );
  } catch (err: any) {
    delete downloadProgressMap.value[key];
    window.$message?.error?.(err.message || 'Audio download failed');
  }
};

// ----------------------------------------------------
// Linked files actions
// ----------------------------------------------------
const playVariant = (variant: Variant) => {
  emit('playVariant', variant);
  close();
};

const revealFile = (filePath: string) => {
  if (window.ipcRenderer) {
    window.ipcRenderer.send('open-directory', filePath);
  }
};

const unlinkVariant = async (variantId: string) => {
  try {
    await dbUnlinkVariant(variantId);
    emit('variantsUpdated');
    window.$message?.info?.('Variant unlinked');
  } catch (err: any) {
    window.$message?.error?.(err.message || 'Failed to unlink');
  }
};

const formatViews = (count?: number) => {
  return formatViewCount(count);
};
</script>

<style scoped>
.overscroll-contain {
  overscroll-behavior: contain;
}
</style>
