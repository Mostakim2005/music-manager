import { createDiscreteApi } from 'naive-ui';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import { getLocalStorageItem, setLocalStorageItem } from '@/utils/playerUtils';

const { message } = createDiscreteApi(['message']);

/**
 */
export const useIntelligenceModeStore = defineStore('intelligenceMode', () => {
  const isIntelligenceMode = ref(getLocalStorageItem('isIntelligenceMode', false));
  const intelligenceModeInfo = ref<{
    playlistId: number;
    seedSongId: number;
  } | null>(getLocalStorageItem('intelligenceModeInfo', null));

  // ==================== Actions ====================

  /**
   */
  const playIntelligenceMode = async () => {
    message.info('Heartbeat mode is not available without cloud service.');
  };

  /**
   */
  const clearIntelligenceMode = (skipPlayModeChange: boolean = false) => {
    console.log(
      '[IntelligenceMode] clearIntelligenceMode called, skipPlayModeChange:',
      skipPlayModeChange
    );

    isIntelligenceMode.value = false;
    intelligenceModeInfo.value = null;
    setLocalStorageItem('isIntelligenceMode', false);
    localStorage.removeItem('intelligenceModeInfo');

    console.log(
      '[IntelligenceMode] Intelligence mode cleared, isIntelligenceMode: ',
      isIntelligenceMode.value
    );

    if (!skipPlayModeChange) {
      (async () => {
        const { usePlaylistStore } = await import('./playlist');
        const playlistStore = usePlaylistStore();

        if (playlistStore.playMode === 3) {
          console.log('[IntelligenceMode] Left intelligence mode, switched to sequential playback');
          playlistStore.playMode = 0;
        }
      })();
    }
  };

  return {
    isIntelligenceMode,
    intelligenceModeInfo,

    // Actions
    playIntelligenceMode,
    clearIntelligenceMode
  };
});
