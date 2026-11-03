const layoutRouter = [
  {
    path: '/',
    name: 'home',
    meta: {
      title: 'comp.home',
      icon: 'icon-Home',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/home/index.vue')
  },
  {
    path: '/search',
    name: 'search',
    meta: {
      title: 'comp.search',
      noScroll: true,
      icon: 'icon-Search',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/search/index.vue')
  },
  {
    path: '/local-music',
    name: 'localMusic',
    meta: {
      title: 'comp.localMusic',
      icon: 'ri-folder-music-fill',
      keepAlive: true,
      isMobile: false,
      electronOnly: false,
      hideInSidebar: false
    },
    component: () => import('@/views/local-music/index.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/historyAndFavorite/index.vue'),
    meta: {
      title: 'comp.history',
      icon: 'icon-a-TicketStar',
      keepAlive: true,
      isMobile: true
    }
  },
  {
    path: '/favorite',
    name: 'favorite',
    meta: {
      title: 'comp.homeHero.quickNav.myFavorite',
      icon: 'ri-heart-fill',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/favorite/index.vue')
  },
  {
    path: '/downloads',
    name: 'downloads',
    meta: {
      title: 'download.title',
      keepAlive: true,
      isMobile: true,
      icon: 'ri-download-cloud-2-line'
    },
    component: () => import('@/views/download/DownloadPage.vue')
  },
  {
    path: '/set',
    name: 'set',
    meta: {
      title: 'comp.settings',
      icon: 'ri-settings-3-fill',
      keepAlive: true,
      noScroll: true,
      back: true,
      isMobile: true
    },
    component: () => import('@/views/set/index.vue')
  }
];

export default layoutRouter;
