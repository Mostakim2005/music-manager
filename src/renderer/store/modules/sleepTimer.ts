import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import i18n from '@/../i18n/renderer';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { getLocalStorageItem, setLocalStorageItem } from '@/utils/playerUtils';

export enum SleepTimerType {
  NONE = 'none',
  TIME = 'time',
  SONGS = 'songs',
  PLAYLIST_END = 'end'
}

export interface SleepTimerInfo {
  type: SleepTimerType;
  value: number;
  endTime?: number;
  startSongIndex?: number;
  remainingSongs?: number;
}

/**
 */
export const useSleepTimerStore = defineStore('sleepTimer', () => {
  const sleepTimer = ref<SleepTimerInfo>(
    getLocalStorageItem('sleepTimer', {
      type: SleepTimerType.NONE,
      value: 0
    })
  );
  const showSleepTimer = ref(false);
  const timerInterval = ref<number | null>(null);

  // ==================== Computed ====================
  const currentSleepTimer = computed(() => sleepTimer.value);
  const hasSleepTimerActive = computed(() => sleepTimer.value.type !== SleepTimerType.NONE);

  const sleepTimerRemainingTime = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      const remaining = Math.max(0, sleepTimer.value.endTime - Date.now());
      return Math.ceil(remaining / 60000);
    }
    return 0;
  });

  const sleepTimerRemainingSongs = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.SONGS) {
      return sleepTimer.value.remainingSongs || 0;
    }
    return 0;
  });

  // ==================== Actions ====================

  /**
   */
  const setSleepTimerByTime = (minutes: number) => {
    clearSleepTimer();

    if (minutes <= 0) {
      return false;
    }

    const endTime = Date.now() + minutes * 60 * 1000;

    sleepTimer.value = {
      type: SleepTimerType.TIME,
      value: minutes,
      endTime
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    timerInterval.value = window.setInterval(() => {
      checkSleepTimer();
    }, 1000) as unknown as number;

    console.log(`Sleep timer: ${minutes} minutes`);
    return true;
  };

  /**
   */
  const setSleepTimerBySongs = async (songs: number) => {
    clearSleepTimer();

    if (songs <= 0) {
      return false;
    }

    const { usePlaylistStore } = await import('./playlist');
    const playlistStore = usePlaylistStore();

    sleepTimer.value = {
      type: SleepTimerType.SONGS,
      value: songs,
      startSongIndex: playlistStore.playListIndex,
      remainingSongs: songs
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    console.log(`Sleep timer: after ${songs} more tracks`);
    return true;
  };

  /**
   */
  const setSleepTimerAtPlaylistEnd = () => {
    clearSleepTimer();

    sleepTimer.value = {
      type: SleepTimerType.PLAYLIST_END,
      value: 0
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    console.log('Sleep timer: end of playlist');
    return true;
  };

  /**
   */
  const clearSleepTimer = () => {
    if (timerInterval.value) {
      window.clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    sleepTimer.value = {
      type: SleepTimerType.NONE,
      value: 0
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    console.log('Sleep timer cancelled');
    return true;
  };

  /**
   */
  const checkSleepTimer = () => {
    if (sleepTimer.value.type === SleepTimerType.NONE) {
      return;
    }

    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      if (Date.now() >= sleepTimer.value.endTime) {
        stopPlayback();
      }
    }
  };

  /**
   */
  const stopPlayback = (): void => {
    if (sleepTimer.value.type === SleepTimerType.NONE) return;
    console.log('Sleep timer fired: stopping playback');
    const playerCore = usePlayerCoreStore();
    playerCore.handlePause();
    clearSleepTimer();

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('show-notification', {
        title: i18n.global.t('player.sleepTimer.timerEnded'),
        body: i18n.global.t('player.sleepTimer.playbackStopped')
      });
    }
  };

  /**
   */
  const handleSongEnd = (isLastSong: boolean): boolean => {
    if (
      sleepTimer.value.type === SleepTimerType.TIME &&
      sleepTimer.value.endTime &&
      Date.now() >= sleepTimer.value.endTime
    ) {
      stopPlayback();
      return true;
    }
    if (
      sleepTimer.value.type === SleepTimerType.SONGS &&
      sleepTimer.value.remainingSongs !== undefined
    ) {
      sleepTimer.value.remainingSongs--;
      console.log(`Remaining tracks: ${sleepTimer.value.remainingSongs}`);

      setLocalStorageItem('sleepTimer', sleepTimer.value);

      if (sleepTimer.value.remainingSongs <= 0) {
        stopPlayback();
        return true;
      }
    }

    if (sleepTimer.value.type === SleepTimerType.PLAYLIST_END && isLastSong) {
      stopPlayback();
      return true;
    }
    return false;
  };

  /**
   */
  const setShowSleepTimer = (value: boolean) => {
    showSleepTimer.value = value;
  };

  /**
   */
  const restoreTimerInterval = () => {
    if (sleepTimer.value.type !== SleepTimerType.TIME || !sleepTimer.value.endTime) {
      return;
    }
    if (Date.now() >= sleepTimer.value.endTime) {
      stopPlayback();
      return;
    }
    if (!timerInterval.value) {
      timerInterval.value = window.setInterval(() => {
        checkSleepTimer();
      }, 1000) as unknown as number;
    }
  };

  restoreTimerInterval();

  return {
    sleepTimer,
    showSleepTimer,

    // Computed
    currentSleepTimer,
    hasSleepTimerActive,
    sleepTimerRemainingTime,
    sleepTimerRemainingSongs,

    // Actions
    setSleepTimerByTime,
    setSleepTimerBySongs,
    setSleepTimerAtPlaylistEnd,
    clearSleepTimer,
    checkSleepTimer,
    stopPlayback,
    handleSongEnd,
    setShowSleepTimer
  };
});
