<template>
  <dialog
    ref="dialogRef"
    closedby="any"
    class="namida-command-dialog"
    aria-label="Command Palette"
    @click="onDialogClick"
    @close="onDialogClose"
  >
    <div class="command-palette-shell">
      <div class="command-search-row">
        <i class="ri-search-line text-neutral-400 text-lg shrink-0" />
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          class="command-search-input"
          placeholder="Jump to page, control playback, toggle DSP, or search tracks & lyrics..."
          autocomplete="off"
          @keydown="onInputKeyDown"
        />
        <kbd class="command-kbd">ESC</kbd>
      </div>

      <div class="command-results-list">
        <div v-if="results.length === 0" class="command-empty">
          No matching commands, tracks, or lyrics.
        </div>
        <button
          v-for="(item, idx) in results"
          :key="item.id"
          type="button"
          class="command-result-row"
          :class="{ 'is-selected': idx === selectedIndex }"
          @mouseenter="selectedIndex = idx"
          @click="executeItem(item)"
        >
          <i :class="[item.icon || 'ri-command-line', 'command-row-icon']" />
          <div class="command-row-body">
            <div class="command-row-title">{{ item.title }}</div>
            <div v-if="item.subtitle" class="command-row-subtitle">{{ item.subtitle }}</div>
          </div>
          <span v-if="item.badge" class="command-row-badge">{{ item.badge }}</span>
        </button>
      </div>

      <div class="command-footer">
        <span><kbd class="command-kbd">↑</kbd> <kbd class="command-kbd">↓</kbd> Navigate</span>
        <span><kbd class="command-kbd">↵</kbd> Run</span>
        <span><kbd class="command-kbd">Ctrl+K</kbd> Toggle</span>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { usePlaybackControl } from '@/hooks/usePlaybackControl';
import { audioDspGraph } from '@/services/audioDspGraph';
import { audioService } from '@/services/audioService';
import {
  isAutoSkipSponsorBlockEnabled,
  setAutoSkipSponsorBlockEnabled
} from '@/services/sponsorBlockService';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import {
  type CommandPaletteItem,
  type CommandPaletteTrackInput,
  searchCommandPaletteItems
} from '@/utils/commandPaletteHelpers';
import { toSongResult } from '@/utils/localMusicUtils';

const router = useRouter();
const playerStore = usePlayerStore();
const localMusicStore = useLocalMusicStore();
const settingsStore = useSettingsStore();
const { playMusicEvent } = usePlaybackControl();

const dialogRef = ref<HTMLDialogElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref('');
const selectedIndex = ref(0);
const isOpen = ref(false);

const quickActions = computed<CommandPaletteItem[]>(() => {
  const dspState = audioDspGraph.getState();
  const sponsorAutoSkip =
    Boolean(settingsStore.setData?.enableSponsorBlockAutoSkip) || isAutoSkipSponsorBlockEnabled();

  return [
    {
      id: 'nav:home',
      category: 'navigation',
      title: 'Go to Home',
      subtitle: 'Dashboard & recommendations',
      badge: 'Page',
      icon: 'ri-home-5-line',
      keywords: ['home', 'dashboard']
    },
    {
      id: 'nav:local-music',
      category: 'navigation',
      title: 'Go to Local Music',
      subtitle: 'All Tracks, Folders, Smart Playlists',
      badge: 'Page',
      icon: 'ri-folder-music-line',
      keywords: ['local', 'library', 'folders', 'smart playlists']
    },
    {
      id: 'nav:search',
      category: 'navigation',
      title: 'Go to Search',
      subtitle: 'Search tracks and YouTube sources',
      badge: 'Page',
      icon: 'ri-search-line',
      keywords: ['search', 'youtube', 'find']
    },
    {
      id: 'nav:favorite',
      category: 'navigation',
      title: 'Go to Favorites',
      subtitle: 'Liked songs collection',
      badge: 'Page',
      icon: 'ri-heart-line',
      keywords: ['favorite', 'liked']
    },
    {
      id: 'nav:history',
      category: 'navigation',
      title: 'Go to Listening History',
      subtitle: 'Recently played tracks',
      badge: 'Page',
      icon: 'ri-history-line',
      keywords: ['history', 'recent']
    },
    {
      id: 'nav:downloads',
      category: 'navigation',
      title: 'Go to Downloads',
      subtitle: 'Saved audio & video downloads',
      badge: 'Page',
      icon: 'ri-download-cloud-2-line',
      keywords: ['downloads', 'offline']
    },
    {
      id: 'nav:set',
      category: 'navigation',
      title: 'Open Settings',
      subtitle: 'Theme, playback, DSP, network & system preferences',
      badge: 'Page',
      icon: 'ri-settings-3-line',
      keywords: ['settings', 'preferences', 'config']
    },
    {
      id: 'player:toggle-play',
      category: 'player',
      title: playerStore.isPlay ? 'Pause Playback' : 'Resume Playback',
      subtitle: 'Toggle active audio playback',
      badge: 'Player',
      icon: playerStore.isPlay ? 'ri-pause-circle-line' : 'ri-play-circle-line',
      keywords: ['play', 'pause', 'toggle']
    },
    {
      id: 'player:next',
      category: 'player',
      title: 'Next Track',
      subtitle: 'Skip to next song in queue',
      badge: 'Player',
      icon: 'ri-skip-forward-line',
      keywords: ['next', 'skip']
    },
    {
      id: 'player:prev',
      category: 'player',
      title: 'Previous Track',
      subtitle: 'Return to previous song in queue',
      badge: 'Player',
      icon: 'ri-skip-back-line',
      keywords: ['previous', 'back']
    },
    {
      id: 'player:fullscreen',
      category: 'player',
      title: playerStore.musicFull ? 'Exit Fullscreen Player' : 'Open Fullscreen Player',
      subtitle: 'Toggle widescreen lyrics & artwork view',
      badge: 'Player',
      icon: 'ri-fullscreen-line',
      keywords: ['fullscreen', 'lyrics', 'now playing']
    },
    {
      id: 'dsp:eq',
      category: 'dsp',
      title: `Toggle Equalizer (${dspState.eqEnabled ? 'ON' : 'OFF'})`,
      subtitle: 'Enable or bypass Web Audio DSP equalizer chain',
      badge: 'DSP',
      icon: 'ri-equalizer-line',
      keywords: ['eq', 'equalizer', 'autoeq', 'dsp']
    },
    {
      id: 'dsp:mono',
      category: 'dsp',
      title: `Toggle Mono Downmix (${audioService.isMonoEnabled() ? 'ON' : 'OFF'})`,
      subtitle: 'Mix stereo channels into mono output',
      badge: 'DSP',
      icon: 'ri-surround-sound-line',
      keywords: ['mono', 'stereo', 'channel', 'dsp']
    },
    {
      id: 'dsp:pitch',
      category: 'dsp',
      title: `Toggle Preserve Pitch (${audioService.getPreservesPitch() ? 'ON' : 'OFF'})`,
      subtitle: 'Keep musical key when changing playback speed',
      badge: 'DSP',
      icon: 'ri-speed-line',
      keywords: ['pitch', 'speed', 'tempo', 'dsp']
    },
    {
      id: 'dsp:gapless',
      category: 'dsp',
      title: `Toggle Gapless Pre-Buffering (${audioService.isGaplessEnabled() ? 'ON' : 'OFF'})`,
      subtitle: 'Pre-warm next queued track in background',
      badge: 'DSP',
      icon: 'ri-links-line',
      keywords: ['gapless', 'prebuffer', 'dsp']
    },
    {
      id: 'dsp:sponsorblock',
      category: 'dsp',
      title: `Toggle SponsorBlock Auto-Skip (${sponsorAutoSkip ? 'ON' : 'OFF'})`,
      subtitle: 'Skip non-music YouTube SponsorBlock segments automatically',
      badge: 'Playback',
      icon: 'ri-skip-forward-mini-line',
      keywords: ['sponsorblock', 'skip', 'youtube', 'segments']
    }
  ];
});

const libraryTrackInputs = computed<CommandPaletteTrackInput[]>(() =>
  localMusicStore.visibleMusicList.map((entry: any) => ({
    id: entry.id,
    title: entry.title || entry.fileName || 'Unknown Track',
    artist: entry.artist || '',
    album: entry.album || '',
    lyrics: typeof entry.lyrics === 'string' ? entry.lyrics : '',
    payload: entry
  }))
);

const results = computed<CommandPaletteItem[]>(() =>
  searchCommandPaletteItems(query.value, quickActions.value, libraryTrackInputs.value, 24)
);

watch(results, () => {
  selectedIndex.value = 0;
});

function openPalette() {
  const el = dialogRef.value;
  if (!el || el.open) return;
  query.value = '';
  selectedIndex.value = 0;
  el.showModal();
  isOpen.value = true;
  void nextTick(() => {
    inputRef.value?.focus();
  });
}

function closePalette() {
  const el = dialogRef.value;
  if (el && el.open) {
    el.close();
  }
  isOpen.value = false;
}

function onDialogClose() {
  isOpen.value = false;
}

// Progressive backdrop pointer-click fallback for engines without closedby="any"
function onDialogClick(e: MouseEvent) {
  if (e.target === dialogRef.value) {
    closePalette();
  }
}

function onInputKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (results.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % results.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (results.value.length > 0) {
      selectedIndex.value = (selectedIndex.value - 1 + results.value.length) % results.value.length;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const item = results.value[selectedIndex.value];
    if (item) {
      void executeItem(item);
    }
  }
}

async function executeItem(item: CommandPaletteItem) {
  closePalette();

  if (item.id.startsWith('nav:')) {
    const target = item.id.slice(4);
    const path = target === 'home' ? '/' : `/${target}`;
    await router.push(path);
    return;
  }

  switch (item.id) {
    case 'player:toggle-play':
      await playMusicEvent();
      return;
    case 'player:next':
      playerStore.nextPlay();
      return;
    case 'player:prev':
      playerStore.prevPlay();
      return;
    case 'player:fullscreen':
      playerStore.setMusicFull(!playerStore.musicFull);
      return;
    case 'dsp:eq':
      audioDspGraph.setEqEnabled(!audioDspGraph.getState().eqEnabled);
      return;
    case 'dsp:mono': {
      const nextMono = !audioService.isMonoEnabled();
      audioService.setMono(nextMono);
      settingsStore.setSetData({ ...settingsStore.setData, enableMonoAudio: nextMono });
      return;
    }
    case 'dsp:pitch': {
      const nextPitch = !audioService.getPreservesPitch();
      audioService.setPreservesPitch(nextPitch);
      settingsStore.setSetData({ ...settingsStore.setData, enablePreservesPitch: nextPitch });
      return;
    }
    case 'dsp:gapless': {
      const nextGapless = !audioService.isGaplessEnabled();
      audioService.setGaplessEnabled(nextGapless);
      settingsStore.setSetData({ ...settingsStore.setData, enableGaplessPlayback: nextGapless });
      return;
    }
    case 'dsp:sponsorblock': {
      const nextSkip = !(
        Boolean(settingsStore.setData?.enableSponsorBlockAutoSkip) ||
        isAutoSkipSponsorBlockEnabled()
      );
      setAutoSkipSponsorBlockEnabled(nextSkip);
      settingsStore.setSetData({ ...settingsStore.setData, enableSponsorBlockAutoSkip: nextSkip });
      return;
    }
    default:
      break;
  }

  if (item.category === 'track' && item.payload) {
    const song = toSongResult(item.payload as any);
    await playerStore.setPlay(song);
  }
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (dialogRef.value?.open) {
      closePalette();
    } else {
      openPalette();
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>

<style scoped>
.namida-command-dialog {
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  width: min(640px, 92vw);
  max-height: 76vh;
  background: var(--namida-bg-elevated, #18181b);
  color: inherit;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.namida-command-dialog[open] {
  display: flex;
  flex-direction: column;
}

.namida-command-dialog:modal {
  overscroll-behavior: contain;
}

.namida-command-dialog::backdrop {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  overflow: hidden;
  overscroll-behavior: contain;
}

.command-palette-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 76vh;
  color: #f4f4f5;
}

.command-search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.command-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: inherit;
  font-size: 14px;
}

.command-search-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.command-results-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.command-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.48);
}

.command-result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.command-result-row.is-selected,
.command-result-row:hover {
  background: rgba(255, 255, 255, 0.1);
}

.command-row-icon {
  font-size: 18px;
  color: rgb(var(--namida-seed, 16, 185, 129));
  flex-shrink: 0;
}

.command-row-body {
  flex: 1;
  min-width: 0;
}

.command-row-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-row-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.58);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.command-row-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.command-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.command-kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.07);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}
</style>
