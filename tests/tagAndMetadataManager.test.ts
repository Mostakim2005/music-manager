import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron app & ipcMain
const ipcHandlers = new Map<string, Function>();

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
    dialog: {
      showOpenDialog: vi.fn(async () => ({
        canceled: false,
        filePaths: ['/dummy/cover.jpg']
      }))
    }
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
});
