<template>
  <div :id="id" :ref="setRef" class="mb-7 scroll-mt-20">
    <div class="namida-settings-card overflow-hidden">
      <div v-if="title || $slots.title" class="namida-settings-card-header namida-display-lg">
        <slot name="title">{{ title }}</slot>
      </div>
      <div class="namida-settings-card-body">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance } from 'vue';

defineOptions({
  name: 'SettingSection'
});

interface Props {
  id?: string;
  title?: string;
}

withDefaults(defineProps<Props>(), {
  id: '',
  title: ''
});

const emit = defineEmits<{
  ref: [el: Element | null];
}>();

const setRef = (el: Element | ComponentPublicInstance | null) => {
  emit('ref', el as Element | null);
};
</script>

<style scoped>
.namida-settings-card {
  border-radius: var(--namida-radius-settings, 20px);
  background: color-mix(in srgb, var(--namida-surface-card) 60%, transparent);
  border: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: var(--namida-theme-transition);
}

:root.dark .namida-settings-card {
  border-color: rgba(255, 255, 255, 0.07);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.24);
}

.namida-settings-card-header {
  padding: 12px 16px;
  background: color-mix(in srgb, var(--namida-surface-elevated) 55%, transparent);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

:root.dark .namida-settings-card-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
</style>
