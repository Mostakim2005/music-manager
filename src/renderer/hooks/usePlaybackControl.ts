import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { activeMediaElement, mediaCoordinator } from '@/services/mediaCoordinator';
import { usePlayerStore } from '@/store/modules/player';

/**
 */
export function usePlaybackControl() {
  const playerStore = usePlayerStore();

  const isPlaying = computed(() => playerStore.isPlay);

  const playMusicEvent = async () => {
    try {
      // The button controls whichever surface is actually audible: an active
      // MV/video surface first, otherwise the song audio (which the linked
      // muted video follows). This keeps one button and one play state.
      if (mediaCoordinator.toggleActiveNonAudioPlayback()) {
        const el = activeMediaElement.value;
        playerStore.setIsPlay(Boolean(el && !el.paused));
        return;
      }
      await playerStore.setPlay({ ...playMusic.value });
    } catch (error) {
      console.error('Playback error:', error);
      playerStore.nextPlay();
    }
  };

  const handleNext = () => {
    playerStore.nextPlay();
  };

  const handlePrev = () => {
    playerStore.prevPlay();
  };

  return {
    isPlaying,
    playMusicEvent,
    handleNext,
    handlePrev
  };
}
