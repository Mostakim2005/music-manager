<template>
  <div class="mobile-search-page">
    <!-- Header -->
    <div class="search-header" :class="{ 'safe-area-top': hasSafeArea }">
      <div class="header-back" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </div>
      <div class="search-input-wrapper">
        <i class="ri-search-line search-icon"></i>
        <input
          ref="searchInputRef"
          v-model="searchValue"
          type="text"
          class="search-input"
          :placeholder="t('comp.searchBar.searchPlaceholder')"
          @keydown.enter="handleSearch"
        />
        <i v-if="searchValue" class="ri-close-circle-fill clear-icon" @click="clearSearch"></i>
      </div>
      <div class="search-button" @click="handleSearch">
        {{ t('common.search') }}
      </div>
    </div>

    <!-- Search Type Tags -->
    <div class="search-types">
      <div
        v-for="type in searchTypes"
        :key="type.key"
        class="type-tag"
        :class="{ active: searchType === type.key }"
        @click="selectType(type.key)"
      >
        {{ type.label }}
      </div>
    </div>

    <!-- Content -->
    <div class="search-content">
      <!-- Search History -->
      <div v-if="searchHistory.length > 0" class="search-section">
        <div class="section-header">
          <span class="section-title">Recent Searches</span>
          <span class="clear-history" @click="clearHistory">{{ t('common.clear') }}</span>
        </div>
        <div class="history-tags">
          <div
            v-for="(item, index) in searchHistory"
            :key="index"
            class="history-tag"
            @click="selectHistoryItem(item)"
          >
            {{ item }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { SEARCH_TYPES } from '@/const/bar-const';
import { useSearchStore } from '@/store/modules/search';

const { t, locale } = useI18n();
const router = useRouter();
const searchStore = useSearchStore();

const hasSafeArea = inject('hasSafeArea', false);

const searchValue = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

const searchType = ref(searchStore.searchType || 1);
const searchTypes = computed(() => {
  locale.value;
  return SEARCH_TYPES.map((type) => ({
    label: t(type.label),
    key: type.key
  }));
});

const HISTORY_KEY = 'mobile_search_history';
const searchHistory = ref<string[]>([]);

const loadSearchHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    searchHistory.value = history ? JSON.parse(history) : [];
  } catch {
    searchHistory.value = [];
  }
};

const saveSearchHistory = (keyword: string) => {
  if (!keyword.trim()) return;
  const history = searchHistory.value.filter((item) => item !== keyword);
  history.unshift(keyword);
  if (history.length > 20) {
    history.pop();
  }
  searchHistory.value = history;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

const clearHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
};

const clearSearch = () => {
  searchValue.value = '';
};

const selectType = (key: number) => {
  searchType.value = key;
  searchStore.searchType = key;
};

const selectHistoryItem = (word: string) => {
  searchValue.value = word;
  handleSearch();
};

const handleSearch = () => {
  const kw = searchValue.value.trim();
  if (!kw) return;
  saveSearchHistory(kw);
  searchStore.setSearchValue(kw);
  searchStore.searchType = searchType.value;
  router.push({
    path: '/mobile-search-result',
    query: {
      keyword: kw,
      type: searchType.value
    }
  });
};

const goBack = () => {
  router.back();
};

onMounted(() => {
  loadSearchHistory();
  nextTick(() => {
    searchInputRef.value?.focus();
  });
});
</script>

<style scoped lang="scss">
.mobile-search-page {
  @apply min-h-screen bg-light dark:bg-black;
}

.search-header {
  @apply flex items-center gap-3 px-4 py-3 bg-light dark:bg-black sticky top-0 z-10;
  @apply border-b border-gray-100 dark:border-gray-800;

  &.safe-area-top {
    padding-top: calc(var(--safe-area-inset-top, 0px) + 12px);
  }
}

.header-back {
  @apply text-2xl text-gray-700 dark:text-gray-300 cursor-pointer;
  @apply w-8 h-8 flex items-center justify-center;
}

.search-input-wrapper {
  @apply flex-1 flex items-center gap-2 px-3 py-2 rounded-full;
  @apply bg-gray-100 dark:bg-neutral-800;
}

.search-icon {
  @apply text-gray-400 text-lg;
}

.search-input {
  @apply flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none;

  &::placeholder {
    @apply text-gray-400;
  }
}

.clear-icon {
  @apply text-gray-400 text-base cursor-pointer;
}

.search-button {
  @apply text-sm text-primary font-medium cursor-pointer whitespace-nowrap;
}

.search-types {
  @apply flex items-center gap-2 px-4 py-2.5 overflow-x-auto;
  @apply border-b border-gray-100 dark:border-gray-800;

  &::-webkit-scrollbar {
    display: none;
  }
}

.type-tag {
  @apply px-3 py-1 rounded-full text-xs text-gray-600 dark:text-gray-400;
  @apply bg-gray-100 dark:bg-neutral-800 whitespace-nowrap cursor-pointer transition-colors;

  &.active {
    @apply bg-primary text-white;
  }
}

.search-content {
  @apply p-4;
}

.search-section {
  @apply mb-6;
}

.section-header {
  @apply flex items-center justify-between mb-3;
}

.section-title {
  @apply text-sm font-semibold text-gray-900 dark:text-white mb-3 block;
}

.clear-history {
  @apply text-xs text-gray-400 cursor-pointer hover:text-red-500;
}

.history-tags {
  @apply flex flex-wrap gap-2;
}

.history-tag {
  @apply px-3 py-1.5 rounded-full text-xs text-gray-700 dark:text-gray-300;
  @apply bg-gray-100 dark:bg-neutral-800 cursor-pointer;
  @apply active:opacity-70;
}
</style>
