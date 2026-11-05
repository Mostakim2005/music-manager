import { describe, expect, it } from 'vitest';

import {
  getMusicFreeQualityLadder,
  getPluginQuality,
  inferPluginAudioFormat,
  qualityToBitrate
} from '../src/renderer/services/musicSourcePluginProtocol';
import {
  getMusicSourcePluginId,
  getMusicSourcePluginKey,
  isMusicSourcePluginKey
} from '../src/renderer/types/musicSourcePlugin';
import {
  detectMusicSourcePluginDialect,
  hashMusicSource,
  parseMusicFreeVars,
  parseMusicSourcePluginMeta,
  sanitizeMusicSourcePlatform
} from '../src/renderer/utils/musicSourcePlugin';
import {
  buildPluginMediaUrl,
  parsePluginMediaUrl,
  validatePluginMediaSource
} from '../src/shared/musicSourcePlugin';

const NATIVE_SOURCE = `/**
 * @name 测试音源
 * @version 1.2.0
 * @author tester
 * @var token | 访问令牌 | secret | required | 请输入令牌
 */
module.exports = {
  platform: 'test-source',
  getMediaSource: async (item, quality, ctx) => ({ url: 'https://example.com/a.mp3' })
};`;

const MUSICFREE_SOURCE = `module.exports = {
  platform: 'demo',
  userVariables: [{ key: 'apikey', name: 'API Key', type: 'password' }],
  getMediaSource: async (musicBase, quality) => 'https://example.com/b.flac'
};`;

const LX_SOURCE = `/*!


*/
const { EVENT_NAMES } = globalThis.lx;
globalThis.lx.on(EVENT_NAMES.request, () => {});`;

describe('detectMusicSourcePluginDialect', () => {
  it('recognizes an Alger native plugin', () => {
    expect(detectMusicSourcePluginDialect(NATIVE_SOURCE)).toBe('native');
  });

  it('recognizes a MusicFree plugin', () => {
    expect(detectMusicSourcePluginDialect(MUSICFREE_SOURCE)).toBe('musicfree');
  });

  it('recognizes an LX Music plugin', () => {
    expect(detectMusicSourcePluginDialect(LX_SOURCE)).toBe('lxmusic');
  });

  it('returns null for empty content', () => {
    expect(detectMusicSourcePluginDialect('')).toBeNull();
    expect(detectMusicSourcePluginDialect('const x = 1;')).toBeNull();
  });
});

describe('parseMusicSourcePluginMeta', () => {
  it('parses native plugin metadata and variables', () => {
    const meta = parseMusicSourcePluginMeta(NATIVE_SOURCE);
    expect(meta.name).toBe('测试音源');
    expect(meta.version).toBe('1.2.0');
    expect(meta.author).toBe('tester');
    expect(meta.platform).toBe('test-source');
    expect(meta.vars).toHaveLength(1);
    expect(meta.vars[0]).toMatchObject({
      key: 'token',
      label: '访问令牌',
      type: 'secret',
      required: true
    });
  });

  it('falls back to the platform field without metadata', () => {
    const meta = parseMusicSourcePluginMeta(MUSICFREE_SOURCE);
    expect(meta.platform).toBe('demo');
    expect(meta.name).toBe('demo');
  });
});

describe('parseMusicFreeVars', () => {
  it('normalizes MusicFree userVariables', () => {
    const vars = parseMusicFreeVars([
      { key: 'apikey', name: 'API Key', type: 'password' },
      { key: 'homepage', title: '主页', type: 'text' },
      'invalid'
    ]);
    expect(vars).toHaveLength(2);
    expect(vars[0]).toMatchObject({ key: 'apikey', type: 'secret' });
    expect(vars[1]).toMatchObject({ key: 'homepage', type: 'text' });
  });
});

describe('validatePluginMediaSource', () => {
  it('accepts a valid return value', () => {
    const media = validatePluginMediaSource({
      url: 'https://example.com/a.mp3',
      headers: { Referer: 'https://example.com' },
      format: 'MP3',
      br: 320000
    });
    expect(media).toMatchObject({ url: 'https://example.com/a.mp3', format: 'mp3', br: 320000 });
  });

  it('rejects a non http(s) URL', () => {
    expect(validatePluginMediaSource({ url: 'file:///etc/passwd' })).toBeNull();
    expect(validatePluginMediaSource({ url: 'javascript:alert(1)' })).toBeNull();
  });

  it('rejects invalid request headers', () => {
    expect(
      validatePluginMediaSource({ url: 'https://a.com/a.mp3', headers: { Host: 'evil.com' } })
    ).toBeNull();
    expect(
      validatePluginMediaSource({ url: 'https://a.com/a.mp3', headers: { Bad: 'a\r\nX: y' } })
    ).toBeNull();
  });
});

describe('plugin media url codec', () => {
  it('passes the original URL through when there are no headers', () => {
    expect(buildPluginMediaUrl('https://example.com/a.mp3')).toBe('https://example.com/a.mp3');
  });

  it('round-trips the URL and headers through encoding', () => {
    const proxied = buildPluginMediaUrl('https://example.com/a.mp3', {
      Referer: 'https://example.com',
      'User-Agent': 'Alger/1.0'
    });
    expect(proxied.startsWith('pluginmedia://')).toBe(true);
    const parsed = parsePluginMediaUrl(proxied);
    expect(parsed).toEqual({
      url: 'https://example.com/a.mp3',
      headers: { Referer: 'https://example.com', 'User-Agent': 'Alger/1.0' }
    });
  });

  it('rejects a forged non-http target', () => {
    const forged = `pluginmedia://p/?d=${encodeURIComponent(
      JSON.stringify({ url: 'file:///etc/passwd' })
    )}`;
    expect(parsePluginMediaUrl(forged)).toBeNull();
    expect(parsePluginMediaUrl('pluginmedia://p/')).toBeNull();
    expect(parsePluginMediaUrl('https://example.com')).toBeNull();
  });
});

describe('musicSourcePluginProtocol', () => {
  it('maps audio quality across dialects', () => {
    expect(getPluginQuality('lossless', 'musicfree')).toBe('super');
    expect(getPluginQuality('exhigh', 'musicfree')).toBe('high');
    expect(getPluginQuality('lossless', 'lxmusic')).toBe('flac');
    expect(getPluginQuality('exhigh', 'native')).toBe('exhigh');
  });

  it('starts the MusicFree quality ladder at the target', () => {
    // The target tier is preferred, then filled in from the remaining tiers
    expect(getMusicFreeQualityLadder('standard')).toEqual(['low', 'standard', 'high', 'super']);
    expect(getMusicFreeQualityLadder('lossless')).toEqual(['super', 'high', 'standard', 'low']);
  });

  it('infers the audio format from the URL', () => {
    expect(inferPluginAudioFormat('https://a.com/x.flac?sign=1')).toBe('flac');
    expect(inferPluginAudioFormat('https://a.com/x', 999000)).toBe('flac');
    expect(inferPluginAudioFormat('https://a.com/x')).toBe('mp3');
  });

  it('qualityToBitrate returns sane numbers', () => {
    expect(qualityToBitrate('standard')).toBe(128000);
    expect(qualityToBitrate('unknown')).toBe(320000);
  });
});

describe('plugin source key helpers', () => {
  it('plugin key read/write is symmetric', () => {
    const key = getMusicSourcePluginKey('abc123');
    expect(key).toBe('plugin:abc123');
    expect(isMusicSourcePluginKey(key)).toBe(true);
    expect(isMusicSourcePluginKey('gdmusic')).toBe(false);
    expect(getMusicSourcePluginId(key)).toBe('abc123');
    expect(getMusicSourcePluginId('gdmusic')).toBe('gdmusic');
  });
});

describe('hashMusicSource & sanitizeMusicSourcePlatform', () => {
  it('hashes identical sources stably', () => {
    expect(hashMusicSource(NATIVE_SOURCE)).toBe(hashMusicSource(NATIVE_SOURCE));
    expect(hashMusicSource(NATIVE_SOURCE)).not.toBe(hashMusicSource(MUSICFREE_SOURCE));
  });

  it('sanitizes illegal characters in platform names', () => {
    expect(sanitizeMusicSourcePlatform('My Source!$', 'fallback')).toBe('My-Source');
    expect(sanitizeMusicSourcePlatform('///', 'fallback')).toBe('fallback');
  });
});
