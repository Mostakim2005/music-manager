/**
 *
 */
import { useSettingsStore } from '@/store';
import type {
  MusicSourcePlugin,
  MusicSourcePluginDialect,
  MusicSourcePluginVar
} from '@/types/musicSourcePlugin';
import {
  detectMusicSourcePluginDialect,
  hashMusicSource,
  parseMusicSourcePluginMeta,
  sanitizeMusicSourcePlatform
} from '@/utils/musicSourcePlugin';

import {
  disposePluginSandbox,
  getPluginSandboxRunner,
  PluginSandboxRunner
} from './PluginSandboxRunner';

const MAX_PLUGIN_COUNT = 32;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

const readPlugins = (): MusicSourcePlugin[] => {
  const settingsStore = useSettingsStore();
  const raw = settingsStore.setData?.musicSourcePlugins;
  return Array.isArray(raw) ? (raw as MusicSourcePlugin[]) : [];
};

const writePlugins = (plugins: MusicSourcePlugin[]): void => {
  useSettingsStore().setSetData({ musicSourcePlugins: plugins });
};

export type PluginInstallResult = {
  plugin: MusicSourcePlugin;
  replaced: boolean;
  abilities: { methods: string[]; userVariables: MusicSourcePluginVar[] };
};

export const MusicSourcePluginStore = {
  getPlugins(): MusicSourcePlugin[] {
    return readPlugins();
  },

  getPlugin(id: string): MusicSourcePlugin | null {
    return readPlugins().find((plugin) => plugin.id === id) ?? null;
  },

  getEnabledPlugins(): MusicSourcePlugin[] {
    return readPlugins()
      .filter((plugin) => plugin.enabled)
      .sort((a, b) => a.order - b.order);
  },

  /**
   */
  async installFromSource(
    source: string,
    options: { name?: string; sourceUrl?: string } = {}
  ): Promise<PluginInstallResult> {
    let dialect = detectMusicSourcePluginDialect(source);
    if (source.length > MAX_SOURCE_BYTES) {
      throw new Error('Source script must not exceed 2 MB.');
    }
    if (!dialect) {
      const probe = new PluginSandboxRunner({
        id: `probe_${Date.now()}`,
        platform: 'probe',
        name: 'probe',
        dialect: 'lxmusic',
        source,
        vars: [],
        userVars: {},
        enabled: true,
        order: 0,
        createdAt: 0,
        updatedAt: 0
      });
      try {
        const meta = await probe.initialize();
        if (meta.methods.includes('getMediaSource')) dialect = 'lxmusic';
      } catch {
        // Not a loadable LX script
      } finally {
        probe.dispose();
      }
    }
    if (!dialect) {
      throw new Error(
        'Unrecognized source script format. Alger native, MusicFree and LX Music scripts are supported.'
      );
    }

    const existing = readPlugins();
    if (existing.length >= MAX_PLUGIN_COUNT) {
      throw new Error(`Source plugin limit reached（${MAX_PLUGIN_COUNT} max).`);
    }

    const meta = parseMusicSourcePluginMeta(source);
    const id = hashMusicSource(source);
    const prev = existing.find((plugin) => plugin.id === id);
    const now = Date.now();
    const platform = sanitizeMusicSourcePlatform(
      meta.platform || options.name || meta.name,
      `plugin-${id.slice(0, 6)}`
    );

    const mergedVars = this.mergeVars(prev?.vars ?? [], meta.vars);
    const plugin: MusicSourcePlugin = {
      id,
      platform,
      name: options.name || meta.name || platform,
      dialect,
      ...(meta.description ? { description: meta.description } : {}),
      ...(meta.version ? { version: meta.version } : {}),
      ...(meta.author ? { author: meta.author } : {}),
      ...(meta.homepage ? { homepage: meta.homepage } : {}),
      ...(options.sourceUrl || meta.sourceUrl
        ? { sourceUrl: options.sourceUrl || meta.sourceUrl }
        : {}),
      source,
      vars: mergedVars,
      userVars: this.mergeUserVars(prev?.userVars ?? {}, mergedVars),
      enabled: prev?.enabled ?? true,
      order: prev?.order ?? this.nextOrder(),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now
    };

    disposePluginSandbox(id);
    let abilities: PluginInstallResult['abilities'];
    try {
      const runner = await getPluginSandboxRunner(plugin);
      const runtime = runner.getRuntimeMeta();
      if (!runtime?.methods.length) {
        throw new Error('Script does not export any capability methods');
      }
      if (runtime.userVariables.length) {
        plugin.vars = this.mergeVars(plugin.vars, runtime.userVariables);
        plugin.userVars = this.mergeUserVars(plugin.userVars, plugin.vars);
      }
      abilities = { methods: runtime.methods, userVariables: runtime.userVariables };
    } catch (error) {
      disposePluginSandbox(id);
      throw new Error(
        `Script load failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const next = prev
      ? existing.map((item) => (item.id === id ? plugin : item))
      : [...existing, plugin];
    writePlugins(next);
    return { plugin, replaced: Boolean(prev), abilities };
  },

  removePlugin(id: string): void {
    const existing = readPlugins();
    if (!existing.some((plugin) => plugin.id === id)) return;
    writePlugins(existing.filter((plugin) => plugin.id !== id));
    disposePluginSandbox(id);
  },

  setEnabled(id: string, enabled: boolean): void {
    writePlugins(
      readPlugins().map((plugin) =>
        plugin.id === id ? { ...plugin, enabled, updatedAt: Date.now() } : plugin
      )
    );
  },

  setVars(id: string, userVars: Record<string, string>): void {
    writePlugins(
      readPlugins().map((plugin) =>
        plugin.id === id ? { ...plugin, userVars: { ...userVars }, updatedAt: Date.now() } : plugin
      )
    );
    disposePluginSandbox(id);
  },

  movePlugin(id: string, direction: -1 | 1): void {
    const sorted = [...readPlugins()].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((plugin) => plugin.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= sorted.length) return;

    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    writePlugins(sorted.map((plugin, order) => ({ ...plugin, order })));
  },

  async checkUpdate(id: string): Promise<{ hasUpdate: boolean; latestSource?: string }> {
    const plugin = this.getPlugin(id);
    if (!plugin?.sourceUrl) return { hasUpdate: false };
    try {
      const fetched = await window.api.fetchMusicSourcePlugin(plugin.sourceUrl);
      const remoteId = hashMusicSource(fetched.content);
      return { hasUpdate: remoteId !== plugin.id, latestSource: fetched.content };
    } catch (error) {
      console.warn('[pluginStore] Update check failed:', error);
      return { hasUpdate: false };
    }
  },

  getDialectLabel(dialect: MusicSourcePluginDialect): string {
    if (dialect === 'musicfree') return 'MusicFree';
    if (dialect === 'lxmusic') return 'LX Music';
    return 'Alger';
  },

  nextOrder(): number {
    const orders = readPlugins().map((plugin) => plugin.order);
    return orders.length ? Math.max(...orders) + 1 : 0;
  },

  mergeVars(
    current: MusicSourcePluginVar[],
    incoming: MusicSourcePluginVar[]
  ): MusicSourcePluginVar[] {
    const merged = [...current];
    const seen = new Set(merged.map((item) => item.key));
    for (const item of incoming) {
      if (seen.has(item.key)) continue;
      merged.push(item);
      seen.add(item.key);
    }
    return merged;
  },

  mergeUserVars(
    userVars: Record<string, string>,
    vars: MusicSourcePluginVar[]
  ): Record<string, string> {
    const next: Record<string, string> = {};
    for (const item of vars) {
      next[item.key] = userVars[item.key] ?? '';
    }
    return next;
  }
};
