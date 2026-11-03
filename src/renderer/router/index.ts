import { createRouter, createWebHashHistory } from 'vue-router';

import AppLayout from '@/layout/AppLayout.vue';
import MiniLayout from '@/layout/MiniLayout.vue';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useSettingsStore } from '@/store/modules/settings';

import { useUserStore } from '../store/modules/user';

function getUserId(): string | null {
  const userStore = useUserStore();
  return userStore.user?.userId?.toString() || null;
}

// Helper to access settings store in guards
let _settingsStore: ReturnType<typeof useSettingsStore> | null = null;
const getSettingsStore = () => {
  if (!_settingsStore) {
    _settingsStore = useSettingsStore();
  }
  return _settingsStore;
};

const routes = [
  {
    path: '/',
    component: AppLayout,
    children: [...homeRouter, ...otherRouter]
  },
  {
    path: '/lyric',
    component: () => import('@/views/lyric/index.vue')
  },
  {
    path: '/mini',
    component: MiniLayout
  }
];

const router = createRouter({
  routes,
  history: createWebHashHistory()
});

// Global navigation guard
router.beforeEach((to, _, next) => {
  const settingsStore = getSettingsStore();

  if (settingsStore.isMiniMode) {
    if (to.path === '/mini') {
      next();
    } else {
      next(false);
    }
  } else if (to.path === '/mini') {
    next('/');
  } else {
    next();
  }
});

// Global hook after each navigation
router.afterEach((to) => {
  const pageName = to.name?.toString() || to.path;
  setTimeout(() => {
    const userId = getUserId();
    console.log('pageName', pageName, userId);
  }, 100);
});

export default router;
