import type { IpcRendererEvent } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';

import type { AppUpdateState } from '../shared/appUpdate';

const VALID_INVOKE_CHANNELS = new Set<string>([
  'check-file-exists',
  'clear-disk-cache',
  'get-content-zoom',
  'get-disk-cache-config',
  'get-disk-cache-stats',
  'get-downloads-path',
  'get-local-ip-addresses',
  'get-remote-control-config',
  'get-system-fonts',
  'get-cached-lyric',
  'cache-lyric',
  'resolve-cached-music-url',
  'set-disk-cache-config',
  'shortcuts:get-config',
  'shortcuts:save',
  'switch-disk-cache-directory',
  'scan-local-music',
  'scan-local-music-with-stats',
  'parse-local-music-metadata',
  'error-reporter:get-reports',
  'error-reporter:report',
  'error-reporter:clear',
  'error-reporter:export',
  'error-reporter:test',
  'metadata:fetch-online',
  'lyrics:fetch-multi-source',
  'local-music:fingerprint',
  'local-music:waveform-peaks',
  'local-music:update-tags-and-file',
  'local-music:save-synced-lyrics',
  'local-music:select-cover-file',
  'library:delete-variant-file',
  'library:export-m3u8',
  'library:import-m3u8',
  'library:export-backup-json',
  'library:import-backup-json',
  'select-directory',
  'save-lyric-file',
  'get-search-suggestions',
  'lx-music-http-request',
  'lx-music-http-cancel',
  'import-custom-api-plugin',
  'import-lx-music-script',
  'import-music-source-plugin',
  'fetch-music-source-plugin',
  'app-update:get-state',
  'app-update:check',
  'app-update:download',
  'app-update:quit-and-install',
  'app-update:open-release-page',
  'is-window-maximized',
  'is-fullscreen',
  'download:add',
  'download:add-batch',
  'download:pause',
  'download:resume',
  'download:cancel',
  'download:cancel-all',
  'download:get-queue',
  'download:get-completed',
  'download:delete-completed',
  'download:clear-completed',
  'download:get-embedded-lyrics',
  'download:provide-url',
  'yt:search',
  'yt:formats',
  'yt:streamUrl',
  'yt:download',
  'yt:cancelDownload',
  'yt:readLink',
  'yt:writeLink',
  'yt:resolveDownloadDir',
  'yt:binaryStatus',
  'yt:updateBinary'
]);

const VALID_SEND_CHANNELS = new Set<string>([
  'minimize-window',
  'maximize-window',
  'toggle-fullscreen',
  'close-window',
  'quit-app',
  'mini-tray',
  'mini-window',
  'restore-window',
  'restart',
  'resize-window',
  'resize-mini-window',
  'open-lyric',
  'close-lyric',
  'send-lyric',
  'lyric-ready',
  'lyric-drag-start',
  'lyric-drag-move',
  'lyric-drag-end',
  'set-ignore-mouse',
  'set-lyric-lock-state',
  'control-back',
  'update-current-song',
  'update-play-state',
  'show-notification',
  'set-content-zoom',
  'update-remote-control-config',
  'open-directory',
  'download:set-concurrency',
  'media-play',
  'mpris-position-update',
  'tray-lyric-update',
  'disable-shortcuts',
  'enable-shortcuts',
  'set-store-value',
  'change-language',
  'update-discord-rpc-enabled',
  'update-discord-client-id',
  'update-gpu-acceleration',
  'clear-audio-cache'
]);

const VALID_SYNC_CHANNELS = new Set<string>([
  'local-media:base-url',
  'get-platform',
  'get-store-value'
]);

// Custom APIs for renderer
const api = {
  /** Base URL of the loopback media server used for local files ('' if unavailable). */
  localMediaBaseUrl: ipcRenderer.sendSync('local-media:base-url') as string,
  /** Computes an acoustic fingerprint for a local media file. */
  getAudioFingerprint: (filePath: string) =>
    ipcRenderer.invoke('local-music:fingerprint', filePath) as Promise<{
      fingerprint: string;
      durationSec: number;
      windows: number;
    } | null>,
  /** Computes normalized acoustic waveform peaks for a local media file. */
  getWaveformPeaks: (filePath: string, buckets = 140) =>
    ipcRenderer.invoke('local-music:waveform-peaks', filePath, buckets) as Promise<
      number[] | null
    >,
  /** Deletes a downloaded/local variant file from disk. */
  deleteVariantFile: (filePath: string) =>
    ipcRenderer.invoke('library:delete-variant-file', filePath) as Promise<{
      ok: boolean;
      deleted?: boolean;
      error?: string;
    }>,
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  isMaximized: () => ipcRenderer.invoke('is-window-maximized') as Promise<boolean>,
  onWindowMaximizedState: (callback: (maximized: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window-maximized-state', listener);
    return () => ipcRenderer.removeListener('window-maximized-state', listener);
  },
  toggleFullScreen: () => ipcRenderer.send('toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen') as Promise<boolean>,
  onWindowFullScreenState: (callback: (fullscreen: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, fullscreen: boolean) => callback(fullscreen);
    ipcRenderer.on('window-fullscreen-state', listener);
    return () => ipcRenderer.removeListener('window-fullscreen-state', listener);
  },
  close: () => ipcRenderer.send('close-window'),
  quitApp: () => ipcRenderer.send('quit-app'),
  miniTray: () => ipcRenderer.send('mini-tray'),
  miniWindow: () => ipcRenderer.send('mini-window'),
  restore: () => ipcRenderer.send('restore-window'),
  restart: () => ipcRenderer.send('restart'),
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.send('resize-window', width, height),
  resizeMiniWindow: (showPlaylist: boolean) =>
    ipcRenderer.send('resize-mini-window', showPlaylist),
  openLyric: () => ipcRenderer.send('open-lyric'),
  closeLyric: () => ipcRenderer.send('close-lyric'),
  sendLyric: (data: any) => ipcRenderer.send('send-lyric', data),
  sendSong: (data: any) => ipcRenderer.send('update-current-song', data),
  updatePlayState: (playing: boolean) => ipcRenderer.send('update-play-state', playing),
  mprisPositionUpdate: (currentTime: number) =>
    ipcRenderer.send('mpris-position-update', currentTime),
  trayLyricUpdate: (lrcObj: string) => ipcRenderer.send('tray-lyric-update', lrcObj),
  disableShortcuts: () => ipcRenderer.send('disable-shortcuts'),
  enableShortcuts: () => ipcRenderer.send('enable-shortcuts'),
  getPlatform: () => ipcRenderer.sendSync('get-platform') as string,
  getStoreValue: (key: string) => ipcRenderer.sendSync('get-store-value', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.send('set-store-value', key, value),
  changeLanguage: (locale: string) => ipcRenderer.send('change-language', locale),
  updateDiscordRpcEnabled: (enabled: boolean) =>
    ipcRenderer.send('update-discord-rpc-enabled', enabled),
  updateDiscordClientId: (clientId: string) =>
    ipcRenderer.send('update-discord-client-id', clientId),
  updateGpuAcceleration: (enabled: boolean) =>
    ipcRenderer.send('update-gpu-acceleration', enabled),
  clearAudioCache: () => ipcRenderer.send('clear-audio-cache'),
  setIgnoreMouse: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse', ignore),
  setLyricLockState: (locked: boolean) => ipcRenderer.send('set-lyric-lock-state', locked),
  lyricReady: () => ipcRenderer.send('lyric-ready'),
  lyricDragStart: () => ipcRenderer.send('lyric-drag-start'),
  lyricDragMove: (delta: { deltaX: number; deltaY: number }) =>
    ipcRenderer.send('lyric-drag-move', delta),
  lyricDragEnd: () => ipcRenderer.send('lyric-drag-end'),
  lyricControlBack: (command: string) => ipcRenderer.send('control-back', command),
  onReceiveLyric: (callback: (data: string) => void) => {
    const listener = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('receive-lyric', listener);
    return () => ipcRenderer.removeListener('receive-lyric', listener);
  },
  onLyricMousePresence: (callback: (isInside: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, isInside: boolean) => callback(isInside);
    ipcRenderer.on('lyric-mouse-presence', listener);
    return () => ipcRenderer.removeListener('lyric-mouse-presence', listener);
  },
  onLyricControlBack: (callback: (command: string) => void) => {
    const listener = (_event: IpcRendererEvent, command: string) => callback(command);
    ipcRenderer.on('lyric-control-back', listener);
    return () => ipcRenderer.removeListener('lyric-control-back', listener);
  },
  onMiniMode: (callback: (value: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, value: boolean) => callback(value);
    ipcRenderer.on('mini-mode', listener);
    return () => ipcRenderer.removeListener('mini-mode', listener);
  },
  onGpuAccelerationUpdated: (callback: (enabled: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on('gpu-acceleration-updated', listener);
    return () => ipcRenderer.removeListener('gpu-acceleration-updated', listener);
  },
  onGpuAccelerationUpdateError: (callback: (errorMessage: string) => void) => {
    const listener = (_event: IpcRendererEvent, errorMessage: string) => callback(errorMessage);
    ipcRenderer.on('gpu-acceleration-update-error', listener);
    return () => ipcRenderer.removeListener('gpu-acceleration-update-error', listener);
  },
  onErrorReportNew: (callback: (report: any) => void) => {
    const listener = (_event: IpcRendererEvent, report: any) => callback(report);
    ipcRenderer.on('error-report:new', listener);
    return () => ipcRenderer.removeListener('error-report:new', listener);
  },
  onIpcEvent: (channel: string, listener: (_event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  removeIpcListener: (
    channel: string,
    listener: (_event: IpcRendererEvent, ...args: any[]) => void
  ) => {
    ipcRenderer.removeListener(channel, listener);
  },
  removeAllIpcListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  showNotification: (payload: { title: string; body: string }) =>
    ipcRenderer.send('show-notification', payload),
  importCustomApiPlugin: () => ipcRenderer.invoke('import-custom-api-plugin'),
  importLxMusicScript: () => ipcRenderer.invoke('import-lx-music-script'),
  importMusicSourcePlugin: () => ipcRenderer.invoke('import-music-source-plugin'),
  fetchMusicSourcePlugin: (url: string) => ipcRenderer.invoke('fetch-music-source-plugin', url),
  onLyricWindowClosed: (callback: () => void) => {
    ipcRenderer.on('lyric-window-closed', () => callback());
  },
  onLyricWindowReady: (callback: () => void) => {
    ipcRenderer.on('lyric-window-ready', () => callback());
  },
  getAppUpdateState: () => ipcRenderer.invoke('app-update:get-state') as Promise<AppUpdateState>,
  checkAppUpdate: (manual = false) =>
    ipcRenderer.invoke('app-update:check', { manual }) as Promise<AppUpdateState>,
  downloadAppUpdate: () => ipcRenderer.invoke('app-update:download') as Promise<AppUpdateState>,
  installAppUpdate: () => ipcRenderer.invoke('app-update:quit-and-install') as Promise<boolean>,
  openAppUpdatePage: () => ipcRenderer.invoke('app-update:open-release-page') as Promise<boolean>,
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => {
    ipcRenderer.on('app-update:state', (_event, state: AppUpdateState) => callback(state));
  },
  removeAppUpdateListeners: () => {
    ipcRenderer.removeAllListeners('app-update:state');
  },
  onLanguageChanged: (callback: (locale: string) => void) => {
    ipcRenderer.on('language-changed', (_event, locale) => {
      callback(locale);
    });
  },
  reportError: (entry: any) => ipcRenderer.invoke('error-reporter:report', entry),
  invoke: (channel: string, ...args: any[]) => {
    if (VALID_INVOKE_CHANNELS.has(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  checkFileExists: (filePath: string) =>
    ipcRenderer.invoke('check-file-exists', filePath) as Promise<boolean>,
  clearDiskCache: (scope: string = 'all') =>
    ipcRenderer.invoke('clear-disk-cache', scope) as Promise<boolean>,
  getContentZoom: () => ipcRenderer.invoke('get-content-zoom') as Promise<number>,
  setContentZoom: (zoom: number) => ipcRenderer.send('set-content-zoom', zoom),
  getDiskCacheConfig: () => ipcRenderer.invoke('get-disk-cache-config'),
  setDiskCacheConfig: (config: any) => ipcRenderer.invoke('set-disk-cache-config', config),
  getDiskCacheStats: () => ipcRenderer.invoke('get-disk-cache-stats'),
  switchDiskCacheDirectory: (payload: any) =>
    ipcRenderer.invoke('switch-disk-cache-directory', payload),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path') as Promise<string>,
  getLocalIpAddresses: () => ipcRenderer.invoke('get-local-ip-addresses') as Promise<string[]>,
  getRemoteControlConfig: () => ipcRenderer.invoke('get-remote-control-config'),
  updateRemoteControlConfig: (config: any) =>
    ipcRenderer.send('update-remote-control-config', config),
  resolveCachedMusicUrl: (payload: any) =>
    ipcRenderer.invoke('resolve-cached-music-url', payload),
  getCachedLyric: (id: number | string) => ipcRenderer.invoke('get-cached-lyric', id),
  cacheLyric: (id: number | string, lyricData: any) =>
    ipcRenderer.invoke('cache-lyric', id, lyricData),
  getShortcutsConfig: () => ipcRenderer.invoke('shortcuts:get-config'),
  saveShortcutsConfig: (config: any) => ipcRenderer.invoke('shortcuts:save', config),
  openDirectory: (dirPath: string) => ipcRenderer.send('open-directory', dirPath),
  getSearchSuggestions: (keyword: string) => ipcRenderer.invoke('get-search-suggestions', keyword),

  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) =>
    ipcRenderer.invoke('lx-music-http-request', request),

  lxMusicHttpCancel: (requestId: string) => ipcRenderer.invoke('lx-music-http-cancel', requestId),

  scanLocalMusic: (folderPath: string) => ipcRenderer.invoke('scan-local-music', folderPath),
  scanLocalMusicWithStats: (folderPath: string, excludedFolders?: string[]) =>
    ipcRenderer.invoke('scan-local-music-with-stats', folderPath, excludedFolders),
  parseLocalMusicMetadata: (filePaths: string[]) =>
    ipcRenderer.invoke('parse-local-music-metadata', filePaths),
  fetchOnlineMetadata: (query: { title: string; artist?: string; album?: string }) =>
    ipcRenderer.invoke('metadata:fetch-online', query),
  fetchMultiSourceLyrics: (query: {
    title: string;
    artist?: string;
    album?: string;
    durationSec?: number;
  }) => ipcRenderer.invoke('lyrics:fetch-multi-source', query),
  updateLocalMusicTagsAndFile: (payload: any) =>
    ipcRenderer.invoke('local-music:update-tags-and-file', payload),
  saveSyncedLyrics: (params: { filePath: string; lyrics: string; saveSidecar?: boolean }) =>
    ipcRenderer.invoke('local-music:save-synced-lyrics', params),
  selectCoverFile: () => ipcRenderer.invoke('local-music:select-cover-file'),
  exportM3u8: (params: {
    tracks: Array<{ filePath: string; title?: string; artist?: string; duration?: number }>;
    defaultName?: string;
  }) => ipcRenderer.invoke('library:export-m3u8', params),
  importM3u8: () => ipcRenderer.invoke('library:import-m3u8'),
  exportBackupJson: (params: { payload: Record<string, any>; defaultName?: string }) =>
    ipcRenderer.invoke('library:export-backup-json', params),
  importBackupJson: () => ipcRenderer.invoke('library:import-backup-json'),

  // Download manager
  downloadAdd: (task: any) => ipcRenderer.invoke('download:add', task),
  downloadAddBatch: (tasks: any) => ipcRenderer.invoke('download:add-batch', tasks),
  downloadPause: (taskId: string) => ipcRenderer.invoke('download:pause', taskId),
  downloadResume: (taskId: string) => ipcRenderer.invoke('download:resume', taskId),
  downloadCancel: (taskId: string) => ipcRenderer.invoke('download:cancel', taskId),
  downloadCancelAll: () => ipcRenderer.invoke('download:cancel-all'),
  downloadGetQueue: () => ipcRenderer.invoke('download:get-queue'),
  downloadSetConcurrency: (n: number) => ipcRenderer.send('download:set-concurrency', n),
  downloadGetCompleted: () => ipcRenderer.invoke('download:get-completed'),
  downloadDeleteCompleted: (filePath: string) =>
    ipcRenderer.invoke('download:delete-completed', filePath),
  downloadClearCompleted: () => ipcRenderer.invoke('download:clear-completed'),
  getEmbeddedLyrics: (filePath: string) =>
    ipcRenderer.invoke('download:get-embedded-lyrics', filePath),
  downloadProvideUrl: (taskId: string, url: string) =>
    ipcRenderer.invoke('download:provide-url', { taskId, url }),
  onDownloadProgress: (cb: (data: any) => void) => {
    ipcRenderer.on('download:progress', (_event: any, data: any) => cb(data));
  },
  onDownloadStateChange: (cb: (data: any) => void) => {
    ipcRenderer.on('download:state-change', (_event: any, data: any) => cb(data));
  },
  onDownloadBatchComplete: (cb: (data: any) => void) => {
    ipcRenderer.on('download:batch-complete', (_event: any, data: any) => cb(data));
  },
  onDownloadRequestUrl: (cb: (data: any) => void) => {
    ipcRenderer.on('download:request-url', (_event: any, data: any) => cb(data));
  },
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners('download:progress');
    ipcRenderer.removeAllListeners('download:state-change');
    ipcRenderer.removeAllListeners('download:batch-complete');
    ipcRenderer.removeAllListeners('download:request-url');
  },
  sendMediaPlay: (data: any) => ipcRenderer.send('media-play', data),
  onMediaPauseAll: (callback: (data: any) => void) => {
    const listener = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('media-pause-all', listener);
    return () => ipcRenderer.removeListener('media-pause-all', listener);
  },
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveLyricFile: (params: { filename: string; lrcContent: string; targetDir?: string }) =>
    ipcRenderer.invoke('save-lyric-file', params)
};

const youtube = {
  search: (query: string, options?: { limit?: number; type?: 'video' | 'music' }) =>
    ipcRenderer.invoke('yt:search', query, options),
  formats: (idOrUrl: string) => ipcRenderer.invoke('yt:formats', idOrUrl),
  streamUrl: (idOrUrl: string, options?: { kind?: 'audio' | 'video'; height?: number }) =>
    ipcRenderer.invoke('yt:streamUrl', idOrUrl, options),
  download: (idOrUrl: string, options: any) => ipcRenderer.invoke('yt:download', idOrUrl, options),
  cancelDownload: (jobId: string) => ipcRenderer.invoke('yt:cancelDownload', jobId),
  readLink: (filePath: string) => ipcRenderer.invoke('yt:readLink', filePath),
  writeLink: (filePath: string, youtubeUrl: string) =>
    ipcRenderer.invoke('yt:writeLink', filePath, youtubeUrl),
  resolveDownloadDir: (contextFilePath?: string) =>
    ipcRenderer.invoke('yt:resolveDownloadDir', contextFilePath),
  binaryStatus: () => ipcRenderer.invoke('yt:binaryStatus'),
  updateBinary: () => ipcRenderer.invoke('yt:updateBinary'),
  onDownloadProgress: (callback: (progress: any) => void) => {
    const listener = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('yt:download-progress', listener);
    return () => ipcRenderer.removeListener('yt:download-progress', listener);
  }
};

// @ts-ignore
(api as any).youtube = youtube;

// Restricted allowlisted electron shim for legacy `isElectron` checks
const restrictedElectron = {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      if (VALID_SEND_CHANNELS.has(channel)) {
        ipcRenderer.send(channel, ...args);
      } else {
        throw new Error(`Unauthorized IPC send channel: ${channel}`);
      }
    },
    sendSync: (channel: string, ...args: any[]) => {
      if (VALID_SYNC_CHANNELS.has(channel)) {
        return ipcRenderer.sendSync(channel, ...args);
      }
      throw new Error(`Unauthorized IPC sendSync channel: ${channel}`);
    },
    invoke: (channel: string, ...args: any[]) => {
      return api.invoke(channel, ...args);
    },
    on: (channel: string, listener: (_event: IpcRendererEvent, ...args: any[]) => void) => {
      ipcRenderer.on(channel, listener);
      return () => {
        ipcRenderer.removeListener(channel, listener);
      };
    },
    removeListener: (
      channel: string,
      listener: (_event: IpcRendererEvent, ...args: any[]) => void
    ) => {
      ipcRenderer.removeListener(channel, listener);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', restrictedElectron);
    contextBridge.exposeInMainWorld('api', api);
    contextBridge.exposeInMainWorld('youtube', youtube);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = restrictedElectron;
  // @ts-ignore (define in dts)
  window.api = api;
  // @ts-ignore (define in dts)
  window.youtube = youtube;
}
