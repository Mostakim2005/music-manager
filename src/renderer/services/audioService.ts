import {
  audioDspGraph,
  type AudioDspState,
  type AudioSignalPathInfo
} from '@/services/audioDspGraph';
import {
  addListeningSeconds,
  recordTrackPlay,
  shouldRecordPlayThreshold
} from '@/services/listeningStatsService';
import { mediaCoordinator, setAudioServiceInstance } from '@/services/mediaCoordinator';
import { getSongKey, registerCurrentTrackProvider, savePosition } from '@/services/songLibrary';
import type { AudioOutputDevice } from '@/types/audio';
import type { SongResult } from '@/types/music';
import { getImgUrl, isElectron } from '@/utils';
import { toPlayableMediaUrl } from '@/utils/localMediaUrl';

/** Smooth play/pause volume fade duration in milliseconds (ported from YesPlayMusic Player.js) */
export const PLAY_PAUSE_FADE_DURATION = 200;

class AudioService {
  private audio: HTMLAudioElement;
  private standbyAudio: HTMLAudioElement | null = null;
  private standbyTrackId: string | null = null;
  private standbyUrl: string | null = null;
  private lastGaplessWarmKey: string | null = null;
  private currentTrack: SongResult | null = null;

  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private playbackRate = 1.0;
  private volume = 1;
  private currentSinkId: string = 'default';
  private _isLoading = false;

  // Smooth fade & Smart Transitions state
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private smoothFadeEnabled = true;
  private crossfadeEnabled = true;
  private crossfadeDuration = 3; // seconds (1-10s)
  private skipSilenceEnabled = false;
  private replayGainEnabled = true;
  private gaplessEnabled = true;
  private crossfadeActive = false;
  private abLoop: { enabled: boolean; pointA: number | null; pointB: number | null } = {
    enabled: false,
    pointA: null,
    pointB: null
  };
  private lastStatsTickTime = 0;
  private currentTrackListenedSec = 0;
  private currentTrackScrobbled = false;

  private operationLock = false;
  private operationLockTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingLoadCleanup: (() => void) | null = null;

  // Event system
  private callbacks: { [key: string]: Function[] } = {};

  constructor() {
    // Create persistent audio element
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';

    // Bind native DOM events
    this.bindAudioEvents();

    try {
      mediaCoordinator.registerMediaElement(this.audio, 'audioService', () => {
        this.pause();
      });
      setAudioServiceInstance(this);
    } catch {
      // safe fallback in test/mock environments
    }

    if ('mediaSession' in navigator) {
      this.initMediaSession();
    }

    // Apply saved preservesPitch immediately on primary element
    audioDspGraph.attach(this.audio, false);
    this.currentSinkId = audioDspGraph.getState().outputDeviceId;

    const volume = Number(localStorage.getItem('volume') ?? 1);
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;

    try {
      const cfEnabled = localStorage.getItem('smartCrossfadeEnabled');
      if (cfEnabled !== null) this.crossfadeEnabled = JSON.parse(cfEnabled) === true;
      const cfDuration = Number(localStorage.getItem('smartCrossfadeDuration'));
      if (Number.isFinite(cfDuration) && cfDuration >= 1 && cfDuration <= 10) {
        this.crossfadeDuration = cfDuration;
      }
      const skipSil = localStorage.getItem('skipSilenceEnabled');
      if (skipSil !== null) this.skipSilenceEnabled = JSON.parse(skipSil) === true;
      const rgEnabled = localStorage.getItem('replayGainEnabled');
      if (rgEnabled !== null) this.replayGainEnabled = JSON.parse(rgEnabled) === true;
      const gpEnabled = localStorage.getItem('gaplessPlaybackEnabled');
      if (gpEnabled !== null) this.gaplessEnabled = JSON.parse(gpEnabled) === true;
    } catch {
      // ignore storage errors in test/restricted environments
    }

    this.forceResetOperationLock();
    window.addEventListener('beforeunload', () => {
      this.forceResetOperationLock();
      if (this.currentTrack && this.audio?.currentTime > 0) {
        try {
          const key = getSongKey(this.currentTrack);
          if (key) void savePosition(key, this.audio.currentTime);
        } catch {
          // ignore
        }
      }
    });
  }

  // ==================== Native DOM Event Binding ====================

  private bindAudioEvents() {
    this.audio.addEventListener('play', () => {
      if (this.audio.paused || !this.currentTrack) return;
      this.lastStatsTickTime = Date.now();
      this.updateMediaSessionState(true);
      this.emit('play');
    });

    this.audio.addEventListener('pause', () => {
      if (!this.audio.paused) return;
      this.lastStatsTickTime = 0;
      this.updateMediaSessionState(false);
      this.emit('pause');
      if (this.currentTrack && this.audio?.currentTime > 0) {
        try {
          const key = getSongKey(this.currentTrack);
          if (key) void savePosition(key, this.audio.currentTime);
        } catch {
          // ignore
        }
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!this.audio.ended || !this.currentTrack) return;
      this.lastStatsTickTime = 0;
      this.updateMediaSessionState(false);
      this.emit('end', this.currentTrack);
    });

    this.audio.addEventListener('seeked', () => {
      this.lastStatsTickTime = Date.now();
      this.updateMediaSessionPositionState();
      this.emit('seek');
    });

    this.audio.addEventListener('timeupdate', () => {
      this.handleSmartTransitionTick();
      this.handleListeningStatsTick();
    });

    this.audio.addEventListener('waiting', () => {
      this._isLoading = true;
    });

    this.audio.addEventListener('canplay', () => {
      this._isLoading = false;
    });

    this.audio.addEventListener('error', () => {
      const error = this.audio.error;
      console.error('Audio element error:', error?.code, error?.message);
      this.emit('audio_error', { type: 'media_error', error });
      if (!this.pendingLoadCleanup && this.currentTrack) {
        this._isLoading = false;
        this.updateMediaSessionState(false);
        this.emit(
          this.currentTrack.playMusicUrl?.startsWith('local://') ? 'playback_error' : 'url_expired',
          this.currentTrack
        );
      }
    });
  }

  // ==================== MediaSession ====================

  private initMediaSession() {
    navigator.mediaSession.setActionHandler('play', () => {
      this.emit('play_request');
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.emit('pause_request');
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      this.emit('stop_request');
    });

    navigator.mediaSession.setActionHandler('seekto', (event) => {
      if (event.seekTime !== undefined) {
        this.seek(event.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', (event) => {
      this.seek(this.audio.currentTime - (event.seekOffset || 10));
    });

    navigator.mediaSession.setActionHandler('seekforward', (event) => {
      this.seek(this.audio.currentTime + (event.seekOffset || 10));
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.emit('previoustrack');
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.emit('nexttrack');
    });
  }

  private updateMediaSessionMetadata(track: SongResult) {
    try {
      if (!('mediaSession' in navigator)) return;

      const artists = track.ar
        ? track.ar.map((a) => a.name)
        : track.song?.artists?.map((a) => a.name);
      const album = track.al ? track.al.name : track.song?.album?.name;
      const artwork = ['96', '128', '192', '256', '384', '512', '1024'].map((size) => ({
        src: getImgUrl(track.picUrl, `${size}y${size}`),
        type: 'image/jpg',
        sizes: `${size}x${size}`
      }));

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.name || '',
        artist: artists ? artists.join(',') : '',
        album: album || '',
        artwork
      });
    } catch (error) {
      console.error('Error updating media session metadata:', error);
    }
  }

  private updateMediaSessionState(isPlaying: boolean) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    this.updateMediaSessionPositionState();
  }

  private updateMediaSessionPositionState() {
    try {
      if (!('mediaSession' in navigator)) return;
      if (!this.audio.duration || !isFinite(this.audio.duration)) return;

      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
          duration: this.audio.duration,
          playbackRate: this.playbackRate,
          position: this.audio.currentTime
        });
      }
    } catch (error) {
      console.error('Error updating media session position:', error);
    }
  }

  // ==================== Event Emitter ====================

  private emit(event: string, ...args: any[]) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      eventCallbacks.forEach((callback) => {
        try {
          Promise.resolve(callback(...args)).catch((error) =>
            console.error(`Audio event ${event} failed:`, error)
          );
        } catch (error) {
          console.error(`Audio event ${event} failed:`, error);
        }
      });
    }
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event: string, callback: Function) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      this.callbacks[event] = eventCallbacks.filter((cb) => cb !== callback);
    }
  }

  clearAllListeners() {
    this.callbacks = {};
  }

  // ==================== EQ & DSP ====================

  private setupEQ() {
    if (this.context && this.gainNode) return;

    const ctx = audioDspGraph.attach(this.audio, isElectron);
    if (!ctx) return;

    this.context = ctx;
    this.gainNode = audioDspGraph.getMasterGainNode();
    this.analyserNode = audioDspGraph.getAnalyserNode();

    this.applyVolume(this.volume);
    this.setupContextStateMonitoring();
    void this.restoreSavedAudioDevice();
  }

  public isEQEnabled(): boolean {
    return audioDspGraph.getState().eqEnabled;
  }

  public setEQEnabled(enabled: boolean) {
    audioDspGraph.setEqEnabled(enabled);
  }

  public setEQFrequencyGain(frequency: string, gain: number) {
    audioDspGraph.setBandGain(frequency, gain);
  }

  public resetEQ() {
    audioDspGraph.resetToFlat();
  }

  public getAllEQSettings(): { [key: string]: number } {
    return audioDspGraph.getLegacyEqMap();
  }

  public getCurrentPreset(): string | null {
    return localStorage.getItem('currentPreset');
  }

  public setCurrentPreset(preset: string): void {
    localStorage.setItem('currentPreset', preset);
  }

  public setPreservesPitch(enabled: boolean): AudioDspState {
    return audioDspGraph.setPreservesPitch(enabled);
  }

  public getPreservesPitch(): boolean {
    return audioDspGraph.getState().preservesPitch;
  }

  public setMono(enabled: boolean): AudioDspState {
    return audioDspGraph.setMono(enabled);
  }

  public isMonoEnabled(): boolean {
    return audioDspGraph.getState().mono;
  }

  public setPreampDb(db: number): AudioDspState {
    return audioDspGraph.setPreampDb(db);
  }

  public getPreampDb(): number {
    return audioDspGraph.getState().preampDb;
  }

  public applyAutoEqText(text: string) {
    return audioDspGraph.applyAutoEqText(text);
  }

  public getDspState(): AudioDspState {
    return audioDspGraph.getState();
  }

  public setGaplessEnabled(enabled: boolean): void {
    this.gaplessEnabled = Boolean(enabled);
    if (!this.gaplessEnabled && this.standbyAudio) {
      try {
        this.standbyAudio.pause();
        this.standbyAudio.removeAttribute('src');
        this.standbyAudio.load();
      } catch {
        // ignore standby teardown errors
      }
      this.standbyTrackId = null;
      this.standbyUrl = null;
    }
    try {
      localStorage.setItem('gaplessPlaybackEnabled', JSON.stringify(this.gaplessEnabled));
    } catch {
      // ignore storage errors
    }
  }

  public isGaplessEnabled(): boolean {
    return this.gaplessEnabled;
  }

  /**
   * Warm the next track in a silent standby audio element (without creating a second
   * MediaElementSource or claiming mediaCoordinator focus) so track transitions start seamlessly.
   */
  public prepareGaplessNext(nextUrl?: string, nextTrack?: SongResult): void {
    if (!this.gaplessEnabled || !nextUrl || !nextTrack || typeof Audio === 'undefined') {
      return;
    }
    const playable = toPlayableMediaUrl(nextUrl);
    if (!playable) return;
    const nextId = String(nextTrack.id ?? (nextTrack as any).localPath ?? playable);
    if (this.standbyUrl === playable && this.standbyTrackId === nextId && this.standbyAudio) {
      return;
    }

    try {
      if (!this.standbyAudio) {
        this.standbyAudio = new Audio();
        this.standbyAudio.crossOrigin = 'anonymous';
        this.standbyAudio.preload = 'auto';
        this.standbyAudio.volume = 0;
        this.standbyAudio.muted = true;
      }
      this.standbyAudio.src = playable;
      this.standbyAudio.load();
      this.standbyUrl = playable;
      this.standbyTrackId = nextId;
      this.lastGaplessWarmKey = null;
    } catch {
      // ignore standby pre-buffer failure on restricted platforms
    }
  }

  public getSignalPathInfo(): AudioSignalPathInfo {
    const track = this.currentTrack as any;
    const url = this.audio?.currentSrc || this.audio?.src || track?.playMusicUrl || '';
    const isLocal =
      Boolean(track?.localPath) ||
      String(track?.playMusicUrl || '').startsWith('local://') ||
      String(url).includes('/local-media');
    const isYouTube =
      String(track?.source || '').toLowerCase() === 'youtube' ||
      String(url).includes('googlevideo.com');
    const sourceKind = isLocal
      ? 'Local File'
      : isYouTube
        ? 'YouTube Stream'
        : track
          ? 'Cloud Stream'
          : 'Idle';

    const codecRaw = track?.codec || track?.meta?.codec || '';
    const bitrateRaw = track?.bitrate || track?.meta?.bitrate;
    const extMatch = String(track?.localPath || url).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
    const extLabel = extMatch ? extMatch[1].toUpperCase() : '';
    const codecParts: string[] = [];
    if (codecRaw) {
      codecParts.push(String(codecRaw).toUpperCase());
    } else if (extLabel) {
      codecParts.push(extLabel);
    }
    if (Number.isFinite(Number(bitrateRaw)) && Number(bitrateRaw) > 0) {
      codecParts.push(`${Math.round(Number(bitrateRaw))} kbps`);
    }
    const codecLabel = codecParts.join(' | ') || (isYouTube ? 'OPUS / AAC' : 'PCM / Stream');

    return audioDspGraph.getSignalPathInfo({
      playbackRate: this.playbackRate,
      replayGainEnabled: this.replayGainEnabled,
      gaplessEnabled: this.gaplessEnabled,
      sourceKind,
      codecLabel
    });
  }

  // ==================== Operation Lock ====================

  private setOperationLock(): boolean {
    if (this.operationLock) {
      return false;
    }
    this.operationLock = true;

    if (this.operationLockTimer) clearTimeout(this.operationLockTimer);
    this.operationLockTimer = setTimeout(() => {
      console.warn('Operation lock released after timeout');
      this.releaseOperationLock();
    }, 5000);

    return true;
  }

  public releaseOperationLock(): void {
    this.operationLock = false;
    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }
  }

  public forceResetOperationLock(): void {
    this.operationLock = false;
    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }
  }

  // ==================== Playback Control ====================

  public isPaused(): boolean {
    return this.audio?.paused ?? true;
  }

  public getDuration(): number {
    return this.audio?.duration || 0;
  }

  public play(
    url?: string,
    track?: SongResult,
    isPlay: boolean = true,
    seekTime?: number,
    _existingSound?: HTMLAudioElement
  ): Promise<HTMLAudioElement> {
    // Local files are served over loopback HTTP: Chromium's media layer rejects
    // custom schemes ("Media load rejected by URL safety check") and cannot seek
    // them. Stored URLs stay local:// so local-track detection keeps working.
    url = toPlayableMediaUrl(url);
    if (!url || !track) {
      if (this.audio.src) {
        if (seekTime !== undefined) {
          this.seek(seekTime);
        }
        // A pending fade-out pause scheduled by pause(true) must be cancelled
        // here, otherwise it fires ~200ms after this resume and silently stops
        // the audio again (the classic "button shows playing but it paused").
        this.cancelFadeTimer();
        try {
          mediaCoordinator.claimPlayback('audioService', this.audio);
        } catch {
          // ignore
        }
        return this.audio.play().then(() => {
          this.fadeInVolume(PLAY_PAUSE_FADE_DURATION);
          return this.audio;
        });
      }
      return Promise.reject(new Error('Missing required parameters: url and track'));
    }

    const currentSrc = this.audio.src;
    const isSameUrl =
      currentSrc && currentSrc === url && !this.pendingLoadCleanup && !this.audio.error;

    this.pendingLoadCleanup?.();
    this.forceResetOperationLock();
    this.setOperationLock();

    return new Promise<HTMLAudioElement>((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 1;
      let settled = false;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let loadTimer: ReturnType<typeof setTimeout> | null = null;
      let removeListeners = () => {};

      const cleanup = () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (loadTimer) {
          clearTimeout(loadTimer);
          loadTimer = null;
        }
        removeListeners();
        if (this.pendingLoadCleanup === cancelLoad) {
          this.pendingLoadCleanup = null;
        }
      };

      const failLoad = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        this._isLoading = false;
        this.releaseOperationLock();
        reject(error);
      };

      const cancelLoad = () => failLoad(new DOMException('Playback cancelled', 'AbortError'));
      this.pendingLoadCleanup = cancelLoad;

      const startAudio = async () => {
        if (settled) return;
        removeListeners();
        try {
          this._isLoading = false;
          this.cancelFadeTimer();
          this.crossfadeActive = false;
          this.audio.playbackRate = this.playbackRate;
          if (seekTime !== undefined) {
            this.seek(seekTime);
          }

          if (isPlay && this.context?.state === 'suspended') {
            await this.context.resume();
          }
          if (settled) return;
          if (isPlay) {
            try {
              mediaCoordinator.claimPlayback('audioService', this.audio);
            } catch {
              // safe fallback
            }
            await this.audio.play();
            this.fadeInVolume(PLAY_PAUSE_FADE_DURATION);
          } else {
            this.applyVolume(this.volume);
            this.audio.pause();
          }
          if (settled) return;

          settled = true;
          cleanup();
          this.updateMediaSessionMetadata(track);
          this.updateMediaSessionPositionState();
          this.emit('load');
          this.releaseOperationLock();
          resolve(this.audio);
        } catch (error) {
          if (settled) return;
          this.emit('playerror', { track, error });
          failLoad(error as Error);
        }
      };

      const tryPlay = () => {
        if (settled) return;
        this._isLoading = true;
        this.currentTrack = track;
        this.currentTrackListenedSec = 0;
        this.currentTrackScrobbled = false;
        this.lastStatsTickTime = 0;
        this.setupEQ();
        loadTimer = setTimeout(() => failLoad(new Error('Audio loading timed out')), 20000);
        const onError = () => {
          if (settled) return;
          removeListeners();
          if (loadTimer) clearTimeout(loadTimer);
          loadTimer = null;
          this._isLoading = false;
          const error = this.audio.error;
          console.error('Audio load error:', error?.code, error?.message);
          this.emit('loaderror', { track, error });

          const isSrcNotSupported = error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;

          if (!isSrcNotSupported && retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying playback (${retryCount}/${maxRetries})...`);
            retryTimer = setTimeout(() => {
              retryTimer = null;
              tryPlay();
            }, 1000 * retryCount);
          } else {
            failLoad(new Error('Audio failed to load. Try another track.'));
          }
        };

        removeListeners = () => {
          this.audio.removeEventListener('canplay', startAudio);
          this.audio.removeEventListener('error', onError);
        };

        if (isSameUrl) {
          void startAudio();
          return;
        }

        this.audio.addEventListener('canplay', startAudio, { once: true });
        this.audio.addEventListener('error', onError, { once: true });

        // Change source and load
        try {
          this.audio.src = url;
          this.audio.load();
        } catch (error) {
          failLoad(error as Error);
        }
      };

      tryPlay();
    });
  }

  private cancelFadeTimer() {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  /**
   * Compute effective target volume including ReplayGain loudness normalization if enabled.
   */
  private getEffectiveVolume(baseVolume: number = this.volume): number {
    const clamped = Math.max(0, Math.min(1, baseVolume));
    if (!this.replayGainEnabled || !this.currentTrack) {
      return clamped;
    }
    const rawGain =
      (this.currentTrack as any)?.gain ??
      (this.currentTrack as any)?.song?.bMusic?.volumeDelta ??
      0;
    const gainDb = Number(rawGain);
    if (!Number.isFinite(gainDb) || gainDb === 0) {
      return clamped;
    }
    // Convert dB to linear multiplier clamped to [0.35, 1.5]
    const multiplier = Math.max(0.35, Math.min(1.5, Math.pow(10, gainDb / 20)));
    return Math.max(0, Math.min(1, clamped * multiplier));
  }

  /**
   * Smoothly ramp volume from 0 to target volume over durationMs (default PLAY_PAUSE_FADE_DURATION = 200ms).
   */
  public fadeInVolume(durationMs: number = PLAY_PAUSE_FADE_DURATION) {
    this.cancelFadeTimer();
    const targetVolume = this.getEffectiveVolume(this.volume);
    if (!this.smoothFadeEnabled || durationMs <= 0 || targetVolume <= 0) {
      this.applyVolume(this.volume);
      return;
    }

    if (this.gainNode && this.context) {
      const now = this.context.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(targetVolume, now + durationMs / 1000);
    } else if (typeof this.audio.volume === 'number') {
      const steps = 10;
      const stepTime = Math.max(10, Math.floor(durationMs / steps));
      let currentStep = 0;
      this.audio.volume = 0;
      this.fadeInterval = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          this.audio.volume = targetVolume;
          this.cancelFadeTimer();
        } else {
          this.audio.volume = targetVolume * (currentStep / steps);
        }
      }, stepTime);
    }
  }

  /**
   * Pause playback with a smooth 200ms linear gain ramp-down to eliminate abrupt audio cuts and pops.
   */
  public pause(withFade: boolean = true) {
    this.pendingLoadCleanup?.();
    this.forceResetOperationLock();
    this._isLoading = false;
    this.cancelFadeTimer();

    try {
      // If audio is already paused, ended, or immediate pause is requested, pause right away
      if (!withFade || !this.smoothFadeEnabled || this.audio.paused || this.audio.ended) {
        this.audio.pause();
        return;
      }

      const durationMs = PLAY_PAUSE_FADE_DURATION;
      if (this.gainNode && this.context) {
        const now = this.context.currentTime;
        const currentGain = this.gainNode.gain.value;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(currentGain, now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
      } else if (typeof this.audio.volume === 'number') {
        const startVol = this.audio.volume;
        const steps = 10;
        const stepTime = Math.max(10, Math.floor(durationMs / steps));
        let currentStep = 0;
        this.fadeInterval = setInterval(() => {
          currentStep++;
          if (currentStep >= steps) {
            this.audio.volume = 0;
            if (this.fadeInterval) {
              clearInterval(this.fadeInterval);
              this.fadeInterval = null;
            }
          } else {
            this.audio.volume = Math.max(0, startVol * (1 - currentStep / steps));
          }
        }, stepTime);
      }

      this.fadeTimer = setTimeout(() => {
        this.fadeTimer = null;
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        try {
          this.audio.pause();
          this.applyVolume(this.volume);
        } catch (err) {
          console.error('Failed to pause audio:', err);
        }
      }, durationMs);
    } catch (error) {
      console.error('Failed to pause audio:', error);
    }
  }

  public stop() {
    this.cancelFadeTimer();
    this.crossfadeActive = false;
    this.forceResetOperationLock();
    if (this.currentTrack && this.audio?.currentTime > 0) {
      try {
        const key = getSongKey(this.currentTrack);
        if (key) void savePosition(key, this.audio.currentTime);
      } catch {
        // ignore
      }
    }
    if (this.pendingLoadCleanup) {
      this.pendingLoadCleanup();
      this.pendingLoadCleanup = null;
    }
    this._isLoading = false;
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load(); // Reset the element
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
    this.currentTrack = null;
    this.currentTrackListenedSec = 0;
    this.currentTrackScrobbled = false;
    this.lastStatsTickTime = 0;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }

  private pendingSeekTime: number | null = null;

  public seek(time: number) {
    if (!Number.isFinite(time) || !this.audio.src) return;
    this.forceResetOperationLock();
    try {
      const duration = this.audio.duration;
      const target = Math.max(
        0,
        Number.isFinite(duration) && duration > 0 ? Math.min(time, duration) : time
      );

      // A seek issued before metadata exists is silently ignored by the media
      // element, which is why jumping right after a track starts did nothing.
      // Remember it and apply it once the duration is known.
      if (this.audio.readyState === 0) {
        this.pendingSeekTime = target;
        this.emit('seek_start', target);
        this.audio.addEventListener(
          'loadedmetadata',
          () => {
            const pending = this.pendingSeekTime;
            this.pendingSeekTime = null;
            if (pending === null) return;
            try {
              this.audio.currentTime = pending;
              this.emit('seek_start', pending);
            } catch {
              // ignore
            }
          },
          { once: true }
        );
        return;
      }

      this.audio.currentTime = target;
      this.emit('seek_start', target);
      this.updateMediaSessionPositionState();
    } catch (error) {
      console.error('Seek failed:', error);
    }
  }

  public setVolume(volume: number) {
    this.applyVolume(volume);
  }

  private applyVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    this.volume = normalizedVolume;
    const effectiveVolume = this.getEffectiveVolume(normalizedVolume);

    if (this.gainNode && this.context) {
      audioDspGraph.applyMasterVolume(effectiveVolume);
    } else {
      // Fallback: direct volume (no Web Audio context)
      this.audio.volume = effectiveVolume;
    }

    try {
      localStorage.setItem('volume', normalizedVolume.toString());
    } catch (error) {
      console.warn('Failed to save volume:', error);
    }
  }

  // ==================== Smart Transitions & Waveform Analyser ====================

  private handleSmartTransitionTick() {
    if (this.audio.paused || !Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return;
    }

    const currentTime = this.audio.currentTime;
    const duration = this.audio.duration;
    const remaining = duration - currentTime;

    // 0. A-B Loop Repeat
    if (
      this.abLoop.enabled &&
      this.abLoop.pointA !== null &&
      this.abLoop.pointB !== null &&
      this.abLoop.pointB > this.abLoop.pointA &&
      currentTime >= this.abLoop.pointB
    ) {
      this.seek(this.abLoop.pointA);
      return;
    }

    // 1. Equal-Power Crossfade envelope at track end
    if (
      this.crossfadeEnabled &&
      this.crossfadeDuration > 0 &&
      duration > this.crossfadeDuration * 2 &&
      remaining <= this.crossfadeDuration &&
      remaining > 0.05
    ) {
      const progress = Math.min(
        1,
        Math.max(0, (this.crossfadeDuration - remaining) / this.crossfadeDuration)
      );
      // Equal-power cosine fade-out curve: cos(progress * pi / 2)
      const equalPowerGain =
        Math.cos(progress * 0.5 * Math.PI) * this.getEffectiveVolume(this.volume);
      if (this.gainNode && this.context) {
        this.gainNode.gain.setValueAtTime(equalPowerGain, this.context.currentTime);
      } else if (typeof this.audio.volume === 'number') {
        this.audio.volume = Math.max(0, Math.min(1, equalPowerGain));
      }
      this.crossfadeActive = true;
    } else if (this.crossfadeActive && remaining > this.crossfadeDuration) {
      this.crossfadeActive = false;
      this.applyVolume(this.volume);
    }

    // 2. Skip Silence (< -50 dBFS in intro/outro)
    if (this.skipSilenceEnabled && this.analyserNode) {
      const db = this.getRmsDb();
      if (db < -50) {
        if (currentTime > 0.3 && currentTime < 4.0) {
          this.seek(Math.min(duration - 1, currentTime + 0.5));
        } else if (duration > 15 && remaining < 5.0 && remaining > 0.4) {
          this.seek(duration - 0.1);
        }
      }
    }

    // 3. Gapless warm check in final 5s
    if (
      this.gaplessEnabled &&
      remaining <= 5 &&
      this.standbyAudio &&
      this.standbyUrl &&
      this.lastGaplessWarmKey !== this.standbyUrl
    ) {
      this.lastGaplessWarmKey = this.standbyUrl;
      if (this.standbyAudio.readyState < 2) {
        try {
          this.standbyAudio.load();
        } catch {
          // ignore warm retry failures
        }
      }
    }
  }

  private handleListeningStatsTick() {
    if (this.audio.paused || !this.currentTrack) return;
    const now = Date.now();
    if (!this.lastStatsTickTime) {
      this.lastStatsTickTime = now;
      return;
    }
    const elapsedMs = now - this.lastStatsTickTime;
    if (elapsedMs >= 1000) {
      const deltaSec = elapsedMs / 1000;
      this.lastStatsTickTime = now;
      if (deltaSec > 0 && deltaSec < 10) {
        addListeningSeconds(this.currentTrack, deltaSec);
        this.currentTrackListenedSec += deltaSec;
        if (!this.currentTrackScrobbled) {
          const durationSec = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
          if (shouldRecordPlayThreshold(this.currentTrackListenedSec, durationSec)) {
            this.currentTrackScrobbled = true;
            try {
              recordTrackPlay(this.currentTrack);
            } catch {
              // ignore scrobble storage errors
            }
          }
        }
      }
    }
  }

  public getRmsDb(): number {
    if (!this.analyserNode) return 0;
    const buffer = new Uint8Array(this.analyserNode.fftSize);
    this.analyserNode.getByteTimeDomainData(buffer);
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const normalized = (buffer[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);
    if (rms <= 0.00001) return -100;
    return 20 * Math.log10(rms);
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  public setSmartCrossfade(enabled: boolean, durationSec?: number) {
    this.crossfadeEnabled = enabled;
    if (typeof durationSec === 'number' && durationSec >= 1 && durationSec <= 10) {
      this.crossfadeDuration = durationSec;
    }
    try {
      localStorage.setItem('smartCrossfadeEnabled', JSON.stringify(this.crossfadeEnabled));
      localStorage.setItem('smartCrossfadeDuration', String(this.crossfadeDuration));
    } catch {
      // ignore
    }
  }

  public getSmartCrossfade(): { enabled: boolean; duration: number } {
    return { enabled: this.crossfadeEnabled, duration: this.crossfadeDuration };
  }

  public setSkipSilence(enabled: boolean) {
    this.skipSilenceEnabled = enabled;
    try {
      localStorage.setItem('skipSilenceEnabled', JSON.stringify(enabled));
    } catch {
      // ignore
    }
  }

  public isSkipSilenceEnabled(): boolean {
    return this.skipSilenceEnabled;
  }

  public setReplayGainEnabled(enabled: boolean) {
    this.replayGainEnabled = enabled;
    this.applyVolume(this.volume);
    try {
      localStorage.setItem('replayGainEnabled', JSON.stringify(enabled));
    } catch {
      // ignore
    }
  }

  public isReplayGainEnabled(): boolean {
    return this.replayGainEnabled;
  }

  public setSmoothFadeEnabled(enabled: boolean) {
    this.smoothFadeEnabled = enabled;
    try {
      localStorage.setItem('smoothFadeEnabled', JSON.stringify(enabled));
    } catch {
      // ignore
    }
  }

  public isSmoothFadeEnabled(): boolean {
    return this.smoothFadeEnabled;
  }

  public getSmartTransitionConfig() {
    return {
      smoothFadeEnabled: this.smoothFadeEnabled,
      crossfadeEnabled: this.crossfadeEnabled,
      crossfadeDuration: this.crossfadeDuration,
      skipSilenceEnabled: this.skipSilenceEnabled,
      replayGainEnabled: this.replayGainEnabled
    };
  }

  public setSmartTransitionConfig(config: {
    smoothFadeEnabled?: boolean;
    crossfadeEnabled?: boolean;
    crossfadeDuration?: number;
    skipSilenceEnabled?: boolean;
    replayGainEnabled?: boolean;
  }) {
    if (typeof config.smoothFadeEnabled === 'boolean') {
      this.setSmoothFadeEnabled(config.smoothFadeEnabled);
    }
    if (typeof config.crossfadeEnabled === 'boolean') {
      this.setSmartCrossfade(config.crossfadeEnabled, config.crossfadeDuration);
    } else if (typeof config.crossfadeDuration === 'number') {
      this.setSmartCrossfade(this.crossfadeEnabled, config.crossfadeDuration);
    }
    if (typeof config.skipSilenceEnabled === 'boolean') {
      this.setSkipSilence(config.skipSilenceEnabled);
    }
    if (typeof config.replayGainEnabled === 'boolean') {
      this.setReplayGainEnabled(config.replayGainEnabled);
    }
    return this.getSmartTransitionConfig();
  }

  public getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  // ==================== A-B Loop Repeat & Bookmarks ====================

  public setAbLoopPointA(timeSec?: number) {
    const t = typeof timeSec === 'number' ? Math.max(0, timeSec) : this.getCurrentTime();
    this.abLoop.pointA = t;
    if (this.abLoop.pointB !== null && this.abLoop.pointB <= t) {
      this.abLoop.pointB = null;
      this.abLoop.enabled = false;
    }
    this.emit('markers_changed');
    return this.getAbLoop();
  }

  public setAbLoopPointB(timeSec?: number) {
    const t = typeof timeSec === 'number' ? Math.max(0, timeSec) : this.getCurrentTime();
    if (this.abLoop.pointA === null) {
      this.abLoop.pointA = 0;
    }
    if (t > this.abLoop.pointA) {
      this.abLoop.pointB = t;
      this.abLoop.enabled = true;
    }
    this.emit('markers_changed');
    return this.getAbLoop();
  }

  public clearAbLoop() {
    this.abLoop = { enabled: false, pointA: null, pointB: null };
    this.emit('markers_changed');
    return this.getAbLoop();
  }

  public getAbLoop() {
    return { ...this.abLoop };
  }

  public getBookmarks(
    trackId: string | number
  ): Array<{ id: string; time: number; label: string }> {
    if (!trackId) return [];
    try {
      const raw = JSON.parse(localStorage.getItem('music_manager_bookmarks_v1') || '{}');
      return Array.isArray(raw[String(trackId)]) ? raw[String(trackId)] : [];
    } catch {
      return [];
    }
  }

  public addBookmark(
    trackId: string | number,
    timeSec?: number,
    label?: string
  ): Array<{ id: string; time: number; label: string }> {
    if (!trackId) return [];
    const time = typeof timeSec === 'number' ? Math.max(0, timeSec) : this.getCurrentTime();
    try {
      const raw = JSON.parse(localStorage.getItem('music_manager_bookmarks_v1') || '{}');
      const key = String(trackId);
      const list: Array<{ id: string; time: number; label: string }> = Array.isArray(raw[key])
        ? raw[key]
        : [];
      list.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time: Math.round(time * 100) / 100,
        label:
          label?.trim() ||
          `Bookmark @ ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
      });
      list.sort((a, b) => a.time - b.time);
      raw[key] = list;
      localStorage.setItem('music_manager_bookmarks_v1', JSON.stringify(raw));
      this.emit('markers_changed');
      return list;
    } catch {
      return [];
    }
  }

  public removeBookmark(
    trackId: string | number,
    bookmarkId: string
  ): Array<{ id: string; time: number; label: string }> {
    if (!trackId) return [];
    try {
      const raw = JSON.parse(localStorage.getItem('music_manager_bookmarks_v1') || '{}');
      const key = String(trackId);
      const list: Array<{ id: string; time: number; label: string }> = Array.isArray(raw[key])
        ? raw[key].filter((b: any) => b.id !== bookmarkId)
        : [];
      raw[key] = list;
      localStorage.setItem('music_manager_bookmarks_v1', JSON.stringify(raw));
      this.emit('markers_changed');
      return list;
    } catch {
      return [];
    }
  }

  public setPlaybackRate(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) return;
    this.playbackRate = rate;
    this.audio.playbackRate = rate;
    this.updateMediaSessionPositionState();
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  // ==================== State Queries ====================

  getCurrentSound(): HTMLAudioElement | null {
    return this.audio.src ? this.audio : null;
  }

  getCurrentTrack(): SongResult | null {
    return this.currentTrack;
  }

  isLoading(): boolean {
    return this._isLoading || this.operationLock;
  }

  isActuallyPlaying(): boolean {
    if (!this.audio.src) return false;
    try {
      const isPlaying = !this.audio.paused && !this.audio.ended;
      const contextOk = !this.context || this.context.state === 'running';
      return isPlaying && !this._isLoading && contextOk;
    } catch (error) {
      console.error('Error checking playback state:', error);
      return false;
    }
  }

  // ==================== Audio Output Devices ====================

  public async getAudioOutputDevices(): Promise<AudioOutputDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      return audioOutputs.map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Speaker ${index + 1}`,
        isDefault: device.deviceId === 'default' || device.deviceId === ''
      }));
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      return [{ deviceId: 'default', label: 'Default', isDefault: true }];
    }
  }

  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    const ok = await audioDspGraph.setOutputDevice(deviceId);
    if (ok) {
      this.currentSinkId = audioDspGraph.getState().outputDeviceId;
      console.log('Audio output device switched:', this.currentSinkId);
    }
    return ok;
  }

  public getCurrentSinkId(): string {
    return audioDspGraph.getState().outputDeviceId || this.currentSinkId;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  private async restoreSavedAudioDevice(): Promise<void> {
    const savedDeviceId = localStorage.getItem('audioOutputDeviceId');
    if (savedDeviceId && savedDeviceId !== 'default') {
      try {
        await this.setAudioOutputDevice(savedDeviceId);
      } catch (error) {
        console.warn('Failed to restore audio output device, falling back to default:', error);
        localStorage.removeItem('audioOutputDeviceId');
        this.currentSinkId = 'default';
      }
    }
  }

  private setupContextStateMonitoring() {
    if (!this.context) return;

    this.context.addEventListener('statechange', async () => {
      console.log('AudioContext state changed:', this.context?.state);

      if (this.context?.state === 'suspended' && !this.audio.paused) {
        console.log('AudioContext suspended while playing, attempting to resume...');
        try {
          await this.context.resume();
          console.log('AudioContext resumed successfully');
        } catch (e) {
          console.error('Failed to resume AudioContext:', e);
          this.emit('audio_error', { type: 'context_suspended', error: e });
        }
      } else if (this.context?.state === 'closed') {
        console.warn('AudioContext was closed unexpectedly');
        this.emit('audio_error', { type: 'context_closed' });
      }
    });
  }
}

export const audioService = new AudioService();
registerCurrentTrackProvider(() => audioService.getCurrentTrack());
