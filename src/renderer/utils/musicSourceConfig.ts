import { computed } from 'vue';

import { useMusicSourceRegistry } from '@/services/musicSource/registry';
import type { Platform } from '@/types/music';

export type MusicSourceGroup = 'builtin' | 'netease' | 'unblock' | 'plugin';

export type MusicSourceMeta = {
  key: Platform;
  icon: string;
  color: string;
  group: MusicSourceGroup;
};

export type MusicSourceInfo = MusicSourceMeta & {
  available: boolean;
  configHint?: string;
  label?: string;
  builtin?: boolean;
  pluginId?: string;
};

// ==================== Composable ====================
//

export const useMusicSources = () => {
  const { providers } = useMusicSourceRegistry();

  const allSources = computed<MusicSourceInfo[]>(() =>
    providers.value.map((provider) => ({
      key: provider.key as Platform,
      label: provider.name,
      icon: provider.icon,
      color: provider.color,
      group: provider.kind === 'plugin' ? 'plugin' : 'builtin',
      available: provider.available,
      configHint: provider.configHint,
      builtin: provider.builtin,
      ...(provider.plugin ? { pluginId: provider.plugin.id } : {})
    }))
  );

  return { allSources };
};
