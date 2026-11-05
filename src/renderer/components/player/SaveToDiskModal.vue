<template>
  <div
    v-if="visible"
    class="save-to-disk-backdrop fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    @click.self="close"
  >
    <div
      class="save-to-disk-modal w-full max-w-lg rounded-2xl bg-neutral-900/95 text-white/90 border border-white/10 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-modal-title"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div class="flex items-center gap-2">
          <i class="ri-download-cloud-2-line text-emerald-400 text-xl"></i>
          <h2 id="save-modal-title" class="text-base font-semibold text-white">
            Save to Disk
          </h2>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
          @click="close"
        >
          <i class="ri-close-line text-lg"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-5 text-sm">
        <!-- Target Directory Picker -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5">
            Destination Folder
          </label>
          <div class="flex gap-2">
            <div class="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white/80 truncate flex items-center">
              {{ destinationFolder || 'Resolving download folder...' }}
            </div>
            <button
              type="button"
              class="px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
              @click="browseFolder"
            >
              <i class="ri-folder-open-line"></i>
              <span>Browse...</span>
            </button>
          </div>
        </div>

        <!-- Track Info Preview -->
        <div class="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
            <img v-if="trackThumb" :src="trackThumb" alt="" class="w-full h-full object-cover" />
            <i v-else class="ri-music-2-line text-white/40"></i>
          </div>
          <div class="flex-1 min-w-0 text-xs">
            <div class="font-medium text-white truncate">{{ song?.name || 'Current Song' }}</div>
            <div class="text-white/50 truncate mt-0.5">{{ songArtist }}</div>
          </div>
        </div>

        <!-- 3 Save Options -->
        <div class="space-y-3">
          <!-- 1. Save Audio -->
          <div class="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/40 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                  <i class="ri-music-fill"></i>
                </div>
                <div>
                  <div class="font-medium text-white text-sm">Save Audio</div>
                  <div class="text-xs text-white/50">High-bitrate M4A / MP3 to destination</div>
                </div>
              </div>
              <button
                type="button"
                class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
                :disabled="isSavingAudio"
                @click="saveAudio"
              >
                <i v-if="isSavingAudio" class="ri-loader-4-line animate-spin mr-1"></i>
                <span>{{ isSavingAudio ? `${audioProgress}%` : 'Save Audio' }}</span>
              </button>
            </div>
          </div>

          <!-- 2. Save Video -->
          <div class="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/40 transition space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg">
                  <i class="ri-video-fill"></i>
                </div>
                <div>
                  <div class="font-medium text-white text-sm">Save Video</div>
                  <div class="text-xs text-white/50">MP4 video in selected resolution</div>
                </div>
              </div>

              <!-- Quality Selector -->
              <div class="flex items-center gap-2">
                <select
                  v-model.number="selectedVideoHeight"
                  class="bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option :value="1080">1080p</option>
                  <option :value="720">720p</option>
                  <option :value="480">480p</option>
                  <option :value="360">360p</option>
                </select>

                <button
                  type="button"
                  class="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
                  :disabled="isSavingVideo || !youtubeId"
                  @click="saveVideo"
                >
                  <i v-if="isSavingVideo" class="ri-loader-4-line animate-spin mr-1"></i>
                  <span>{{ isSavingVideo ? `${videoProgress}%` : 'Save Video' }}</span>
                </button>
              </div>
            </div>
            <div v-if="!youtubeId" class="text-[11px] text-amber-300/80 pl-12">
              * Requires a linked YouTube video. Link one in the Video Source menu first.
            </div>
          </div>

          <!-- 3. Save Lyrics (.lrc) -->
          <div class="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/40 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg">
                  <i class="ri-file-text-line"></i>
                </div>
                <div>
                  <div class="font-medium text-white text-sm">Save Lyrics (.lrc)</div>
                  <div class="text-xs text-white/50">Export synchronized .lrc sidecar file</div>
                </div>
              </div>
              <button
                type="button"
                class="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white text-xs font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
                :disabled="isSavingLyrics || !hasLyrics"
                @click="saveLyrics"
              >
                <span>Save .lrc</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { linkVariant } from '@/services/songLibrary';
import { youtubeService } from '@/services/youtubeService';
import { useSettingsStore } from '@/store/modules/settings';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

const props = defineProps<{
  visible: boolean;
  song: SongResult;
  youtubeId?: string;
  lrcString?: string;
  songId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'savedMedia'): void;
}>();

const settingStore = useSettingsStore();
const destinationFolder = ref('');
const selectedVideoHeight = ref<number>(720);

const isSavingAudio = ref(false);
const audioProgress = ref(0);

const isSavingVideo = ref(false);
const videoProgress = ref(0);

const isSavingLyrics = ref(false);

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

const trackThumb = computed(() => {
  return getImgUrl(props.song?.picUrl, '100y100');
});

const hasLyrics = computed(() => {
  return Boolean(props.lrcString && props.lrcString.trim());
});

const close = () => {
  emit('update:visible', false);
};

// Resolve default destination folder
const resolveInitialFolder = async () => {
  try {
    const localPath = (props.song as any)?.localPath || (props.song as any)?.path;
    const resolved = await youtubeService.resolveDownloadDir(localPath);
    destinationFolder.value = resolved;
  } catch (err) {
    console.error('[SaveToDiskModal] Failed to resolve directory:', err);
  }
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      resolveInitialFolder();
    }
  }
);

onMounted(() => {
  if (props.visible) {
    resolveInitialFolder();
  }
});

const browseFolder = async () => {
  try {
    let result: any = null;
    if (window.api?.selectDirectory) {
      result = await window.api.selectDirectory();
    } else if (window.ipcRenderer) {
      result = await window.ipcRenderer.invoke('select-directory');
    }

    if (result && !result.canceled && result.filePaths?.[0]) {
      destinationFolder.value = result.filePaths[0];
      // Remember the choice so every later download (including the quality
      // buttons in the video-source popover) defaults to the same folder.
      settingStore.setSetData({ mediaDownloadDir: result.filePaths[0] });
      window.$message?.success?.('Download folder saved as the default');
    }
  } catch (err) {
    console.error('[SaveToDiskModal] browse folder error:', err);
  }
};

const sanitizeFilename = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
};

// 1. Save Audio
const saveAudio = async () => {
  if (!destinationFolder.value) {
    window.$message?.warning?.('Please select a destination folder');
    return;
  }

  isSavingAudio.value = true;
  audioProgress.value = 0;

  try {
    const id = props.youtubeId;
    if (!id) {
      // Local file copy fallback if localPath exists
      const localPath = (props.song as any)?.localPath || (props.song as any)?.path;
      if (localPath) {
        window.$message?.info?.(`File already exists at: ${localPath}`);
        isSavingAudio.value = false;
        return;
      }
      throw new Error('No YouTube ID or local file available to save audio');
    }

    const { unsubscribe } = await youtubeService.downloadWithProgress(
      id,
      {
        kind: 'audio',
        audioFormat: 'm4a',
        targetDir: destinationFolder.value,
        fileBaseName: sanitizeFilename(`${props.song?.name || 'audio'} - ${songArtist.value}`),
        embedLink: true
      },
      async (progress) => {
        audioProgress.value = progress.percent;
        if (progress.state === 'completed') {
          unsubscribe();
          isSavingAudio.value = false;
          window.$message?.success?.('Audio saved to disk successfully');

          if (props.songId && progress.filePath) {
            await linkVariant(props.songId, {
              kind: 'audio',
              source: 'download',
              path: progress.filePath,
              container: 'm4a'
            });
            emit('savedMedia');
          }
        } else if (progress.state === 'error') {
          unsubscribe();
          isSavingAudio.value = false;
          window.$message?.error?.(`Save audio failed: ${progress.error || 'Unknown error'}`);
        }
      }
    );
  } catch (err: any) {
    isSavingAudio.value = false;
    window.$message?.error?.(err.message || 'Failed to save audio');
  }
};

// 2. Save Video
const saveVideo = async () => {
  const id = props.youtubeId;
  if (!id) {
    window.$message?.warning?.('No YouTube ID linked to this song');
    return;
  }
  if (!destinationFolder.value) {
    window.$message?.warning?.('Please select a destination folder');
    return;
  }

  isSavingVideo.value = true;
  videoProgress.value = 0;

  try {
    const height = selectedVideoHeight.value;
    const { unsubscribe } = await youtubeService.downloadWithProgress(
      id,
      {
        kind: 'video',
        height,
        targetDir: destinationFolder.value,
        fileBaseName: sanitizeFilename(`${props.song?.name || 'video'} - ${songArtist.value} (${height}p)`),
        embedLink: true
      },
      async (progress) => {
        videoProgress.value = progress.percent;
        if (progress.state === 'completed') {
          unsubscribe();
          isSavingVideo.value = false;
          window.$message?.success?.(`Video (${height}p) saved to disk successfully`);

          if (props.songId && progress.filePath) {
            await linkVariant(props.songId, {
              kind: 'video',
              source: 'download',
              path: progress.filePath,
              height,
              container: 'mp4'
            });
            emit('savedMedia');
          }
        } else if (progress.state === 'error') {
          unsubscribe();
          isSavingVideo.value = false;
          window.$message?.error?.(`Save video failed: ${progress.error || 'Unknown error'}`);
        }
      }
    );
  } catch (err: any) {
    isSavingVideo.value = false;
    window.$message?.error?.(err.message || 'Failed to save video');
  }
};

// 3. Save Lyrics
const saveLyrics = async () => {
  if (!props.lrcString || !props.lrcString.trim()) {
    window.$message?.warning?.('No synchronized lyrics available for this song');
    return;
  }
  if (!destinationFolder.value) {
    window.$message?.warning?.('Please select a destination folder');
    return;
  }

  isSavingLyrics.value = true;
  try {
    const filename = sanitizeFilename(`${props.song?.name || 'lyrics'} - ${songArtist.value}`);
    let result: any = null;

    if (window.api?.saveLyricFile) {
      result = await window.api.saveLyricFile({
        filename,
        lrcContent: props.lrcString,
        targetDir: destinationFolder.value
      });
    } else if (window.ipcRenderer) {
      result = await window.ipcRenderer.invoke('save-lyric-file', {
        filename,
        lrcContent: props.lrcString,
        targetDir: destinationFolder.value
      });
    }

    if (result?.success) {
      window.$message?.success?.(`Saved .lrc to: ${result.path || destinationFolder.value}`);
    } else {
      throw new Error(result?.error || 'Failed to write .lrc file');
    }
  } catch (err: any) {
    window.$message?.error?.(err.message || 'Failed to save lyrics');
  } finally {
    isSavingLyrics.value = false;
  }
};
</script>
