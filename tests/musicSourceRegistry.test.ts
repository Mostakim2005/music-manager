/**
 * Music source registry and migration tests
 *
 * Covers the two core decisions of the refactor:
 *  - orderedProviders: user ordering (musicSourceOrder) + per-song override + stale key removal
 *  - migrateLegacyMusicSources: LX script ingest, legacy key remap (global/per-song), order init
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MusicSourcePlugin } from '../src/renderer/types/musicSourcePlugin';

// No localStorage in the node env: attach a minimal implementation for migration and tests
const localStorageStub = (() => {
  let store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => (store = new Map()),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    }
  };
})();
(globalThis as any).localStorage = localStorageStub;

// ---- minimal test-environment stubs ----

const mockSetData: Record<string, any> = {};

vi.mock('@/hooks/MusicHook', () => ({
  musicDB: { saveData: vi.fn(), getData: vi.fn(), deleteData: vi.fn() }
}));

const settingsStoreMock = {
  setData: mockSetData,
  setSetData: (data: Record<string, any>) => Object.assign(mockSetData, data)
};

vi.mock('@/store', () => ({
  useSettingsStore: () => settingsStoreMock,
  usePlaylistStore: () => ({}),
  usePlayerStore: () => ({})
}));

// The real store/modules/settings module also depends on the '@/store' barrel -- intercept it directly
vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: () => settingsStoreMock
}));

vi.mock('@/services/musicSource/PluginSandboxRunner', () => ({
  getPluginSandboxRunner: vi.fn(),
  disposePluginSandbox: vi.fn()
}));

vi.mock('@/api/music', () => ({
  getMusicUrl: vi.fn(async () => ({ data: { data: [{ url: '' }] } }))
}));

import { migrateLegacyMusicSources } from '../src/renderer/services/musicSource/migration';
import { builtinProviders } from '../src/renderer/services/musicSource/providers/builtin';
import { useMusicSourceRegistry } from '../src/renderer/services/musicSource/registry';

const resetData = () => {
  for (const key of Object.keys(mockSetData)) delete mockSetData[key];
  mockSetData.musicSourcePlugins = [];
  mockSetData.enabledMusicSources = [];
  mockSetData.musicSourceOrder = [];
  mockSetData.lxMusicScripts = [];
  mockSetData.activeLxMusicApiId = null;
};

beforeEach(() => {
  setActivePinia(createPinia());
  resetData();
  localStorage.clear();
});

describe('registry: orderedProviders', () => {
  it('ships every built-in provider with stable keys', () => {
    expect(builtinProviders.map((p) => p.key)).toEqual([
      'youtube'
    ]);
  });

  it('uses registry default order when unconfigured; stale keys stay out of the chain', () => {
    const { orderedProviders } = useMusicSourceRegistry();
    mockSetData.enabledMusicSources = ['youtube', 'not-exist-key'];

    const keys = orderedProviders().map((p) => p.key);
    expect(keys).toEqual(['youtube']);
  });

  it('musicSourceOrder decides the attempt order', () => {
    const { orderedProviders } = useMusicSourceRegistry();
    mockSetData.enabledMusicSources = ['youtube'];
    mockSetData.musicSourceOrder = ['youtube'];

    expect(orderedProviders().map((p) => p.key)).toEqual(['youtube']);
  });

  it('per-song override wins over the global set', () => {
    const { orderedProviders } = useMusicSourceRegistry();
    mockSetData.enabledMusicSources = ['youtube'];
    mockSetData.musicSourceOrder = ['youtube'];

    expect(orderedProviders(['youtube']).map((p) => p.key)).toEqual(['youtube']);
  });

  it('registers plugins as plugin:<id> and drops them once disabled', () => {
    mockSetData.musicSourcePlugins = [
      {
        id: 'abc',
        platform: 'demo',
        name: '演示插件',
        dialect: 'musicfree',
        source: '/* musicfree */',
        vars: [],
        userVars: {},
        enabled: false,
        order: 0,
        createdAt: 0,
        updatedAt: 0
      } as MusicSourcePlugin
    ];
    const { providers, orderedProviders } = useMusicSourceRegistry();
    expect(providers.value.map((p) => p.key)).toContain('plugin:abc');

    mockSetData.enabledMusicSources = ['youtube', 'plugin:abc'];
    // available=false (disabled) -> removed
    expect(orderedProviders().map((p) => p.key)).toEqual(['youtube']);
  });
});

describe('migration: migrateLegacyMusicSources', () => {
  const lxScript = {
    id: 'lx_1',
    name: '测试洛雪源',
    script:
      '/*! @name 测试洛雪源 */\n;(function(){var lx = globalThis.lx; lx.on(lx.EVENT_NAMES.request, function(){}); lx.send(lx.EVENT_NAMES.inited, {sources:{}});})();',
    info: { version: '1.0' },
    createdAt: 1700000000000
  };

  it('ingests LX scripts, enables the active one, and remaps legacy keys', async () => {
    const { hashMusicSource } = await import('../src/renderer/utils/musicSourcePlugin');
    mockSetData.lxMusicScripts = [lxScript];
    mockSetData.activeLxMusicApiId = 'lx_1';
    mockSetData.enabledMusicSources = ['lxMusic', 'custom', 'migu'];

    migrateLegacyMusicSources();

    const plugins = mockSetData.musicSourcePlugins as MusicSourcePlugin[];
    expect(plugins).toHaveLength(1);
    expect(plugins[0].dialect).toBe('lxmusic');
    expect(plugins[0].enabled).toBe(true);
    expect(plugins[0].id).toBe(hashMusicSource(lxScript.script));

    // legacy key remap
    expect(mockSetData.enabledMusicSources).toContain(`plugin:${hashMusicSource(lxScript.script)}`);

    // ordering initialized (youtube first)
    expect(mockSetData.musicSourceOrder[0]).toBe('youtube');
    // idempotency flag
    expect(mockSetData.musicSourceUnifiedMigrated).toBe(true);
  });

  it('ingests inactive LX scripts but leaves them disabled', () => {
    mockSetData.lxMusicScripts = [lxScript];
    mockSetData.activeLxMusicApiId = null;

    migrateLegacyMusicSources();
    expect((mockSetData.musicSourcePlugins as MusicSourcePlugin[])[0].enabled).toBe(false);
  });

  it('remaps legacy keys in per-song config too', async () => {
    const { hashMusicSource } = await import('../src/renderer/utils/musicSourcePlugin');
    mockSetData.lxMusicScripts = [lxScript];
    mockSetData.activeLxMusicApiId = 'lx_1';
    localStorage.setItem('song_source_123', JSON.stringify(['lxMusic', 'migu']));
    localStorage.setItem('song_source_type_123', 'manual');

    migrateLegacyMusicSources();

    const remapped = JSON.parse(localStorage.getItem('song_source_123')!);
    expect(remapped).toEqual([`plugin:${hashMusicSource(lxScript.script)}`, 'migu']);
    expect(localStorage.getItem('song_source_type_123')).toBe('manual');
  });

  it('is idempotent: skips when already migrated', () => {
    mockSetData.musicSourceUnifiedMigrated = true;
    mockSetData.lxMusicScripts = [lxScript];

    expect(migrateLegacyMusicSources()).toBe(false);
    expect(mockSetData.musicSourcePlugins).toEqual([]);
  });
});
