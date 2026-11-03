<template>
  <div>
    <setting-section :title="t('settings.sections.playback')">
      <setting-item
        :title="t('settings.playback.quality')"
        :description="t('settings.playback.qualityDesc')"
      >
        <s-select
          v-model="setData.musicQuality"
          :options="qualityOptions"
          width="w-40 max-md:w-full"
        />
      </setting-item>

      <setting-item v-if="isElectron" :title="t('settings.playback.musicSources')">
        <template #description>
          <div class="flex items-center gap-2">
            <n-switch v-model:value="setData.enableMusicUnblock">
              <template #checked>{{ t('common.on') }}</template>
              <template #unchecked>{{ t('common.off') }}</template>
            </n-switch>
            <span>{{ t('settings.playback.musicUnblockEnableDesc') }}</span>
          </div>
          <div v-if="setData.enableMusicUnblock" class="mt-2 text-sm">
            <span class="text-gray-500">{{ t('settings.playback.selectedMusicSources') }}</span>
            <span v-if="musicSources.length > 0" class="text-gray-400">{{
              musicSources.join(', ')
            }}</span>
            <span v-else class="text-red-500 text-xs">{{
              t('settings.playback.noMusicSources')
            }}</span>
          </div>
        </template>
        <s-btn :disabled="!setData.enableMusicUnblock" @click="showMusicSourcesModal = true">
          {{ t('settings.playback.configureMusicSources') }}
        </s-btn>
      </setting-item>

      <setting-item
        v-if="platform === 'darwin'"
        :title="t('settings.playback.showStatusBar')"
        :description="t('settings.playback.showStatusBarContent')"
      >
        <n-switch v-model:value="setData.showTopAction">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        :title="t('settings.playback.autoPlay')"
        :description="t('settings.playback.autoPlayDesc')"
      >
        <n-switch v-model:value="setData.autoPlay">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item :title="t('settings.playback.singleSongPlayMode')">
        <s-select
          v-model="setData.singleSongPlayMode"
          :options="singleSongPlayModeOptions"
          width="w-64 max-md:w-full"
        />
      </setting-item>

      <setting-item
        title="底栏音视频切换胶囊 (Song | Video Switcher)"
        description="当正在播放的歌曲包含官方MV或视频源时，在底栏歌曲标题右侧显示 [Song | Video] 切换胶囊"
      >
        <n-switch v-model:value="setData.showPlayBarVideoSwitcher">
          <template #checked>{{ t('common.show') }}</template>
          <template #unchecked>{{ t('common.hide') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        title="底栏波形进度条 (Waveform Seekbar)"
        description="在底栏播放条进度滑块后方渲染动态波形能量柱可视化"
      >
        <n-switch
          v-model:value="setData.showWaveformSeekbar"
          @update:value="handleWaveformSeekbarChange"
        >
          <template #checked>{{ t('common.show') }}</template>
          <template #unchecked>{{ t('common.hide') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        title="播放/暂停平滑淡入淡出 (200ms Smooth Fade)"
        description="暂停或恢复播放时施加 200ms 线性音量渐变，消除突兀爆音"
      >
        <n-switch
          v-model:value="setData.enablePlayPauseFade"
          @update:value="handlePlayPauseFadeChange"
        >
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        title="跨曲等功率淡入淡出 (Equal-Power Crossfade)"
        description="曲目即将播放完毕时与下一首歌曲平滑过渡 (1-10秒)"
      >
        <div class="flex items-center gap-3">
          <n-switch
            v-model:value="setData.enableSmartCrossfade"
            @update:value="handleCrossfadeChange"
          >
            <template #checked>{{ t('common.on') }}</template>
            <template #unchecked>{{ t('common.off') }}</template>
          </n-switch>
          <span v-if="setData.enableSmartCrossfade" class="text-xs text-neutral-400">
            {{ setData.smartCrossfadeDuration || 3 }}s
          </span>
        </div>
      </setting-item>

      <setting-item
        title="智能静音跳过 (Skip Silence)"
        description="自动检测歌曲首尾低于 -50 dBFS 的静音空白并快速推进"
      >
        <n-switch
          v-model:value="setData.enableSkipSilence"
          @update:value="handleSkipSilenceChange"
        >
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <!-- 纯净模式常驻开关：为播放页的隐式悬停唤出提供显式退出入口（#758） -->
      <setting-item
        :title="t('settings.playback.pureMode')"
        :description="t('settings.playback.pureModeDesc')"
      >
        <n-switch v-model:value="pureModeEnabled">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="isElectron"
        :title="t('settings.playback.audioDevice')"
        :description="t('settings.playback.audioDeviceDesc')"
      >
        <audio-device-settings />
      </setting-item>
    </setting-section>

    <music-source-settings
      v-if="isElectron"
      v-model:show="showMusicSourcesModal"
      v-model:sources="musicSources"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AudioDeviceSettings from '@/components/settings/AudioDeviceSettings.vue';
import MusicSourceSettings from '@/components/settings/MusicSourceSettings.vue';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { type Platform } from '@/types/music';
import { isElectron } from '@/utils';
import { LYRIC_CONFIG_CHANGE_EVENT, readLyricConfig, writeLyricConfig } from '@/utils/lyricConfig';

import { SETTINGS_DATA_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const ALL_PLATFORMS: Platform[] = ['youtube'];

const { t } = useI18n();
const playerStore = usePlayerStore();
const setData = inject(SETTINGS_DATA_KEY)!;
const platform = window.electron ? window.electron.ipcRenderer.sendSync('get-platform') : 'web';

const showMusicSourcesModal = ref(false);

const handleWaveformSeekbarChange = (enabled: boolean) => {
  playerStore.setShowWaveformSeekbar(enabled);
};

const handlePlayPauseFadeChange = (enabled: boolean) => {
  audioService.setSmoothFadeEnabled(enabled);
};

const handleCrossfadeChange = (enabled: boolean) => {
  audioService.setSmartCrossfade(enabled, setData.value.smartCrossfadeDuration || 3);
};

const handleSkipSilenceChange = (enabled: boolean) => {
  audioService.setSkipSilence(enabled);
};

// 纯净模式开关：与播放页共享 localStorage 配置，通过自定义事件双向实时同步
const pureModeEnabled = ref(readLyricConfig().pureModeEnabled);

const handleLyricConfigChange = () => {
  pureModeEnabled.value = readLyricConfig().pureModeEnabled;
};

onMounted(() => {
  window.addEventListener(LYRIC_CONFIG_CHANGE_EVENT, handleLyricConfigChange);
});

onBeforeUnmount(() => {
  window.removeEventListener(LYRIC_CONFIG_CHANGE_EVENT, handleLyricConfigChange);
});

watch(pureModeEnabled, (value) => {
  writeLyricConfig({ ...readLyricConfig(), pureModeEnabled: value });
});

const qualityOptions = computed(() => [
  { label: t('settings.playback.qualityOptions.standard'), value: 'standard' },
  { label: t('settings.playback.qualityOptions.higher'), value: 'higher' },
  { label: t('settings.playback.qualityOptions.exhigh'), value: 'exhigh' },
  { label: t('settings.playback.qualityOptions.lossless'), value: 'lossless' },
  { label: t('settings.playback.qualityOptions.hires'), value: 'hires' },
  { label: t('settings.playback.qualityOptions.jyeffect'), value: 'jyeffect' },
  { label: t('settings.playback.qualityOptions.sky'), value: 'sky' },
  { label: t('settings.playback.qualityOptions.dolby'), value: 'dolby' },
  { label: t('settings.playback.qualityOptions.jymaster'), value: 'jymaster' }
]);

const singleSongPlayModeOptions = computed(() => [
  { label: t('settings.playback.singleSongPlayModeOptions.replace'), value: 'replace' },
  { label: t('settings.playback.singleSongPlayModeOptions.add'), value: 'add' }
]);

const musicSources = computed({
  get: () => {
    if (!setData.value?.enabledMusicSources) return ALL_PLATFORMS;
    return setData.value.enabledMusicSources as Platform[];
  },
  set: (newValue: Platform[]) => {
    const valuesToSet = newValue.length > 0 ? [...new Set(newValue)] : ALL_PLATFORMS;
    setData.value = { ...setData.value, enabledMusicSources: valuesToSet };
  }
});
</script>
