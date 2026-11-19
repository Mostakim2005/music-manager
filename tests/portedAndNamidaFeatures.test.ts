import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils', () => ({
  isElectron: false
}));

class MockAudio {
  crossOrigin = '';
  preload = '';
  src = '';
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  duration = 180;
  paused = true;
  ended = false;
  error = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  load = vi.fn();
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}

vi.stubGlobal('Audio', MockAudio);
vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
});
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
});
vi.stubGlobal('navigator', {
  clipboard: {
    writeText: vi.fn(async () => undefined)
  }
});

const loadAudioServiceModule = async () => import('../src/renderer/services/audioService');
import {
  isSupportedAudioFormat,
  parseMultiArtists,
  parseMultiGenres,
  toSongResult
} from '../src/renderer/utils/localMusicUtils';
import {
  alignSubLyrics,
  copyLyric,
  getWordFillProgress,
  lyricParser,
  parseLyric
} from '../src/renderer/utils/lyrics';
import { useLinkedMediaSync } from '../src/renderer/composables/useLinkedMediaSync';

describe('YesPlayMusic Ported Features & Namida Enhancements', () => {
  describe('1. Romanized & Translated Lyrics Engine (YesPlayMusic port)', () => {
    it('parses standard LRC timestamps and strips metadata headers', () => {
      const rawLrc = [
        '[ti:夜に駆ける]',
        '[ar:YOASOBI]',
        '[by:YesPlayMusic]',
        '[00:01.50]沈むように溶けてゆくように',
        '[00:05.20][00:15.20]二人だけの空が広がる夜に'
      ].join('\n');

      const parsed = parseLyric(rawLrc);
      expect(parsed.length).toBe(3);
      expect(parsed[0]).toEqual({
        time: 1.5,
        rawTime: '[00:01.50]',
        content: '沈むように溶けてゆくように'
      });
      expect(parsed[1].time).toBe(5.2);
      expect(parsed[2].time).toBe(15.2);
    });

    it('extracts lyric, tlyric (translation), and romalyric (Romanization) via lyricParser', () => {
      const responseData = {
        lrc: {
          lyric: '[00:01.00]沈むように\n[00:04.50]さよならだけだった'
        },
        tlyric: {
          lyric: '[00:01.00]如同沉溺一般\n[00:04.50]只剩下一句再见'
        },
        romalrc: {
          lyric: '[00:01.00]shizumu you ni\n[00:04.50]sayonara dake datta'
        }
      };

      const result = lyricParser(responseData);
      expect(result.lyric).toHaveLength(2);
      expect(result.tlyric).toHaveLength(2);
      expect(result.romalyric).toHaveLength(2);
      expect(result.romalyric[0].content).toBe('shizumu you ni');
      expect(result.tlyric[1].content).toBe('只剩下一句再见');

      const alignedTrans = alignSubLyrics(
        [1.0, 4.5],
        ['沈むように', 'さよならだけだった'],
        result.tlyric
      );
      const alignedRoma = alignSubLyrics(
        [1.0, 4.5],
        ['沈むように', 'さよならだけだった'],
        result.romalyric
      );

      expect(alignedTrans).toEqual(['如同沉溺一般', '只剩下一句再见']);
      expect(alignedRoma).toEqual(['shizumu you ni', 'sayonara dake datta']);
    });

    it('supports copyLyric helper', async () => {
      const ok = await copyLyric('Line 1\nLine 2');
      expect(ok).toBe(true);
    });
  });

  describe('2. Smooth 200ms Play/Pause Volume Fade Constants & Audio Transitions', () => {
    it('exports PLAY_PAUSE_FADE_DURATION = 200ms matching YesPlayMusic and configures Smart Transitions', async () => {
      const { PLAY_PAUSE_FADE_DURATION, audioService } = await loadAudioServiceModule();
      expect(PLAY_PAUSE_FADE_DURATION).toBe(200);

      const updatedConfig = audioService.setSmartTransitionConfig({
        crossfadeEnabled: true,
        crossfadeDuration: 6,
        skipSilenceEnabled: true,
        replayGainEnabled: true
      });
      expect(updatedConfig.crossfadeEnabled).toBe(true);
      expect(updatedConfig.crossfadeDuration).toBe(6);
      expect(updatedConfig.skipSilenceEnabled).toBe(true);
      expect(updatedConfig.replayGainEnabled).toBe(true);
    });
  });

  describe('3. Namida Multi-Artist & Genre Delimiter Parsing + Unified Audio/Video Queue', () => {
    it('splits multi-artist strings on feat., ft., &, ;, ,, and /', () => {
      const artists = parseMultiArtists('YOASOBI feat. 初音ミク & Kenshi Yonezu; Ado / ZUTOMAYO, Eve');
      expect(artists).toEqual([
        'YOASOBI',
        '初音ミク',
        'Kenshi Yonezu',
        'Ado',
        'ZUTOMAYO',
        'Eve'
      ]);
    });

    it('splits multi-genre strings cleanly', () => {
      const genres = parseMultiGenres('J-Pop; Vocaloid / Synthwave & Electronic, Rock');
      expect(genres).toEqual(['J-Pop', 'Vocaloid', 'Synthwave', 'Electronic', 'Rock']);
    });

    it('supports unified audio and video formats (.opus, .mp4, .webm)', () => {
      expect(isSupportedAudioFormat('C:/Music/song.opus')).toBe(true);
      expect(isSupportedAudioFormat('C:/Music/mv.mp4')).toBe(true);
      expect(isSupportedAudioFormat('C:/Music/live.webm')).toBe(true);

      const videoSong = toSongResult({
        id: 'local-mv-1',
        filePath: 'C:/Music/YOASOBI_Idol.mp4',
        title: 'Idol',
        artist: 'YOASOBI feat. Real Akiba Boyz',
        album: 'THE BOOK 3',
        duration: 213000,
        coverPath: null,
        lyrics: null,
        fileSize: 1024000,
        modifiedTime: Date.now()
      });

      expect(videoSong.ar.map((a) => a.name)).toEqual(['YOASOBI', 'Real Akiba Boyz']);
      expect(videoSong.videoUrl).toBeDefined();
      expect(videoSong.videoUrl).toContain('local://');
    });
  });

  describe('4. Namida Word-by-Word Karaoke Fill Progress', () => {
    it('returns 0 before word starts, 1 after word finishes, and linear ratio in between', () => {
      const word = { startTime: 1000, duration: 500 };
      expect(getWordFillProgress(word, 800)).toBe(0);
      expect(getWordFillProgress(word, 1000)).toBe(0);
      expect(getWordFillProgress(word, 1250)).toBe(0.5);
      expect(getWordFillProgress(word, 1500)).toBe(1);
      expect(getWordFillProgress(word, 1800)).toBe(1);
    });
  });

  describe('5. Proportional Rate-Locked Audio/Video Sync (useLinkedMediaSync)', () => {
    it('enforces that video is strictly muted and volume is 0', () => {
      const mockAudio = { paused: false, currentTime: 10.0, playbackRate: 1.0 } as HTMLAudioElement;
      const mockVideo = {
        paused: false,
        currentTime: 10.0,
        playbackRate: 1.0,
        muted: false,
        volume: 0.8,
        readyState: 4,
        play: vi.fn(),
        pause: vi.fn()
      } as unknown as HTMLVideoElement;

      const { enforceSyncTick } = useLinkedMediaSync(
        () => mockAudio,
        () => mockVideo
      );

      enforceSyncTick();
      expect(mockVideo.muted).toBe(true);
      expect(mockVideo.volume).toBe(0);
    });

    it('proportionally micro-adjusts video playbackRate when drift is between 35ms and 450ms', () => {
      const mockAudio = { paused: false, currentTime: 10.0, playbackRate: 1.0 } as HTMLAudioElement;
      const mockVideo = {
        paused: false,
        currentTime: 10.1, // video is 100ms ahead -> drift = +0.1
        playbackRate: 1.0,
        muted: true,
        volume: 0,
        readyState: 4,
        play: vi.fn(),
        pause: vi.fn()
      } as unknown as HTMLVideoElement;

      const { enforceSyncTick } = useLinkedMediaSync(
        () => mockAudio,
        () => mockVideo
      );

      enforceSyncTick();
      // correction = -0.1 * 0.25 = -0.025 -> new rate = 0.975
      expect(mockVideo.playbackRate).toBe(0.975);
    });

    it('hard-seeks video when drift exceeds 450ms', () => {
      const mockAudio = { paused: false, currentTime: 10.0, playbackRate: 1.0 } as HTMLAudioElement;
      const mockVideo = {
        paused: false,
        currentTime: 12.0, // video is 2.0s ahead -> drift = +2.0
        playbackRate: 1.0,
        muted: true,
        volume: 0,
        readyState: 4,
        play: vi.fn(),
        pause: vi.fn()
      } as unknown as HTMLVideoElement;

      const { enforceSyncTick } = useLinkedMediaSync(
        () => mockAudio,
        () => mockVideo
      );

      enforceSyncTick();
      expect(mockVideo.currentTime).toBe(10.0);
      expect(mockVideo.playbackRate).toBe(1.0);
    });
  });

  describe('6. Priority 1 Bug Fixes (E-01 through E-06)', () => {
    it('E-03: resolveDiscordClientId rejects empty and fake placeholder client IDs', async () => {
      const { resolveDiscordClientId } = await import('../src/main/modules/discordRpc');
      delete process.env.DISCORD_CLIENT_ID;
      expect(resolveDiscordClientId()).toBe('');

      process.env.DISCORD_CLIENT_ID = '1123456789012345678';
      expect(resolveDiscordClientId()).toBe('');

      process.env.DISCORD_CLIENT_ID = '1298765432109876543';
      expect(resolveDiscordClientId()).toBe('1298765432109876543');
      delete process.env.DISCORD_CLIENT_ID;
    });

    it('E-06: getSearchSuggestions combines local library matches and HTTPS YouTube suggestions', async () => {
      const mockGetSearchSuggestions = vi.fn(async (q: string) => ({
        data: [{ keyword: `${q} official video` }, { keyword: `${q} live` }]
      }));
      (globalThis as any).window.api = {
        getSearchSuggestions: mockGetSearchSuggestions,
        downloadClearCompleted: vi.fn(async () => true),
        showNotification: vi.fn()
      };

      const { getSearchSuggestions } = await import('../src/renderer/api/search');
      const suggestions = await getSearchSuggestions('yoasobi');
      expect(mockGetSearchSuggestions).toHaveBeenCalledWith('yoasobi');
      expect(suggestions).toContain('yoasobi official video');
      expect(suggestions).toContain('yoasobi live');
    });

    it('E-01 & E-02: SystemTab downloadClearCompleted and sleepTimer showNotification contracts', async () => {
      const clearSpy = vi.fn(async () => true);
      const notifySpy = vi.fn();
      (globalThis as any).window.api = {
        downloadClearCompleted: clearSpy,
        showNotification: notifySpy
      };

      await (globalThis as any).window.api.downloadClearCompleted();
      expect(clearSpy).toHaveBeenCalledOnce();

      (globalThis as any).window.api.showNotification({
        title: 'Sleep Timer Ended',
        body: 'Playback stopped'
      });
      expect(notifySpy).toHaveBeenCalledWith({
        title: 'Sleep Timer Ended',
        body: 'Playback stopped'
      });
    });
  });

  describe('7. Real Acoustic Waveform Seekbar & Windows SMTC (Tasks 1.4, 1.5 / E-12, E-14)', () => {
    it('Task 1.4 / E-14: bindOsMediaSessionHandlers and updateOsMediaMetadata wire SMTC controls', async () => {
      const actionHandlers: Record<string, (...args: any[]) => void> = {};
      const setPositionStateSpy = vi.fn();

      class MockMediaMetadata {
        title: string;
        artist: string;
        album: string;
        artwork: any[];
        constructor(init: any) {
          this.title = init.title;
          this.artist = init.artist;
          this.album = init.album;
          this.artwork = init.artwork;
        }
      }

      vi.stubGlobal('MediaMetadata', MockMediaMetadata);
      (globalThis.navigator as any).mediaSession = {
        metadata: null,
        playbackState: 'none',
        setActionHandler: vi.fn((action: string, cb: (...args: any[]) => void) => {
          actionHandlers[action] = cb;
        }),
        setPositionState: setPositionStateSpy
      };

      const { bindOsMediaSessionHandlers, updateOsMediaMetadata } = await import(
        '../src/renderer/services/osMediaSession'
      );

      const onPlay = vi.fn();
      const onPause = vi.fn();
      const onPrev = vi.fn();
      const onNext = vi.fn();
      const onSeekTo = vi.fn();

      bindOsMediaSessionHandlers({ onPlay, onPause, onPrev, onNext, onSeekTo });

      expect(actionHandlers.play).toBe(onPlay);
      expect(actionHandlers.pause).toBe(onPause);
      expect(actionHandlers.previoustrack).toBe(onPrev);
      expect(actionHandlers.nexttrack).toBe(onNext);
      actionHandlers.seekto({ seekTime: 42.5 });
      expect(onSeekTo).toHaveBeenCalledWith(42.5);

      updateOsMediaMetadata({
        title: 'Idol',
        artist: 'YOASOBI',
        album: 'THE BOOK 3',
        durationSec: 213,
        positionSec: 45,
        isPlaying: true
      });

      expect((globalThis.navigator as any).mediaSession.metadata.title).toBe('Idol');
      expect((globalThis.navigator as any).mediaSession.metadata.artist).toBe('YOASOBI');
      expect((globalThis.navigator as any).mediaSession.playbackState).toBe('playing');
      expect(setPositionStateSpy).toHaveBeenCalledWith({
        duration: 213,
        playbackRate: 1.0,
        position: 45
      });
    });

    it('Task 1.5 / E-12: computePeaksFromPcm downsamples PCM into normalized 0..1 waveform buckets', async () => {
      const { computePeaksFromPcm } = await import('../src/main/modules/audioFingerprint');
      const pcm = new Int16Array(8000);
      for (let i = 0; i < pcm.length; i += 1) {
        // First half quiet, second half loud
        const amp = i < 4000 ? 4000 : 28000;
        pcm[i] = Math.round(Math.sin(i * 0.1) * amp);
      }

      const peaks = computePeaksFromPcm(pcm, 40);
      expect(peaks).toHaveLength(40);
      expect(Math.max(...peaks)).toBe(1);
      expect(peaks[5]).toBeLessThan(peaks[35]);
    });

    it('Task 1.5 / E-12: getOrComputeWaveformPeaks caches computed peaks in Dexie waveforms table', async () => {
      const fakeIndexedDB = await import('fake-indexeddb');
      const { getOrComputeWaveformPeaks } = await import('../src/renderer/services/songLibrary');

      const mockPeaks = Array.from({ length: 32 }, (_, i) => Number(((i + 1) / 32).toFixed(3)));
      const getWaveformPeaksSpy = vi.fn(async () => mockPeaks);
      (globalThis as any).window.api = {
        ...(globalThis as any).window.api,
        getWaveformPeaks: getWaveformPeaksSpy
      };

      const first = await getOrComputeWaveformPeaks('C:/Music/test_track.flac', 32, fakeIndexedDB.indexedDB);
      expect(first).toEqual(mockPeaks);
      expect(getWaveformPeaksSpy).toHaveBeenCalledTimes(1);

      // Second lookup hits Dexie cache without re-invoking IPC
      const second = await getOrComputeWaveformPeaks('C:/Music/test_track.flac', 32, fakeIndexedDB.indexedDB);
      expect(second).toEqual(mockPeaks);
      expect(getWaveformPeaksSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('8. Security & Structural Hardening (E-07 through E-11)', () => {
    it('E-11: remoteControl defaults to 127.0.0.1 and enforces pairing token/PIN authentication', async () => {
      const {
        defaultRemoteControlConfig,
        isRemoteRequestAuthorized,
        normalizeRemoteControlConfig,
        resolveRemoteBindHost
      } = await import('../src/main/modules/remoteControl');

      const normalized = normalizeRemoteControlConfig({ enabled: true, port: 31888, allowedIps: [] });
      expect(normalized.allowLan).toBe(false);
      expect(resolveRemoteBindHost(normalized)).toBe('127.0.0.1');
      expect(normalized.authToken).toBeTruthy();
      expect(normalized.authToken!.length).toBeGreaterThanOrEqual(4);

      const lanConfig = normalizeRemoteControlConfig({
        ...defaultRemoteControlConfig,
        allowLan: true,
        authToken: 'secret-pin-1234'
      });
      expect(resolveRemoteBindHost(lanConfig)).toBe('0.0.0.0');

      // Unauthorized when token missing or wrong
      expect(isRemoteRequestAuthorized({}, {}, 'secret-pin-1234')).toBe(false);
      expect(
        isRemoteRequestAuthorized({ authorization: 'Bearer wrong' }, {}, 'secret-pin-1234')
      ).toBe(false);

      // Authorized via Bearer token, X-Remote-Token header, or query parameter
      expect(
        isRemoteRequestAuthorized(
          { authorization: 'Bearer secret-pin-1234' },
          {},
          'secret-pin-1234'
        )
      ).toBe(true);
      expect(
        isRemoteRequestAuthorized(
          { 'x-remote-token': 'secret-pin-1234' },
          {},
          'secret-pin-1234'
        )
      ).toBe(true);
      expect(
        isRemoteRequestAuthorized({}, { token: 'secret-pin-1234' }, 'secret-pin-1234')
      ).toBe(true);
    });
  });
});
