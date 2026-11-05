import { useMessage } from 'naive-ui';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore, useRecommendStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { getImageBackground } from '@/utils/linearColor';

import { dislikeRecommendedSong } from '../api/music';
import { useArtist } from './useArtist';
import { useDownload } from './useDownload';

export function useSongItem(props: { item: SongResult; canRemove?: boolean }) {
  const { t } = useI18n();
  const playerStore = usePlayerStore();
  const recommendStore = useRecommendStore();
  const message = useMessage();
  const { downloadMusic, downloadLyric } = useDownload();
  const { navigateToArtist } = useArtist();

  const showDropdown = ref(false);
  const dropdownX = ref(0);
  const dropdownY = ref(0);
  const isHovering = ref(false);

  const play = computed(() => playerStore.isPlay);
  const playMusic = computed(() => playerStore.playMusic);
  const playLoading = computed(
    () => playMusic.value.id === props.item.id && playMusic.value.playLoading
  );
  const isPlaying = computed(() => playMusic.value.id === props.item.id);

  const isFavorite = computed(() => {
    const numericId =
      typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;
    return playerStore.favoriteList.includes(numericId);
  });

  const isDislike = computed(() => {
    const numericId =
      typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;
    return playerStore.dislikeList.includes(numericId);
  });

  const artists = computed(() => {
    return (props.item.ar || props.item.song?.artists)?.slice(0, 4) || [];
  });

  const handleImageLoad = async (imageElement: HTMLImageElement) => {
    if (!imageElement) return;

    const { backgroundColor, primaryColor } = await getImageBackground(imageElement);
    props.item.backgroundColor = backgroundColor;
    props.item.primaryColor = primaryColor;
  };

  const playMusicEvent = async (item: SongResult) => {
    try {
      const result = await playerStore.setPlay(item);
      if (!result) {
        throw new Error('Playback failed');
      }
      return true;
    } catch (error) {
      console.error('Playback error:', error);
      return false;
    }
  };

  const toggleFavorite = async (e: Event) => {
    e && e.stopPropagation();
    const numericId =
      typeof props.item.id === 'string' ? parseInt(props.item.id, 10) : props.item.id;

    if (isFavorite.value) {
      playerStore.removeFromFavorite(numericId);
    } else {
      playerStore.addToFavorite(numericId);
    }
  };

  const isDailyRecommendSong = computed(() => {
    return recommendStore.dailyRecommendSongs.some((song) => song.id === props.item.id);
  });

  const toggleDislike = async (e: Event) => {
    e && e.stopPropagation();

    if (isDislike.value) {
      playerStore.removeFromDislikeList(props.item.id);
      return;
    }

    playerStore.addToDislikeList(props.item.id);

    if (!isDailyRecommendSong.value) {
      return;
    }
    try {
      console.log('Sending dislike request, song ID:', props.item.id);
      const numericId = typeof props.item.id === 'string' ? parseInt(props.item.id) : props.item.id;
      const response = await dislikeRecommendedSong(numericId);
      if (response.data.data) {
        console.log(response);
        const newSongData = response.data.data;
        const newSong: SongResult = {
          ...newSongData,
          name: newSongData.name,
          id: newSongData.id,
          picUrl: newSongData.al?.picUrl || newSongData.album?.picUrl,
          ar: newSongData.ar || newSongData.artists,
          al: newSongData.al || newSongData.album,
          song: {
            ...newSongData.song,
            id: newSongData.id,
            name: newSongData.name,
            artists: newSongData.ar || newSongData.artists,
            album: newSongData.al || newSongData.album
          },
          source: 'youtube' as any,
          count: 0
        };
        recommendStore.replaceSongInDailyRecommend(props.item.id, newSong);
      } else {
        console.warn('Dislike API succeeded but returned no new song.', response.data);
      }
    } catch (error) {
      console.error('Error sending dislike request:', error);
    }
  };

  const handlePlayNext = () => {
    playerStore.addToNextPlay(props.item);
    message.success(t('songItem.message.addedToNextPlay'));
  };

  const getDuration = (item: SongResult): number => {
    if (item.duration) return item.duration;
    if (typeof item.dt === 'number') return item.dt;
    return 0;
  };

  const formatDuration = (ms: number): string => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    showDropdown.value = true;
    dropdownX.value = e.clientX;
    dropdownY.value = e.clientY;
  };

  const handleMenuClick = (e: MouseEvent) => {
    e.preventDefault();
    showDropdown.value = true;
    dropdownX.value = e.clientX;
    dropdownY.value = e.clientY;
  };

  const handleArtistClick = (id: number) => {
    navigateToArtist(id);
  };

  const handleMouseEnter = () => {
    isHovering.value = true;
  };

  const handleMouseLeave = () => {
    isHovering.value = false;
  };

  return {
    t,
    play,
    playMusic,
    playLoading,
    isPlaying,
    isFavorite,
    isDislike,
    artists,
    showDropdown,
    dropdownX,
    dropdownY,
    isHovering,
    playerStore,
    message,
    getImgUrl,
    handleImageLoad,
    playMusicEvent,
    toggleFavorite,
    toggleDislike,
    handlePlayNext,
    getDuration,
    formatDuration,
    handleContextMenu,
    handleMenuClick,
    handleArtistClick,
    handleMouseEnter,
    handleMouseLeave,
    downloadMusic,
    downloadLyric
  };
}
