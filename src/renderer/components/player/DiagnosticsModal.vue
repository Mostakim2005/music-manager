<template>
  <n-modal
    :show="show"
    :mask-closable="true"
    :z-index="9999999"
    @update:show="(val) => emit('update:show', val)"
  >
    <div
      class="diagnostics-modal p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl max-w-2xl w-[92vw] max-h-[85vh] flex flex-col"
    >
      <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <i class="ri-radar-line text-green-500" />
            Error Watch &amp; Diagnostics Center
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Automatic crash telemetry &amp; live HTTP/SSE diagnostic watch endpoint for external debugging
          </p>
        </div>
        <button
          type="button"
          aria-label="Close Diagnostics"
          class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
          @click="emit('update:show', false)"
        >
          <i class="ri-close-line text-xl" />
        </button>
      </div>

      <!-- Watch Endpoint Banner -->
      <div
        class="mt-4 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-2"
      >
        <div class="min-w-0">
          <div class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            Live HTTP Watch API (Poll JSON or Stream SSE `/stream`)
          </div>
          <code class="text-xs text-green-600 dark:text-green-400 break-all">
            {{ diagnosticsUrl || 'http://127.0.0.1:41820/api/diagnostics' }}
          </code>
        </div>
        <div class="flex items-center gap-2">
          <n-button size="tiny" secondary @click="copyWatchUrl">
            Copy API URL
          </n-button>
          <n-button size="tiny" secondary type="warning" @click="handleTriggerTest">
            Test Error
          </n-button>
          <n-button size="tiny" secondary type="primary" @click="handleExport">
            Export Report
          </n-button>
          <n-button size="tiny" secondary type="error" @click="handleClear">
            Clear ({{ reports.length }})
          </n-button>
        </div>
      </div>

      <!-- Error List -->
      <div class="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
        <div
          v-if="reports.length === 0"
          class="py-12 text-center text-sm text-neutral-400"
        >
          No errors recorded. System is healthy.
        </div>
        <div
          v-for="item in reports"
          :key="item.id"
          class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/70 dark:border-neutral-700/70 text-xs"
        >
          <div class="flex items-center justify-between gap-2">
            <span
              class="px-2 py-0.5 rounded-full font-semibold uppercase text-[10px]"
              :class="
                item.severity === 'fatal' || item.severity === 'error'
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-amber-500/15 text-amber-500'
              "
            >
              {{ item.source }} · {{ item.severity }}
            </span>
            <span class="text-neutral-400 font-mono text-[11px]">
              {{ item.timestamp }}
            </span>
          </div>
          <div class="mt-1.5 font-medium text-neutral-900 dark:text-white break-words">
            {{ item.message }}
          </div>
          <pre
            v-if="item.stack"
            class="mt-1.5 p-2 rounded bg-black/5 dark:bg-black/40 text-[10px] text-neutral-500 overflow-x-auto max-h-28"
          >{{ item.stack }}</pre>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { ref, watch } from 'vue';

import {
  clearDiagnosticsData,
  exportDiagnosticsReport,
  getDiagnosticsData,
  triggerTestDiagnosticError
} from '@/services/errorMonitor';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const { message } = createDiscreteApi(['message']);
const diagnosticsUrl = ref('http://127.0.0.1:41820/api/diagnostics');
const reports = ref<any[]>([]);

async function loadReports() {
  const data = await getDiagnosticsData();
  if (data.diagnosticsUrl) {
    diagnosticsUrl.value = data.diagnosticsUrl;
  }
  reports.value = data.reports || [];
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      void loadReports();
    }
  },
  { immediate: true }
);

async function copyWatchUrl() {
  try {
    await navigator.clipboard.writeText(diagnosticsUrl.value);
    message.success('Copied Watch API URL to clipboard.');
  } catch {
    message.info(diagnosticsUrl.value);
  }
}

async function handleTriggerTest() {
  await triggerTestDiagnosticError('Diagnostic test error triggered by user');
  await loadReports();
  message.info('Recorded test error report.');
}

async function handleExport() {
  const res = await exportDiagnosticsReport();
  if (res?.ok && res.filePath) {
    message.success(`Exported error report to ${res.filePath}`);
  }
}

async function handleClear() {
  await clearDiagnosticsData();
  await loadReports();
  message.success('Cleared error reports.');
}
</script>
