/**
 *
 *
 */
import { useSettingsStore } from '@/store';
import type { MusicSourcePlugin } from '@/types/musicSourcePlugin';
import { hashMusicSource, sanitizeMusicSourcePlatform } from '@/utils/musicSourcePlugin';

const MIGRATED_FLAG = 'musicSourceUnifiedMigrated';

type LegacyLxScript = {
  id: string;
  name: string;
  script: string;
  info?: { version?: string; author?: string };
  createdAt?: number;
};

export const buildLegacyKeyRemap = (): Record<string, string> => {
  const remap: Record<string, string> = { custom: 'customApi' };
  const settingsStore = useSettingsStore();
  const scripts = (settingsStore.setData.lxMusicScripts || []) as LegacyLxScript[];
  const activeId = settingsStore.setData.activeLxMusicApiId as string | null;

  const activeScript = scripts.find((script) => script.id === activeId);
  if (activeScript?.script) {
    remap.lxMusic = `plugin:${hashMusicSource(activeScript.script)}`;
  }
  return remap;
};

const remapKeys = (keys: string[], remap: Record<string, string>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    const mapped = remap[key] ?? key;
    if (!seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return out;
};

const remapSongLevelConfigs = (remap: Record<string, string>): void => {
  const entries = Object.entries(remap).filter(([from]) => from !== to(remap, from));
  if (!entries.length) return;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('song_source_') || key.startsWith('song_source_type_')) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const sources = JSON.parse(raw) as string[];
      if (!Array.isArray(sources)) continue;
      const remapped = remapKeys(sources, remap);
      if (JSON.stringify(remapped) !== JSON.stringify(sources)) {
        localStorage.setItem(key, JSON.stringify(remapped));
      }
    } catch {
      // Ignore legacy entries that cannot be parsed
    }
  }
};

const to = (remap: Record<string, string>, from: string): string => remap[from] ?? from;

/**
 */
export const migrateLegacyMusicSources = (): boolean => {
  const settingsStore = useSettingsStore();
  const data = settingsStore.setData;

  if (data[MIGRATED_FLAG]) return false;

  const scripts = (data.lxMusicScripts || []) as LegacyLxScript[];
  const activeId = (data.activeLxMusicApiId as string | null) || null;
  const plugins: MusicSourcePlugin[] = [
    ...((data.musicSourcePlugins || []) as MusicSourcePlugin[])
  ];
  const now = Date.now();

  let order = plugins.length ? Math.max(...plugins.map((p) => p.order)) + 1 : 0;
  for (const script of scripts) {
    if (!script?.script) continue;
    const id = hashMusicSource(script.script);
    if (plugins.some((p) => p.id === id)) continue;
    plugins.push({
      id,
      platform: sanitizeMusicSourcePlatform(script.name, `lx-${id.slice(0, 6)}`),
      name: script.name || 'LX Music source',
      dialect: 'lxmusic',
      ...(script.info?.version ? { version: script.info.version } : {}),
      ...(script.info?.author ? { author: script.info.author } : {}),
      source: script.script,
      vars: [],
      userVars: {},
      enabled: script.id === activeId,
      order: order++,
      createdAt: script.createdAt ?? now,
      updatedAt: now
    });
  }

  const remap = buildLegacyKeyRemap();
  const enabledSources = remapKeys((data.enabledMusicSources || []) as string[], remap);
  remapSongLevelConfigs(remap);

  // 3. Initialize user source order: YouTube default
  const pluginKeys = plugins
    .slice()
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.order - b.order)
    .map((p) => `plugin:${p.id}`);
  const defaultOrder = ['youtube', ...pluginKeys];
  const finalEnabledSources = enabledSources.includes('youtube')
    ? enabledSources
    : ['youtube', ...enabledSources];

  settingsStore.setSetData({
    musicSourcePlugins: plugins,
    enabledMusicSources: finalEnabledSources,
    musicSourceOrder: defaultOrder,
    [MIGRATED_FLAG]: true
  });

  const migratedCount = plugins.length;
  console.log(
    `[migration] Source migration complete: ${scripts.length} LX scripts stored (${activeId ? 1 : 0} active), remap ${JSON.stringify(remap)}`
  );
  return migratedCount > 0 || scripts.length > 0;
};
