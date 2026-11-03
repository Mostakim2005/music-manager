import { defineStore } from 'pinia';
import { ref } from 'vue';

import { getLocalStorageItem, isBilibiliIdMatch, setLocalStorageItem } from '@/utils/playerUtils';

/**
 * 收藏管理 Store
 * 负责：收藏列表、不喜欢列表的管理
 */
export const useFavoriteStore = defineStore('favorite', () => {
  // ==================== 状态 ====================
  const favoriteList = ref<Array<number | string>>(getLocalStorageItem('favoriteList', []));
  const dislikeList = ref<Array<number | string>>(getLocalStorageItem('dislikeList', []));

  // ==================== Actions ====================

  /**
   * 添加到收藏列表
   */
  const addToFavorite = async (id: number | string) => {
    // 检查是否已存在
    const isAlreadyInList = favoriteList.value.some((existingId) =>
      typeof id === 'string' && id.includes('--')
        ? isBilibiliIdMatch(existingId, id)
        : existingId === id
    );

    if (!isAlreadyInList) {
      favoriteList.value.push(id);
      setLocalStorageItem('favoriteList', favoriteList.value);
    }
  };

  /**
   * 从收藏列表移除
   */
  const removeFromFavorite = async (id: number | string) => {
    // 对于B站视频，需要根据bvid和cid来匹配
    if (typeof id === 'string' && id.includes('--')) {
      favoriteList.value = favoriteList.value.filter(
        (existingId) => !isBilibiliIdMatch(existingId, id)
      );
    } else {
      favoriteList.value.filter((existingId) => existingId !== id);
    }
    setLocalStorageItem('favoriteList', favoriteList.value);
  };

  /**
   * 添加到不喜欢列表
   */
  const addToDislikeList = (id: number | string) => {
    if (!dislikeList.value.includes(id)) {
      dislikeList.value.push(id);
      setLocalStorageItem('dislikeList', dislikeList.value);
    }
  };

  /**
   * 从不喜欢列表移除
   */
  const removeFromDislikeList = (id: number | string) => {
    dislikeList.value = dislikeList.value.filter((existingId) => existingId !== id);
    setLocalStorageItem('dislikeList', dislikeList.value);
  };

  /**
   * 初始化收藏列表（本地加载）
   */
  const initializeFavoriteList = async () => {
    const localFavoriteList = localStorage.getItem('favoriteList');
    const localList: Array<number | string> = localFavoriteList ? JSON.parse(localFavoriteList) : [];
    favoriteList.value = localList;
    setLocalStorageItem('favoriteList', favoriteList.value);
  };

  /**
   * 检查歌曲是否已收藏
   */
  const isFavorite = (id: number | string): boolean => {
    return favoriteList.value.some((existingId) =>
      typeof id === 'string' && id.includes('--')
        ? isBilibiliIdMatch(existingId, id)
        : existingId === id
    );
  };

  /**
   * 检查歌曲是否在不喜欢列表中
   */
  const isDisliked = (id: number | string): boolean => {
    return dislikeList.value.includes(id);
  };

  return {
    // 状态
    favoriteList,
    dislikeList,

    // Actions
    addToFavorite,
    removeFromFavorite,
    addToDislikeList,
    removeFromDislikeList,
    initializeFavoriteList,
    isFavorite,
    isDisliked
  };
});
