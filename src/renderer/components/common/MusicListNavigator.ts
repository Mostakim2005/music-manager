import { Router } from 'vue-router';

import { useMusicStore } from '@/store/modules/music';

/**
 */
export function navigateToMusicList(
  router: Router,
  options: {
    id?: string | number;
    type?: 'album' | 'playlist' | 'dailyRecommend' | string;
    name: string;
    songList?: any[];
    listInfo?: any;
    canRemove?: boolean;
  }
) {
  const musicStore = useMusicStore();
  const { id, type, name, songList, listInfo, canRemove = false } = options;

  if (type !== 'dailyRecommend') {
    if (songList) {
      musicStore.setCurrentMusicList(songList, name, listInfo, canRemove);
    } else {
      musicStore.setBasicListInfo(name, listInfo, canRemove);
    }
  } else {
    musicStore.clearCurrentMusicList();
  }

  if (id) {
    router.push({
      name: 'musicList',
      params: { id },
      query: { type }
    });
  } else {
    router.push({
      name: 'musicList',
      query: { type: 'dailyRecommend' }
    });
  }
}
