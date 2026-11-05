<script setup lang="ts">
import { getLanguageOptions } from '@i18n/utils';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/store/modules/settings';

const settingsStore = useSettingsStore();
const { locale } = useI18n();

const languages = getLanguageOptions();

console.log('locale', locale);
const currentLanguage = computed({
  get: () => locale.value,
  set: (value) => {
    settingsStore.setLanguage(value);
  }
});
</script>

<template>
  <n-select v-model:value="currentLanguage" :options="languages" size="small" />
</template>
