import { createDiscreteApi } from 'naive-ui';
import { defineStore, storeToRefs } from 'pinia';
import { computed, ref, shallowRef, triggerRef } from 'vue';

import i18n from '@/../i18n/renderer';
import { useSongDetail } from '@/hooks/usePlayerHooks';
import { audioService } from '@/services/audioService';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { preloadService } from '@/services/preloadService';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { debouncedLocalStorage } from '@/utils/debouncedStorage';
import { minifySongList } from '@/utils/persistedSong';
import { performShuffle, preloadCoverImage } from '@/utils/playerUtils';

import { useIntelligenceModeStore } from './intelligenceMode';
import { usePlayerCoreStore } from './playerCore';
import { useSettingsStore } from './settings';
import { useSleepTimerStore } from './sleepTimer';

let _message: ReturnType<typeof createDiscreteApi>['message'] | null = null;
const getMessage = () => {
  if (!_message) _message = createDiscreteApi(['message']).message;
  return _message;
};

/**
 */
export const usePlaylistStore = defineStore(
  'playlist',
  () => {
    const playList = shallowRef<SongResult[]>([]);
    const playListIndex = ref(0);
    const playMode = ref(0);
    const originalPlayList = shallowRef<SongResult[]>([]);
    const playListDrawerVisible = ref(false);

    const consecutiveFailCount = ref(0);
    const MAX_CONSECUTIVE_FAILS = 5;
    let navigationGeneration = 0;
    let nextPlayRetryTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelRetryTimer = (): void => {
      if (nextPlayRetryTimer) clearTimeout(nextPlayRetryTimer);
      nextPlayRetryTimer = null;
    };

    // ==================== Computed ====================
    const currentPlayList = computed(() => playList.value);
    const currentPlayListIndex = computed(() => playListIndex.value);

    // ==================== Actions ====================

    /**
     */
    const fetchSongs = async (startIndex: number, endIndex: number) => {
      try {
        const targetList = playList.value;
        const firstIndex = Math.max(0, startIndex);
        const songs = targetList.slice(firstIndex, Math.min(endIndex, targetList.length));
        const { getSongDetail } = useSongDetail();

        const detailedSongs = await Promise.all(
          songs.map(async (song: SongResult) => {
            try {
              if (!song.playMusicUrl) {
                return await getSongDetail({ ...song });
              }
              return song;
            } catch (error) {
              console.error('Failed to fetch song details:', error);
              return song;
            }
          })
        );
        if (playList.value !== targetList) return;

        const nextSong = detailedSongs[0];
        if (nextSong && !(nextSong.lyric && nextSong.lyric.lrcTimeArray.length > 0)) {
          try {
            const { useLyrics } = await import('@/hooks/usePlayerHooks');
            const { loadLrc } = useLyrics();
            nextSong.lyric = await loadLrc(nextSong.id);
          } catch (error) {
            console.error('Failed to load lyrics:', error);
          }
        }

        if (nextSong?.picUrl && !(nextSong.backgroundColor && nextSong.primaryColor)) {
          try {
            const { getImageLinearBackground } = await import('@/utils/linearColor');
            const { backgroundColor, primaryColor } = await getImageLinearBackground(
              getImgUrl(nextSong.picUrl, '30y30')
            );
            nextSong.backgroundColor = backgroundColor;
            nextSong.primaryColor = primaryColor;
          } catch (error) {
            console.warn('Failed to warm background color:', error);
          }
        }

        if (playList.value !== targetList) return;
        detailedSongs.forEach((song, index) => {
          if (song && targetList[firstIndex + index] === songs[index]) {
            targetList[firstIndex + index] = song;
          }
        });
        triggerRef(playList);

        if (nextSong) {
          if (nextSong.playMusicUrl) {
            preloadService.load(nextSong).catch((err) => {
              console.warn('Failed to preload next track:', err);
            });
          }
          if (nextSong.picUrl) {
            preloadCoverImage(nextSong.picUrl, getImgUrl);
          }
        }
      } catch (error) {
        console.error('Failed to fetch song list:', error);
      }
    };

    /**
     */
    let preloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const preloadNextSongs = (currentIndex: number) => {
      if (preloadDebounceTimer) clearTimeout(preloadDebounceTimer);
      const list = playList.value;
      preloadDebounceTimer = setTimeout(() => {
        preloadDebounceTimer = null;
        if (list !== playList.value || currentIndex !== playListIndex.value) return;
        doPreloadNextSongs(currentIndex);
      }, 800);
    };

    const doPreloadNextSongs = (currentIndex: number) => {
      if (playList.value.length <= 1) return;

      let nextIndex: number;

      if (playMode.value === 0) {
        if (currentIndex >= playList.value.length - 1) {
          return;
        }
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = (currentIndex + 1) % playList.value.length;
      }

      const endIndex = Math.min(nextIndex + 2, playList.value.length);

      if (nextIndex < playList.value.length) {
        fetchSongs(nextIndex, endIndex);

        if (
          (playMode.value === 1 || playMode.value === 2) &&
          nextIndex + 1 >= playList.value.length &&
          playList.value.length > 2
        ) {
          fetchSongs(0, 1);
        }
      }
    };

    /**
     */
    const shufflePlayList = () => {
      console.log('[PlaylistStore] shufflePlayList called');
      if (playList.value.length === 0) return;

      if (originalPlayList.value.length === 0) {
        console.log('[PlaylistStore] Saving original list, length:', playList.value.length);
        originalPlayList.value = [...playList.value];
      }

      const currentSong = playList.value[playListIndex.value];
      console.log('[PlaylistStore] Current song before shuffle:', currentSong?.name);

      const shuffled = performShuffle([...playList.value], currentSong);
      playList.value = [...shuffled];
      playListIndex.value = 0;

      console.log('[PlaylistStore] List shuffled, new length:', playList.value.length);
      console.log('[PlaylistStore] New first song:', playList.value[0]?.name);
    };

    /**
     */
    const restoreOriginalOrder = () => {
      console.log('[PlaylistStore] restoreOriginalOrder called');
      if (originalPlayList.value.length === 0) return;

      const currentSong = playList.value[playListIndex.value];
      console.log('[PlaylistStore] Current song before restore:', currentSong?.name);

      playList.value = [...originalPlayList.value];
      originalPlayList.value = [];

      if (currentSong) {
        const index = playList.value.findIndex((s) => s.id === currentSong.id);
        if (index !== -1) {
          playListIndex.value = index;
        }
      }
      console.log('[PlaylistStore] Original order restored, new index:', playListIndex.value);
    };

    /**
     */
    const setPlayList = (
      list: SongResult[],
      keepIndex: boolean = false,
      fromIntelligenceMode: boolean = false,
      preserveOrder: boolean = false
    ) => {
      navigationGeneration++;
      cancelRetryTimer();
      if (preloadDebounceTimer) clearTimeout(preloadDebounceTimer);
      preloadDebounceTimer = null;
      if (!fromIntelligenceMode) {
        const intelligenceStore = useIntelligenceModeStore();
        console.log('[PlaylistStore.setPlayList] Checking intelligence mode state:', {
          isIntelligenceMode: intelligenceStore.isIntelligenceMode,
          currentPlayMode: playMode.value,
          fromIntelligenceMode
        });

        if (intelligenceStore.isIntelligenceMode) {
          console.log('[PlaylistStore] Exited intelligence mode, switching to sequential playback');
          playMode.value = 0;
          intelligenceStore.clearIntelligenceMode(true);
          console.log(
            '[PlaylistStore] Intelligence mode exited, new playback mode: ',
            playMode.value
          );
        }
      }

      usePlayerCoreStore().isFmPlaying = false;

      if (list.length === 0) {
        playList.value = [];
        playListIndex.value = 0;
        originalPlayList.value = [];
        return;
      }

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      if (preserveOrder) {
        console.log('edit playlist in place, preserving order');

        if (playMode.value === 2) {
          const idSet = new Set(list.map((song) => song.id));
          const reconciled = originalPlayList.value.filter((song) => idSet.has(song.id));
          const existingIds = new Set(reconciled.map((song) => song.id));
          for (const song of list) {
            if (!existingIds.has(song.id)) {
              reconciled.push(song);
            }
          }
          originalPlayList.value = reconciled;
        } else if (originalPlayList.value.length > 0) {
          originalPlayList.value = [];
        }

        const currentSong = playMusic.value;
        const currentIndex =
          currentSong && currentSong.id ? list.findIndex((song) => song.id === currentSong.id) : -1;
        playListIndex.value =
          currentIndex !== -1
            ? currentIndex
            : Math.min(Math.max(0, playListIndex.value), list.length - 1);

        playList.value = [...list];
      } else if (playMode.value === 2) {
        console.log('set new playlist in shuffle mode, saving original order and shuffling');

        originalPlayList.value = [...list];

        const currentSong = playMusic.value;
        const shuffledList = performShuffle(list, currentSong);

        if (currentSong && currentSong.id) {
          const currentSongIndex = shuffledList.findIndex((song) => song.id === currentSong.id);
          playListIndex.value =
            currentSongIndex !== -1 ? 0 : keepIndex ? Math.max(0, playListIndex.value) : 0;
        } else {
          playListIndex.value = keepIndex ? Math.max(0, playListIndex.value) : 0;
        }

        playList.value = shuffledList;
      } else {
        console.log('set new playlist in sequential/loop mode');
        if (originalPlayList.value.length > 0) {
          originalPlayList.value = [];
        }

        if (!keepIndex) {
          const foundIndex = list.findIndex((item) => item.id === playMusic.value.id);
          playListIndex.value = foundIndex !== -1 ? foundIndex : 0;
        }

        playList.value = [...list];
      }
      playListIndex.value = Math.min(Math.max(0, playListIndex.value), playList.value.length - 1);
    };

    /**
     */
    const addToNextPlay = (song: SongResult) => {
      const list = [...playList.value];
      const currentIndex = playListIndex.value;
      if (list[currentIndex]?.id === song.id) return;

      const existingIndex = list.findIndex((item) => item.id === song.id);
      if (existingIndex !== -1) {
        list.splice(existingIndex, 1);
        if (existingIndex <= currentIndex) {
          playListIndex.value = Math.max(0, playListIndex.value - 1);
        }
      }

      const insertIndex = playListIndex.value + 1;
      list.splice(insertIndex, 0, song);

      setPlayList(list, true, false, true);
    };

    /**
     */
    const prepareSongPlayback = (song: SongResult, context: SongResult[] = []): boolean => {
      const playerCore = usePlayerCoreStore();
      const matchesSong = (item: SongResult): boolean =>
        item.id === song.id && (item.source ?? 'youtube') === (song.source ?? 'youtube');
      const existingIndex = playList.value.findIndex(matchesSong);

      if (
        existingIndex !== -1 &&
        !playerCore.isFmPlaying &&
        matchesSong(playerCore.playMusic) &&
        (!song.playMusicUrl || song.playMusicUrl === playerCore.playMusic.playMusicUrl)
      ) {
        return false;
      }

      const settingsStore = useSettingsStore();
      playerCore.isFmPlaying = false;
      const replaceContext =
        settingsStore.setData.singleSongPlayMode !== 'add' && context.some(matchesSong);
      if (replaceContext) {
        setPlayList([...context]);
      } else if (existingIndex === -1) {
        addToNextPlay(song);
      } else {
        setPlayList([...playList.value], true, false, true);
      }

      playListIndex.value = Math.max(0, playList.value.findIndex(matchesSong));
      return replaceContext;
    };

    /**
     */
    const removeFromPlayList = (id: number | string) => {
      const index = playList.value.findIndex((item) => item.id === id);
      if (index === -1) return;

      const playerCore = usePlayerCoreStore();
      const { playMusic } = storeToRefs(playerCore);

      const isCurrent = id === playMusic.value.id;
      const shouldPlay = playerCore.userPlayIntent || playerCore.play;
      const newPlayList = [...playList.value];
      newPlayList.splice(index, 1);
      if (isCurrent && newPlayList.length === 0) {
        clearPlayAll();
        return;
      }
      setPlayList(newPlayList, false, false, true);
      if (isCurrent) {
        playerCore.handlePause();
        playListIndex.value = Math.min(index, newPlayList.length - 1);
        void playAtIndex(playListIndex.value, shouldPlay, false);
      }
    };

    /**
     */
    const clearPlayAll = (): void => {
      const playerCore = usePlayerCoreStore();
      playerCore.handlePause();
      audioService.stop();
      playerCore.playMusic = {} as SongResult;
      playerCore.playMusicUrl = '';
      setPlayList([]);
      consecutiveFailCount.value = 0;
      preloadService.clearAll();
      try {
        localStorage.removeItem('currentPlayMusic');
        localStorage.removeItem('currentPlayMusicUrl');
        localStorage.removeItem('playProgress');
      } catch (error) {
        console.warn('Failed to clear playback progress:', error);
      }
    };

    /**
     */
    const togglePlayMode = async () => {
      const wasRandom = playMode.value === 2;
      const wasIntelligence = playMode.value === 3;

      const newMode = wasIntelligence ? 0 : (playMode.value + 1) % 3;

      const isRandom = newMode === 2;

      console.log(`[PlaylistStore] togglePlayMode: ${playMode.value} -> ${newMode}`);
      playMode.value = newMode;

      if (isRandom && !wasRandom && playList.value.length > 0) {
        shufflePlayList();
        console.log('entered shuffle mode, shuffled playlist');
      }

      if (!isRandom && wasRandom) {
        restoreOriginalOrder();
        console.log('left shuffle mode, restored original order');
      }

      if (wasIntelligence) {
        console.log('exit intelligence mode');
        const intelligenceStore = useIntelligenceModeStore();
        intelligenceStore.clearIntelligenceMode(true);
      }
    };

    /**
     */
    const _nextFmPlay = async () => {
      const playerCore = usePlayerCoreStore();
      const operation = ++navigationGeneration;
      playerCore.handlePause();
      const gen = playbackRequestManager.getGeneration();
      const isCurrent = () =>
        operation === navigationGeneration && gen === playbackRequestManager.getGeneration();
      try {
        playerCore.setIsPlay(false);
        return;
      } catch (error) {
        console.error('FM next-track failed:', error);
        if (isCurrent()) playerCore.handlePause();
      }
    };

    const playAtIndex = async (
      index: number,
      shouldPlay: boolean = true,
      skipOnFailure: boolean = true
    ): Promise<boolean> => {
      const song = playList.value[index];
      if (!song?.id) return false;
      playListIndex.value = index;
      const operation = ++navigationGeneration;
      playbackRequestManager.cancelCurrentRequest();
      const initialGeneration = playbackRequestManager.getGeneration();
      try {
        const { playTrack, getCurrentGeneration } = await import('@/services/playbackController');
        if (operation !== navigationGeneration || initialGeneration !== getCurrentGeneration())
          return false;
        const playback = playTrack({ ...song }, shouldPlay);
        const generation = getCurrentGeneration();
        const success = await playback;
        if (operation !== navigationGeneration || generation !== getCurrentGeneration())
          return false;
        if (success) {
          consecutiveFailCount.value = 0;
          return true;
        }
        const core = usePlayerCoreStore();
        consecutiveFailCount.value++;
        if (!skipOnFailure || consecutiveFailCount.value >= MAX_CONSECUTIVE_FAILS) {
          if (consecutiveFailCount.value >= MAX_CONSECUTIVE_FAILS) {
            getMessage().warning(i18n.global.t('player.consecutiveFailsError'));
          }
          core.handlePause();
          return false;
        }
        if (playList.value.length > 1) {
          cancelRetryTimer();
          nextPlayRetryTimer = setTimeout(() => {
            nextPlayRetryTimer = null;
            if (operation !== navigationGeneration || generation !== getCurrentGeneration()) return;
            void _nextPlay(false, true);
          }, 500);
        } else {
          core.handlePause();
        }
        return false;
      } catch (error) {
        console.error('Failed to change track:', error);
        if (operation === navigationGeneration) usePlayerCoreStore().handlePause();
        return false;
      }
    };

    /**
     */
    const _nextPlay = async (autoEnd: boolean = false, fromFailover: boolean = false) => {
      try {
        const playerCore = usePlayerCoreStore();
        const sleepTimerStore = useSleepTimerStore();
        const isLast = playListIndex.value >= playList.value.length - 1;
        if (autoEnd && sleepTimerStore.handleSongEnd(isLast)) return false;

        if (playerCore.isFmPlaying) {
          if (!fromFailover) {
            cancelRetryTimer();
            consecutiveFailCount.value = 0;
          }
          await _nextFmPlay();
          return false;
        }

        if (playList.value.length === 0) return false;

        if (!fromFailover) {
          cancelRetryTimer();
          consecutiveFailCount.value = 0;
        }

        if (consecutiveFailCount.value >= MAX_CONSECUTIVE_FAILS) {
          console.error(
            `[nextPlay] Stopped after ${MAX_CONSECUTIVE_FAILS} consecutive playback failures`
          );
          getMessage().warning(i18n.global.t('player.consecutiveFailsError'));
          consecutiveFailCount.value = 0;
          playerCore.handlePause();
          return false;
        }

        // Sequential mode: at the last song
        if (playMode.value === 0 && playListIndex.value >= playList.value.length - 1) {
          if (autoEnd || fromFailover) {
            console.log('[nextPlay] Sequential: last track finished, stopping');
            getMessage().info(i18n.global.t('player.playListEnded'));
            playerCore.handlePause();
          } else {
            console.log('[nextPlay] Sequential: already on last track, staying');
            getMessage().info(i18n.global.t('player.playListEnded'));
          }
          return false;
        }

        const index =
          autoEnd && playMode.value === 1
            ? playListIndex.value
            : (playListIndex.value + 1) % playList.value.length;
        return await playAtIndex(index);
      } catch (error) {
        console.error('Error switching to next track:', error);
        return false;
      }
    };

    const nextPlay = _nextPlay;

    const nextPlayOnEnd = () => {
      return _nextPlay(true);
    };

    const _prevPlay = async () => {
      try {
        const playerCore = usePlayerCoreStore();

        if (playerCore.isFmPlaying) {
          cancelRetryTimer();
          consecutiveFailCount.value = 0;
          await _nextFmPlay();
          return false;
        }

        if (playList.value.length === 0) return false;

        cancelRetryTimer();
        const nowPlayListIndex =
          (playListIndex.value - 1 + playList.value.length) % playList.value.length;
        consecutiveFailCount.value = 0;
        return await playAtIndex(nowPlayListIndex, true, false);
      } catch (error) {
        console.error('Error switching to previous track:', error);
        return false;
      }
    };

    const prevPlay = _prevPlay;

    /**
     */
    const setPlayListDrawerVisible = (value: boolean) => {
      playListDrawerVisible.value = value;
    };

    const setPlay = async (song: SongResult): Promise<boolean> => {
      if (!song?.id) return false;
      navigationGeneration++;
      cancelRetryTimer();
      consecutiveFailCount.value = 0;
      try {
        const playerCore = usePlayerCoreStore();

        // Toggle play/pause for current song
        if (
          playerCore.playMusic.id === song.id &&
          (!song.playMusicUrl || playerCore.playMusic.playMusicUrl === song.playMusicUrl)
        ) {
          if (playerCore.userPlayIntent || playerCore.play) {
            playerCore.handlePause();
            return true;
          }
          return await playerCore.setPlayMusic(true);
        }

        // Update playlist index
        const songIndex = playList.value.findIndex((item: SongResult) => item.id === song.id);
        if (songIndex !== -1 && songIndex !== playListIndex.value) {
          console.log('Song index mismatch, updated to:', songIndex);
          playListIndex.value = songIndex;
        }

        return await playerCore.setPlayMusic({ ...song });
      } catch (error) {
        console.error('Failed to set playback:', error);
        return false;
      }
    };

    /**
     */
    const initializePlaylist = async () => {
      if (playMode.value === 2 && playList.value.length > 0) {
        if (originalPlayList.value.length === 0) {
          console.log('restored shuffle mode after restart, reshuffled playlist');
          shufflePlayList();
        } else {
          console.log('restored shuffle mode after restart, playlist already shuffled');
        }
      }
    };

    return {
      playList,
      playListIndex,
      playMode,
      originalPlayList,
      playListDrawerVisible,

      // Computed
      currentPlayList,
      currentPlayListIndex,

      // Actions
      setPlayList,
      prepareSongPlayback,
      addToNextPlay,
      removeFromPlayList,
      clearPlayAll,
      togglePlayMode,
      shufflePlayList,
      restoreOriginalOrder,
      preloadNextSongs,
      nextPlay,
      nextPlayOnEnd,
      prevPlay,
      setPlayListDrawerVisible,
      setPlay,
      initializePlaylist,
      fetchSongs,
      updateSong: (song: SongResult) => {
        const index = playList.value.findIndex(
          (item) => item.id === song.id && item.source === song.source
        );
        if (index !== -1) {
          playList.value[index] = song;
          playList.value = [...playList.value];
        }
      }
    };
  },
  {
    persist: {
      key: 'playlist-store',
      storage: debouncedLocalStorage,
      pick: ['playList', 'playListIndex', 'playMode', 'originalPlayList'],
      serializer: {
        serialize: (state: any) => {
          return JSON.stringify({
            ...state,
            playList: minifySongList(state.playList),
            originalPlayList: minifySongList(state.originalPlayList)
          });
        },
        deserialize: JSON.parse
      }
    }
  }
);
