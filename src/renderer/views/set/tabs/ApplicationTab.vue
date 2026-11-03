<template>
  <setting-section v-if="isElectron" :title="t('settings.sections.application')">
    <setting-item
      :title="t('settings.application.closeAction')"
      :description="t('settings.application.closeActionDesc')"
    >
      <s-select
        v-model="setData.closeAction"
        :options="closeActionOptions"
        width="w-40 max-md:w-full"
      />
    </setting-item>

    <setting-item
      :title="t('settings.application.shortcut')"
      :description="t('settings.application.shortcutDesc')"
    >
      <s-btn @click="showShortcutModal = true">{{ t('common.configure') }}</s-btn>
    </setting-item>

    <setting-item v-if="isElectron" :title="t('settings.application.download')">
      <template #description>
        <n-switch v-model:value="setData.alwaysShowDownloadButton" class="mr-2">
          <template #checked>{{ t('common.show') }}</template>
          <template #unchecked>{{ t('common.hide') }}</template>
        </n-switch>
        {{ t('settings.application.downloadDesc') }}
      </template>
      <s-btn @click="router.push('/downloads')">
        {{ t('settings.application.download') }}
      </s-btn>
    </setting-item>

    <setting-item :title="t('settings.application.unlimitedDownload')">
      <template #description>
        <n-switch v-model:value="setData.unlimitedDownload" class="mr-2">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
        {{ t('settings.application.unlimitedDownloadDesc') }}
      </template>
    </setting-item>

    <setting-item :title="t('settings.application.downloadPath')">
      <template #description>
        <span class="break-all">{{
          setData.downloadPath || t('settings.application.downloadPathDesc')
        }}</span>
      </template>
      <template #action>
        <div class="flex items-center gap-2">
          <s-btn @click="openDownloadPath">{{ t('common.open') }}</s-btn>
          <s-btn @click="selectDownloadPath">{{ t('common.modify') }}</s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      :title="t('settings.application.remoteControl')"
      :description="t('settings.application.remoteControlDesc')"
    >
      <s-btn @click="showRemoteControlModal = true">{{ t('common.configure') }}</s-btn>
    </setting-item>

    <setting-item
      v-if="isElectron"
      title="Discord 状态共享 (Discord Rich Presence)"
      description="在 Discord 个人资料状态中实时显示正在播放的歌曲、歌手及播放进度"
    >
      <n-switch
        v-model:value="setData.enableDiscordRpc"
        @update:value="handleDiscordRpcChange"
      >
        <template #checked>{{ t('common.on') }}</template>
        <template #unchecked>{{ t('common.off') }}</template>
      </n-switch>
    </setting-item>

    <shortcut-settings v-model:show="showShortcutModal" @change="handleShortcutsChange" />
    <remote-control-setting v-model:visible="showRemoteControlModal" />
  </setting-section>

  <!-- Downloads & Engine Section -->
  <setting-section v-if="isElectron" title="Downloads">
    <setting-item
      title="Media Download Folder"
      description="Choose where YouTube downloads and media qualities are saved."
    >
      <template #description>
        <div class="space-y-1 mt-1">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            In Auto mode, linked videos are saved beside the local audio file; online-only tracks go to &lt;Music&gt;/Music Manager.
          </p>
          <p class="text-xs font-mono text-primary break-all">
            Resolved: {{ resolvedMediaDir || 'Resolving...' }}
          </p>
        </div>
      </template>
      <template #action>
        <div class="flex items-center gap-2">
          <span
            v-if="isMediaDirAuto"
            class="text-xs px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-lg"
          >
            Auto
          </span>
          <span
            v-else
            class="text-xs px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg max-w-[180px] truncate"
            :title="setData.mediaDownloadDir"
          >
            {{ setData.mediaDownloadDir }}
          </span>
          <s-btn @click="browseMediaDownloadDir">Browse…</s-btn>
          <s-btn v-if="!isMediaDirAuto" @click="resetMediaDownloadDir">Reset to Auto</s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      title="YouTube Engine"
      description="yt-dlp and ffmpeg background engine for media extraction, progressive streaming, and downloads."
    >
      <template #description>
        <div class="flex items-center gap-4 mt-1 text-xs">
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-full"
              :class="binaryStatus?.ytDlp?.installed ? 'bg-emerald-500' : 'bg-rose-500'"
            />
            <span>yt-dlp: {{ binaryStatus?.ytDlp?.version || (binaryStatus?.ytDlp?.installed ? 'Installed' : 'Missing') }}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-full"
              :class="binaryStatus?.ffmpeg?.installed ? 'bg-emerald-500' : 'bg-rose-500'"
            />
            <span>ffmpeg: {{ binaryStatus?.ffmpeg?.version || (binaryStatus?.ffmpeg?.installed ? 'Installed' : 'Missing') }}</span>
          </span>
        </div>
      </template>
      <template #action>
        <s-btn :loading="isUpdatingYtDlp" @click="updateYtDlp">Update yt-dlp</s-btn>
      </template>
    </setting-item>
  </setting-section>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import RemoteControlSetting from '@/components/settings/ServerSetting.vue';
import ShortcutSettings from '@/components/settings/ShortcutSettings.vue';
import youtubeService, { type YtBinaryStatus } from '@/services/youtubeService';
import { isElectron } from '@/utils';
import { openDirectory, selectDirectory } from '@/utils/fileOperation';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const { t } = useI18n();
const router = useRouter();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const showShortcutModal = ref(false);
const showRemoteControlModal = ref(false);

const closeActionOptions = computed(() => [
  { label: t('settings.application.closeOptions.ask'), value: 'ask' },
  { label: t('settings.application.closeOptions.minimize'), value: 'minimize' },
  { label: t('settings.application.closeOptions.close'), value: 'close' }
]);

const selectDownloadPath = async () => {
  const path = await selectDirectory(message);
  if (path) {
    setData.value = { ...setData.value, downloadPath: path };
  }
};

const openDownloadPath = () => {
  openDirectory(setData.value.downloadPath, message);
};

const handleShortcutsChange = (shortcuts: any) => {
  console.log('快捷键已更新:', shortcuts);
};

const handleDiscordRpcChange = (enabled: boolean) => {
  if (window.electron?.ipcRenderer) {
    window.electron.ipcRenderer.send('update-discord-rpc-enabled', enabled);
  }
};

// ==================== Downloads & YouTube Engine ====================
const resolvedMediaDir = ref('');
const binaryStatus = ref<YtBinaryStatus | null>(null);
const isUpdatingYtDlp = ref(false);

const isMediaDirAuto = computed(() => {
  const dir = setData.value?.mediaDownloadDir;
  return !dir || dir.trim() === '' || dir.trim().toLowerCase() === 'auto';
});

const loadMediaDownloadDir = async () => {
  try {
    resolvedMediaDir.value = await youtubeService.resolveDownloadDir();
  } catch {
    resolvedMediaDir.value = '';
  }
};

const loadBinaryStatus = async () => {
  try {
    binaryStatus.value = await youtubeService.getBinaryStatus();
  } catch (err) {
    console.warn('Failed to get binary status:', err);
  }
};

const browseMediaDownloadDir = async () => {
  const dir = await selectDirectory(message);
  if (dir) {
    setData.value = { ...setData.value, mediaDownloadDir: dir };
    await loadMediaDownloadDir();
  }
};

const resetMediaDownloadDir = async () => {
  setData.value = { ...setData.value, mediaDownloadDir: 'auto' };
  message.success('Reset download folder to Auto');
  await loadMediaDownloadDir();
};

const updateYtDlp = async () => {
  isUpdatingYtDlp.value = true;
  message.loading('Checking for yt-dlp updates...', { duration: 3000 });
  try {
    const res = await youtubeService.updateBinary();
    if (res.success) {
      message.success(`yt-dlp updated: ${res.version || 'Latest version'}`);
    } else {
      message.info(res.output || 'yt-dlp is already up to date');
    }
    await loadBinaryStatus();
  } catch (err: any) {
    message.error(`Update failed: ${err.message || String(err)}`);
  } finally {
    isUpdatingYtDlp.value = false;
  }
};

onMounted(() => {
  if (isElectron) {
    loadMediaDownloadDir();
    loadBinaryStatus();
  }
});
</script>
