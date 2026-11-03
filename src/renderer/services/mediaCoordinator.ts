/**
 * Global Media Exclusivity Coordinator (A4)
 * Ensures only one media element (audio, video, MV, PiP, or across Electron windows)
 * plays at any given time.
 *
 * Uses:
 * 1. BroadcastChannel('music-manager-media') for same-origin window coordination
 * 2. Electron IPC (media-play / media-pause-all) for multi-window coordination
 * 3. Element registry and global DOM capture hooks on HTMLMediaElement 'play'
 */
import { ref } from 'vue';

export { getCurrentSongKey } from '@/services/songLibrary';

export interface RegisteredMedia {
  id: string;
  element?: HTMLMediaElement;
  pause: () => void;
  name?: string;
}

/** Reactive media session owner for Phase 2 UI / status displays */
export const currentMediaOwner = ref<string | null>(null);

/** Reactive reference to currently playing HTMLMediaElement */
export const activeMediaElement = ref<HTMLMediaElement | null>(null);

let audioServiceInstance: { pause: () => void } | null = null;

export function setAudioServiceInstance(service: { pause: () => void } | null): void {
  audioServiceInstance = service;
}

export function getMediaSessionOwner(): string | null {
  return currentMediaOwner.value;
}

export function setMediaSessionOwner(owner: string | null): void {
  currentMediaOwner.value = owner;
}

class MediaCoordinator {
  private registry = new Map<string, RegisteredMedia>();
  private broadcastChannel: BroadcastChannel | null = null;
  private isProcessingEvent = false;
  private channelName = 'music-manager-media';

  constructor() {
    this.initBroadcastChannel();
    this.initIPC();
    this.initGlobalDOMListener();
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(this.channelName);
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          const data = event.data;
          if (data && data.type === 'media_play' && data.ownerId) {
            this.handleRemotePlay(data.ownerId);
          }
        };
      } catch (err) {
        console.warn('[mediaCoordinator] BroadcastChannel not supported or failed:', err);
      }
    }
  }

  private initIPC() {
    if (typeof window !== 'undefined') {
      try {
        const electron = (window as any).electron;
        const api = (window as any).api;

        if (api?.onMediaPauseAll) {
          api.onMediaPauseAll((data: any) => {
            if (data?.ownerId) {
              this.handleRemotePlay(data.ownerId);
            }
          });
        } else if (electron?.ipcRenderer) {
          electron.ipcRenderer.on('media-pause-all', (_event: any, data: any) => {
            if (data?.ownerId) {
              this.handleRemotePlay(data.ownerId);
            }
          });
        }
      } catch (err) {
        console.warn('[mediaCoordinator] IPC listener setup failed:', err);
      }
    }
  }

  private initGlobalDOMListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener(
        'play',
        (event: Event) => {
          const target = event.target;
          if (target instanceof HTMLMediaElement) {
            const isRegistered = Array.from(this.registry.values()).some(
              (r) => r.element === target
            );
            if (!isRegistered) {
              const autoId = `unregistered-${Math.random().toString(36).slice(2, 8)}`;
              this.registerMediaElement(target, autoId);
              this.claimPlayback(autoId, target);
            }
          }
        },
        true
      );
    }
  }

  private handleRemotePlay(ownerId: string) {
    if (this.isProcessingEvent) return;
    this.isProcessingEvent = true;
    try {
      currentMediaOwner.value = ownerId;
      this.pauseAllLocal(ownerId);
    } finally {
      this.isProcessingEvent = false;
    }
  }

  /**
   * Pause all local registered elements and audioService
   */
  public pauseAllLocal(excludedOwnerId?: string): void {
    for (const [id, item] of this.registry.entries()) {
      if (id !== excludedOwnerId) {
        try {
          item.pause();
        } catch (e) {
          console.warn(`[mediaCoordinator] Failed to pause ${id}:`, e);
        }
      }
    }

    if (excludedOwnerId !== 'audioService') {
      try {
        if (audioServiceInstance && typeof audioServiceInstance.pause === 'function') {
          audioServiceInstance.pause();
        }
      } catch (e) {
        console.warn('[mediaCoordinator] Failed to pause audioService:', e);
      }
    }
  }

  /**
   * Register a media element with custom pause handler or element.pause()
   */
  public registerMediaElement(
    element: HTMLMediaElement,
    id: string,
    customPause?: () => void,
    name?: string
  ): () => void {
    const onPlay = () => {
      this.claimPlayback(id, element);
    };

    element.addEventListener('play', onPlay);

    this.registry.set(id, {
      id,
      element,
      name,
      pause: () => {
        if (customPause) {
          customPause();
        } else {
          try {
            element.pause();
          } catch (e) {
            console.warn(`[mediaCoordinator] Pause failed for ${id}:`, e);
          }
        }
      }
    });

    return () => {
      element.removeEventListener('play', onPlay);
      this.registry.delete(id);
      if (activeMediaElement.value === element) {
        activeMediaElement.value = null;
      }
      if (currentMediaOwner.value === id) {
        currentMediaOwner.value = null;
      }
    };
  }

  /**
   * Claim media playback for an owner ID, pausing all other local and remote media.
   */
  public claimPlayback(ownerId: string, triggeringElement?: HTMLMediaElement): void {
    if (this.isProcessingEvent) return;
    this.isProcessingEvent = true;

    try {
      currentMediaOwner.value = ownerId;
      if (triggeringElement) {
        activeMediaElement.value = triggeringElement;
      }

      // 1. Pause all other local registered media
      this.pauseAllLocal(ownerId);

      // 2. Broadcast via BroadcastChannel
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'media_play',
            ownerId,
            timestamp: Date.now()
          });
        } catch (err) {
          console.warn('[mediaCoordinator] BroadcastChannel error:', err);
        }
      }

      // 3. Broadcast via Electron IPC to other windows
      try {
        if (typeof window !== 'undefined') {
          const electron = (window as any).electron;
          const api = (window as any).api;
          if (api?.sendMediaPlay) {
            api.sendMediaPlay({ ownerId, timestamp: Date.now() });
          } else if (electron?.ipcRenderer) {
            electron.ipcRenderer.send('media-play', { ownerId, timestamp: Date.now() });
          }
        }
      } catch {
        // Safe ignore
      }
    } finally {
      this.isProcessingEvent = false;
    }
  }

  /**
   * Reset / clear coordinator state (primarily for unit testing)
   */
  public reset(): void {
    this.registry.clear();
    currentMediaOwner.value = null;
    activeMediaElement.value = null;
    this.isProcessingEvent = false;
  }
}

export const mediaCoordinator = new MediaCoordinator();
