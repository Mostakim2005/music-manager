<template>
  <div class="flex items-center gap-2 pb-4 pr-4 pl-1">
    <!-- ── LEFT: Tabs ─────────────── -->
    <transition name="tab-slide">
      <div
        v-if="!isSearchExpanded && !showBackButton"
        class="tabs-track flex-shrink-0"
        ref="tabsTrackRef"
      >
        <div class="tab-slider-bg" :style="sliderStyle" />
        <button
          v-for="(tab, i) in tabs"
          :key="tab.key"
          :ref="(el) => setTabRef(el as HTMLElement, i)"
          class="tab-btn"
          :class="isTabActive(tab.path) ? 'tab-btn--on' : 'tab-btn--off'"
          @click="router.push(tab.path)"
        >
          <i :class="tab.icon" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- Back button + title -->
      <div v-else-if="showBackButton" class="flex items-center gap-2 flex-shrink-0">
        <button class="back-btn" @click="goBack">
          <i class="ri-arrow-left-line" />
        </button>
        <transition name="nav-title">
          <span v-if="navTitleStore.isVisible && !isSearchExpanded" class="nav-page-title">
            {{ navTitleStore.title }}
          </span>
        </transition>
      </div>
    </transition>

    <!-- ── SPACER ─────────────── -->
    <div v-if="!isSearchExpanded" class="flex-1" />

    <!-- Search Input -->
    <div class="search-wrap" :class="isSearchExpanded ? 'search-wrap--open' : 'search-wrap--idle'">
      <div class="search-inner" :class="{ 'search-inner--focus': inputFocused }">
        <i class="iconfont icon-search search-icon-glyph" />
        <input
          ref="inputRef"
          v-model="searchValue"
          class="search-input"
          :placeholder="t('comp.searchBar.searchPlaceholder')"
          @keydown="handleKeydown"
          @focus="handleFocus"
          @blur="handleBlur"
        />
        <n-dropdown
          v-if="searchTypeOptions.length && isSearchExpanded"
          trigger="hover"
          :options="searchTypeOptions"
          @select="selectSearchType"
          @mousedown.prevent
        >
          <div class="type-chip" @mousedown.prevent>
            <span>{{
              searchTypeOptions.find((i) => i.key === searchStore.searchType)?.label
            }}</span>
            <i class="iconfont icon-xiasanjiaoxing text-[10px]" />
          </div>
        </n-dropdown>
      </div>
    </div>

    <!-- Download button -->
    <button v-if="showDownloadButton" class="action-btn" @click="navigateToDownloads">
      <n-badge :value="downloadingCount" :max="99" :show="downloadingCount > 0" :offset="[-2, 2]">
        <i class="ri-download-cloud-2-line" />
      </n-badge>
    </button>

    <!-- App / Quick Settings Menu -->
    <n-popover trigger="hover" placement="bottom-end" :show-arrow="false" raw>
      <template #trigger>
        <button class="action-btn" :title="t('comp.settings')">
          <i class="ri-settings-3-line text-lg" />
        </button>
      </template>
      <div class="user-menu">
        <div class="menu-list">
          <div class="menu-row" @click="router.push('/set')">
            <i class="ri-settings-3-line" /><span>{{ t('comp.settings') }}</span>
          </div>
          <div v-if="isElectron" class="menu-row">
            <i class="ri-zoom-in-line" /><span>{{ t('comp.searchBar.zoom') }}</span>
            <div class="zoom-ctrl ml-auto">
              <button class="zoom-btn" @click.stop="decreaseZoom">
                <i class="ri-subtract-line" />
              </button>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <span
                    class="zoom-val"
                    :class="{ 'zoom-val--100': isZoom100() }"
                    @click.stop="resetZoom"
                  >
                    {{ Math.round(zoomFactor * 100) }}%
                  </span>
                </template>
                {{ isZoom100() ? t('comp.searchBar.zoom100') : t('comp.searchBar.resetZoom') }}
              </n-tooltip>
              <button class="zoom-btn" @click.stop="increaseZoom"><i class="ri-add-line" /></button>
            </div>
          </div>
          <div class="menu-row">
            <i :class="isDark ? 'ri-moon-line' : 'ri-sun-line'" />
            <span>{{ t('comp.searchBar.theme') }}</span>
            <n-switch v-model:value="isDark" class="ml-auto" size="small">
              <template #checked><i class="ri-moon-line text-[10px]" /></template>
              <template #unchecked><i class="ri-sun-line text-[10px]" /></template>
            </n-switch>
          </div>
          <div class="menu-row" @click="restartApp">
            <i class="ri-restart-line" /><span>{{ t('comp.searchBar.restart') }}</span>
          </div>
          <div class="menu-row" @click="reloadApp">
            <i class="ri-refresh-line" /><span>{{ t('comp.searchBar.refresh') }}</span>
          </div>
        </div>
      </div>
    </n-popover>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { SEARCH_TYPES } from '@/const/bar-const';
import { useZoom } from '@/hooks/useZoom';
import { useDownloadStore } from '@/store/modules/download';
import { useNavTitleStore } from '@/store/modules/navTitle';
import { useSearchStore } from '@/store/modules/search';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

const router = useRouter();
const route = useRoute();
const navTitleStore = useNavTitleStore();
const searchStore = useSearchStore();
const settingsStore = useSettingsStore();
const { t, locale } = useI18n();

const downloadStore = useDownloadStore();
const downloadingCount = computed(() => downloadStore.downloadingCount);
const navigateToDownloads = () => {
  router.push('/downloads');
};
const showDownloadButton = computed(
  () =>
    isElectron && (settingsStore.setData?.alwaysShowDownloadButton || downloadingCount.value > 0)
);
const { zoomFactor, increaseZoom, decreaseZoom, resetZoom, isZoom100 } = useZoom();

// ── Back button ───────────────────────────────────────
const showBackButton = computed(() => {
  const meta = router.currentRoute.value.meta;
  if (!settingsStore.isMobile && meta.isMobile === false) return false;
  return meta.back === true;
});
const goBack = () => router.back();

// ── Tabs ──────────────────────────────────────────────
const tabs = computed(() => {
  const items = [
    { key: 'home', label: t('comp.home'), path: '/', icon: 'ri-home-4-fill' },
    {
      key: 'localMusic',
      label: t('comp.localMusic'),
      path: '/local-music',
      icon: 'ri-folder-music-fill'
    },
    { key: 'history', label: t('comp.history'), path: '/history', icon: 'icon-a-TicketStar' },
    {
      key: 'favorite',
      label: t('comp.homeHero.quickNav.myFavorite'),
      path: '/favorite',
      icon: 'ri-heart-fill'
    }
  ];
  return items;
});
const isTabActive = (path: string) => route.path === path;

// Sliding pill
const tabsTrackRef = ref<HTMLElement | null>(null);
const tabElsRef = ref<HTMLElement[]>([]);
const setTabRef = (el: HTMLElement, i: number) => {
  if (el) tabElsRef.value[i] = el;
};
const activeTabIndex = computed(() => tabs.value.findIndex((t) => isTabActive(t.path)));
const sliderStyle = computed(() => {
  const el = tabElsRef.value[activeTabIndex.value];
  if (!el) return { opacity: '0' };
  return {
    transform: `translateX(${el.offsetLeft}px)`,
    width: `${el.offsetWidth}px`,
    opacity: '1'
  };
});

// ── Search expand / collapse ──────────────────────────
const isSearchExpanded = ref(false);
const inputFocused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const handleFocus = () => {
  inputFocused.value = true;
  isSearchExpanded.value = true;
};
const handleBlur = () => {
  inputFocused.value = false;
  setTimeout(() => {
    isSearchExpanded.value = false;
  }, 150);
};

// ── Search logic ──────────────────────────────────────
const searchValue = ref('');

watch(
  () => searchStore.searchValue,
  (v) => {
    if (v) searchValue.value = v;
  },
  { immediate: true }
);

const search = () => {
  const val = searchValue.value.trim();
  if (!val) return;
  const q = { keyword: val, type: searchStore.searchType };
  if (router.currentRoute.value.path === '/search-result') {
    searchStore.searchValue = val;
    router.replace({ path: '/search-result', query: q });
  } else {
    router.push({ path: '/search-result', query: q });
  }
};

const selectSearchType = (key: any) => {
  searchStore.searchType = key;
  if (searchValue.value) {
    router.push({ path: '/search-result', query: { keyword: searchValue.value, type: key } });
  }
  nextTick(() => inputRef.value?.focus());
};

const rawSearchTypes = ref(SEARCH_TYPES);
const searchTypeOptions = computed(() => {
  locale.value;
  return rawSearchTypes.value
    .filter(() => isElectron)
    .map((type) => ({ label: t(type.label), key: type.key }));
});

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    search();
  }
};

const restartApp = () => {
  if (isElectron) {
    window.electron.ipcRenderer.send('restart');
  }
};

const reloadApp = () => {
  window.location.reload();
};

const isDark = computed({
  get: () => settingsStore.theme === 'dark',
  set: () => settingsStore.toggleTheme()
});
</script>

<style scoped lang="scss">
/* Tabs */
.tabs-track {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.05);
  transition: all 0.25s ease;
}
.dark .tabs-track {
  background: rgba(255, 255, 255, 0.07);
}

.tab-slider-bg {
  position: absolute;
  top: 3px;
  left: 0;
  height: calc(100% - 6px);
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  transition:
    transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1),
    width 0.25s ease,
    opacity 0.2s ease;
  pointer-events: none;
}
.dark .tab-slider-bg {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.tab-btn {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s ease;
}
.tab-btn--on {
  color: #111827;
}
.dark .tab-btn--on {
  color: #ffffff;
}
.tab-btn--off {
  color: #6b7280;
}
.dark .tab-btn--off {
  color: #9ca3af;
}
.tab-btn--off:hover {
  color: #374151;
}
.dark .tab-btn--off:hover {
  color: #d1d5db;
}

.tab-slide-enter-active,
.tab-slide-leave-active {
  transition: all 0.22s ease;
}
.tab-slide-enter-from,
.tab-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* Back button */
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: #374151;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.dark .back-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
}
.back-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}
.dark .back-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.nav-page-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
}
.dark .nav-page-title {
  color: #f3f4f6;
}

.nav-title-enter-active,
.nav-title-leave-active {
  transition: all 0.2s ease;
}
.nav-title-enter-from,
.nav-title-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* Search wrap */
.search-wrap {
  position: relative;
  transition: flex 0.25s ease, width 0.25s ease;
}
.search-wrap--idle {
  width: 200px;
}
.search-wrap--open {
  flex: 1;
}

.search-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 34px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.05);
  border: 1.5px solid transparent;
  transition: all 0.2s ease;
}
.dark .search-inner {
  background: rgba(255, 255, 255, 0.07);
}
.search-inner--focus {
  background: #ffffff;
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.12);
}
.dark .search-inner--focus {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.search-icon-glyph {
  font-size: 14px;
  color: #9ca3af;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #111827;
  outline: none;
}
.dark .search-input {
  color: #f3f4f6;
}
.search-input::placeholder {
  color: #9ca3af;
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.07);
  font-size: 11px;
  color: #4b5563;
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
  transition: background 0.15s ease;
}
.dark .type-chip {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
}
.type-chip:hover {
  background: rgba(0, 0, 0, 0.12);
}
.dark .type-chip:hover {
  background: rgba(255, 255, 255, 0.16);
}

/* Action button */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: #4b5563;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s ease;
}
.dark .action-btn {
  background: rgba(255, 255, 255, 0.07);
  color: #9ca3af;
}
.action-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #111827;
  transform: translateY(-1px);
}
.dark .action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f3f4f6;
}

/* User Menu Popover */
.user-menu {
  width: 220px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 6px;
  font-size: 13px;
  color: #374151;
}
.dark .user-menu {
  background: #1f2937;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  color: #e5e7eb;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.menu-row:hover {
  background: rgba(0, 0, 0, 0.05);
}
.dark .menu-row:hover {
  background: rgba(255, 255, 255, 0.07);
}

.zoom-ctrl {
  display: flex;
  align-items: center;
  gap: 4px;
}
.zoom-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
}
.dark .zoom-btn {
  background: rgba(255, 255, 255, 0.1);
}
.zoom-val {
  font-size: 11px;
  font-weight: 500;
  min-width: 32px;
  text-align: center;
  cursor: pointer;
}
.zoom-val--100 {
  color: #10b981;
}
</style>
