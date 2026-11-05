import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { audioService, PLAY_PAUSE_FADE_DURATION } from '@/services/audioService';
import { mediaCoordinator } from '@/services/mediaCoordinator';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { getSongKey, savePosition } from '@/services/songLibrary';

export { PLAY_PAUSE_FADE_DURATION };
import type { AudioOutputDevice } from '@/types/audio';
import type { SongResult } from '@/types/music';
import { debouncedLocalStorage } from '@/utils/debouncedStorage';
import { minifySong } from '@/utils/persistedSong';
import { savePlaybackProgress } from '@/utils/playerUtils';

/**
 */
export const usePlayerCoreStore = defineStore(
  'playerCore',
  () => {
    const play = ref(false);
    const isPlay = ref(false);
    const playMusic = ref<SongResult>({} as SongResult);
    const playMusicUrl = ref('');
    const musicFull = ref(false);
    const playbackRate = ref(1.0);
    const volume = ref(1);
    const isMuted = ref(false);
    const userPlayIntent = ref(false);
    const isFmPlaying = ref(false);
    const playbackMode = ref<'song' | 'video'>('song'); // Seamless Audio/Video mode ('song' | 'video')
    const videoCarryTime = ref<number>(0);
    const showWaveformSeekbar = ref<boolean>(
      localStorage.getItem('showWaveformSeekbar') !== 'false'
    );
    const showVideoModeToggle = ref<boolean>(
      localStorage.getItem('showVideoModeToggle') !== 'false'
    );
    const showAbLoopOnBar = ref<boolean>(localStorage.getItem('showAbLoopOnBar') !== 'false');
    const showStatsOnBar = ref<boolean>(localStorage.getItem('showStatsOnBar') !== 'false');
    const showDiagnosticsOnBar = ref<boolean>(
      localStorage.getItem('showDiagnosticsOnBar') !== 'false'
    );
    const enableDynamicPalette = ref<boolean>(
      localStorage.getItem('enableDynamicPalette') !== 'false'
    );

    const setPlaybackMode = (mode: 'song' | 'video', carryTime?: number) => {
      const prevMode = playbackMode.value;
      playbackMode.value = mode;

      if (prevMode !== mode) {
        if (mode === 'video') {
          // Linked A/V mode: the audio element stays the master clock and the
          // only sound source; the (muted) video element follows it. The audio
          // is deliberately NOT paused here — pausing it caused the ~1s gap and
          // the late crossfade 'pause' events that desynced the play button.
          const audioTime =
            typeof carryTime === 'number' ? carryTime : audioService.getCurrentTime();
          videoCarryTime.value = audioTime;
        } else if (mode === 'song') {
          // Carry currentTime from video back across to audio
          const targetTime = typeof carryTime === 'number' ? carryTime : videoCarryTime.value;
          if (targetTime > 0) {
            audioService.seek(targetTime);
          }
        }
      }
    };

    /**
     * Per-song media reset. Media (video, quality, youtube link) is matched by
     * song ID, so none of it may survive a track change: without this the
     * previous song's video/artwork and the mode pill carried over and the play
     * button toggled the stale video element instead of the new audio.
     */
    const resetMediaStateForNewSong = () => {
      playbackMode.value = 'song';
      videoCarryTime.value = 0;
    };

    const setShowWaveformSeekbar = (enabled: boolean) => {
      showWaveformSeekbar.value = enabled;
      try {
        localStorage.setItem('showWaveformSeekbar', String(enabled));
      } catch {
        // ignore
      }
    };

    const setShowVideoModeToggle = (enabled: boolean) => {
      showVideoModeToggle.value = enabled;
      try {
        localStorage.setItem('showVideoModeToggle', String(enabled));
      } catch {
        // ignore
      }
    };

    const setShowAbLoopOnBar = (enabled: boolean) => {
      showAbLoopOnBar.value = enabled;
      try {
        localStorage.setItem('showAbLoopOnBar', String(enabled));
      } catch {
        // ignore
      }
    };

    const setShowStatsOnBar = (enabled: boolean) => {
      showStatsOnBar.value = enabled;
      try {
        localStorage.setItem('showStatsOnBar', String(enabled));
      } catch {
        // ignore
      }
    };

    const setShowDiagnosticsOnBar = (enabled: boolean) => {
      showDiagnosticsOnBar.value = enabled;
      try {
        localStorage.setItem('showDiagnosticsOnBar', String(enabled));
      } catch {
        // ignore
      }
    };

    const setEnableDynamicPalette = (enabled: boolean) => {
      enableDynamicPalette.value = enabled;
      try {
        localStorage.setItem('enableDynamicPalette', String(enabled));
      } catch {
        // ignore
      }
    };

    const audioOutputDeviceId = ref<string>(
      localStorage.getItem('audioOutputDeviceId') || 'default'
    );
    const availableAudioDevices = ref<AudioOutputDevice[]>([]);

    // ==================== Computed ====================
    const currentSong = computed(() => playMusic.value);
    const isPlaying = computed(() => isPlay.value);

    // ==================== Actions ====================

    /**
     */
    const setIsPlay = (value: boolean) => {
      isPlay.value = value;
      play.value = value;
      window.electron?.ipcRenderer.send('update-play-state', value);
    };

    /**
     */
    const setMusicFull = (value: boolean) => {
      musicFull.value = value;
    };

    /**
     */
    const setPlaybackRate = (rate: number) => {
      if (!Number.isFinite(rate) || rate <= 0) return;
      playbackRate.value = rate;
      audioService.setPlaybackRate(rate);
    };

    /**
     */
    const setVolume = (newVolume: number) => {
      if (!Number.isFinite(newVolume)) return;
      const normalizedVolume = Math.max(0, Math.min(1, newVolume));
      volume.value = normalizedVolume;
      if (isMuted.value && normalizedVolume > 0) {
        isMuted.value = false;
      }
      audioService.setVolume(isMuted.value ? 0 : normalizedVolume);
    };

    /**
     */
    const setMuted = (value: boolean) => {
      if (isMuted.value === value) return;
      isMuted.value = value;
      audioService.setVolume(isMuted.value ? 0 : volume.value);
    };

    /**
     */
    const toggleMute = () => {
      setMuted(!isMuted.value);
    };

    /**
     */
    const getVolume = () => volume.value;

    /**
     */
    const increaseVolume = (step: number = 0.1) => {
      const newVolume = Math.min(1, volume.value + step);
      setVolume(newVolume);
      return newVolume;
    };

    /**
     */
    const decreaseVolume = (step: number = 0.1) => {
      const newVolume = Math.max(0, volume.value - step);
      setVolume(newVolume);
      return newVolume;
    };

    /**
     */
    const handlePause = (): void => {
      playbackRequestManager.cancelCurrentRequest();
      userPlayIntent.value = false;
      setIsPlay(false);
      playMusic.value.playLoading = false;
      // A pause must stop every surface: the audio element AND any video
      // element that is playing (fullscreen linked video, MV drawer). Pausing
      // only the audio left the video running ("video keeps playing").
      try {
        mediaCoordinator.pauseAllLocal('audioService');
      } catch {
        // Coordinator not ready in headless tests
      }
      try {
        const currentSound = audioService.getCurrentSound();
        if (currentSound && audioService.getCurrentTrack()?.id === playMusic.value.id) {
          savePlaybackProgress(playMusic.value.id, currentSound.currentTime);
          const songKey = getSongKey(playMusic.value);
          if (songKey) {
            void savePosition(songKey, currentSound.currentTime);
          }
        }
        audioService.pause();
      } catch (error) {
        console.error('Failed to pause playback:', error);
      }
    };

    /**
     */
    const setPlayMusic = async (value: boolean | SongResult): Promise<boolean> => {
      if (value === false) {
        handlePause();
        return true;
      }
      playbackRequestManager.cancelCurrentRequest();
      const generation = playbackRequestManager.getGeneration();
      const { playTrack, resumeCurrentSong } = await import('@/services/playbackController');
      if (generation !== playbackRequestManager.getGeneration()) return false;
      return value === true ? resumeCurrentSong() : playTrack(value);
    };

    /**
     */
    const refreshAudioDevices = async () => {
      availableAudioDevices.value = await audioService.getAudioOutputDevices();
    };

    /**
     */
    const setAudioOutputDevice = async (deviceId: string): Promise<boolean> => {
      const success = await audioService.setAudioOutputDevice(deviceId);
      if (success) {
        audioOutputDeviceId.value = deviceId;
      }
      return success;
    };

    /**
     */
    const initAudioDeviceListener = () => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.addEventListener('devicechange', async () => {
          await refreshAudioDevices();
          const exists = availableAudioDevices.value.some(
            (d) => d.deviceId === audioOutputDeviceId.value
          );
          if (!exists && audioOutputDeviceId.value !== 'default') {
            await setAudioOutputDevice('default');
          }
        });
      }
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
      audioOutputDeviceId,
      availableAudioDevices,

      // Computed
      currentSong,
      isPlaying,

      // Actions
      setIsPlay,
      setMusicFull,
      setPlayMusic,
      setPlaybackRate,
      setVolume,
      getVolume,
      increaseVolume,
      decreaseVolume,
      setMuted,
      toggleMute,
      handlePause,
      setPlaybackMode,
      resetMediaStateForNewSong,
      setShowWaveformSeekbar,
      setShowVideoModeToggle,
      setShowAbLoopOnBar,
      setShowStatsOnBar,
      setShowDiagnosticsOnBar,
      setEnableDynamicPalette,
      refreshAudioDevices,
      setAudioOutputDevice,
      initAudioDeviceListener
    };
  },
  {
    persist: {
      key: 'player-core-store',
      storage: debouncedLocalStorage,
      pick: [
        'playMusic',
        'playMusicUrl',
        'playbackRate',
        'volume',
        'isMuted',
        'isPlay',
        'audioOutputDeviceId'
      ],
      serializer: {
        serialize: (state: any) =>
          JSON.stringify({
            ...state,
            playMusic: state.playMusic?.id ? minifySong(state.playMusic as SongResult) : {}
          }),
        deserialize: JSON.parse
      }
    }
  }
);
