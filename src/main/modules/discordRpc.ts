import { Client } from '@xhayper/discord-rpc';

import { getSharedStore } from './config';
import { recordErrorReport } from './errorReporter';

const PLACEHOLDER_CLIENT_ID = '1123456789012345678';

let rpcClient: Client | null = null;
let isConnected = false;
let isEnabled = true;
let activeClientId = '';
let currentSongInfo: {
  name?: string;
  artist?: string;
  album?: string;
  picUrl?: string;
  duration?: number;
} | null = null;
let isPlayingState = false;

export function resolveDiscordClientId(): string {
  try {
    const store = getSharedStore();
    const configured = String(store?.get('set.discordClientId') || '').trim();
    const envId = String(process.env.DISCORD_CLIENT_ID || '').trim();
    const candidate = configured || envId;
    if (!candidate || candidate === PLACEHOLDER_CLIENT_ID) {
      return '';
    }
    return candidate;
  } catch {
    return '';
  }
}

function destroyRpcClient(): void {
  if (rpcClient) {
    try {
      rpcClient.user?.clearActivity().catch(() => {
        // Ignore clear errors during teardown
      });
      rpcClient.destroy().catch(() => {
        // Ignore destroy errors during teardown
      });
    } catch {
      // Ignore synchronous teardown errors
    }
    rpcClient = null;
    isConnected = false;
  }
}

export function setDiscordRpcEnabled(enabled: boolean): void {
  isEnabled = Boolean(enabled);
  if (!isEnabled) {
    destroyRpcClient();
  } else if (!rpcClient) {
    initializeDiscordRpc();
  }
}

export function setDiscordClientId(clientId: string): void {
  try {
    const store = getSharedStore();
    store?.set('set.discordClientId', String(clientId || '').trim());
  } catch {
    // Ignore store persistence errors in headless mode
  }
  destroyRpcClient();
  if (isEnabled) {
    initializeDiscordRpc();
  }
}

export function isDiscordRpcEnabled(): boolean {
  return isEnabled;
}

export function initializeDiscordRpc(): void {
  try {
    const store = getSharedStore();
    if (store && store.get('set.enableDiscordRpc') === false) {
      isEnabled = false;
      return;
    }
    isEnabled = true;
    const clientId = resolveDiscordClientId();
    if (!clientId) {
      // Do not attempt connection without a valid registered Discord Application ID
      isConnected = false;
      return;
    }

    activeClientId = clientId;
    rpcClient = new Client({
      clientId: activeClientId
    });

    rpcClient.on('ready', () => {
      isConnected = true;
      syncActivity();
    });

    rpcClient.on('disconnected', () => {
      isConnected = false;
    });

    rpcClient.login().catch((err: unknown) => {
      isConnected = false;
      const message = err instanceof Error ? err.message : String(err);
      recordErrorReport({
        source: 'main',
        severity: 'warn',
        message: `Discord RPC login failed: ${message}`,
        context: { clientId: activeClientId }
      });
    });
  } catch (err: unknown) {
    isConnected = false;
    const message = err instanceof Error ? err.message : String(err);
    recordErrorReport({
      source: 'main',
      severity: 'warn',
      message: `Discord RPC initialization failed: ${message}`
    });
  }
}

function syncActivity(): void {
  if (!isEnabled || !rpcClient || !isConnected || !rpcClient.user || !currentSongInfo?.name) {
    return;
  }

  try {
    const artistText = currentSongInfo.artist || 'Unknown Artist';
    const albumText = currentSongInfo.album || 'Music Manager';
    rpcClient.user
      .setActivity({
        details: `${currentSongInfo.name}`.slice(0, 128),
        state: `by ${artistText}`.slice(0, 128),
        largeImageKey: currentSongInfo.picUrl || 'alger_logo',
        largeImageText: albumText.slice(0, 128),
        smallImageKey: isPlayingState ? 'play' : 'pause',
        smallImageText: isPlayingState ? 'Playing' : 'Paused',
        instance: false
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        recordErrorReport({
          source: 'main',
          severity: 'warn',
          message: `Discord RPC setActivity failed: ${message}`
        });
      });
  } catch {
    // Ignore RPC activity errors when Discord is closed
  }
}

export function updateDiscordSong(song: any): void {
  if (!song) {
    currentSongInfo = null;
    return;
  }
  const artist =
    Array.isArray(song.ar) && song.ar.length > 0
      ? song.ar.map((a: any) => a.name).join(' / ')
      : Array.isArray(song.artists) && song.artists.length > 0
        ? song.artists.map((a: any) => a.name).join(' / ')
        : song.artist || 'Unknown Artist';

  currentSongInfo = {
    name: song.name || song.title || 'Unknown Track',
    artist,
    album: song.al?.name || song.album?.name || song.album || 'Music Manager',
    picUrl: song.picUrl || song.al?.picUrl || '',
    duration: song.dt || song.duration || 0
  };
  syncActivity();
}

export function updateDiscordPlayState(playing: boolean): void {
  isPlayingState = Boolean(playing);
  syncActivity();
}
