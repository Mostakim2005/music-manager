<template>
  <div class="search-page-container h-full w-full bg-white dark:bg-black transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="search-content w-full pb-32 pt-8 page-padding max-w-4xl mx-auto space-y-8">
        <!-- Search Header -->
        <div class="search-header">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <i class="ri-search-2-line text-xl" />
            </div>
            <h1 class="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              Search Music
            </h1>
          </div>
          <p class="text-neutral-500 dark:text-neutral-400 text-sm">
            Search across songs, artists, albums, and local tracks.
          </p>
        </div>

        <!-- Search Bar Input Box -->
        <div class="relative flex items-center">
          <input
            v-model="inputQuery"
            class="w-full h-14 pl-12 pr-28 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 text-base outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 transition-all"
            placeholder="Type song title, artist, or album..."
            autofocus
            @keydown.enter="submitSearch(inputQuery)"
          />
          <div class="absolute left-4 text-neutral-400 text-xl pointer-events-none">
            <i class="ri-search-line" />
          </div>
          <div class="absolute right-3 flex items-center gap-2">
            <button
              v-if="inputQuery"
              class="w-8 h-8 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex items-center justify-center transition-colors"
              @click="inputQuery = ''"
            >
              <i class="ri-close-line text-lg" />
            </button>
            <button
              class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-all shadow-sm"
              @click="submitSearch(inputQuery)"
            >
              Search
            </button>
          </div>
        </div>

        <!-- Search History Section -->
        <section v-if="searchHistory.length > 0" class="search-history-section pt-2">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <i class="ri-history-line text-neutral-400" />
              <span>Recent Searches</span>
            </h2>
            <button
              class="text-xs text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1"
              @click="clearSearchHistory"
            >
              <i class="ri-delete-bin-line" />
              <span>Clear all</span>
            </button>
          </div>
          <div class="flex flex-wrap gap-2.5">
            <div
              v-for="(item, index) in searchHistory"
              :key="index"
              class="group relative flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              @click="submitSearch(item.keyword, item.type)"
            >
              <span>{{ item.keyword }}</span>
              <i
                class="ri-close-line text-neutral-400 hover:text-red-500 transition-colors ml-1"
                @click.stop="removeSearchItem(item)"
              />
            </div>
          </div>
        </section>

        <!-- Search Tips -->
        <section class="tips-section pt-4 border-t border-neutral-100 dark:border-neutral-800/60">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
            Search Tips
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/40">
              <div class="text-primary font-semibold text-sm mb-1">By Title</div>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">Search for exact song or track titles.</p>
            </div>
            <div class="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/40">
              <div class="text-emerald-500 font-semibold text-sm mb-1">By Artist</div>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">Search for singer, band, or producer names.</p>
            </div>
            <div class="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/40">
              <div class="text-violet-500 font-semibold text-sm mb-1">By Album</div>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">Find full releases, EPs, or compilations.</p>
            </div>
          </div>
        </section>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NScrollbar } from 'naive-ui';

import { useSearchStore } from '@/store/modules/search';

defineOptions({
  name: 'Search'
});

const router = useRouter();
const searchStore = useSearchStore();

const inputQuery = ref('');
const searchHistory = ref<Array<{ keyword: string; type: string | number }>>([]);

const loadSearchHistory = () => {
  try {
    const history = localStorage.getItem('searchHistory');
    searchHistory.value = history ? JSON.parse(history) : [];
  } catch {
    searchHistory.value = [];
  }
};

const saveSearchHistory = (keyword: string, type: string | number) => {
  if (!keyword.trim()) return;
  const history = searchHistory.value.filter((item) => item.keyword !== keyword);
  history.unshift({ keyword, type });
  if (history.length > 20) {
    history.pop();
  }
  searchHistory.value = history;
  localStorage.setItem('searchHistory', JSON.stringify(history));
};

const clearSearchHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem('searchHistory');
};

const removeSearchItem = (item: { keyword: string; type: string | number }) => {
  searchHistory.value = searchHistory.value.filter((h) => h.keyword !== item.keyword);
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
};

const submitSearch = (keyword: string, type?: string | number) => {
  const kw = keyword.trim();
  if (!kw) return;
  const searchType = type ?? searchStore.searchType ?? 'music';
  saveSearchHistory(kw, searchType);
  searchStore.setSearchValue(kw);
  router.push({
    path: '/search-result',
    query: { keyword: kw, type: searchType }
  });
};

onMounted(() => {
  loadSearchHistory();
});
</script>

<style lang="scss" scoped>
.search-page-container {
  position: relative;
}
</style>
