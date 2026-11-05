<template>
  <Teleport to="body">
    <Transition name="update-modal">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[999999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      >
        <div
          class="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl overflow-hidden animate-slide-up"
        >
          <div class="h-1 bg-gradient-to-r from-green-400 via-green-500 to-emerald-600"></div>

          <div class="flex justify-center pt-3 pb-2">
            <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></div>
          </div>

          <div class="px-6 pb-5">
            <div class="flex items-center gap-4">
              <div
                class="w-20 h-20 rounded-2xl overflow-hidden shadow-lg flex-shrink-0 ring-2 ring-green-500/20"
              >
                <img src="@/assets/logo.png" alt="App Icon" class="w-full h-full object-cover" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <span
                    class="px-3 py-1 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                  >
                    {{ t('comp.update.title') }}
                  </span>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
                  v{{ updateInfo.latestVersion }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ t('comp.update.currentVersion') }}: v{{ updateInfo.currentVersion }}
                </p>
              </div>
            </div>
          </div>

          <div
            class="mx-6 mb-6 max-h-80 overflow-y-auto rounded-2xl bg-gray-50 dark:bg-gray-800/50"
          >
            <div
              class="p-5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
              v-html="parsedReleaseNotes"
            ></div>
          </div>

          <div
            class="px-6 pb-8 flex gap-3"
            :style="{ paddingBottom: `calc(32px + var(--safe-area-inset-bottom, 0px))` }"
          >
            <button
              @click="handleLater"
              class="flex-1 py-4 px-4 rounded-2xl text-base font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all duration-200"
            >
              {{ t('comp.update.noThanks') }}
            </button>
            <button
              @click="handleUpdate"
              class="flex-1 py-4 px-4 rounded-2xl text-base font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-green-500/25"
            >
              <span class="flex items-center justify-center gap-2">
                <i class="ri-download-2-line text-lg"></i>
                {{ t('comp.update.nowUpdate') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { marked } from 'marked';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { checkUpdate, getProxyNodes, UpdateResult } from '@/utils/update';

import config from '../../../../package.json';

const { t } = useI18n();

const REMIND_LATER_KEY = 'update_remind_later_timestamp';

marked.setOptions({
  breaks: true,
  gfm: true
});

const showModal = ref(false);

const updateInfo = ref<UpdateResult>({
  hasUpdate: false,
  latestVersion: '',
  currentVersion: config.version,
  releaseInfo: null
});

const parsedReleaseNotes = computed(() => {
  if (!updateInfo.value.releaseInfo?.body) return '';
  try {
    return marked.parse(updateInfo.value.releaseInfo.body);
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return updateInfo.value.releaseInfo.body;
  }
});

const shouldShowReminder = (): boolean => {
  const remindLaterTime = localStorage.getItem(REMIND_LATER_KEY);
  if (!remindLaterTime) return true;

  const savedTime = parseInt(remindLaterTime, 10);
  const now = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000;

  return now - savedTime >= oneDayInMs;
};

const handleLater = () => {
  localStorage.setItem(REMIND_LATER_KEY, Date.now().toString());
  showModal.value = false;
};

const closeModal = () => {
  showModal.value = false;
};

const checkForUpdates = async () => {
  if (!shouldShowReminder()) {
    console.log('Update reminder postponed for 24 hours');
    return;
  }

  try {
    const result = await checkUpdate(config.version);
    if (result && result.hasUpdate) {
      updateInfo.value = result;
      showModal.value = true;
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
};

const handleUpdate = async () => {
  const version = updateInfo.value.latestVersion;

  const downloadUrl = `https://github.com/algerkong/AlgerMusicPlayer/releases/download/v${version}/AlgerMusicPlayer-${version}.apk`;

  try {
    const proxyHosts = await getProxyNodes();
    const proxyDownloadUrl = `${proxyHosts[0]}/${downloadUrl}`;

    localStorage.removeItem(REMIND_LATER_KEY);

    window.open(proxyDownloadUrl, '_blank');

    closeModal();
  } catch (error) {
    console.error('Failed to open download link:', error);
    const releaseUrl =
      updateInfo.value.releaseInfo?.html_url ||
      'https://github.com/algerkong/AlgerMusicPlayer/releases/latest';
    window.open(releaseUrl, '_blank');
    closeModal();
  }
};

onMounted(() => {
  setTimeout(() => {
    checkForUpdates();
  }, 2000);
});
</script>

<style scoped>
.update-modal-enter-active,
.update-modal-leave-active {
  transition: opacity 0.3s ease;
}

.update-modal-enter-from,
.update-modal-leave-to {
  opacity: 0;
}

.update-modal-enter-active .animate-slide-up,
.update-modal-leave-active .animate-slide-up {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.update-modal-enter-from .animate-slide-up {
  transform: translateY(100%);
}

.update-modal-leave-to .animate-slide-up {
  transform: translateY(100%);
}

:deep(h1) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

:deep(h2) {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

:deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

:deep(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}

:deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}

:deep(li) {
  margin-bottom: 0.25rem;
}

:deep(p) {
  margin-bottom: 0.5rem;
}

:deep(code) {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background-color: rgba(0, 0, 0, 0.05);
  font-size: 0.875rem;
}

:deep(a) {
  color: #22c55e;
}
</style>
