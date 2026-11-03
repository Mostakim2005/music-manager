const otherRouter = [
  {
    path: '/artist/detail/:id',
    name: 'artistDetail',
    meta: {
      title: 'Artist Details',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/artist/detail.vue'),
    props: (route: any) => ({ key: route.params.id })
  },
  {
    path: '/music-list/:id?',
    name: 'musicList',
    meta: {
      title: 'Music List',
      keepAlive: false,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/music/MusicListPage.vue')
  },
  {
    path: '/playlist/import',
    name: 'playlistImport',
    meta: {
      title: 'Import Playlist',
      keepAlive: true,
      back: true
    },
    component: () => import('@/views/playlist/ImportPlaylist.vue')
  },
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
