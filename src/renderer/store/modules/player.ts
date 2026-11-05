/**
 */

import { defineStore, storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useFavoriteStore } from './favorite';
import { useIntelligenceModeStore } from './intelligenceMode';
import { PLAY_PAUSE_FADE_DURATION, usePlayerCoreStore } from './playerCore';
import { cleanupLegacyPlayHistoryStorage } from './playHistory';
import { usePlaylistStore } from './playlist';
import { type SleepTimerInfo, SleepTimerType, useSleepTimerStore } from './sleepTimer';

export { PLAY_PAUSE_FADE_DURATION, type SleepTimerInfo, SleepTimerType };
export {
  copyLyric,
  getSongUrl,
  loadLrc,
  lyricParser,
  parseLyric,
  useLyrics,
  useSongDetail,
  useSongUrl
} from '@/hooks/usePlayerHooks';
export { isBilibiliIdMatch } from '@/utils/playerUtils';

/**
 */
export const usePlayerStore = defineStore('player', () => {
  const playerCore = usePlayerCoreStore();
  const playlist = usePlaylistStore();
  const favorite = useFavoriteStore();
  const sleepTimer = useSleepTimerStore();
  const intelligenceMode = useIntelligenceModeStore();

  const {
    play,
    isPlay,
    playMusic,
    playMusicUrl,
    musicFull,
    playbackRate,
    volume,
    isMuted,
    userPlayIntent,
    isFmPlaying,
    playbackMode,
    videoCarryTime,
    showWaveformSeekbar,
    showVideoModeToggle,
    showAbLoopOnBar,
    showStatsOnBar,
    showDiagnosticsOnBar,
    enableDynamicPalette
  } = storeToRefs(playerCore);

  const { playList, playListIndex, playMode, originalPlayList, playListDrawerVisible } =
    storeToRefs(playlist);

  const { favoriteList, dislikeList } = storeToRefs(favorite);

  const { sleepTimer: sleepTimerState, showSleepTimer } = storeToRefs(sleepTimer);

  const { isIntelligenceMode, intelligenceModeInfo } = storeToRefs(intelligenceMode);

  // ==================== Computed ====================
  const currentSong = computed(() => playerCore.currentSong);
  const isPlaying = computed(() => playerCore.isPlaying);
  const currentPlayList = computed(() => playlist.currentPlayList);
  const currentPlayListIndex = computed(() => playlist.currentPlayListIndex);

  const currentSleepTimer = computed(() => sleepTimer.currentSleepTimer);
  const hasSleepTimerActive = computed(() => sleepTimer.hasSleepTimerActive);
  const sleepTimerRemainingTime = computed(() => sleepTimer.sleepTimerRemainingTime);
  const sleepTimerRemainingSongs = computed(() => sleepTimer.sleepTimerRemainingSongs);

  /**
   */
  const initializePlayState = async () => {
    cleanupLegacyPlayHistoryStorage();

    const { initializePlayState: initPlayState } = await import('@/services/playbackController');
    await initPlayState();
    await playlist.initializePlaylist();
  };

  /**
   */
  const initializeFavoriteList = async () => {
    await favorite.initializeFavoriteList();
  };

  return {
    play,
    isPlay,
    playMusic,
    playMusicUrl,
    musicFull,
    playbackRate,
    volume,
    isMuted,
    userPlayIntent,
    isFmPlaying,
    playbackMode,
    videoCarryTime,
    showWaveformSeekbar,
    showVideoModeToggle,
    showAbLoopOnBar,
    showStatsOnBar,
    showDiagnosticsOnBar,
    enableDynamicPalette,

    // PlayerCore - Computed
    currentSong,
    isPlaying,

    // PlayerCore - Actions
    setIsPlay: playerCore.setIsPlay,
    setMusicFull: playerCore.setMusicFull,
    setPlayMusic: playerCore.setPlayMusic,
    setPlaybackRate: playerCore.setPlaybackRate,
    setVolume: playerCore.setVolume,
    getVolume: playerCore.getVolume,
    increaseVolume: playerCore.increaseVolume,
    decreaseVolume: playerCore.decreaseVolume,
    setMuted: playerCore.setMuted,
    toggleMute: playerCore.toggleMute,
    handlePause: playerCore.handlePause,
    setPlaybackMode: playerCore.setPlaybackMode,
    resetMediaStateForNewSong: playerCore.resetMediaStateForNewSong,
    setShowWaveformSeekbar: playerCore.setShowWaveformSeekbar,
    setShowVideoModeToggle: playerCore.setShowVideoModeToggle,
    setShowAbLoopOnBar: playerCore.setShowAbLoopOnBar,
    setShowStatsOnBar: playerCore.setShowStatsOnBar,
    setShowDiagnosticsOnBar: playerCore.setShowDiagnosticsOnBar,
    setEnableDynamicPalette: playerCore.setEnableDynamicPalette,

    playList,
    playListIndex,
    playMode,
    originalPlayList,
    playListDrawerVisible,

    // Playlist - Computed
    currentPlayList,
    currentPlayListIndex,

    // Playlist - Actions
    setPlayList: playlist.setPlayList,
    prepareSongPlayback: playlist.prepareSongPlayback,
    addToNextPlay: playlist.addToNextPlay,
    removeFromPlayList: playlist.removeFromPlayList,
    clearPlayAll: playlist.clearPlayAll,
    togglePlayMode: playlist.togglePlayMode,
    shufflePlayList: playlist.shufflePlayList,
    restoreOriginalOrder: playlist.restoreOriginalOrder,
    preloadNextSongs: playlist.preloadNextSongs,
    nextPlay: playlist.nextPlay,
    prevPlay: playlist.prevPlay,
    setPlayListDrawerVisible: playlist.setPlayListDrawerVisible,
    setPlay: playlist.setPlay,

    favoriteList,
    dislikeList,

    // Favorite - Actions
    addToFavorite: favorite.addToFavorite,
    removeFromFavorite: favorite.removeFromFavorite,
    addToDislikeList: favorite.addToDislikeList,
    removeFromDislikeList: favorite.removeFromDislikeList,

    sleepTimer: sleepTimerState,
    showSleepTimer,

    // SleepTimer - Computed
    currentSleepTimer,
    hasSleepTimerActive,
    sleepTimerRemainingTime,
    sleepTimerRemainingSongs,

    // SleepTimer - Actions
    setSleepTimerByTime: sleepTimer.setSleepTimerByTime,
    setSleepTimerBySongs: sleepTimer.setSleepTimerBySongs,
    setSleepTimerAtPlaylistEnd: sleepTimer.setSleepTimerAtPlaylistEnd,
    clearSleepTimer: sleepTimer.clearSleepTimer,

    isIntelligenceMode,
    intelligenceModeInfo,

    // IntelligenceMode - Actions
    playIntelligenceMode: intelligenceMode.playIntelligenceMode,

    initializePlayState,
    initializeFavoriteList
  };
});
