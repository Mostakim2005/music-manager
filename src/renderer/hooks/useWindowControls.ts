import { type Ref, ref } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

type CloseAction = 'minimize' | 'close';

type WindowControls = {
  showCloseModal: Ref<boolean>;
  rememberChoice: Ref<boolean>;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  toggleFullScreen: () => void;
  miniWindow: () => void;
  requestClose: () => void;
  confirmCloseAction: (action: CloseAction) => void;
};

/**
 */
export const useWindowControls = (): WindowControls => {
  const settingsStore = useSettingsStore();
  const showCloseModal = ref(false);
  const rememberChoice = ref(false);

  const minimizeWindow = () => {
    if (!isElectron) return;
    window.api.minimize();
  };

  const toggleMaximizeWindow = () => {
    if (!isElectron) return;
    window.api.maximize();
  };

  const toggleFullScreen = () => {
    if (!isElectron) return;
    window.api.toggleFullScreen();
  };

  const miniWindow = () => {
    if (!isElectron) return;
    window.api.miniWindow();
  };

  /**
   */
  const requestClose = () => {
    if (!isElectron) return;

    const { closeAction } = settingsStore.setData;
    if (closeAction === 'minimize') {
      window.api.miniTray();
      return;
    }
    if (closeAction === 'close') {
      window.api.close();
      return;
    }
    showCloseModal.value = true;
  };

  const confirmCloseAction = (action: CloseAction) => {
    if (rememberChoice.value) {
      settingsStore.setSetData({
        ...settingsStore.setData,
        closeAction: action
      });
    }

    showCloseModal.value = false;
    if (action === 'minimize') {
      setTimeout(() => {
        window.api.miniTray();
      }, 200);
    } else {
      window.api.quitApp();
    }
  };

  return {
    showCloseModal,
    rememberChoice,
    minimizeWindow,
    toggleMaximizeWindow,
    toggleFullScreen,
    miniWindow,
    requestClose,
    confirmCloseAction
  };
};
