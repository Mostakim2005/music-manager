import cors from 'cors';
import crypto from 'crypto';
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
  allowLan?: boolean;
  authToken?: string;
}

export function generatePairingToken(): string {
  return crypto.randomBytes(6).toString('hex');
}

export const defaultRemoteControlConfig: RemoteControlConfig = {
  enabled: false,
  port: 31888,
  allowedIps: [],
  allowLan: false,
  authToken: generatePairingToken()
};

let app: express.Application | null = null;
let server: any = null;
let mainWindowRef: Electron.BrowserWindow | null = null;
let currentSong: any = null;
let isPlaying: boolean = false;
let activeConfig: RemoteControlConfig = { ...defaultRemoteControlConfig };

export function updateRemoteControlSong(song: any): void {
  currentSong = song;
}

export function updateRemoteControlPlayState(playing: boolean): void {
  isPlaying = Boolean(playing);
}

export function normalizeRemoteControlConfig(raw?: Partial<RemoteControlConfig> | null): RemoteControlConfig {
  const token =
    typeof raw?.authToken === 'string' && raw.authToken.trim().length >= 4
      ? raw.authToken.trim()
      : generatePairingToken();
  return {
    enabled: Boolean(raw?.enabled),
    port: typeof raw?.port === 'number' && raw.port >= 1024 && raw.port <= 65535 ? raw.port : 31888,
    allowedIps: Array.isArray(raw?.allowedIps)
      ? raw!.allowedIps.map((ip) => String(ip || '').trim()).filter(Boolean)
      : [],
    allowLan: Boolean(raw?.allowLan),
    authToken: token
  };
}

export function isRemoteRequestAuthorized(
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, any> | undefined,
  expectedToken?: string
): boolean {
  const required = String(expectedToken || '').trim();
  if (!required) return false;

  const authHeader = String(headers['authorization'] || headers['Authorization'] || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer === required) return true;
  }

  const headerToken = String(headers['x-remote-token'] || headers['X-Remote-Token'] || '').trim();
  if (headerToken === required) return true;

  const queryToken = String(query?.token || query?.pin || '').trim();
  if (queryToken === required) return true;

  return false;
}

export function resolveRemoteBindHost(config: RemoteControlConfig): string {
  return config.allowLan ? '0.0.0.0' : '127.0.0.1';
}

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
  const rawConfig = store.get('remoteControl') as RemoteControlConfig | undefined;
  const config = normalizeRemoteControlConfig(rawConfig);
  activeConfig = config;
  store.set('remoteControl', config);

  ipcMain.on('update-remote-control-config', (_, newConfig: RemoteControlConfig) => {
    if (server) {
      stopServer();
    }

    const normalized = normalizeRemoteControlConfig(newConfig);
    activeConfig = normalized;
    store.set('remoteControl', normalized);

    if (normalized.enabled) {
      startServer(normalized);
    }
  });

  ipcMain.handle('get-remote-control-config', () => {
    const stored = store.get('remoteControl') as RemoteControlConfig | undefined;
    const normalized = normalizeRemoteControlConfig(stored || activeConfig);
    activeConfig = normalized;
    store.set('remoteControl', normalized);
    return normalized;
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
    const isLoopback = cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost';
    if (isLoopback || config.allowedIps.length === 0 || config.allowedIps.includes(cleanIp)) {
      next();
    } else {
      res.status(403).json({ error: 'Unauthorized IP address' });
    }
  });

  setupRoutes(app, config);

  const host = resolveRemoteBindHost(config);
  try {
    server = app.listen(config.port, host, () => {
      console.log(`Remote control service started on ${host}:${config.port}`);
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

function setupRoutes(app: express.Application, config: RemoteControlConfig) {
  const requireAuth: express.RequestHandler = (req, res, next) => {
    if (isRemoteRequestAuthorized(req.headers as any, req.query as any, config.authToken)) {
      next();
      return;
    }
    res.status(401).json({ error: 'Unauthorized: valid pairing token or PIN required' });
  };

  app.get('/api/status', (_, res) => {
    res.json({
      isPlaying,
      currentSong
    });
  });

  app.post('/api/toggle-play', requireAuth, (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'togglePlay');
    res.json({ success: true, message: 'Sent play/pause command' });
  });

  app.post('/api/prev', requireAuth, (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'prevPlay');
    res.json({ success: true, message: 'Sent previous-track command' });
  });

  app.post('/api/next', requireAuth, (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'nextPlay');
    res.json({ success: true, message: 'Sent next-track command' });
  });

  app.post('/api/volume-up', requireAuth, (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'volumeUp');
    res.json({ success: true, message: 'Sent volume-up command' });
  });

  app.post('/api/volume-down', requireAuth, (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'Main window not ready' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'volumeDown');
    res.json({ success: true, message: 'Sent volume-down command' });
  });

  app.post('/api/toggle-favorite', requireAuth, (_, res) => {
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
