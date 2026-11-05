<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerCoreStore } from '@/store/modules/playerCore';

const { t } = useI18n();
const playerStore = usePlayerCoreStore();

const isLoading = ref(false);
const isTesting = ref(false);

const handleRefresh = async () => {
  isLoading.value = true;
  await playerStore.refreshAudioDevices();
  isLoading.value = false;
};

const handleDeviceChange = async (deviceId: string) => {
  isLoading.value = true;
  await playerStore.setAudioOutputDevice(deviceId);
  isLoading.value = false;
};

const handleTest = async () => {
  isTesting.value = true;

  try {
    const audioContext = new AudioContext();

    const deviceId = playerStore.audioOutputDeviceId;
    if (deviceId && deviceId !== 'default' && (audioContext as any).setSinkId) {
      await (audioContext as any).setSinkId(deviceId);
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.3;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
      isTesting.value = false;
    }, 500);
  } catch (error) {
    console.error('Audio test failed:', error);
    isTesting.value = false;
  }
};

onMounted(() => {
  handleRefresh();
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('settings.playback.audioDevice') }}
      </span>
      <div class="flex items-center gap-2">
        <n-button size="tiny" :loading="isLoading" quaternary @click="handleRefresh">
          <template #icon>
            <i class="ri-refresh-line"></i>
          </template>
        </n-button>
        <n-button size="tiny" :loading="isTesting" quaternary @click="handleTest">
          <template #icon>
            <i class="ri-volume-up-line"></i>
          </template>
          {{ t('settings.playback.testAudio') }}
        </n-button>
      </div>
    </div>

    <n-select
      :value="playerStore.audioOutputDeviceId"
      :options="
        playerStore.availableAudioDevices.map((d) => ({
          label: d.label,
          value: d.deviceId
        }))
      "
      :loading="isLoading"
      :placeholder="t('settings.playback.selectAudioDevice')"
      @update:value="handleDeviceChange"
    />
  </div>
</template>
