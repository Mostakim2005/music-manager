import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore } from '@/store/modules/player';

/**
 */
export function usePlayMode() {
  const { t } = useI18n();
  const playerStore = usePlayerStore();

  const playMode = computed(() => playerStore.playMode);

  const playModeIcon = computed(() => {
    switch (playMode.value) {
      case 0:
        return 'ri-repeat-2-line';
      case 1:
        return 'ri-repeat-one-line';
      case 2:
        return 'ri-shuffle-line';
      default:
        return 'ri-repeat-2-line';
    }
  });

  const playModeText = computed(() => {
    switch (playMode.value) {
      case 0:
        return t('player.playBar.playMode.sequence');
      case 1:
        return t('player.playBar.playMode.loop');
      case 2:
        return t('player.playBar.playMode.random');
      default:
        return t('player.playBar.playMode.sequence');
    }
  });

  const togglePlayMode = () => {
    playerStore.togglePlayMode();
  };

  return {
    playMode,
    playModeIcon,
    playModeText,
    togglePlayMode
  };
}
