<template>
  <div class="eq-control p-6 rounded-lg bg-gray-100 dark:bg-gray-900 w-full max-w-[740px]">
    <div class="eq-header flex justify-between items-center mb-4 gap-3 flex-wrap">
      <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        {{ t('player.eq.title') }}
        <n-tag type="warning" size="small" round v-if="!isElectron">
          Available in the desktop app only
        </n-tag>
        <n-tag v-if="isParametric" type="info" size="small" round>
          Parametric AutoEQ ({{ parametricBands.length }} filters)
        </n-tag>
      </h3>
      <div class="eq-controls flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <span>Mono</span>
          <n-switch size="small" v-model:value="monoEnabled" @update:value="handleMonoChange" />
        </div>
        <div class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <span>Preserve Pitch</span>
          <n-switch
            size="small"
            v-model:value="preservesPitchEnabled"
            @update:value="handlePreservesPitchChange"
          />
        </div>
        <n-switch v-model:value="isEnabled" @update:value="toggleEQ">
          <template #checked>{{ t('player.eq.on') }}</template>
          <template #unchecked>{{ t('player.eq.off') }}</template>
        </n-switch>
      </div>
    </div>

    <!-- Preamp & AutoEQ toolbar -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex items-center gap-3 min-w-[240px] flex-1">
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
          Preamp
        </span>
        <n-slider
          v-model:value="preampDb"
          :min="-12"
          :max="12"
          :step="0.5"
          :disabled="!isEnabled"
          @update:value="handlePreampChange"
          class="flex-1 max-w-[200px]"
        />
        <span class="text-xs font-mono text-gray-600 dark:text-gray-300 w-14 text-right">
          {{ preampDb > 0 ? `+${preampDb.toFixed(1)}` : preampDb.toFixed(1) }}dB
        </span>
      </div>

      <div class="flex items-center gap-2">
        <input
          ref="autoEqFileInputRef"
          type="file"
          accept=".txt,text/plain"
          class="hidden"
          @change="handleAutoEqFileUpload"
        />
        <n-button size="tiny" secondary @click="triggerAutoEqFile">
          Import AutoEQ .txt
        </n-button>
        <n-button size="tiny" secondary @click="showAutoEqPaste = !showAutoEqPaste">
          {{ showAutoEqPaste ? 'Hide Paste' : 'Paste Profile' }}
        </n-button>
        <n-button size="tiny" quaternary @click="resetAllEq">Reset Flat</n-button>
      </div>
    </div>

    <div
      v-if="showAutoEqPaste"
      class="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-2 border border-gray-200 dark:border-gray-700"
    >
      <div class="text-xs text-gray-600 dark:text-gray-300">
        Paste EqualizerAPO / AutoEQ parametric profile (Preamp + PK/LSC/HSC filter lines):
      </div>
      <n-input
        v-model:value="autoEqDraft"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 6 }"
        placeholder="Preamp: -6.2 dB&#10;Filter 1: ON LSC Fc 105 Hz Gain 4.1 dB Q 0.70"
      />
      <div class="flex items-center justify-between gap-2">
        <span v-if="autoEqFeedback" class="text-xs text-emerald-500">{{ autoEqFeedback }}</span>
        <span v-else class="text-xs text-gray-400"></span>
        <div class="flex items-center gap-2">
          <n-button size="tiny" type="primary" @click="applyPastedAutoEq">
            Apply AutoEQ
          </n-button>
        </div>
      </div>
    </div>

    <div class="eq-presets mb-2 relative h-10" v-if="!isParametric">
      <n-scrollbar x-scrollable>
        <n-space :size="6" :wrap="false">
          <n-tag
            v-for="preset in presetOptions"
            :key="preset.value"
            :type="currentPreset === preset.value ? 'success' : 'default'"
            :bordered="false"
            size="medium"
            round
            clickable
            @click="applyPreset(preset.value)"
          >
            {{ preset.label }}
          </n-tag>
        </n-space>
      </n-scrollbar>
    </div>

    <!-- Active Parametric Filter List -->
    <div
      v-if="isParametric"
      class="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-3"
    >
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">
          Active Parametric Filter Chain ({{ parametricBands.length }} bands)
        </div>
        <n-button size="small" secondary type="primary" @click="resetParametricToGraphic">
          Reset to 10-Band Graphic EQ
        </n-button>
      </div>
      <n-scrollbar style="max-height: 240px">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-2">
          <div
            v-for="(band, idx) in parametricBands"
            :key="`${idx}-${band.frequency}`"
            class="flex items-center justify-between px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-900 text-xs font-mono"
          >
            <span class="text-gray-500 dark:text-gray-400">
              #{{ idx + 1 }} {{ band.type.toUpperCase() }}
            </span>
            <span class="font-medium text-gray-800 dark:text-gray-200">
              {{ Math.round(band.frequency) }} Hz
            </span>
            <span :class="band.gain >= 0 ? 'text-emerald-500' : 'text-amber-500'">
              {{ band.gain >= 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1) }} dB
            </span>
            <span class="text-gray-500 dark:text-gray-400">Q {{ band.q.toFixed(2) }}</span>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <div
      v-else
      class="eq-sliders flex justify-between items-end bg-gray-50 dark:bg-gray-800 gap-1 rounded-lg p-2 h-[300px]"
    >
      <div
        v-for="freq in frequencies"
        :key="freq"
        class="eq-slider flex flex-col items-center w-[45px] h-full"
      >
        <div
          class="freq-label text-xs font-medium text-center text-gray-600 dark:text-gray-400 whitespace-nowrap m-2 h-5"
        >
          {{ formatFreq(freq) }}
        </div>
        <n-slider
          v-model:value="eqValues[freq.toString()]"
          :min="-12"
          :max="12"
          :step="0.1"
          vertical
          :disabled="!isEnabled"
          @update:value="updateEQ(freq.toString(), $event)"
          class="flex-1 my-3 min-h-[180px]"
        />
        <div
          class="gain-value text-xs font-medium text-center text-gray-600 dark:text-gray-400 whitespace-nowrap my-1 h-4"
        >
          {{ eqValues[freq.toString()] }}dB
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { EqBand } from '@/services/audioDspGraph';
import { audioService } from '@/services/audioService';
import { isElectron } from '@/utils';

const { t } = useI18n();

const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const eqValues = ref<{ [key: string]: number }>({});
const initialDsp = audioService.getDspState();
const isEnabled = ref(initialDsp.eqEnabled);
const preampDb = ref(initialDsp.preampDb);
const monoEnabled = ref(initialDsp.mono);
const preservesPitchEnabled = ref(initialDsp.preservesPitch);
const dspBands = ref<EqBand[]>(initialDsp.bands);
const currentPreset = ref(audioService.getCurrentPreset() || 'flat');

const showAutoEqPaste = ref(false);
const autoEqDraft = ref('');
const autoEqFeedback = ref('');
const autoEqFileInputRef = ref<HTMLInputElement | null>(null);

const isParametric = computed(
  () =>
    dspBands.value.length !== frequencies.length ||
    dspBands.value.some((b) => b.type !== 'peaking')
);
const parametricBands = computed(() => dspBands.value);

const presets = {
  flat: {
    label: t('player.eq.presets.flat'),
    values: Object.fromEntries(frequencies.map((f) => [f, 0]))
  },
  pop: {
    label: t('player.eq.presets.pop'),
    values: {
      31: -1.5,
      62: 3.5,
      125: 5.5,
      250: 3.5,
      500: -0.5,
      1000: -1.5,
      2000: 1.5,
      4000: 2.5,
      8000: 2.5,
      16000: 2.5
    }
  },
  rock: {
    label: t('player.eq.presets.rock'),
    values: {
      31: 4.5,
      62: 3.5,
      125: 2,
      250: 0.5,
      500: -0.5,
      1000: -1,
      2000: 0.5,
      4000: 2,
      8000: 2.5,
      16000: 3.5
    }
  },
  classical: {
    label: t('player.eq.presets.classical'),
    values: {
      31: 3.5,
      62: 3,
      125: 2.5,
      250: 1.5,
      500: -0.5,
      1000: -1.5,
      2000: -1.5,
      4000: 0.5,
      8000: 2,
      16000: 3
    }
  },
  jazz: {
    label: t('player.eq.presets.jazz'),
    values: {
      31: 3,
      62: 2,
      125: 1.5,
      250: 2,
      500: -1,
      1000: -1.5,
      2000: -0.5,
      4000: 1,
      8000: 2.5,
      16000: 3
    }
  },
  hiphop: {
    label: t('player.eq.presets.hiphop'),
    values: {
      31: 5,
      62: 4.5,
      125: 3,
      250: 1.5,
      500: -0.5,
      1000: -1,
      2000: 0.5,
      4000: 1.5,
      8000: 2,
      16000: 2.5
    }
  },
  vocal: {
    label: t('player.eq.presets.vocal'),
    values: {
      31: -2,
      62: -1.5,
      125: -1,
      250: 0.5,
      500: 2,
      1000: 3.5,
      2000: 3,
      4000: 1.5,
      8000: 0.5,
      16000: 0
    }
  },
  dance: {
    label: t('player.eq.presets.dance'),
    values: {
      31: 4,
      62: 3.5,
      125: 2.5,
      250: 1,
      500: 0,
      1000: -0.5,
      2000: 1.5,
      4000: 2.5,
      8000: 3,
      16000: 2.5
    }
  },
  acoustic: {
    label: t('player.eq.presets.acoustic'),
    values: {
      31: 2,
      62: 1.5,
      125: 1,
      250: 1.5,
      500: 2,
      1000: 1.5,
      2000: 2,
      4000: 2.5,
      8000: 2,
      16000: 1.5
    }
  }
};

const presetOptions = Object.entries(presets).map(([value, preset]) => ({
  label: preset.label,
  value
}));

const syncFromDsp = () => {
  const next = audioService.getDspState();
  isEnabled.value = next.eqEnabled;
  preampDb.value = next.preampDb;
  monoEnabled.value = next.mono;
  preservesPitchEnabled.value = next.preservesPitch;
  dspBands.value = next.bands;
  eqValues.value = audioService.getAllEQSettings();
};

const toggleEQ = (enabled: boolean) => {
  audioService.setEQEnabled(enabled);
  syncFromDsp();
};

const handleMonoChange = (enabled: boolean) => {
  audioService.setMono(enabled);
  syncFromDsp();
};

const handlePreservesPitchChange = (enabled: boolean) => {
  audioService.setPreservesPitch(enabled);
  syncFromDsp();
};

const handlePreampChange = (db: number) => {
  audioService.setPreampDb(db);
};

const resetAllEq = () => {
  audioService.resetEQ();
  currentPreset.value = 'flat';
  audioService.setCurrentPreset('flat');
  autoEqFeedback.value = '';
  syncFromDsp();
};

const resetParametricToGraphic = () => {
  resetAllEq();
};

const triggerAutoEqFile = () => {
  autoEqFileInputRef.value?.click();
};

const applyAutoEqString = (text: string) => {
  const result = audioService.applyAutoEqText(text);
  if (result.applied) {
    currentPreset.value = 'custom';
    audioService.setCurrentPreset('custom');
    autoEqFeedback.value = `Applied ${result.bandsCount} parametric filters (Preamp ${result.preampDb.toFixed(1)} dB).`;
    syncFromDsp();
  } else {
    autoEqFeedback.value = 'No valid AutoEQ filter lines found.';
  }
};

const handleAutoEqFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const content = await file.text();
    autoEqDraft.value = content;
    showAutoEqPaste.value = true;
    applyAutoEqString(content);
  } finally {
    if (input) input.value = '';
  }
};

const applyPastedAutoEq = () => {
  applyAutoEqString(autoEqDraft.value);
};

const applyPreset = (presetName: string) => {
  currentPreset.value = presetName;
  audioService.setCurrentPreset(presetName);
  const preset = presets[presetName as keyof typeof presets];
  if (preset) {
    Object.entries(preset.values).forEach(([freq, gain]) => {
      updateEQ(freq, gain);
    });
  }
};

onMounted(() => {
  syncFromDsp();

  const savedPreset = audioService.getCurrentPreset();
  if (savedPreset && presets[savedPreset as keyof typeof presets]) {
    currentPreset.value = savedPreset;
  }
});

const updateEQ = (frequency: string, gain: number) => {
  audioService.setEQFrequencyGain(frequency, gain);
  eqValues.value = {
    ...eqValues.value,
    [frequency]: gain
  };

  const currentValues = eqValues.value;
  let matchedPreset: string | null = null;

  Object.entries(presets).forEach(([presetName, preset]) => {
    const isMatch = Object.entries(preset.values).every(
      ([freq, value]) => Math.abs(currentValues[freq] - value) < 0.1
    );
    if (isMatch) {
      matchedPreset = presetName;
    }
  });

  if (matchedPreset !== null) {
    currentPreset.value = matchedPreset;
    audioService.setCurrentPreset(matchedPreset);
  } else if (currentPreset.value !== 'custom') {
    currentPreset.value = 'custom';
    audioService.setCurrentPreset('custom');
  }
};

const formatFreq = (freq: number) => {
  if (freq >= 1000) {
    return `${freq / 1000}kHz`;
  }
  return `${freq}Hz`;
};
</script>

<style lang="scss" scoped>
:deep(.n-scrollbar) {
  margin-left: -0.5rem;
  margin-right: -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

:deep(.n-tag) {
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;

  &:hover {
    transform: translateY(-2px);
  }
}

:deep(.n-space) {
  flex-wrap: nowrap;
  padding: 4px 0;
}

:deep(.n-slider) {
  --n-rail-height: 4px;
  --n-rail-color: #e5e7eb;
  --n-rail-color-hover: #d1d5db;
  --n-fill-color: #22c55e;
  --n-fill-color-hover: #16a34a;
  --n-handle-color: #22c55e;
  --n-handle-box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  .n-slider-handle {
    transition: all 0.2s;
    &:hover {
      transform: scale(1.2);
    }
  }
}
</style>
