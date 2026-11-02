<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :z-index="9999999"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="local-track-editor-modal p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl max-w-2xl w-[92vw] max-h-[88vh] overflow-y-auto"
    >
      <div class="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white">
            Edit Track Metadata, Filename &amp; Artwork
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-md">
            {{ entry?.filePath }}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close Editor"
          class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
          @click="emit('update:show', false)"
        >
          <i class="ri-close-line text-xl" />
        </button>
      </div>

      <!-- Auto-Fetch Toolbar -->
      <div class="flex flex-wrap items-center gap-2 mt-4">
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
            <i class="ri-Translate-2" />
          </template>
          Auto-Fetch Synced Lyrics (LRCLIB: EN / JP Romaji / Bangla)
        </n-button>
      </div>

      <!-- Online Metadata Candidates -->
      <div
        v-if="metaCandidates.length > 0"
        class="mt-3 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Select Matched Metadata &amp; Cover Art:
          </span>
          <button
            type="button"
            class="text-xs text-neutral-400 hover:text-neutral-600"
            @click="metaCandidates = []"
          >
            Dismiss
          </button>
        </div>
        <div class="space-y-1.5 max-h-36 overflow-y-auto">
          <div
            v-for="(cand, idx) in metaCandidates"
            :key="idx"
            class="flex items-center justify-between p-2 rounded-xl hover:bg-green-500/10 cursor-pointer transition"
            @click="applyMetaCandidate(cand)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <img
                v-if="cand.coverUrl"
                :src="cand.coverUrl"
                alt="Cover"
                class="w-9 h-9 rounded-lg object-cover shrink-0"
              />
              <div class="min-w-0">
                <div class="text-xs font-medium text-neutral-900 dark:text-white truncate">
                  {{ cand.title }} — {{ cand.artist }}
                </div>
                <div class="text-[11px] text-neutral-500 truncate">
                  {{ cand.album }} {{ cand.year ? `(${cand.year})` : '' }} · [{{ cand.source }}]
                </div>
              </div>
            </div>
            <span class="text-xs text-green-500 font-medium shrink-0 ml-2">Apply</span>
          </div>
        </div>
      </div>

      <!-- Main Form Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
        <!-- Artwork Column -->
        <div class="flex flex-col items-center">
          <div
            class="w-36 h-36 rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center relative group"
          >
            <img
              v-if="coverPreviewUrl"
              :src="coverPreviewUrl"
              alt="Track Cover"
              class="w-full h-full object-cover"
            />
            <i v-else class="ri-disc-line text-5xl text-neutral-400" />
          </div>
          <div class="flex flex-col gap-2 w-full mt-3">
            <n-button size="tiny" secondary block @click="handleSelectLocalCover">
              <template #icon>
                <i class="ri-image-edit-line" />
              </template>
              Choose Image File
            </n-button>
            <n-input
              v-model:value="form.coverDataUrlOrPath"
              size="tiny"
              placeholder="Or paste Cover Image URL..."
              clearable
            />
          </div>
        </div>

        <!-- Tag Fields Column -->
        <div class="md:col-span-2 space-y-3">
          <div>
            <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Physical Filename on Disk (renames actual file)
            </label>
            <div class="flex items-center gap-1.5">
              <n-input
                v-model:value="form.newFileName"
                size="small"
                placeholder="File name on disk"
              />
              <span
                class="px-2 py-1 text-xs font-mono rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 shrink-0"
              >
                {{ fileExt }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Song Title
              </label>
              <n-input v-model:value="form.title" size="small" placeholder="Track title" />
            </div>
            <div>
              <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Artist(s) (use ; or feat. for multi-artist)
              </label>
              <n-input v-model:value="form.artist" size="small" placeholder="Artist name(s)" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-1">
              <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Album
              </label>
              <n-input v-model:value="form.album" size="small" placeholder="Album name" />
            </div>
            <div>
              <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Year
              </label>
              <n-input v-model:value="form.year" size="small" placeholder="YYYY" />
            </div>
            <div>
              <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Genre
              </label>
              <n-input v-model:value="form.genre" size="small" placeholder="e.g. Pop; Rock" />
            </div>
          </div>
        </div>
      </div>

      <!-- Lyrics Editor -->
      <div class="mt-4">
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Embedded &amp; Sidecar Synced Lyrics (.lrc)
          </label>
          <div class="flex items-center gap-2">
            <span class="text-xs text-neutral-500">Also save .lrc file next to audio</span>
            <n-switch v-model:value="form.saveSidecarLrc" size="small" />
          </div>
        </div>
        <n-input
          v-model:value="form.lyrics"
          type="textarea"
          :rows="5"
          placeholder="[00:01.00] Paste or auto-fetch synced LRC lyrics (English, Japanese Romaji, Bangla, etc.)..."
        />
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <n-button size="small" @click="emit('update:show', false)">Cancel</n-button>
        <n-button
          size="small"
          type="primary"
          :loading="saving"
          @click="handleSave"
        >
          Save Tags, Artwork &amp; Filename
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, reactive, ref, watch } from 'vue';

import type { LocalMusicEntry } from '@/types/localMusic';
import { filePathToLocalUrl } from '@/utils/localMusicUtils';

const props = defineProps<{
  show: boolean;
  entry: LocalMusicEntry | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'saved', updatedEntry: LocalMusicEntry, oldId: string): void;
}>();

const { message } = createDiscreteApi(['message']);

const saving = ref(false);
const fetchingMeta = ref(false);
const fetchingLyrics = ref(false);
const metaCandidates = ref<any[]>([]);

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

const coverPreviewUrl = computed(() => {
  if (form.coverDataUrlOrPath) {
    if (
      form.coverDataUrlOrPath.startsWith('http') ||
      form.coverDataUrlOrPath.startsWith('data:') ||
      form.coverDataUrlOrPath.startsWith('local://')
    ) {
      return form.coverDataUrlOrPath;
    }
    return filePathToLocalUrl(form.coverDataUrlOrPath);
  }
  if (props.entry?.coverPath) {
    return filePathToLocalUrl(props.entry.coverPath);
  }
  return '';
});

watch(
  () => props.entry,
  (entry) => {
    metaCandidates.value = [];
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
  },
  { immediate: true }
);

async function handleSelectLocalCover() {
  try {
    const res = await window.electron.ipcRenderer.invoke('local-music:select-cover-file');
    if (res && !res.canceled && (res.dataUrl || res.filePath)) {
      form.coverDataUrlOrPath = res.dataUrl || res.filePath;
    }
  } catch (err) {
    message.error(`Failed to select cover image: ${String(err)}`);
  }
}

async function handleAutoFetchMetadata() {
  if (!form.title && !form.artist) {
    message.warning('Please enter a song title or artist first.');
    return;
  }
  fetchingMeta.value = true;
  try {
    const res = await window.electron.ipcRenderer.invoke('metadata:fetch-online', {
      title: form.title,
      artist: form.artist,
      album: form.album
    });
    const list = res?.results || [];
    if (list.length === 0) {
      message.info('No matching online metadata found.');
    } else {
      metaCandidates.value = list;
      applyMetaCandidate(list[0]);
      message.success(`Matched ${list.length} metadata result(s) from ${list[0].source}.`);
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
  if (cand.coverUrl) form.coverDataUrlOrPath = cand.coverUrl;
}

async function handleAutoFetchLyrics() {
  if (!form.title) {
    message.warning('Please enter a song title first.');
    return;
  }
  fetchingLyrics.value = true;
  try {
    const res = await window.electron.ipcRenderer.invoke('lyrics:fetch-multi-source', {
      title: form.title,
      artist: form.artist,
      album: form.album,
      durationSec: props.entry?.duration ? Math.round(props.entry.duration / 1000) : undefined
    });
    if (res?.lrc) {
      form.lyrics = res.romalrc
        ? `${res.lrc}\n\n${res.romalrc}`
        : res.lrc;
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
      message.success('Saved tags, artwork, and filename!');
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
