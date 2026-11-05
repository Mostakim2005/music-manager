import { electronAPI } from '@electron-toolkit/preload';
import type { IpcRendererEvent } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';

import type { AppUpdateState } from '../shared/appUpdate';

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
  dragStart: (data) => ipcRenderer.send('drag-start', data),
  miniTray: () => ipcRenderer.send('mini-tray'),
  miniWindow: () => ipcRenderer.send('mini-window'),
  restore: () => ipcRenderer.send('restore-window'),
  restart: () => ipcRenderer.send('restart'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  resizeMiniWindow: (showPlaylist) => ipcRenderer.send('resize-mini-window', showPlaylist),
  openLyric: () => ipcRenderer.send('open-lyric'),
  sendLyric: (data) => ipcRenderer.send('send-lyric', data),
  sendSong: (data) => ipcRenderer.send('update-current-song', data),
  unblockMusic: () => Promise.resolve(null),
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
    const validChannels = [
      'get-lyrics',
      'clear-lyrics-cache',
      'get-system-fonts',
      'get-cached-lyric',
      'cache-lyric',
      'clear-lyric-cache',
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
      'local-music:update-tags-and-file',
      'local-music:save-synced-lyrics',
      'local-music:select-cover-file',
      'library:export-m3u8',
      'library:import-m3u8',
      'library:export-backup-json',
      'library:import-backup-json',
      'select-directory',
      'save-lyric-file'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  getSearchSuggestions: (keyword: string) => ipcRenderer.invoke('get-search-suggestions', keyword),

  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) =>
    ipcRenderer.invoke('lx-music-http-request', request),

  lxMusicHttpCancel: (requestId: string) => ipcRenderer.invoke('lx-music-http-cancel', requestId),

  scanLocalMusic: (folderPath: string) => ipcRenderer.invoke('scan-local-music', folderPath),
  scanLocalMusicWithStats: (folderPath: string) =>
    ipcRenderer.invoke('scan-local-music-with-stats', folderPath),
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

const ipc = {
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    const wrappedListener = (_event: IpcRendererEvent, ...args: any[]) => listener(...args);
    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    contextBridge.exposeInMainWorld('youtube', youtube);
    contextBridge.exposeInMainWorld('ipcRenderer', ipc);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
  // @ts-ignore (define in dts)
  window.youtube = youtube;
  // @ts-ignore (define in dts)
  window.ipcRenderer = ipc;
}
