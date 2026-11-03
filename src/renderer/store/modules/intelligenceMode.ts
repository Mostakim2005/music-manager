import { createDiscreteApi } from 'naive-ui';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import { getLocalStorageItem, setLocalStorageItem } from '@/utils/playerUtils';

const { message } = createDiscreteApi(['message']);

/**
 * 心动模式管理 Store
 * 负责：心动模式的播放和状态管理
 */
export const useIntelligenceModeStore = defineStore('intelligenceMode', () => {
  // ==================== 状态 ====================
  const isIntelligenceMode = ref(getLocalStorageItem('isIntelligenceMode', false));
  const intelligenceModeInfo = ref<{
    playlistId: number;
    seedSongId: number;
  } | null>(getLocalStorageItem('intelligenceModeInfo', null));

  // ==================== Actions ====================

  /**
   * 播放心动模式
   */
  const playIntelligenceMode = async () => {
    message.info('Heartbeat mode is not available without cloud service.');
  };

  /**
   * 清除心动模式状态
   * @param skipPlayModeChange 是否跳过播放模式切换
   */
  const clearIntelligenceMode = (skipPlayModeChange: boolean = false) => {
    console.log(
      '[IntelligenceMode] clearIntelligenceMode 被调用，skipPlayModeChange:',
      skipPlayModeChange
    );

    isIntelligenceMode.value = false;
    intelligenceModeInfo.value = null;
    setLocalStorageItem('isIntelligenceMode', false);
    localStorage.removeItem('intelligenceModeInfo');

    console.log(
      '[IntelligenceMode] 心动模式状态已清除，isIntelligenceMode:',
      isIntelligenceMode.value
    );

    // 自动切换播放模式为顺序播放 (playMode = 0)
    if (!skipPlayModeChange) {
      (async () => {
        const { usePlaylistStore } = await import('./playlist');
        const playlistStore = usePlaylistStore();

        if (playlistStore.playMode === 3) {
          console.log('[IntelligenceMode] 退出心动模式，自动切换播放模式为顺序播放');
          playlistStore.playMode = 0;
        }
      })();
    }
  };

  return {
    // 状态
    isIntelligenceMode,
    intelligenceModeInfo,

    // Actions
    playIntelligenceMode,
    clearIntelligenceMode
  };
});
