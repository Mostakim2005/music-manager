import { ref } from 'vue';

export interface ErrorReportEntry {
  id: string;
  timestamp: string;
  source: 'main' | 'renderer' | 'audio' | 'ipc' | 'network' | 'vue';
  severity: 'error' | 'warn' | 'fatal';
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

export const rendererErrorList = ref<ErrorReportEntry[]>([]);

let isInitialized = false;

export async function reportRendererError(entry: {
  source?: 'renderer' | 'audio' | 'ipc' | 'network' | 'vue';
  severity?: 'error' | 'warn' | 'fatal';
  message: string;
  stack?: string;
  context?: Record<string, any>;
}): Promise<ErrorReportEntry> {
  const item: ErrorReportEntry = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `rend_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    source: entry.source || 'renderer',
    severity: entry.severity || 'error',
    message: String(entry.message || 'Unknown error'),
    stack: entry.stack,
    context: entry.context
  };

  rendererErrorList.value.push(item);
  if (rendererErrorList.value.length > 200) {
    rendererErrorList.value.splice(0, rendererErrorList.value.length - 200);
  }

  try {
    if (typeof window !== 'undefined') {
      if (typeof (window as any).api?.reportError === 'function') {
        await (window as any).api.reportError(entry);
      } else if (typeof (window as any).ipcRenderer?.invoke === 'function') {
        await (window as any).ipcRenderer.invoke('error-reporter:report', entry);
      } else if (typeof (window as any).electron?.ipcRenderer?.invoke === 'function') {
        await (window as any).electron.ipcRenderer.invoke('error-reporter:report', entry);
      }
    }
  } catch (err) {
    console.error('[ErrorMonitor] Failed to send error report to main process:', err);
  }

  return item;
}

export function initRendererErrorMonitor(app?: any): void {
  if (isInitialized) return;
  isInitialized = true;

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event: ErrorEvent) => {
      if (
        event.message?.includes('ResizeObserver loop completed with undelivered notifications') ||
        event.message?.includes('ResizeObserver loop limit exceeded')
      ) {
        return;
      }

      void reportRendererError({
        source: 'renderer',
        severity: 'error',
        message: event.message || 'Script error',
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const isErr = reason instanceof Error;
      void reportRendererError({
        source: 'renderer',
        severity: 'error',
        message: isErr ? reason.message : String(reason || 'Unhandled Promise Rejection'),
        stack: isErr ? reason.stack : undefined,
        context: {
          type: 'unhandledrejection'
        }
      });
    });

    const onNewReport = (newReport: ErrorReportEntry) => {
      if (!newReport || !newReport.id) return;
      const existingIdx = rendererErrorList.value.findIndex((r) => r.id === newReport.id);
      if (existingIdx === -1) {
        rendererErrorList.value.push(newReport);
        if (rendererErrorList.value.length > 200) {
          rendererErrorList.value.splice(0, rendererErrorList.value.length - 200);
        }
      }
    };

    if (typeof (window as any).ipcRenderer?.on === 'function') {
      (window as any).ipcRenderer.on('error-report:new', onNewReport);
    } else if (typeof (window as any).electron?.ipcRenderer?.on === 'function') {
      (window as any).electron.ipcRenderer.on(
        'error-report:new',
        (_event: any, data: ErrorReportEntry) => onNewReport(data)
      );
    }
  }

  if (app && app.config) {
    const prevHandler = app.config.errorHandler;
    app.config.errorHandler = (err: unknown, instance: any, info: string) => {
      const isErr = err instanceof Error;
      const message = isErr ? err.message : String(err);
      const stack = isErr ? err.stack : undefined;
      void reportRendererError({
        source: 'vue',
        severity: 'error',
        message: `[Vue Error] ${message}`,
        stack,
        context: {
          info,
          componentName: instance?.$options?.name || instance?._?.type?.name || 'AnonymousComponent'
        }
      });
      if (typeof prevHandler === 'function') {
        prevHandler(err, instance, info);
      } else {
        console.error('[Vue ErrorHandler]', err, info);
      }
    };
  }
}

export async function getDiagnosticsData(): Promise<{
  diagnosticsUrl: string;
  logFilePath: string;
  reports: ErrorReportEntry[];
}> {
  try {
    if (typeof window !== 'undefined') {
      if (typeof (window as any).api?.invoke === 'function') {
        const res = await (window as any).api.invoke('error-reporter:get-reports');
        if (res && Array.isArray(res.reports)) {
          rendererErrorList.value = res.reports;
          return res;
        }
      }
      if (typeof (window as any).ipcRenderer?.invoke === 'function') {
        const res = await (window as any).ipcRenderer.invoke('error-reporter:get-reports');
        if (res && Array.isArray(res.reports)) {
          rendererErrorList.value = res.reports;
          return res;
        }
      }
      if (typeof (window as any).electron?.ipcRenderer?.invoke === 'function') {
        const res = await (window as any).electron.ipcRenderer.invoke('error-reporter:get-reports');
        if (res && Array.isArray(res.reports)) {
          rendererErrorList.value = res.reports;
          return res;
        }
      }
    }
  } catch (err) {
    console.error('[ErrorMonitor] Failed to fetch diagnostics data from main:', err);
  }

  return {
    diagnosticsUrl: 'http://127.0.0.1:41820/api/diagnostics',
    logFilePath: '',
    reports: rendererErrorList.value
  };
}

export async function clearDiagnosticsData(): Promise<{ ok: boolean }> {
  rendererErrorList.value = [];
  try {
    if (typeof window !== 'undefined') {
      if (typeof (window as any).ipcRenderer?.invoke === 'function') {
        return await (window as any).ipcRenderer.invoke('error-reporter:clear');
      }
      if (typeof (window as any).electron?.ipcRenderer?.invoke === 'function') {
        return await (window as any).electron.ipcRenderer.invoke('error-reporter:clear');
      }
      if (typeof (window as any).api?.invoke === 'function') {
        return await (window as any).api.invoke('error-reporter:clear');
      }
    }
  } catch (err) {
    console.error('[ErrorMonitor] Failed to clear diagnostics in main:', err);
  }
  return { ok: true };
}

export async function triggerTestDiagnosticError(customMessage?: string): Promise<any> {
  try {
    if (typeof window !== 'undefined') {
      if (typeof (window as any).ipcRenderer?.invoke === 'function') {
        return await (window as any).ipcRenderer.invoke('error-reporter:test', customMessage);
      }
      if (typeof (window as any).electron?.ipcRenderer?.invoke === 'function') {
        return await (window as any).electron.ipcRenderer.invoke(
          'error-reporter:test',
          customMessage
        );
      }
      if (typeof (window as any).api?.invoke === 'function') {
        return await (window as any).api.invoke('error-reporter:test', customMessage);
      }
    }
  } catch (err) {
    console.error('[ErrorMonitor] Failed to trigger test error in main:', err);
  }

  return reportRendererError({
    source: 'renderer',
    severity: 'warn',
    message: customMessage || 'Manual diagnostic test error from renderer',
    context: { triggeredAt: Date.now() }
  });
}

export async function exportDiagnosticsReport(): Promise<{ ok: boolean; filePath?: string }> {
  try {
    if (typeof window !== 'undefined') {
      if (typeof (window as any).ipcRenderer?.invoke === 'function') {
        return await (window as any).ipcRenderer.invoke('error-reporter:export');
      }
      if (typeof (window as any).electron?.ipcRenderer?.invoke === 'function') {
        return await (window as any).electron.ipcRenderer.invoke('error-reporter:export');
      }
      if (typeof (window as any).api?.invoke === 'function') {
        return await (window as any).api.invoke('error-reporter:export');
      }
    }
  } catch (err) {
    console.error('[ErrorMonitor] Failed to export diagnostics report from main:', err);
  }

  try {
    if (typeof document !== 'undefined') {
      const dataStr =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(rendererErrorList.value, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'music-manager-error-report.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
    return { ok: true, filePath: 'music-manager-error-report.json' };
  } catch {
    return { ok: false };
  }
}
