/**
 *
 *
 */

import { cloneDeep } from 'lodash';
import { createDiscreteApi } from 'naive-ui';

import i18n from '@/../i18n/renderer';
import { getParsingMusicUrl } from '@/api/music';
import { loadLrc, useSongDetail } from '@/hooks/usePlayerHooks';
import { audioService } from '@/services/audioService';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { getPosition, getSongKey, savePosition } from '@/services/songLibrary';
import { SongSourceConfigManager } from '@/services/SongSourceConfigManager';
import type { Platform, SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { getImageLinearBackground } from '@/utils/linearColor';
import { readPlaybackProgress } from '@/utils/playerUtils';

const { message } = createDiscreteApi(['message']);

let reparseGeneration = 0;

/**
 */
export const getCurrentGeneration = (): number => playbackRequestManager.getGeneration();

const getPlayerCoreStore = async () => {
  const { usePlayerCoreStore } = await import('@/store/modules/playerCore');
  return usePlayerCoreStore();
};

const getPlaylistStore = async () => {
  const { usePlaylistStore } = await import('@/store/modules/playlist');
  return usePlaylistStore();
};

const getPlayHistoryStore = async () => {
  const { usePlayHistoryStore } = await import('@/store/modules/playHistory');
  return usePlayHistoryStore();
};

const getSettingsStore = async () => {
  const { useSettingsStore } = await import('@/store/modules/settings');
  return useSettingsStore();
};

/**
 */
const loadMetadata = async (
  music: SongResult
): Promise<{
  lyrics: SongResult['lyric'];
  backgroundColor: string;
  primaryColor: string;
}> => {
  const [lyrics, { backgroundColor, primaryColor }] = await Promise.all([
    (async () => {
      if (music.lyric?.lrcTimeArray?.length) {
        return music.lyric;
      }
      return await loadLrc(music.id, music);
    })(),
    (async () => {
      if (music.backgroundColor && music.primaryColor) {
        return { backgroundColor: music.backgroundColor, primaryColor: music.primaryColor };
      }
      return await getImageLinearBackground(getImgUrl(music?.picUrl, '30y30'));
    })()
  ]);

  return { lyrics, backgroundColor, primaryColor };
};

/**
 */
const loadAndPlayAudio = async (
  song: SongResult,
  shouldPlay: boolean,
  startTime: number
): Promise<void> => {
  if (!song.playMusicUrl) {
    throw new Error('No playable URL for this song');
  }

  console.log(`[playbackController] Starting playback: ${song.name}`);
  await audioService.play(song.playMusicUrl, song, shouldPlay, startTime);
};

/**
 */
const triggerPreload = async (song: SongResult, gen: number): Promise<void> => {
  try {
    const playlistStore = await getPlaylistStore();
    if (gen !== getCurrentGeneration()) return;
    const list = playlistStore.playList;
    if (Array.isArray(list) && list.length > 0) {
      const idx = list.findIndex(
        (item: SongResult) => item.id === song.id && item.source === song.source
      );
      if (idx !== -1) {
        playlistStore.preloadNextSongs(idx);
      }
    }
  } catch (e) {
    console.warn('Preload skipped (missing dependency or circular import):', e);
  }
};

/**
 */
const updateDocumentTitle = (music: SongResult): void => {
  let title = music.name;
  const artist =
    music?.ar?.[0]?.name || music?.artists?.[0]?.name || (music as any)?.song?.artists?.[0]?.name;
  if (artist) {
    title += ` - ${artist}`;
  }
  document.title = 'Music Manager - ' + title;
};

/**
 *
 */
type PlaybackOptions = {
  startTime?: number;
  recovery?: boolean;
  recordHistory?: boolean;
};

export const playTrack = async (
  music: SongResult,
  shouldPlay: boolean = true,
  options: PlaybackOptions = {}
): Promise<boolean> => {
  if (!music?.id) return false;
  const requestId = playbackRequestManager.createRequest(music);
  const gen = getCurrentGeneration();
  const playerCore = await getPlayerCoreStore();
  if (gen !== getCurrentGeneration()) return false;
  if (music.id !== playerCore.playMusic.id) {
    SongSourceConfigManager.clearTriedSources(music.id);
    // Media (video/mode) is matched by song ID: drop the previous song's video
    // mode before the new track loads so no stale video/artwork survives.
    playerCore.resetMediaStateForNewSong();
  }
  if (!options.recovery) resetUrlExpiredRetry();

  // Save playback position of the previous track before stopping
  const prevTrack = audioService.getCurrentTrack();
  const prevSound = audioService.getCurrentSound();
  if (prevTrack && prevSound && prevSound.currentTime > 0) {
    const prevKey = getSongKey(prevTrack);
    if (prevKey) {
      void savePosition(prevKey, prevSound.currentTime);
    }
  }

  audioService.stop();
  playerCore.setIsPlay(false);
  playerCore.userPlayIntent = shouldPlay;
  playerCore.playMusic = { ...music, playLoading: true };
  playerCore.playMusicUrl = '';
  updateDocumentTitle(music);

  // Lazily inspect embedded YouTube link for local track on play
  if (music.playMusicUrl?.startsWith('local://')) {
    const rawPath = decodeURIComponent(music.playMusicUrl.replace('local://', ''));
    if (rawPath && typeof window !== 'undefined') {
      import('@/services/youtubeService')
        .then(({ youtubeService }) => {
          youtubeService
            .readLink(rawPath)
            .then(async (ytLink) => {
              if (ytLink) {
                const vid = youtubeService.extractVideoId(ytLink) || ytLink;
                if (vid) {
                  (music as any).youtubeId = vid;
                  const { getLibraryDB } = await import('@/services/songLibrary');
                  const db = getLibraryDB();
                  const matched = await db.variants.where('path').equals(rawPath).first();
                  if (matched?.songId) {
                    await db.songs.update(matched.songId, { youtubeId: vid });
                  }
                }
              }
            })
            .catch(() => {});
        })
        .catch(() => {});
    }
  }

  const originalMusic = { ...music };
  let loadedMetadata: Awaited<ReturnType<typeof loadMetadata>> | null = null;
  const applyLoadedMetadata = () => {
    if (!loadedMetadata || gen !== getCurrentGeneration()) return;
    playerCore.playMusic.lyric = loadedMetadata.lyrics;
    playerCore.playMusic.backgroundColor = loadedMetadata.backgroundColor;
    playerCore.playMusic.primaryColor = loadedMetadata.primaryColor;
    playerCore.playMusic = { ...playerCore.playMusic };
  };
  loadMetadata(originalMusic)
    .then((result) => {
      loadedMetadata = result;
      applyLoadedMetadata();
    })
    .catch((error) => {
      console.warn('[playbackController] Failed to load metadata:', error);
    });

  const { getSongDetail } = useSongDetail();
  let startTime =
    Number.isFinite(options.startTime) && options.startTime! >= 0 ? options.startTime! : 0;
  if (options.startTime === undefined && !options.recovery) {
    try {
      const songKey = getSongKey(originalMusic);
      if (songKey) {
        const savedPos = await getPosition(songKey);
        const durationSec =
          originalMusic.dt && originalMusic.dt > 1000
            ? originalMusic.dt / 1000
            : ((originalMusic as any).durationSec ??
              (originalMusic.duration && originalMusic.duration > 1000
                ? originalMusic.duration / 1000
                : (originalMusic.duration ?? 0)));
        if (savedPos > 5 && (durationSec > 15 ? savedPos < durationSec - 10 : true)) {
          startTime = savedPos;
        }
      }
    } catch (e) {
      console.warn('[playbackController] Failed to read saved progress:', e);
    }
  }
  let candidate = originalMusic;
  for (let attempt = 0; attempt < 2; attempt++) {
    let audioUrl: string | undefined;
    try {
      const song = await getSongDetail(candidate, requestId);
      if (gen !== getCurrentGeneration()) return false;
      if (!song.playMusicUrl) throw new Error('No playable URL for this song');
      audioUrl = song.playMusicUrl;
      playerCore.playMusic = { ...song, playLoading: true };
      playerCore.playMusicUrl = audioUrl;
      applyLoadedMetadata();
      audioService.setVolume(playerCore.isMuted ? 0 : playerCore.volume);
      audioService.setPlaybackRate(playerCore.playbackRate);
      await loadAndPlayAudio(playerCore.playMusic, shouldPlay, startTime);
      if (gen !== getCurrentGeneration()) return false;

      playerCore.setIsPlay(shouldPlay);
      playerCore.playMusic.playLoading = false;
      playerCore.playMusic.isFirstPlay = false;
      playbackRequestManager.completeRequest(requestId);
      window.dispatchEvent(
        new CustomEvent('audio-ready', {
          detail: { sound: audioService.getCurrentSound(), shouldPlay }
        })
      );
      void triggerPreload(playerCore.playMusic, gen);
      if (shouldPlay && options.recordHistory !== false) {
        try {
          const history = await getPlayHistoryStore();
          if (gen !== getCurrentGeneration()) return false;
          if (music.isPodcast) {
            if (music.program) history.addPodcast(music.program);
          } else {
            history.addMusic(playerCore.playMusic);
          }
        } catch (error) {
          console.warn('[playbackController] Failed to add play history:', error);
        }
      }
      return true;
    } catch (error) {
      if (gen !== getCurrentGeneration()) return false;
      const name = (error as Error)?.name;
      if (
        attempt === 0 &&
        !options.recovery &&
        audioUrl &&
        /^https?:\/\//i.test(audioUrl) &&
        name !== 'AbortError' &&
        name !== 'NotAllowedError'
      ) {
        await clearParsedUrlCache(music.id);
        if (gen !== getCurrentGeneration()) return false;
        candidate = { ...originalMusic, playMusicUrl: undefined, expiredAt: undefined };
        continue;
      }

      console.error('[playbackController] Playback failed:', error);
      playerCore.setIsPlay(false);
      playerCore.userPlayIntent = false;
      playerCore.playMusic.playLoading = false;
      audioService.pause();
      if (name !== 'AbortError') {
        message.error(
          i18n.global.t(name === 'NotAllowedError' ? 'player.resumeFailed' : 'player.playFailed')
        );
      }
      playbackRequestManager.failRequest(requestId);
      return false;
    }
  }
  return false;
};

export const resumeCurrentSong = async (): Promise<boolean> => {
  const initialGeneration = getCurrentGeneration();
  const core = await getPlayerCoreStore();
  if (initialGeneration !== getCurrentGeneration() || !core.playMusic?.id) return false;
  const song = { ...core.playMusic };
  const sound = audioService.getCurrentSound();
  if (
    !sound ||
    sound.error ||
    sound.readyState < 2 ||
    audioService.getCurrentTrack()?.id !== song.id
  ) {
    const songKey = getSongKey(song);
    const dbPos = songKey ? await getPosition(songKey) : 0;
    return playTrack(song, true, {
      startTime: dbPos > 0 ? dbPos : readPlaybackProgress(song.id),
      recordHistory: false
    });
  }

  const requestId = playbackRequestManager.createRequest(song);
  const gen = getCurrentGeneration();
  core.userPlayIntent = true;
  core.playMusic.playLoading = true;
  try {
    audioService.setVolume(core.isMuted ? 0 : core.volume);
    audioService.setPlaybackRate(core.playbackRate);
    await loadAndPlayAudio(song, true, sound.ended ? 0 : sound.currentTime);
    if (gen !== getCurrentGeneration()) return false;
    core.setIsPlay(true);
    core.playMusic.playLoading = false;
    playbackRequestManager.completeRequest(requestId);
    window.dispatchEvent(new CustomEvent('audio-ready', { detail: { sound, shouldPlay: true } }));
    return true;
  } catch (error) {
    if (gen !== getCurrentGeneration()) return false;
    core.setIsPlay(false);
    core.userPlayIntent = false;
    core.playMusic.playLoading = false;
    console.error('[playbackController] Failed to restore playback:', error);
    message.error(i18n.global.t('player.resumeFailed'));
    return false;
  }
};

/**
 *
 */
export const reparseCurrentSong = async (
  sourcePlatform: Platform,
  isAuto: boolean = false
): Promise<boolean> => {
  const gen = getCurrentGeneration();
  const reparseGen = ++reparseGeneration;
  try {
    const playerCore = await getPlayerCoreStore();
    if (gen !== getCurrentGeneration() || reparseGen !== reparseGeneration) return false;
    const currentSong = playerCore.playMusic;

    if (!currentSong || !currentSong.id) {
      console.warn('[playbackController] No valid playback target');
      return false;
    }

    const numericId = Number(currentSong.id);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) return false;

    SongSourceConfigManager.setConfig(currentSong.id, [sourcePlatform], isAuto ? 'auto' : 'manual');

    const currentSound = audioService.getCurrentSound();
    const startTime = currentSound?.currentTime ?? 0;
    if (currentSound) {
      audioService.pause();
    }

    console.log(
      `[playbackController] Using source ${sourcePlatform} re-resolving song ${numericId}`
    );

    const songData = cloneDeep(currentSong);
    const res = await getParsingMusicUrl(numericId, songData);
    if (gen !== getCurrentGeneration() || reparseGen !== reparseGeneration) return false;

    if (res && res.data && res.data.data && res.data.data.url) {
      const newUrl = res.data.data.url;
      console.log(`[playbackController] Resolved, new URL: ${newUrl.substring(0, 50)}...`);

      const updatedMusic: SongResult = {
        ...currentSong,
        playMusicUrl: newUrl,
        expiredAt: Date.now() + 1800000
      };

      const playback = playTrack(updatedMusic, true, { startTime, recordHistory: false });
      const playbackGeneration = getCurrentGeneration();
      const success = await playback;
      if (!success || playbackGeneration !== getCurrentGeneration()) return false;

      const playlistStore = await getPlaylistStore();
      if (playbackGeneration !== getCurrentGeneration()) return false;
      playlistStore.updateSong(updatedMusic);

      return true;
    } else {
      console.warn(`[playbackController] Using source ${sourcePlatform} failed to resolve`);
      return false;
    }
  } catch (error) {
    console.error('[playbackController] Re-resolve failed:', error);
    return false;
  }
};

/**
 */
const MAX_URL_EXPIRED_RETRIES = 1;
let urlExpiredRetrySongId: string | number | null = null;
let urlExpiredRetryCount = 0;

const resetUrlExpiredRetry = (): void => {
  urlExpiredRetrySongId = null;
  urlExpiredRetryCount = 0;
};

/**
 */
const clearParsedUrlCache = async (songId: string | number): Promise<void> => {
  if (!songId || String(songId).startsWith('local://')) return;
  try {
    const { MusicResolveCache } = await import('@/services/musicSource/cache');
    await MusicResolveCache.clearMusicCache(songId);
  } catch (error) {
    console.warn('[playbackController] Failed to clear URL cache:', error);
  }
};

/**
 */
let playbackHandlersInitialized = false;
let recoveryInFlight: number | null = null;

const handleUrlExpired = async (expiredTrack: SongResult): Promise<void> => {
  if (!expiredTrack || expiredTrack.playMusicUrl?.startsWith('local://')) return;
  const gen = getCurrentGeneration();
  if (recoveryInFlight === gen) return;
  recoveryInFlight = gen;
  try {
    const core = await getPlayerCoreStore();
    if (
      gen !== getCurrentGeneration() ||
      !core.userPlayIntent ||
      core.playMusic?.id !== expiredTrack.id ||
      core.playMusic.playMusicUrl !== expiredTrack.playMusicUrl
    )
      return;

    if (urlExpiredRetrySongId !== expiredTrack.id) {
      urlExpiredRetrySongId = expiredTrack.id;
      urlExpiredRetryCount = 0;
    }
    let activeGeneration = gen;
    if (urlExpiredRetryCount < MAX_URL_EXPIRED_RETRIES) {
      urlExpiredRetryCount++;
      const startTime = audioService.getCurrentSound()?.currentTime ?? 0;
      await clearParsedUrlCache(expiredTrack.id);
      if (gen !== getCurrentGeneration()) return;
      const playback = playTrack(
        { ...expiredTrack, playMusicUrl: undefined, expiredAt: undefined },
        true,
        { startTime, recovery: true, recordHistory: false }
      );
      activeGeneration = getCurrentGeneration();
      if (await playback) return;
    }
    if (activeGeneration !== getCurrentGeneration()) return;
    const playlist = await getPlaylistStore();
    if (activeGeneration !== getCurrentGeneration()) return;
    core.setIsPlay(false);
    if (playlist.playList.length > 1 || core.isFmPlaying) {
      await playlist.nextPlay(false, true);
    } else {
      core.handlePause();
    }
  } catch (error) {
    console.error('[playbackController] Failed to handle URL expiry:', error);
  } finally {
    if (recoveryInFlight === gen) recoveryInFlight = null;
  }
};

export const setupUrlExpiredHandler = (): void => {
  if (playbackHandlersInitialized) return;
  playbackHandlersInitialized = true;
  audioService.on('url_expired', handleUrlExpired);
  audioService.on('playback_error', async (track: SongResult) => {
    const gen = getCurrentGeneration();
    const core = await getPlayerCoreStore();
    if (gen !== getCurrentGeneration() || core.playMusic.id !== track.id) return;
    core.handlePause();
    message.error(i18n.global.t('player.playFailed'));
  });
  audioService.on('play_request', resumeCurrentSong);
  const pauseCurrent = async () => {
    const gen = getCurrentGeneration();
    const core = await getPlayerCoreStore();
    if (gen === getCurrentGeneration()) core.handlePause();
  };
  audioService.on('pause_request', pauseCurrent);
  audioService.on('stop_request', pauseCurrent);
};

/**
 */
export const initializePlayState = async (): Promise<void> => {
  const gen = getCurrentGeneration();
  const playerCore = await getPlayerCoreStore();
  const settingsStore = await getSettingsStore();
  if (gen !== 0 || gen !== getCurrentGeneration()) return;
  audioService.setPlaybackRate(playerCore.playbackRate);
  audioService.setVolume(playerCore.isMuted ? 0 : playerCore.volume);

  if (!playerCore.playMusic?.id) {
    console.log('[playbackController] No saved playback state, skipping initialization');
    return;
  }

  const savedSong = { ...playerCore.playMusic };
  try {
    console.log('[playbackController] Restoring last played track:', playerCore.playMusic.name);
    const isPlaying = settingsStore.setData.autoPlay;

    if (!isPlaying) {
      console.log('[playbackController] Autoplay disabled, loading metadata only');

      try {
        const { lyrics, backgroundColor, primaryColor } = await loadMetadata(savedSong);
        if (gen !== getCurrentGeneration()) return;
        playerCore.playMusic.lyric = lyrics;
        playerCore.playMusic.backgroundColor = backgroundColor;
        playerCore.playMusic.primaryColor = primaryColor;
      } catch (e) {
        console.warn('[playbackController] Failed to load metadata:', e);
      }
      if (gen !== getCurrentGeneration()) return;

      playerCore.play = false;
      playerCore.isPlay = false;
      playerCore.userPlayIntent = false;

      updateDocumentTitle(playerCore.playMusic);

      try {
        const songKey = getSongKey(savedSong);
        const dbProgress = songKey ? await getPosition(songKey) : 0;
        const savedProgress = dbProgress > 0 ? dbProgress : readPlaybackProgress(savedSong.id);
        if (savedProgress > 0) {
          const { nowTime, allTime } = await import('@/hooks/MusicHook');
          if (gen !== getCurrentGeneration()) return;
          nowTime.value = savedProgress;
          if (playerCore.playMusic.dt) {
            allTime.value = playerCore.playMusic.dt / 1000;
          }
        }
      } catch (e) {
        console.warn('[playbackController] Failed to restore playback progress:', e);
      }
    } else {
      const isLocalMusic = playerCore.playMusic.playMusicUrl?.startsWith('local://');
      const songKey = getSongKey(savedSong);
      const dbProgress = songKey ? await getPosition(songKey) : 0;
      const savedProgress = dbProgress > 0 ? dbProgress : readPlaybackProgress(savedSong.id);

      await playTrack(
        {
          ...playerCore.playMusic,
          isFirstPlay: true,
          playMusicUrl: isLocalMusic ? playerCore.playMusic.playMusicUrl : undefined
        },
        true,
        { startTime: savedProgress, recordHistory: false }
      );
    }
  } catch (error) {
    if (gen !== getCurrentGeneration()) return;
    console.error('[playbackController] Failed to restore playback state:', error);
    playerCore.play = false;
    playerCore.isPlay = false;
    playerCore.playMusic = {} as SongResult;
    playerCore.playMusicUrl = '';
  }
};
