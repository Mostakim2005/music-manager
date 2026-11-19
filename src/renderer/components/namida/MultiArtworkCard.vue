<template>
  <div class="namida-multi-artwork" :style="{ width: size, height: size }">
    <div v-if="tiles.length >= 2" class="collage-grid">
      <img
        v-for="(src, idx) in gridTiles"
        :key="`${idx}-${src}`"
        :src="src"
        alt=""
        class="collage-tile"
      />
    </div>
    <img v-else-if="tiles.length === 1" :src="tiles[0]" alt="" class="single-artwork" />
    <div v-else class="fallback-artwork">
      <i :class="fallbackIcon" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { dedupeArtworkCovers } from '@/utils/waveformHelpers';

const props = withDefaults(
  defineProps<{
    covers?: Array<string | null | undefined>;
    size?: string;
    fallbackIcon?: string;
  }>(),
  {
    covers: () => [],
    size: '100%',
    fallbackIcon: 'ri-folder-music-fill'
  }
);

const tiles = computed(() => dedupeArtworkCovers(props.covers, 4));

const gridTiles = computed(() => {
  const list = tiles.value;
  if (list.length >= 4) return list.slice(0, 4);
  if (list.length === 3) return [list[0], list[1], list[2], list[0]];
  if (list.length === 2) return [list[0], list[1], list[1], list[0]];
  return list;
});
</script>

<style scoped>
.namida-multi-artwork {
  position: relative;
  border-radius: var(--namida-radius-card, 14px);
  overflow: hidden;
  background: var(--namida-surface-card, rgba(35, 35, 35, 0.7));
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.collage-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2px;
  width: 100%;
  height: 100%;
}

.collage-tile,
.single-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fallback-artwork {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--namida-seed, 139, 92, 246));
  background: color-mix(in srgb, rgb(var(--namida-seed, 139, 92, 246)) 14%, transparent);
  font-size: 1.75rem;
}
</style>
