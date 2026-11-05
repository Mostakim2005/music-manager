<template>
  <div :id="id" :ref="setRef" class="mb-8 scroll-mt-20">
    <div class="text-xl font-bold mb-4 text-gray-900 dark:text-white px-1">
      <slot name="title">{{ title }}</slot>
    </div>

    <div
      class="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm"
    >
      <slot></slot>
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
