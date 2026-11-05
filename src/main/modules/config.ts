import { app, ipcMain } from 'electron';
import Store from 'electron-store';
import * as path from 'path';

import { createDefaultShortcuts, type ShortcutsConfig } from '../../shared/shortcuts';
import set from '../set.json';

type SetConfig = {
  isProxy: boolean;
  proxyConfig: {
    enable: boolean;
    protocol: string;
    host: string;
    port: number;
  };
  enableRealIP: boolean;
  realIP: string;
  noAnimate: boolean;
  animationSpeed: number;
  author: string;
  authorUrl: string;
  closeAction: 'ask' | 'minimize' | 'close';
  musicQuality: string;
  fontFamily: string;
  fontScope: 'global' | 'lyric';
  language: string;
  showTopAction: boolean;
  enableGpuAcceleration: boolean;
  downloadPath: string;
  enableDiskCache: boolean;
  diskCacheDir: string;
  diskCacheMaxSizeMB: number;
  diskCacheCleanupPolicy: 'lru' | 'fifo';
  musicSourcePlugins?: unknown[];
};
interface StoreType {
  set: SetConfig;
  shortcuts: ShortcutsConfig;
}

const store = new Store<StoreType>({
  name: 'config',
  defaults: {
    set: set as SetConfig,
    shortcuts: createDefaultShortcuts()
  }
});

let initialized = false;

/**
 */
export function initializeConfig() {
  if (initialized) {
    return store;
  }
  initialized = true;

  try {
    store.get('set.downloadPath') || store.set('set.downloadPath', app.getPath('downloads'));
    store.get('set.diskCacheDir') ||
      store.set('set.diskCacheDir', path.join(app.getPath('userData'), 'cache'));
    if (store.get('set.diskCacheMaxSizeMB') === undefined) {
      store.set('set.diskCacheMaxSizeMB', 4096);
    }
    if (!store.get('set.diskCacheCleanupPolicy')) {
      store.set('set.diskCacheCleanupPolicy', 'lru');
    }
    if (store.get('set.enableDiskCache') === undefined) {
      store.set('set.enableDiskCache', true);
    }
  } catch (error) {
    console.error('[config] Failed to initialize default config:', error);
  }

  ipcMain.on('set-store-value', (_, key, value) => {
    try {
      store.set(key, value);
    } catch (error) {
      console.error(`[config] Failed to write config, key=${key}:`, error);
    }
  });

  ipcMain.on('get-store-value', (event, key) => {
    try {
      const value = store.get(key);
      event.returnValue = value || '';
    } catch (error) {
      console.error(`[config] Failed to read config, key=${key}:`, error);
      event.returnValue = '';
    }
  });

  ipcMain.on('update-gpu-acceleration', (event, enabled: boolean) => {
    try {
      console.log('GPU setting updated: ', enabled);
      store.set('set.enableGpuAcceleration', enabled);

      event.sender.send('gpu-acceleration-updated', enabled);
      console.log('GPU setting saved, takes effect after restart');
    } catch (error) {
      console.error('Failed to update GPU setting:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      event.sender.send('gpu-acceleration-update-error', errorMessage);
    }
  });

  return store;
}

export function getStore() {
  return store;
}

/**
 */
export function getSharedStore(): Store<Record<string, unknown>> {
  return store as unknown as Store<Record<string, unknown>>;
}
