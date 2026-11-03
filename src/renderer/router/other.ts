const otherRouter = [
  {
    path: '/heatmap',
    name: 'heatmap',
    meta: {
      title: 'Playback Heatmap',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/heatmap/index.vue')
  },
  {
    path: '/mobile-search',
    name: 'mobileSearch',
    meta: {
      title: 'Search',
      keepAlive: false,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/mobile-search/index.vue')
  },
  {
    path: '/mobile-search-result',
    name: 'mobileSearchResult',
    meta: {
      title: 'Search Results',
      keepAlive: false,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/mobile-search-result/index.vue')
  },
  {
    path: '/search-result',
    name: 'searchResult',
    meta: {
      title: 'Search Results',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/search/SearchResult.vue')
  }
];

export default otherRouter;
