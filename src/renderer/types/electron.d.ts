import type { LocalMusicMeta } from './localMusic';

export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  isMaximized: () => Promise<boolean>;
  onWindowMaximizedState: (_callback: (_maximized: boolean) => void) => () => void;
  toggleFullScreen: () => void;
  isFullScreen: () => Promise<boolean>;
  onWindowFullScreenState: (_callback: (_fullscreen: boolean) => void) => () => void;
  close: () => void;
  miniTray: () => void;
  restart: () => void;
  openLyric: () => void;
  sendLyric: (_data: string) => void;
  showNotification: (_payload: { title: string; body: string }) => void;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  importMusicSourcePlugin: () => Promise<{ name: string; content: string; path?: string } | null>;
  fetchMusicSourcePlugin: (_url: string) => Promise<{ name: string; content: string; url: string }>;
  onLyricWindowClosed: (_callback: () => void) => void;
  onLyricWindowReady: (_callback: () => void) => void;
  onLanguageChanged: (_callback: (_locale: string) => void) => void;
  store: {
    get: (_key: string) => Promise<any>;
    set: (_key: string, _value: any) => Promise<boolean>;
    delete: (_key: string) => Promise<boolean>;
  };
  scanLocalMusic: (_folderPath: string) => Promise<{ files: string[]; count: number }>;
  scanLocalMusicWithStats: (
    _folderPath: string
  ) => Promise<{ files: { path: string; modifiedTime: number }[]; count: number }>;
  parseLocalMusicMetadata: (_filePaths: string[]) => Promise<LocalMusicMeta[]>;
  checkFileExists: (_filePath: string) => Promise<boolean>;
  clearDiskCache: (_scope?: string) => Promise<boolean>;
  getContentZoom: () => Promise<number>;
  setContentZoom: (_zoom: number) => void;
  getDiskCacheConfig: () => Promise<any>;
  setDiskCacheConfig: (_config: any) => Promise<any>;
  getDiskCacheStats: () => Promise<any>;
  switchDiskCacheDirectory: (_payload: any) => Promise<any>;
  getDownloadsPath: () => Promise<string>;
  getLocalIpAddresses: () => Promise<string[]>;
  getRemoteControlConfig: () => Promise<any>;
  updateRemoteControlConfig: (_config: any) => void;
  resolveCachedMusicUrl: (_payload: any) => Promise<any>;
  getCachedLyric: (_id: number | string) => Promise<any>;
  cacheLyric: (_id: number | string, _lyricData: any) => Promise<any>;
  getShortcutsConfig: () => Promise<any>;
  saveShortcutsConfig: (_config: any) => Promise<any>;
  openDirectory: (_dirPath: string) => void;
  // Download manager
  downloadAdd: (_task: any) => Promise<string>;
  downloadAddBatch: (_tasks: any) => Promise<{ batchId: string; taskIds: string[] }>;
  downloadPause: (_taskId: string) => Promise<void>;
  downloadResume: (_taskId: string) => Promise<void>;
  downloadCancel: (_taskId: string) => Promise<void>;
  downloadCancelAll: () => Promise<void>;
  downloadGetQueue: () => Promise<any[]>;
  downloadSetConcurrency: (_n: number) => void;
  downloadGetCompleted: () => Promise<any[]>;
  downloadDeleteCompleted: (_filePath: string) => Promise<boolean>;
  downloadClearCompleted: () => Promise<boolean>;
  getEmbeddedLyrics: (_filePath: string) => Promise<string | null>;
  downloadProvideUrl: (_taskId: string, _url: string) => Promise<void>;
  onDownloadProgress: (_cb: (_data: any) => void) => void;
  onDownloadStateChange: (_cb: (_data: any) => void) => void;
  onDownloadBatchComplete: (_cb: (_data: any) => void) => void;
  onDownloadRequestUrl: (_cb: (_data: any) => void) => void;
  removeDownloadListeners: () => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
