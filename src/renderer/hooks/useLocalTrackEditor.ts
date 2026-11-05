import { computed, type Ref, ref } from 'vue';

import { useLocalMusicStore } from '@/store/modules/localMusic';
import type { LocalMusicEntry } from '@/types/localMusic';
import type { SongResult } from '@/types/music';
import { filePathToLocalUrl } from '@/utils/localMusicUtils';

/**
 * Bridges the currently playing song to the LocalTrackEditorModal so the
 * "Edit Metadata, Artwork & Filename" action is available inside the player,
 * not only in the Local Music list.
 */
export function useLocalTrackEditor(playMusic: Ref<SongResult>) {
  const localMusicStore = useLocalMusicStore();
  const showTrackEditor = ref(false);
  const editingEntry = ref<LocalMusicEntry | null>(null);

  const editableLocalEntry = computed<LocalMusicEntry | null>(() => {
    const song = playMusic.value as any;
    if (!song?.id) return null;
    const list = localMusicStore.musicList as LocalMusicEntry[];
    const byId = list.find((e) => e.id === song.id);
    if (byId) return byId;
    const url = song.playMusicUrl;
    if (url) {
      return list.find((e) => filePathToLocalUrl(e.filePath) === url) || null;
    }
    return null;
  });

  const openTrackEditor = () => {
    const entry = editableLocalEntry.value;
    if (!entry) return;
    editingEntry.value = entry;
    showTrackEditor.value = true;
  };

  const handleTrackSaved = (updatedEntry: LocalMusicEntry, oldId: string) => {
    localMusicStore.updateEntry(updatedEntry, oldId);
  };

  return {
    showTrackEditor,
    editingEntry,
    editableLocalEntry,
    openTrackEditor,
    handleTrackSaved
  };
}
