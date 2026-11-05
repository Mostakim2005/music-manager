<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :z-index="9999999"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="local-track-editor-modal p-6 rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-2xl bg-white/90 dark:bg-neutral-900/90 text-neutral-900 dark:text-neutral-100 max-w-2xl w-[94vw] max-h-[90vh] overflow-y-auto"
    >
      <!-- Modal Header -->
      <div
        class="flex items-center justify-between pb-3.5 border-b border-neutral-200/60 dark:border-neutral-800/60"
      >
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <i class="ri-edit-box-line text-primary" />
            Edit Track Metadata, Artwork &amp; Filename
          </h3>
          <p
            class="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-lg mt-0.5"
            :title="entry?.filePath"
          >
            {{ entry?.filePath }}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close Editor"
          class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-500 transition"
          @click="emit('update:show', false)"
        >
          <i class="ri-close-line text-xl" />
        </button>
      </div>

      <!-- Auto-Fetch Action Bar (Tidy Button Group) -->
      <div
        class="mt-4 p-3 rounded-2xl bg-neutral-100/60 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/50"
      >
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-2">
            <n-button
              size="small"
              secondary
              type="primary"
              :loading="fetchingMeta"
              @click="handleAutoFetchMetadata"
            >
              <template #icon>
                <i class="ri-magic-line" />
              </template>
              Auto-Fetch Tags &amp; Artwork (iTunes / MusicBrainz)
            </n-button>

            <n-button
              size="small"
              secondary
              type="info"
              :loading="fetchingLyrics"
              @click="handleAutoFetchLyrics"
            >
              <template #icon>
                <i class="ri-translate-2" />
              </template>
              Auto-Fetch Synced Lyrics (LRCLIB)
            </n-button>
          </div>

          <span class="text-[11px] text-neutral-400">
            Click to auto-match metadata &amp; lyrics
          </span>
        </div>

        <!-- Matched Candidate Cards Preview -->
        <div
          v-if="metaCandidates.length > 0"
          class="mt-3 pt-3 border-t border-neutral-200/50 dark:border-neutral-700/50"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Select Match to Apply ({{ metaCandidates.length }} found):
            </span>
            <button
              type="button"
              class="text-xs text-neutral-400 hover:text-neutral-600 transition"
              @click="metaCandidates = []"
            >
              Dismiss
            </button>
          </div>

          <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            <div
              v-for="(cand, idx) in metaCandidates"
              :key="idx"
              class="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-neutral-800/70 border border-neutral-200/40 dark:border-neutral-700/40 hover:border-primary/50 transition cursor-pointer"
              @click="applyMetaCandidate(cand)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <img
                  v-if="cand.coverUrl"
                  :src="cand.coverUrl"
                  alt="Candidate Cover"
                  class="w-10 h-10 rounded-lg object-cover shrink-0 border border-neutral-200/50 dark:border-neutral-700/50"
                />
                <div
                  v-else
                  class="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0"
                >
                  <i class="ri-music-2-line text-neutral-400" />
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-medium text-neutral-900 dark:text-white truncate">
                    {{ cand.title }} — {{ cand.artist }}
                  </div>
                  <div class="text-[11px] text-neutral-500 truncate mt-0.5">
                    {{ cand.album }} {{ cand.year ? `(${cand.year})` : '' }} ·
                    <span
                      class="px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary font-medium"
                    >
                      {{ cand.source }}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary text-white hover:brightness-110 shrink-0 ml-2 shadow-sm transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Symmetric 2-Column Grid (Cover 180px Left, Fields Right) -->
      <div class="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 mt-5 items-start">
        <!-- Column 1: Artwork (180px) -->
        <div class="flex flex-col items-center w-full">
          <div
            class="w-[180px] h-[180px] rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/70 dark:border-neutral-700/70 shadow-sm flex items-center justify-center relative group"
          >
            <img
              v-if="coverPreviewUrl"
              :src="coverPreviewUrl"
              alt="Track Cover"
              class="w-full h-full object-cover"
              @error="handleCoverImageError"
            />
            <div v-else class="flex flex-col items-center justify-center text-neutral-400">
              <i class="ri-disc-line text-5xl opacity-60" />
              <span class="text-[11px] mt-1 text-neutral-400">No Artwork</span>
            </div>
          </div>

          <div class="flex flex-col gap-2 w-[180px] mt-3">
            <n-button size="tiny" secondary block @click="handleSelectLocalCover">
              <template #icon>
                <i class="ri-image-edit-line" />
              </template>
              Choose Image File
            </n-button>
            <n-input
              v-model:value="form.coverDataUrlOrPath"
              size="tiny"
              placeholder="Or paste Cover URL..."
              clearable
            />
          </div>
        </div>

        <!-- Column 2: Metadata Fields -->
        <div class="space-y-3.5 min-w-0">
          <!-- Physical Filename on Disk -->
          <div>
            <label class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Physical Filename on Disk (renames actual file)
            </label>
            <div class="flex items-center gap-1.5">
              <n-input
                v-model:value="form.newFileName"
                size="small"
                placeholder="File name on disk"
              />
              <span
                class="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200/50 dark:border-neutral-700/50 shrink-0"
              >
                {{ fileExt }}
              </span>
            </div>
          </div>

          <!-- Song Title & Artists -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Song Title
              </label>
              <n-input v-model:value="form.title" size="small" placeholder="Track title" />
            </div>
            <div>
              <label
                class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Artist(s) <span class="text-neutral-400 font-normal">(use ; or feat.)</span>
              </label>
              <n-input v-model:value="form.artist" size="small" placeholder="Artist name(s)" />
            </div>
          </div>

          <!-- Album, Year, Genre -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Album
              </label>
              <n-input v-model:value="form.album" size="small" placeholder="Album name" />
            </div>
            <div>
              <label
                class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Year
              </label>
              <n-input v-model:value="form.year" size="small" placeholder="YYYY" />
            </div>
            <div>
              <label
                class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Genre
              </label>
              <n-input v-model:value="form.genre" size="small" placeholder="e.g. Pop; Rock" />
            </div>
          </div>
        </div>
      </div>

      <!-- Embedded & Sidecar Synced Lyrics -->
      <div class="mt-5 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-2">
            <label class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Embedded &amp; Sidecar Synced Lyrics (.lrc)
            </label>
            <n-button size="tiny" secondary type="warning" @click="showLrcSync = true">
              <template #icon>
                <i class="ri-timer-flash-line" />
              </template>
              Tap Timestamp Maker (Sync Plain Lyrics)
            </n-button>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-neutral-500">Also save .lrc file next to audio</span>
            <n-switch v-model:value="form.saveSidecarLrc" size="small" />
          </div>
        </div>
        <n-input
          v-model:value="form.lyrics"
          type="textarea"
          :rows="5"
          placeholder="[00:01.00] Paste or auto-fetch synced LRC lyrics..."
          class="font-mono text-xs"
        />
      </div>

      <!-- Footer Actions -->
      <div
        class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60"
      >
        <n-button size="small" @click="emit('update:show', false)">Cancel</n-button>
        <n-button size="small" type="primary" :loading="saving" @click="handleSave">
          <template #icon>
            <i class="ri-save-3-line" />
          </template>
          Save Tags, Artwork &amp; Filename
        </n-button>
      </div>
    </div>
  </n-modal>

  <!-- Interactive LRC Synchronizer Modal -->
  <lrc-synchronizer-modal
    v-model:show="showLrcSync"
    :initial-lyrics="form.lyrics"
    :file-path="entry?.filePath"
    :track="entryTrack"
    @apply="(synced) => (form.lyrics = synced)"
  />
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, reactive, ref, watch } from 'vue';

import LrcSynchronizerModal from '@/components/common/LrcSynchronizerModal.vue';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import type { LocalMusicEntry } from '@/types/localMusic';
import { filePathToLocalUrl, toSongResult } from '@/utils/localMusicUtils';

const props = defineProps<{
  show: boolean;
  entry: LocalMusicEntry | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'saved', updatedEntry: LocalMusicEntry, oldId: string): void;
}>();

const { message } = createDiscreteApi(['message']);
const playerStore = usePlayerStore();

const saving = ref(false);
const fetchingMeta = ref(false);
const fetchingLyrics = ref(false);
const showLrcSync = ref(false);
const metaCandidates = ref<any[]>([]);
const coverImageBroken = ref(false);

const form = reactive({
  newFileName: '',
  title: '',
  artist: '',
  album: '',
  year: '',
  genre: '',
  lyrics: '',
  coverDataUrlOrPath: '',
  saveSidecarLrc: true
});

const fileExt = computed(() => {
  if (!props.entry?.filePath) return '';
  const idx = props.entry.filePath.lastIndexOf('.');
  return idx >= 0 ? props.entry.filePath.slice(idx) : '';
});

const entryTrack = computed(() => {
  return props.entry ? toSongResult(props.entry) : undefined;
});

const coverPreviewUrl = computed(() => {
  if (coverImageBroken.value) return '';

  if (form.coverDataUrlOrPath) {
    const raw = form.coverDataUrlOrPath.trim();
    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('data:') ||
      raw.startsWith('local://')
    ) {
      return raw;
    }
    return filePathToLocalUrl(raw);
  }

  if (props.entry?.coverPath) {
    return filePathToLocalUrl(props.entry.coverPath);
  }

  return '';
});

function handleCoverImageError() {
  coverImageBroken.value = true;
}

function initFormFromEntry(entry: LocalMusicEntry | null) {
  metaCandidates.value = [];
  coverImageBroken.value = false;
  if (!entry) return;

  const sep = entry.filePath.includes('\\') ? '\\' : '/';
  const base = entry.filePath.split(sep).pop() || entry.filePath;
  const dotIdx = base.lastIndexOf('.');
  form.newFileName = dotIdx > 0 ? base.slice(0, dotIdx) : base;
  form.title = entry.title || '';
  form.artist = entry.artist || '';
  form.album = entry.album || '';
  form.year = '';
  form.genre = '';
  form.lyrics = entry.lyrics || '';
  form.coverDataUrlOrPath = '';
  form.saveSidecarLrc = true;
}

watch(
  () => [props.show, props.entry],
  ([show]) => {
    if (show && props.entry) {
      initFormFromEntry(props.entry);
    }
  },
  { immediate: true }
);

async function handleSelectLocalCover() {
  try {
    const res = await window.electron.ipcRenderer.invoke('local-music:select-cover-file');
    if (res && !res.canceled && (res.dataUrl || res.filePath)) {
      form.coverDataUrlOrPath = res.dataUrl || res.filePath;
      coverImageBroken.value = false;
    }
  } catch (err) {
    message.error(`Failed to select cover image: ${String(err)}`);
  }
}

async function handleAutoFetchMetadata() {
  const queryTitle = form.title.trim() || (props.entry ? props.entry.title : '');
  const queryArtist = form.artist.trim() || (props.entry ? props.entry.artist : '');

  if (!queryTitle && !queryArtist) {
    message.warning('Please enter a song title or artist first.');
    return;
  }

  fetchingMeta.value = true;
  try {
    const res = await window.electron.ipcRenderer.invoke('metadata:fetch-online', {
      title: queryTitle,
      artist: queryArtist,
      album: form.album.trim() || undefined
    });
    const list = res?.results || [];
    if (list.length === 0) {
      message.info('No matching online metadata found.');
    } else {
      metaCandidates.value = list;
      applyMetaCandidate(list[0]);
      message.success(`Matched ${list.length} result(s) from ${list[0].source}.`);
    }
  } catch (err) {
    message.error(`Metadata fetch failed: ${String(err)}`);
  } finally {
    fetchingMeta.value = false;
  }
}

function applyMetaCandidate(cand: any) {
  if (cand.title) form.title = cand.title;
  if (cand.artist) form.artist = cand.artist;
  if (cand.album) form.album = cand.album;
  if (cand.year) form.year = String(cand.year);
  if (cand.genre) form.genre = cand.genre;
  if (cand.coverUrl) {
    form.coverDataUrlOrPath = cand.coverUrl;
    coverImageBroken.value = false;
  }
}

async function handleAutoFetchLyrics() {
  const queryTitle = form.title.trim() || (props.entry ? props.entry.title : '');
  const queryArtist = form.artist.trim() || (props.entry ? props.entry.artist : '');

  if (!queryTitle) {
    message.warning('Please enter a song title first.');
    return;
  }

  fetchingLyrics.value = true;
  try {
    const res = await window.electron.ipcRenderer.invoke('lyrics:fetch-multi-source', {
      title: queryTitle,
      artist: queryArtist,
      album: form.album.trim() || undefined,
      durationSec: props.entry?.duration ? Math.round(props.entry.duration / 1000) : undefined
    });
    if (res?.lrc) {
      form.lyrics = res.romalrc ? `${res.lrc}\n\n${res.romalrc}` : res.lrc;
      message.success(`Fetched lyrics via ${res.source || 'LRCLIB'}.`);
    } else {
      message.info('No synced or plain lyrics found for this track.');
    }
  } catch (err) {
    message.error(`Lyrics fetch failed: ${String(err)}`);
  } finally {
    fetchingLyrics.value = false;
  }
}

async function handleSave() {
  if (!props.entry) return;
  saving.value = true;

  // Check if this song is currently playing in the app
  const currentlyPlaying = playerStore.playMusic;
  const isThisSongPlaying =
    currentlyPlaying &&
    (currentlyPlaying.id === props.entry.id ||
      currentlyPlaying.playMusicUrl === filePathToLocalUrl(props.entry.filePath));
  const wasPlaying = isThisSongPlaying && !audioService.isPaused();
  const currentPos = isThisSongPlaying ? audioService.getCurrentTime() : 0;

  try {
    const res = await window.electron.ipcRenderer.invoke('local-music:update-tags-and-file', {
      filePath: props.entry.filePath,
      newFileName: form.newFileName.trim(),
      title: form.title.trim() || props.entry.title,
      artist: form.artist.trim() || props.entry.artist,
      album: form.album.trim() || props.entry.album,
      year: form.year.trim() || undefined,
      genre: form.genre.trim() || undefined,
      lyrics: form.lyrics || undefined,
      coverDataUrlOrPath: form.coverDataUrlOrPath || undefined,
      saveSidecarLrc: form.saveSidecarLrc
    });

    if (res?.ok && res.updatedEntry) {
      message.success('Tags, artwork, and filename saved successfully!');

      // If this song was playing, update the active song info and preserve playback
      if (isThisSongPlaying) {
        const updatedTrack = toSongResult({
          ...res.updatedEntry,
          id: props.entry.id
        });
        playerStore.setPlayMusic(updatedTrack);
        if (wasPlaying && currentPos > 0) {
          audioService.seek(currentPos);
        }
      }

      emit('saved', res.updatedEntry, props.entry.id);
      emit('update:show', false);
    } else {
      message.error(res?.error || 'Failed to update local file.');
    }
  } catch (err) {
    message.error(`Save failed: ${String(err)}`);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.local-track-editor-modal {
  user-select: none;
}
</style>
