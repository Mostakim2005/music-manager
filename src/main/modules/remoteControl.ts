import cors from 'cors';
import { ipcMain } from 'electron';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getStore } from './config';

export interface RemoteControlConfig {
  enabled: boolean;
  port: number;
  allowedIps: string[];
}

export const defaultRemoteControlConfig: RemoteControlConfig = {
  enabled: false,
  port: 31888,
  allowedIps: []
};

let app: express.Application | null = null;
let server: any = null;
let mainWindowRef: Electron.BrowserWindow | null = null;
let currentSong: any = null;
let isPlaying: boolean = false;

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const key in interfaces) {
    const iface = interfaces[key];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          addresses.push(alias.address);
        }
      }
    }
  }

  return addresses;
}

export function initializeRemoteControl(mainWindow: Electron.BrowserWindow) {
  mainWindowRef = mainWindow;
  const store = getStore() as any;
  let config = store.get('remoteControl') as RemoteControlConfig;

  if (!config) {
    config = defaultRemoteControlConfig;
    store.set('remoteControl', config);
  }

  ipcMain.on('update-current-song', (_, song: any) => {
    currentSong = song;
  });

  ipcMain.on('update-play-state', (_, playing: boolean) => {
    isPlaying = playing;
  });

  ipcMain.on('update-remote-control-config', (_, newConfig: RemoteControlConfig) => {
    if (server) {
      stopServer();
    }

    store.set('remoteControl', newConfig);

    if (newConfig.enabled) {
      startServer(newConfig);
    }
  });

  ipcMain.handle('get-remote-control-config', () => {
    const config = store.get('remoteControl') as RemoteControlConfig;
    return config || defaultRemoteControlConfig;
  });

  ipcMain.handle('get-local-ip-addresses', () => {
    return getLocalIpAddresses();
  });

  if (config.enabled) {
    startServer(config);
  }
}

function startServer(config: RemoteControlConfig) {
  if (!mainWindowRef) {
    console.error('Main window not ready, cannot start remote control service');
    return;
  }

  app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const cleanIp = clientIp.replace(/^::ffff:/, '');
    console.log('config', config);
    if (config.allowedIps.length === 0 || config.allowedIps.includes(cleanIp)) {
      next();
    } else {
      res.status(403).json({ error: 'Unauthorized IP address' });
    }
  });

  setupRoutes(app);

  try {
    server = app.listen(config.port, () => {
      console.log(`Remote control service started, port: ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start remote control service:', error);
  }
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
    app = null;
    console.log('Remote control service stopped');
  }
}

function setupRoutes(app: express.Application) {
  app.get('/api/status', (_, res) => {
    res.json({
      isPlaying,
      currentSong
    });
  });

  app.post('/api/toggle-play', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'togglePlay');
    res.json({ success: true, message: 'Sent play/pause command' });
  });

  app.post('/api/prev', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'prevPlay');
    res.json({ success: true, message: 'Sent previous-track command' });
  });

  app.post('/api/next', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'nextPlay');
    res.json({ success: true, message: 'Sent next-track command' });
  });

  app.post('/api/volume-up', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'volumeUp');
    res.json({ success: true, message: 'Sent volume-up command' });
  });

  app.post('/api/volume-down', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'volumeDown');
    res.json({ success: true, message: 'Sent volume-down command' });
  });

  app.post('/api/toggle-favorite', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'toggleFavorite');
    res.json({ success: true, message: 'Sent favorite toggle command' });
  });

  app.get('/', (_, res) => {
    try {
      const resourcesPath = process.resourcesPath || '';
      const isDev = process.env.NODE_ENV === 'development';
      const htmlPath = path.join(process.cwd(), 'resources', 'html', 'remote-control.html');
      const finalPath = isDev ? htmlPath : path.join(resourcesPath, 'html', 'remote-control.html');

      if (fs.existsSync(finalPath)) {
        res.sendFile(finalPath);
      } else {
        res.status(404).send('Remote control UI file not found');
        console.error('Remote control UI file missing: ', finalPath);
      }
    } catch (error) {
      console.error('Failed to load remote control UI:', error);
      res.status(500).send('Failed to load remote control UI');
    }
  });
}
