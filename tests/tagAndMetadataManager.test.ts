import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateM3u8Content,
  parseM3u8Content
} from '../src/main/modules/tagAndMetadataManager';
import { decodeLocalProtocolUrl } from '../src/main/modules/localProtocol';

// Mock electron app & ipcMain with vi.hoisted
const { ipcHandlers, mockDialog } = vi.hoisted(() => {
  return {
    ipcHandlers: new Map<string, Function>(),
    mockDialog: {
      showOpenDialog: vi.fn(async () => ({
        canceled: false,
        filePaths: ['/dummy/cover.jpg']
      })),
      showSaveDialog: vi.fn(async () => ({
        canceled: false,
        filePath: '/dummy/saved.m3u8'
      }))
    }
  };
});

vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'userData') {
          return path.join(os.tmpdir(), 'music-manager-test-userdata');
        }
        return os.tmpdir();
      })
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: Function) => {
        ipcHandlers.set(channel, handler);
      })
    },
    dialog: mockDialog
  };
});

describe('tagAndMetadataManager module', () => {
  let tmpDir: string;
  let userDataDir: string;

  beforeEach(async () => {
    ipcHandlers.clear();
    const { initializeTagAndMetadataManager } = await import(
      '../src/main/modules/tagAndMetadataManager'
    );
    initializeTagAndMetadataManager();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-test-'));
    userDataDir = path.join(os.tmpdir(), 'music-manager-test-userdata');
    fs.mkdirSync(userDataDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  });

  it('registers all required IPC handler channels', () => {
    expect(ipcHandlers.has('metadata:fetch-online')).toBe(true);
    expect(ipcHandlers.has('lyrics:fetch-multi-source')).toBe(true);
    expect(ipcHandlers.has('local-music:update-tags-and-file')).toBe(true);
    expect(ipcHandlers.has('local-music:select-cover-file')).toBe(true);
    expect(ipcHandlers.has('library:export-m3u8')).toBe(true);
    expect(ipcHandlers.has('library:import-m3u8')).toBe(true);
    expect(ipcHandlers.has('library:export-backup-json')).toBe(true);
    expect(ipcHandlers.has('library:import-backup-json')).toBe(true);
  });

  describe('generateM3u8Content & parseM3u8Content pure helper functions', () => {
    it('generates valid M3U8 content for empty tracks', () => {
      const content = generateM3u8Content([]);
      expect(content).toBe('#EXTM3U');
    });

    it('generates standard M3U8 content with INF lines, duration in seconds and file paths', () => {
      const tracks = [
        {
          filePath: 'C:\\Music\\Track01.mp3',
          title: 'Track One',
          artist: 'Artist One',
          duration: 182600
        },
        {
          filePath: 'D:/Music/Track02.flac',
          duration: 60000
        }
      ];

      const content = generateM3u8Content(tracks);
      const lines = content.split('\n');
      expect(lines[0]).toBe('#EXTM3U');
      expect(lines[1]).toBe('#EXTINF:183,Artist One - Track One');
      expect(lines[2]).toBe('C:\\Music\\Track01.mp3');
      expect(lines[3]).toBe('#EXTINF:60,Unknown Artist - Track02.flac');
      expect(lines[4]).toBe('D:/Music/Track02.flac');
    });

    it('parses M3U8 content, strips comments, resolves relative paths, and deduplicates', () => {
      const baseDir = path.join(tmpDir, 'playlists');
      fs.mkdirSync(baseDir, { recursive: true });

      const m3uContent = `
#EXTM3U
#EXTINF:120,Artist - Song 1
song1.mp3

# Comment line
#EXTINF:180,Artist - Song 2
../sub/song2.flac
# Duplicate
song1.mp3
"sub2/song3.wav"
file:///C:/absolute/song4.mp3
`;

      const parsed = parseM3u8Content(m3uContent, baseDir);
      expect(parsed).toHaveLength(4);
      expect(parsed[0]).toBe(path.resolve(baseDir, 'song1.mp3'));
      expect(parsed[1]).toBe(path.resolve(baseDir, '../sub/song2.flac'));
      expect(parsed[2]).toBe(path.resolve(baseDir, 'sub2/song3.wav'));
      expect(parsed[3]).toBe(path.normalize('C:/absolute/song4.mp3'));
    });
  });

  describe('Library M3U8 & JSON Backup IPC Handlers', () => {
    it('library:export-m3u8 exports valid m3u8 file on user confirmation', async () => {
      const exportFile = path.join(tmpDir, 'exported.m3u8');
      mockDialog.showSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: exportFile
      });

      const handler = ipcHandlers.get('library:export-m3u8')!;
      const res = await handler(null, {
        tracks: [
          { filePath: 'C:\\test\\song.mp3', title: 'Test Song', artist: 'Tester', duration: 120000 }
        ],
        defaultName: 'my-playlist.m3u8'
      });

      expect(res.ok).toBe(true);
      expect(res.filePath).toBe(exportFile);
      expect(fs.existsSync(exportFile)).toBe(true);

      const written = fs.readFileSync(exportFile, 'utf8');
      expect(written).toContain('#EXTM3U');
      expect(written).toContain('#EXTINF:120,Tester - Test Song');
      expect(written).toContain('C:\\test\\song.mp3');
    });

    it('library:export-m3u8 handles cancelation gracefully', async () => {
      mockDialog.showSaveDialog.mockResolvedValueOnce({
        canceled: true
      });

      const handler = ipcHandlers.get('library:export-m3u8')!;
      const res = await handler(null, { tracks: [] });
      expect(res.canceled).toBe(true);
    });

    it('library:import-m3u8 imports playlist and filters only existing files on disk', async () => {
      const existFile1 = path.join(tmpDir, 'exist1.mp3');
      const existFile2 = path.join(tmpDir, 'exist2.flac');
      fs.writeFileSync(existFile1, 'fake1');
      fs.writeFileSync(existFile2, 'fake2');

      const playlistPath = path.join(tmpDir, 'test.m3u8');
      const m3u8Data = `#EXTM3U\nexist1.mp3\nnon-existent.mp3\nexist2.flac`;
      fs.writeFileSync(playlistPath, m3u8Data, 'utf8');

      mockDialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: [playlistPath]
      });

      const handler = ipcHandlers.get('library:import-m3u8')!;
      const res = await handler(null);
      expect(res.ok).toBe(true);
      expect(res.filePaths).toHaveLength(2);
      expect(res.filePaths).toContain(existFile1);
      expect(res.filePaths).toContain(existFile2);
      expect(res.playlistFilePath).toBe(playlistPath);
    });

    it('library:export-backup-json and library:import-backup-json perform roundtrip backup and restore', async () => {
      const backupPath = path.join(tmpDir, 'backup.json');
      mockDialog.showSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: backupPath
      });

      const exportHandler = ipcHandlers.get('library:export-backup-json')!;
      const samplePayload = {
        customPlaylists: [{ id: 1, name: 'Favorites', trackIds: ['local-1', 'local-2'] }],
        settings: { volume: 0.8, crossfade: true }
      };

      const exportRes = await exportHandler(null, { payload: samplePayload });
      expect(exportRes.ok).toBe(true);
      expect(fs.existsSync(backupPath)).toBe(true);

      const fileContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      expect(fileContent.app).toBe('Music Manager');
      expect(fileContent.exportedAt).toBeDefined();
      expect(fileContent.customPlaylists).toEqual(samplePayload.customPlaylists);
      expect(fileContent.settings).toEqual(samplePayload.settings);

      // Now test import
      mockDialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: [backupPath]
      });

      const importHandler = ipcHandlers.get('library:import-backup-json')!;
      const importRes = await importHandler(null);
      expect(importRes.ok).toBe(true);
      expect(importRes.data.app).toBe('Music Manager');
      expect(importRes.data.customPlaylists).toEqual(samplePayload.customPlaylists);
      expect(importRes.filePath).toBe(backupPath);
    });
  });

  it('handles empty query in metadata:fetch-online', async () => {
    const handler = ipcHandlers.get('metadata:fetch-online')!;
    const res = await handler(null, { title: '' });
    expect(res).toEqual({ results: [] });
  });

  it('handles empty query in lyrics:fetch-multi-source', async () => {
    const handler = ipcHandlers.get('lyrics:fetch-multi-source')!;
    const res = await handler(null, { title: '' });
    expect(res).toEqual({
      lrc: '',
      tlyric: '',
      romalrc: '',
      source: 'LRCLIB',
      candidates: []
    });
  });

  it('updates tags, writes sidecar LRC, and renames file correctly', async () => {
    const handler = ipcHandlers.get('local-music:update-tags-and-file')!;

    // Create a dummy audio file
    const origFile = path.join(tmpDir, 'test-song.mp3');
    fs.writeFileSync(origFile, Buffer.from('fake mp3 audio stream content'));

    // Create a dummy image
    const dummyCoverBase64 =
      'data:image/jpeg;base64,' + Buffer.from('fake image binary bytes').toString('base64');

    const payload = {
      filePath: origFile,
      newFileName: 'Renamed Song',
      title: 'Awesome Track',
      artist: 'Great Artist',
      album: 'Top Album',
      year: '2026',
      genre: 'Synthwave',
      lyrics: '[00:01.00]Hello world\n[00:05.00]Testing lyrics',
      coverDataUrlOrPath: dummyCoverBase64,
      saveSidecarLrc: true
    };

    const res = await handler(null, payload);
    expect(res.ok).toBe(true);
    expect(res.updatedEntry).toBeDefined();

    const expectedNewPath = path.join(tmpDir, 'Renamed Song.mp3');
    expect(res.updatedEntry.filePath).toBe(expectedNewPath);
    expect(res.updatedEntry.title).toBe('Awesome Track');
    expect(res.updatedEntry.artist).toBe('Great Artist');
    expect(res.updatedEntry.album).toBe('Top Album');

    // Verify physical file renamed
    expect(fs.existsSync(expectedNewPath)).toBe(true);
    expect(fs.existsSync(origFile)).toBe(false);

    // Verify sidecar .lrc created with matching name
    const sidecarLrc = path.join(tmpDir, 'Renamed Song.lrc');
    expect(fs.existsSync(sidecarLrc)).toBe(true);
    expect(fs.readFileSync(sidecarLrc, 'utf8')).toContain('Testing lyrics');

    // Verify cover cache in userData/AudioCovers
    expect(res.updatedEntry.coverPath).toBeTruthy();
    expect(fs.existsSync(res.updatedEntry.coverPath!)).toBe(true);
  });

  it('registers local-music:save-synced-lyrics and writes embedded and sidecar lyrics', async () => {
    expect(ipcHandlers.has('local-music:save-synced-lyrics')).toBe(true);
    const handler = ipcHandlers.get('local-music:save-synced-lyrics')!;

    const testMp3 = path.join(tmpDir, 'lyric_test.mp3');
    fs.writeFileSync(testMp3, Buffer.alloc(1024));

    const lyricsContent = '[00:01.00] Line 1\n[00:05.00] Line 2';
    const res = await handler(null, {
      filePath: testMp3,
      lyrics: lyricsContent,
      saveSidecar: true
    });

    expect(res.ok).toBe(true);
    const sidecarLrc = path.join(tmpDir, 'lyric_test.lrc');
    expect(fs.existsSync(sidecarLrc)).toBe(true);
    expect(fs.readFileSync(sidecarLrc, 'utf8')).toBe(lyricsContent);
  });

  describe('decodeLocalProtocolUrl', () => {
    it('decodes URLs with spaces, hashes and percent signs', () => {
      const url = 'local:///E%3A/Music/Rock%20%231%20100%25%20real.m4a';
      const decoded = decodeLocalProtocolUrl(url);
      expect(decoded).toContain('Rock #1 100% real.m4a');
    });

    it('strips query parameters from URLs', () => {
      const url = 'local:///C%3A/Covers/album.jpg?param=100y100&t=12345';
      const decoded = decodeLocalProtocolUrl(url);
      expect(decoded).not.toContain('?');
      expect(decoded).not.toContain('param');
      expect(decoded).toContain('album.jpg');
    });

    it('decodes Unicode / non-ASCII characters correctly', () => {
      const url = 'local:///C%3A/Music/%E6%AD%8C%E6%9B%B2.mp3';
      const decoded = decodeLocalProtocolUrl(url);
      expect(decoded).toContain('歌曲.mp3');
    });
  });
});
