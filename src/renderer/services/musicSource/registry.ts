/**
 *
 */
import { computed } from 'vue';

import { useSettingsStore } from '@/store';
import type { MusicSourcePlugin } from '@/types/musicSourcePlugin';

import { getPluginSandboxRunner } from './PluginSandboxRunner';
import { builtinProviders } from './providers/builtin';
import type { MusicSourceProvider } from './types';

const PLUGIN_ICON_COLORS = ['#06b6d4', '#f59e0b', '#a855f7', '#10b981', '#ef4444', '#3b82f6'];
const PLUGIN_ICON_NAMES = [
  'ri-puzzle-2-fill',
  'ri-flashlight-fill',
  'ri-rocket-2-fill',
  'ri-star-fill',
  'ri-fire-fill',
  'ri-magic-fill'
];

export const pluginToProvider = (plugin: MusicSourcePlugin, index = 0): MusicSourceProvider => ({
  key: `plugin:${plugin.id}`,
  name: plugin.name,
  kind: 'plugin',
  icon: PLUGIN_ICON_NAMES[index % PLUGIN_ICON_NAMES.length],
  color: PLUGIN_ICON_COLORS[index % PLUGIN_ICON_COLORS.length],
  builtin: false,
  available: plugin.enabled,
  configHint: plugin.enabled ? undefined : 'settings.playback.pluginSources.disabled',
  plugin,
  resolve: async (song, quality) => {
    if (!plugin.enabled) return null;
    const runner = await getPluginSandboxRunner(plugin);
    return runner.getMediaSource(song, quality);
  }
});

export const useMusicSourceRegistry = () => {
  const settingsStore = useSettingsStore();

  const providers = computed<MusicSourceProvider[]>(() => {
    const plugins = ((settingsStore.setData.musicSourcePlugins || []) as MusicSourcePlugin[])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((plugin, index) => pluginToProvider(plugin, index));
    return [...builtinProviders, ...plugins];
  });

  const findProvider = (key: string): MusicSourceProvider | undefined =>
    providers.value.find((provider) => provider.key === key);

  /**
   */
  const orderedProviders = (sourceKeys?: string[]): MusicSourceProvider[] => {
    const enabledKeys = sourceKeys ?? (settingsStore.setData.enabledMusicSources || []);
    const order: string[] = settingsStore.setData.musicSourceOrder || [];
    const orderIndex = new Map(order.map((key, index) => [key, index]));

    return providers.value
      .filter((provider) => enabledKeys.includes(provider.key))
      .filter((provider) => provider.available !== false)
      .sort((a, b) => {
        const ia = orderIndex.has(a.key) ? orderIndex.get(a.key)! : Number.MAX_SAFE_INTEGER;
        const ib = orderIndex.has(b.key) ? orderIndex.get(b.key)! : Number.MAX_SAFE_INTEGER;
        if (ia !== ib) return ia - ib;
        return providers.value.indexOf(a) - providers.value.indexOf(b);
      });
  };

  return { providers, orderedProviders, findProvider };
};
