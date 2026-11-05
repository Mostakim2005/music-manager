import {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  nativeImage,
  Tray
} from 'electron';
import { join } from 'path';

import i18n from '../../i18n/main';
import { getLanguageOptions } from '../../i18n/utils';
import { getStore } from './config';

interface SongInfo {
  name: string;
  song: {
    artists: Array<{ name: string; [key: string]: any }>;
    [key: string]: any;
  };
  [key: string]: any;
}

let tray: Tray | null = null;
let playPauseTray: Tray | null = null;
let prevTray: Tray | null = null;
let nextTray: Tray | null = null;
let songTitleTray: Tray | null = null;

let isPlaying = false;
let currentSong: SongInfo | null = null;

const LANGUAGES = getLanguageOptions();

export function updatePlayState(playing: boolean) {
  isPlaying = playing;
  if (tray) {
    updateTrayMenu(BrowserWindow.getAllWindows()[0]);
  }
  updateStatusBarTray();
}

function getArtistString(song: SongInfo | null): string {
  if (!song || !song.song || !song.song.artists) return '';
  return song.song.artists.map((item) => item.name).join(' / ');
}

function getSongTitle(song: SongInfo | null): string {
  if (!song) return 'Not playing';
  const artistStr = getArtistString(song);
  return artistStr ? `${song.name} - ${artistStr}` : song.name;
}

function getTruncatedSongTitle(song: SongInfo | null, maxLength: number = 14): string {
  const fullTitle = getSongTitle(song);
  if (fullTitle.length <= maxLength) return fullTitle;
  return fullTitle.slice(0, maxLength) + '...';
}

export function updateCurrentSong(song: SongInfo | null) {
  currentSong = song;
  if (tray) {
    updateTrayMenu(BrowserWindow.getAllWindows()[0]);
  }
  updateStatusBarTray();
}

function getProperIconSize() {
  const height = 18;
  const width = 18;
  return { width, height };
}

function updateStatusBarTray() {
  if (process.platform !== 'darwin') return;

  const iconSize = getProperIconSize();

  if (songTitleTray) {
    if (currentSong) {
      const songName = currentSong.name.slice(0, 10);
      let title = songName;
      const artistStr = getArtistString(currentSong);
      if (artistStr) {
        title = `${songName} - ${artistStr.slice(0, 6)}${artistStr.length > 6 ? '..' : ''}`;
      }

      songTitleTray.setTitle(title, {
        fontType: 'monospacedDigit'
      });

      const fullTitle = getSongTitle(currentSong);
      songTitleTray.setToolTip(fullTitle);
      console.log('Status bar: ', title, 'Full details:', fullTitle);
    } else {
      songTitleTray.setTitle('Not playing', {
        fontType: 'monospacedDigit'
      });
      songTitleTray.setToolTip('Not playing');
      console.log('Status bar: not playing');
    }
  }

  if (playPauseTray) {
    const iconPath = join(
      app.getAppPath(),
      'resources/icons',
      isPlaying ? 'pause.png' : 'play.png'
    );
    const icon = nativeImage.createFromPath(iconPath).resize(iconSize);
    icon.setTemplateImage(true);
    playPauseTray.setImage(icon);
    playPauseTray.setToolTip(
      isPlaying ? i18n.global.t('common.tray.pause') : i18n.global.t('common.tray.play')
    );
  }
}

export function updateTrayMenu(mainWindow: BrowserWindow) {
  if (!tray) return;

  if (process.platform === 'darwin') {
    const menu = new Menu();

    if (currentSong) {
      menu.append(
        new MenuItem({
          label: getTruncatedSongTitle(currentSong),
          enabled: false,
          type: 'normal'
        })
      );
      menu.append(new MenuItem({ type: 'separator' }));
    }

    menu.append(
      new MenuItem({
        label: i18n.global.t('common.tray.prev'),
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'prevPlay');
        }
      })
    );

    menu.append(
      new MenuItem({
        label: i18n.global.t(isPlaying ? 'common.tray.pause' : 'common.tray.play'),
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'togglePlay');
        }
      })
    );

    menu.append(
      new MenuItem({
        label: i18n.global.t('common.tray.favorite'),
        type: 'normal',
        click: () => {
          console.log('[Tray] Sending favorite command - macOS menu');
          mainWindow.webContents.send('global-shortcut', 'toggleFavorite');
        }
      })
    );

    menu.append(
      new MenuItem({
        label: i18n.global.t('common.tray.next'),
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'nextPlay');
        }
      })
    );

    menu.append(new MenuItem({ type: 'separator' }));

    menu.append(
      new MenuItem({
        label: i18n.global.t('common.tray.show'),
        type: 'normal',
        click: () => {
          mainWindow.show();
        }
      })
    );

    const languageSubmenu = Menu.buildFromTemplate(
      LANGUAGES.map(({ label, value }) => ({
        label,
        type: 'radio',
        checked: i18n.global.locale === value,
        click: () => {
          i18n.global.locale = value;
          updateTrayMenu(mainWindow);
          mainWindow.webContents.send('language-changed', value);
        }
      }))
    );

    menu.append(
      new MenuItem({
        label: i18n.global.t('common.language'),
        type: 'submenu',
        submenu: languageSubmenu
      })
    );

    menu.append(
      new MenuItem({
        label: i18n.global.t('common.tray.quit'),
        type: 'normal',
        click: () => {
          app.quit();
        }
      })
    );

    tray.setContextMenu(menu);
  } else {
    const menuTemplate: MenuItemConstructorOptions[] = [
      ...((currentSong
        ? [
            {
              label: getTruncatedSongTitle(currentSong),
              enabled: false,
              type: 'normal'
            },
            { type: 'separator' }
          ]
        : []) as MenuItemConstructorOptions[]),
      {
        label: i18n.global.t('common.tray.show'),
        type: 'normal',
        click: () => {
          mainWindow.show();
        }
      },
      {
        label: i18n.global.t('common.tray.favorite'),
        type: 'normal',
        click: () => {
          console.log('[Tray] Sending favorite command - Windows/Linux menu');
          mainWindow.webContents.send('global-shortcut', 'toggleFavorite');
        }
      },
      { type: 'separator' },
      {
        label: i18n.global.t('common.tray.prev'),
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'prevPlay');
        }
      },
      {
        label: i18n.global.t(isPlaying ? 'common.tray.pause' : 'common.tray.play'),
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'togglePlay');
        }
      },
      {
        label: i18n.global.t('common.tray.next'),
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'nextPlay');
        }
      },
      { type: 'separator' },
      {
        label: i18n.global.t('common.language'),
        type: 'submenu',
        submenu: LANGUAGES.map(({ label, value }) => ({
          label,
          type: 'radio',
          checked: i18n.global.locale === value,
          click: () => {
            i18n.global.locale = value;
            updateTrayMenu(mainWindow);
            mainWindow.webContents.send('language-changed', value);
          }
        }))
      },
      { type: 'separator' },
      {
        label: i18n.global.t('common.tray.quit'),
        type: 'normal',
        click: () => {
          app.quit();
        }
      }
    ];

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(contextMenu);
  }
}

function initializeStatusBarTray(mainWindow: BrowserWindow) {
  const store = getStore();
  if (process.platform !== 'darwin' || !store.get('set.showTopAction')) return;

  const iconSize = getProperIconSize();

  const nextIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', 'next.png'))
    .resize(iconSize);
  nextIcon.setTemplateImage(true);
  nextTray = new Tray(nextIcon);
  nextTray.setToolTip(i18n.global.t('common.tray.next'));
  nextTray.on('click', () => {
    mainWindow.webContents.send('global-shortcut', 'nextPlay');
  });

  const playPauseIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', isPlaying ? 'pause.png' : 'play.png'))
    .resize(iconSize);
  playPauseIcon.setTemplateImage(true);
  playPauseTray = new Tray(playPauseIcon);
  playPauseTray.setToolTip(
    isPlaying ? i18n.global.t('common.tray.pause') : i18n.global.t('common.tray.play')
  );
  playPauseTray.on('click', () => {
    mainWindow.webContents.send('global-shortcut', 'togglePlay');
  });

  const prevIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', 'prev.png'))
    .resize(iconSize);
  prevIcon.setTemplateImage(true);
  prevTray = new Tray(prevIcon);
  prevTray.setToolTip(i18n.global.t('common.tray.prev'));
  prevTray.on('click', () => {
    mainWindow.webContents.send('global-shortcut', 'prevPlay');
  });

  const titleIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', 'note.png'))
    .resize({ width: 16, height: 16 });
  titleIcon.setTemplateImage(true);
  songTitleTray = new Tray(titleIcon);

  const initialText = getSongTitle(currentSong);

  songTitleTray.setTitle(initialText, {
    fontType: 'monospacedDigit'
  });

  songTitleTray.setToolTip(initialText);
  songTitleTray.on('click', () => {
    mainWindow.show();
  });

  updateStatusBarTray();

  console.log('Status bar ready, title: ', initialText);
}

/**
 */
export function initializeTray(iconPath: string, mainWindow: BrowserWindow) {
  const iconSize = process.platform === 'darwin' ? 18 : 16;
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon_16x16.png';

  let trayIcon = nativeImage.createFromPath(join(iconPath, iconFile));
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createFromPath(join(iconPath, 'icon.png'));
  }
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: iconSize, height: iconSize });
  }

  tray = new Tray(trayIcon);

  tray.setToolTip('Music Manager');

  updateTrayMenu(mainWindow);

  initializeStatusBarTray(mainWindow);

  if (process.platform === 'darwin') {
    tray.on('click', () => {
      if (tray) {
        tray.popUpContextMenu();
      }
    });
  } else {
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  }

  return tray;
}
