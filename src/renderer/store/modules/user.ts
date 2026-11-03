import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { IUserDetail } from '@/types/user';
import { clearLoginStatus } from '@/utils/auth';

interface UserData {
  userId: number;
  [key: string]: any;
}

function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export const useUserStore = defineStore('user', () => {
  // 状态
  const user = ref<UserData | null>(getLocalStorageItem('user', null));
  const userDetail = ref<IUserDetail | null>(null);
  const recordList = ref<any[]>([]);
  const loginType = ref<'token' | 'cookie' | 'qr' | 'uid' | null>(
    getLocalStorageItem('loginType', null)
  );
  const searchValue = ref('');
  const searchType = ref(1);
  // 收藏的专辑 ID 列表
  const collectedAlbumIds = ref<Set<number>>(new Set());
  // 用户的歌单列表
  const playList = ref<any[]>([]);
  // 用户的专辑列表
  const albumList = ref<any[]>([]);

  // 是否具有真实登录权限（Cookie/扫码/Token）。UID 登录只填了 uid，没有真实 cookie。
  // 用 store 的响应式状态而非直接读 localStorage：后者不具备响应性，
  // 登录/登出后入口和菜单禁用状态不会刷新（#706）
  const hasRealAuth = computed(() => !!user.value && loginType.value !== 'uid');

  // 方法
  const setUser = (userData: UserData) => {
    user.value = userData;
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const setLoginType = (type: typeof loginType.value) => {
    loginType.value = type;
    if (type) {
      localStorage.setItem('loginType', type);
    } else {
      localStorage.removeItem('loginType');
    }
  };

  const handleLogout = async () => {
    user.value = null;
    loginType.value = null;
    collectedAlbumIds.value.clear();
    playList.value = [];
    albumList.value = [];
    clearLoginStatus();
    window.location.reload();
  };

  const setSearchValue = (value: string) => {
    searchValue.value = value;
  };

  const setSearchType = (type: number) => {
    searchType.value = type;
  };

  // 初始化歌单列表
  const initializePlaylist = async () => {
    playList.value = [];
  };

  // 初始化专辑列表
  const initializeAlbumList = async () => {
    albumList.value = [];
  };

  // 初始化收藏的专辑ID列表
  const initializeCollectedAlbums = async () => {
    collectedAlbumIds.value.clear();
  };

  // 添加收藏专辑
  const addCollectedAlbum = (albumId: number) => {
    collectedAlbumIds.value.add(albumId);
  };

  // 移除收藏专辑
  const removeCollectedAlbum = (albumId: number) => {
    collectedAlbumIds.value.delete(albumId);
  };

  // 检查专辑是否已收藏
  const isAlbumCollected = (albumId: number) => {
    return collectedAlbumIds.value.has(albumId);
  };

  // 判断用户是否为VIP
  const isVip = computed(() => {
    return false;
  });

  // 初始化
  const initializeUser = async () => {
    const savedUser = getLocalStorageItem<UserData | null>('user', null);
    if (savedUser) {
      user.value = savedUser;
    }
    return [];
  };

  return {
    // 状态
    user,
    loginType,
    searchValue,
    searchType,
    collectedAlbumIds,
    playList,
    albumList,
    isVip,
    hasRealAuth,

    // 方法
    setUser,
    setLoginType,
    handleLogout,
    setSearchValue,
    setSearchType,
    initializeUser,
    initializePlaylist,
    initializeAlbumList,
    initializeCollectedAlbums,
    addCollectedAlbum,
    removeCollectedAlbum,
    isAlbumCollected,
    userDetail,
    recordList
  };
});
