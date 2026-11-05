<template>
  <div class="app-container h-full w-full" :class="{ mobile: isMobile, noElectron: !isElectron }">
    <n-config-provider :theme="theme === 'dark' ? darkTheme : lightTheme">
      <n-dialog-provider>
        <n-message-provider>
          <router-view></router-view>
          <traffic-warning-drawer v-if="!isElectron"></traffic-warning-drawer>
          <disclaimer-modal></disclaimer-modal>
        </n-message-provider>
      </n-dialog-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash';
import { darkTheme, lightTheme } from 'naive-ui';
import { computed, nextTick, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import DisclaimerModal from '@/components/common/DisclaimerModal.vue';
import TrafficWarningDrawer from '@/components/TrafficWarningDrawer.vue';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import { isElectron, isLyricWindow } from '@/utils';
import { checkLoginStatus } from '@/utils/auth';

import { initAudioListeners, initMusicHook } from './hooks/MusicHook';
import { audioService } from './services/audioService';
import { isMobile } from './utils';
import { useAppShortcuts } from './utils/appShortcuts';

const { locale } = useI18n();
const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();
const playerCoreStore = usePlayerCoreStore();
const userStore = useUserStore();
const router = useRouter();

watch(
  () => settingsStore.setData.language,
  (newLanguage) => {
    if (newLanguage && newLanguage !== locale.value) {
      locale.value = newLanguage;
    }
  },
  { immediate: true }
);

const theme = computed(() => {
  return settingsStore.theme;
});

watch(
  () => [settingsStore.setData.fontFamily, settingsStore.setData.fontScope],
  ([newFont, fontScope]) => {
    const appElement = document.body;
    if (newFont && fontScope === 'global') {
      appElement.style.fontFamily = newFont;
    } else {
      appElement.style.fontFamily = '';
    }
  }
);

const handleSetLanguage = (value: string) => {
  console.log('Applied language change:', value);
  if (value) {
    locale.value = value;
  }
};

if (!isLyricWindow.value) {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
  settingsStore.initializeSystemFonts();

  const loginInfo = checkLoginStatus();
  if (loginInfo.isLoggedIn) {
    if (loginInfo.user && !userStore.user) {
      userStore.setUser(loginInfo.user);
    }
    if (loginInfo.loginType && !userStore.loginType) {
      userStore.setLoginType(loginInfo.loginType);
    }
  }
}

handleSetLanguage(settingsStore.setData.language);

if (isElectron) {
  window.api.onLanguageChanged(handleSetLanguage);
  window.electron.ipcRenderer.on('mini-mode', (_, value) => {
    settingsStore.setMiniMode(value);
    playerStore.setMusicFull(false);
    if (value) {
      localStorage.setItem('currentRoute', router.currentRoute.value.path);
      router.push('/mini');
    } else {
      document.body.style.height = '';
      document.body.style.overflow = '';
      const currentRoute = localStorage.getItem('currentRoute');
      if (currentRoute) {
        router.push(currentRoute);
        localStorage.removeItem('currentRoute');
      } else {
        router.push('/');
      }
    }
  });
}

useAppShortcuts();

onMounted(async () => {
  playerStore.setIsPlay(false);
  if (isLyricWindow.value) {
    return;
  }

  if (!navigator.onLine) {
    router.push('/local-music');
  }

  const handleOffline = () => {
    router.push('/local-music');
  };
  window.addEventListener('offline', handleOffline);
  onUnmounted(() => {
    window.removeEventListener('offline', handleOffline);
  });

  initMusicHook(playerStore);
  const { setupUrlExpiredHandler } = await import('@/services/playbackController');
  setupUrlExpiredHandler();
  await playerStore.initializePlayState();

  playerCoreStore.initAudioDeviceListener();

  try {
    const { migrateLegacyMusicSources } = await import('@/services/musicSource/migration');
    migrateLegacyMusicSources();
  } catch (error) {
    console.error('[App] Source migration failed:', error);
  }

  if (playerStore.playMusic && playerStore.playMusic.id) {
    await nextTick();
    initAudioListeners();
    if (isElectron) {
      window.api.sendSong(cloneDeep(playerStore.playMusic));
    }
  }

  audioService.releaseOperationLock();

  if (isElectron) {
    const { useLocalMusicStore } = await import('@/store/modules/localMusic');
    const localMusicStore = useLocalMusicStore();
    await localMusicStore.loadFromCache();
    localMusicStore.scanFolders().catch((error) => {
      console.error('[App] Auto scan of local music on startup failed:', error);
    });
  }
});
</script>

<style lang="scss" scoped>
.app-container {
  user-select: none;
}

.mobile {
  .text-base {
    font-size: 14px !important;
  }
}

.html:has(.mobile) {
  font-size: 14px;
}
</style>
