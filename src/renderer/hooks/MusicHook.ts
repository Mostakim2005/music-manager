import { cloneDeep } from 'lodash';
import { computed, type ComputedRef, nextTick, onUnmounted, ref, watch } from 'vue';

import { musicDB } from '@/hooks/IndexDBHook';
import { audioService } from '@/services/audioService';
import { currentMediaOwner } from '@/services/mediaCoordinator';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { getSongKey, savePosition } from '@/services/songLibrary';
import type { usePlayerStore } from '@/store';
import type { Artist, ILyricText, SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import { getTextColors } from '@/utils/linearColor';
import { savePlaybackProgress } from '@/utils/playerUtils';
import { isEditableTarget } from '@/utils/shortcutKeyboard';
import { parseLyrics } from '@/utils/yrcParser';

const windowData = window as any;

let playerStore: ReturnType<typeof usePlayerStore> | null = null;

export const initMusicHook = (store: ReturnType<typeof usePlayerStore>): void => {
  if (playerStore === store) return;
  playerStore = store;

  playMusic = computed(() => getPlayerStore().playMusic as SongResult);
  artistList = computed(
    () => (getPlayerStore().playMusic.ar || getPlayerStore().playMusic?.song?.artists) as Artist[]
  );

  setupKeyboardListeners();
  setupMusicWatchers();
  setupCorrectionTimeWatcher();
  setupPlayStateWatcher();
  setupAudioListeners();
};

const getPlayerStore = () => {
  if (!playerStore) {
    throw new Error('MusicHook not initialized. Call initMusicHook first.');
  }
  return playerStore;
};

/**
 * Audio playback sets `play`; video playback sets `isPlay` and keeps the audio
 * element paused. Surfaces such as the lyric window must react to either one.
 */
const isPlaybackActive = (): boolean => {
  const store = getPlayerStore();
  return Boolean(store.play || store.isPlay);
};
export const lrcArray = ref<ILyricText[]>([]);
export const lrcTimeArray = ref<number[]>([]);
export const nowTime = ref(0);
export const allTime = ref(0);
export const nowIndex = ref(0);
export const currentLrcProgress = ref(0);
export const sound = ref<HTMLAudioElement | null>(audioService.getCurrentSound());
export const isLyricWindowOpen = ref(false);
export const textColors = ref<any>(getTextColors());

export let playMusic: ComputedRef<SongResult>;
export let artistList: ComputedRef<Artist[]>;

let lastIndex = -1;

const cachedPlatform = isElectron ? window.electron.ipcRenderer.sendSync('get-platform') : 'web';

export { musicDB };

const handleKeyUp = (e: KeyboardEvent) => {
  if (
    e.defaultPrevented ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    e.shiftKey ||
    isEditableTarget(e.target) ||
    (e.target instanceof HTMLElement && e.target.closest('button, [role="button"]'))
  ) {
    return;
  }

  const store = getPlayerStore();
  switch (e.code) {
    case 'Space':
      if (store.playMusic?.id) {
        void store.setPlay({ ...store.playMusic });
      }
      break;
    default:
  }
};

const setupKeyboardListeners = () => {
  document.removeEventListener('keyup', handleKeyUp);
  document.addEventListener('keyup', handleKeyUp);
};

let audioListenersInitialized = false;

/**
 */
const parseLyricsString = async (
  lyricsStr: string
): Promise<{ lrcArray: ILyricText[]; lrcTimeArray: number[]; hasWordByWord: boolean }> => {
  if (!lyricsStr || typeof lyricsStr !== 'string') {
    return { lrcArray: [], lrcTimeArray: [], hasWordByWord: false };
  }

  try {
    const parseResult = parseLyrics(lyricsStr);
    console.log('parseResult', parseResult);

    if (!parseResult.success) {
      console.error('Failed to parse lyrics:', parseResult.error.message);
      return { lrcArray: [], lrcTimeArray: [], hasWordByWord: false };
    }

    const { lyrics } = parseResult.data;
    const lrcArray: ILyricText[] = [];
    const lrcTimeArray: number[] = [];
    let hasWordByWord = false;

    for (const line of lyrics) {
      const hasWords = line.words && line.words.length > 0;
      if (hasWords) {
        hasWordByWord = true;
      }

      lrcArray.push({
        text: line.fullText,
        trText: '',
        words: hasWords
          ? line.words.map((word) => ({
              ...word
            }))
          : undefined,
        hasWordByWord: hasWords,
        startTime: line.startTime,
        duration: line.duration
      });

      lrcTimeArray.push(line.startTime / 1000);
    }
    return { lrcArray, lrcTimeArray, hasWordByWord };
  } catch (error) {
    console.error('Error while parsing lyrics:', error);
    return { lrcArray: [], lrcTimeArray: [], hasWordByWord: false };
  }
};

let lyricGeneration = 0;

const ensureLyricsLoaded = async (force = false) => {
  const songId = playMusic.value?.id;
  if (!force && songId && lrcArray.value.length > 0) return;
  const gen = ++lyricGeneration;
  const isCurrent = () => gen === lyricGeneration && playMusic.value?.id === songId;
  if (!songId) {
    lrcArray.value = [];
    lrcTimeArray.value = [];
    nowIndex.value = 0;
    return;
  }
  await nextTick();
  if (!isCurrent()) return;
  const lyricData = playMusic.value.lyric;
  let result: { lrcArray: ILyricText[]; lrcTimeArray: number[] } = {
    lrcArray: [],
    lrcTimeArray: []
  };
  if (lyricData && typeof lyricData === 'string') {
    result = await parseLyricsString(lyricData);
  } else if (lyricData && typeof lyricData === 'object' && lyricData.lrcArray?.length > 0) {
    const rawLrc = lyricData.lrcArray || [];
    result = { lrcArray: rawLrc, lrcTimeArray: lyricData.lrcTimeArray || [] };
    try {
      const { translateLyrics } = await import('@/services/lyricTranslation');
      if (!isCurrent()) return;
      result.lrcArray = await translateLyrics(rawLrc as any);
    } catch (e) {
      console.error('Lyric translation failed, using original lyrics: ', e);
    }
  } else {
    const url = playMusic.value.playMusicUrl;
    try {
      if (isElectron && url?.startsWith('local:///')) {
        let filePath = decodeURIComponent(url.replace('local:///', ''));
        if (/^\/[a-zA-Z]:\//.test(filePath)) filePath = filePath.slice(1);
        const embeddedLyrics = await window.api.getEmbeddedLyrics(filePath);
        if (!isCurrent()) return;
        if (embeddedLyrics) {
          result = await parseLyricsString(embeddedLyrics);
        }
      }
      if (!isCurrent()) return;
      if (!result.lrcArray.length) {
        const { loadLrc } = await import('@/hooks/usePlayerHooks');
        if (!isCurrent()) return;
        result = await loadLrc(songId);
      }
    } catch (error) {
      console.error('Failed to load lyrics:', error);
    }
  }
  if (!isCurrent()) return;
  lrcArray.value = result.lrcArray;
  lrcTimeArray.value = result.lrcTimeArray;
  nowIndex.value = getLrcIndex(nowTime.value);
  if (isElectron && isLyricWindowOpen.value) {
    sendLyricToWin();
  }
};

const setupMusicWatchers = () => {
  const store = getPlayerStore();

  watch(
    () => store.playMusic.id,
    async (newId, oldId) => {
      if (newId !== oldId) {
        nowIndex.value = 0;
        lastIndex = -1;
        nowTime.value = 0;
        allTime.value = (store.playMusic.dt || 0) / 1000;
        currentLrcProgress.value = 0;
        lrcArray.value = [];
        lrcTimeArray.value = [];
      }
      await ensureLyricsLoaded(true);
    },
    { immediate: true }
  );

  watch(
    () => playMusic.value?.lyric,
    (newLyric) => {
      if (!playMusic.value?.id) return;
      const isRichLyric =
        !!newLyric && typeof newLyric === 'object' && (newLyric.lrcArray?.length ?? 0) > 0;
      if (lrcArray.value.length === 0 || isRichLyric) {
        ensureLyricsLoaded(isRichLyric);
      }
    }
  );
};

const setupAudioListeners = () => {
  if (audioListenersInitialized) {
    return () => {};
  }
  audioListenersInitialized = true;

  let interval: number | null = null;
  let recoveryTimer: number | null = null;
  let lyricThrottleCounter = 0;
  let lastSavedProgress = 0;

  const clearInterval = () => {
    if (interval) {
      window.clearInterval(interval);
      interval = null;
    }
  };

  const stopRecovery = () => {
    if (recoveryTimer) {
      window.clearInterval(recoveryTimer);
      recoveryTimer = null;
    }
  };

  /**
   */
  const startProgressInterval = () => {
    clearInterval();
    interval = window.setInterval(() => {
      try {
        const store = getPlayerStore();
        const isVideoMode = store.playbackMode === 'video';
        const currentSound = audioService.getCurrentSound();

        // Linked A/V mode: the audio element stays the master clock even in
        // video mode (the video is muted and follows it). Only when the audio
        // is not playing this song does the video element push nowTime.
        const audioIsMaster = Boolean(
          currentSound &&
            audioService.getCurrentTrack()?.id === store.playMusic.id &&
            !currentSound.paused
        );

        if (!isVideoMode || audioIsMaster) {
          if (!currentSound || audioService.getCurrentTrack()?.id !== store.playMusic.id) {
            return;
          }

          const audioTime = currentSound.currentTime;
          if (typeof audioTime !== 'number' || Number.isNaN(audioTime)) {
            return;
          }

          if (sound.value !== currentSound) {
            sound.value = currentSound;
          }

          nowTime.value = audioTime;
          if (Number.isFinite(currentSound.duration)) allTime.value = currentSound.duration;
        } else if (!Number.isFinite(nowTime.value)) {
          return;
        }

        // Every lyric/tray/MPRIS consumer below uses this single clock.
        const currentTime = isVideoMode ? nowTime.value : currentSound!.currentTime;

        const newIndex = getLrcIndex(nowTime.value);
        if (newIndex !== nowIndex.value) {
          nowIndex.value = newIndex;
          currentLrcProgress.value = 0;
          if (isElectron && isLyricWindowOpen.value) {
            sendLyricToWin();
          }
        }
        if (isElectron && lrcArray.value[nowIndex.value]) {
          if (lastIndex !== nowIndex.value) {
            sendTrayLyric(nowIndex.value);
            lastIndex = nowIndex.value;
          }
        }

        const { start, end } = currentLrcTiming.value;
        if (typeof start === 'number' && typeof end === 'number' && start !== end) {
          const elapsed = currentTime + correctionTime.value - start;
          const duration = end - start;
          const progress = (elapsed / duration) * 100;
          currentLrcProgress.value = Math.min(Math.max(progress, 0), 100);
        }

        lyricThrottleCounter++;
        if (isElectron && isLyricWindowOpen.value && lyricThrottleCounter % 4 === 0) {
          try {
            window.api.sendLyric(
              JSON.stringify({
                type: 'update',
                nowIndex: nowIndex.value,
                nowTime: nowTime.value,
                correctionTime: correctionTime.value,
                isPlay: isPlaybackActive()
              })
            );
          } catch {
            // Ignore storage quota errors
          }
        }

        if (
          !isVideoMode &&
          Math.floor(currentTime) % 5 === 0 &&
          Math.floor(currentTime) !== Math.floor(lastSavedProgress)
        ) {
          lastSavedProgress = currentTime;
          const currentMusic = getPlayerStore().playMusic;
          if (currentMusic?.id) {
            savePlaybackProgress(currentMusic.id, currentTime);
            const songKey = getSongKey(currentMusic);
            if (songKey) {
              void savePosition(songKey, currentTime);
            }
          }
        }

        if (isElectron && !isVideoMode && lyricThrottleCounter % 20 === 0) {
          try {
            window.electron.ipcRenderer.send('mpris-position-update', currentTime);
          } catch {
            // Ignore MPRIS update failures
          }
        }
      } catch (error) {
        console.error('Progress update interval error:', error);
      }
    }, 50);
  };

  /**
   */
  const startRecoveryMonitor = () => {
    stopRecovery();
    recoveryTimer = window.setInterval(() => {
      try {
        const store = getPlayerStore();
        if (isPlaybackActive() && !interval) {
          const currentSound = audioService.getCurrentSound();
          // Video mode deliberately pauses the audio element, so the audio
          // element's paused flag cannot decide whether the ticker is needed.
          const shouldTick =
            store.playbackMode === 'video' || Boolean(currentSound && !currentSound.paused);
          if (shouldTick) {
            console.warn('[MusicHook] progress interval was lost while playing; restarting');
            startProgressInterval();
          }
        }
      } catch {
        // Ignore errors from the recovery monitor
      }
    }, 500);
  };

  startRecoveryMonitor();

  // Entering video mode pauses the audio element; keep the shared lyric clock
  // alive for as long as the video mode is active.
  watch(
    () => getPlayerStore().playbackMode,
    (mode) => {
      if (mode === 'video') {
        startProgressInterval();
      } else if (!isPlaybackActive()) {
        clearInterval();
      }
    }
  );

  audioService.on('seek_start', (time) => {
    nowTime.value = time;
  });

  audioService.on('seek', () => {
    try {
      if (getPlayerStore().playbackMode === 'video') return;
      const currentSound = audioService.getCurrentSound();
      if (currentSound) {
        const currentTime = currentSound.currentTime;
        if (typeof currentTime === 'number' && !Number.isNaN(currentTime)) {
          nowTime.value = currentTime;

          if (isElectron) {
            window.electron.ipcRenderer.send('mpris-position-update', currentTime);
          }

          const newIndex = getLrcIndex(nowTime.value);
          if (newIndex !== nowIndex.value) {
            nowIndex.value = newIndex;
            if (isElectron && isLyricWindowOpen.value) {
              sendLyricToWin();
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling seek event:', error);
    }
  });

  const updateCurrentTimeAndDuration = () => {
    const currentSound = audioService.getCurrentSound();
    if (currentSound) {
      try {
        const currentTime = currentSound.currentTime;
        if (typeof currentTime === 'number' && !Number.isNaN(currentTime)) {
          nowTime.value = currentTime;
          allTime.value = currentSound.duration;
        }
      } catch (error) {
        console.error('Failed to initialize time and progress:', error);
      }
    }
  };

  updateCurrentTimeAndDuration();

  audioService.on('play', () => {
    getPlayerStore().setIsPlay(true);
    if (isElectron) {
      window.api.sendSong(cloneDeep(getPlayerStore().playMusic));
    }
    if (lrcArray.value.length === 0 && playMusic.value?.id) {
      ensureLyricsLoaded();
    }
    startProgressInterval();
  });

  audioService.on('pause', () => {
    console.log('Audio paused');
    // The pause is expected when switching to video mode, and a crossfade pause
    // can land late (it completes ~200ms after the call). Neither may flip the
    // shared play flag while another surface (video / MV) is still playing —
    // that was the "button shows paused while media plays" desync.
    const owner = currentMediaOwner.value;
    const otherSurfaceOwnsPlayback = Boolean(owner && owner !== 'audioService');
    if (getPlayerStore().playbackMode !== 'video' && !otherSurfaceOwnsPlayback) {
      getPlayerStore().setIsPlay(false);
      clearInterval();
    }
    if (isElectron && isLyricWindowOpen.value) {
      sendLyricToWin();
    }
  });

  audioService.on('end', async (track: SongResult) => {
    console.log('Audio ended');
    clearInterval();

    const gen = playbackRequestManager.getGeneration();
    if (track?.id !== getPlayerStore().playMusic.id || !getPlayerStore().userPlayIntent) return;
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    if (gen !== playbackRequestManager.getGeneration()) return;
    await usePlaylistStore().nextPlayOnEnd();
  });

  audioService.on('previoustrack', () => {
    getPlayerStore().prevPlay();
  });

  audioService.on('nexttrack', () => {
    getPlayerStore().nextPlay();
  });

  return () => {
    clearInterval();
    stopRecovery();
  };
};

export const play = async (): Promise<boolean> => {
  return getPlayerStore().setPlayMusic(true);
};

export const pause = (): void => {
  getPlayerStore().handlePause();
};

const CORRECTION_KEY = 'lyric-correction-map';
const correctionTimeMap = ref<Record<string, number>>({});

const loadCorrectionMap = () => {
  try {
    const raw = localStorage.getItem(CORRECTION_KEY);
    correctionTimeMap.value = raw ? JSON.parse(raw) : {};
  } catch {
    correctionTimeMap.value = {};
  }
};
const saveCorrectionMap = () => {
  localStorage.setItem(CORRECTION_KEY, JSON.stringify(correctionTimeMap.value));
};

loadCorrectionMap();

export const correctionTime = ref(0);

const setupCorrectionTimeWatcher = () => {
  watch(
    () => playMusic.value?.id,
    (id) => {
      if (!id) return;
      correctionTime.value = correctionTimeMap.value[id] ?? 0;
    },
    { immediate: true }
  );
};

/**
 * Set an exact lyric offset (seconds) for the current song.
 */
export const setCorrectionTime = (value: number) => {
  const id = playMusic.value?.id;
  if (!id || !Number.isFinite(value)) return;
  const clamped = Math.max(-30, Math.min(30, Math.round(value * 1000) / 1000));
  correctionTime.value = clamped;
  correctionTimeMap.value[id] = clamped;
  saveCorrectionMap();
  nowIndex.value = getLrcIndex(nowTime.value);
  if (isElectron && isLyricWindowOpen.value) {
    sendLyricToWin();
  }
};

/**
 */
export const adjustCorrectionTime = (delta: number) => {
  const id = playMusic.value?.id;
  if (!id) return;
  const rawVal = (correctionTime.value ?? 0) + delta;
  const roundedVal = Math.round(rawVal * 100) / 100;
  const newVal = Math.max(-10, Math.min(10, roundedVal));
  correctionTime.value = newVal;
  correctionTimeMap.value[id] = newVal;
  saveCorrectionMap();
  nowIndex.value = getLrcIndex(nowTime.value);
  if (isElectron && isLyricWindowOpen.value) {
    sendLyricToWin();
  }
};

export const isCurrentLrc = (index: number, time: number): boolean => {
  const currentTime = lrcTimeArray.value[index];

  if (index === lrcTimeArray.value.length - 1) {
    const correctedTime = time + correctionTime.value;
    return correctedTime >= currentTime;
  }

  const nextTime = lrcTimeArray.value[index + 1];
  const correctedTime = time + correctionTime.value;
  return correctedTime >= currentTime && correctedTime < nextTime;
};

export const getLrcIndex = (time: number): number => {
  const correctedTime = time + correctionTime.value;

  if (lrcTimeArray.value.length === 0) {
    return 0;
  }

  const lastIndex = lrcTimeArray.value.length - 1;
  if (correctedTime >= lrcTimeArray.value[lastIndex]) {
    return lastIndex;
  }

  for (let i = 0; i < lrcTimeArray.value.length - 1; i++) {
    const currentTime = lrcTimeArray.value[i];
    const nextTime = lrcTimeArray.value[i + 1];

    if (correctedTime >= currentTime && correctedTime < nextTime) {
      return i;
    }
  }

  return 0;
};

const currentLrcTiming = computed(() => {
  const start = lrcTimeArray.value[nowIndex.value] || 0;
  const end = lrcTimeArray.value[nowIndex.value + 1] || start + 1;
  return { start, end };
});

export const getLrcStyle = (index: number) => {
  const currentTime = nowTime.value + correctionTime.value;
  const start = lrcTimeArray.value[index];
  const end = lrcTimeArray.value[index + 1] ?? start + 1;

  if (currentTime >= start && currentTime < end) {
    const progress = ((currentTime - start) / (end - start)) * 100;
    return {
      backgroundImage: `linear-gradient(to right, #ffffff ${progress}%, #ffffff8a ${progress}%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      color: 'transparent',
      transition: 'background-image 0.1s linear'
    };
  }
  return {};
};

export const useLyricProgress = () => {
  return {
    getLrcStyle
  };
};

// Video-mode seek bridge: the fullscreen player registers how to seek its video element.
let videoSeekHandler: ((time: number) => void) | null = null;
export const registerVideoSeekHandler = (handler: ((time: number) => void) | null) => {
  videoSeekHandler = handler;
};

export const setAudioTime = (index: number): void => {
  const time = lrcTimeArray.value[index];
  if (!Number.isFinite(time)) return;
  const target = Math.max(0, time - correctionTime.value);
  nowTime.value = target;
  nowIndex.value = index;

  if (playerStore?.playbackMode === 'video' && videoSeekHandler) {
    videoSeekHandler(target);
    return;
  }

  const currentSound = audioService.getCurrentSound();
  if (!currentSound) return;
  audioService.seek(target);
  void play();
};

export const getCurrentLrc = () => {
  const index = getLrcIndex(nowTime.value);
  return {
    currentLrc: lrcArray.value[index],
    nextLrc: lrcArray.value[index + 1]
  };
};

export const getLrcTimeRange = (index: number) => ({
  currentTime: lrcTimeArray.value[index],
  nextTime: lrcTimeArray.value[index + 1]
});

watch(
  () => lrcArray.value,
  (newLrcArray) => {
    if (newLrcArray.length > 0 && isElectron && isLyricWindowOpen.value) {
      sendLyricToWin();
    }
  }
);

export const sendLyricToWin = () => {
  if (!isElectron || !isLyricWindowOpen.value) {
    return;
  }

  if (!playMusic.value || !playMusic.value.id) {
    return;
  }

  try {
    if (lrcArray.value && lrcArray.value.length > 0) {
      const nowIndex = getLrcIndex(nowTime.value);
      const updateData = {
        type: 'full',
        nowIndex,
        nowTime: nowTime.value,
        correctionTime: correctionTime.value,
        startCurrentTime: lrcTimeArray.value[nowIndex] || 0,
        nextTime: lrcTimeArray.value[nowIndex + 1] || 0,
        isPlay: isPlaybackActive(),
        lrcArray: lrcArray.value,
        lrcTimeArray: lrcTimeArray.value,
        allTime: allTime.value,
        playMusic: playMusic.value
      };

      window.api.sendLyric(JSON.stringify(updateData));
    } else {
      console.log('No lyric data available, sending empty lyric message');

      const emptyLyricData = {
        type: 'empty',
        nowIndex: 0,
        nowTime: nowTime.value,
        startCurrentTime: 0,
        nextTime: 0,
        isPlay: isPlaybackActive(),
        lrcArray: [{ text: 'This song has no lyrics', trText: '' }],
        lrcTimeArray: [0],
        allTime: allTime.value,
        playMusic: playMusic.value
      };
      window.api.sendLyric(JSON.stringify(emptyLyricData));
    }
  } catch (error) {
    console.error('Error sending lyric update:', error);
  }
};

const sendTrayLyric = (index: number) => {
  if (!isElectron || cachedPlatform !== 'linux') return;

  try {
    const lyric = lrcArray.value[index];
    if (!lyric) return;

    const currentTime = lrcTimeArray.value[index] || 0;
    const nextTime = lrcTimeArray.value[index + 1] || currentTime + 3;
    const duration = nextTime - currentTime;

    const lrcObj = JSON.stringify({
      content: lyric.text || '',
      time: duration.toFixed(1),
      sender: 'AlgerMusicPlayer'
    });

    window.electron.ipcRenderer.send('tray-lyric-update', lrcObj);
  } catch (error) {
    console.error('[TrayLyric] Failed to send:', error);
  }
};

let lyricSyncInterval: any = null;

const startLyricSync = () => {
  if (lyricSyncInterval) {
    clearInterval(lyricSyncInterval);
  }

  // Push a lyric update every second so the external window follows the clock.
  lyricSyncInterval = setInterval(() => {
    if (isElectron && isLyricWindowOpen.value && isPlaybackActive() && playMusic.value?.id) {
      // Send the current playback progress.
      try {
        const updateData = {
          type: 'update',
          nowIndex: getLrcIndex(nowTime.value),
          nowTime: nowTime.value,
          isPlay: isPlaybackActive()
        };
        window.api.sendLyric(JSON.stringify(updateData));
      } catch (error) {
        console.error('Failed to send the lyric progress update:', error);
      }
    }
  }, 1000);
};

const stopLyricSync = () => {
  if (lyricSyncInterval) {
    clearInterval(lyricSyncInterval);
    lyricSyncInterval = null;
  }
};

export const openLyric = async () => {
  if (!isElectron) return;

  if (!playMusic.value || !playMusic.value.id) {
    console.log('No track is playing, cannot open the lyrics window');
    return;
  }

  isLyricWindowOpen.value = !isLyricWindowOpen.value;
  if (isLyricWindowOpen.value) {
    window.api.openLyric();

    if (!lrcArray.value || lrcArray.value.length === 0) {
      const emptyLyricData = {
        type: 'empty',
        nowIndex: 0,
        nowTime: nowTime.value,
        startCurrentTime: 0,
        nextTime: 0,
        isPlay: isPlaybackActive(),
        lrcArray: [{ text: 'Loading lyrics...', trText: '' }],
        lrcTimeArray: [0],
        allTime: allTime.value,
        playMusic: playMusic.value
      };
      window.api.sendLyric(JSON.stringify(emptyLyricData));

      await ensureLyricsLoaded(true);
    } else {
      sendLyricToWin();
    }

    setTimeout(() => {
      if (isLyricWindowOpen.value) {
        sendLyricToWin();
      }
    }, 500);

    startLyricSync();
  } else {
    closeLyric();
    stopLyricSync();
  }
};

export const closeLyric = () => {
  if (!isElectron) return;
  isLyricWindowOpen.value = false;
  windowData.electron.ipcRenderer.send('close-lyric');

  stopLyricSync();
};

const setupPlayStateWatcher = () => {
  watch([() => getPlayerStore().play, () => getPlayerStore().isPlay], ([isPlaying]) => {
    if (isElectron && isLyricWindowOpen.value) {
      if (isPlaying) {
        startLyricSync();
      } else {
        const pauseData = {
          type: 'update',
          isPlay: false
        };
        window.api.sendLyric(JSON.stringify(pauseData));
      }
    }
  });
};

onUnmounted(() => {
  stopLyricSync();
});

export { parseLyricsString };

if (isElectron) {
  windowData.electron.ipcRenderer.on('lyric-control-back', (_, command: string) => {
    switch (command) {
      case 'playpause':
        if (getPlayerStore().playMusic?.id) {
          void getPlayerStore().setPlay({ ...getPlayerStore().playMusic });
        }
        break;
      case 'prev':
        getPlayerStore().prevPlay();
        break;
      case 'next':
        getPlayerStore().nextPlay();
        break;
      case 'close':
        isLyricWindowOpen.value = false;
        break;
      default:
        console.log('Unknown command:', command);
        break;
    }
  });
}

export const initAudioListeners = async () => {
  try {
    if (!getPlayerStore().playMusic || !getPlayerStore().playMusic.id) {
      console.log('No track is playing, skipping audio listener setup');
      return;
    }

    const initialSound = audioService.getCurrentSound();
    if (!initialSound) {
      console.log('No audio instance yet, waiting for audio to load...');
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const sound = audioService.getCurrentSound();
          if (sound) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          console.log('Timed out waiting for audio to load');
          resolve();
        }, 5000);
      });
    }

    setupAudioListeners();

    if (isElectron) {
      window.api.onLyricWindowClosed(() => {
        isLyricWindowOpen.value = false;
      });
      window.api.onLyricWindowReady(async () => {
        if (!isLyricWindowOpen.value) return;
        if (lrcArray.value.length === 0 && playMusic.value?.id) {
          await ensureLyricsLoaded(true);
        }
        sendLyricToWin();
      });
    }

    const finalSound = audioService.getCurrentSound();
    if (finalSound) {
      sound.value = finalSound;
    } else {
      console.warn('Audio instance unavailable, skipping progress updates');
    }
  } catch (error) {
    console.error('Failed to initialize audio listeners:', error);
  }
};

const handleAudioReady = ((event: CustomEvent) => {
  try {
    const { sound: newSound } = event.detail;
    if (newSound) {
      sound.value = audioService.getCurrentSound();
      setupAudioListeners();

      const currentSound = audioService.getCurrentSound();
      if (currentSound) {
        const currentPosition = currentSound.currentTime;
        if (typeof currentPosition === 'number' && !Number.isNaN(currentPosition)) {
          nowTime.value = currentPosition;
        }
      }
    }
  } catch (error) {
    console.error('Error handling audio ready event:', error);
  }
}) as EventListener;

window.removeEventListener('audio-ready', handleAudioReady);
window.addEventListener('audio-ready', handleAudioReady);
