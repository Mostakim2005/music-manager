import { Client } from '@xhayper/discord-rpc';

const DISCORD_CLIENT_ID = '1123456789012345678';

let rpcClient: Client | null = null;
let isConnected = false;
let currentSongInfo: {
  name?: string;
  artist?: string;
  album?: string;
  picUrl?: string;
  duration?: number;
} | null = null;
let isPlayingState = false;

export function initializeDiscordRpc(): void {
  try {
    rpcClient = new Client({
      clientId: DISCORD_CLIENT_ID
    });

    rpcClient.on('ready', () => {
      isConnected = true;
      syncActivity();
    });

    rpcClient.on('disconnected', () => {
      isConnected = false;
    });

    rpcClient.login().catch(() => {
      isConnected = false;
    });
  } catch {
    isConnected = false;
  }
}

function syncActivity(): void {
  if (!rpcClient || !isConnected || !rpcClient.user || !currentSongInfo?.name) {
    return;
  }

  try {
    const artistText = currentSongInfo.artist || 'Unknown Artist';
    const albumText = currentSongInfo.album || 'AlgerMusicPlayer';
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
      .catch(() => {});
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
    album: song.al?.name || song.album?.name || song.album || 'AlgerMusicPlayer',
    picUrl: song.picUrl || song.al?.picUrl || '',
    duration: song.dt || song.duration || 0
  };
  syncActivity();
}

export function updateDiscordPlayState(playing: boolean): void {
  isPlayingState = Boolean(playing);
  syncActivity();
}
