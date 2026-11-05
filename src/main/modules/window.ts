import { is } from '@electron-toolkit/utils';
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  session,
  shell
} from 'electron';
import { join } from 'path';

import { getSharedStore } from './config';
import { recordErrorReport } from './errorReporter';
import {
  applyContentZoom,
  applyInitialState,
  calculateMinimumWindowSize,
  DEFAULT_MAIN_HEIGHT,
  DEFAULT_MAIN_WIDTH,
  DEFAULT_MINI_HEIGHT,
  DEFAULT_MINI_WIDTH,
  getWindowOptions,
  getWindowState,
  initWindowSizeHandlers,
  saveWindowState,
  WindowState
} from './window-size';

const store = getSharedStore();

let mainWindowInstance: BrowserWindow | null = null;
let isPlaying = false;
let isAppQuitting = false;
let preMiniModeState: WindowState = {
  width: DEFAULT_MAIN_WIDTH,
  height: DEFAULT_MAIN_HEIGHT,
  x: undefined,
  y: undefined,
  isMaximized: false
};
let macPreMaximizedBounds: Electron.Rectangle | null = null;
let isMacWorkAreaMaximized = false;

export function isWindowMaximized(win: BrowserWindow): boolean {
  if (!win || win.isDestroyed()) return false;
  if (win.isFullScreen()) return true;

  if (process.platform === 'darwin') {
    if (isMacWorkAreaMaximized) return true;
    try {
      const currentBounds = win.getBounds();
      const display = screen.getDisplayMatching(currentBounds);
      const { workArea } = display;
      const isMatchingWorkArea =
        Math.abs(currentBounds.x - workArea.x) <= 2 &&
        Math.abs(currentBounds.y - workArea.y) <= 2 &&
        Math.abs(currentBounds.width - workArea.width) <= 2 &&
        Math.abs(currentBounds.height - workArea.height) <= 2;
      return isMatchingWorkArea;
    } catch {
      return false;
    }
  }

  return win.isMaximized();
}

export function toggleWindowMaximize(win: BrowserWindow): void {
  if (!win || win.isDestroyed()) return;

  if (process.platform === 'darwin') {
    if (win.isFullScreen()) {
      win.setFullScreen(false);
      return;
    }

    const currentBounds = win.getBounds();
    const display = screen.getDisplayMatching(currentBounds);
    const { workArea } = display;

    const isMatchingWorkArea =
      Math.abs(currentBounds.x - workArea.x) <= 2 &&
      Math.abs(currentBounds.y - workArea.y) <= 2 &&
      Math.abs(currentBounds.width - workArea.width) <= 2 &&
      Math.abs(currentBounds.height - workArea.height) <= 2;

    if (isMacWorkAreaMaximized || isMatchingWorkArea) {
      isMacWorkAreaMaximized = false;
      if (
        macPreMaximizedBounds &&
        macPreMaximizedBounds.width >= 900 &&
        macPreMaximizedBounds.height >= 640
      ) {
        win.setBounds(macPreMaximizedBounds, true);
      } else {
        win.setSize(DEFAULT_MAIN_WIDTH, DEFAULT_MAIN_HEIGHT, true);
        win.center();
      }
      win.webContents.send('window-maximized-state', false);
    } else {
      macPreMaximizedBounds = currentBounds;
      isMacWorkAreaMaximized = true;
      win.setBounds(workArea, true);
      win.webContents.send('window-maximized-state', true);
    }
    return;
  }

  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
}

/**
 */
export function setAppQuitting(quitting: boolean) {
  isAppQuitting = quitting;
}

/**
 */
function initializeProxy() {
  const defaultConfig = {
    enable: false,
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890
  };

  const proxyConfig = store.get('set.proxyConfig', defaultConfig) as {
    enable: boolean;
    protocol: string;
    host: string;
    port: number;
  };

  if (proxyConfig?.enable) {
    const proxyRules = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
    session.defaultSession.setProxy({ proxyRules });
  } else {
    session.defaultSession.setProxy({ proxyRules: '' });
  }
}

function setThumbarButtons(window: BrowserWindow) {
  const iconsDir = app.isPackaged
    ? join(process.resourcesPath, 'icons')
    : join(app.getAppPath(), 'resources/icons');
  window.setThumbarButtons([
    {
      tooltip: 'prev',
      icon: nativeImage.createFromPath(join(iconsDir, 'prev.png')),
      click() {
        window.webContents.send('global-shortcut', 'prevPlay');
      }
    },

    {
      tooltip: isPlaying ? 'pause' : 'play',
      icon: nativeImage.createFromPath(join(iconsDir, isPlaying ? 'pause.png' : 'play.png')),
      click() {
        window.webContents.send('global-shortcut', 'togglePlay');
      }
    },

    {
      tooltip: 'next',
      icon: nativeImage.createFromPath(join(iconsDir, 'next.png')),
      click() {
        window.webContents.send('global-shortcut', 'nextPlay');
      }
    }
  ]);
}

/**
 */
export function initializeWindowManager() {
  initializeProxy();

  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.minimize();
    }
  });

  ipcMain.handle('is-window-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return Boolean(win && isWindowMaximized(win));
  });

  ipcMain.on('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      toggleWindowMaximize(win);
    }
  });

  ipcMain.handle('is-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return Boolean(win && !win.isDestroyed() && win.isFullScreen());
  });

  ipcMain.on('toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (process.platform === 'darwin') {
        win.hide();
      } else {
        win.destroy();
        app.quit();
      }
    }
  });

  ipcMain.on('quit-app', () => {
    setAppQuitting(true);
    app.quit();
  });

  ipcMain.on('mini-tray', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.hide();
    }
  });

  ipcMain.on('mini-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      preMiniModeState = saveWindowState(win);
      console.log('Saved normal-mode state for restore: ', JSON.stringify(preMiniModeState));

      const display = screen.getDisplayMatching(win.getBounds());
      const { width: screenWidth, x: screenX } = display.workArea;

      win.unmaximize();
      win.setMinimumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT);
      win.setMaximumSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT);
      win.setSize(DEFAULT_MINI_WIDTH, DEFAULT_MINI_HEIGHT, false);
      win.setPosition(
        screenX + screenWidth - DEFAULT_MINI_WIDTH - 20,
        display.workArea.y + 20,
        false
      );
      win.setAlwaysOnTop(true);
      win.setSkipTaskbar(false);
      win.setResizable(false);

      win.webContents.send('navigate', '/mini');

      win.webContents.send('mini-mode', true);

      win.webContents.setZoomFactor(1);
    }
  });

  ipcMain.on('restore-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setResizable(true);
      win.setMaximumSize(0, 0);

      console.log('Restoring from mini mode with saved state: ', JSON.stringify(preMiniModeState));

      const { minWidth, minHeight } = calculateMinimumWindowSize();
      win.setMinimumSize(minWidth, minHeight);

      win.setAlwaysOnTop(false);
      win.setSkipTaskbar(false);

      win.webContents.send('navigate', '/');

      win.webContents.send('mini-mode', false);

      setTimeout(() => {
        if (win.isDestroyed()) {
          return;
        }

        if (preMiniModeState.x !== undefined && preMiniModeState.y !== undefined) {
          win.setPosition(preMiniModeState.x, preMiniModeState.y, false);
        } else {
          win.center();
        }

        if (preMiniModeState.isMaximized) {
          win.maximize();
        } else {
          win.setSize(preMiniModeState.width, preMiniModeState.height, false);
        }

        applyContentZoom(win);

        setTimeout(() => {
          if (!win.isDestroyed() && !win.isMaximized() && !win.isMinimized()) {
            const [width, height] = win.getSize();
            if (
              Math.abs(width - preMiniModeState.width) > 2 ||
              Math.abs(height - preMiniModeState.height) > 2
            ) {
              console.log(
                `Size differs after restore, adjusting again: current=${width}x${height}, target=${preMiniModeState.width}x${preMiniModeState.height}`
              );
              win.setSize(preMiniModeState.width, preMiniModeState.height, false);
            }
          }
        }, 150);
      }, 50);
    }
  });

  ipcMain.on('update-play-state', (_, playing: boolean) => {
    isPlaying = playing;
    if (mainWindowInstance) {
      setThumbarButtons(mainWindowInstance);
    }
  });

  store.onDidChange('set.proxyConfig', () => {
    initializeProxy();
  });

  initWindowSizeHandlers(mainWindowInstance);
  app.on('activate', () => {
    if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
      if (!mainWindowInstance.isVisible()) {
        mainWindowInstance.show();
      }
    }
  });
}

/**
 */
export function createMainWindow(icon: Electron.NativeImage): BrowserWindow {
  console.log('Creating main window...');

  const options = getWindowOptions();

  options.icon = icon;
  options.webPreferences = {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true,
    webSecurity: false,
    backgroundThrottling: false
  };

  console.log(
    `Creating window with options: ${JSON.stringify({
      width: options.width,
      height: options.height,
      x: options.x,
      y: options.y,
      minWidth: options.minWidth,
      minHeight: options.minHeight
    })}`
  );

  const mainWindow = new BrowserWindow(options);
  const syncMaximizedState = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized-state', isWindowMaximized(mainWindow));
    }
  };

  const syncFullScreenState = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-fullscreen-state', mainWindow.isFullScreen());
      mainWindow.webContents.send('window-maximized-state', isWindowMaximized(mainWindow));
    }
  };

  mainWindow.on('maximize', syncMaximizedState);
  mainWindow.on('unmaximize', syncMaximizedState);
  mainWindow.on('enter-full-screen', syncFullScreenState);
  mainWindow.on('leave-full-screen', syncFullScreenState);

  mainWindow.on('resize', () => {
    if (process.platform === 'darwin' && isMacWorkAreaMaximized && !mainWindow.isFullScreen()) {
      const bounds = mainWindow.getBounds();
      const display = screen.getDisplayMatching(bounds);
      const { workArea } = display;
      const isMatching =
        Math.abs(bounds.x - workArea.x) <= 2 &&
        Math.abs(bounds.y - workArea.y) <= 2 &&
        Math.abs(bounds.width - workArea.width) <= 2 &&
        Math.abs(bounds.height - workArea.height) <= 2;
      if (!isMatching) {
        isMacWorkAreaMaximized = false;
        syncMaximizedState();
      }
    }
  });

  const appOrigin = (() => {
    if (!is.dev || !process.env.ELECTRON_RENDERER_URL) return null;
    try {
      return new URL(process.env.ELECTRON_RENDERER_URL).origin;
    } catch {
      return null;
    }
  })();

  const shouldOpenInBrowser = (targetUrl: string): boolean => {
    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol === 'mailto:' || parsedUrl.protocol === 'tel:') {
        return true;
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }

      if (appOrigin && parsedUrl.origin === appOrigin) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  };

  const openInSystemBrowser = (targetUrl: string) => {
    shell.openExternal(targetUrl).catch((error) => {
      console.error('Failed to open external link:', targetUrl, error);
    });
  };

  mainWindow.removeMenu();

  applyInitialState(mainWindow);

  const savedState = getWindowState();
  if (savedState) {
    preMiniModeState = { ...savedState };
  }

  mainWindow.on('show', () => {
    setThumbarButtons(mainWindow);
  });

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      if (!isAppQuitting) {
        event.preventDefault();
        mainWindow.hide();
        return;
      }
    }
  });

  mainWindow.on('ready-to-show', () => {
    const [width, height] = mainWindow.getSize();
    console.log(`Size before show: ${width}x${height}`);

    if (savedState && !savedState.isMaximized) {
      mainWindow.setSize(savedState.width, savedState.height, false);
    }

    mainWindow.show();
    syncMaximizedState();
    applyContentZoom(mainWindow);

    setTimeout(() => {
      if (!mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
        const [currentWidth, currentHeight] = mainWindow.getSize();
        if (savedState && !savedState.isMaximized) {
          if (
            Math.abs(currentWidth - savedState.width) > 2 ||
            Math.abs(currentHeight - savedState.height) > 2
          ) {
            console.log(
              `Size mismatch, adjusting again: current=${currentWidth}x${currentHeight}, target=${savedState.width}x${savedState.height}`
            );
            mainWindow.setSize(savedState.width, savedState.height, false);
          }
        }
      }
    }, 100);
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!shouldOpenInBrowser(targetUrl)) return;
    event.preventDefault();
    openInSystemBrowser(targetUrl);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (shouldOpenInBrowser(details.url)) {
      openInSystemBrowser(details.url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 3 || /Uncaught\s+\w*Error/i.test(message)) {
      recordErrorReport({
        source: 'renderer',
        severity: level >= 3 ? 'error' : 'warn',
        message,
        context: { line, sourceId, level }
      });
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    recordErrorReport({
      source: 'renderer',
      severity: 'fatal',
      message: `Renderer process gone: ${details.reason}`,
      context: details
    });
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      recordErrorReport({
        source: 'renderer',
        severity: 'error',
        message: `Renderer failed to load (${errorCode}): ${errorDescription}`,
        context: { errorCode, errorDescription, validatedURL }
      });
    }
  );

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);

    globalShortcut.register('CommandOrControl+Shift+I', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  initWindowSizeHandlers(mainWindow);

  mainWindowInstance = mainWindow;

  return mainWindow;
}
