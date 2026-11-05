import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, dialog, ipcMain, nativeImage, protocol, session } from 'electron';
import { join } from 'path';

const FILE_LOCK_ERROR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'EAGAIN', 'EMFILE', 'ENFILE']);
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error?.code && FILE_LOCK_ERROR_CODES.has(error.code) && typeof error.path === 'string') {
    console.error('[main] File is in use or locked, ignoring this read/write:', error.message);
    return;
  }
  console.error('[main] Uncaught exception:', error);
  try {
    recordErrorReport({
      source: 'main',
      severity: 'fatal',
      message: error?.message || String(error),
      stack: error?.stack,
      context: { code: error?.code }
    });
  } catch {
    // ignore
  }
  dialog.showErrorBox(
    'A JavaScript error occurred in the main process',
    error?.stack || String(error)
  );
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled promise rejection:', reason);
  try {
    const isErr = reason instanceof Error;
    recordErrorReport({
      source: 'main',
      severity: 'error',
      message: isErr ? reason.message : String(reason),
      stack: isErr ? reason.stack : undefined
    });
  } catch {
    // ignore
  }
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  },
  {
    scheme: 'pluginmedia',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);

import type { Language } from '../i18n/main';
import i18n from '../i18n/main';
import { loadLyricWindow } from './lyric';
import { initializeCacheManager } from './modules/cache';
import { initializeConfig } from './modules/config';
import {
  initializeDiscordRpc,
  updateDiscordPlayState,
  updateDiscordSong
} from './modules/discordRpc';
import { initializeDownloadManager, setDownloadManagerWindow } from './modules/downloadManager';
import {
  initializeErrorReporter,
  recordErrorReport,
  stopErrorReporterHttp
} from './modules/errorReporter';
import { initializeFileManager } from './modules/fileManager';
import { initializeFonts } from './modules/fonts';
import {
  getLocalMediaBaseUrl,
  registerLocalMediaIpc,
  startLocalMediaServer
} from './modules/localMediaServer';
import { initializeLocalMusicScanner } from './modules/localMusicScanner';
import { registerLocalProtocol } from './modules/localProtocol';
import { initLxMusicHttp } from './modules/lxMusicHttp';
import { initializeMpris, updateMprisCurrentSong, updateMprisPlayState } from './modules/mpris';
import { initializeOtherApi } from './modules/otherApi';
import { initPluginMediaProxy } from './modules/pluginMediaProxy';
import { initializeRemoteControl } from './modules/remoteControl';
import { initializeShortcuts } from './modules/shortcuts';
import { initializeTagAndMetadataManager } from './modules/tagAndMetadataManager';
import { initializeTray, updateCurrentSong, updatePlayState, updateTrayMenu } from './modules/tray';
import { setupUpdateHandlers } from './modules/update';
import { createMainWindow, initializeWindowManager, setAppQuitting } from './modules/window';
import { initWindowSizeManager } from './modules/window-size';
import { initializeYoutube } from './modules/youtube';

const iconPath = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources');
const icon = nativeImage.createFromPath(
  process.platform === 'darwin'
    ? join(iconPath, 'icon.icns')
    : process.platform === 'win32'
      ? join(iconPath, 'icon.ico')
      : join(iconPath, 'icon.png')
);

let mainWindow: Electron.BrowserWindow;

// Synchronous base-URL bridge used by the preload script; registered before any window is created.
registerLocalMediaIpc();

function initialize(configStore: any) {
  const store = configStore;

  const savedLanguage = store.get('set.language') as Language;
  if (savedLanguage) {
    i18n.global.locale = savedLanguage;
  }

  initializeFileManager();
  registerLocalProtocol();
  initializeErrorReporter();
  initPluginMediaProxy();
  initializeDownloadManager();
  initializeCacheManager();
  initializeOtherApi();
  initializeWindowManager();
  initializeFonts();
  initializeLocalMusicScanner();
  initializeTagAndMetadataManager();
  initializeYoutube();

  mainWindow = createMainWindow(icon);

  setDownloadManagerWindow(mainWindow);

  initializeTray(iconPath, mainWindow);

  initLxMusicHttp();

  loadLyricWindow(ipcMain, mainWindow);

  initializeShortcuts(mainWindow);

  initializeRemoteControl(mainWindow);

  initializeMpris(mainWindow);

  initializeDiscordRpc();

  setupUpdateHandlers(mainWindow);
}

const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
} else {
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-features', 'MediaSessionService');
  }

  try {
    const store = initializeConfig();
    const enableGpuAcceleration = store.get('set.enableGpuAcceleration', true) as boolean;

    if (!enableGpuAcceleration) {
      console.log('GPU acceleration disabled');
      app.disableHardwareAcceleration();
    } else {
      console.log('GPU acceleration enabled');
    }
  } catch (error) {
    console.error('Failed to initialize GPU setting:', error);
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.alger.music');

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    initWindowSizeManager();

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === ('media' as any) || permission === ('audioCapture' as any)) {
        callback(false);
        return;
      }
      callback(true);
    });

    session.defaultSession.setPermissionCheckHandler(() => {
      return true;
    });

    const store = initializeConfig();

    // Local files are served over loopback HTTP so <audio>/<video> can load and seek them.
    try {
      await startLocalMediaServer();
    } catch (error) {
      console.error('[local-media] failed to start server:', error);
    }
    console.log('[local-media] base url:', getLocalMediaBaseUrl() || '(unavailable)');

    initialize(store);

    app.on('activate', () => {
      if (mainWindow === null) initialize(store);
    });
  });

  ipcMain.on('change-language', (_, locale: Language) => {
    i18n.global.locale = locale;
    updateTrayMenu(mainWindow);
    mainWindow?.webContents.send('language-changed', locale);
  });

  ipcMain.on('update-play-state', (_, playing: boolean) => {
    updatePlayState(playing);
    updateMprisPlayState(playing);
    updateDiscordPlayState(playing);
  });

  ipcMain.on('update-discord-rpc-enabled', (_, enabled: boolean) => {
    const { setDiscordRpcEnabled } = require('./modules/discordRpc');
    setDiscordRpcEnabled(enabled);
  });

  ipcMain.on('update-current-song', (_, song: any) => {
    updateCurrentSong(song);
    updateMprisCurrentSong(song);
    updateDiscordSong(song);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    setAppQuitting(true);
    stopErrorReporterHttp();
  });

  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.on('get-arch', (event) => {
    event.returnValue = process.arch;
  });

  ipcMain.on('media-play', (event, data) => {
    const { BrowserWindow: BW } = require('electron');
    for (const win of BW.getAllWindows()) {
      if (win.webContents && win.webContents.id !== event.sender.id && !win.isDestroyed()) {
        win.webContents.send('media-pause-all', data);
      }
    }
  });
}
