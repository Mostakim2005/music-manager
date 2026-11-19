<template>
  <div
    class="local-track-row group min-h-[64px] px-3 py-2 rounded-2xl flex items-center hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 transition-colors select-none cursor-pointer"
    :class="{ 'bg-primary/5 dark:bg-primary/10': isPlaying }"
    @dblclick="handlePlay"
  >
    <!-- 1. Track Index -->
    <div class="w-7 text-center font-mono text-xs text-neutral-400 dark:text-neutral-500 shrink-0 tabular-nums">
      <span>{{ index + 1 }}</span>
    </div>

    <!-- 2. Cover 48px with scaled 8px radius + animated playing bars overlay -->
    <div
      class="track-cover-box w-12 h-12 overflow-hidden shrink-0 bg-neutral-200/70 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-center relative ml-1 shadow-sm"
    >
      <img
        v-if="item.picUrl && !imageLoadError"
        :src="item.picUrl"
        alt="Cover"
        class="w-full h-full object-cover"
        @error="imageLoadError = true"
      />
      <i v-else class="ri-music-2-fill text-lg text-neutral-400 dark:text-neutral-500" />
      <div
        v-if="isPlaying && isPlay"
        class="absolute inset-0 bg-black/45 flex items-center justify-center"
      >
        <div class="playing-bars flex items-end justify-center gap-0.5 h-3.5">
          <span class="bar bar-1 bg-white w-0.5 rounded-full" />
          <span class="bar bar-2 bg-white w-0.5 rounded-full" />
          <span class="bar bar-3 bg-white w-0.5 rounded-full" />
        </div>
      </div>
    </div>

    <!-- 3. Title, Artist • Album, and Optional 3rd Metadata Row -->
    <div class="flex-1 min-w-0 flex flex-col justify-center px-3.5">
      <div
        class="text-[15px] font-semibold truncate transition-colors leading-snug"
        :class="isPlaying ? 'text-primary' : 'text-neutral-900 dark:text-white/85'"
        :title="item.name"
      >
        {{ item.name }}
      </div>
      <div
        class="text-[13px] truncate mt-0.5 text-neutral-600/80 dark:text-white/65"
        :title="subtitleLine"
      >
        {{ subtitleLine }}
      </div>
      <div
        v-if="showMetaRow && hasMetaChips"
        class="flex items-center flex-wrap gap-1.5 mt-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400"
      >
        <span
          v-if="formatBadge"
          class="px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-white/10 uppercase tracking-wide font-mono"
        >
          {{ formatBadge }}
        </span>
        <span
          v-if="hasLinkedVideo"
          class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
        >
          MV
        </span>
        <span
          v-if="playCountValue > 0"
          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-neutral-200/50 dark:bg-white/5 tabular-nums"
        >
          <i class="ri-play-mini-fill text-xs" />
          {{ playCountValue }}
        </span>
        <span
          v-if="ratingValue > 0"
          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 tabular-nums"
        >
          <i class="ri-star-fill text-[10px]" />
          {{ ratingValue }}
        </span>
      </div>
    </div>

    <!-- 4. Duration -->
    <div
      class="font-mono text-xs tabular-nums text-neutral-400 dark:text-neutral-500 shrink-0 px-3"
    >
      {{ formattedDuration }}
    </div>

    <!-- 5. Compact Icon Buttons Grouped Tightly on the Right (8px gap) -->
    <div class="flex items-center gap-2 shrink-0">
      <button
        type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition active:scale-95"
        :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        @click.stop="toggleFavorite"
      >
        <i
          class="text-base transition-colors"
          :class="isFavorite ? 'ri-heart-fill text-red-500' : 'ri-heart-line'"
        />
      </button>

      <button
        type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 hover:bg-primary hover:text-white transition active:scale-95 shadow-sm"
        :class="
          isPlaying && isPlay ? 'bg-primary text-white' : 'text-neutral-700 dark:text-neutral-300'
        "
        :title="isPlaying && isPlay ? 'Pause' : 'Play'"
        @click.stop="handlePlay"
      >
        <i class="text-base" :class="isPlaying && isPlay ? 'ri-pause-fill' : 'ri-play-fill'" />
      </button>

      <button
        type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 hover:bg-primary/20 hover:text-primary text-neutral-600 dark:text-neutral-300 transition active:scale-95 shadow-sm"
        title="Edit Metadata, Artwork & Filename"
        @click.stop="$emit('edit', entry)"
      >
        <i class="ri-edit-box-line text-sm" />
      </button>

      <button
        type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition active:scale-95"
        title="Remove from Local Library"
        @click.stop="$emit('remove', item)"
      >
        <i class="ri-delete-bin-line text-sm" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { getListeningStatsSummary } from '@/services/listeningStatsService';
import { usePlayerStore } from '@/store/modules/player';
import type { LocalMusicEntry } from '@/types/localMusic';
import type { SongResult } from '@/types/music';

const props = withDefaults(
  defineProps<{
    item: SongResult;
    entry: LocalMusicEntry;
    index: number;
    showMetaRow?: boolean;
    rating?: number;
  }>(),
  {
    showMetaRow: true,
    rating: 0
  }
);

const emit = defineEmits<{
  (e: 'play', item: SongResult): void;
  (e: 'edit', entry: LocalMusicEntry): void;
  (e: 'remove', item: SongResult): void;
}>();

const playerStore = usePlayerStore();
const imageLoadError = ref(false);

watch(
  () => props.item.picUrl,
  () => {
    imageLoadError.value = false;
  }
);

const isPlay = computed(() => playerStore.isPlay);
const isPlaying = computed(() => playerStore.playMusic?.id === props.item.id);

const isFavorite = computed(() => {
  const numericId = typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;
  return (
    playerStore.favoriteList.includes(numericId) ||
    playerStore.favoriteList.includes(props.item.id as any)
  );
});

function toggleFavorite() {
  const numericId = typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;
  if (isFavorite.value) {
    playerStore.removeFromFavorite(numericId);
    playerStore.removeFromFavorite(props.item.id as any);
  } else {
    playerStore.addToFavorite(numericId);
  }
}

const artistString = computed(() => {
  if (props.entry.artist && props.entry.artist !== 'Unknown Artist') {
    return props.entry.artist;
  }
  const arList = props.item.ar || props.item.song?.artists || [];
  if (arList.length > 0) {
    return arList.map((a: any) => a.name).join(' / ');
  }
  return 'Unknown Artist';
});

const subtitleLine = computed(() => {
  const album = props.entry.album?.trim();
  if (album && album !== 'Unknown Album') {
    return `${artistString.value} • ${album}`;
  }
  return artistString.value;
});

const formatBadge = computed(() => {
  const path = props.entry.filePath || '';
  const ext = path.split('.').pop()?.toUpperCase() || '';
  const bitrate = (props.entry as any).bitrate;
  if (ext && bitrate) {
    return `${ext} · ${Math.round(Number(bitrate))} kbps`;
  }
  return ext;
});

const hasLinkedVideo = computed(() => {
  const lower = (props.entry.filePath || '').toLowerCase();
  return Boolean(props.item.videoUrl || lower.endsWith('.mp4') || lower.endsWith('.webm'));
});

const playCountValue = computed(() => {
  try {
    const summary = getListeningStatsSummary();
    const match = summary.topTracks.find(
      (t) => String(t.id) === String(props.item.id) || t.name === props.item.name
    );
    return match?.plays || 0;
  } catch {
    return 0;
  }
});

const ratingValue = computed(() => {
  const r = props.rating || (props.entry as any).rating || 0;
  return Number.isFinite(r) ? Math.max(0, Math.min(5, Math.round(r))) : 0;
});

const hasMetaChips = computed(() =>
  Boolean(formatBadge.value || hasLinkedVideo.value || playCountValue.value > 0 || ratingValue.value > 0)
);

const formattedDuration = computed(() => {
  const ms = props.entry.duration || props.item.duration || props.item.dt || 0;
  if (!ms || isNaN(ms) || ms <= 0) return '00:00';
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
});

function handlePlay() {
  emit('play', props.item);
}
</script>

<style scoped>
.track-cover-box {
  border-radius: calc(8px * var(--namida-radius-mult, 1));
}

.playing-bars .bar {
  animation: equalize 1s ease-in-out infinite alternate;
}
.playing-bars .bar-1 {
  height: 60%;
  animation-delay: 0.1s;
}
.playing-bars .bar-2 {
  height: 100%;
  animation-delay: 0.3s;
}
.playing-bars .bar-3 {
  height: 40%;
  animation-delay: 0.2s;
}

@keyframes equalize {
  0% {
    height: 20%;
  }
  100% {
    height: 100%;
  }
}
</style>
