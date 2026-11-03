import { describe, expect, it } from 'vitest';
import {
  estimateSizeBytes,
  extractVideoId,
  mapAndGroupFormats,
  STANDARD_HEIGHTS
} from '../src/main/modules/youtubeFormats';

describe('youtubeFormats', () => {
  describe('extractVideoId', () => {
    it('returns 11-char ID directly if passed directly', () => {
      expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('fVeJ6sJERR4')).toBe('fVeJ6sJERR4');
    });

    it('extracts ID from standard watch URLs', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('http://www.youtube.com/watch?feature=player_embedded&v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      );
    });

    it('extracts ID from youtu.be short URLs', () => {
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?si=abcdef123456')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from YouTube Music URLs', () => {
      expect(extractVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      );
    });

    it('extracts ID from Shorts and Embed URLs', () => {
      expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for invalid strings or non-YouTube URLs', () => {
      expect(extractVideoId('')).toBeNull();
      expect(extractVideoId(null)).toBeNull();
      expect(extractVideoId(undefined)).toBeNull();
      expect(extractVideoId('https://example.com/video/123')).toBeNull();
      expect(extractVideoId('short_id')).toBeNull();
      expect(extractVideoId('way_too_long_identifier_to_be_a_valid_youtube_id')).toBeNull();
    });
  });

  describe('estimateSizeBytes', () => {
    it('uses filesize when present and > 0', () => {
      expect(estimateSizeBytes(123456, 100000, 128, 60)).toBe(123456);
    });

    it('uses filesize_approx when filesize is missing', () => {
      expect(estimateSizeBytes(null, 99999, 128, 60)).toBe(99999);
    });

    it('estimates size from bitrate and duration when sizes are missing', () => {
      // 128 kbps * 1000 / 8 * 60 sec = 16000 * 60 = 960000 bytes
      expect(estimateSizeBytes(null, null, 128, 60)).toBe(960000);
    });

    it('returns 0 when no data is available', () => {
      expect(estimateSizeBytes(null, null, null, null)).toBe(0);
    });
  });

  describe('mapAndGroupFormats', () => {
    it('correctly maps audio and groups video formats by height', () => {
      const mockRaw = {
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        duration: 213,
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/small.jpg', width: 120, height: 90 },
          { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/large.jpg', width: 1280, height: 720 }
        ],
        formats: [
          // Storyboard format (should be ignored)
          {
            format_id: 'sb0',
            ext: 'mhtml',
            vcodec: 'none',
            acodec: 'none',
            format_note: 'storyboard'
          },
          // Audio only - 128kbps m4a
          {
            format_id: '140',
            ext: 'm4a',
            vcodec: 'none',
            acodec: 'mp4a.40.2',
            abr: 128,
            filesize: 3400000
          },
          // Audio only - 160kbps opus
          {
            format_id: '251',
            ext: 'opus',
            vcodec: 'none',
            acodec: 'opus',
            abr: 160,
            filesize: 4200000
          },
          // Video 360p progressive (hasAudio: true)
          {
            format_id: '18',
            ext: 'mp4',
            height: 360,
            fps: 30,
            vcodec: 'avc1.42001E',
            acodec: 'mp4a.40.2',
            vbr: 400,
            filesize: 12000000
          },
          // Video 720p progressive (format 22)
          {
            format_id: '22',
            ext: 'mp4',
            height: 720,
            fps: 30,
            vcodec: 'avc1.64001F',
            acodec: 'mp4a.40.2',
            vbr: 1200,
            filesize: 35000000
          },
          // Video 1080p DASH (video-only) - 30fps
          {
            format_id: '137',
            ext: 'mp4',
            height: 1080,
            fps: 30,
            vcodec: 'avc1.640028',
            acodec: 'none',
            vbr: 2500,
            filesize: 65000000
          },
          // Video 1080p DASH (video-only) - 60fps (higher fps, should be chosen as best)
          {
            format_id: '299',
            ext: 'mp4',
            height: 1080,
            fps: 60,
            vcodec: 'avc1.64002a',
            acodec: 'none',
            vbr: 4000,
            filesize: 105000000
          }
        ]
      };

      const result = mapAndGroupFormats(mockRaw);

      expect(result.id).toBe('dQw4w9WgXcQ');
      expect(result.title).toBe('Never Gonna Give You Up');
      expect(result.durationSec).toBe(213);
      expect(result.thumbnail).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/large.jpg');

      // Audio list
      expect(result.audio).toHaveLength(2);
      expect(result.audio[0].formatId).toBe('251');
      expect(result.audio[0].abrKbps).toBe(160);
      expect(result.audio[1].formatId).toBe('140');
      expect(result.audio[1].abrKbps).toBe(128);

      // Video list: heights 1080, 720, 360
      const heights = result.video.map((v) => v.height);
      expect(heights).toEqual([1080, 720, 360]);

      // 1080p format picked the 60fps one (format 299)
      const v1080 = result.video.find((v) => v.height === 1080);
      expect(v1080).toBeDefined();
      expect(v1080?.formatId).toBe('299');
      expect(v1080?.fps).toBe(60);
      expect(v1080?.hasAudio).toBe(false);

      // 720p format
      const v720 = result.video.find((v) => v.height === 720);
      expect(v720?.formatId).toBe('22');
      expect(v720?.hasAudio).toBe(true);

      // 360p format
      const v360 = result.video.find((v) => v.height === 360);
      expect(v360?.formatId).toBe('18');
      expect(v360?.hasAudio).toBe(true);
    });
  });
});
