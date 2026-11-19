import { ipcMain } from 'electron';

import { updateDiscordPlayState, updateDiscordSong } from './discordRpc';
import { updateMprisCurrentSong, updateMprisPlayState } from './mpris';
import { updateRemoteControlPlayState, updateRemoteControlSong } from './remoteControl';
import { updateCurrentSong, updatePlayState } from './tray';
import { updateWindowPlayState } from './window';

let isHubRegistered = false;

export function dispatchPlayStateUpdate(playing: boolean): void {
  const state = Boolean(playing);
  updatePlayState(state);
  updateMprisPlayState(state);
  updateDiscordPlayState(state);
  updateRemoteControlPlayState(state);
  updateWindowPlayState(state);
}

export function dispatchCurrentSongUpdate(song: any): void {
  updateCurrentSong(song);
  updateMprisCurrentSong(song);
  updateDiscordSong(song);
  updateRemoteControlSong(song);
}

export function initializePlaybackStateHub(): void {
  if (isHubRegistered) return;
  isHubRegistered = true;

  ipcMain.on('update-play-state', (_, playing: boolean) => {
    dispatchPlayStateUpdate(playing);
  });

  ipcMain.on('update-current-song', (_, song: any) => {
    dispatchCurrentSongUpdate(song);
  });
}
