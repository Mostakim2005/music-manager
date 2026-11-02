import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userdata'),
    getVersion: vi.fn().mockReturnValue('5.1.0')
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  },
  getAllWindows: vi.fn().mockReturnValue([])
}));

vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: {
    getAllWindows: mocks.getAllWindows,
    getFocusedWindow: vi.fn().mockReturnValue(null)
  },
  dialog: mocks.dialog,
  ipcMain: mocks.ipcMain
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn()
  }
}));

import {
  clearReports,
  getReports,
  recordErrorReport
} from '../src/main/modules/errorReporter';
import {
  clearDiagnosticsData,
  exportDiagnosticsReport,
  getDiagnosticsData,
  rendererErrorList,
  reportRendererError,
  triggerTestDiagnosticError
} from '../src/renderer/services/errorMonitor';

describe('Built-in Error Reporting & Diagnostic Telemetry', () => {
  beforeEach(() => {
    clearReports();
    rendererErrorList.value = [];
  });

  describe('Main Process errorReporter', () => {
    it('records an error report entry with generated id and timestamp', () => {
      const entry = recordErrorReport({
        source: 'main',
        severity: 'error',
        message: 'Test database failure',
        stack: 'Error: Test database failure\n    at db.ts:10:5',
        context: { db: 'sqlite' }
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.source).toBe('main');
      expect(entry.severity).toBe('error');
      expect(entry.message).toBe('Test database failure');
      expect(entry.stack).toContain('db.ts:10:5');
      expect(entry.context).toEqual({ db: 'sqlite' });

      const all = getReports();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe(entry.id);
    });

    it('enforces a ring buffer cap of 200 entries', () => {
      for (let i = 0; i < 210; i++) {
        recordErrorReport({
          source: 'ipc',
          severity: 'warn',
          message: `Error message #${i}`
        });
      }

      const all = getReports();
      expect(all.length).toBe(200);
      expect(all[0].message).toBe('Error message #10');
      expect(all[199].message).toBe('Error message #209');
    });

    it('clears all reports cleanly', () => {
      recordErrorReport({
        source: 'audio',
        severity: 'fatal',
        message: 'Audio decode crash'
      });
      expect(getReports().length).toBe(1);

      clearReports();
      expect(getReports().length).toBe(0);
    });
  });

  describe('Renderer Process errorMonitor', () => {
    it('records error into reactive rendererErrorList', async () => {
      const reported = await reportRendererError({
        source: 'vue',
        severity: 'error',
        message: 'Vue render error',
        stack: 'at Component.vue:15'
      });

      expect(reported.id).toBeDefined();
      expect(reported.source).toBe('vue');
      expect(rendererErrorList.value.length).toBe(1);
      expect(rendererErrorList.value[0].message).toBe('Vue render error');
    });

    it('retrieves diagnostic data fallback when not in electron IPC mode', async () => {
      await reportRendererError({
        source: 'network',
        severity: 'warn',
        message: 'Song stream 404'
      });

      const data = await getDiagnosticsData();
      expect(data.diagnosticsUrl).toContain('41820');
      expect(data.reports.length).toBe(1);
      expect(data.reports[0].message).toBe('Song stream 404');
    });

    it('triggers test diagnostic error and clears data', async () => {
      await triggerTestDiagnosticError('Custom test diagnostic error');
      expect(rendererErrorList.value.length).toBe(1);
      expect(rendererErrorList.value[0].message).toBe('Custom test diagnostic error');

      await clearDiagnosticsData();
      expect(rendererErrorList.value.length).toBe(0);
    });

    it('exports diagnostics report via fallback data URL', async () => {
      await reportRendererError({
        source: 'audio',
        severity: 'error',
        message: 'Export test error'
      });

      const res = await exportDiagnosticsReport();
      expect(res.ok).toBe(true);
      expect(res.filePath).toBe('music-manager-error-report.json');
    });
  });
});
