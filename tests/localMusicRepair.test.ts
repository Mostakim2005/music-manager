import { describe, expect, it } from 'vitest';

import {
  fileBaseName,
  needsMetadataRepair,
  selectEntriesNeedingRepair,
  toMetadataSearchTitle
} from '@/utils/localMusicRepair';

describe('metadata repair heuristics', () => {
  it('repairs entries whose title is just the file name', () => {
    expect(
      needsMetadataRepair({
        filePath: 'C:\\Music\\01 - Artist - Song.mp3',
        title: '01 - Artist - Song',
        artist: 'Someone'
      })
    ).toBe(true);
  });

  it('repairs placeholder or missing artists', () => {
    for (const artist of ['', 'Unknown Artist', 'unknown', 'Various Artists']) {
      expect(
        needsMetadataRepair({ filePath: '/music/song.mp3', title: 'Song', artist })
      ).toBe(true);
    }
  });

  it('leaves complete metadata alone', () => {
    expect(
      needsMetadataRepair({
        filePath: '/music/track.mp3',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera'
      })
    ).toBe(false);
  });

  it('builds a searchable title from track-numbered file names', () => {
    expect(toMetadataSearchTitle('', '/music/03_-_Daft_Punk_-_One_More_Time.flac')).toBe(
      'Daft Punk - One More Time'
    );
    expect(toMetadataSearchTitle('07 Song Name', '/music/x.mp3')).toBe('Song Name');
    expect(fileBaseName('/music/a.b/c.mp3')).toBe('c');
  });

  it('selects only the entries that need work', () => {
    const entries = [
      { id: 'a', filePath: '/m/a.mp3', title: 'a', artist: 'Unknown Artist' },
      { id: 'b', filePath: '/m/b.mp3', title: 'Real Title', artist: 'Real Artist' }
    ];
    expect(selectEntriesNeedingRepair(entries).map((entry) => entry.id)).toEqual(['a']);
  });
});
