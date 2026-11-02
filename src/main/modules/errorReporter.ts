import crypto from 'crypto';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import http, { type IncomingMessage, type ServerResponse } from 'http';
import path from 'path';

export interface ErrorReportEntry {
  id: string;
  timestamp: string;
  source: 'main' | 'renderer' | 'audio' | 'ipc' | 'network' | 'vue';
  severity: 'error' | 'warn' | 'fatal';
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

const MAX_REPORTS = 200;
const reports: ErrorReportEntry[] = [];
const sseClients = new Set<ServerResponse>();

let activeDiagnosticsUrl = 'http://127.0.0.1:41820/api/diagnostics';
let httpServer: http.Server | null = null;
let isInitialized = false;

export function getLogFilePath(): string {
  try {
    return path.join(app.getPath('userData'), 'logs', 'error-reports.json');
  } catch {
    return path.join(process.cwd(), 'logs', 'error-reports.json');
  }
}

export function getExportLogFilePath(): string {
  try {
    return path.join(app.getPath('userData'), 'logs', 'error-reports-export.json');
  } catch {
    return path.join(process.cwd(), 'logs', 'error-reports-export.json');
  }
}

export function getActiveDiagnosticsUrl(): string {
  return activeDiagnosticsUrl;
}

export function getReports(): ErrorReportEntry[] {
  return [...reports];
}

function loadPersistedReports(): void {
  try {
    const filePath = getLogFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        reports.length = 0;
        reports.push(...parsed.slice(-MAX_REPORTS));
      }
    }
  } catch (err) {
    console.error('[ErrorReporter] Failed to read persisted error reports:', err);
  }
}

function persistReports(): void {
  try {
    const filePath = getLogFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ErrorReporter] Failed to persist error reports to disk:', err);
  }
}

function broadcastToSSEClients(entry: ErrorReportEntry): void {
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function recordErrorReport(
  entry: Omit<ErrorReportEntry, 'id' | 'timestamp'>
): ErrorReportEntry {
  const newEntry: ErrorReportEntry = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    source: entry.source || 'main',
    severity: entry.severity || 'error',
    message: String(entry.message || 'Unknown error'),
    stack: entry.stack ? String(entry.stack) : undefined,
    context: entry.context || undefined
  };

  reports.push(newEntry);
  if (reports.length > MAX_REPORTS) {
    reports.splice(0, reports.length - MAX_REPORTS);
  }

  persistReports();

  try {
    const windows =
      typeof BrowserWindow !== 'undefined' && BrowserWindow?.getAllWindows
        ? BrowserWindow.getAllWindows()
        : [];
    if (Array.isArray(windows)) {
      for (const win of windows) {
        if (win && !win.isDestroyed?.() && win.webContents) {
          win.webContents.send('error-report:new', newEntry);
        }
      }
    }
  } catch (e) {
    console.error('[ErrorReporter] Failed to broadcast error report to windows:', e);
  }

  broadcastToSSEClients(newEntry);

  return newEntry;
}

export function clearReports(): void {
  reports.length = 0;
  persistReports();
}

function parseRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function startDiagnosticsHttpServer(port = 41820): Promise<void> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const host = req.headers.host || `127.0.0.1:${port}`;
      const urlObj = new URL(req.url || '/', `http://${host}`);
      const pathname = urlObj.pathname;

      if (req.method === 'GET' && (pathname === '/api/diagnostics' || pathname === '/')) {
        let appVersion = '5.1.0';
        try {
          appVersion = app.getVersion();
        } catch {
          // ignore
        }
        const payload = {
          app: 'Music Manager',
          version: appVersion,
          uptimeSec: process.uptime(),
          pid: process.pid,
          platform: process.platform,
          diagnosticsUrl: activeDiagnosticsUrl,
          errorCount: reports.length,
          reports
        };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(payload, null, 2));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/diagnostics/stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        res.write(': connected\n\n');
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/diagnostics/clear') {
        clearReports();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/diagnostics/test') {
        const body = await parseRequestBody(req);
        const testReport = recordErrorReport({
          source: body?.source || 'main',
          severity: body?.severity || 'warn',
          message: body?.message || 'Diagnostic test error triggered via HTTP API',
          stack: body?.stack,
          context: body?.context || { trigger: 'http-test', timestamp: Date.now() }
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, report: testReport }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && port !== 0) {
        console.warn(`[ErrorReporter] Port ${port} is in use, falling back to dynamic port 0`);
        server.close();
        startDiagnosticsHttpServer(0).then(resolve);
      } else {
        console.error('[ErrorReporter] HTTP Server error:', err);
        resolve();
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      let actualPort = port;
      if (address && typeof address === 'object') {
        actualPort = address.port;
      }
      activeDiagnosticsUrl = `http://127.0.0.1:${actualPort}/api/diagnostics`;
      console.log(`[ErrorReporter] Diagnostics HTTP Watch API listening at ${activeDiagnosticsUrl}`);
      httpServer = server;
      resolve();
    });
  });
}

export function stopErrorReporterHttp(): void {
  if (httpServer) {
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    sseClients.clear();
    httpServer.close();
    httpServer = null;
  }
}

export function initializeErrorReporter(): void {
  if (isInitialized) return;
  isInitialized = true;

  loadPersistedReports();
  void startDiagnosticsHttpServer(41820);

  ipcMain.handle('error-reporter:get-reports', () => {
    return {
      diagnosticsUrl: activeDiagnosticsUrl,
      logFilePath: getLogFilePath(),
      reports: [...reports]
    };
  });

  ipcMain.handle(
    'error-reporter:report',
    (_event, entry: Omit<ErrorReportEntry, 'id' | 'timestamp'>) => {
      if (!entry) return null;
      return recordErrorReport({
        source: entry.source || 'renderer',
        severity: entry.severity || 'error',
        message: entry.message || 'Unknown error',
        stack: entry.stack,
        context: entry.context
      });
    }
  );

  ipcMain.handle('error-reporter:clear', () => {
    clearReports();
    return { ok: true };
  });

  ipcMain.handle('error-reporter:export', async () => {
    const defaultExportPath = getExportLogFilePath();
    try {
      const focusedWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const result = await dialog.showSaveDialog(focusedWin, {
        title: 'Export Error Reports',
        defaultPath: 'music-manager-error-report.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      const targetPath =
        !result.canceled && result.filePath ? result.filePath : defaultExportPath;
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, JSON.stringify(reports, null, 2), 'utf-8');
      return { ok: true, filePath: targetPath };
    } catch (err) {
      console.error('[ErrorReporter] Error exporting reports:', err);
      try {
        const dir = path.dirname(defaultExportPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(defaultExportPath, JSON.stringify(reports, null, 2), 'utf-8');
        return { ok: true, filePath: defaultExportPath };
      } catch (fallbackErr) {
        return { ok: false, error: String(fallbackErr) };
      }
    }
  });

  ipcMain.handle('error-reporter:test', (_event, customMessage?: string) => {
    const testReport = recordErrorReport({
      source: 'main',
      severity: 'warn',
      message: customMessage || 'Synthetic diagnostic test error report',
      context: { test: true, timestamp: Date.now() }
    });
    return { ok: true, report: testReport };
  });
}
